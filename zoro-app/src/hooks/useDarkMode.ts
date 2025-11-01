import { useState, useEffect } from 'react';

export const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check user's time or default to IST
    const now = new Date();
    const hour = now.getHours();
    // Dark mode between 6 PM and 6 AM
    setDarkMode(hour >= 18 || hour < 6);
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return { darkMode, setDarkMode, toggleDarkMode };
};

