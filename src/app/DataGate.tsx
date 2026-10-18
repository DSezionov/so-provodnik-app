import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { WikiData } from "../data/types";
import { useWikiData } from "../data/useWikiData";

/** Renders children once wiki data is loaded; shows loading / error states otherwise. */
export function DataGate({ children }: { children: (data: WikiData) => ReactNode }) {
  const { t } = useTranslation();
  const state = useWikiData();
  if (state.status === "ready") return <>{children(state.data)}</>;
  if (state.status === "error") {
    return <p role="alert" className="text-red-500">{t("data.error", { error: state.error })}</p>;
  }
  return <p className="text-[var(--muted)]">{t("data.loading")}</p>;
}
