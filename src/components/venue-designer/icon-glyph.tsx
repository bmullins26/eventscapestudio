import type { IconKey } from "./types";

const paths: Record<IconKey, React.ReactNode> = {
  tree: (
    <>
      <path d="M12 2 4 12h4v6h8v-6h4L12 2Z" />
      <rect x="10" y="18" width="4" height="4" />
    </>
  ),
  building: <rect x="4" y="4" width="16" height="16" rx="1" />,
  restroom: (
    <>
      <circle cx="8" cy="6" r="2" />
      <path d="M6 20v-6H4l2-6h4l2 6h-2v6H6Z" />
      <circle cx="17" cy="6" r="2" />
      <path d="M15 20v-6h-2l2-6h4l2 6h-2v6h-4Z" />
    </>
  ),
  stage: (
    <>
      <path d="M3 8h18v10H3z" />
      <path d="M6 8V4M18 8V4" />
    </>
  ),
  food: (
    <>
      <path d="M4 4c0 4 2 6 4 6v10h-2V10" />
      <path d="M14 4v16" />
      <path d="M14 4c3 0 5 2 5 6s-2 4-5 4" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M10 8h3a3 3 0 0 1 0 6h-3v4M10 8v6" strokeWidth="2" />
    </>
  ),
  entrance: (
    <>
      <path d="M12 4v16" />
      <path d="M6 12h12l-4-4M18 12l-4 4" />
    </>
  ),
  first_aid: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M12 10v6M9 13h6" strokeWidth="2" />
    </>
  ),
  atm: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="1" />
      <path d="M8 12h8M12 9v6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 10v6M12 7.5v.5" strokeWidth="2" />
    </>
  ),
  arrow: <path d="M4 12h14l-5-5M18 12l-5 5" strokeWidth="2" />,
};

export function IconGlyph({ iconKey, size = 24, color = "currentColor" }: {
  iconKey: IconKey; size?: number; color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[iconKey]}
    </svg>
  );
}
