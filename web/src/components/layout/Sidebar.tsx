import type { ComponentType } from "react";
import type { Route } from "../../router";
import { navigate } from "../../router";
import { ArtifactsIcon, DiffIcon, HealingIcon, OverviewIcon, ReportsIcon, RunsIcon } from "./icons";
import "./Sidebar.css";

const NAV: { route: Route; label: string; icon: ComponentType }[] = [
  { route: { name: "overview" }, label: "Overview", icon: OverviewIcon },
  { route: { name: "test-runs" }, label: "Test Runs", icon: RunsIcon },
  { route: { name: "self-healing" }, label: "Self-Healing", icon: HealingIcon },
  { route: { name: "visual-diff" }, label: "Visual Diff", icon: DiffIcon },
  { route: { name: "reports" }, label: "Reports", icon: ReportsIcon },
  { route: { name: "artifacts" }, label: "Artifacts", icon: ArtifactsIcon },
];

export function Sidebar({ current }: { current: Route }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">▣</span>
        <span className="sidebar__brand-name">Workbench</span>
      </div>
      <nav className="sidebar__nav">
        {NAV.map(({ route, label, icon: Icon }) => {
          const isActive = route.name === current.name;
          return (
            <button
              key={route.name}
              className={`sidebar__item ${isActive ? "sidebar__item--active" : ""}`}
              onClick={() => navigate(route)}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="sidebar__footer">
        <span className="mono">v1 · local</span>
      </div>
    </aside>
  );
}
