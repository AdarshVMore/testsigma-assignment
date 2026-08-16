import { navigate } from "../../router";
import type { HealingScenario } from "../../types";
import { StatusBadge, toneForStatus } from "../common/StatusBadge";
import "../common/ListRow.css";

export function ScenarioList({ scenarios, limit }: { scenarios: HealingScenario[]; limit?: number }) {
  const shown = limit ? scenarios.slice(0, limit) : scenarios;

  return (
    <div>
      {shown.map((scenario) => (
        <button
          key={scenario.id}
          className="list-row"
          onClick={() => navigate({ name: "self-healing", scenarioId: scenario.id })}
        >
          <StatusBadge tone={toneForStatus(scenario.outcome)} label={scenario.outcome} />
          <span className="list-row__title truncate">{scenario.title}</span>
          <span className="list-row__meta">
            {scenario.score !== null && <span className="mono">{scenario.score.toFixed(2)}</span>}
            <span>{scenario.candidatesConsidered} candidate{scenario.candidatesConsidered === 1 ? "" : "s"}</span>
          </span>
          <span className="list-row__chevron">›</span>
        </button>
      ))}
    </div>
  );
}
