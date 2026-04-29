import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType, ExpenseType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionDto {
  date: string;
  cycleDate?: string; // mês de referência do ciclo (ex: "2026-04-01")
  type: TransactionType;
  categoryId?: string;
  source?: string;
  description: string;
  amount: number;
  paymentMethodId?: string;
  expenseType?: ExpenseType;
  isInstallment?: boolean;
  installmentInfo?: string;
}

export interface TransactionFiltersDto {
  type?: TransactionType;
  categoryId?: string;
  categoryIds?: string | string[];
  expenseType?: ExpenseType;
  expenseTypes?: string | string[]; // múltiplos subtipos
  paymentMethodId?: string;
  isInstallment?: string; // 'true' | 'false' (query param é string)
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, filters: TransactionFiltersDto = {}) {
    const { type, categoryId, categoryIds, expenseType, expenseTypes, paymentMethodId, isInstallment, from, to, search, page = 1, limit = 50 } = filters;

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type;
    if (categoryIds) {
      const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
      if (ids.length > 0) where.categoryId = { in: ids };
    } else if (categoryId) {
      where.categoryId = categoryId;
    }
    // expenseTypes tem prioridade sobre expenseType (legado)
    if (expenseTypes) {
      const types = (Array.isArray(expenseTypes) ? expenseTypes : [expenseTypes]) as ExpenseType[];
      if (types.length === 1) where.expenseType = types[0];
      else if (types.length > 1) where.expenseType = { in: types };
    } else if (expenseType) {
      where.expenseType = expenseType;
    }
    if (paymentMethodId) where.paymentMethodId = paymentMethodId;
    if (isInstallment !== undefined && isInstallment !== '') where.isInstallment = isInstallment === 'true';
    if (from || to) {
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      const dateRange: Prisma.DateTimeFilter = {};
      if (fromDate) dateRange.gte = fromDate;
      if (toDate) dateRange.lte = toDate;

      // Considera tanto cycleDate (importados) quanto date (manuais sem cycleDate)
      const existingConditions = where.AND
        ? (Array.isArray(where.AND) ? where.AND : [where.AND])
        : [];
      where.AND = [
        ...existingConditions,
        {
          OR: [
            { cycleDate: dateRange },
            { cycleDate: null, date: dateRange },
          ],
        },
      ];
    }
    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    const [data, total, aggReceitas, aggDespesas] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: true, paymentMethod: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.aggregate({ where: { ...where, type: 'RECEITA' }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { ...where, type: 'DESPESA' }, _sum: { amount: true } }),
    ]);

    return {
      data, total, page, limit, pages: Math.ceil(total / limit),
      totalReceitas: Number(aggReceitas._sum.amount ?? 0),
      totalDespesas: Number(aggDespesas._sum.amount ?? 0),
    };
  }

  async findOne(id: string, userId: string) {
    const t = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true, paymentMethod: true },
    });
    if (!t) throw new NotFoundException('Lançamento não encontrado');
    return t;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const { ...data } = dto as CreateTransactionDto & { installmentCurrent?: unknown; installmentTotal?: unknown };
    delete (data as Record<string, unknown>).installmentCurrent;
    delete (data as Record<string, unknown>).installmentTotal;

    const origin = await this.prisma.transaction.create({
      data: {
        ...data,
        date: new Date(dto.date),
        cycleDate: dto.cycleDate ? new Date(dto.cycleDate) : undefined,
        amount: new Prisma.Decimal(dto.amount),
        userId,
      },
      include: { category: true, paymentMethod: true },
    });

    const replicas: Prisma.TransactionCreateManyInput[] = [];
    const originDate = new Date(dto.date);

    if (dto.type === 'DESPESA' && dto.expenseType === 'FIXO') {
      // Replica até dezembro do mesmo ano com o mesmo valor e isConfirmed=false
      const endMonth = 12;
      for (let m = originDate.getMonth() + 2; m <= endMonth; m++) {
        const replicaDate = new Date(originDate);
        replicaDate.setMonth(m - 1);
        replicas.push({
          date: replicaDate,
          type: dto.type,
          description: dto.description,
          amount: new Prisma.Decimal(dto.amount),
          categoryId: dto.categoryId ?? null,
          paymentMethodId: dto.paymentMethodId ?? null,
          expenseType: dto.expenseType,
          isInstallment: false,
          isConfirmed: false,
          userId,
        });
      }
    } else if (dto.isInstallment && dto.installmentInfo) {
      // Formato esperado: "1/12" — parcela atual / total
      const match = dto.installmentInfo.match(/^(\d+)\/(\d+)$/);
      if (match) {
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        for (let i = 1; i < total - current + 1; i++) {
          const replicaDate = new Date(originDate);
          replicaDate.setMonth(originDate.getMonth() + i);
          replicas.push({
            date: replicaDate,
            type: dto.type,
            description: dto.description,
            amount: new Prisma.Decimal(dto.amount),
            categoryId: dto.categoryId ?? null,
            paymentMethodId: dto.paymentMethodId ?? null,
            expenseType: dto.expenseType ?? null,
            isInstallment: true,
            installmentInfo: `${current + i}/${total}`,
            userId,
          });
        }
      }
    }

    if (replicas.length > 0) {
      await this.prisma.transaction.createMany({ data: replicas });
    }

    return origin;
  }

  async confirm(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.transaction.update({
      where: { id },
      data: { isConfirmed: true },
      include: { category: true, paymentMethod: true },
    });
  }

  async update(id: string, userId: string, dto: Partial<CreateTransactionDto>) {
    await this.findOne(id, userId);
    const data: Prisma.TransactionUpdateInput = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    return this.prisma.transaction.update({
      where: { id },
      data,
      include: { category: true, paymentMethod: true },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.transaction.delete({ where: { id } });
  }

  async findFilterOptions(userId: string, filters: Omit<TransactionFiltersDto, 'categoryId' | 'paymentMethodId' | 'page' | 'limit'>) {
    const { type, expenseType, from, to, search } = filters;

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type;
    if (expenseType) where.expenseType = expenseType;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (search) where.description = { contains: search, mode: 'insensitive' };

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        category: { select: { id: true, name: true, color: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
    });

    const categoriesMap = new Map<string, { id: string; name: string; color?: string | null }>();
    const paymentMethodsMap = new Map<string, { id: string; name: string }>();

    for (const t of transactions) {
      if (t.category) categoriesMap.set(t.category.id, t.category);
      if (t.paymentMethod) paymentMethodsMap.set(t.paymentMethod.id, t.paymentMethod);
    }

    return {
      categories: [...categoriesMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      paymentMethods: [...paymentMethodsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
