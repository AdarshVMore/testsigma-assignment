import type { SignalScore } from "../../types";
import "./SignalBreakdown.css";

export function SignalBreakdown({ signals }: { signals: SignalScore[] }) {
  return (
    <div className="signal-breakdown-scroll">
    <table className="signal-breakdown">
      <thead>
        <tr>
          <th>Signal</th>
          <th>Weight</th>
          <th>Value</th>
          <th>Contribution</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s) => (
          <tr key={s.signal} className={s.applicable ? "" : "signal-breakdown__row--inapplicable"}>
            <td className="mono">{s.signal}</td>
            <td className="mono">{s.weight.toFixed(2)}</td>
            <td>
              {s.applicable ? (
                <div className="signal-breakdown__bar-cell">
                  <div className="signal-breakdown__bar">
                    <div className="signal-breakdown__bar-fill" style={{ width: `${s.value * 100}%` }} />
                  </div>
                  <span className="mono">{s.value.toFixed(2)}</span>
                </div>
              ) : (
                <span className="signal-breakdown__na">n/a</span>
              )}
            </td>
            <td className="mono">{s.applicable ? s.contribution.toFixed(3) : "—"}</td>
            <td className="signal-breakdown__detail" title={s.detail}>
              {s.detail}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
