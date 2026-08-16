import { useSnapshot } from "../api";
import { ArtifactGrid } from "../components/artifacts/ArtifactGrid";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionCard } from "../components/common/SectionCard";
import { StatTile } from "../components/common/StatTile";
import { TestList } from "../components/reports/TestList";
import "./ReportsPage.css";

export function ReportsPage() {
  const { testRun, artifacts } = useSnapshot();
  const { summary } = testRun;
  const reportArtifacts = artifacts.filter((a) => a.sourceScreen === "reports");

  return (
    <div>
      <PageHeader title="Reports" description={testRun.label} />

      <div className="reports-stats">
        <StatTile label="Pass rate" value={`${(summary.passRate * 100).toFixed(0)}%`} tone={summary.passRate === 1 ? "success" : summary.failed > 0 ? "danger" : "default"} />
        <StatTile label="Passed" value={summary.passed} tone="success" />
        <StatTile label="Failed" value={summary.failed} tone="danger" />
        <StatTile label="Skipped" value={summary.skipped} tone="warning" />
        <StatTile label="Total" value={summary.total} />
        <StatTile label="Duration" value={summary.totalDurationMs >= 1000 ? `${(summary.totalDurationMs / 1000).toFixed(2)}s` : `${summary.totalDurationMs}ms`} />
      </div>

      <div className="reports-layout">
        <SectionCard title={`Test list (${testRun.results.length})`}>
          <p className="reports-hint">Rows with an error or screenshot are expandable.</p>
          <TestList results={testRun.results} />
        </SectionCard>

        <SectionCard title="Generated artifacts">
          <ArtifactGrid artifacts={reportArtifacts} />
        </SectionCard>
      </div>
    </div>
  );
}
