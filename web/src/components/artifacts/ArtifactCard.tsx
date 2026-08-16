import type { ArtifactEntry } from "../../types";
import "./ArtifactCard.css";

const KIND_LABEL: Record<ArtifactEntry["kind"], string> = {
  screenshot: "PNG",
  "diff-image": "PNG",
  log: "LOG",
  report: "HTML",
  json: "JSON",
};

const IMAGE_KINDS: ArtifactEntry["kind"][] = ["screenshot", "diff-image"];

export function ArtifactCard({ artifact }: { artifact: ArtifactEntry }) {
  const isImage = IMAGE_KINDS.includes(artifact.kind);
  const href = `/media/${artifact.path}`;

  return (
    <a className="artifact-card" href={href} target="_blank" rel="noreferrer">
      <div className="artifact-card__preview">
        {isImage ? (
          <img src={href} alt={artifact.label} loading="lazy" />
        ) : (
          <span className="artifact-card__kind mono">{KIND_LABEL[artifact.kind]}</span>
        )}
      </div>
      <div className="artifact-card__footer">
        <span className="artifact-card__label truncate">{artifact.label}</span>
        <span className="artifact-card__path mono truncate">{artifact.path}</span>
      </div>
    </a>
  );
}
