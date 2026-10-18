import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { DataGate } from "../../app/DataGate";
import { EmptyState, PageHeader } from "../../app/PageHeader";
import { AutoMark, Section, qtyString, questPath, sumString, useNumberFormat } from "../../app/ui";
import { entityName } from "../../data/entities";
import type { WikiData } from "../../data/types";
import { useJournalStore } from "../../db/journalStore";
import { useRouteInput } from "../../db/useRouteInput";
import { buildChecklist, type ChecklistLine } from "../../lib/checklist";

export function ChecklistPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.checklist")} />
      <DataGate>{(data) => <Checklist data={data} />}</DataGate>
    </>
  );
}

function Checklist({ data }: { data: WikiData }) {
  const { t } = useTranslation();
  const { loaded, input } = useRouteInput(data);
  const checklist = useMemo(() => buildChecklist(input), [input]);

  if (!loaded) return null;
  if (input.length === 0) {
    return (
      <EmptyState>
        {t("checklist.empty")}{" "}
        <Link to="/" className="text-[var(--accent-text)] underline underline-offset-2">
          {t("nav.journal")}
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <Section title={t("checklist.items")}>
        {checklist.items.length === 0 ? (
          <p className="text-[var(--muted)]">{t("checklist.nothing")}</p>
        ) : (
          <ul className="space-y-2">
            {checklist.items.map((line) => (
              <Line key={line.key} data={data} line={line} name={entityName(data.items, line.key)} haveKey={`item:${line.key}`} />
            ))}
          </ul>
        )}
      </Section>

      {checklist.kills.length > 0 && (
        <Section title={t("checklist.kills")}>
          <ul className="space-y-2">
            {checklist.kills.map((line) => (
              <Line key={line.key} data={data} line={line} name={line.name ?? line.key.replace(/_/g, " ")} />
            ))}
          </ul>
        </Section>
      )}

      {checklist.checkOnWiki.length > 0 && (
        <Section title={t("checklist.checkOnWiki")}>
          <p className="mb-2 text-sm text-[var(--muted)]">{t("checklist.checkOnWikiHint")}</p>
          <ul className="space-y-1">
            {checklist.checkOnWiki.map((id) => {
              const q = data.questById.get(id)!;
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3">
                  <Link to={questPath(id)} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
                    {q.title}
                  </Link>
                  <a href={q.url} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent-text)] underline underline-offset-2">
                    so-wiki.ru ↗
                  </a>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}

function Line({ data, line, name, haveKey }: { data: WikiData; line: ChecklistLine; name: string; haveKey?: string }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  const have = useJournalStore((s) => (haveKey ? s.have.includes(haveKey) : false));
  const toggle = useJournalStore((s) => s.toggleHave);
  const body = (
    <span className="min-w-0 flex-1">
      <span className={`flex flex-wrap items-baseline justify-between gap-x-2 ${have ? "text-[var(--muted)] line-through" : ""}`}>
        <span className="font-medium">{name}</span>
        <span className="tabular-nums">{sumString(t, fmt, line.total)}</span>
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
        {line.parts.map((p) => (
          <span key={p.questId}>
            {data.questById.get(p.questId)?.title}: {p.override !== undefined ? qtyString(t, fmt, { min: p.override, max: p.override }) : qtyString(t, fmt, p.qty)}
          </span>
        ))}
        {line.parsed && <AutoMark />}
      </span>
      {line.total.incomplete && <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">⚠ {t("checklist.incomplete")}</span>}
    </span>
  );
  if (!haveKey) return <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">{body}</li>;
  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 p-3">
        <input type="checkbox" checked={have} onChange={() => toggle(haveKey)} aria-label={t("checklist.have")} className="mt-0.5 size-5 shrink-0 accent-[var(--accent-text)]" />
        {body}
      </label>
    </li>
  );
}
