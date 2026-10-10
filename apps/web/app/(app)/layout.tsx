'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { clearToken, currentUser } from '../../lib/api';
import { LogoutIcon } from '../components/icons';
import { Sidebar } from '../components/Sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const user = currentUser();

  useEffect(() => {
    if (!currentUser()) {
      router.replace('/');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1">
        <header className="flex h-16 items-center justify-end gap-4 border-b border-slate-200 bg-white px-8">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">{user?.role}</p>
            <p className="text-xs text-slate-400">Group {user?.groupId.slice(0, 8)}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-semibold text-white uppercase">
            {user?.role?.[0] ?? '?'}
          </div>
          <button
            onClick={() => {
              clearToken();
              router.replace('/');
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
