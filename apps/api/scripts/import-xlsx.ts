/**
 * Importa registros da planilha Controle-Financeiro-2026.xlsx para o banco.
 *
 * Uso:
 *   ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-xlsx.ts [caminho-do-arquivo.xlsx]
 *
 * Se nenhum caminho for informado, usa o padrão relativo à raiz do monorepo.
 */

import { PrismaClient, TransactionType, ExpenseType } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// ─── Normalização de nomes ────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  assinatura: 'Assinaturas',
  assinaturas: 'Assinaturas',
  pets: 'Pet',
  pet: 'Pet',
};

const PAYMENT_MAP: Record<string, string> = {
  'credito - itau': 'Crédito - Itaú',
  'credito - itaú': 'Crédito - Itaú',
  'crédito - itau': 'Crédito - Itaú',
  'credito - nu': 'Crédito - Nu',
  'credito - janaína': 'Crédito - Janaína',
  'credito - janaina': 'Crédito - Janaína',
};

const EXPENSE_TYPE_MAP: Record<string, ExpenseType> = {
  fixo: ExpenseType.FIXO,
  esporadico: ExpenseType.ESPORADICO,
  esporádico: ExpenseType.ESPORADICO,
  terceiros: ExpenseType.TERCEIROS,
};

function normalizeCategory(name: string): string {
  const key = name.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? name.trim();
}

function normalizePaymentMethod(name: string): string {
  const key = name.trim().toLowerCase();
  return PAYMENT_MAP[key] ?? name.trim();
}

function normalizeExpenseType(raw: string | null | undefined): ExpenseType | null {
  if (!raw) return null;
  return EXPENSE_TYPE_MAP[raw.trim().toLowerCase()] ?? null;
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

async function getCategoryId(
  name: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const normalized = normalizeCategory(name);
  if (cache.has(normalized)) return cache.get(normalized)!;

  let cat = await prisma.category.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (!cat) {
    cat = await prisma.category.create({ data: { name: normalized, isSystem: false } });
    console.log(`  ⚠️  Categoria criada: "${normalized}"`);
  }
  cache.set(normalized, cat.id);
  return cat.id;
}

async function getPaymentMethodId(
  name: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const normalized = normalizePaymentMethod(name);
  if (cache.has(normalized)) return cache.get(normalized)!;

  let pm = await prisma.paymentMethod.findFirst({
    where: { name: { equals: normalized, mode: 'insensitive' } },
  });
  if (!pm) {
    pm = await prisma.paymentMethod.create({ data: { name: normalized, type: 'OUTRO' } });
    console.log(`  ⚠️  Forma de pagamento criada: "${normalized}"`);
  }
  cache.set(normalized, pm.id);
  return pm.id;
}

// ─── Leitura das abas ─────────────────────────────────────────────────────────

interface ReceitaRow {
  Data: Date | string | number;
  Ciclo: Date | string | number;
  Fonte: string;
  // A coluna tem espaços no cabeçalho da planilha: " Valor "
  ' Valor ': number;
}

interface DespesaRow {
  Data: Date | string | number;
  Ciclo: Date | string | number;
  Categoria: string;
  'Descrição': string;
  // A coluna tem espaços no cabeçalho da planilha: " Valor "
  ' Valor ': number;
  'Forma de Pagamento': string;
  Tipo: string;
  'Compra parcelada?': string | number | null;
  Parcela: string | null;
}

function parseDate(raw: Date | string | number): Date {
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number') {
    // Excel serial date
    return XLSX.SSF.parse_date_code(raw) as unknown as Date;
  }
  return new Date(raw);
}

