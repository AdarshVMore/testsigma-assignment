import type { DiffRegion } from "../../types";
import { EmptyState } from "../common/EmptyState";
import "./RegionList.css";

export function RegionList({ regions }: { regions: DiffRegion[] }) {
  if (regions.length === 0) {
    return <EmptyState title="No regions" description="No connected component of changed pixels survived filtering." />;
  }

  return (
    <table className="region-list">
      <thead>
        <tr>
          <th>#</th>
          <th>Position</th>
          <th>Size</th>
          <th>Pixels</th>
        </tr>
      </thead>
      <tbody>
        {regions.map((r, i) => (
          <tr key={i}>
            <td className="mono">{i + 1}</td>
            <td className="mono">
              {r.x}, {r.y}
            </td>
            <td className="mono">
              {r.width}×{r.height}
            </td>
            <td className="mono">{r.pixelCount.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
