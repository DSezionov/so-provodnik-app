import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Segmented } from "../../app/Segmented";
import { Badge, QtyText, questPath } from "../../app/ui";
import { entityName } from "../../data/entities";
import type { Quest, WikiData } from "../../data/types";
import { useJournalStore } from "../../db/journalStore";
import { rangeRequirements, type JournalEntry } from "../../lib/journal";

const smallButton =
  "flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm disabled:opacity-30";

export function EntryCard({
  data,
  quest,
  entry,
  isFirst,
  isLast,
  onComplete,
  onRemove,
  onStatusRefused,
}: {
  data: WikiData;
  quest: Quest;
  entry: JournalEntry;
  isFirst: boolean;
  isLast: boolean;
  onComplete: () => void;
  onRemove: () => void;
  onStatusRefused: () => void;
}) {
  const { t } = useTranslation();
  const { setStatus, setStep, setQty, moveBy } = useJournalStore.getState();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.questId });

  // Stage labels: the in-game journal wording when it lines up with the steps, else the step text.
  const stages = quest.journalStages.length === quest.steps.length ? quest.journalStages : [];
  const stepLabel = (i: number) => stages[i] || quest.steps[i].text.slice(0, 60) || t(`stepKind.${quest.steps[i].kind}`);
  const ranges = rangeRequirements(quest, entry.currentStep);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-[var(--surface)] p-3 ${isDragging ? "relative z-10 border-[var(--accent-text)] shadow-lg" : "border-[var(--border)]"}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("journal.dragHandle")}
          className="-ml-1 flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--muted)] active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <div className="min-w-0 flex-1">
          <Link to={questPath(quest.id)} className="font-medium leading-snug underline-offset-2 hover:underline">
            {quest.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]">
            <Badge>{t(`questType.${quest.type}`)}</Badge>
            {quest.hidden && <Badge tone="warn">{t("catalog.hidden")}</Badge>}
            {quest.start && <span>{entityName(data.npcs, quest.start.npcId)}</span>}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <p className="sr-only">{t("journal.statusLabel")}</p>
          <Segmented<JournalEntry["status"]>
            name={`status-${quest.id}`}
            value={entry.status}
            options={[
              { value: "taken", label: t("journal.statusTaken") },
              { value: "planned", label: t("journal.statusPlanned") },
            ]}
            onChange={(status) => {
              if (!setStatus(quest.id, status)) onStatusRefused();
            }}
          />
        </div>
        <button type="button" onClick={() => moveBy(quest.id, -1)} disabled={isFirst} aria-label={t("journal.moveUp")} className={smallButton}>
          ↑
        </button>
        <button type="button" onClick={() => moveBy(quest.id, 1)} disabled={isLast} aria-label={t("journal.moveDown")} className={smallButton}>
          ↓
        </button>
      </div>

      {quest.steps.length > 1 && (
        <label className="mt-3 block text-sm">
          <span className="text-[var(--muted)]">{t("journal.stepLabel")}</span>
          <select
            value={entry.currentStep}
            onChange={(e) => setStep(quest.id, Number(e.target.value), quest.steps.length)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2"
          >
            {quest.steps.map((s, i) => (
              <option key={s.order} value={s.order}>
                {t("journal.stepOption", { n: s.order, label: stepLabel(i) })}
              </option>
            ))}
          </select>
        </label>
      )}

      {ranges.length > 0 && (
        <fieldset className="mt-3 text-sm">
          <legend className="text-[var(--muted)]">{t("journal.qtyTitle")}</legend>
          {ranges.map((r) => (
            <label key={r.key} className="mt-1 flex items-center justify-between gap-2">
              <span className="min-w-0">
                {r.kind === "item" ? entityName(data.items, r.key) : r.key.replace(/_/g, " ")}{" "}
                <span className="text-[var(--muted)]">
                  (<QtyText qty={r.qty} />)
                </span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={r.qty.min}
                max={r.qty.max}
                value={entry.qtyOverride?.[r.key] ?? ""}
                placeholder={t("journal.qtyPlaceholder")}
                onChange={(e) => setQty(quest.id, r.key, e.target.value === "" ? undefined : Number(e.target.value))}
                className="min-h-11 w-20 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-right tabular-nums"
              />
            </label>
          ))}
        </fieldset>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onRemove} className={smallButton}>
          {t("journal.remove")}
        </button>
        <button type="button" onClick={onComplete} className={`${smallButton} border-[var(--accent-text)] text-[var(--accent-text)]`}>
          ✓ {t("journal.complete")}
        </button>
      </div>
    </li>
  );
}
