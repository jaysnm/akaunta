'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';

import {
  AuditIcon,
  CalendarIcon,
  GridIcon,
  HeartIcon,
  LoansIcon,
  UsersIcon,
  WalletIcon,
} from './icons';

const NAV: Array<{ href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { href: '/members', label: 'Members', icon: UsersIcon },
  { href: '/wallet', label: 'Wallet', icon: WalletIcon },
  { href: '/loans', label: 'Loans', icon: LoansIcon },
  { href: '/meetings', label: 'Meetings', icon: CalendarIcon },
  { href: '/donations', label: 'Donations', icon: HeartIcon },
  { href: '/audit', label: 'Audit Log', icon: AuditIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-sm font-bold text-white">
          A
        </div>
        <span className="text-base font-semibold text-slate-900">Akaunta</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 text-xs text-slate-400">Akaunta · welfare group platform</div>
    </aside>
  );
}
