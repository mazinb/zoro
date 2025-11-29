'use client';

import { useAnalytics } from '@/hooks/useAnalytics';
import { Button, ButtonProps } from '@/components/ui/Button';

interface TrackedButtonProps extends ButtonProps {
  eventName: string;
  eventCategory?: string;
  eventLabel?: string;
  trackOnMount?: boolean;
}

export function TrackedButton({
  eventName,
  eventCategory,
  eventLabel,
  trackOnMount,
  onClick,
  children,
  id,
  className,
  ...props
}: TrackedButtonProps) {
  const { trackClick } = useAnalytics();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Track the click
    trackClick(eventName, {
      category: eventCategory || 'button',
      label: eventLabel,
      elementId: id,
      elementClass: className,
      elementText: typeof children === 'string' ? children : undefined,
    });

    // Call original onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Button {...props} id={id} className={className} onClick={handleClick}>
      {children}
    </Button>
  );
}

