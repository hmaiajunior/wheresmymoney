'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UserProfile {
  id: string; email: string; name: string; cycleStartDay: number;
}

interface Category {
  id: string; name: string; color?: string | null; isSystem: boolean;
}

const PALETTE = [
  '#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#f59e0b',
  '#84cc16', '#6366f1', '#94a3b8', '#ec4899', '#ef4444',
  '#0ea5e9', '#f97316', '#8b5cf6', '#d97706', '#10b981',
  '#14b8a6', '#f43f5e', '#fb923c', '#dc2626',
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [cycleDay, setCycleDay] = useState('');
  const [cycleSaved, setCycleSaved] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', color: PALETTE[0] });
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; color: string }>({ name: '', color: PALETTE[0] });

  const { data: user } = useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const cycleMutation = useMutation({
    mutationFn: (day: number) => api.patch('/users/me/cycle-start-day', { day }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setCycleSaved(true);
      setTimeout(() => setCycleSaved(false), 2000);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newCategory) => api.post('/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewCategory({ name: '', color: PALETTE[0] });
      setError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Erro ao criar categoria.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; color: string } }) =>
      api.patch(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Não foi possível remover esta categoria.');
    },
  });

  if (!user) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  const currentDay = cycleDay !== '' ? parseInt(cycleDay) : user.cycleStartDay;
  const systemCats = (categories ?? []).filter((c) => c.isSystem);
  const customCats = (categories ?? []).filter((c) => !c.isSystem);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Configurações</h2>

      {/* Perfil */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-1">Perfil</h3>
        <p className="text-sm text-slate-500">{user.name} · {user.email}</p>
      </section>

      {/* Ciclo */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-1">Dia de início do ciclo</h3>
        <p className="text-sm text-slate-500 mb-4">
          Define em que dia do mês começa o ciclo financeiro. Em sua planilha era o dia 2.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-[160px]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Dia (1–28)</label>
            <input
              type="number"
              min="1"
              max="28"
              value={cycleDay !== '' ? cycleDay : user.cycleStartDay}
              onChange={(e) => setCycleDay(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => cycleMutation.mutate(currentDay)}
            disabled={cycleMutation.isPending || currentDay === user.cycleStartDay}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {cycleSaved ? '✓ Salvo' : 'Salvar'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Ciclo atual: dia {user.cycleStartDay} de cada mês
        </p>
      </section>

      {/* Categorias */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-1">Categorias</h3>
        <p className="text-sm text-slate-500 mb-4">
          Categorias do sistema não podem ser removidas. Crie suas próprias e personalize as cores.
        </p>

        {/* Criação */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-slate-500 mb-2 font-medium">Nova categoria</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Nome da categoria"
              value={newCategory.name}
              onChange={(e) => setNewCategory((c) => ({ ...c, name: e.target.value }))}
              className="flex-1 min-w-40 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <ColorPicker value={newCategory.color} onChange={(color) => setNewCategory((c) => ({ ...c, color }))} />
            <button
              onClick={() => newCategory.name.trim() && createMutation.mutate(newCategory)}
              disabled={createMutation.isPending || !newCategory.name.trim()}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              + Criar
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        {/* Customizadas */}
        {customCats.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Suas categorias</p>
            <ul className="space-y-1">
              {customCats.map((c) => (
                <CategoryRow
                  key={c.id}
                  cat={c}
                  isEditing={editingId === c.id}
                  editForm={editForm}
                  onStartEdit={() => { setEditingId(c.id); setEditForm({ name: c.name, color: c.color ?? PALETTE[0] }); }}
                  onCancel={() => setEditingId(null)}
                  onChange={setEditForm}
                  onSave={() => updateMutation.mutate({ id: c.id, data: editForm })}
                  onDelete={() => { if (confirm(`Remover categoria "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                  canDelete
                />
              ))}
            </ul>
          </div>
        )}

        {/* Sistema */}
        <div>
          <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wide">Sistema ({systemCats.length})</p>
          <ul className="space-y-1">
            {systemCats.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                isEditing={editingId === c.id}
                editForm={editForm}
                onStartEdit={() => { setEditingId(c.id); setEditForm({ name: c.name, color: c.color ?? PALETTE[0] }); }}
                onCancel={() => setEditingId(null)}
                onChange={setEditForm}
                onSave={() => updateMutation.mutate({ id: c.id, data: editForm })}
                canDelete={false}
              />
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-lg border border-slate-300"
        style={{ backgroundColor: value }}
        aria-label="Selecionar cor"
      />
      {open && (
        <div className="absolute z-10 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg grid grid-cols-5 gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-6 h-6 rounded ${c === value ? 'ring-2 ring-offset-1 ring-slate-700' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CategoryRowProps {
  cat: Category;
  isEditing: boolean;
  editForm: { name: string; color: string };
  onStartEdit: () => void;
  onCancel: () => void;
  onChange: (form: { name: string; color: string }) => void;
  onSave: () => void;
  onDelete?: () => void;
  canDelete: boolean;
}

function CategoryRow({ cat, isEditing, editForm, onStartEdit, onCancel, onChange, onSave, onDelete, canDelete }: CategoryRowProps) {
  if (isEditing) {
    return (
      <li className="flex flex-wrap items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
        <input
          type="text"
          value={editForm.name}
          onChange={(e) => onChange({ ...editForm, name: e.target.value })}
          className="flex-1 min-w-40 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <ColorPicker value={editForm.color} onChange={(color) => onChange({ ...editForm, color })} />
        <button
          onClick={onSave}
          className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
        >
          Salvar
        </button>
        <button onClick={onCancel} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700">
          Cancelar
        </button>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded-lg">
      <span className="flex items-center gap-2.5">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: cat.color ?? '#94a3b8' }} />
        <span className="text-sm text-slate-700">{cat.name}</span>
        {cat.isSystem && (
          <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
            sistema
          </span>
        )}
      </span>
      <span className="flex gap-1">
        <button onClick={onStartEdit} className="text-xs text-slate-500 hover:text-emerald-700 px-2 py-1">
          Editar
        </button>
        {canDelete && onDelete && (
          <button onClick={onDelete} className="text-xs text-slate-400 hover:text-red-600 px-2 py-1">
            Remover
          </button>
        )}
      </span>
    </li>
  );
}
