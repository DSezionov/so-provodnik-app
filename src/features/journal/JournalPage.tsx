import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataGate } from "../../app/DataGate";
import { EmptyState, PageHeader } from "../../app/PageHeader";
import { entityName } from "../../data/entities";
import type { Quest, WikiData } from "../../data/types";
import type { CompletedQuest } from "../../db/db";
import { useJournalStore } from "../../db/journalStore";
import { JOURNAL_LIMIT, nextFromSameNpc, takenCount, type JournalEntry } from "../../lib/journal";
import { EntryCard } from "./EntryCard";
import { PasteAdd } from "./PasteAdd";
import { SearchAdd } from "./SearchAdd";

interface Toast {
  message: string;
  undo?: { entries: JournalEntry[]; completed: CompletedQuest[] };
  offers?: Quest[];
}

export function JournalPage() {
  const { t } = useTranslation();
  const load = useJournalStore((s) => s.load);
  const entries = useJournalStore((s) => s.entries);
  useEffect(() => {
    void load();
  }, [load]);
  const taken = takenCount(entries);
  const planned = entries.length - taken;

  return (
    <>
      <PageHeader
        title={t("nav.journal")}
        aside={
          <span className="text-right text-sm text-[var(--muted)] tabular-nums">
            <span aria-label={t("journal.counterLabel", { count: taken, limit: JOURNAL_LIMIT })}>{t("journal.counter", { count: taken, limit: JOURNAL_LIMIT })}</span>
            {planned > 0 && <span className="block">{t("journal.planned", { count: planned })}</span>}
          </span>
        }
      />
      <DataGate>{(data) => <Journal data={data} />}</DataGate>
    </>
  );
}

function Journal({ data }: { data: WikiData }) {
  const { t } = useTranslation();
  const { loaded, storageError, entries } = useJournalStore();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"search" | "paste">("search");
  const [toast, setToast] = useState<Toast | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!loaded) return null;

  const snapshot = () => {
    const s = useJournalStore.getState();
    return { entries: s.entries, completed: s.completed };
  };
  const notifyAdded = (asPlanned: number, added?: number) => {
    const parts = [];
    if (added !== undefined) parts.push(t("journal.pasteAdded", { count: added }));
    if (asPlanned > 0) parts.push(t("journal.addedAsPlanned", { count: asPlanned }));
    setToast(parts.length ? { message: parts.join(" ") } : null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) useJournalStore.getState().moveTo(String(active.id), String(over.id));
  };

  const known = entries.filter((e) => data.questById.has(e.questId));

  return (
    <>
      {storageError && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-600/50 p-3 text-sm">
          {t("journal.storageError")}
        </p>
      )}

      {adding ? (
        <section className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-3 flex items-center gap-2">
            <div role="tablist" className="grid flex-1 grid-cols-2 gap-1 rounded-lg bg-[var(--bg)] p-1">
              {(["search", "paste"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`min-h-11 rounded-md text-sm ${tab === k ? "bg-accent font-medium text-black" : "text-[var(--muted)]"}`}
                >
                  {t(k === "search" ? "journal.tabSearch" : "journal.tabPaste")}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setAdding(false)} className="min-h-11 px-2 text-[var(--accent-text)]">
              {t("journal.addDone")}
            </button>
          </div>
          {tab === "search" ? (
            <SearchAdd data={data} onAdded={(asPlanned) => notifyAdded(asPlanned)} />
          ) : (
            <PasteAdd data={data} onAdded={(added, asPlanned) => notifyAdded(asPlanned, added)} />
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mb-4 min-h-12 w-full rounded-lg border border-dashed border-[var(--accent-text)] font-medium text-[var(--accent-text)]"
        >
          + {t("journal.add")}
        </button>
      )}

      {known.length === 0 && !adding && <EmptyState>{t("journal.empty")}</EmptyState>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={known.map((e) => e.questId)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3">
            {known.map((entry, i) => {
              const quest = data.questById.get(entry.questId)!;
              return (
                <EntryCard
                  key={entry.questId}
                  data={data}
                  quest={quest}
                  entry={entry}
                  isFirst={i === 0}
                  isLast={i === known.length - 1}
                  onStatusRefused={() => setToast({ message: t("journal.statusLimit") })}
                  onRemove={() => {
                    const undo = snapshot();
                    useJournalStore.getState().remove(quest.id);
                    setToast({ message: t("journal.removedToast", { title: quest.title }), undo });
                  }}
                  onComplete={() => {
                    const undo = snapshot();
                    useJournalStore.getState().complete(quest.id);
                    const inJournal = new Set(useJournalStore.getState().entries.map((e) => e.questId));
                    setToast({
                      message: t("journal.completedToast", { title: quest.title }),
                      undo,
                      offers: nextFromSameNpc(quest, data.questById, inJournal),
                    });
                  }}
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

      {toast && <ToastBar data={data} toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}

function ToastBar({ data, toast, onClose }: { data: WikiData; toast: Toast; onClose: () => void }) {
  const { t } = useTranslation();
  const [added, setAdded] = useState<string[]>([]);
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-screen-sm px-3 pb-2"
    >
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-lg">
        <div className="flex items-start gap-2">
          <p className="flex-1 py-2">{toast.message}</p>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                useJournalStore.getState().restore(toast.undo!.entries, toast.undo!.completed);
                onClose();
              }}
              className="min-h-11 px-2 font-medium text-[var(--accent-text)]"
            >
              {t("journal.undo")}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="min-h-11 min-w-11 text-[var(--muted)]">
            ✕
          </button>
        </div>
        {toast.offers?.map((q) => (
          <div key={q.id} className="mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-2">
            <p className="flex-1">{t("journal.nextOffer", { npc: q.start ? entityName(data.npcs, q.start.npcId) : "", title: q.title })}</p>
            {added.includes(q.id) ? (
              <span className="text-[var(--muted)]">✓</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  useJournalStore.getState().add([q.id], "planned");
                  setAdded([...added, q.id]);
                }}
                className="min-h-11 shrink-0 rounded-lg border border-[var(--accent-text)] px-3 text-[var(--accent-text)]"
              >
                {t("journal.addPlanned")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
