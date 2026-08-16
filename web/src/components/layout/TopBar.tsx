import { useSnapshot } from "../../api";
import "./TopBar.css";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TopBar({ section }: { section: string }) {
  const snapshot = useSnapshot();

  return (
    <header className="top-bar">
      <span className="top-bar__section">{section}</span>
      <div className="top-bar__meta">
        <span className="top-bar__generated">
          data captured <span className="mono">{formatTimestamp(snapshot.generatedAt)}</span>
        </span>
      </div>
    </header>
  );
}
