import { useState, useEffect, useCallback } from 'react';
import { AdvisorRecord } from '@/types';

interface UseAdvisorDirectoryOptions {
  perPage?: number;
  enabled?: boolean;
}

interface UseAdvisorDirectoryResult {
  advisors: AdvisorRecord[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export const useAdvisorDirectory = (
  options: UseAdvisorDirectoryOptions = {},
): UseAdvisorDirectoryResult => {
  const { perPage = 10, enabled = true } = options;
  const [advisors, setAdvisors] = useState<AdvisorRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const fetchPage = useCallback(
    async (targetPage: number, replace = false) => {
      if (!enabled) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: targetPage.toString(),
          perPage: perPage.toString(),
        });
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }
        const response = await fetch(`/api/advisors?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load advisors');
        }
        const payload = await response.json();
        const fetched: AdvisorRecord[] = payload.data || [];
        setAdvisors((prev) => {
          if (replace) {
            return fetched;
          }
          const existingIds = new Set(prev.map((item) => item.id));
          const merged = [...prev];
          fetched.forEach((item) => {
            if (!existingIds.has(item.id)) {
              merged.push(item);
            }
          });
          return merged;
        });
        setHasMore(Boolean(payload.meta?.hasMore));
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load advisors');
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, enabled, perPage],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    fetchPage(1, true);
  }, [fetchPage, debouncedSearch, enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || loading || !hasMore) {
      return;
    }
    fetchPage(page + 1, false);
  }, [enabled, fetchPage, hasMore, loading, page]);

  const refresh = useCallback(() => {
    if (!enabled) {
      return;
    }
    fetchPage(1, true);
  }, [enabled, fetchPage]);

  return {
    advisors,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    hasMore,
    loadMore,
    refresh,
  };
};

