import { useTranslation } from "react-i18next";

import { entityName } from "../data/entities";
import type { StepPlace, WikiData } from "../data/types";
import type { PlanStep } from "../lib/plan";
import { qtyString, useNumberFormat } from "./ui";

const MAX_TEXT = 90;

function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s;
}

/**
 * One short label per stage, used everywhere (journal, card, route) so every quest shows its stages:
 * the in-game journal wording when the wiki has it, otherwise a summary of what to do.
 */
export function useStepLabel(data: WikiData) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  return (step: PlanStep): string => {
    const npc = step.npcId ? entityName(data.npcs, step.npcId) : "";
    if (step.source === "pickup") return t("step.pickup", { npc });
    if (step.source === "turnIn") return t("step.turnIn", { npc });
    if (step.stage) return step.stage;
    const kind = t(`stepKind.${step.kind}`);
    if (step.kills.length) return `${t("stepKind.kill")}: ${step.kills.map((k) => `${k.name} ${qtyString(t, fmt, k.qty)}`).join(", ")}`;
    if (step.items.length) return `${kind}: ${step.items.map((i) => `${entityName(data.items, i.itemId)} ${qtyString(t, fmt, i.qty)}`).join(", ")}${npc ? ` → ${npc}` : ""}`;
    if (npc) return `${kind}: ${npc}`;
    if (step.text) return firstSentence(step.text);
    return kind;
  };
}

export function placeText(data: WikiData, p: StepPlace): string {
  return `${entityName(data.locations, p.locationId)}${p.squares.length ? ` · ${p.squares.join(", ")}` : ""}`;
}
