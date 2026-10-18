import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";

/** Shown instead of a blank page when rendering fails. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="mx-auto max-w-screen-sm p-4">
      <h1 className="mb-2 text-xl font-semibold">{t("error.title")}</h1>
      <p className="mb-4 text-[var(--muted)]">{t("error.text")}</p>
      <pre className="mb-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-[var(--surface)] p-3 text-xs">{message}</pre>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-12 w-full rounded-lg bg-accent font-medium text-black"
      >
        {t("error.reload")}
      </button>
    </div>
  );
}
