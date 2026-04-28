export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  FIXO: 'Fixo',
  ESPORADICO: 'Esporádico',
  TERCEIROS: 'Terceiros',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
};
