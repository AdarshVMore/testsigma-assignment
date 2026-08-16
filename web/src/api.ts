import { createContext, useContext } from "react";
import type { Snapshot } from "./types";

export async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch("/api/snapshot");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to load snapshot (${res.status})`);
  }
  return res.json();
}

/** Resolves a repo-relative path (e.g. "examples/foo/bar.png") to a servable URL. */
export function mediaUrl(relativePath: string): string {
  return `/media/${relativePath}`;
}

export const SnapshotContext = createContext<Snapshot | null>(null);

export function useSnapshot(): Snapshot {
  const snapshot = useContext(SnapshotContext);
  if (!snapshot) {
    throw new Error("useSnapshot() called outside <SnapshotContext.Provider>");
  }
  return snapshot;
}
