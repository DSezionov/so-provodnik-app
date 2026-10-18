import type { SVGProps } from "react";

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

type IconProps = SVGProps<SVGSVGElement>;

export const JournalIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" />
    <path d="M8 8h6M8 12h6M8 16h3" />
  </svg>
);

export const RouteIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
  </svg>
);

export const ChecklistIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="m4 7 2 2 4-4M4 17l2 2 4-4M14 7h6M14 17h6" />
  </svg>
);

export const CatalogIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
);
