// Small hand-drawn stroke icons (16px, currentColor) — avoids pulling in an
// icon library for six nav items.
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const OverviewIcon = () => (
  <svg {...base}>
    <rect x="1.5" y="1.5" width="6" height="6" rx="1" />
    <rect x="8.5" y="1.5" width="6" height="4" rx="1" />
    <rect x="8.5" y="7.5" width="6" height="7" rx="1" />
    <rect x="1.5" y="9.5" width="6" height="5" rx="1" />
  </svg>
);

export const RunsIcon = () => (
  <svg {...base}>
    <path d="M2 3.5h12M2 8h12M2 12.5h8" />
    <circle cx="14" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const HealingIcon = () => (
  <svg {...base}>
    <path d="M9.5 2.5 3 9l2 .5-1 4 6.5-6.5-2-.5 1-4Z" />
  </svg>
);

export const DiffIcon = () => (
  <svg {...base}>
    <rect x="1.5" y="3" width="6" height="10" rx="1" />
    <rect x="8.5" y="3" width="6" height="10" rx="1" />
    <path d="M8.5 5.5h6M8.5 8h6M8.5 10.5h6" opacity="0.5" />
  </svg>
);

export const ReportsIcon = () => (
  <svg {...base}>
    <path d="M3.5 1.5h6l3 3v10h-9Z" />
    <path d="M9.5 1.5v3h3" />
    <path d="M5.5 8.5h5M5.5 10.8h5M5.5 6.2h2.5" />
  </svg>
);

export const ArtifactsIcon = () => (
  <svg {...base}>
    <path d="M1.7 4.8 8 1.5l6.3 3.3L8 8.1Z" />
    <path d="M1.7 4.8V11l6.3 3.3V8.1M14.3 4.8V11L8 14.3" />
  </svg>
);
