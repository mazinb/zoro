import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AdvisorRecord } from '@/types';
import { advisorsCache } from '@/lib/advisors-cache';

// Revalidate every hour (3600 seconds) for ISR
export const revalidate = 3600;

type AdvisorRow = {
  id: string;
  registration_no: string;
  name: string;
  email: string | null;
  telephone: string | null;
  fax: string | null;
  address: string | null;
  contact_person: string | null;
  correspondence_address: string | null;
  validity: string | null;
  metadata: Record<string, unknown> | null;
};

type CachedResponse = {
  data: AdvisorRecord[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    hasMore: boolean;
  };
};

const mapAdvisorRow = (row: AdvisorRow): AdvisorRecord => ({
  id: row.id,
  registrationNo: row.registration_no,
  name: row.name,
  email: row.email,
  telephone: row.telephone,
  fax: row.fax,
  address: row.address,
  contactPerson: row.contact_person,
  correspondenceAddress: row.correspondence_address,
  validity: row.validity,
  metadata: row.metadata,
});

async function fetchAdvisorsFromDB(
  search: string,
  registration: string,
  page: number,
  perPage: number,
): Promise<CachedResponse> {
  let query = supabase
    .from('advisors')
    .select(
      'id, registration_no, name, email, telephone, fax, address, contact_person, correspondence_address, validity, metadata',
      { count: 'exact' },
    )
    .order('name', { ascending: true });

  if (registration) {
    query = query.eq('registration_no', registration);
  } else if (search) {
    query = query.or(
      `registration_no.ilike.%${search}%,name.ilike.%${search}%`,
    );
  }

  if (registration) {
    query = query.limit(5);
  } else {
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching advisors:', error);
    throw new Error('Failed to fetch advisors');
  }

  const normalized = (data as AdvisorRow[] | null)?.map(mapAdvisorRow) ?? [];
  const total = registration ? normalized.length : count ?? normalized.length;
  const hasMore =
    registration || !count
      ? false
      : (page - 1) * perPage + normalized.length < count;

  return {
    data: normalized,
    meta: {
      page: registration ? 1 : page,
      perPage: registration ? normalized.length : perPage,
      total,
      hasMore,
    },
  };
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';
    const registration = url.searchParams.get('registration')?.trim() ?? '';
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
    const perPageParam = parseInt(url.searchParams.get('perPage') || '12', 10);

    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const perPage =
      Number.isNaN(perPageParam) || perPageParam < 1
        ? 12
        : Math.min(perPageParam, 50);

    // Check cache first
    const cacheKey = advisorsCache.getCacheKeyForQuery(
      search,
      registration,
      page,
      perPage,
    );
    const cached = advisorsCache.get<CachedResponse>(cacheKey);

    if (cached) {
      // Return cached response with appropriate headers
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control':
            'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache miss - fetch from database
    const result = await fetchAdvisorsFromDB(search, registration, page, perPage);

    // Store in cache (longer TTL for exact registration lookups)
    if (registration) {
      advisorsCache.setExactLookup(cacheKey, result);
    } else {
      advisorsCache.set(cacheKey, result);
    }

    // Return with cache headers
    return NextResponse.json(result, {
      headers: {
        'Cache-Control':
          'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/advisors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

