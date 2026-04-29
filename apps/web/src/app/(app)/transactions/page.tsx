'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  isConfirmed: boolean;
  category?: { name: string; color?: string };
  paymentMethod?: { name: string };
}

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  totalReceitas: number;
  totalDespesas: number;
  page: number;
  pages: number;
}

interface Category { id: string; name: string; color?: string | null }
interface PaymentMethod { id: string; name: string }

const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];

const EXPENSE_TYPES = [
  { value: 'FIXO', label: 'Fixo' },
  { value: 'ESPORADICO', label: 'Esporádico' },
  { value: 'TERCEIROS', label: 'Terceiros' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'RECEITA', label: 'Receita' },
  { value: 'DESPESA', label: 'Despesa' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = {
    type: searchParams.get('type') ?? '',
    expenseTypes: searchParams.getAll('expenseTypes'),
    categoryIds: searchParams.getAll('categoryIds'),
    paymentMethodId: searchParams.get('paymentMethodId') ?? '',
    isInstallment: searchParams.get('isInstallment') ?? '',
    onlyPending: searchParams.get('onlyPending') === '1',
    month: searchParams.get('month') ?? '',
    year: searchParams.get('year') ?? String(currentYear),
    search: searchParams.get('search') ?? '',
    page: Number(searchParams.get('page') ?? 1),
  };

  const setFilters = (updater: typeof filters | ((prev: typeof filters) => typeof filters)) => {
    const next = typeof updater === 'function' ? updater(filters) : updater;
    const params = new URLSearchParams();
    if (next.type) params.set('type', next.type);
    next.expenseTypes.forEach((et) => params.append('expenseTypes', et));
    next.categoryIds.forEach((id) => params.append('categoryIds', id));
    if (next.paymentMethodId) params.set('paymentMethodId', next.paymentMethodId);
    if (next.isInstallment) params.set('isInstallment', next.isInstallment);
    if (next.onlyPending) params.set('onlyPending', '1');
    if (next.month) params.set('month', next.month);
    if (next.year && next.year !== String(currentYear)) params.set('year', next.year);
    if (next.search) params.set('search', next.search);
    if (next.page > 1) params.set('page', String(next.page));
    router.replace(`/transactions${params.toString() ? `?${params}` : ''}`);
  };

  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/transactions/${id}/confirm`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const { data: allCategories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: allPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: () => api.get('/payment-methods').then((r) => r.data),
  });

  const baseParams = new URLSearchParams();
  if (filters.type) baseParams.set('type', filters.type);
  filters.expenseTypes.forEach((et) => baseParams.append('expenseTypes', et));
  if (filters.search) baseParams.set('search', filters.search);
  if (filters.month && filters.year) {
    baseParams.set('from', `${filters.year}-${filters.month}-01`);
    const lastDay = new Date(Number(filters.year), Number(filters.month), 0).getDate();
    baseParams.set('to', `${filters.year}-${filters.month}-${lastDay}`);
  } else if (filters.year) {
    baseParams.set('from', `${filters.year}-01-01`);
    baseParams.set('to', `${filters.year}-12-31`);
  }

  const hasContextFilters = !!(filters.type || filters.expenseTypes.length || filters.month || filters.search);

  const { data: filterOptions } = useQuery<{ categories: Category[]; paymentMethods: PaymentMethod[] }>({
    queryKey: ['filter-options', filters.type, filters.expenseTypes, filters.month, filters.year, filters.search],
    queryFn: () => api.get(`/transactions/filter-options?${baseParams}`).then((r) => r.data),
    enabled: hasContextFilters,
  });

  const availableCategories = hasContextFilters ? (filterOptions?.categories ?? []) : (allCategories ?? []);
  const availablePaymentMethods = hasContextFilters ? (filterOptions?.paymentMethods ?? []) : (allPaymentMethods ?? []);

  const queryParams = new URLSearchParams(baseParams);
  filters.categoryIds.forEach((id) => queryParams.append('categoryIds', id));
  if (filters.paymentMethodId) queryParams.set('paymentMethodId', filters.paymentMethodId);
  if (filters.isInstallment) queryParams.set('isInstallment', filters.isInstallment);
  queryParams.set('page', String(filters.page));
  queryParams.set('limit', '50');

  const { data: rawData, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ['transactions', filters],
    queryFn: () => api.get(`/transactions?${queryParams}`).then((r) => r.data),
  });

  // Filtragem cliente-side de pendentes (mantém totais consistentes com filtros do servidor)
  const data = rawData && filters.onlyPending
    ? { ...rawData, data: rawData.data.filter((t) => !t.isConfirmed) }
    : rawData;

  const set = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const toggleExpenseType = (et: string) =>
    setFilters((f) => ({
      ...f, page: 1,
      expenseTypes: f.expenseTypes.includes(et)
        ? f.expenseTypes.filter((e) => e !== et)
        : [...f.expenseTypes, et],
    }));

  const toggleCategory = (id: string) =>
    setFilters((f) => ({
      ...f, page: 1,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));

  const hasActiveFilters =
    filters.type || filters.expenseTypes.length > 0 || filters.categoryIds.length > 0 ||
    filters.paymentMethodId || filters.isInstallment || filters.onlyPending || filters.month || filters.search;

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
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Linha 1: busca + período + pagamento */}
        <div className="flex gap-3 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar descrição..."
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <select
            value={filters.month}
            onChange={(e) => set('month', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos os meses</option>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select
            value={filters.year}
            onChange={(e) => set('year', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={filters.paymentMethodId}
            onChange={(e) => set('paymentMethodId', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todas as formas de pagamento</option>
            {availablePaymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Linha 2: tipo + subtipos (multi-select) + parceladas */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Tipo:</span>
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set('type', opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filters.type === opt.value
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'border-slate-300 text-slate-600 hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Subtipo:</span>
            {EXPENSE_TYPES.map((et) => (
              <button
                key={et.value}
                onClick={() => toggleExpenseType(et.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filters.expenseTypes.includes(et.value)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-300 text-slate-600 hover:border-slate-500'
                }`}
              >
                {et.label}
              </button>
            ))}
            <button
              onClick={() => set('isInstallment', filters.isInstallment === 'true' ? '' : 'true')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.isInstallment === 'true'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'border-slate-300 text-slate-600 hover:border-slate-500'
              }`}
            >
              Parceladas
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, onlyPending: !f.onlyPending, page: 1 }))}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.onlyPending
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-slate-300 text-slate-600 hover:border-slate-500'
              }`}
            >
              ⚠ Pendentes
            </button>
          </div>
        </div>

        {/* Linha 3: categorias */}
        {availableCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 font-medium">Categoria:</span>
            {availableCategories.map((c) => {
              const selected = filters.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all border"
                  style={
                    selected
                      ? { backgroundColor: c.color ?? '#6b7280', color: '#fff', borderColor: c.color ?? '#6b7280' }
                      : { backgroundColor: 'transparent', color: c.color ?? '#6b7280', borderColor: c.color ?? '#6b7280' }
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => setFilters({ type: '', expenseTypes: [], categoryIds: [], paymentMethodId: '', isInstallment: '', onlyPending: false, month: '', year: String(currentYear), search: '', page: 1 })}
            className="text-xs text-slate-500 hover:text-red-600 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {data && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              {data.total} {data.total === 1 ? 'lançamento' : 'lançamentos'} encontrados
            </span>
            <div className="flex items-center gap-4">
              {filters.type === 'RECEITA' ? (
                <span className="text-sm font-bold text-green-700">+{formatCurrency(data.totalReceitas)}</span>
              ) : filters.type === 'DESPESA' ? (
                <span className="text-sm font-bold text-red-700">−{formatCurrency(data.totalDespesas)}</span>
              ) : !hasActiveFilters ? (
                <span className="text-sm font-bold text-slate-400">{formatCurrency(0)}</span>
              ) : (
                <>
                  <span className="text-xs text-slate-500">Rec: <span className="font-bold text-green-700">+{formatCurrency(data.totalReceitas)}</span></span>
                  <span className="text-xs text-slate-500">Desp: <span className="font-bold text-red-700">−{formatCurrency(data.totalDespesas)}</span></span>
                </>
              )}
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
                    <tr key={t.id} className={`transition-colors ${!t.isConfirmed ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 text-slate-800 max-w-xs">
                        <span className="block truncate">{t.description}</span>
                        {t.isInstallment && t.installmentInfo && (
                          <span className="text-xs text-slate-400">Parcela {t.installmentInfo}</span>
                        )}
                        {!t.isConfirmed && (
                          <span className="text-xs text-amber-600 font-medium">⚠ valor pendente de validação</span>
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
                      <td className="px-4 py-3 text-xs text-slate-500">{t.paymentMethod?.name ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.type === 'RECEITA' ? 'text-green-700' : 'text-red-700'}`}>
                        {t.type === 'DESPESA' ? '−' : '+'}{formatCurrency(Number(t.amount))}
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2 justify-end">
                        {!t.isConfirmed && (
                          <button
                            onClick={() => confirmMutation.mutate(t.id)}
                            disabled={confirmMutation.isPending}
                            title="Confirmar valor"
                            className="text-xs text-amber-600 hover:text-green-700 font-medium disabled:opacity-50"
                          >
                            ✓
                          </button>
                        )}
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
