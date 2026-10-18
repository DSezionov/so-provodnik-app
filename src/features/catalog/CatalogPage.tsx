import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "../../app/PageHeader";

export function CatalogPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.catalog")} />
      <EmptyState>{t("catalog.empty")}</EmptyState>
    </>
  );
}
