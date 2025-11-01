'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  darkMode?: boolean;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  darkMode = false,
  className = '',
  hover = false,
  onClick
}) => {
  const baseClasses = 'border rounded-2xl p-6';
  const bgClass = darkMode ? 'bg-slate-800' : 'bg-white';
  const borderClass = darkMode ? 'border-slate-700' : 'border-slate-200';
  const hoverClass = hover 
    ? (darkMode ? 'hover:border-blue-500 hover:bg-slate-700' : 'hover:border-blue-500 hover:bg-slate-50')
    : '';
  const cursorClass = onClick ? 'cursor-pointer' : '';
  
  return (
    <div
      className={`${baseClasses} ${bgClass} ${borderClass} ${hoverClass} ${cursorClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </div>
  );
};

