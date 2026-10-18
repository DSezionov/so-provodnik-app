import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";

import { CatalogIcon, ChecklistIcon, JournalIcon, RouteIcon, SettingsIcon } from "./icons";

const NAV = [
  { to: "/", key: "nav.journal", Icon: JournalIcon, end: true },
  { to: "/route", key: "nav.route", Icon: RouteIcon, end: false },
  { to: "/checklist", key: "nav.checklist", Icon: ChecklistIcon, end: false },
  { to: "/catalog", key: "nav.catalog", Icon: CatalogIcon, end: false },
] as const;

export function Layout() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("app.name");
  }, [t]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link to="/" className="flex min-h-12 items-center gap-2 font-semibold">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-7 rounded-md" />
          {t("app.name")}
        </Link>
        <Link
          to="/settings"
          aria-label={t("nav.settings")}
          className="-mr-2 flex size-12 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--text)]"
        >
          <SettingsIcon />
        </Link>
      </header>

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>

      <footer className="px-4 pb-24 text-center text-xs text-[var(--muted)]">
        <Link to="/about" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
          {t("footer.attribution")}
        </Link>
      </footer>

      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-screen-sm grid-cols-4">
          {NAV.map(({ to, key, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    isActive ? "text-[var(--accent-text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`
                }
              >
                <Icon />
                {t(key)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
