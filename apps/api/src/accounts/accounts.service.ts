import { Injectable } from '@nestjs/common';
import { BalanceSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SummaryService } from '../summary/summary.service';

export interface AccountBalanceResult {
  year: number;
  month: number;
  saldoCicloAtual: number;
  saldoAnterior: number | null;
  saldoCalculado: number;
  saldoEmConta: number;
  source: BalanceSource;
  divergence: number | null;
  note: string | null;
  hasInitial: boolean;
  /** true quando faltou ponto de partida (INITIAL) e o cálculo assumiu 0 */
  incomplete: boolean;
}

const MAX_RECURSION_MONTHS = 24;

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private summaryService: SummaryService,
  ) {}

  /**
   * Resolve o saldo em conta no FIM do ciclo (year, month).
   *
   * Cadeia de resolução:
   *  1. Se existe registro INITIAL ou MANUAL_ADJUST nesse mês → usa o valor.
   *  2. Senão, calcula: saldoEmConta(m-1) + saldoCiclo(m), persiste como CALCULATED.
   *  3. Limite de recursão de 24 meses para trás — se nada for encontrado,
   *     marca incomplete=true e usa 0 como ponto de partida.
   */
  async getOrCalculate(userId: string, year: number, month: number): Promise<AccountBalanceResult> {
    const hasInitial = (await this.prisma.accountBalance.count({
      where: { userId, source: 'INITIAL' },
    })) > 0;

    const result = await this.resolveBalance(userId, year, month, 0);
    return { ...result, hasInitial };
  }

  /**
   * Lê o saldo do mês anterior (recursivo) sem persistir; usado tanto para
   * meses CALCULATED quanto para informar `saldoAnterior` no retorno.
   */
  private async resolveBalance(
    userId: string,
    year: number,
    month: number,
    depth: number,
  ): Promise<Omit<AccountBalanceResult, 'hasInitial'>> {
    const referenceDate = this.firstOfMonth(year, month);

    // Se há registro persistido (qualquer source), começamos por ele
    const existing = await this.prisma.accountBalance.findUnique({
      where: { userId_referenceDate: { userId, referenceDate } },
    });

    // INITIAL e MANUAL_ADJUST são "ground truth" — não precisam recalcular
    if (existing && (existing.source === 'INITIAL' || existing.source === 'MANUAL_ADJUST')) {
      const cycleSummary = await this.summaryService.getSummary(userId, year, month);
      const saldoCicloAtual = cycleSummary.saldo;
      const prev = await this.peekPreviousBalance(userId, year, month, depth);
      const saldoCalculado = (prev?.saldoEmConta ?? 0) + saldoCicloAtual;
      const saldoEmConta = Number(existing.amount);
      return {
        year,
        month,
        saldoCicloAtual,
        saldoAnterior: prev?.saldoEmConta ?? null,
        saldoCalculado,
        saldoEmConta,
        source: existing.source,
        divergence: existing.source === 'MANUAL_ADJUST' ? saldoEmConta - saldoCalculado : null,
        note: existing.note,
        incomplete: prev?.incomplete ?? false,
      };
    }

    // Sem registro ou registro CALCULATED — derivamos a partir do mês anterior
    const cycleSummary = await this.summaryService.getSummary(userId, year, month);
    const saldoCicloAtual = cycleSummary.saldo;

    const prev = await this.peekPreviousBalance(userId, year, month, depth);
    const saldoAnterior = prev?.saldoEmConta ?? 0;
    const incomplete = prev?.incomplete ?? !prev;
    const saldoCalculado = saldoAnterior + saldoCicloAtual;

    // Cache: persistimos ou atualizamos o CALCULATED para o mês alvo
    await this.prisma.accountBalance.upsert({
      where: { userId_referenceDate: { userId, referenceDate } },
      create: {
        userId,
        referenceDate,
        amount: new Prisma.Decimal(saldoCalculado.toFixed(2)),
        source: 'CALCULATED',
      },
      update: {
        amount: new Prisma.Decimal(saldoCalculado.toFixed(2)),
        source: 'CALCULATED',
        note: null,
      },
    });

    return {
      year,
      month,
      saldoCicloAtual,
      saldoAnterior: prev?.saldoEmConta ?? null,
      saldoCalculado,
      saldoEmConta: saldoCalculado,
      source: 'CALCULATED',
      divergence: null,
      note: null,
      incomplete,
    };
  }

  /**
   * Resolve o saldo do mês imediatamente anterior, respeitando o limite de
   * profundidade. Retorna null quando esgotamos o lookback sem achar INITIAL.
   */
  private async peekPreviousBalance(
    userId: string,
    year: number,
    month: number,
    depth: number,
  ): Promise<{ saldoEmConta: number; incomplete: boolean } | null> {
    if (depth >= MAX_RECURSION_MONTHS) return null;

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    // Atalho: se o mês anterior tem INITIAL/MANUAL_ADJUST/CALCULATED, lemos direto
    const prevReference = this.firstOfMonth(prevYear, prevMonth);
    const prev = await this.prisma.accountBalance.findUnique({
      where: { userId_referenceDate: { userId, referenceDate: prevReference } },
    });

    if (prev && (prev.source === 'INITIAL' || prev.source === 'MANUAL_ADJUST')) {
      return { saldoEmConta: Number(prev.amount), incomplete: false };
    }

    // CALCULATED ou ausente → recalcula recursivamente
    const resolved = await this.resolveBalance(userId, prevYear, prevMonth, depth + 1);
    return { saldoEmConta: resolved.saldoEmConta, incomplete: resolved.incomplete };
  }

  /** 1º dia do mês às 00:00 UTC — chave de unicidade do AccountBalance */
  private firstOfMonth(year: number, month: number): Date {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  }

  /**
   * Invalida (remove) os registros CALCULATED a partir de uma data — usado
   * quando uma transação muda no passado ou o usuário ajusta um mês manualmente.
   * INITIAL e MANUAL_ADJUST são preservados.
   */
  async invalidateCalculatedFrom(userId: string, year: number, month: number): Promise<void> {
    const from = this.firstOfMonth(year, month);
    await this.prisma.accountBalance.deleteMany({
      where: {
        userId,
        source: 'CALCULATED',
        referenceDate: { gte: from },
      },
    });
  }
}
