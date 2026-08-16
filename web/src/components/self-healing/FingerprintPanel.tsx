import type { ElementFingerprint } from "../../types";
import "./FingerprintPanel.css";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="fingerprint-panel__row">
      <span className="fingerprint-panel__label">{label}</span>
      <span className="fingerprint-panel__value mono">{value}</span>
    </div>
  );
}

export function FingerprintPanel({ fingerprint }: { fingerprint: ElementFingerprint }) {
  const attrs = Object.entries(fingerprint.attributes);

  return (
    <div className="fingerprint-panel">
      <Row label="tag" value={`<${fingerprint.tag}>`} />
      <Row label="text" value={fingerprint.text || "(empty)"} />
      <Row label="role" value={fingerprint.role ?? "(none)"} />
      <Row label="aria-label" value={fingerprint.ariaLabel ?? "(none)"} />
      <Row label="type" value={fingerprint.type ?? "(none)"} />
      <Row label="name" value={fingerprint.name ?? "(none)"} />
      <Row label="placeholder" value={fingerprint.placeholder ?? "(none)"} />
      <Row label="class" value={fingerprint.classList.length ? fingerprint.classList.join(" ") : "(none)"} />
      <Row label="attributes" value={attrs.length ? attrs.map(([k, v]) => `${k}="${v}"`).join(" ") : "(none)"} />
      <Row
        label="dom context"
        value={`${fingerprint.domContext.parentTag ?? "?"} › [${fingerprint.domContext.ancestorTags.join(" › ")}] · sibling ${fingerprint.domContext.siblingIndex + 1}/${fingerprint.domContext.siblingCount}`}
      />
    </div>
  );
}
