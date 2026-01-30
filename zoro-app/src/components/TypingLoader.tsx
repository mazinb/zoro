'use client';

import React, { useState, useEffect } from 'react';

interface TypingLoaderProps {
  darkMode: boolean;
  onComplete: () => void;
}

const messages = [
  'Creating your account',
  'Reading your goals',
  'Drafting your welcome email',
];

export const TypingLoader: React.FC<TypingLoaderProps> = ({ darkMode, onComplete }) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'wiping'>('typing');

  useEffect(() => {
    if (currentMessageIndex >= messages.length) {
      onComplete();
      return;
    }

    const currentMessage = messages[currentMessageIndex];
    const typingSpeed = 60; // ms per character (slightly slower for readability)
    const pauseDuration = 1200; // ms to pause after typing (read time)
    const wipingSpeed = 25; // ms per character (fast wipe)

    if (phase === 'typing') {
      if (displayedText.length < currentMessage.length) {
        const timer = setTimeout(() => {
          setDisplayedText(currentMessage.slice(0, displayedText.length + 1));
        }, typingSpeed);
        return () => clearTimeout(timer);
      } else {
        // Finished typing, pause to read
        const pauseTimer = setTimeout(() => {
          setPhase('pausing');
        }, pauseDuration);
        return () => clearTimeout(pauseTimer);
      }
    } else if (phase === 'pausing') {
      // Brief pause before wiping
      const wipeStartTimer = setTimeout(() => {
        setPhase('wiping');
      }, 200);
      return () => clearTimeout(wipeStartTimer);
    } else if (phase === 'wiping') {
      if (displayedText.length > 0) {
        const wipeTimer = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1));
        }, wipingSpeed);
        return () => clearTimeout(wipeTimer);
      } else {
        // Finished wiping, move to next message
        setPhase('typing');
        setCurrentMessageIndex(currentMessageIndex + 1);
      }
    }
  }, [currentMessageIndex, displayedText, phase, onComplete]);

  const textColor = darkMode ? 'text-slate-300' : 'text-slate-700';
  const cursorColor = darkMode ? 'bg-slate-300' : 'bg-slate-700';

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} transition-colors duration-300`}>
      <div className="flex flex-col items-center space-y-6">
        {messages.map((message, index) => {
          const isActive = index === currentMessageIndex;
          const showText = isActive && displayedText.length > 0;
          
          return (
            <div
              key={index}
              className={`text-lg md:text-xl font-medium transition-opacity duration-500 ${
                isActive ? textColor : 'opacity-20'
              }`}
              style={{ minHeight: '1.75rem' }}
            >
              {showText ? (
                <span>
                  {displayedText}
                  {phase !== 'wiping' && (
                    <span className={`inline-block w-0.5 h-5 ml-1 ${cursorColor} animate-pulse`} />
                  )}
                </span>
              ) : (
                <span className="opacity-20">{message}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

