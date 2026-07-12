import type { IconKey } from "./types";

/**
 * Per-icon inline SVG. Each glyph is designed to read as the real object
 * (tree, food truck, canopy, table, chair, fence, road) at small sizes. Colors
 * are baked in so shapes stay legible; the optional `color` prop only tints
 * the neutral stroke used for outlines/details.
 */

interface GlyphProps {
  size?: number;
  color?: string; // outline / accent tint
}

function Svg({ size = 24, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

const glyphs: Record<IconKey, (p: GlyphProps) => React.ReactNode> = {
  tree: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <ellipse cx="32" cy="28" rx="20" ry="20" fill="#2f7d32" />
      <ellipse cx="22" cy="22" rx="10" ry="9" fill="#43a047" />
      <ellipse cx="42" cy="24" rx="9" ry="8" fill="#4caf50" />
      <ellipse cx="32" cy="18" rx="8" ry="7" fill="#66bb6a" />
      <rect x="28" y="42" width="8" height="16" rx="2" fill="#6d4c2b" />
      <path d="M28 46 Q32 44 36 46" stroke={color} strokeWidth="0.6" fill="none" opacity="0.4" />
    </Svg>
  ),
  building: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <rect x="10" y="14" width="44" height="42" fill="#90a4ae" stroke={color} strokeWidth="1" />
      <rect x="14" y="18" width="8" height="8" fill="#e3f2fd" />
      <rect x="26" y="18" width="8" height="8" fill="#e3f2fd" />
      <rect x="38" y="18" width="8" height="8" fill="#e3f2fd" />
      <rect x="14" y="30" width="8" height="8" fill="#e3f2fd" />
      <rect x="26" y="30" width="8" height="8" fill="#e3f2fd" />
      <rect x="38" y="30" width="8" height="8" fill="#e3f2fd" />
      <rect x="26" y="44" width="12" height="12" fill="#4e342e" />
    </Svg>
  ),
  restroom: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <rect x="4" y="8" width="56" height="48" rx="3" fill="#eceff1" stroke={color} strokeWidth="1" />
      <line x1="32" y1="10" x2="32" y2="54" stroke={color} strokeWidth="1" />
      <circle cx="18" cy="22" r="5" fill="#1e88e5" />
      <path d="M12 44 L12 32 Q12 28 18 28 Q24 28 24 32 L24 44 L20 44 L20 52 L16 52 L16 44 Z" fill="#1e88e5" />
      <circle cx="46" cy="22" r="5" fill="#e91e63" />
      <path d="M40 44 L40 32 Q40 28 46 28 Q52 28 52 32 L52 44 L49 44 L49 52 L43 52 L43 44 Z M42 44 L50 44 L54 34 L38 34 Z" fill="#e91e63" />
    </Svg>
  ),
  stage: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <rect x="6" y="24" width="52" height="24" fill="#5d4037" stroke={color} strokeWidth="1" />
      <rect x="6" y="24" width="52" height="4" fill="#8d6e63" />
      <path d="M14 24 L14 10 L50 10 L50 24" fill="none" stroke={color} strokeWidth="2" />
      <path d="M10 10 Q32 2 54 10" fill="#c62828" />
      <circle cx="20" cy="18" r="3" fill="#ffc107" />
      <circle cx="32" cy="18" r="3" fill="#ffc107" />
      <circle cx="44" cy="18" r="3" fill="#ffc107" />
      <rect x="6" y="48" width="52" height="4" fill="#3e2723" />
    </Svg>
  ),
  food: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      {/* Food truck body */}
      <rect x="4" y="24" width="42" height="20" fill="#e53935" stroke={color} strokeWidth="1" />
      {/* Cab */}
      <path d="M46 30 L58 30 L58 44 L46 44 Z" fill="#b71c1c" stroke={color} strokeWidth="1" />
      <rect x="48" y="32" width="8" height="6" fill="#bbdefb" />
      {/* Awning */}
      <path d="M8 20 L38 20 L36 24 L10 24 Z" fill="#ffb74d" stroke={color} strokeWidth="1" />
      <line x1="14" y1="20" x2="14" y2="24" stroke={color} strokeWidth="0.5" />
      <line x1="22" y1="20" x2="22" y2="24" stroke={color} strokeWidth="0.5" />
      <line x1="30" y1="20" x2="30" y2="24" stroke={color} strokeWidth="0.5" />
      {/* Service window */}
      <rect x="10" y="28" width="28" height="10" fill="#eceff1" />
      <text x="24" y="36" fontSize="7" fontWeight="700" textAnchor="middle" fill="#c62828">FOOD</text>
      {/* Wheels */}
      <circle cx="16" cy="46" r="5" fill="#212121" />
      <circle cx="16" cy="46" r="2" fill="#616161" />
      <circle cx="50" cy="46" r="5" fill="#212121" />
      <circle cx="50" cy="46" r="2" fill="#616161" />
    </Svg>
  ),
  parking: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <rect x="8" y="8" width="48" height="48" rx="4" fill="#1565c0" stroke={color} strokeWidth="1" />
      <text x="32" y="46" fontSize="36" fontWeight="800" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">P</text>
    </Svg>
  ),
  entrance: ({ size, color = "#1f2937" }: GlyphProps) => (
    <Svg size={size}>
      <rect x="16" y="6" width="32" height="52" rx="2" fill="#43a047" stroke={color} strokeWidth="1" />
      <rect x="20" y="10" width="24" height="44" fill="#2e7d32" />
      <path d="M22 32 L38 32 L34 26 M38 32 L34 38" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  first_aid: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <rect x="8" y="14" width="48" height="40" rx="4" fill="#ffffff" stroke={color} strokeWidth="1.5" />
      <rect x="24" y="8" width="16" height="10" rx="2" fill="#eceff1" stroke={color} strokeWidth="1" />
      <rect x="28" y="24" width="8" height="20" fill="#e53935" />
      <rect x="18" y="30" width="28" height="8" fill="#e53935" />
    </Svg>
  ),
  atm: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <rect x="8" y="8" width="48" height="48" rx="3" fill="#455a64" stroke={color} strokeWidth="1" />
      <rect x="14" y="14" width="36" height="18" fill="#263238" />
      <rect x="18" y="18" width="28" height="10" fill="#4fc3f7" />
      <rect x="14" y="36" width="14" height="4" fill="#90a4ae" />
      <rect x="36" y="36" width="14" height="4" fill="#90a4ae" />
      <rect x="20" y="46" width="24" height="6" rx="1" fill="#212121" />
    </Svg>
  ),
  info: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <circle cx="32" cy="32" r="24" fill="#1976d2" stroke={color} strokeWidth="1" />
      <circle cx="32" cy="18" r="4" fill="#ffffff" />
      <rect x="28" y="26" width="8" height="24" rx="2" fill="#ffffff" />
    </Svg>
  ),
  arrow: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      <path d="M6 32 L44 32 L44 20 L58 32 L44 44 L44 32" fill="#fbc02d" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </Svg>
  ),
  booth_canopy: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      {/* Canopy tent (top view / iso) */}
      <path d="M8 22 L32 8 L56 22 L56 26 L8 26 Z" fill="#ef6c00" stroke={color} strokeWidth="1" />
      <path d="M8 22 L56 22" stroke={color} strokeWidth="0.5" />
      <path d="M14 26 L14 44 L50 44 L50 26" stroke={color} strokeWidth="1" fill="#fff3e0" />
      {/* Scallop */}
      <path d="M8 26 Q14 30 20 26 Q26 30 32 26 Q38 30 44 26 Q50 30 56 26" fill="none" stroke={color} strokeWidth="0.8" />
      {/* Poles */}
      <line x1="14" y1="26" x2="14" y2="56" stroke={color} strokeWidth="1.5" />
      <line x1="50" y1="26" x2="50" y2="56" stroke={color} strokeWidth="1.5" />
      {/* Table under canopy */}
      <rect x="18" y="40" width="28" height="6" fill="#8d6e63" stroke={color} strokeWidth="0.6" />
    </Svg>
  ),
  table: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      {/* Rectangular banquet table, top-down */}
      <rect x="6" y="20" width="52" height="24" rx="2" fill="#d7ccc8" stroke={color} strokeWidth="1.2" />
      <rect x="8" y="22" width="48" height="20" rx="1" fill="#efebe9" />
      {/* Wood grain */}
      <line x1="10" y1="28" x2="54" y2="28" stroke="#a1887f" strokeWidth="0.4" />
      <line x1="10" y1="34" x2="54" y2="34" stroke="#a1887f" strokeWidth="0.4" />
      <line x1="10" y1="40" x2="54" y2="40" stroke="#a1887f" strokeWidth="0.4" />
      {/* Legs peeking out */}
      <rect x="8" y="44" width="4" height="4" fill="#5d4037" />
      <rect x="52" y="44" width="4" height="4" fill="#5d4037" />
      <rect x="8" y="16" width="4" height="4" fill="#5d4037" />
      <rect x="52" y="16" width="4" height="4" fill="#5d4037" />
    </Svg>
  ),
  chair: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      {/* Chair top view */}
      <rect x="14" y="14" width="36" height="8" rx="2" fill="#455a64" stroke={color} strokeWidth="1" />
      <rect x="14" y="22" width="36" height="28" rx="3" fill="#78909c" stroke={color} strokeWidth="1" />
      <rect x="18" y="26" width="28" height="20" rx="2" fill="#90a4ae" />
      {/* Legs */}
      <circle cx="18" cy="50" r="2" fill="#263238" />
      <circle cx="46" cy="50" r="2" fill="#263238" />
      <circle cx="18" cy="22" r="2" fill="#263238" />
      <circle cx="46" cy="22" r="2" fill="#263238" />
    </Svg>
  ),
  fence: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      {/* Horizontal picket fence */}
      <rect x="4" y="26" width="56" height="3" fill="#6d4c2b" />
      <rect x="4" y="42" width="56" height="3" fill="#6d4c2b" />
      {[6, 16, 26, 36, 46, 56].map((x) => (
        <g key={x}>
          <rect x={x} y="16" width="4" height="36" fill="#8d6e63" stroke={color} strokeWidth="0.5" />
          <path d={`M${x} 16 L${x + 2} 12 L${x + 4} 16 Z`} fill="#8d6e63" stroke={color} strokeWidth="0.5" />
        </g>
      ))}
    </Svg>
  ),
  road: ({ size, color = "#1f2937" }) => (
    <Svg size={size}>
      {/* Asphalt strip with dashed centerline */}
      <rect x="0" y="8" width="64" height="48" fill="#37474f" />
      <rect x="0" y="8" width="64" height="3" fill="#eceff1" />
      <rect x="0" y="53" width="64" height="3" fill="#eceff1" />
      <rect x="2" y="30" width="8" height="4" fill="#fdd835" />
      <rect x="14" y="30" width="8" height="4" fill="#fdd835" />
      <rect x="26" y="30" width="8" height="4" fill="#fdd835" />
      <rect x="38" y="30" width="8" height="4" fill="#fdd835" />
      <rect x="50" y="30" width="8" height="4" fill="#fdd835" />
    </Svg>
  ),
};

export function IconGlyph({ iconKey, size = 24, color = "currentColor" }: {
  iconKey: IconKey; size?: number; color?: string;
}) {
  const render = glyphs[iconKey];
  if (!render) return null;
  return <>{render({ size, color })}</>;
}
