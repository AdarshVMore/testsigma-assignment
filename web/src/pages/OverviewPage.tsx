import { useSnapshot } from "../api";
import { ArtifactGrid } from "../components/artifacts/ArtifactGrid";
import { PageHeader } from "../components/layout/PageHeader";
import { ScenarioList } from "../components/self-healing/ScenarioList";
import { SectionCard } from "../components/common/SectionCard";
import { StatTile } from "../components/common/StatTile";
import { StatusBadge } from "../components/common/StatusBadge";
import { TestList } from "../components/reports/TestList";
import { navigate } from "../router";
import "./OverviewPage.css";

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button className="section-card__link" onClick={onClick}>
      View all →
    </button>
  );
}

export function OverviewPage() {
  const { testRun, selfHealing, visualRegression, artifacts } = useSnapshot();
  const { summary } = testRun;

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Latest run · ${testRun.label}`}
      />

      <div className="overview-stats">
        <StatTile label="Total" value={summary.total} />
        <StatTile label="Passed" value={summary.passed} tone="success" />
        <StatTile label="Failed" value={summary.failed} tone="danger" />
        <StatTile label="Skipped" value={summary.skipped} tone="warning" />
        <StatTile label="Duration" value={formatDuration(summary.totalDurationMs)} />
        <StatTile
          label="Visual regression"
          value={<StatusBadge tone={visualRegression.passed ? "success" : "danger"} label={visualRegression.passed ? "passed" : "failed"} />}
          mono={false}
        />
      </div>

      <div className="overview-grid">
        <SectionCard title="Locator healing events" action={<ViewAll onClick={() => navigate({ name: "self-healing" })} />}>
          <ScenarioList scenarios={selfHealing.scenarios} limit={4} />
        </SectionCard>

        <SectionCard title="Test execution" action={<ViewAll onClick={() => navigate({ name: "reports" })} />}>
          <TestList results={testRun.results} limit={4} />
        </SectionCard>

        <SectionCard title="Recent artifacts" action={<ViewAll onClick={() => navigate({ name: "artifacts" })} />}>
          <ArtifactGrid artifacts={artifacts} limit={4} />
        </SectionCard>
      </div>
    </div>
  );
}
