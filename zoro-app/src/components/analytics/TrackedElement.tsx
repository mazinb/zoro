'use client';

import { useAnalytics } from '@/hooks/useAnalytics';
import { ReactNode, MouseEvent } from 'react';

interface TrackedElementProps {
  eventName: string;
  eventCategory?: string;
  eventLabel?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  metadata?: Record<string, unknown>;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  className?: string;
  id?: string;
  [key: string]: unknown;
}

export function TrackedElement({
  eventName,
  eventCategory,
  eventLabel,
  elementId,
  elementClass,
  elementText,
  metadata,
  children,
  onClick,
  className,
  id,
  ...props
}: TrackedElementProps) {
  const { trackClick } = useAnalytics();

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    // Track the click
    trackClick(eventName, {
      category: eventCategory || 'interaction',
      label: eventLabel,
      elementId: elementId || id,
      elementClass: elementClass || className,
      elementText: elementText || (typeof children === 'string' ? children : undefined),
      metadata,
    });

    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div
      {...props}
      id={elementId || id}
      className={elementClass || className}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

