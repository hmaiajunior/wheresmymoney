import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
   * A tabela armazena apenas registros INITIAL e MANUAL_ADJUST. Tudo entre
   * dois pontos de verdade é calculado em memória.
   */
  async getOrCalculate(userId: string, year: number, month: number): Promise<AccountBalanceResult> {
    const hasInitial = (await this.prisma.accountBalance.count({
      where: { userId, source: 'INITIAL' },
    })) > 0;

    const result = await this.resolveBalance(userId, year, month, 0);
    return { ...result, hasInitial };
  }

  /** Lista 12 meses do ano (alimenta a coluna "Em conta" da tabela mensal). */
  async getYearHistory(userId: string, year: number): Promise<AccountBalanceResult[]> {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return Promise.all(months.map((m) => this.getOrCalculate(userId, year, m)));
  }

  async setInitial(userId: string, year: number, month: number, amount: number): Promise<AccountBalanceResult> {
    const existing = await this.prisma.accountBalance.findFirst({
      where: { userId, source: 'INITIAL' },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe um saldo inicial cadastrado. Remova-o antes de cadastrar outro.',
      );
    }
    const referenceDate = this.firstOfMonth(year, month);
    await this.prisma.accountBalance.upsert({
      where: { userId_referenceDate: { userId, referenceDate } },
      create: {
        userId,
        referenceDate,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        source: 'INITIAL',
      },
      // Se já existir um MANUAL_ADJUST/CALCULATED nesse mês, vira INITIAL
      update: {
        amount: new Prisma.Decimal(amount.toFixed(2)),
        source: 'INITIAL',
      },
    });
    return this.getOrCalculate(userId, year, month);
  }

  async setManualAdjust(
    userId: string,
    year: number,
    month: number,
    amount: number,
    note?: string,
  ): Promise<AccountBalanceResult> {
    const referenceDate = this.firstOfMonth(year, month);
    const existing = await this.prisma.accountBalance.findUnique({
      where: { userId_referenceDate: { userId, referenceDate } },
    });
    if (existing?.source === 'INITIAL') {
      throw new BadRequestException(
        'Esse mês é o saldo inicial. Para ajustar, remova o inicial e recadastre.',
      );
    }
    await this.prisma.accountBalance.upsert({
      where: { userId_referenceDate: { userId, referenceDate } },
      create: {
        userId,
        referenceDate,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        source: 'MANUAL_ADJUST',
        note: note ?? null,
      },
      update: {
        amount: new Prisma.Decimal(amount.toFixed(2)),
        source: 'MANUAL_ADJUST',
        note: note ?? null,
      },
    });
    return this.getOrCalculate(userId, year, month);
  }

  async deleteAdjust(userId: string, year: number, month: number): Promise<{ removed: boolean }> {
    const referenceDate = this.firstOfMonth(year, month);
    const existing = await this.prisma.accountBalance.findUnique({
      where: { userId_referenceDate: { userId, referenceDate } },
    });
    if (!existing) {
      throw new NotFoundException('Não existe ajuste para esse mês.');
    }
    if (existing.source !== 'MANUAL_ADJUST') {
      throw new BadRequestException(
        'Só é possível remover ajustes manuais por aqui. Para remover INITIAL, use o endpoint dedicado.',
      );
    }
    await this.prisma.accountBalance.delete({ where: { id: existing.id } });
    return { removed: true };
  }

  async deleteInitial(userId: string): Promise<{ removed: boolean }> {
    const existing = await this.prisma.accountBalance.findFirst({
      where: { userId, source: 'INITIAL' },
    });
    if (!existing) {
      throw new NotFoundException('Não há saldo inicial cadastrado.');
    }
    await this.prisma.accountBalance.delete({ where: { id: existing.id } });
    return { removed: true };
  }

  /**
   * Recursivo: busca INITIAL/MANUAL_ADJUST como ground truth;
   * caso contrário, soma o saldo do mês anterior + saldoCiclo atual.
   */
  private async resolveBalance(
    userId: string,
    year: number,
    month: number,
    depth: number,
  ): Promise<Omit<AccountBalanceResult, 'hasInitial'>> {
    const referenceDate = this.firstOfMonth(year, month);

    const existing = await this.prisma.accountBalance.findUnique({
      where: { userId_referenceDate: { userId, referenceDate } },
    });

    const cycleSummary = await this.summaryService.getSummary(userId, year, month);
    const saldoCicloAtual = cycleSummary.saldo;

    if (existing && existing.source === 'INITIAL') {
      // INITIAL: o próprio mês é o ponto de partida (não soma com mês anterior).
      const saldoEmConta = Number(existing.amount);
      return {
        year, month, saldoCicloAtual,
        saldoAnterior: null,
        saldoCalculado: saldoEmConta, // por convenção, INITIAL define o ponto
        saldoEmConta,
        source: 'INITIAL',
        divergence: null,
        note: existing.note,
        incomplete: false,
      };
    }

    const prev = await this.peekPreviousBalance(userId, year, month, depth);
    const saldoAnterior = prev?.saldoEmConta ?? 0;
    const incomplete = prev ? prev.incomplete : true;
    const saldoCalculado = saldoAnterior + saldoCicloAtual;

    if (existing && existing.source === 'MANUAL_ADJUST') {
      const saldoEmConta = Number(existing.amount);
      return {
        year, month, saldoCicloAtual,
        saldoAnterior: prev?.saldoEmConta ?? null,
        saldoCalculado,
        saldoEmConta,
        source: 'MANUAL_ADJUST',
        divergence: saldoEmConta - saldoCalculado,
        note: existing.note,
        incomplete,
      };
    }

    return {
      year, month, saldoCicloAtual,
      saldoAnterior: prev?.saldoEmConta ?? null,
      saldoCalculado,
      saldoEmConta: saldoCalculado,
      source: 'CALCULATED',
      divergence: null,
      note: null,
      incomplete,
    };
  }

  private async peekPreviousBalance(
    userId: string,
    year: number,
    month: number,
    depth: number,
  ): Promise<{ saldoEmConta: number; incomplete: boolean } | null> {
    if (depth >= MAX_RECURSION_MONTHS) return null;

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const resolved = await this.resolveBalance(userId, prevYear, prevMonth, depth + 1);
    return { saldoEmConta: resolved.saldoEmConta, incomplete: resolved.incomplete };
  }

  private firstOfMonth(year: number, month: number): Date {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  }
}
