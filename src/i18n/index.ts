import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import ru from "./ru.json";
import uk from "./uk.json";

export const LANGUAGES = ["ru", "uk", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const resources = { ru: { translation: ru }, uk: { translation: uk }, en: { translation: en } };

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...LANGUAGES],
    nonExplicitSupportedLngs: true, // "uk-UA" → "uk"
    load: "languageOnly",
    fallbackLng: "ru",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "provodnik.lang",
      caches: ["localStorage"],
    },
  });

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};
syncHtmlLang(i18n.resolvedLanguage ?? "ru");
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
