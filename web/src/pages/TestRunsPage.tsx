import { useSnapshot } from "../api";
import { PageHeader } from "../components/layout/PageHeader";
import { StatusBadge } from "../components/common/StatusBadge";
import { navigate } from "../router";
import "./TestRunsPage.css";

export function TestRunsPage() {
  const { testRun, generatedAt } = useSnapshot();
  const { summary } = testRun;
  const overallTone = summary.failed > 0 ? "danger" : summary.passed === summary.total ? "success" : "warning";

  return (
    <div>
      <PageHeader
        title="Test Runs"
        description="This V1 captures data from one real, actually-executed run — historical run tracking isn't built yet."
      />

      <table className="runs-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Run</th>
            <th>Tests</th>
            <th>Duration</th>
            <th>Captured</th>
          </tr>
        </thead>
        <tbody>
          <tr className="runs-table__row" onClick={() => navigate({ name: "reports" })}>
            <td>
              <StatusBadge tone={overallTone} label={summary.failed > 0 ? "failed" : "passed"} />
            </td>
            <td>
              <div className="runs-table__label">{testRun.label}</div>
              <div className="runs-table__source mono">{testRun.source}</div>
            </td>
            <td className="mono">
              {summary.passed}P / {summary.failed}F / {summary.skipped}S
            </td>
            <td className="mono">{(summary.totalDurationMs / 1000).toFixed(2)}s</td>
            <td className="mono">{new Date(generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
