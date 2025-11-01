'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  darkMode?: boolean;
  showArrow?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  darkMode = false,
  showArrow = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: darkMode 
      ? 'bg-white text-slate-900 hover:bg-slate-100' 
      : 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: darkMode
      ? 'border-2 border-slate-700 hover:border-blue-500 text-white'
      : 'border-2 border-slate-200 hover:border-blue-500 text-slate-900',
    ghost: darkMode
      ? 'text-slate-400 hover:text-white'
      : 'text-slate-600 hover:text-slate-900'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
      {showArrow && <ArrowRight className="w-5 h-5" />}
    </button>
  );
};

