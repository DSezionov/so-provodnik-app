import { describe, expect, it } from "vitest";

import en from "./en.json";
import ru from "./ru.json";
import uk from "./uk.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});
}

const locales = { ru: flatten(ru), uk: flatten(uk), en: flatten(en) };
const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe("i18n resources", () => {
  const reference = Object.keys(locales.ru).sort();

  it.each(["uk", "en"] as const)("%s has exactly the same keys as ru", (lng) => {
    expect(Object.keys(locales[lng]).sort()).toEqual(reference);
  });

  it.each(["ru", "uk", "en"] as const)("%s has no empty strings", (lng) => {
    expect(Object.entries(locales[lng]).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it.each(["uk", "en"] as const)("%s keeps the same interpolation placeholders as ru", (lng) => {
    const mismatched = reference.filter((key) => placeholders(locales[lng][key]).join() !== placeholders(locales.ru[key]).join());
    expect(mismatched).toEqual([]);
  });
});
