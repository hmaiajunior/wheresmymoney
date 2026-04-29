'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '@/lib/api';
import { formatCurrency, getMonthName } from '@/lib/format';
import Link from 'next/link';

interface MonthlySummary {
  year: number;
  month: number;
  cycleStart: string;
  cycleEnd: string;
  receitas: number;
  despesasFixas: number;
  despesasEsporadicas: number;
  despesasTerceiros: number;
  totalDespesas: number;
  saldo: number;
  transactionCount: number;
}

interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string | null;
  amount: number;
  count: number;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const MONTHS = [
  { value: 0,  label: 'Ano inteiro' },
  { value: 1,  label: 'Janeiro' },  { value: 2,  label: 'Fevereiro' },
  { value: 3,  label: 'Março' },    { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Maio' },     { value: 6,  label: 'Junho' },
  { value: 7,  label: 'Julho' },    { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Setembro' }, { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [cycleMsg, setCycleMsg] = useState('');
  const [showCyclePicker, setShowCyclePicker] = useState(false);
  const nextMonthDefault = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYearDefault = currentMonth === 12 ? currentYear + 1 : currentYear;
  const [cycleTarget, setCycleTarget] = useState({ month: nextMonthDefault, year: nextYearDefault });
  const queryClient = useQueryClient();

  const { data: summaries, isLoading } = useQuery<MonthlySummary[]>({
    queryKey: ['summary', selectedYear],
    queryFn: () => api.get(`/summary/${selectedYear}`).then((r) => r.data),
  });

  const { data: categorySlices } = useQuery<CategorySlice[]>({
    queryKey: ['summary-by-category', selectedYear, selectedMonth],
    queryFn: () => api
      .get(`/summary/${selectedYear}/${selectedMonth || currentMonth}/by-category`)
      .then((r) => r.data),
    enabled: selectedMonth > 0,
  });

  const cycleMutation = useMutation({
    mutationFn: () => api.post('/summary/generate-next-cycle', {
      targetMonth: cycleTarget.month,
      targetYear: cycleTarget.year,
    }).then((r) => r.data),
    onSuccess: (result) => {
      setShowCyclePicker(false);
      if (result.alreadyGenerated) {
        setCycleMsg(`Ciclo de ${getMonthName(result.nextMonth)} ${result.nextYear} já foi gerado.`);
      } else {
        const ok = result.created === result.baseCount;
        const skippedInfo = result.skipped?.length
          ? ` Ignorados: ${result.skipped.map((s: { description: string; reason: string }) => `"${s.description}" (${s.reason})`).join(', ')}.`
          : '';
        setCycleMsg(
          ok
            ? `${result.created} lançamentos criados para ${getMonthName(result.nextMonth)} ${result.nextYear}.`
            : `${result.created} de ${result.baseCount} criados para ${getMonthName(result.nextMonth)} ${result.nextYear}.${skippedInfo}`,
        );
        queryClient.invalidateQueries({ queryKey: ['summary'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
      setTimeout(() => setCycleMsg(''), 5000);
    },
  });

  const activeSummaries = (summaries ?? []).filter((s) => s.receitas > 0 || s.totalDespesas > 0 || s.transactionCount > 0);

  const visibleSummaries = selectedMonth === 0
    ? activeSummaries
    : activeSummaries.filter((s) => s.month === selectedMonth);

  const totals = visibleSummaries.reduce(
    (acc, s) => ({
      receitas: acc.receitas + s.receitas,
      despesasFixas: acc.despesasFixas + s.despesasFixas,
      despesasEsporadicas: acc.despesasEsporadicas + s.despesasEsporadicas,
      despesasTerceiros: acc.despesasTerceiros + s.despesasTerceiros,
      totalDespesas: acc.totalDespesas + s.totalDespesas,
      saldo: acc.saldo + s.saldo,
    }),
    { receitas: 0, despesasFixas: 0, despesasEsporadicas: 0, despesasTerceiros: 0, totalDespesas: 0, saldo: 0 },
  );

  // Comparação com mês anterior
  const prevSummary = selectedMonth > 0
    ? activeSummaries.find((s) => s.month === selectedMonth - 1)
    : undefined;
  const variationSaldo = prevSummary
    ? totals.saldo - prevSummary.saldo
    : 0;

  const cardLabel = selectedMonth === 0
    ? `Acumulado ${selectedYear}`
    : `${getMonthName(selectedMonth)} ${selectedYear}`;

  const expensesPct = totals.receitas > 0 ? (totals.totalDespesas / totals.receitas) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">{cardLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {cycleMsg && (
            <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
              {cycleMsg}
            </span>
          )}

          {showCyclePicker ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-xs text-blue-700 font-medium">Gerar ciclo de:</span>
              <select
                value={cycleTarget.month}
                onChange={(e) => setCycleTarget((c) => ({ ...c, month: Number(e.target.value) }))}
                className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none"
              >
                {MONTHS.filter((m) => m.value !== 0).map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={cycleTarget.year}
                onChange={(e) => setCycleTarget((c) => ({ ...c, year: Number(e.target.value) }))}
                className="border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-xs text-slate-400">(base: {getMonthName(cycleTarget.month === 1 ? 12 : cycleTarget.month - 1)})</span>
              <button
                onClick={() => cycleMutation.mutate()}
                disabled={cycleMutation.isPending}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {cycleMutation.isPending ? 'Gerando...' : 'Confirmar'}
              </button>
              <button onClick={() => setShowCyclePicker(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowCyclePicker(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Gerar próximo ciclo
            </button>
          )}

          <Link
            href="/transactions/new"
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            + Novo Lançamento
          </Link>
        </div>
      </div>

      {/* Filtros de período */}
      <div className="flex gap-3 items-center flex-wrap bg-white rounded-xl border border-slate-200 px-4 py-3">
        <span className="text-xs text-slate-500 font-medium">Período:</span>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {(selectedYear !== currentYear || selectedMonth !== currentMonth) && (
          <button
            onClick={() => { setSelectedYear(currentYear); setSelectedMonth(currentMonth); }}
            className="text-xs text-slate-500 hover:text-emerald-600 underline"
          >
            Voltar para mês atual
          </button>
        )}
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Receitas" value={totals.receitas} color="emerald" hint={`${visibleSummaries.reduce((a, s) => a + (s.receitas > 0 ? 1 : 0), 0)} fonte(s)`} />
        <SummaryCard label="Despesas" value={totals.totalDespesas} color="red" hint={`${expensesPct.toFixed(0)}% das receitas`} />
        <SummaryCard
          label="Saldo"
          value={totals.saldo}
          color={totals.saldo >= 0 ? 'emerald' : 'red'}
          hint={prevSummary
            ? `${variationSaldo >= 0 ? '+' : ''}${formatCurrency(variationSaldo)} vs mês anterior`
            : undefined}
        />
        <SummaryCard label="Terceiros" value={totals.despesasTerceiros} color="slate" hint="não entra no saldo" />
      </div>

      {/* Subcards de despesas */}
      <div className="grid grid-cols-2 gap-4">
        <DetailCard label="Despesas Fixas" value={totals.despesasFixas} pct={totals.totalDespesas > 0 ? (totals.despesasFixas / totals.totalDespesas) * 100 : 0} color="bg-blue-500" />
        <DetailCard label="Despesas Esporádicas" value={totals.despesasEsporadicas} pct={totals.totalDespesas > 0 ? (totals.despesasEsporadicas / totals.totalDespesas) * 100 : 0} color="bg-orange-500" />
      </div>

      {/* Pizza por categoria + Top categorias */}
      {selectedMonth > 0 && categorySlices && categorySlices.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Distribuição por categoria</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySlices.map((c) => ({ name: c.name, value: c.amount, color: c.color ?? '#94a3b8' }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {categorySlices.map((c, i) => (
                      <Cell key={i} fill={c.color ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Top categorias</h3>
            <ul className="space-y-2.5">
              {categorySlices.slice(0, 8).map((c) => {
                const totalCat = categorySlices.reduce((a, s) => a + s.amount, 0);
                const pct = totalCat > 0 ? (c.amount / totalCat) * 100 : 0;
                return (
                  <li key={c.categoryId ?? 'none'} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color ?? '#94a3b8' }} />
                        <span className="text-slate-700">{c.name}</span>
                        <span className="text-xs text-slate-400">({c.count})</span>
                      </span>
                      <span className="text-slate-800 font-medium">{formatCurrency(c.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: c.color ?? '#94a3b8' }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Tabela de ciclos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">Resumo mensal</h3>
          <span className="text-xs text-slate-400">{visibleSummaries.length} {visibleSummaries.length === 1 ? 'mês' : 'meses'}</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : visibleSummaries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 mb-3">Nenhum lançamento neste período.</p>
            <Link href="/transactions/new" className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
              Adicionar primeiro lançamento
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="text-left px-6 py-3 font-medium">Ciclo</th>
                  <th className="text-right px-4 py-3 font-medium">Receitas</th>
                  <th className="text-right px-4 py-3 font-medium">Fixas</th>
                  <th className="text-right px-4 py-3 font-medium">Esporád.</th>
                  <th className="text-right px-4 py-3 font-medium">Total Desp.</th>
                  <th className="text-right px-6 py-3 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSummaries.map((s) => (
                  <tr key={s.month} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {getMonthName(s.month)} {s.year}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(s.receitas)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(s.despesasFixas)}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(s.despesasEsporadicas)}</td>
                    <td className="px-4 py-3 text-right text-red-700 font-medium">{formatCurrency(s.totalDespesas)}</td>
                    <td className={`px-6 py-3 text-right font-semibold ${s.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrency(s.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {selectedMonth === 0 && visibleSummaries.length > 1 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold text-slate-700 border-t-2 border-slate-200">
                    <td className="px-6 py-3">Total</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(totals.receitas)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(totals.despesasFixas)}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(totals.despesasEsporadicas)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{formatCurrency(totals.totalDespesas)}</td>
                    <td className={`px-6 py-3 text-right ${totals.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrency(totals.saldo)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const colorMap = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-800',
  red: 'bg-red-50 border-red-200 text-red-800',
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
} as const;

function SummaryCard({ label, value, color, hint }: { label: string; value: number; color: keyof typeof colorMap; hint?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{formatCurrency(value)}</p>
      {hint && <p className="text-xs opacity-60 mt-1">{hint}</p>}
    </div>
  );
}

function DetailCard({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm text-slate-600 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-800">{formatCurrency(value)}</p>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-1">{pct.toFixed(0)}% das despesas totais</p>
    </div>
  );
}
