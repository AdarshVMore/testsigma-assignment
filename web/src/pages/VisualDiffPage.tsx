import { useSnapshot } from "../api";
import { PageHeader } from "../components/layout/PageHeader";
import { SectionCard } from "../components/common/SectionCard";
import { StatTile } from "../components/common/StatTile";
import { StatusBadge } from "../components/common/StatusBadge";
import { ImageCompareViewer } from "../components/visual-diff/ImageCompareViewer";
import { RegionList } from "../components/visual-diff/RegionList";
import "./VisualDiffPage.css";

export function VisualDiffPage() {
  const { visualRegression } = useSnapshot();
  const r = visualRegression;

  return (
    <div>
      <PageHeader
        title="Visual Diff"
        description="examples/visual-regression — a mock login card, before vs. after a primary-button color/copy change."
        actions={<StatusBadge tone={r.passed ? "success" : "danger"} label={r.passed ? "passed" : "failed"} />}
      />

      <div className="visual-diff-stats">
        <StatTile label="Diff %" value={`${r.diffPercentage.toFixed(2)}%`} tone={r.passed ? "default" : "danger"} />
        <StatTile label="Regions" value={r.regions.length} />
        <StatTile label="Pixel threshold" value={r.config.pixelThreshold} />
        <StatTile label="Blur radius" value={r.config.blurRadius} />
        <StatTile label="Min region area" value={`${r.config.minRegionArea}px²`} />
        <StatTile label="Merge distance" value={`${r.config.mergeDistance}px`} />
      </div>

      <div className="visual-diff-layout">
        <ImageCompareViewer result={r} />

        <div className="visual-diff-side">
          <SectionCard title={`Regions (${r.regions.length})`}>
            <RegionList regions={r.regions} />
          </SectionCard>
          <SectionCard title="Image info">
            <div className="visual-diff-imageinfo">
              <div>
                <span className="visual-diff-imageinfo__label">Baseline</span>
                <span className="mono">{r.beforeSize[0]}×{r.beforeSize[1]}</span>
              </div>
              <div>
                <span className="visual-diff-imageinfo__label">Current</span>
                <span className="mono">{r.afterSize[0]}×{r.afterSize[1]}</span>
              </div>
              <div>
                <span className="visual-diff-imageinfo__label">Dimension match</span>
                <span className="mono">{r.dimensionMismatch ? "no" : "yes"}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
