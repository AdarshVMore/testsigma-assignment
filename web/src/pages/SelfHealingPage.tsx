import { useEffect } from "react";
import { useSnapshot } from "../api";
import { CandidateTable } from "../components/self-healing/CandidateTable";
import { DomSnippet } from "../components/self-healing/DomSnippet";
import { FingerprintPanel } from "../components/self-healing/FingerprintPanel";
import { EmptyState } from "../components/common/EmptyState";
import { MonoValue } from "../components/common/MonoValue";
import { SectionCard } from "../components/common/SectionCard";
import { StatusBadge, toneForStatus } from "../components/common/StatusBadge";
import { navigate } from "../router";
import type { HealingScenario } from "../types";
import "./SelfHealingPage.css";

function ScenarioRail({ scenarios, activeId }: { scenarios: HealingScenario[]; activeId: string }) {
  return (
    <div className="healing-rail">
      {scenarios.map((s) => (
        <button
          key={s.id}
          className={`healing-rail__item ${s.id === activeId ? "healing-rail__item--active" : ""}`}
          onClick={() => navigate({ name: "self-healing", scenarioId: s.id })}
        >
          <StatusBadge tone={toneForStatus(s.outcome)} label={s.outcome} />
          <span className="healing-rail__title truncate">{s.title}</span>
        </button>
      ))}
    </div>
  );
}

function DecisionStrip({ scenario }: { scenario: HealingScenario }) {
  return (
    <div className="decision-strip">
      <div className="decision-strip__item">
        <span className="decision-strip__label">Original locator</span>
        <MonoValue>{scenario.originalSelector}</MonoValue>
      </div>
      <div className="decision-strip__item">
        <span className="decision-strip__label">Decision</span>
        <StatusBadge tone={toneForStatus(scenario.outcome)} label={scenario.outcome} />
      </div>
      <div className="decision-strip__item">
        <span className="decision-strip__label">Best score</span>
        <span className="mono decision-strip__value">{scenario.score !== null ? scenario.score.toFixed(3) : "—"}</span>
      </div>
      <div className="decision-strip__item">
        <span className="decision-strip__label">Margin over 2nd</span>
        <span className="mono decision-strip__value">{scenario.margin !== null ? scenario.margin.toFixed(3) : "—"}</span>
      </div>
      <div className="decision-strip__item">
        <span className="decision-strip__label">Candidates considered</span>
        <span className="mono decision-strip__value">{scenario.candidatesConsidered}</span>
      </div>
    </div>
  );
}

function ScenarioDetail({ scenario }: { scenario: HealingScenario }) {
  return (
    <div className="healing-detail">
      <div className="healing-detail__intro">
        <h2 className="healing-detail__title">{scenario.title}</h2>
        <p className="healing-detail__description">{scenario.description}</p>
        <p className="healing-detail__source mono">source: {scenario.source}</p>
      </div>

      <DecisionStrip scenario={scenario} />

      <div className="healing-detail__columns">
        <SectionCard title="Target fingerprint (captured before failure)">
          <FingerprintPanel fingerprint={scenario.target} />
          {scenario.targetOuterHtml && (
            <div className="healing-detail__target-html">
              <DomSnippet html={scenario.targetOuterHtml} />
            </div>
          )}
        </SectionCard>

        <SectionCard title={`Candidates on the page (${scenario.candidates.length})`}>
          {scenario.candidates.length === 0 ? (
            <EmptyState
              title="No candidates found"
              description="Neither a same-tag nor a same-role element exists on the page — the target was genuinely removed."
            />
          ) : (
            <CandidateTable candidates={scenario.candidates} winningCandidateId={scenario.winningCandidateId} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export function SelfHealingPage({ scenarioId }: { scenarioId?: string }) {
  const { selfHealing } = useSnapshot();
  const { scenarios } = selfHealing;
  const active = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  useEffect(() => {
    if (!scenarioId && active) {
      navigate({ name: "self-healing", scenarioId: active.id });
    }
  }, [scenarioId, active]);

  if (!active) {
    return <EmptyState title="No self-healing scenarios captured" description="Run `bun run web:collect` to regenerate the snapshot." />;
  }

  return (
    <div className="self-healing-page">
      <ScenarioRail scenarios={scenarios} activeId={active.id} />
      <ScenarioDetail scenario={active} />
    </div>
  );
}
