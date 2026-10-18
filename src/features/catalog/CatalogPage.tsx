import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { DataGate } from "../../app/DataGate";
import { PageHeader } from "../../app/PageHeader";
import { Badge, questPath } from "../../app/ui";
import { entityName } from "../../data/entities";
import { getSearchIndex } from "../../data/searchIndex";
import type { WikiData } from "../../data/types";
import { searchQuests } from "../../lib/search";

export function CatalogPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.catalog")} />
      <DataGate>{(data) => <Catalog data={data} />}</DataGate>
    </>
  );
}

function Catalog({ data }: { data: WikiData }) {
  const { t } = useTranslation();
  // Query lives in the URL so «back» from a quest card restores the search.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const showHidden = params.get("hidden") === "1";

  const index = getSearchIndex(data);
  const hits = useMemo(() => searchQuests(index, query, { showHidden }), [index, query, showHidden]);

  const update = (next: { q?: string; hidden?: boolean }) => {
    const p = new URLSearchParams(params);
    const q = next.q ?? query;
    const hidden = next.hidden ?? showHidden;
    if (q) p.set("q", q);
    else p.delete("q");
    if (hidden) p.set("hidden", "1");
    else p.delete("hidden");
    setParams(p, { replace: true });
  };

  return (
    <>
      {data.meta.sample && <p className="mb-3 text-sm text-[var(--muted)]">{t("data.sample", { count: data.meta.counts.quests })}</p>}
      <label className="sr-only" htmlFor="catalog-search">
        {t("catalog.searchLabel")}
      </label>
      <input
        id="catalog-search"
        type="search"
        value={query}
        onChange={(e) => update({ q: e.target.value })}
        placeholder={t("catalog.searchPlaceholder")}
        autoComplete="off"
        className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base outline-none focus:border-[var(--accent-text)]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => update({ hidden: e.target.checked })}
            className="size-5 accent-[var(--accent-text)]"
          />
          {t("catalog.showHidden")}
        </label>
        <span className="text-sm text-[var(--muted)]" aria-live="polite">
          {t("catalog.results", { count: hits.length })}
        </span>
      </div>

      {hits.length === 0 ? (
        <p className="mt-4 text-[var(--muted)]">{t("catalog.noResults")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {hits.map((hit) => {
            const q = data.questById.get(hit.questId)!;
            return (
              <li key={hit.questId}>
                <Link to={questPath(hit.questId)} className="block py-3 hover:bg-[var(--surface)]">
                  <span className="font-medium">
                    {/* a collapsed variant group is named without the variant suffix («(Вез)») */}
                    {hit.variantIds && hit.variantIds.length > 1 ? q.title.replace(/\s*\([^()]*\)$/, "") : q.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]">
                    <Badge>{t(`questType.${q.type}`)}</Badge>
                    {hit.variantIds && hit.variantIds.length > 1 && <Badge tone="accent">{t("catalog.variants", { count: hit.variantIds.length })}</Badge>}
                    {q.hidden && <Badge tone="warn">{t("catalog.hidden")}</Badge>}
                    {q.start && (
                      <span>
                        {entityName(data.npcs, q.start.npcId)}
                        {q.start.locationId && ` · ${entityName(data.locations, q.start.locationId)}`}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
