import { useState } from "react";
import { mediaUrl } from "../../api";
import type { VisualRegressionResult } from "../../types";
import { RegionOverlay } from "./RegionOverlay";
import "./ImageCompareViewer.css";

type ViewMode = "2-up" | "1-up" | "diff" | "highlighted";

const MODES: { id: ViewMode; label: string }[] = [
  { id: "highlighted", label: "Highlighted" },
  { id: "2-up", label: "2-up" },
  { id: "1-up", label: "1-up" },
  { id: "diff", label: "Diff" },
];

export function ImageCompareViewer({ result }: { result: VisualRegressionResult }) {
  const [mode, setMode] = useState<ViewMode>("highlighted");
  const [onionAfter, setOnionAfter] = useState(true);
  const [width, height] = result.afterSize;

  return (
    <div className="image-viewer">
      <div className="image-viewer__tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`image-viewer__tab ${mode === m.id ? "image-viewer__tab--active" : ""}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
        {mode === "1-up" && (
          <button className="image-viewer__onion-toggle" onClick={() => setOnionAfter((v) => !v)}>
            showing: <span className="mono">{onionAfter ? "after" : "before"}</span>
          </button>
        )}
      </div>

      <div className="image-viewer__stage">
        {mode === "2-up" && (
          <div className="image-viewer__split">
            <figure className="image-viewer__pane">
              <figcaption>Baseline</figcaption>
              <img src={mediaUrl(result.images.before)} alt="Baseline screenshot" />
            </figure>
            <figure className="image-viewer__pane">
              <figcaption>Current</figcaption>
              <div className="image-viewer__image-wrap">
                <img src={mediaUrl(result.images.after)} alt="Current screenshot" />
                <RegionOverlay regions={result.regions} imageWidth={width} imageHeight={height} />
              </div>
            </figure>
          </div>
        )}

        {mode === "1-up" && (
          <div className="image-viewer__image-wrap image-viewer__image-wrap--single">
            <img src={mediaUrl(onionAfter ? result.images.after : result.images.before)} alt={onionAfter ? "Current screenshot" : "Baseline screenshot"} />
            {onionAfter && <RegionOverlay regions={result.regions} imageWidth={width} imageHeight={height} />}
          </div>
        )}

        {mode === "diff" && (
          <div className="image-viewer__image-wrap image-viewer__image-wrap--single">
            <img src={mediaUrl(result.images.diff)} alt="Diff heatmap" />
          </div>
        )}

        {mode === "highlighted" && (
          <div className="image-viewer__image-wrap image-viewer__image-wrap--single">
            <img src={mediaUrl(result.images.highlighted)} alt="Highlighted regions" />
          </div>
        )}
      </div>
    </div>
  );
}