function isParcelada(raw: string | number | null | undefined): boolean {
  if (!raw) return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'sim' || s === 'yes';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const xlsxPath =
    fileArg ?? path.resolve(__dirname, '../../../Controle-Financeiro-2026.xlsx');

  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ Arquivo não encontrado: ${xlsxPath}`);
    process.exit(1);
  }

  console.log(`📂 Lendo: ${xlsxPath}\n`);

  const workbook = XLSX.readFile(xlsxPath, { cellDates: true });

  // Busca o usuário (single-user — usa o primeiro registrado)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('❌ Nenhum usuário encontrado. Execute o seed primeiro.');
    process.exit(1);
  }
  console.log(`👤 Importando para: ${user.name} (${user.email})\n`);

  // Verifica se já existem transações importadas
  const existing = await prisma.transaction.count({ where: { userId: user.id } });
  if (existing > 0) {
    if (!force) {
      console.log(
        `⚠️  Já existem ${existing} lançamentos. Use --force para reimportar (apaga os existentes).\n`,
      );
      process.exit(0);
    }
    console.log(`🗑️  Removendo ${existing} lançamentos existentes...`);
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
  }

  const categoryCache = new Map<string, string>();
  const paymentCache = new Map<string, string>();

  // ── Importar RECEITAS ────────────────────────────────────────────────────────
  console.log('💰 Importando RECEITAS...');
  const receitasSheet = workbook.Sheets['Receitas'] ?? workbook.Sheets['RECEITAS'];
  if (!receitasSheet) {
    console.warn('  ⚠️  Aba "Receitas" não encontrada, pulando.');
  } else {
    const rows = XLSX.utils.sheet_to_json<ReceitaRow>(receitasSheet, { defval: null });
    let count = 0;
    for (const row of rows) {
      if (!row[' Valor '] || !row.Data) continue;
      const amount = Number(row[' Valor ']);
      if (isNaN(amount) || amount <= 0) continue;

      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.RECEITA,
          date: parseDate(row.Data),
          cycleDate: row.Ciclo ? parseDate(row.Ciclo) : null,
          source: row.Fonte ? String(row.Fonte).trim() : null,
          description: row.Fonte ? String(row.Fonte).trim() : 'Receita',
          amount,
        },
      });
      count++;
    }
    console.log(`  ✓ ${count} receitas importadas`);
  }

  // ── Importar DESPESAS ────────────────────────────────────────────────────────
  console.log('\n💸 Importando DESPESAS...');
  const despesasSheet = workbook.Sheets['Despesas'] ?? workbook.Sheets['DESPESAS'];
  if (!despesasSheet) {
    console.warn('  ⚠️  Aba "Despesas" não encontrada, pulando.');
  } else {
    const rows = XLSX.utils.sheet_to_json<DespesaRow>(despesasSheet, { defval: null });
    let count = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row[' Valor '] || !row.Data || !row['Descrição']) {
        skipped++;
        continue;
      }
      const amount = Number(row[' Valor ']);
      if (isNaN(amount) || amount <= 0) {
        skipped++;
        continue;
      }

      const categoryId = row.Categoria
        ? await getCategoryId(String(row.Categoria), categoryCache)
        : null;

      const paymentMethodId = row['Forma de Pagamento']
        ? await getPaymentMethodId(String(row['Forma de Pagamento']), paymentCache)
        : null;

      const expenseType = normalizeExpenseType(row.Tipo ? String(row.Tipo) : null);
      const installment = isParcelada(row['Compra parcelada?']);
      const installmentInfo = row.Parcela ? String(row.Parcela).trim() : null;

      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.DESPESA,
          date: parseDate(row.Data),
          cycleDate: row.Ciclo ? parseDate(row.Ciclo) : null,
          description: String(row['Descrição']).trim(),
          amount,
          categoryId,
          paymentMethodId,
          expenseType,
          isInstallment: installment,
          installmentInfo: installment ? installmentInfo : null,
        },
      });
      count++;
    }
    console.log(`  ✓ ${count} despesas importadas`);
    if (skipped > 0) console.log(`  ⏭️  ${skipped} linhas ignoradas (sem valor/data/descrição)`);
  }

  // ── Resumo final ─────────────────────────────────────────────────────────────
  const total = await prisma.transaction.count({ where: { userId: user.id } });
  const totalReceitas = await prisma.transaction.count({
    where: { userId: user.id, type: 'RECEITA' },
  });
  const totalDespesas = await prisma.transaction.count({
    where: { userId: user.id, type: 'DESPESA' },
  });

  console.log(`\n✅ Importação concluída!`);
  console.log(`   Total: ${total} lançamentos`);
  console.log(`   Receitas: ${totalReceitas} | Despesas: ${totalDespesas}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
