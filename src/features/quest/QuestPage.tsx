import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { DataGate } from "../../app/DataGate";
import { placeText, useStepLabel } from "../../app/StepLabel";
import { AutoMark, Badge, QtyText, Section, questPath, useNumberFormat } from "../../app/ui";
import { entityName, titleFromId, wikiUrl } from "../../data/entities";
import type { NpcRef, Quest, QuestLink, Reward, WikiData } from "../../data/types";
import { questPlan, type PlanStep } from "../../lib/plan";

export function QuestPage() {
  const { id = "" } = useParams();
  return <DataGate>{(data) => <QuestCard data={data} id={id} />}</DataGate>;
}

function QuestCard({ data, id }: { data: WikiData; id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const quest = data.questById.get(id);

  const back = (
    <button
      type="button"
      // Opened directly by a link: there is no in-app history to go back to.
      onClick={() => (location.key === "default" ? navigate("/catalog") : navigate(-1))}
      className="-ml-2 mb-2 flex min-h-11 items-center px-2 text-[var(--accent-text)]">
      ← {t("quest.back")}
    </button>
  );
  if (!quest) {
    return (
      <>
        {back}
        <p>{t("quest.notFound")}</p>
        <QuestLinkText data={data} id={id} />
      </>
    );
  }

  return (
    <article>
      {back}
      <h1 className="text-xl font-semibold leading-snug">{quest.title}</h1>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{quest.typeRaw ?? t(`questType.${quest.type}`)}</Badge>
        {quest.periodHours ? <Badge>{t("quest.period", { hours: quest.periodHours })}</Badge> : null}
        {quest.hidden && <Badge tone="warn">{t("catalog.hidden")}</Badge>}
      </div>
      {quest.hidden && <p className="mt-2 text-sm text-[var(--muted)]">{t("quest.hiddenNote")}</p>}

      <VariantSwitcher data={data} quest={quest} />

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[var(--muted)]">{t("quest.start")}</dt>
        <dd>{quest.start ? <NpcText data={data} npc={quest.start} /> : "—"}</dd>
        <dt className="text-[var(--muted)]">{t("quest.end")}</dt>
        <dd>{quest.end ? quest.end.kind === "auto" ? t("quest.autoEnd") : <NpcText data={data} npc={quest.end} /> : "—"}</dd>
      </dl>

      {quest.conditions.length > 0 && (
        <Section title={t("quest.conditions")}>
          <ul className="list-disc space-y-1 rounded-lg border border-amber-600/50 bg-amber-500/5 py-2 pl-7 pr-3">
            {quest.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("quest.prev")}>
        <PrevList data={data} quest={quest} />
      </Section>
      <Section title={t("quest.next")}>
        {quest.next.length === 0 ? (
          <p className="text-[var(--muted)]">{t("quest.none")}</p>
        ) : (
          <ul className="space-y-1">
            {quest.next.map((n) => (
              <li key={n}>
                <QuestLinkText data={data} id={n} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {quest.description && (
        <Section title={t("quest.description")}>
          <p className="leading-relaxed">{quest.description}</p>
        </Section>
      )}

      <Section title={t("quest.steps")}>
        <StepList data={data} quest={quest} />
      </Section>

      <Section title={t("quest.rawProcess")}>
        <p className="whitespace-pre-line rounded-lg bg-[var(--surface)] p-3 text-sm leading-relaxed">{quest.rawProcess}</p>
      </Section>

      {quest.tip && (
        <Section title={t("quest.tip")}>
          <p className="leading-relaxed">{quest.tip}</p>
        </Section>
      )}
      {quest.notes.length > 0 && (
        <Section title={t("quest.notes")}>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {quest.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("quest.rewards")}>
        <Rewards data={data} rewards={quest.rewards} />
      </Section>

      <a href={quest.url} target="_blank" rel="noreferrer" className="mt-6 flex min-h-12 items-center text-[var(--accent-text)] underline underline-offset-2">
        {t("quest.openWiki")} ↗
      </a>
    </article>
  );
}

function NpcText({ data, npc }: { data: WikiData; npc: NpcRef }) {
  return (
    <>
      {entityName(data.npcs, npc.npcId)}
      {npc.locationId && <span className="text-[var(--muted)]"> · {entityName(data.locations, npc.locationId)}</span>}
    </>
  );
}

/** Internal link if the quest is in the data, otherwise a link to its wiki page. */
function QuestLinkText({ data, id }: { data: WikiData; id: string }) {
  const cls = "inline-flex min-h-9 items-center text-[var(--accent-text)] underline underline-offset-2";
  if (data.questById.has(id)) {
    return (
      <Link to={questPath(id)} className={cls}>
        {data.questById.get(id)!.title}
      </Link>
    );
  }
  return (
    <a href={wikiUrl(id)} target="_blank" rel="noreferrer" className={cls}>
      {titleFromId(id)} ↗
    </a>
  );
}

function VariantSwitcher({ data, quest }: { data: WikiData; quest: Quest }) {
  const { t } = useTranslation();
  if (!quest.variant) return null;
  const groupId = quest.variant.groupId;
  const variants = data.quests.filter((q) => q.variant?.groupId === groupId);
  if (variants.length < 2) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-sm text-[var(--muted)]">{t("quest.variant")}</p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <Link
            key={v.id}
            to={questPath(v.id)}
            replace
            aria-current={v.id === quest.id ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg border px-3 text-sm ${
              v.id === quest.id ? "border-[var(--accent-text)] text-[var(--accent-text)]" : "border-[var(--border)]"
            }`}
          >
            {v.variant!.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function stateText(t: (k: string) => string, link: QuestLink): string {
  if (link.states === "unknown") return link.statusRaw ?? t("questState.unknown");
  return link.states.map((s) => t(`questState.${s}`)).join(" / ");
}

function PrevList({ data, quest }: { data: WikiData; quest: Quest }) {
  const { t } = useTranslation();
  if (quest.prev.length === 0) return <p className="text-[var(--muted)]">{t("quest.none")}</p>;
  return (
    <>
      <ul className="space-y-1">
        {quest.prev.map((p) => (
          <li key={p.questId} className="flex flex-wrap items-center gap-x-2">
            <QuestLinkText data={data} id={p.questId} />
            <span className="text-sm text-[var(--muted)]" title={p.statusRaw}>
              [{stateText(t, p)}]
            </span>
          </li>
        ))}
      </ul>
      {quest.prev.length > 1 && <p className="mt-2 text-sm text-[var(--muted)]">{t(`quest.prevLogic.${quest.prevLogic}`)}</p>}
    </>
  );
}

function StepList({ data, quest }: { data: WikiData; quest: Quest }) {
  const { t } = useTranslation();
  const label = useStepLabel(data);
  const plan = questPlan(quest);
  if (plan.length === 0) return <p className="text-[var(--muted)]">{t("quest.noSteps")}</p>;
  const anyParsed = plan.some((s) => s.confidence === "parsed");
  return (
    <>
      {anyParsed && <p className="mb-3 text-sm text-[var(--muted)]">{t("quest.stepsParsed")}</p>}
      <ol className="space-y-3">
        {plan.map((step, i) => {
          const title = label(step);
          return (
            <li key={i} className="rounded-lg border border-[var(--border)] p-3">
              <p className="font-medium">
                {i + 1}. {title}
              </p>
              {step.text && step.text !== title && <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{step.text}</p>}
              <StepDetails data={data} step={step} />
            </li>
          );
        })}
      </ol>
    </>
  );
}

function StepDetails({ data, step }: { data: WikiData; step: PlanStep }) {
  const { t } = useTranslation();
  const npc = step.npcId ? ` · ${entityName(data.npcs, step.npcId)}` : "";
  return (
    <div className="mt-2 space-y-1 text-sm">
      {step.places.length === 0 && <p className="text-amber-700 dark:text-amber-300">⚠ {t("quest.locationUnknown")}</p>}
      {step.places.length === 1 && (
        <p>
          📍 {placeText(data, step.places[0])}
          {npc}
        </p>
      )}
      {step.places.length > 1 && (
        <div>
          <p>📍 {t("quest.anyOf")}</p>
          <ul className="list-disc pl-6">
            {step.places.map((p) => (
              <li key={p.locationId}>{placeText(data, p)}</li>
            ))}
          </ul>
        </div>
      )}
      {step.items.length > 0 && (
        <div>
          <p className="text-[var(--muted)]">{t("quest.items")}:</p>
          <ul className="pl-2">
            {step.items.map((it) => (
              <li key={it.itemId} className="flex flex-wrap items-center gap-x-2">
                <span>• {entityName(data.items, it.itemId)}</span>
                <span className="tabular-nums">
                  <QtyText qty={it.qty} />
                </span>
                {it.confidence === "parsed" && <AutoMark />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {step.kills.length > 0 && (
        <div>
          <p className="text-[var(--muted)]">{t("quest.kills")}:</p>
          <ul className="pl-2">
            {step.kills.map((k) => (
              <li key={k.mobId ?? k.name} className="flex flex-wrap items-center gap-x-2">
                <span>• {k.name}</span>
                <span className="tabular-nums">
                  <QtyText qty={k.qty} />
                </span>
                {k.confidence === "parsed" && <AutoMark />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Rewards({ data, rewards }: { data: WikiData; rewards: Reward[] }) {
  const { t } = useTranslation();
  const fmt = useNumberFormat();
  if (rewards.length === 0) return <p className="text-[var(--muted)]">{t("quest.noRewards")}</p>;
  const num = (v: number | string) => (typeof v === "number" ? fmt(v) : v);
  const signed = (v: number | string) => (typeof v === "number" && v > 0 ? `+${fmt(v)}` : num(v));
  const line = (r: Reward) => {
    switch (r.kind) {
      case "money":
        return t("reward.money", { value: num(r.value) });
      case "xp":
        return t("reward.xp", { value: num(r.value) });
      case "group":
        return t("reward.group", { value: num(r.value) });
      case "item":
        return `${entityName(data.items, r.target ?? "")} × ${num(r.value)}`;
      default:
        return `${titleFromId(r.target ?? "")}: ${signed(r.value)} ${t(`reward.${r.kind}`)}`;
    }
  };
  return (
    <>
      <ul className="space-y-1">
        {rewards.map((r, i) => (
          <li key={i}>
            {line(r)}
            {r.note && <span className="text-sm text-[var(--muted)]"> ({r.note})</span>}
          </li>
        ))}
      </ul>
      {rewards.some((r) => r.perUnit) && <p className="mt-2 text-sm text-[var(--muted)]">{t("quest.perUnit")}</p>}
    </>
  );
}
