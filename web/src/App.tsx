import { useEffect, useState } from "react";
import { fetchSnapshot, SnapshotContext } from "./api";
import { PageHeader } from "./components/layout/PageHeader";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SelfHealingPage } from "./pages/SelfHealingPage";
import { TestRunsPage } from "./pages/TestRunsPage";
import { VisualDiffPage } from "./pages/VisualDiffPage";
import { useRoute } from "./router";
import type { Snapshot } from "./types";

const SECTION_LABEL: Record<string, string> = {
  overview: "Overview",
  "test-runs": "Test Runs",
  "self-healing": "Self-Healing",
  "visual-diff": "Visual Diff",
  reports: "Reports",
  artifacts: "Artifacts",
};

function PageBody({ route }: { route: ReturnType<typeof useRoute> }) {
  switch (route.name) {
    case "overview":
      return <OverviewPage />;
    case "test-runs":
      return <TestRunsPage />;
    case "self-healing":
      return <SelfHealingPage scenarioId={route.scenarioId} />;
    case "visual-diff":
      return <VisualDiffPage />;
    case "reports":
      return <ReportsPage />;
    case "artifacts":
      return <ArtifactsPage />;
  }
}

function Shell({ snapshot }: { snapshot: Snapshot }) {
  const route = useRoute();

  return (
    <SnapshotContext.Provider value={snapshot}>
      <div className="app-shell">
        <Sidebar current={route} />
        <div className="app-shell__main">
          <TopBar section={SECTION_LABEL[route.name] ?? route.name} />
          <div className="app-shell__content">
            <PageBody route={route} />
          </div>
        </div>
      </div>
    </SnapshotContext.Provider>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshot()
      .then(setSnapshot)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="app-boot-error">
        <PageHeader title="Couldn't load data" description={error} />
        <p className="mono">Run `bun run web:collect` from the repo root, then reload.</p>
      </div>
    );
  }

  if (!snapshot) {
    return <div className="app-boot-loading">Loading…</div>;
  }

  return <Shell snapshot={snapshot} />;
}
