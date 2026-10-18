import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "../../app/PageHeader";

const JOURNAL_LIMIT = 50; // same as in the game

export function JournalPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t("nav.journal")}
        aside={<span className="text-sm text-[var(--muted)] tabular-nums">{t("journal.counter", { count: 0, limit: JOURNAL_LIMIT })}</span>}
      />
      <EmptyState>{t("journal.empty")}</EmptyState>
    </>
  );
}
