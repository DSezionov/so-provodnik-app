import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { TFunction } from "i18next";

import type { Qty } from "../data/types";
import type { QtySum } from "../lib/checklist";
import { qtyView } from "../lib/qty";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const tones = {
    neutral: "border-[var(--border)] text-[var(--muted)]",
    accent: "border-[var(--accent-text)] text-[var(--accent-text)]",
    warn: "border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300",
  };
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

/** Marks a value extracted heuristically from free text (confidence "parsed"). */
export function AutoMark() {
  const { t } = useTranslation();
  return <Badge tone="warn">{t("quest.autoCheck")}</Badge>;
}

export function useNumberFormat() {
  const { i18n } = useTranslation();
  const nf = new Intl.NumberFormat(i18n.resolvedLanguage ?? "ru");
  return (n: number) => nf.format(n);
}

/** «3 шт.», «20–50 шт.», «от 2 шт.», «? шт.» as plain text. */
export function qtyString(t: TFunction, fmt: (n: number) => string, qty?: Qty): string {
  const v = qtyView(qty);
  switch (v.kind) {
    case "exact":
      return t("qty.exact", { n: fmt(v.n) });
    case "range":
      return t("qty.range", { min: fmt(v.min), max: fmt(v.max) });
    case "atLeast":
      return t("qty.atLeast", { min: fmt(v.min) });
    default:
      return t("qty.unknown");
  }
}

/** A checklist total: known part as a quantity, «?» when nothing is known. */
export function sumString(t: TFunction, fmt: (n: number) => string, sum: QtySum): string {
  if (sum.incomplete && sum.min === 0 && sum.max === 0) return t("qty.unknown");
  return qtyString(t, fmt, sum.max === null ? { min: sum.min } : { min: sum.min, max: sum.max });
}

export function QtyText({ qty }: { qty?: Qty }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const v = qtyView(qty);
  switch (v.kind) {
    case "exact":
      return <>{t("qty.exact", { n: fmt(v.n) })}</>;
    case "range":
      return <>{t("qty.range", { min: fmt(v.min), max: fmt(v.max) })}</>;
    case "atLeast":
      return <>{t("qty.atLeast", { min: fmt(v.min) })}</>;
    default:
      return <>{t("qty.unknown")}</>;
  }
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  );
}

export function questPath(id: string) {
  return `/quest/${encodeURIComponent(id)}`;
}
