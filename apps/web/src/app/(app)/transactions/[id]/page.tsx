'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Category { id: string; name: string }
interface PaymentMethod { id: string; name: string }
interface Transaction {
  id: string; date: string; type: string; description: string; amount: string;
  categoryId?: string; source?: string; paymentMethodId?: string; expenseType?: string;
  isInstallment: boolean; installmentInfo?: string;
}

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function EditTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState('');

  const { data: transaction } = useQuery<Transaction>({
    queryKey: ['transaction', id],
    queryFn: () => api.get(`/transactions/${id}`).then((r) => r.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: () => api.get('/payment-methods').then((r) => r.data),
  });

  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type,
        date: transaction.date.slice(0, 10),
        description: transaction.description,
        amount: transaction.amount,
        categoryId: transaction.categoryId ?? '',
        source: transaction.source ?? '',
        paymentMethodId: transaction.paymentMethodId ?? '',
        expenseType: transaction.expenseType ?? 'ESPORADICO',
        isInstallment: transaction.isInstallment,
        installmentInfo: transaction.installmentInfo ?? '',
      });
    }
  }, [transaction]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string | boolean>) =>
      api.patch(`/transactions/${id}`, {
        ...data,
        date: new Date(String(data.date) + 'T12:00:00').toISOString(),
        amount: parseFloat(String(data.amount).replace(',', '.')),
        categoryId: data.categoryId || undefined,
        paymentMethodId: data.paymentMethodId || undefined,
        source: data.source || undefined,
        expenseType: data.type === 'DESPESA' ? data.expenseType : undefined,
        installmentInfo: data.isInstallment ? data.installmentInfo : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      router.back();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erro ao atualizar lançamento.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      router.back();
    },
  });

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (!transaction || !Object.keys(form).length) {
    return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Editar Lançamento</h2>

      <form
        onSubmit={(e) => { e.preventDefault(); setError(''); updateMutation.mutate(form); }}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data">
            <input type="date" value={String(form.date)} onChange={(e) => set('date', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Valor (R$)">
            <input type="text" inputMode="decimal" value={String(form.amount)} onChange={(e) => set('amount', e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Descrição">
          <input type="text" value={String(form.description)} onChange={(e) => set('description', e.target.value)} required className={inputClass} />
        </Field>

        {form.type === 'DESPESA' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Categoria">
                <select value={String(form.categoryId)} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
                  <option value="">Sem categoria</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Tipo de Despesa">
                <select value={String(form.expenseType)} onChange={(e) => set('expenseType', e.target.value)} className={inputClass}>
                  <option value="FIXO">Fixo</option>
                  <option value="ESPORADICO">Esporádico</option>
                  <option value="TERCEIROS">Terceiros</option>
                </select>
              </Field>
            </div>
            <Field label="Forma de Pagamento">
              <select value={String(form.paymentMethodId)} onChange={(e) => set('paymentMethodId', e.target.value)} className={inputClass}>
                <option value="">Selecionar...</option>
                {paymentMethods?.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
              </select>
            </Field>
            <div className="flex items-center gap-3">
              <input id="installment" type="checkbox" checked={Boolean(form.isInstallment)} onChange={(e) => set('isInstallment', e.target.checked)} className="w-4 h-4" />
              <label htmlFor="installment" className="text-sm text-slate-700">Compra parcelada?</label>
            </div>
            {form.isInstallment && (
              <Field label="Parcela (ex: 3/12)">
                <input type="text" value={String(form.installmentInfo)} onChange={(e) => set('installmentInfo', e.target.value)} placeholder="ex: 3/12" className={inputClass} />
              </Field>
            )}
          </>
        ) : (
          <Field label="Fonte">
            <input type="text" value={String(form.source)} onChange={(e) => set('source', e.target.value)} placeholder="ex: Salário, Aluguel..." className={inputClass} />
          </Field>
        )}

        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => { if (confirm('Remover este lançamento?')) deleteMutation.mutate(); }}
            className="py-2.5 px-4 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            🗑️ Remover
          </button>
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={updateMutation.isPending} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
