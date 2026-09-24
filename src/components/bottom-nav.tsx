"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Склад", icon: "📦" },
  { href: "/poruchka", label: "Поръчка", icon: "🛒" },
  { href: "/istoriya", label: "История", icon: "📋" },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/vhod") return null;

  return (
    <nav
      aria-label="Основно меню"
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-18 flex-col items-center justify-center text-lg font-bold ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
