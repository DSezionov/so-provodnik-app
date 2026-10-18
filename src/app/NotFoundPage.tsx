import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageHeader } from "./PageHeader";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("notFound.title")} />
      <Link to="/" className="text-[var(--accent-text)] underline underline-offset-2">
        {t("notFound.back")}
      </Link>
    </>
  );
}
