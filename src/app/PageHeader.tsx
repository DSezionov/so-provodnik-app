import type { ReactNode } from "react";

export function PageHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      {aside}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-[var(--muted)]">{children}</p>
  );
}
