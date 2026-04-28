'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Category { id: string; name: string; color?: string }
interface PaymentMethod { id: string; name: string; type: string }

const today = new Date().toISOString().slice(0, 10);

export default function NewTransactionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    type: 'DESPESA',
    date: today,
    description: '',
    amount: '',
    categoryId: '',
    source: '',
    paymentMethodId: '',
    expenseType: 'ESPORADICO',
    isInstallment: false,
    installmentInfo: '',
  });
  const [error, setError] = useState('');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: () => api.get('/payment-methods').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/transactions', {
        ...data,
        date: new Date(data.date + 'T12:00:00').toISOString(),
        amount: parseFloat(data.amount.replace(',', '.')),
        categoryId: data.categoryId || undefined,
        paymentMethodId: data.paymentMethodId || undefined,
        source: data.source || undefined,
        expenseType: data.type === 'DESPESA' ? data.expenseType : undefined,
        installmentInfo: data.isInstallment ? data.installmentInfo : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      router.push('/transactions');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erro ao salvar lançamento.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.amount || isNaN(parseFloat(form.amount.replace(',', '.')))) {
      setError('Valor inválido.');
      return;
    }
    mutation.mutate(form);
  }

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Novo Lançamento</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex gap-3">
          {(['DESPESA', 'RECEITA'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                form.type === t
                  ? t === 'DESPESA'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              {t === 'DESPESA' ? '💸 Despesa' : '💰 Receita'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data" required>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Valor (R$)" required>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Descrição" required>
          <input
            type="text"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            required
            placeholder={form.type === 'DESPESA' ? 'ex: Supermercado Pão de Açúcar' : 'ex: Salário maio'}
            className={inputClass}
          />
        </Field>

        {form.type === 'DESPESA' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Categoria">
                <select
                  value={form.categoryId}
                  onChange={(e) => set('categoryId', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sem categoria</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tipo de Despesa">
                <select
                  value={form.expenseType}
                  onChange={(e) => set('expenseType', e.target.value)}
                  className={inputClass}
                >
                  <option value="FIXO">Fixo</option>
                  <option value="ESPORADICO">Esporádico</option>
                  <option value="TERCEIROS">Terceiros</option>
                </select>
              </Field>
            </div>

            <Field label="Forma de Pagamento">
              <select
                value={form.paymentMethodId}
                onChange={(e) => set('paymentMethodId', e.target.value)}
                className={inputClass}
              >
                <option value="">Selecionar...</option>
                {paymentMethods?.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex items-center gap-3">
              <input
                id="installment"
                type="checkbox"
                checked={form.isInstallment}
                onChange={(e) => set('isInstallment', e.target.checked)}
                className="w-4 h-4 rounded text-green-600"
              />
              <label htmlFor="installment" className="text-sm text-slate-700">
                Compra parcelada?
              </label>
            </div>

            {form.isInstallment && (
              <Field label="Parcela (ex: 3/12)">
                <input
                  type="text"
                  placeholder="ex: 3/12"
                  value={form.installmentInfo}
                  onChange={(e) => set('installmentInfo', e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
          </>
        ) : (
          <Field label="Fonte">
            <input
              type="text"
              placeholder="ex: Salário, Aluguel, PLR..."
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
