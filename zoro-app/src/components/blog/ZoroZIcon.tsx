'use client';

import React from 'react';

interface ZoroZIconProps {
  postId?: string;
  isSelected: boolean;
  className?: string;
}

export const ZoroZIcon: React.FC<ZoroZIconProps> = ({ 
  isSelected, 
  className = "w-5 h-5" 
}) => {
  const iconColor = isSelected ? "white" : "#64748B";
  
  return (
    <svg 
      className={className}
      viewBox="0 0 44 45" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={isSelected ? "Added to Zoro context" : "Add to Zoro context"}
    >
      <g>
        <rect 
          x="6"
          y="8"
          width="32"
          height="5"
          rx="2.5"
          fill={iconColor}
        />
        <path 
          d="M 10 30 L 19 20 L 25 25 L 34 16"
          stroke={iconColor}
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        <path 
          d="M 10 37 L 19 27 L 25 32 L 34 23"
          stroke={iconColor}
          strokeWidth="3.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        <rect 
          x="6"
          y="37"
          width="32"
          height="5"
          rx="2.5"
          fill={iconColor}
        />
      </g>
    </svg>
  );
};

