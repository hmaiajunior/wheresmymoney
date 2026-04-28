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
   * Prioridade:
   *  1. Transações com cycleDate preenchido: agrupa pelo mês/ano de cycleDate
   *  2. Transações sem cycleDate: usa intervalo de datas calculado por cycleStartDay
   */
  private buildPeriodWhere(
    userId: string,
    year: number,
    month: number,
    cycleStartDay: number,
    extra: Prisma.TransactionWhereInput = {},
  ): Prisma.TransactionWhereInput {
    const { start, end } = this.getCycleBounds(year, month, cycleStartDay);

    // Início e fim do mês calendário para match do cycleDate (sempre 1º do mês)
    const cycleMonthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const cycleMonthEnd = new Date(year, month, 0, 23, 59, 59, 999); // último dia do mês

    return {
      userId,
      OR: [
        // Transações importadas da planilha (cycleDate preenchido)
        { cycleDate: { gte: cycleMonthStart, lte: cycleMonthEnd }, ...extra },
        // Transações lançadas manualmente (cycleDate nulo)
        { cycleDate: null, date: { gte: start, lte: end }, ...extra },
      ],
    };
  }

  async getSummary(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { start, end } = this.getCycleBounds(year, month, user.cycleStartDay);

    const where = (extra: Prisma.TransactionWhereInput) =>
      this.buildPeriodWhere(userId, year, month, user.cycleStartDay, extra);

    const [receitasResult, despesasFixasResult, despesasEsporadicasResult, despesasTerceirosResult] =
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
      ]);

    const receitas = Number(receitasResult._sum.amount ?? 0);
    const despesasFixas = Number(despesasFixasResult._sum.amount ?? 0);
    const despesasEsporadicas = Number(despesasEsporadicasResult._sum.amount ?? 0);
    const despesasTerceiros = Number(despesasTerceirosResult._sum.amount ?? 0);
    const totalDespesas = despesasFixas + despesasEsporadicas;
    const saldo = receitas - totalDespesas;

    return {
      year,
      month,
      cycleStartDay: user.cycleStartDay,
      cycleStart: start.toISOString(),
      cycleEnd: end.toISOString(),
      receitas,
      despesasFixas,
      despesasEsporadicas,
      despesasTerceiros,
      totalDespesas,
      saldo,
    };
  }

  async getYearlySummary(userId: string, year: number) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return Promise.all(months.map((m) => this.getSummary(userId, year, m)));
  }

  async generateNextCycle(userId: string, targetMonth: number, targetYear: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Mês base = mês anterior ao alvo
    const baseMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const baseYear = targetMonth === 1 ? targetYear - 1 : targetYear;

    // Verifica se já existem fixas ou parceladas no ciclo alvo
    const { start: nextStart, end: nextEnd } = this.getCycleBounds(targetYear, targetMonth, user.cycleStartDay);
    const existing = await this.prisma.transaction.count({
      where: {
        userId, type: 'DESPESA',
        date: { gte: nextStart, lte: nextEnd },
        OR: [{ expenseType: 'FIXO' }, { isInstallment: true }],
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

    const data = transactions
      .filter((t) => {
        if (t.expenseType === 'FIXO') return true;
        if (t.isInstallment && t.installmentInfo) {
          const match = t.installmentInfo.match(/^(\d+)\/(\d+)$/);
          return match && parseInt(match[1]) < parseInt(match[2]);
        }
        return false;
      })
      .map((t) => {
        const replicaDate = new Date(t.date);
        replicaDate.setMonth(replicaDate.getMonth() + 1);

        if (t.expenseType === 'FIXO') {
          return {
            date: replicaDate, type: 'DESPESA' as const, description: t.description,
            amount: new Prisma.Decimal(0), categoryId: t.categoryId,
            paymentMethodId: t.paymentMethodId, expenseType: 'FIXO' as const,
            isInstallment: false, userId,
          };
        }

        const match = t.installmentInfo!.match(/^(\d+)\/(\d+)$/)!;
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        return {
          date: replicaDate, type: 'DESPESA' as const, description: t.description,
          amount: new Prisma.Decimal(t.amount.toString()), categoryId: t.categoryId,
          paymentMethodId: t.paymentMethodId, expenseType: t.expenseType,
          isInstallment: true, installmentInfo: `${current + 1}/${total}`, userId,
        };
      });

    if (data.length > 0) {
      await this.prisma.transaction.createMany({ data });
    }

    return { alreadyGenerated: false, created: data.length, nextMonth: targetMonth, nextYear: targetYear };
  }

  async getCategorySummary(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const where = this.buildPeriodWhere(userId, year, month, user.cycleStartDay, {
      type: 'DESPESA',
    });

    return this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
  }
}
