import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { WikiData } from "../../data/types";
import { getSearchIndex } from "../../data/searchIndex";
import { useJournalStore } from "../../db/journalStore";
import { matchPastedList, type LineMatch } from "../../lib/pasteMatch";

/** Paste a list → match → confirm: recognized / several candidates / not found (SPEC §5.1). */
export function PasteAdd({ data, onAdded }: { data: WikiData; onAdded: (added: number, addedAsPlanned: number) => void }) {
  const { t } = useTranslation();
  const add = useJournalStore((s) => s.add);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<LineMatch[] | null>(null);
  // line index → chosen quest id (null = skip)
  const [choice, setChoice] = useState<Record<number, string | null>>({});

  const recognize = () => {
    const result = matchPastedList(getSearchIndex(data), text);
    setMatches(result);
    setChoice(Object.fromEntries(result.map((m, i) => [i, m.kind === "recognized" ? m.questId : null])));
  };

  const selected = [...new Set(Object.values(choice).filter((id): id is string => !!id))];
  const title = (id: string) => data.questById.get(id)?.title ?? id;

  if (!matches) {
    return (
      <div>
        <label htmlFor="paste-list" className="sr-only">
          {t("journal.pasteLabel")}
        </label>
        <textarea
          id="paste-list"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={t("journal.pastePlaceholder")}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-base outline-none focus:border-[var(--accent-text)]"
        />
        <button
          type="button"
          onClick={recognize}
          disabled={!text.trim()}
          className="mt-2 min-h-12 w-full rounded-lg bg-accent font-medium text-black disabled:opacity-40"
        >
          {t("journal.recognize")}
        </button>
      </div>
    );
  }

  const groups = [
    { kind: "recognized", label: t("journal.recognized") },
    { kind: "ambiguous", label: t("journal.ambiguous") },
    { kind: "notFound", label: t("journal.notFound") },
  ] as const;

  return (
    <div>
      {groups.map(({ kind, label }) => {
        const rows = matches.map((m, i) => [m, i] as const).filter(([m]) => m.kind === kind);
        if (rows.length === 0) return null;
        return (
          <section key={kind} className="mb-4">
            <h3 className="mb-1 text-sm font-semibold text-[var(--muted)]">
              {label} ({rows.length})
            </h3>
            <ul className="space-y-2">
              {rows.map(([m, i]) => (
                <li key={i} className="rounded-lg border border-[var(--border)] p-2">
                  {m.kind === "recognized" && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={choice[i] === m.questId}
                        onChange={(e) => setChoice({ ...choice, [i]: e.target.checked ? m.questId : null })}
                        className="size-5 shrink-0 accent-[var(--accent-text)]"
                      />
                      <span>
                        {title(m.questId)}
                        {m.line !== title(m.questId) && <span className="block text-xs text-[var(--muted)]">«{m.line}»</span>}
                      </span>
                    </label>
                  )}
                  {m.kind === "ambiguous" && (
                    <fieldset>
                      <legend className="text-sm text-[var(--muted)]">«{m.line}»</legend>
                      {[...m.candidates, null].map((id) => (
                        <label key={id ?? "skip"} className="flex min-h-11 cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name={`line-${i}`}
                            checked={choice[i] === id}
                            onChange={() => setChoice({ ...choice, [i]: id })}
                            className="size-5 shrink-0 accent-[var(--accent-text)]"
                          />
                          {id ? title(id) : <span className="text-[var(--muted)]">{t("journal.skip")}</span>}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {m.kind === "notFound" && <p className="text-[var(--muted)]">«{m.line}»</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="flex gap-2">
        <button type="button" onClick={() => setMatches(null)} className="min-h-12 flex-1 rounded-lg border border-[var(--border)]">
          {t("journal.editList")}
        </button>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => {
            const r = add(selected);
            onAdded(r.added.length, r.addedAsPlanned.length);
            setText("");
            setMatches(null);
          }}
          className="min-h-12 flex-1 rounded-lg bg-accent font-medium text-black disabled:opacity-40"
        >
          {t("journal.addSelected", { count: selected.length })}
        </button>
      </div>
    </div>
  );
}
