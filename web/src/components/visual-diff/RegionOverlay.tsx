import type { DiffRegion } from "../../types";
import "./RegionOverlay.css";

/**
 * Positions region boxes as CSS percentages of the image's natural size, so
 * they track correctly regardless of how large the image is rendered — no
 * resize listeners needed.
 */
export function RegionOverlay({
  regions,
  imageWidth,
  imageHeight,
}: {
  regions: DiffRegion[];
  imageWidth: number;
  imageHeight: number;
}) {
  return (
    <div className="region-overlay">
      {regions.map((r, i) => (
        <div
          key={i}
          className="region-overlay__box"
          style={{
            left: `${(r.x / imageWidth) * 100}%`,
            top: `${(r.y / imageHeight) * 100}%`,
            width: `${(r.width / imageWidth) * 100}%`,
            height: `${(r.height / imageHeight) * 100}%`,
          }}
        >
          <span className="region-overlay__label mono">
            {r.width}×{r.height}
          </span>
        </div>
      ))}
    </div>
  );
}
