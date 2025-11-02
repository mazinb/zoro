'use client';

import { LOGO_PATHS, LOGO_DIMENSIONS, LOGO_COLORS } from './logo/SharedLogoPaths';

interface ZoroLogoProps {
  className?: string;
  isDark?: boolean;
}

export const ZoroLogo = ({ className = "h-8", isDark = false }: ZoroLogoProps) => (
  <svg 
    className={className}
    viewBox="0 0 160 50" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Zoro Logo"
  >
    {/* Z Graph Icon */}
    <g>
      {/* Top horizontal bar (solid) */}
      <rect 
        x={LOGO_DIMENSIONS.TOP_BAR_X}
        y={LOGO_DIMENSIONS.TOP_BAR_Y}
        width={LOGO_DIMENSIONS.TOP_BAR_WIDTH}
        height={LOGO_DIMENSIONS.TOP_BAR_HEIGHT}
        rx="2.5"
        fill={isDark ? LOGO_COLORS.WHITE : LOGO_COLORS.DARK_TEXT}
      />
      
      {/* Two parallel graph lines - blue and grey, stacked vertically with more offset */}
      {/* First line - Blue (visible in both modes) */}
      <path 
        d={LOGO_PATHS.BLUE_LINE}
        stroke={LOGO_COLORS.BLUE}
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
      {/* Second line - Grey (bottom, larger y-offset) */}
      <path 
        d={LOGO_PATHS.GREY_LINE}
        stroke={isDark ? "#94a3b8" : LOGO_COLORS.GREY}
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Bottom horizontal bar (solid) */}
      <rect 
        x={LOGO_DIMENSIONS.BOTTOM_BAR_X}
        y={LOGO_DIMENSIONS.BOTTOM_BAR_Y}
        width={LOGO_DIMENSIONS.BOTTOM_BAR_WIDTH}
        height={LOGO_DIMENSIONS.BOTTOM_BAR_HEIGHT}
        rx="2.5"
        fill={isDark ? LOGO_COLORS.WHITE : LOGO_COLORS.DARK_TEXT}
      />
    </g>
    
    {/* "oro" text - larger font, closer to Z */}
    <text 
      x={LOGO_DIMENSIONS.TEXT_X}
      y={LOGO_DIMENSIONS.TEXT_Y}
      fontFamily="system-ui, -apple-system, sans-serif" 
      fontSize={LOGO_DIMENSIONS.FONT_SIZE}
      fontWeight="600"
    >
            <tspan fill={LOGO_COLORS.BLUE}>o</tspan>
            <tspan fill={isDark ? LOGO_COLORS.WHITE : LOGO_COLORS.DARK_TEXT}>r</tspan>
            <tspan fill={isDark ? "#94a3b8" : LOGO_COLORS.GREY}>o</tspan>
    </text>
  </svg>
);

