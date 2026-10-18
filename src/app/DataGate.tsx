import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { WikiData } from "../data/types";
import { useDataStore } from "../data/store";
import { useWikiData } from "../data/useWikiData";

/** Renders children once wiki data is loaded; shows loading / error states otherwise. */
export function DataGate({ children }: { children: (data: WikiData) => ReactNode }) {
  const { t } = useTranslation();
  const state = useWikiData();
  const load = useDataStore((s) => s.load);
  if (state.status === "ready") return <>{children(state.data)}</>;
  if (state.status === "error") {
    return (
      <div role="alert">
        <p className="text-red-500">{t("data.error", { error: state.error })}</p>
        <button type="button" onClick={() => void load()} className="mt-3 min-h-12 rounded-lg border border-[var(--border)] px-4">
          {t("data.retry")}
        </button>
      </div>
    );
  }
  return <p className="text-[var(--muted)]">{t("data.loading")}</p>;
}
