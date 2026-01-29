import { ExpenseBucket } from './types';

export const formatInputValue = (value: string | null, currency: string): string => {
  if (!value) return '';
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;
  
  if (currency === '₹') {
    // Indian numbering system with separators
    return numValue.toLocaleString('en-IN');
  } else {
    // Standard formatting with commas
    return numValue.toLocaleString();
  }
};

export const parseInputValue = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  // Check for crore - match "c", "cr", or "crore" (case insensitive)
  // Match: "5c", "5cr", "5 crore", "crore", or standalone "c"/"cr" with word boundaries
  const hasCrore = /^[0-9.]+c$|^[0-9.]+cr$|crore|\bc\b|\bcr\b/.test(trimmed);
  // Match: "5l", "5lac", "5lakh", "lakh", or standalone "l"/"lac"/"lakh" with word boundaries
  const hasLakh = /^[0-9.]+l$|^[0-9.]+lac$|^[0-9.]+lakh$|lac|lakh|\bl\b/.test(trimmed);
  // Match: "5m", "5million", "million", or standalone "m" with word boundaries
  const hasMillion = /^[0-9.]+m$|million|\bm\b/.test(trimmed);
  // Match: "5k", "5thousand", "thousand", or standalone "k" with word boundaries
  const hasThousand = /^[0-9.]+k$|thousand|\bk\b/.test(trimmed);

  const numeric = parseFloat(trimmed.replace(/[^\d.]/g, ''));
  if (Number.isNaN(numeric)) {
    return '';
  }

  let multiplier = 1;
  if (hasCrore) {
    multiplier = 10000000;
  } else if (hasLakh) {
    multiplier = 100000;
  } else if (hasMillion) {
    multiplier = 1000000;
  } else if (hasThousand) {
    multiplier = 1000;
  }

  return String(numeric * multiplier);
};

export const formatCurrency = (amount: number, currency: string): string => {
  // Helper to format with 3 significant digits
  const formatWithSignificantDigits = (num: number): string => {
    if (num >= 1000) {
      const magnitude = Math.floor(Math.log10(num));
      const significantDigits = 3;
      const divisor = Math.pow(10, magnitude - (significantDigits - 1));
      const rounded = Math.round(num / divisor) * divisor;
      return rounded.toLocaleString();
    }
    return num.toLocaleString();
  };

  if (currency === '₹') {
    // Indian numbering system (lakhs/crores)
    if (amount >= 10000000) {
      // Crores - format as 1.XX Cr with 3 significant digits
      const crores = amount / 10000000;
      const formatted = crores.toPrecision(3);
      return `₹${formatted} Cr`;
    } else if (amount >= 100000) {
      // Lakhs
      const lakhs = amount / 100000;
      const formatted = lakhs.toPrecision(3);
      return `₹${formatted} L`;
    } else {
      // Thousands
      return `₹${amount.toLocaleString('en-IN')}`;
    }
  } else if (currency === 'AED') {
    // UAE Dirham - format over 1M as 1.XX M
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      const formatted = millions.toPrecision(3);
      return `AED ${formatted} M`;
    }
    return `AED ${amount.toLocaleString()}`;
  } else {
    // Standard formatting for other currencies (฿, $, €) - format over 1M as 1.XX M
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      const formatted = millions.toPrecision(3);
      return `${currency}${formatted} M`;
    }
    return `${currency}${amount.toLocaleString()}`;
  }
};

export const isValueInRange = (value: number, bucket: ExpenseBucket): boolean => {
  if (!bucket.min || !bucket.max) return true;
  return value >= bucket.min && value <= bucket.max;
};

export const getTotalMonthlyExpenses = (customBuckets?: Record<string, ExpenseBucket> | null): number => {
  if (!customBuckets) return 0;
  return Object.values(customBuckets).reduce((sum, bucket) => sum + bucket.value, 0);
};

