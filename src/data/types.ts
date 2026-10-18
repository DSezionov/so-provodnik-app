// Data model of SPEC §4.2 — produced by scraper/provodnik_scraper/model.py.

export type Confidence = "wiki" | "parsed" | "unknown";
export type QuestType = "once" | "repeatable" | "board" | "other";
export type QuestState = "taken" | "done" | "failed" | "none";
export type StepKind = "talk" | "deliver" | "collect" | "kill" | "goto" | "other";

export interface NpcRef {
  npcId: string;
  locationId?: string;
  confidence: Confidence;
}

export type QuestEnd = ({ kind: "npc" } & NpcRef) | { kind: "auto"; confidence: "wiki" };

export interface VariantRef {
  groupId: string;
  label: string;
  confidence: Confidence;
}

export interface QuestLink {
  questId: string;
  states: QuestState[] | "unknown";
  statusRaw?: string;
}

export interface Qty {
  min: number;
  max?: number;
}

export interface StepPlace {
  locationId: string;
  squares: string[];
  confidence: Confidence;
}

export interface ItemReq {
  itemId: string;
  qty?: Qty;
  confidence: Confidence;
}

export interface KillReq {
  mobId?: string;
  name: string;
  qty?: Qty;
  confidence: Confidence;
}

export interface Step {
  order: number;
  kind: StepKind;
  text: string;
  npcId?: string;
  places: StepPlace[];
  items: ItemReq[];
  kills: KillReq[];
  confidence: Confidence;
}

export type RewardKind = "money" | "xp" | "rep" | "trade" | "group" | "item";

export interface Reward {
  kind: RewardKind;
  value: number | string;
  target?: string;
  note?: string;
  perUnit?: boolean;
}

export interface Quest {
  id: string;
  title: string;
  url: string;
  type: QuestType;
  periodHours?: number;
  hidden: boolean;
  variant?: VariantRef;
  start?: NpcRef;
  end?: QuestEnd;
  conditions: string[];
  prev: QuestLink[];
  prevLogic: "and" | "or" | "unknown";
  next: string[];
  journalStages: string[];
  steps: Step[];
  rewards: Reward[];
  description?: string;
  rawProcess: string;
  tip?: string;
  notes: string[];
  revision: number;
  updatedAt?: string;
}

export interface Entity {
  id: string;
  name: string;
  url: string;
  locationId?: string;
}

export interface Meta {
  version: string;
  source: string;
  license: string;
  sample: boolean;
  counts: Record<string, number>;
}

export interface WikiData {
  quests: Quest[];
  questById: Map<string, Quest>;
  npcs: Map<string, Entity>;
  locations: Map<string, Entity>;
  items: Map<string, Entity>;
  meta: Meta;
}
