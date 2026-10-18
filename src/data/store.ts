import { create } from "zustand";

import type { Entity, Meta, Quest, WikiData } from "./types";

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: WikiData }
  | { status: "error"; error: string };

interface DataStore {
  state: LoadState;
  load: () => Promise<void>;
}

async function fetchJson<T>(name: string): Promise<T> {
  // Relative to the app base so it works under the GitHub Pages sub-path; precached by the service worker.
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

const byId = (list: Entity[]) => new Map(list.map((e) => [e.id, e]));

export const useDataStore = create<DataStore>((set, get) => ({
  state: { status: "idle" },
  load: async () => {
    if (get().state.status !== "idle") return;
    set({ state: { status: "loading" } });
    try {
      const [q, n, l, i, meta] = await Promise.all([
        fetchJson<{ quests: Quest[] }>("quests.json"),
        fetchJson<{ npcs: Entity[] }>("npcs.json"),
        fetchJson<{ locations: Entity[] }>("locations.json"),
        fetchJson<{ items: Entity[] }>("items.json"),
        fetchJson<Meta>("meta.json"),
      ]);
      set({
        state: {
          status: "ready",
          data: {
            quests: q.quests,
            questById: new Map(q.quests.map((x) => [x.id, x])),
            npcs: byId(n.npcs),
            locations: byId(l.locations),
            items: byId(i.items),
            meta,
          },
        },
      });
    } catch (e) {
      set({ state: { status: "error", error: e instanceof Error ? e.message : String(e) } });
    }
  },
}));
