import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "../../app/PageHeader";

export function ChecklistPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.checklist")} />
      <EmptyState>{t("checklist.empty")}</EmptyState>
    </>
  );
}
