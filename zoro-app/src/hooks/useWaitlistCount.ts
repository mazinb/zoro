import { useEffect, useState } from 'react';

export const useWaitlistCount = (enabled = true) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;

    fetch('/api/waitlist/count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.count !== undefined) {
          setCount(data.count);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCount(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return count;
};

