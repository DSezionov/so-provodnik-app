import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** Registers the service worker and offers a new version (app + wiki data) when one is downloaded. */
export function UpdateBanner() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // A PWA left open for days would otherwise never notice a new deploy.
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS);
    },
  });
  if (!needRefresh) return null;
  const update = () => {
    // The plugin reloads only for updates it found itself; an update found by the periodic check would not.
    navigator.serviceWorker?.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    void updateServiceWorker(true);
  };
  return (
    <div role="status" className="border-b border-[var(--accent-text)] bg-accent/15 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-screen-sm flex-wrap items-center gap-2">
        <p className="flex-1">{t("update.title")}</p>
        <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-11 px-2 text-[var(--muted)]">
          {t("update.later")}
        </button>
        <button type="button" onClick={update} className="min-h-11 rounded-lg bg-accent px-4 font-medium text-black">
          {t("update.reload")}
        </button>
      </div>
    </div>
  );
}
