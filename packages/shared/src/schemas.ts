import { z } from 'zod';
import { ExpenseType, TransactionType } from './enums.js';

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  color: z.string().nullable().optional(),
  isSystem: z.boolean(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
});

export const PaymentMethodSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(['PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'SAQUE', 'OUTRO']),
});

export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  type: z.nativeEnum(TransactionType),
  categoryId: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  paymentMethodId: z.string().nullable().optional(),
  expenseType: z.nativeEnum(ExpenseType).nullable().optional(),
  isInstallment: z.boolean(),
  installmentInfo: z.string().nullable().optional(),
});

export const CreateTransactionSchema = z.object({
  date: z.string().datetime(),
  type: z.nativeEnum(TransactionType),
  categoryId: z.string().optional(),
  source: z.string().optional(),
  description: z.string().min(1),
  amount: z.number().positive(),
  paymentMethodId: z.string().optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  isInstallment: z.boolean().default(false),
  installmentInfo: z.string().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export const SummarySchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  cycleStart: z.string(),
  cycleEnd: z.string(),
  receitas: z.number(),
  despesasFixas: z.number(),
  despesasEsporadicas: z.number(),
  despesasTerceiros: z.number(),
  totalDespesas: z.number(),
  saldo: z.number(),
});

export const TransactionFiltersSchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  categoryId: z.string().optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  paymentMethodId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type Category = z.infer<typeof CategorySchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;
