'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/transactions', label: 'Lançamentos', icon: '💸' },
  { href: '/transactions/new', label: 'Novo Lançamento', icon: '➕' },
  { href: '/settings', label: 'Configurações', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const { data: pending } = useQuery<{ count: number }>({
    queryKey: ['pending-count'],
    queryFn: () => api.get('/summary/pending').then((r) => r.data),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-60 min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col">
      <div className="p-5 border-b border-slate-800">
        <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
          <span>💰</span> WMM
        </h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Where&apos;s My Money</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isTransactions = item.href === '/transactions';
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-700/80 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {isTransactions && pending?.count ? (
                <span className="bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {pending.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-slate-400">Logado como</p>
          <p className="text-sm text-slate-200 truncate">{user?.name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-red-900/40 hover:text-red-300 transition-colors"
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  );
}
