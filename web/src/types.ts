// Re-exported as type-only imports (erased at build time — nothing from
// these modules, e.g. Playwright, ends up in the browser bundle) so the
// frontend's data shapes stay honestly tied to the real backend types
// instead of a hand-maintained, driftable copy.
export type { DomContext, ElementFingerprint } from "../../packages/self-healing/src/fingerprint";
export type { CandidateScore, HealingOutcome, SignalScore } from "../../packages/self-healing/src/scorer";
export type { ReportSummary, TestResult } from "../../packages/test-reporter/src/model";

import type { ElementFingerprint } from "../../packages/self-healing/src/fingerprint";
import type { CandidateScore, HealingOutcome } from "../../packages/self-healing/src/scorer";
import type { ReportSummary, TestResult } from "../../packages/test-reporter/src/model";

export interface CandidateDTO {
  id: string;
  outerHtml: string;
  fingerprint: ElementFingerprint;
  score: CandidateScore;
}

export interface HealingScenario {
  id: string;
  title: string;
  description: string;
  originalSelector: string;
  /** Which real source this scenario came from — a note, never fabricated. */
  source: string;
  outcome: HealingOutcome;
  score: number | null;
  margin: number | null;
  candidatesConsidered: number;
  target: ElementFingerprint;
  /**
   * Only present when the target was captured live from a real DOM before
   * mutation (the demo scenario). The eval-fixture scenarios use an
   * explicitly hand-authored target (see README "Important decisions" —
   * explicit fingerprint authoring), so there's no "before" HTML to show —
   * left undefined rather than faked.
   */
  targetOuterHtml?: string;
  /** Sorted by score, highest first. */
  candidates: CandidateDTO[];
  winningCandidateId: string | null;
}

export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
}

export interface VisualRegressionResult {
  passed: boolean;
  diffPercentage: number;
  dimensionMismatch: boolean;
  beforeSize: [number, number];
  afterSize: [number, number];
  regions: DiffRegion[];
  config: {
    pixelThreshold: number;
    blurRadius: number;
    minRegionArea: number;
    mergeDistance: number;
  };
  images: {
    before: string;
    after: string;
    diff: string;
    highlighted: string;
  };
}

export interface ArtifactEntry {
  id: string;
  label: string;
  kind: "screenshot" | "diff-image" | "log" | "report" | "json";
  path: string;
  sourceScreen: "self-healing" | "visual-diff" | "reports";
}

export interface TestRun {
  id: string;
  label: string;
  source: string;
  results: TestResult[];
  summary: ReportSummary;
}

export interface Snapshot {
  generatedAt: string;
  selfHealing: {
    scenarios: HealingScenario[];
  };
  visualRegression: VisualRegressionResult;
  testRun: TestRun;
  artifacts: ArtifactEntry[];
}
