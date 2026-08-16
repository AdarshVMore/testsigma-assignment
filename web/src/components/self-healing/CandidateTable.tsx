import type { CandidateDTO } from "../../types";
import { DomSnippet } from "./DomSnippet";
import { SignalBreakdown } from "./SignalBreakdown";
import "./CandidateTable.css";

export function CandidateTable({ candidates, winningCandidateId }: { candidates: CandidateDTO[]; winningCandidateId: string | null }) {
  return (
    <div className="candidate-list">
      {candidates.map((candidate, index) => {
        const isWinner = candidate.id === winningCandidateId;
        return (
          <div key={candidate.id} className={`candidate-card ${isWinner ? "candidate-card--winner" : ""}`}>
            <div className="candidate-card__header">
              <span className="candidate-card__rank mono">#{index + 1}</span>
              {isWinner && <span className="candidate-card__winner-tag">winning candidate</span>}
              <span className="candidate-card__score mono">{candidate.score.total.toFixed(3)}</span>
            </div>
            <DomSnippet html={candidate.outerHtml} />
            <SignalBreakdown signals={candidate.score.signals} />
          </div>
        );
      })}
    </div>
  );
}
