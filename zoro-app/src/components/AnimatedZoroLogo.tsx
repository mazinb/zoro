'use client';

import { useEffect, useState } from 'react';
import { LOGO_PATHS, LOGO_DIMENSIONS, LOGO_COLORS } from './logo/SharedLogoPaths';
import { ANIMATION_DELAYS } from '@/constants';

interface AnimatedZoroLogoProps {
  className?: string;
  isDark?: boolean;
  onAnimationComplete?: () => void;
}

export const AnimatedZoroLogo = ({ 
  className = "h-8", 
  isDark = false,
  onAnimationComplete 
}: AnimatedZoroLogoProps) => {
  const [showBars, setShowBars] = useState(false);
  const [showBlueLine, setShowBlueLine] = useState(false);
  const [showGreyLine, setShowGreyLine] = useState(false);
  const [showText, setShowText] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Stage 1: Show horizontal bars immediately
    setShowBars(true);

    // Stage 2: Start drawing blue line
    const timer1 = setTimeout(() => {
      setShowBlueLine(true);
    }, ANIMATION_DELAYS.BLUE_LINE);

    // Stage 3: Start drawing grey line
    const timer2 = setTimeout(() => {
      setShowGreyLine(true);
    }, ANIMATION_DELAYS.GREY_LINE);

    // Stage 4: Show text
    const timer3 = setTimeout(() => {
      setShowText(true);
    }, ANIMATION_DELAYS.TEXT);

    // Stage 5: Fade out
    const timer4 = setTimeout(() => {
      setFadeOut(true);
      if (onAnimationComplete) {
        setTimeout(() => {
          onAnimationComplete();
        }, ANIMATION_DELAYS.FADE_OUT_DURATION);
      }
    }, ANIMATION_DELAYS.FADE_OUT);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onAnimationComplete]);

  return (
    <div className={`transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <svg 
        className={className}
        viewBox="0 0 160 50" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Animated Zoro Logo"
      >
        {/* Z Graph Icon */}
        <g>
          {/* Top horizontal bar (solid) - appears first */}
          <rect 
            x={LOGO_DIMENSIONS.TOP_BAR_X}
            y={LOGO_DIMENSIONS.TOP_BAR_Y}
            width={LOGO_DIMENSIONS.TOP_BAR_WIDTH}
            height={LOGO_DIMENSIONS.TOP_BAR_HEIGHT}
            rx="2.5"
            fill={isDark ? LOGO_COLORS.WHITE : LOGO_COLORS.DARK_TEXT}
            className={showBars ? 'opacity-100' : 'opacity-0'}
            style={{ transition: 'opacity 0.3s ease-in' }}
          />
          
          {/* Blue line - draws smoothly */}
          {showBlueLine && (
            <path 
              d={LOGO_PATHS.BLUE_LINE}
              stroke={LOGO_COLORS.BLUE}
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={LOGO_PATHS.BLUE_LINE_LENGTH}
              strokeDashoffset={0}
              className="animate-drawLine"
              style={{ 
                strokeDashoffset: LOGO_PATHS.BLUE_LINE_LENGTH,
                animation: `drawLine ${ANIMATION_DELAYS.LINE_DRAW_DURATION}ms ease-in-out forwards`
              }}
            />
          )}
          
          {/* Grey line - draws smoothly after blue */}
          {showGreyLine && (
            <path 
              d={LOGO_PATHS.GREY_LINE}
              stroke={LOGO_COLORS.GREY}
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={LOGO_PATHS.GREY_LINE_LENGTH}
              strokeDashoffset={0}
              className="animate-drawLine"
              style={{ 
                strokeDashoffset: LOGO_PATHS.GREY_LINE_LENGTH,
                animation: `drawLine ${ANIMATION_DELAYS.LINE_DRAW_DURATION}ms ease-in-out forwards`
              }}
            />
          )}
          
          {/* Bottom horizontal bar (solid) - appears first */}
          <rect 
            x={LOGO_DIMENSIONS.BOTTOM_BAR_X}
            y={LOGO_DIMENSIONS.BOTTOM_BAR_Y}
            width={LOGO_DIMENSIONS.BOTTOM_BAR_WIDTH}
            height={LOGO_DIMENSIONS.BOTTOM_BAR_HEIGHT}
            rx="2.5"
            fill={isDark ? LOGO_COLORS.WHITE : LOGO_COLORS.DARK_TEXT}
            className={showBars ? 'opacity-100' : 'opacity-0'}
            style={{ transition: 'opacity 0.3s ease-in' }}
          />
        </g>
        
        {/* "oro" text - fades in after lines */}
        <g 
          className={`transition-opacity duration-500 ${showText ? 'opacity-100' : 'opacity-0'}`}
        >
          <text 
            x={LOGO_DIMENSIONS.TEXT_X}
            y={LOGO_DIMENSIONS.TEXT_Y}
            fontFamily="system-ui, -apple-system, sans-serif" 
            fontSize={LOGO_DIMENSIONS.FONT_SIZE}
            fontWeight="600"
          >
            <tspan fill={LOGO_COLORS.BLUE}>o</tspan>
            <tspan fill={isDark ? LOGO_COLORS.WHITE : LOGO_COLORS.DARK_TEXT}>r</tspan>
            <tspan fill={LOGO_COLORS.GREY}>o</tspan>
          </text>
        </g>
      </svg>
    </div>
  );
};

