'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type DarkModeContextValue = {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
};

const DarkModeContext = createContext<DarkModeContextValue | undefined>(
  undefined,
);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [darkMode, setDarkMode] = useState(false);

  // Initialize from time of day
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    requestAnimationFrame(() => {
      setDarkMode(hour >= 18 || hour < 6);
    });
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = (): DarkModeContextValue => {
  const ctx = useContext(DarkModeContext);
  if (!ctx) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return ctx;
};

