import { useTranslation } from "react-i18next";

import { PageHeader } from "../../app/PageHeader";

const WIKI_URL = "https://so-wiki.ru";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/deed.ru";
const REPO_URL = "https://github.com/DSezionov/so-provodnik-app";

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-[var(--accent-text)] underline underline-offset-2">
      {children}
    </a>
  );
}

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("nav.about")} />
      <div className="space-y-3 leading-relaxed">
        <p>{t("about.intro")}</p>
        <h2 className="pt-2 font-semibold">{t("about.dataTitle")}</h2>
        <p>{t("about.dataSource")}</p>
        <p>{t("about.dataHonesty")}</p>
        <p className="text-[var(--muted)]">{t("about.languageNote")}</p>
        <div>
          <ExternalLink href={WIKI_URL}>{t("about.openWiki")}</ExternalLink>
          <ExternalLink href={LICENSE_URL}>{t("about.license")}</ExternalLink>
          <ExternalLink href={REPO_URL}>{t("about.repo")}</ExternalLink>
        </div>
      </div>
    </>
  );
}
