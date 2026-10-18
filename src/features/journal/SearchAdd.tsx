import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FilterBar } from "../../app/FilterBar";
import { Badge } from "../../app/ui";
import { entityName } from "../../data/entities";
import { getSearchIndex } from "../../data/searchIndex";
import type { WikiData } from "../../data/types";
import { useJournalStore } from "../../db/journalStore";
import { searchQuests, type SearchFilters } from "../../lib/search";

const MAX_RESULTS = 30;

/** Search-and-add: stays open so several quests can be added in a row (SPEC §5.1). */
export function SearchAdd({ data, onAdded }: { data: WikiData; onAdded: (addedAsPlanned: number) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const entries = useJournalStore((s) => s.entries);
  const add = useJournalStore((s) => s.add);
  const inJournal = useMemo(() => new Set(entries.map((e) => e.questId)), [entries]);
  const hits = useMemo(() => searchQuests(getSearchIndex(data), query, filters).slice(0, MAX_RESULTS), [data, query, filters]);

  const addQuest = (id: string) => onAdded(add([id]).addedAsPlanned.length);
  const addButton = "flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm";

  return (
    <div>
      <label className="sr-only" htmlFor="journal-search">
        {t("catalog.searchLabel")}
      </label>
      <input
        id="journal-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("catalog.searchPlaceholder")}
        autoComplete="off"
        className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-base outline-none focus:border-[var(--accent-text)]"
      />
      <FilterBar data={data} value={filters} onChange={setFilters} />
      <ul className="mt-2 max-h-[50dvh] divide-y divide-[var(--border)] overflow-y-auto border-y border-[var(--border)]">
        {hits.map((hit) => {
          const q = data.questById.get(hit.questId)!;
          const variants = hit.variantIds && hit.variantIds.length > 1 ? hit.variantIds : null;
          return (
            <li key={hit.questId} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{variants ? q.title.replace(/\s*\([^()]*\)$/, "") : q.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]">
                    <Badge>{q.typeRaw ?? t(`questType.${q.type}`)}</Badge>
                    {q.hidden && <Badge tone="warn">{t("catalog.hidden")}</Badge>}
                    {q.start && <span>{entityName(data.npcs, q.start.npcId)}</span>}
                  </p>
                </div>
                {!variants &&
                  (inJournal.has(q.id) ? (
                    <span className="flex min-h-11 shrink-0 items-center text-sm text-[var(--muted)]">✓ {t("journal.inJournal")}</span>
                  ) : (
                    <button type="button" onClick={() => addQuest(q.id)} className={`${addButton} border-[var(--accent-text)] text-[var(--accent-text)]`}>
                      + {t("journal.addOne")}
                    </button>
                  ))}
              </div>
              {variants && (
                <div className="mt-1">
                  <p className="text-sm text-[var(--muted)]">{t("journal.chooseVariant")}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {variants.map((id) => {
                      const v = data.questById.get(id)!;
                      const added = inJournal.has(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={added}
                          onClick={() => addQuest(id)}
                          className={`${addButton} ${added ? "border-[var(--border)] text-[var(--muted)]" : "border-[var(--accent-text)] text-[var(--accent-text)]"}`}
                        >
                          {added ? "✓" : "+"} {v.variant?.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
