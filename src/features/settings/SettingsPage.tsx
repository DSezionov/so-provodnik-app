import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageHeader } from "../../app/PageHeader";
import { Segmented } from "../../app/Segmented";
import { useTheme, type Theme } from "../../app/theme";
import { LANGUAGES, type Language } from "../../i18n";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useTheme();
  const language = (i18n.resolvedLanguage ?? "ru") as Language;

  return (
    <>
      <PageHeader title={t("nav.settings")} />
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">{t("settings.language")}</h2>
        <Segmented<Language>
          name="language"
          value={language}
          options={LANGUAGES.map((lng) => ({ value: lng, label: t(`languages.${lng}`) }))}
          onChange={(lng) => void i18n.changeLanguage(lng)}
        />
      </section>
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-[var(--muted)]">{t("settings.theme")}</h2>
        <Segmented<Theme>
          name="theme"
          value={theme}
          options={[
            { value: "dark", label: t("settings.themeDark") },
            { value: "light", label: t("settings.themeLight") },
          ]}
          onChange={setTheme}
        />
      </section>
      <Link to="/about" className="flex min-h-12 items-center text-[var(--accent-text)] underline underline-offset-2">
        {t("nav.about")}
      </Link>
    </>
  );
}
