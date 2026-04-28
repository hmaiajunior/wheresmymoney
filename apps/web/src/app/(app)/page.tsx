'use client';

import { useQuery } from '@tanstack/react-query';
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
}

const currentYear = new Date().getFullYear();

export default function DashboardPage() {
  const { data: summaries, isLoading } = useQuery<MonthlySummary[]>({
    queryKey: ['summary', currentYear],
    queryFn: () => api.get(`/summary/${currentYear}`).then((r) => r.data),
  });

  const activeSummaries = summaries?.filter((s) => s.receitas > 0 || s.totalDespesas > 0) ?? [];
  const currentMonth = new Date().getMonth() + 1;
  const current = summaries?.find((s) => s.month === currentMonth);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard {currentYear}</h2>
        <Link
          href="/transactions/new"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          + Novo Lançamento
        </Link>
      </div>

      {current && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Receitas" value={current.receitas} color="green" />
          <SummaryCard label="Despesas Fixas" value={current.despesasFixas} color="blue" />
          <SummaryCard label="Despesas Esporád." value={current.despesasEsporadicas} color="orange" />
          <SummaryCard
            label="Saldo"
            value={current.saldo}
            color={current.saldo >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Resumo por Ciclo</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : activeSummaries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum lançamento encontrado.{' '}
            <Link href="/transactions/new" className="text-green-600 underline">
              Adicionar primeiro lançamento
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left px-6 py-3 font-medium">Ciclo</th>
                  <th className="text-right px-4 py-3 font-medium">Receitas</th>
                  <th className="text-right px-4 py-3 font-medium">Desp. Fixas</th>
                  <th className="text-right px-4 py-3 font-medium">Desp. Esporád.</th>
                  <th className="text-right px-4 py-3 font-medium">Total Desp.</th>
                  <th className="text-right px-6 py-3 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSummaries.map((s) => (
                  <tr key={s.month} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {getMonthName(s.month)} {s.year}
                    </td>
                    <td className="px-4 py-4 text-right text-green-700">
                      {formatCurrency(s.receitas)}
                    </td>
                    <td className="px-4 py-4 text-right text-blue-700">
                      {formatCurrency(s.despesasFixas)}
                    </td>
                    <td className="px-4 py-4 text-right text-orange-700">
                      {formatCurrency(s.despesasEsporadicas)}
                    </td>
                    <td className="px-4 py-4 text-right text-red-700">
                      {formatCurrency(s.totalDespesas)}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-semibold ${
                        s.saldo >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {formatCurrency(s.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'green' | 'blue' | 'orange' | 'red';
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{formatCurrency(value)}</p>
    </div>
  );
}
