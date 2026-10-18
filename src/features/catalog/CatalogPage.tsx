import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { DataGate } from "../../app/DataGate";
import { FilterBar } from "../../app/FilterBar";
import { PageHeader } from "../../app/PageHeader";
import { Badge, questPath } from "../../app/ui";
import { entityName } from "../../data/entities";
import { getSearchIndex } from "../../data/searchIndex";
import type { QuestType, WikiData } from "../../data/types";
import { searchQuests, type SearchFilters } from "../../lib/search";

const PAGE = 60;

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
  // Query and filters live in the URL so «back» from a quest card restores them.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const filters: SearchFilters = {
    showHidden: params.get("hidden") === "1",
    types: (params.get("types")?.split(",").filter(Boolean) ?? []) as QuestType[],
    locationId: params.get("loc") ?? undefined,
  };
  const [shown, setShown] = useState(PAGE);

  const index = getSearchIndex(data);
  const typesKey = filters.types?.join(",");
  const hits = useMemo(
    () => searchQuests(index, query, { showHidden: filters.showHidden, types: typesKey ? (typesKey.split(",") as QuestType[]) : [], locationId: filters.locationId }),
    [index, query, filters.showHidden, typesKey, filters.locationId],
  );

  const update = (q: string, f: SearchFilters) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (f.showHidden) p.set("hidden", "1");
    if (f.types?.length) p.set("types", f.types.join(","));
    if (f.locationId) p.set("loc", f.locationId);
    setParams(p, { replace: true });
    setShown(PAGE);
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
        onChange={(e) => update(e.target.value, filters)}
        placeholder={t("catalog.searchPlaceholder")}
        autoComplete="off"
        className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base outline-none focus:border-[var(--accent-text)]"
      />
      <FilterBar data={data} value={filters} onChange={(f) => update(query, f)} />
      <p className="mt-2 text-sm text-[var(--muted)]" aria-live="polite">
        {t("catalog.results", { count: hits.length })}
      </p>

      {hits.length === 0 ? (
        <p className="mt-4 text-[var(--muted)]">{t("catalog.noResults")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {hits.slice(0, shown).map((hit) => {
            const q = data.questById.get(hit.questId)!;
            return (
              <li key={hit.questId}>
                <Link to={questPath(hit.questId)} className="block py-3 hover:bg-[var(--surface)]">
                  <span className="font-medium">
                    {/* a collapsed variant group is named without the variant suffix («(Вез)») */}
                    {hit.variantIds && hit.variantIds.length > 1 ? q.title.replace(/\s*\([^()]*\)$/, "") : q.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]">
                    <Badge>{q.typeRaw ?? t(`questType.${q.type}`)}</Badge>
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
      {hits.length > shown && (
        <button
          type="button"
          onClick={() => setShown(shown + PAGE)}
          className="mt-3 min-h-12 w-full rounded-lg border border-[var(--border)] text-[var(--accent-text)]"
        >
          {t("common.more", { count: hits.length - shown })}
        </button>
      )}
    </>
  );
}
