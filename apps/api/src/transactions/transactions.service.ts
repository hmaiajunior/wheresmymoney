import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType, ExpenseType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionDto {
  date: string;
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
  expenseType?: ExpenseType;
  paymentMethodId?: string;
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
    const { type, categoryId, expenseType, paymentMethodId, from, to, search, page = 1, limit = 50 } = filters;

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (expenseType) where.expenseType = expenseType;
    if (paymentMethodId) where.paymentMethodId = paymentMethodId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: true, paymentMethod: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string) {
    const t = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true, paymentMethod: true },
    });
    if (!t) throw new NotFoundException('Lançamento não encontrado');
    return t;
  }

  create(userId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        ...dto,
        date: new Date(dto.date),
        amount: new Prisma.Decimal(dto.amount),
        userId,
      },
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
}
