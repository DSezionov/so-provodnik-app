import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { ChevronIcon } from "../../app/icons";
import { placeText, useStepLabel } from "../../app/StepLabel";
import { Badge, QtyText, questPath } from "../../app/ui";
import { entityName } from "../../data/entities";
import type { Quest, WikiData } from "../../data/types";
import { useJournalStore } from "../../db/journalStore";
import { rangeRequirements, type JournalEntry } from "../../lib/journal";
import { pickupStep, questPlan, type PlanStep } from "../../lib/plan";

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
  const [open, setOpen] = useState(false);
  const label = useStepLabel(data);
  const { setStatus, setStep, setQty, moveBy } = useJournalStore.getState();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.questId });

  const plan = questPlan(quest);
  const planned = entry.status === "planned";
  const pickup = planned ? pickupStep(quest) : null;
  const done = Math.min(entry.currentStep - 1, plan.length); // completed plan steps
  const allDone = !planned && done >= plan.length;
  const next: PlanStep | undefined = pickup ?? plan[done];
  const total = plan.length + (pickup ? 1 : 0); // a planned quest's «взять» counts as its first stage
  const ranges = rangeRequirements(quest, entry.currentStep);

  // Stage checkbox i (1-based): checking marks it and all previous ones, unchecking reopens it.
  const toggleStage = (i: number) => setStep(quest.id, i <= done ? i : i + 1, plan.length);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-[var(--surface)] ${isDragging ? "relative z-10 border-[var(--accent-text)] shadow-lg" : "border-[var(--border)]"}`}
    >
      <div className="flex items-start gap-1 p-2 pr-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("journal.dragHandle")}
          className="flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--muted)] active:cursor-grabbing"
        >
          ⋮⋮
        </button>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-w-0 flex-1 py-1 text-left">
          <span className="block font-medium leading-snug">{quest.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]">
            {planned && <Badge tone="accent">{t("journal.statusPlanned")}</Badge>}
            <Badge>{quest.typeRaw ?? t(`questType.${quest.type}`)}</Badge>
            {quest.start && <span>{entityName(data.npcs, quest.start.npcId)}</span>}
          </span>
          {/* progress + what is next, visible without expanding */}
          <span className="mt-2 block text-sm">
            <span className="text-[var(--muted)]">{t("step.progress", { n: Math.min(done + 1, total), total })}</span>
            <span className="mt-1 block h-1 overflow-hidden rounded bg-[var(--border)]">
              <span className="block h-full bg-accent" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </span>
            {allDone ? (
              <span className="mt-1 block text-[var(--accent-text)]">✓ {t("step.allDone")}</span>
            ) : (
              next && (
                <span className="mt-1 block">
                  → {label(next)}
                  {next.places[0] && <span className="text-[var(--muted)]"> · 📍 {placeText(data, next.places[0])}</span>}
                </span>
              )
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={t(open ? "journal.collapse" : "journal.expand")}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[var(--muted)]"
        >
          <ChevronIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] p-3">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-[var(--muted)]">{t("step.stages")}</legend>
            <ol className="space-y-1">
              {pickup && (
                <StageRow
                  checked={false}
                  label={label(pickup)}
                  place={pickup.places[0] ? placeText(data, pickup.places[0]) : undefined}
                  onToggle={() => {
                    if (!setStatus(quest.id, "taken")) onStatusRefused();
                  }}
                />
              )}
              {plan.map((s, i) => (
                <StageRow
                  key={i}
                  checked={i < done}
                  current={!pickup && i === done}
                  label={`${i + 1}. ${label(s)}`}
                  place={s.places.length ? s.places.map((p) => placeText(data, p)).join(" / ") : undefined}
                  onToggle={() => toggleStage(i + 1)}
                />
              ))}
            </ol>
            {plan.length > 1 && <p className="mt-1 text-xs text-[var(--muted)]">{t("step.stagesHint")}</p>}
          </fieldset>

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

          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("journal.statusLabel")}>
            {(["taken", "planned"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={entry.status === s}
                onClick={() => {
                  if (!setStatus(quest.id, s)) onStatusRefused();
                }}
                className={`min-h-11 rounded-full border px-4 text-sm ${
                  entry.status === s ? "border-[var(--accent-text)] bg-accent/15 text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {t(s === "taken" ? "journal.statusTaken" : "journal.statusPlanned")}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => moveBy(quest.id, -1)} disabled={isFirst} aria-label={t("journal.moveUp")} className={smallButton}>
              ↑
            </button>
            <button type="button" onClick={() => moveBy(quest.id, 1)} disabled={isLast} aria-label={t("journal.moveDown")} className={smallButton}>
              ↓
            </button>
            <Link to={questPath(quest.id)} className={smallButton}>
              {t("journal.openCard")}
            </Link>
            <span className="flex-1" />
            <button type="button" onClick={onRemove} className={smallButton}>
              {t("journal.remove")}
            </button>
            <button type="button" onClick={onComplete} className={`${smallButton} ${allDone ? "bg-accent font-medium text-black" : "border-[var(--accent-text)] text-[var(--accent-text)]"}`}>
              ✓ {t("journal.complete")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StageRow({ checked, current, label, place, onToggle }: { checked: boolean; current?: boolean; label: string; place?: string; onToggle: () => void }) {
  return (
    <li>
      <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-1 py-2 ${current ? "bg-accent/10" : ""}`}>
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 size-5 shrink-0 accent-[var(--accent-text)]" />
        <span className={`text-sm leading-snug ${checked ? "text-[var(--muted)] line-through" : ""}`}>
          {label}
          {place && <span className="block text-xs text-[var(--muted)] no-underline">📍 {place}</span>}
        </span>
      </label>
    </li>
  );
}
