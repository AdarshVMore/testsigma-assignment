import type { ReactNode } from "react";
import "./MonoValue.css";

/** A small inline chip for technical values — selectors, scores, paths. */
export function MonoValue({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <code className={`mono-value ${muted ? "mono-value--muted" : ""}`}>{children}</code>;
}
