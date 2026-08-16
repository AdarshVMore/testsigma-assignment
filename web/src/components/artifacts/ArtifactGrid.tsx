import type { ArtifactEntry } from "../../types";
import { ArtifactCard } from "./ArtifactCard";
import "./ArtifactGrid.css";

export function ArtifactGrid({ artifacts, limit }: { artifacts: ArtifactEntry[]; limit?: number }) {
  const shown = limit ? artifacts.slice(0, limit) : artifacts;
  return (
    <div className="artifact-grid">
      {shown.map((a) => (
        <ArtifactCard key={a.id} artifact={a} />
      ))}
    </div>
  );
}
