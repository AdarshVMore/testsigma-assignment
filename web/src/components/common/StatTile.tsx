import type { ReactNode } from "react";
import "./StatTile.css";

export function StatTile({
  label,
  value,
  tone = "default",
  mono = true,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
  mono?: boolean;
}) {
  return (
    <div className="stat-tile">
      <span className={`stat-tile__value stat-tile__value--${tone} ${mono ? "mono" : ""}`}>{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}
