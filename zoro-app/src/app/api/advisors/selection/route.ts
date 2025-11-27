import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AdvisorRecord } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const getClient = (token: string | null) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  if (!token) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

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

type AdvisorSnapshot = {
  id?: string;
  registrationNo?: string;
  name?: string;
  email?: string | null;
  contactPerson?: string | null;
  telephone?: string | null;
  validity?: string | null;
};

type PreferenceRow = {
  advisor_mode: 'self' | 'advisor' | 'pending';
  advisor_id: string | null;
  advisor_registration_no: string | null;
  advisor_snapshot: AdvisorSnapshot | null;
  advisors: AdvisorRow | null;
};

const mapAdvisor = (row: AdvisorRow): AdvisorRecord => ({
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
  metadata: row.metadata ?? null,
});

const buildResponsePayload = (row: PreferenceRow | null) => {
  if (!row) {
    return null;
  }

  const advisor =
    row.advisors?.id || row.advisor_snapshot
      ? {
          id: row.advisors?.id ?? row.advisor_snapshot?.id ?? '',
          registrationNo:
            row.advisors?.registration_no ??
            row.advisor_snapshot?.registrationNo ??
            '',
          name:
            row.advisors?.name ??
            row.advisor_snapshot?.name ??
            'Advisor (archived)',
          email: row.advisors?.email ?? row.advisor_snapshot?.email ?? null,
          contactPerson:
            row.advisors?.contact_person ??
            row.advisor_snapshot?.contactPerson ??
            null,
          telephone:
            row.advisors?.telephone ??
            row.advisor_snapshot?.telephone ??
            null,
          validity:
            row.advisors?.validity ??
            row.advisor_snapshot?.validity ??
            null,
        }
      : null;

  return {
    advisorMode: row.advisor_mode as 'self' | 'advisor' | 'pending',
    advisor,
  };
};

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const supabase = getClient(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from('user_advisor_preferences')
      .select(
        'advisor_mode, advisor_id, advisor_registration_no, advisor_snapshot, advisors (id, registration_no, name, email, telephone, fax, address, contact_person, correspondence_address, validity)',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching advisor preference:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preference' },
        { status: 500 },
      );
    }

    const preferenceRow = data as PreferenceRow | null;

    return NextResponse.json({
      success: true,
      preference: buildResponsePayload(preferenceRow),
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/advisors/selection:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const supabase = getClient(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const advisorMode = body.advisorMode as 'self' | 'advisor';
    const advisorId = body.advisorId as string | undefined;

    if (!['self', 'advisor'].includes(advisorMode)) {
      return NextResponse.json(
        { error: 'Invalid advisor mode' },
        { status: 400 },
      );
    }

    let advisorRow: AdvisorRecord | null = null;
    if (advisorMode === 'advisor') {
      if (!advisorId) {
        return NextResponse.json(
          { error: 'Advisor ID is required' },
          { status: 400 },
        );
      }
      const { data, error } = await supabase
        .from('advisors')
        .select(
          'id, registration_no, name, email, telephone, fax, address, contact_person, correspondence_address, validity, metadata',
        )
        .eq('id', advisorId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Advisor not found' },
          { status: 404 },
        );
      }
      advisorRow = mapAdvisor(data as AdvisorRow);
    }

    const payload = {
      user_id: user.id,
      advisor_mode: advisorMode,
      advisor_id: advisorMode === 'advisor' ? advisorId! : null,
      advisor_registration_no:
        advisorMode === 'advisor' ? advisorRow?.registrationNo ?? null : null,
      advisor_snapshot:
        advisorMode === 'advisor'
          ? {
              id: advisorRow?.id,
              registrationNo: advisorRow?.registrationNo,
              name: advisorRow?.name,
              email: advisorRow?.email,
              contactPerson: advisorRow?.contactPerson,
              telephone: advisorRow?.telephone,
              validity: advisorRow?.validity,
            }
          : null,
    };

    const { error: upsertError } = await supabase
      .from('user_advisor_preferences')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error updating advisor preference:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update preference' },
        { status: 500 },
      );
    }

    const { data, error: fetchError } = await supabase
      .from('user_advisor_preferences')
      .select(
        'advisor_mode, advisor_id, advisor_registration_no, advisor_snapshot, advisors (id, registration_no, name, email, telephone, fax, address, contact_person, correspondence_address, validity)',
      )
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching updated advisor preference:', fetchError);
      return NextResponse.json(
        { error: 'Preference updated but failed to fetch' },
        { status: 500 },
      );
    }

    const updatedRow = data as PreferenceRow | null;

    return NextResponse.json({
      success: true,
      preference: buildResponsePayload(updatedRow),
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/advisors/selection:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

