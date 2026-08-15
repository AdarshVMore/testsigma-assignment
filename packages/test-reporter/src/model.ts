/** The common shape every log format gets normalized into. */
export interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  /** Milliseconds. Undefined for skipped tests (they never ran). */
  duration?: number;
  error?: string;
  screenshot?: string;
}

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
  /** passed / (passed + failed) — skipped tests are excluded from the rate, not counted against it. */
  passRate: number;
}

/** Aggregates a flat list of results into the counts a report needs. */
export class ReportModel {
  constructor(public readonly results: TestResult[]) {}

  summary(): ReportSummary {
    const passed = this.results.filter((r) => r.status === "passed").length;
    const failed = this.results.filter((r) => r.status === "failed").length;
    const skipped = this.results.filter((r) => r.status === "skipped").length;
    const totalDurationMs = this.results.reduce((sum, r) => sum + (r.duration ?? 0), 0);
    const executed = passed + failed;

    return {
      total: this.results.length,
      passed,
      failed,
      skipped,
      totalDurationMs,
      passRate: executed === 0 ? 0 : passed / executed,
    };
  }
}
