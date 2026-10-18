import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { DataGate } from "../../app/DataGate";
import { EmptyState, PageHeader } from "../../app/PageHeader";
import { placeText, useStepLabel } from "../../app/StepLabel";
import { questPath } from "../../app/ui";
import { entityName } from "../../data/entities";
import type { WikiData } from "../../data/types";
import type { CompletedQuest } from "../../db/db";
import { useJournalStore } from "../../db/journalStore";
import { useRouteInput } from "../../db/useRouteInput";
import type { JournalEntry } from "../../lib/journal";
import { questPlan } from "../../lib/plan";
import { buildRoute, type RouteAction, type RouteBlock, type RouteStop } from "../../lib/route";

const TOAST_MS = 8000;

interface Undo {
  message: string;
  entries: JournalEntry[];
  completed: CompletedQuest[];
}

export function RoutePage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.route")} />
      <DataGate>{(data) => <Route data={data} />}</DataGate>
    </>
  );
}

/** Unique locations in the order the route visits them. */
function visitOrder(blocks: RouteBlock[]): string[] {
  return [...new Set(blocks.map((b) => b.locationId).filter((x): x is string => !!x))];
}

function Route({ data }: { data: WikiData }) {
  const { t } = useTranslation();
  const { loaded, input } = useRouteInput(data);
  const locationOrder = useJournalStore((s) => s.locationOrder);
  const [undo, setUndo] = useState<Undo | null>(null);
  const blocks = useMemo(() => buildRoute(input, { locationOrder }), [input, locationOrder]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  if (!loaded) return null;
  if (input.length === 0) {
    return (
      <EmptyState>
        {t("route.empty")}{" "}
        <Link to="/" className="text-[var(--accent-text)] underline underline-offset-2">
          {t("nav.journal")}
        </Link>
      </EmptyState>
    );
  }

  const order = visitOrder(blocks);
  const move = (loc: string, delta: -1 | 1) => {
    const i = order.indexOf(loc);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    useJournalStore.getState().setLocationOrder(next);
  };
  const stops = blocks.reduce((n, b) => n + b.stops.length, 0);
  // Special conditions are shown once per quest, on its first action in the route.
  const firstActions = new Set<RouteAction>();
  const seen = new Set<string>();
  for (const b of blocks)
    for (const st of b.stops)
      for (const a of st.actions)
        if (!seen.has(a.questId)) {
          seen.add(a.questId);
          firstActions.add(a);
        }

  return (
    <>
      <p className="mb-3 text-sm text-[var(--muted)]">{t("route.summary", { stops, locations: order.length })}</p>
      {locationOrder.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">{t("route.manual")}</span>
          <button
            type="button"
            onClick={() => useJournalStore.getState().setLocationOrder([])}
            className="min-h-11 text-[var(--accent-text)] underline underline-offset-2"
          >
            {t("route.reset")}
          </button>
        </div>
      )}

      <ol className="space-y-5">
        {blocks.map((block, bi) => (
          <li key={`${block.locationId ?? "unknown"}-${bi}`}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="flex-1 text-lg font-semibold">
                {block.locationId ? entityName(data.locations, block.locationId) : `⚠ ${t("route.unknownLocation")}`}
              </h2>
              {block.locationId && order.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => move(block.locationId!, -1)}
                    disabled={order.indexOf(block.locationId) === 0}
                    aria-label={t("route.earlier")}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--border)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(block.locationId!, 1)}
                    disabled={order.indexOf(block.locationId) === order.length - 1}
                    aria-label={t("route.later")}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[var(--border)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                </>
              )}
            </div>
            {!block.locationId && <p className="mb-2 text-sm text-[var(--muted)]">{t("route.unknownHint")}</p>}
            <ol className="space-y-2">
              {block.stops.map((stop, si) => (
                <StopCard key={`${stop.key}-${si}`} data={data} stop={stop} onDone={setUndo} firstActions={firstActions} />
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {undo && (
        <div role="status" className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-screen-sm px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-lg">
            <p className="flex-1">{undo.message}</p>
            <button
              type="button"
              onClick={() => {
                useJournalStore.getState().restore(undo.entries, undo.completed);
                setUndo(null);
              }}
              className="min-h-11 px-2 font-medium text-[var(--accent-text)]"
            >
              {t("journal.undo")}
            </button>
            <button type="button" onClick={() => setUndo(null)} aria-label={t("common.close")} className="min-h-11 min-w-11 text-[var(--muted)]">
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StopCard({ data, stop, onDone, firstActions }: { data: WikiData; stop: RouteStop; onDone: (u: Undo) => void; firstActions: Set<RouteAction> }) {
  const { t } = useTranslation();
  const label = useStepLabel(data);
  const title = stop.hunt
    ? t("step.hunt", { name: stop.hunt })
    : stop.npcId
      ? entityName(data.npcs, stop.npcId)
      : stop.squares.length
        ? t("step.point", { squares: stop.squares.join(", ") })
        : label(stop.actions[0].step);

  const complete = (a: RouteAction) => {
    const s = useJournalStore.getState();
    const snapshot = { entries: s.entries, completed: s.completed };
    const quest = data.questById.get(a.questId)!;
    if (!s.completeStep(a.questId, a.planStep, questPlan(quest).length)) {
      onDone({ message: t("journal.statusLimit"), ...snapshot });
      return;
    }
    onDone({ message: t("route.doneToast", { label: label(a.step) }), ...snapshot });
  };

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="font-medium">
        {title}
        {stop.squares.length > 0 && !stop.hunt && stop.npcId && <span className="font-normal text-[var(--muted)]"> · {stop.squares.join(", ")}</span>}
      </p>
      <ul className="mt-1 space-y-1">
        {stop.actions.map((a) => {
          const quest = data.questById.get(a.questId)!;
          return (
            <li key={`${a.questId}-${a.planStep}`}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => complete(a)}
                  aria-label={t("route.stepDone")}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--accent-text)]"
                />
                <span className="text-sm leading-snug">
                  {label(a.step)}
                  <Link to={questPath(quest.id)} className="block text-xs text-[var(--muted)] underline-offset-2 hover:underline">
                    {quest.title}
                  </Link>
                  {a.alternatives.length > 0 && (
                    <span className="block text-xs text-[var(--muted)]">
                      {t("route.alternatives", { places: a.alternatives.map((p) => placeText(data, p)).join("; ") })}
                    </span>
                  )}
                  {quest.conditions.length > 0 && firstActions.has(a) && (
                    <span className="block text-xs text-amber-700 dark:text-amber-300">
                      ⚠ {t("route.conditions")}: {quest.conditions.join("; ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
