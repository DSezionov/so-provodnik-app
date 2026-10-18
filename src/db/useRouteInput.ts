import { useEffect, useMemo } from "react";

import type { WikiData } from "../data/types";
import type { RouteQuest } from "../lib/route";
import { useJournalStore } from "./journalStore";

/** Journal quests in priority order, joined with their wiki data — input of the route and the checklist. */
export function useRouteInput(data: WikiData): { loaded: boolean; input: RouteQuest[] } {
  const load = useJournalStore((s) => s.load);
  const loaded = useJournalStore((s) => s.loaded);
  const entries = useJournalStore((s) => s.entries);
  useEffect(() => {
    void load();
  }, [load]);
  const input = useMemo(
    () => entries.filter((e) => data.questById.has(e.questId)).map((entry) => ({ quest: data.questById.get(entry.questId)!, entry })),
    [entries, data],
  );
  return { loaded, input };
}
