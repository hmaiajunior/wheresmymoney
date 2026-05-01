'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, getMonthName } from '@/lib/format';

export interface AccountBalanceDto {
  year: number;
  month: number;
  saldoCicloAtual: number;
  saldoAnterior: number | null;
  saldoCalculado: number;
  saldoEmConta: number;
  source: 'INITIAL' | 'CALCULATED' | 'MANUAL_ADJUST';
  divergence: number | null;
  note: string | null;
  hasInitial: boolean;
  incomplete: boolean;
}

const sourceMeta = {
  INITIAL:       { icon: '🏁', label: 'Saldo inicial',  tone: 'bg-emerald-100 text-emerald-800' },
  CALCULATED:    { icon: '📌', label: 'Calculado',      tone: 'bg-slate-100 text-slate-700' },
  MANUAL_ADJUST: { icon: '✏️', label: 'Ajustado',       tone: 'bg-amber-100 text-amber-800' },
} as const;

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatInputValue(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

export function AccountBalanceCard({ balance }: { balance: AccountBalanceDto }) {
  const [editing, setEditing] = useState(false);
  const meta = sourceMeta[balance.source];
  const monthLabel = `${getMonthName(balance.month)}/${balance.year}`;

  const matchesCalculated =
    balance.source === 'CALCULATED' ||
    (balance.divergence !== null && Math.abs(balance.divergence) < 0.005);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">💰 Saldo em conta</h3>
          <p className="text-xs text-slate-500 mt-0.5">Fechamento de {monthLabel}</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
        >
          🏦 Ajustar
        </button>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <Row label="Saldo do mês anterior" value={balance.saldoAnterior} muted={balance.saldoAnterior === null} />
        <Row
          label={`+ Resultado do ciclo de ${getMonthName(balance.month)}`}
          value={balance.saldoCicloAtual}
          tone={balance.saldoCicloAtual >= 0 ? 'positive' : 'negative'}
        />
        <div className="border-t border-slate-200 pt-1 mt-1">
          <Row label="= Saldo previsto" value={balance.saldoCalculado} bold />
        </div>
      </div>

      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-slate-500 font-medium">Saldo em conta hoje</p>
          <p className={`text-2xl font-bold ${balance.saldoEmConta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatCurrency(balance.saldoEmConta)}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded font-medium ${meta.tone}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {balance.source === 'MANUAL_ADJUST' && balance.divergence !== null && Math.abs(balance.divergence) >= 0.005 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          ⚠ Diverge da previsão em <strong>{balance.divergence >= 0 ? '+' : ''}{formatCurrency(balance.divergence)}</strong>.
          {balance.note && <span className="block text-slate-600 mt-1">Nota: <em>{balance.note}</em></span>}
        </div>
      )}

      {balance.source !== 'MANUAL_ADJUST' && matchesCalculated && balance.source !== 'INITIAL' && (
        <p className="text-xs text-emerald-700">✓ Bate com a previsão</p>
      )}

      {balance.incomplete && balance.source === 'CALCULATED' && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
          ℹ Sem saldo inicial cadastrado — o cálculo assumiu R$ 0,00 como ponto de partida.
        </p>
      )}

      {editing && (
        <EditBalanceModal balance={balance} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
  muted,
}: {
  label: string;
  value: number | null;
  tone?: 'positive' | 'negative';
  bold?: boolean;
  muted?: boolean;
}) {
  const colorClass = muted
    ? 'text-slate-400'
    : tone === 'negative'
      ? 'text-red-700'
      : tone === 'positive'
        ? 'text-emerald-700'
        : 'text-slate-700';
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular-nums ${colorClass} ${bold ? 'font-bold' : ''}`}>
        {value === null ? '—' : formatCurrency(value)}
      </span>
    </div>
  );
}

export function EditBalanceModal({
  balance,
  onClose,
}: {
  balance: AccountBalanceDto;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(formatInputValue(balance.saldoEmConta));
  const [note, setNote] = useState(balance.note ?? '');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setAmount(formatInputValue(balance.saldoEmConta));
    setNote(balance.note ?? '');
  }, [balance.saldoEmConta, balance.note]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['account-balance'] });
    queryClient.invalidateQueries({ queryKey: ['account-balance-year'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const value = parseAmount(amount);
      if (value === null) throw new Error('Valor inválido.');
      return api.post('/accounts/balance/manual', {
        year: balance.year, month: balance.month, amount: value, note: note || undefined,
      }).then((r) => r.data);
    },
    onSuccess: () => {
      invalidateAll();
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error
        ? e.message
        : (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erro ao salvar ajuste.');
    },
  });

  const revertMutation = useMutation({
    mutationFn: () => api.delete(`/accounts/balance/manual/${balance.year}/${balance.month}`),
    onSuccess: () => {
      invalidateAll();
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erro ao reverter ajuste.');
    },
  });

  const isInitial = balance.source === 'INITIAL';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Ajustar saldo de {getMonthName(balance.month)}/{balance.year}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Use quando o valor calculado não bater com o extrato bancário.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        {isInitial && (
          <div className="text-xs bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-emerald-800">
            🏁 Esse mês é o saldo inicial cadastrado. Para alterar, remova o inicial em <em>Configurações</em> e recadastre.
          </div>
        )}

        {!isInitial && (
          <>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Valor calculado:</span>
                <span className="tabular-nums font-medium text-slate-800">{formatCurrency(balance.saldoCalculado)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saldo real em conta (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nota (opcional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ex: esqueci de lançar estacionamento dia 18"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <p className="text-xs text-slate-500">
              ⚠ Os meses seguintes serão recalculados a partir desse ajuste.
            </p>
          </>
        )}

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 justify-between pt-2">
          {balance.source === 'MANUAL_ADJUST' ? (
            <button
              onClick={() => revertMutation.mutate()}
              disabled={revertMutation.isPending}
              className="text-xs text-slate-500 hover:text-red-600 underline disabled:opacity-50"
            >
              ↺ Voltar para calculado
            </button>
          ) : <span />}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            {!isInitial && (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar ajuste'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InitialBalanceBanner({ onCadastrar }: { onCadastrar: () => void }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-start gap-2">
        <span className="text-lg">ℹ</span>
        <div>
          <p className="text-sm text-blue-900 font-medium">Cadastre seu saldo inicial em conta</p>
          <p className="text-xs text-blue-700 mt-0.5">
            O WMM passa a calcular quanto sobra a cada mês a partir do saldo informado.
          </p>
        </div>
      </div>
      <button
        onClick={onCadastrar}
        className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
      >
        Cadastrar saldo inicial →
      </button>
    </div>
  );
}

export function InitialBalanceModal({ onClose }: { onClose: () => void }) {
  const today = new Date();
  const defaultMonth = today.getMonth() === 0 ? 12 : today.getMonth(); // mês anterior
  const defaultYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [amount, setAmount] = useState('0,00');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const value = parseAmount(amount);
      if (value === null) throw new Error('Valor inválido.');
      return api.post('/accounts/balance/initial', { year, month, amount: value }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-balance'] });
      queryClient.invalidateQueries({ queryKey: ['account-balance-year'] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error
        ? e.message
        : (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erro ao cadastrar saldo inicial.');
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 3 + i);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-800">🏁 Cadastrar saldo inicial</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Informe o saldo bancário ao final de um mês passado. Os meses seguintes serão calculados a partir daí.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mês de referência</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ano</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Saldo bancário ao fim do mês (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
