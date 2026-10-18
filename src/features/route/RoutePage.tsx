import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "../../app/PageHeader";

export function RoutePage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.route")} />
      <EmptyState>{t("route.empty")}</EmptyState>
    </>
  );
}
