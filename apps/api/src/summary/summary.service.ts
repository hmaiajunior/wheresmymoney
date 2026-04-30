import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CycleBounds {
  start: Date;
  end: Date;
}

@Injectable()
export class SummaryService {
  constructor(private prisma: PrismaService) {}

  getCycleBounds(year: number, month: number, cycleStartDay: number): CycleBounds {
    const start = new Date(year, month - 1, cycleStartDay, 0, 0, 0, 0);
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const end = new Date(endYear, endMonth - 1, cycleStartDay - 1, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Constrói a cláusula WHERE para o período.
   * Agrupa pelo mês calendário em ambos os casos:
   *  1. Transações com cycleDate preenchido: usa o mês/ano de cycleDate
   *  2. Transações sem cycleDate: usa o mês/ano de date
   */
  private buildPeriodWhere(
    userId: string,
    year: number,
    month: number,
    _cycleStartDay: number,
    extra: Prisma.TransactionWhereInput = {},
  ): Prisma.TransactionWhereInput {
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    return {
      userId,
      OR: [
        { cycleDate: { gte: monthStart, lte: monthEnd }, ...extra },
        { cycleDate: null, date: { gte: monthStart, lte: monthEnd }, ...extra },
      ],
    };
  }

  async getSummary(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { start, end } = this.getCycleBounds(year, month, user.cycleStartDay);

    const where = (extra: Prisma.TransactionWhereInput) =>
      this.buildPeriodWhere(userId, year, month, user.cycleStartDay, extra);

    const [receitasResult, despesasFixasResult, despesasEsporadicasResult, despesasTerceirosResult, transactionCount] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: where({ type: 'RECEITA' }),
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: where({ type: 'DESPESA', expenseType: 'FIXO' }),
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: where({ type: 'DESPESA', expenseType: 'ESPORADICO' }),
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: where({ type: 'DESPESA', expenseType: 'TERCEIROS' }),
          _sum: { amount: true },
        }),
        this.prisma.transaction.count({ where: where({}) }),
      ]);

    const receitas = Number(receitasResult._sum.amount ?? 0);
    const despesasFixas = Number(despesasFixasResult._sum.amount ?? 0);
    const despesasEsporadicas = Number(despesasEsporadicasResult._sum.amount ?? 0);
    const despesasTerceiros = Number(despesasTerceirosResult._sum.amount ?? 0);
    const totalDespesas = despesasFixas + despesasEsporadicas;
    const saldo = receitas - totalDespesas;

    return {
      year, month, cycleStartDay: user.cycleStartDay,
      cycleStart: start.toISOString(), cycleEnd: end.toISOString(),
      receitas, despesasFixas, despesasEsporadicas, despesasTerceiros,
      totalDespesas, saldo, transactionCount,
    };
  }

  async getYearlySummary(userId: string, year: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return Promise.all(months.map((m) => this.getSummaryForUser(user.id, year, m, user.cycleStartDay)));
  }

  private async getSummaryForUser(userId: string, year: number, month: number, cycleStartDay: number) {
    const { start, end } = this.getCycleBounds(year, month, cycleStartDay);
    const where = (extra: Prisma.TransactionWhereInput) =>
      this.buildPeriodWhere(userId, year, month, cycleStartDay, extra);

    const [r, df, de, dt, count] = await Promise.all([
      this.prisma.transaction.aggregate({ where: where({ type: 'RECEITA' }), _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: where({ type: 'DESPESA', expenseType: 'FIXO' }), _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: where({ type: 'DESPESA', expenseType: 'ESPORADICO' }), _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: where({ type: 'DESPESA', expenseType: 'TERCEIROS' }), _sum: { amount: true } }),
      this.prisma.transaction.count({ where: where({}) }),
    ]);

    const receitas = Number(r._sum.amount ?? 0);
    const despesasFixas = Number(df._sum.amount ?? 0);
    const despesasEsporadicas = Number(de._sum.amount ?? 0);
    const despesasTerceiros = Number(dt._sum.amount ?? 0);
    const totalDespesas = despesasFixas + despesasEsporadicas;
    return {
      year, month, cycleStartDay,
      cycleStart: start.toISOString(), cycleEnd: end.toISOString(),
      receitas, despesasFixas, despesasEsporadicas, despesasTerceiros,
      totalDespesas, saldo: receitas - totalDespesas, transactionCount: count,
    };
  }

  async generateNextCycle(userId: string, targetMonth: number, targetYear: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Mês base = mês anterior ao alvo
    const baseMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const baseYear = targetMonth === 1 ? targetYear - 1 : targetYear;

    // Verifica se já existem fixas ou parceladas no ciclo alvo (usa cycleDate-aware where)
    const targetCycleWhere = this.buildPeriodWhere(userId, targetYear, targetMonth, user.cycleStartDay);
    const existing = await this.prisma.transaction.count({
      where: {
        AND: [
          targetCycleWhere,
          { type: 'DESPESA' },
          { OR: [{ expenseType: 'FIXO' }, { isInstallment: true }] },
        ],
      },
    });
    if (existing > 0) {
      return { alreadyGenerated: true, nextMonth: targetMonth, nextYear: targetYear };
    }

    // Busca fixas e parceladas do ciclo base (mês anterior ao alvo)
    const baseWhere = this.buildPeriodWhere(userId, baseYear, baseMonth, user.cycleStartDay);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        AND: [
          baseWhere,
          { type: 'DESPESA' },
          { OR: [{ expenseType: 'FIXO' }, { isInstallment: true }] },
        ],
      },
    });

    const skipped: { description: string; reason: string }[] = [];

    const data = transactions
      .filter((t) => {
        if (t.expenseType === 'FIXO') return true;
        if (t.isInstallment && t.installmentInfo) {
          const match = t.installmentInfo.match(/^(\d+)\/(\d+)$/);
          if (!match) {
            skipped.push({ description: t.description, reason: `formato de parcela inválido: "${t.installmentInfo}"` });
            return false;
          }
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          if (current >= total) {
            skipped.push({ description: t.description, reason: `última parcela (${t.installmentInfo})` });
            return false;
          }
          return true;
        }
        return false;
      })
      .map((t) => {
        const replicaDate = new Date(t.date);
        replicaDate.setMonth(replicaDate.getMonth() + 1);
        // cycleDate sempre apontando para o 1º dia do ciclo alvo
        const replicaCycle = new Date(targetYear, targetMonth - 1, 1, 12, 0, 0, 0);

        if (t.expenseType === 'FIXO') {
          return {
            date: replicaDate, cycleDate: replicaCycle, type: 'DESPESA' as const,
            description: t.description, amount: new Prisma.Decimal(t.amount.toString()),
            categoryId: t.categoryId, paymentMethodId: t.paymentMethodId,
            expenseType: 'FIXO' as const, isInstallment: false, isConfirmed: false, userId,
          };
        }

        const match = t.installmentInfo!.match(/^(\d+)\/(\d+)$/)!;
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        return {
          date: replicaDate, cycleDate: replicaCycle, type: 'DESPESA' as const,
          description: t.description, amount: new Prisma.Decimal(t.amount.toString()),
          categoryId: t.categoryId, paymentMethodId: t.paymentMethodId,
          expenseType: t.expenseType, isInstallment: true,
          installmentInfo: `${current + 1}/${total}`, userId,
        };
      });

    if (data.length > 0) {
      await this.prisma.transaction.createMany({ data });
    }

    // Conta fixas+parceladas do ciclo base para validação
    const baseCount = await this.prisma.transaction.count({
      where: {
        AND: [
          baseWhere,
          { type: 'DESPESA' },
          { OR: [{ expenseType: 'FIXO' }, { isInstallment: true }] },
        ],
      },
    });

    return {
      alreadyGenerated: false,
      created: data.length,
      baseCount,
      skipped,
      nextMonth: targetMonth,
      nextYear: targetYear,
    };
  }

  async getCategorySummary(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const where = this.buildPeriodWhere(userId, year, month, user.cycleStartDay, {
      type: 'DESPESA',
      // Despesas com terceiros entram em uma seção própria — separamos para o gráfico.
      NOT: { expenseType: 'TERCEIROS' },
    });

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const ids = grouped.map((g) => g.categoryId).filter((id): id is string => !!id);
    const categories = ids.length
      ? await this.prisma.category.findMany({ where: { id: { in: ids } } })
      : [];
    const byId = new Map(categories.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      categoryId: g.categoryId,
      name: g.categoryId ? byId.get(g.categoryId)?.name ?? 'Sem categoria' : 'Sem categoria',
      color: g.categoryId ? byId.get(g.categoryId)?.color ?? null : null,
      amount: Number(g._sum.amount ?? 0),
      count: g._count._all,
    }));
  }

  async getPendingCount(userId: string) {
    const count = await this.prisma.transaction.count({
      where: { userId, isConfirmed: false },
    });
    return { count };
  }

  /**
   * Projeção do mês alvo (geralmente o próximo) combinando:
   *  1. Compromissos confirmados — transações já lançadas no mês alvo
   *  2. Projeção determinística — fixas e próximas parcelas do mês base que ainda
   *     não foram replicadas (dry-run do generateNextCycle)
   *  3. Estimativa de esporádicas — faixa min..max e média dos últimos 3 meses
   *  4. Receitas recorrentes — replica receitas do mês base ausentes no alvo
   */
  async getForecast(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const baseMonth = month === 1 ? 12 : month - 1;
    const baseYear = month === 1 ? year - 1 : year;

    const targetWhere = this.buildPeriodWhere(userId, year, month, user.cycleStartDay);
    const baseWhere = this.buildPeriodWhere(userId, baseYear, baseMonth, user.cycleStartDay);

    const [existing, baseRecurring, baseReceitas] = await Promise.all([
      this.prisma.transaction.findMany({
        where: targetWhere,
        include: { category: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          AND: [
            baseWhere,
            { type: 'DESPESA' },
            { OR: [{ expenseType: 'FIXO' }, { isInstallment: true }] },
          ],
        },
        include: { category: true },
      }),
      this.prisma.transaction.findMany({
        where: { AND: [baseWhere, { type: 'RECEITA' }] },
      }),
    ]);

    const existingByKey = new Map<string, true>();
    for (const e of existing) {
      // chave dedupe: descrição + (installmentInfo || expenseType) — distingue fixa de parcela
      existingByKey.set(`${e.description}::${e.installmentInfo ?? e.expenseType ?? ''}`, true);
    }

    const projectedDespesas: Array<{
      description: string;
      amount: number;
      categoryId: string | null;
      categoryName: string | null;
      categoryColor: string | null;
      reason: 'FIXO' | 'INSTALLMENT';
      installmentInfo?: string;
    }> = [];

    for (const t of baseRecurring) {
      if (t.expenseType === 'FIXO' && !t.isInstallment) {
        const key = `${t.description}::FIXO`;
        if (existingByKey.has(key)) continue;
        projectedDespesas.push({
          description: t.description,
          amount: Number(t.amount),
          categoryId: t.categoryId,
          categoryName: t.category?.name ?? null,
          categoryColor: t.category?.color ?? null,
          reason: 'FIXO',
        });
      } else if (t.isInstallment && t.installmentInfo) {
        const match = t.installmentInfo.match(/^(\d+)\/(\d+)$/);
        if (!match) continue;
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (current >= total) continue;
        const nextInfo = `${current + 1}/${total}`;
        const key = `${t.description}::${nextInfo}`;
        if (existingByKey.has(key)) continue;
        projectedDespesas.push({
          description: t.description,
          amount: Number(t.amount),
          categoryId: t.categoryId,
          categoryName: t.category?.name ?? null,
          categoryColor: t.category?.color ?? null,
          reason: 'INSTALLMENT',
          installmentInfo: nextInfo,
        });
      }
    }

    const existingReceitasDescriptions = new Set(
      existing.filter((e) => e.type === 'RECEITA').map((e) => e.description),
    );
    const projectedReceitas = baseReceitas
      .filter((r) => !existingReceitasDescriptions.has(r.description))
      .map((r) => ({
        description: r.description,
        amount: Number(r.amount),
        source: r.source,
      }));

    // Histórico das esporádicas — últimas 3 competências fechadas
    const samples: { year: number; month: number; total: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      let m = month - i;
      let y = year;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const w = this.buildPeriodWhere(userId, y, m, user.cycleStartDay, {
        type: 'DESPESA',
        expenseType: 'ESPORADICO',
        isInstallment: false,
      });
      const agg = await this.prisma.transaction.aggregate({ where: w, _sum: { amount: true } });
      samples.push({ year: y, month: m, total: Number(agg._sum.amount ?? 0) });
    }
    const validSamples = samples.filter((s) => s.total > 0).map((s) => s.total);
    const esporadicasMin = validSamples.length ? Math.min(...validSamples) : 0;
    const esporadicasMax = validSamples.length ? Math.max(...validSamples) : 0;
    const esporadicasAvg = validSamples.length
      ? validSamples.reduce((a, b) => a + b, 0) / validSamples.length
      : 0;

    // Totais do mês alvo já existentes
    const sumByPredicate = (predicate: (e: (typeof existing)[number]) => boolean) =>
      existing.filter(predicate).reduce((acc, t) => acc + Number(t.amount), 0);

    const existingReceitasTotal = sumByPredicate((e) => e.type === 'RECEITA');
    const existingFixasTotal = sumByPredicate(
      (e) => e.type === 'DESPESA' && e.expenseType === 'FIXO' && !e.isInstallment,
    );
    const existingInstallmentsTotal = sumByPredicate((e) => e.type === 'DESPESA' && e.isInstallment);
    const existingEsporadicasJaLancadas = sumByPredicate(
      (e) => e.type === 'DESPESA' && e.expenseType === 'ESPORADICO' && !e.isInstallment,
    );

    const projectedFixasTotal = projectedDespesas
      .filter((p) => p.reason === 'FIXO')
      .reduce((a, p) => a + p.amount, 0);
    const projectedInstallmentsTotal = projectedDespesas
      .filter((p) => p.reason === 'INSTALLMENT')
      .reduce((a, p) => a + p.amount, 0);
    const projectedReceitasTotal = projectedReceitas.reduce((a, r) => a + r.amount, 0);

    const receitasCommitted = existingReceitasTotal + projectedReceitasTotal;
    const fixasCommitted = existingFixasTotal + projectedFixasTotal;
    const installmentsCommitted = existingInstallmentsTotal + projectedInstallmentsTotal;
    const committedDespesas = fixasCommitted + installmentsCommitted + existingEsporadicasJaLancadas;

    const saldoExpected = receitasCommitted - committedDespesas - esporadicasAvg;
    const saldoMin = receitasCommitted - committedDespesas - esporadicasMax;
    const saldoMax = receitasCommitted - committedDespesas - esporadicasMin;

    const installmentsCount =
      existing.filter((e) => e.isInstallment).length +
      projectedDespesas.filter((p) => p.reason === 'INSTALLMENT').length;

    return {
      year,
      month,
      baseYear,
      baseMonth,
      receitasCommitted,
      fixasCommitted,
      installmentsCommitted,
      esporadicasJaLancadas: existingEsporadicasJaLancadas,
      committedDespesas,
      esporadicasHistory: {
        min: esporadicasMin,
        max: esporadicasMax,
        avg: esporadicasAvg,
        samples,
      },
      saldoExpected,
      saldoMin,
      saldoMax,
      projectedDespesas,
      projectedReceitas,
      installmentsCount,
      installmentsTotal: installmentsCommitted,
      hasHistory: validSamples.length > 0,
    };
  }
}
