'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, EXPENSE_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/format';

interface Transaction {
  id: string;
  date: string;
  type: 'RECEITA' | 'DESPESA';
  description: string;
  amount: string;
  expenseType?: string;
  isInstallment: boolean;
  installmentInfo?: string;
  category?: { name: string; color?: string };
  paymentMethod?: { name: string };
}

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  totalAmount: number;
  page: number;
  pages: number;
}

interface Category { id: string; name: string }
interface PaymentMethod { id: string; name: string }

const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function TransactionsPage() {
  const [filters, setFilters] = useState({
    type: '',
    expenseType: '',
    categoryId: '',
    paymentMethodId: '',
    month: '',
    year: String(currentYear),
    search: '',
    page: 1,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: () => api.get('/payment-methods').then((r) => r.data),
  });

  // Params base (sem categoryId/paymentMethodId) para filter-options
  const baseParams = new URLSearchParams();
  if (filters.type) baseParams.set('type', filters.type);
  if (filters.expenseType) baseParams.set('expenseType', filters.expenseType);
  if (filters.search) baseParams.set('search', filters.search);
  if (filters.month && filters.year) {
    baseParams.set('from', `${filters.year}-${filters.month}-01`);
    const lastDay = new Date(Number(filters.year), Number(filters.month), 0).getDate();
    baseParams.set('to', `${filters.year}-${filters.month}-${lastDay}`);
  } else if (filters.year) {
    baseParams.set('from', `${filters.year}-01-01`);
    baseParams.set('to', `${filters.year}-12-31`);
  }

  const hasContextFilters = !!(filters.type || filters.expenseType || filters.month || filters.search);

  const { data: filterOptions } = useQuery<{ categories: Category[]; paymentMethods: PaymentMethod[] }>({
    queryKey: ['filter-options', filters.type, filters.expenseType, filters.month, filters.year, filters.search],
    queryFn: () => api.get(`/transactions/filter-options?${baseParams}`).then((r) => r.data),
    enabled: hasContextFilters,
  });

  const availableCategories = hasContextFilters ? (filterOptions?.categories ?? []) : (categories ?? []);
  const availablePaymentMethods = hasContextFilters ? (filterOptions?.paymentMethods ?? []) : (paymentMethods ?? []);

  // Limpa seleção se o item não está mais disponível
  if (filters.categoryId && availableCategories.length > 0 && !availableCategories.find((c) => c.id === filters.categoryId)) {
    setFilters((f) => ({ ...f, categoryId: '', page: 1 }));
  }
  if (filters.paymentMethodId && availablePaymentMethods.length > 0 && !availablePaymentMethods.find((p) => p.id === filters.paymentMethodId)) {
    setFilters((f) => ({ ...f, paymentMethodId: '', page: 1 }));
  }

  const queryParams = new URLSearchParams(baseParams);
  if (filters.categoryId) queryParams.set('categoryId', filters.categoryId);
  if (filters.paymentMethodId) queryParams.set('paymentMethodId', filters.paymentMethodId);
  queryParams.set('page', String(filters.page));
  queryParams.set('limit', '50');

  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ['transactions', filters],
    queryFn: () => api.get(`/transactions?${queryParams}`).then((r) => r.data),
  });

  const set = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const hasActiveFilters =
    filters.type || filters.expenseType || filters.categoryId ||
    filters.paymentMethodId || filters.month || filters.search;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Lançamentos</h2>
        <Link
          href="/transactions/new"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          + Novo Lançamento
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        {/* Linha 1: busca + tipo + subtipo */}
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar descrição..."
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            value={filters.type}
            onChange={(e) => set('type', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos os tipos</option>
            <option value="RECEITA">Receita</option>
            <option value="DESPESA">Despesa</option>
          </select>
          <select
            value={filters.expenseType}
            onChange={(e) => set('expenseType', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos os subtipos</option>
            <option value="FIXO">Fixo</option>
            <option value="ESPORADICO">Esporádico</option>
            <option value="TERCEIROS">Terceiros</option>
          </select>
        </div>

        {/* Linha 2: mês + ano + categoria + pagamento */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={filters.month}
            onChange={(e) => set('month', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos os meses</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={filters.year}
            onChange={(e) => set('year', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={filters.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex-1 min-w-36"
          >
            <option value="">Todas as categorias</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filters.paymentMethodId}
            onChange={(e) => set('paymentMethodId', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 flex-1 min-w-36"
          >
            <option value="">Todas as formas de pagamento</option>
            {availablePaymentMethods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <button
            onClick={() => setFilters({ type: '', expenseType: '', categoryId: '', paymentMethodId: '', month: '', year: String(currentYear), search: '', page: 1 })}
            className="text-xs text-slate-500 hover:text-red-600 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Totalizador */}
        {data && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              {data.total} {data.total === 1 ? 'lançamento' : 'lançamentos'} encontrados
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Total:</span>
              <span className={`text-sm font-bold ${
                filters.type === 'RECEITA' ? 'text-green-700' :
                filters.type === 'DESPESA' ? 'text-red-700' : 'text-slate-800'
              }`}>
                {filters.type === 'DESPESA' ? '−' : filters.type === 'RECEITA' ? '+' : ''}
                {formatCurrency(data.totalAmount)}
              </span>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : !data?.data.length ? (
          <div className="p-8 text-center text-slate-400">Nenhum lançamento encontrado.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="text-left px-4 py-3 font-medium">Data</th>
                    <th className="text-left px-4 py-3 font-medium">Descrição</th>
                    <th className="text-left px-4 py-3 font-medium">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium">Pagamento</th>
                    <th className="text-right px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 max-w-xs">
                        <span className="block truncate">{t.description}</span>
                        {t.isInstallment && t.installmentInfo && (
                          <span className="text-xs text-slate-400">Parcela {t.installmentInfo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.category ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: t.category.color ?? '#6b7280' }}
                          >
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${t.type === 'RECEITA' ? 'text-green-700' : 'text-slate-600'}`}>
                          {TRANSACTION_TYPE_LABELS[t.type]}
                          {t.expenseType && (
                            <span className="text-slate-400 ml-1">· {EXPENSE_TYPE_LABELS[t.expenseType]}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {t.paymentMethod?.name ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.type === 'RECEITA' ? 'text-green-700' : 'text-red-700'}`}>
                        {t.type === 'DESPESA' ? '−' : '+'}
                        {formatCurrency(Number(t.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/transactions/${t.id}`} className="text-slate-400 hover:text-slate-700 text-xs">
                          ✏️
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {data.total} lançamentos · página {data.page} de {data.pages}
              </span>
              {data.pages > 1 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                    disabled={filters.page === 1}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-30 hover:bg-slate-100"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                    disabled={filters.page >= data.pages}
                    className="px-3 py-1 text-xs border rounded disabled:opacity-30 hover:bg-slate-100"
                  >
                    Próxima →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
