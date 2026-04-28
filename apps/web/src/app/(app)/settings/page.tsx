'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UserProfile {
  id: string; email: string; name: string; cycleStartDay: number;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [cycleDay, setCycleDay] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: user } = useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (day: number) => api.patch('/users/me/cycle-start-day', { day }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (!user) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  const currentDay = cycleDay !== '' ? parseInt(cycleDay) : user.cycleStartDay;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Configurações</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <h3 className="font-semibold text-slate-700 mb-1">Perfil</h3>
          <p className="text-sm text-slate-500">{user.name} · {user.email}</p>
        </div>

        <hr className="border-slate-100" />

        <div>
          <h3 className="font-semibold text-slate-700 mb-2">Dia de início do ciclo</h3>
          <p className="text-sm text-slate-500 mb-3">
            Define em que dia do mês começa o ciclo financeiro. Na sua planilha atual é o dia 2.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dia (1–28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={cycleDay !== '' ? cycleDay : user.cycleStartDay}
                onChange={(e) => setCycleDay(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => mutation.mutate(currentDay)}
              disabled={mutation.isPending || currentDay === user.cycleStartDay}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saved ? '✓ Salvo!' : 'Salvar'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Ciclo atual: dia {user.cycleStartDay} de cada mês
          </p>
        </div>
      </div>
    </div>
  );
}
