import { useEffect } from "react";

import { useDataStore } from "./store";

/** Wiki data (quests + dictionaries), loaded once per session. */
export function useWikiData() {
  const state = useDataStore((s) => s.state);
  const load = useDataStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return state;
}
