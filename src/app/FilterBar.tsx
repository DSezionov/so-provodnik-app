import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { entityName } from "../data/entities";
import type { QuestType, WikiData } from "../data/types";
import type { SearchFilters } from "../lib/search";

const TYPES: QuestType[] = ["once", "repeatable", "board", "other"];

/** Type chips, location select and «show hidden» — shared by the catalog and «add to journal». */
export function FilterBar({ data, value, onChange }: { data: WikiData; value: SearchFilters; onChange: (next: SearchFilters) => void }) {
  const { t } = useTranslation();
  const types = value.types ?? [];
  const presentTypes = useMemo(() => TYPES.filter((type) => data.quests.some((q) => q.type === type)), [data]);
  const locations = useMemo(
    () => [...data.locations.values()].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [data],
  );
  const toggleType = (type: QuestType) =>
    onChange({ ...value, types: types.includes(type) ? types.filter((x) => x !== type) : [...types, type] });
  const active = types.length > 0 || !!value.locationId || !!value.showHidden;

  return (
    <div className="mt-2 space-y-2">
      <div role="group" aria-label={t("filters.type")} className="flex flex-wrap gap-2">
        {presentTypes.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={types.includes(type)}
            onClick={() => toggleType(type)}
            className={`min-h-10 rounded-full border px-3 text-sm ${
              types.includes(type) ? "border-[var(--accent-text)] bg-accent/15 text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {t(`questType.${type}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="sr-only">{t("filters.location")}</span>
          <select
            value={value.locationId ?? ""}
            onChange={(e) => onChange({ ...value, locationId: e.target.value || undefined })}
            className="min-h-11 w-full min-w-40 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2"
          >
            <option value="">{t("filters.anyLocation")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {entityName(data.locations, l.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!value.showHidden}
            onChange={(e) => onChange({ ...value, showHidden: e.target.checked })}
            className="size-5 accent-[var(--accent-text)]"
          />
          {t("catalog.showHidden")}
        </label>
        {active && (
          <button type="button" onClick={() => onChange({})} className="min-h-11 text-sm text-[var(--accent-text)] underline underline-offset-2">
            {t("filters.reset")}
          </button>
        )}
      </div>
    </div>
  );
}
