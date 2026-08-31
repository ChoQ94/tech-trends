"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/models", label: "Models" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/github", label: "GitHub" },
  { href: "/sources", label: "Sources" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-fg"
        >
          <span
            aria-hidden
            className="h-4 w-4 rounded-sm border border-accent bg-accent-dim"
          />
          <span>
            tech<span className="text-accent">/</span>trends
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="scroll-thin -mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1"
        >
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-dim/60 font-medium text-accent"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
