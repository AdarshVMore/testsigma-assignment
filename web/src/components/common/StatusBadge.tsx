import "./StatusBadge.css";

export type Tone = "success" | "danger" | "warning" | "neutral" | "accent";

const DOT: Record<Tone, string> = {
  success: "●",
  danger: "●",
  warning: "●",
  neutral: "●",
  accent: "●",
};

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__dot" aria-hidden="true">
        {DOT[tone]}
      </span>
      {label}
    </span>
  );
}

/** Maps the backend's real status/outcome vocabularies to a display tone. */
export function toneForStatus(status: "passed" | "failed" | "skipped" | "healed" | "ambiguous" | "original-ok"): Tone {
  switch (status) {
    case "passed":
    case "healed":
    case "original-ok":
      return "success";
    case "failed":
      return "danger";
    case "skipped":
    case "ambiguous":
      return "warning";
    default:
      return "neutral";
  }
}
