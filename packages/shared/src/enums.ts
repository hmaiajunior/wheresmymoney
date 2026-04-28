export enum TransactionType {
  RECEITA = 'RECEITA',
  DESPESA = 'DESPESA',
}

export enum ExpenseType {
  FIXO = 'FIXO',
  ESPORADICO = 'ESPORADICO',
  TERCEIROS = 'TERCEIROS',
}

export const SYSTEM_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Contribuições',
  'Educação',
  'Transporte',
  'Refeição',
  'PBK',
  'Terceiros',
  'Assinaturas',
  'Empréstimos',
  'Serviços',
  'Amazon',
  'Pessoal',
  'Pet',
  'Farmácia',
  'Estudos',
  'Europa-2026',
  'Viagem-Jijoca',
  'Impostos',
] as const;

export const INCOME_SOURCES = [
  'Salário',
  'Férias',
  'PLR',
  'Aluguel',
  'Loja Janaina',
  'Resgate investimento',
  'Confecção Janaína',
  'Cashback',
  'Outros',
] as const;

export const PAYMENT_METHODS = [
  { name: 'PIX', type: 'PIX' },
  { name: 'Débito', type: 'DEBITO' },
  { name: 'Crédito - Itaú', type: 'CREDITO' },
  { name: 'Crédito - Nu', type: 'CREDITO' },
  { name: 'Crédito - Janaína', type: 'CREDITO' },
  { name: 'Boleto', type: 'BOLETO' },
  { name: 'Boleto - Inter', type: 'BOLETO' },
  { name: 'Boleto - Itaú', type: 'BOLETO' },
  { name: 'PIX - Inter', type: 'PIX' },
  { name: 'PIX - Itaú', type: 'PIX' },
  { name: 'PIX - Queline', type: 'PIX' },
  { name: 'Saque - Itaú', type: 'SAQUE' },
  { name: 'Conversão de moeda', type: 'OUTRO' },
] as const;
