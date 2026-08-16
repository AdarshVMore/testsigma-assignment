import { useState } from "react";
import type { TestResult } from "../../types";
import { StatusBadge, toneForStatus } from "../common/StatusBadge";
import "../common/ListRow.css";
import "./TestList.css";

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function TestRow({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(result.error || result.screenshot);

  return (
    <div className="test-row">
      <button
        className="list-row"
        onClick={() => hasDetail && setExpanded((e) => !e)}
        style={{ cursor: hasDetail ? "pointer" : "default" }}
      >
        <StatusBadge tone={toneForStatus(result.status)} label={result.status} />
        <span className="list-row__title truncate">{result.name}</span>
        <span className="list-row__meta">
          <span className="mono">{formatDuration(result.duration)}</span>
        </span>
        {hasDetail && <span className={`list-row__chevron ${expanded ? "list-row__chevron--open" : ""}`}>›</span>}
      </button>
      {expanded && (
        <div className="test-row__detail">
          {result.error && <pre className="test-row__error">{result.error}</pre>}
          {result.screenshot && (
            <img className="test-row__screenshot" src={`/media/${result.screenshot}`} alt={`Screenshot for ${result.name}`} />
          )}
        </div>
      )}
    </div>
  );
}

export function TestList({ results, limit }: { results: TestResult[]; limit?: number }) {
  const shown = limit ? results.slice(0, limit) : results;
  return (
    <div>
      {shown.map((r) => (
        <TestRow key={r.name} result={r} />
      ))}
    </div>
  );
}
