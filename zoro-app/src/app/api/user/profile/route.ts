import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(token?: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        [
          'email',
          'full_name',
          'phone',
          'date_of_birth',
          'address',
          'city',
          'state',
          'country',
          'income_primary',
          'income_other',
          'income_notes',
          'assets_home_value',
          'assets_other_property_value',
          'assets_equity_mutual_funds',
          'assets_fixed_income',
          'assets_crypto',
          'assets_cash_bank',
          'assets_other_assets_notes',
          'liabilities_home_loan',
          'liabilities_personal_loan',
          'liabilities_credit_card_dues',
          'liabilities_business_other_commitments',
          'insurance_life_cover',
          'insurance_health_cover',
          'insurance_pension_value',
          'insurance_nominee_details',
          'estate_primary_beneficiaries',
          'estate_guardianship_wishes',
          'estate_asset_distribution_instructions',
          'estate_funeral_preferences',
        ].join(','),
      )
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: error.message },
        { status: 500 },
      );
    }

    const profile = data || {};

    return NextResponse.json(
      {
        success: true,
        profile: {
          email: profile.email ?? user.email ?? null,
          fullName: profile.full_name ?? null,
          phone: profile.phone ?? null,
          dateOfBirth: profile.date_of_birth ?? null,
          address: profile.address ?? null,
          city: profile.city ?? null,
          state: profile.state ?? null,
          country: profile.country ?? 'India',
          incomePrimary: profile.income_primary ?? null,
          incomeOther: profile.income_other ?? null,
          incomeNotes: profile.income_notes ?? null,
          assetsHomeValue: profile.assets_home_value ?? null,
          assetsOtherPropertyValue: profile.assets_other_property_value ?? null,
          assetsEquityMutualFunds: profile.assets_equity_mutual_funds ?? null,
          assetsFixedIncome: profile.assets_fixed_income ?? null,
          assetsCrypto: profile.assets_crypto ?? null,
          assetsCashBank: profile.assets_cash_bank ?? null,
          assetsOtherAssetsNotes: profile.assets_other_assets_notes ?? null,
          liabilitiesHomeLoan: profile.liabilities_home_loan ?? null,
          liabilitiesPersonalLoan: profile.liabilities_personal_loan ?? null,
          liabilitiesCreditCardDues: profile.liabilities_credit_card_dues ?? null,
          liabilitiesBusinessOtherCommitments:
            profile.liabilities_business_other_commitments ?? null,
          insuranceLifeCover: profile.insurance_life_cover ?? null,
          insuranceHealthCover: profile.insurance_health_cover ?? null,
          insurancePensionValue: profile.insurance_pension_value ?? null,
          insuranceNomineeDetails: profile.insurance_nominee_details ?? null,
          estatePrimaryBeneficiaries:
            profile.estate_primary_beneficiaries ?? null,
          estateGuardianshipWishes: profile.estate_guardianship_wishes ?? null,
          estateAssetDistributionInstructions:
            profile.estate_asset_distribution_instructions ?? null,
          estateFuneralPreferences: profile.estate_funeral_preferences ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in GET /api/user/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 },
      );
    }

    const body = await request.json();

    const map: Record<string, string> = {
      email: 'email',
      fullName: 'full_name',
      phone: 'phone',
      dateOfBirth: 'date_of_birth',
      address: 'address',
      city: 'city',
      state: 'state',
      country: 'country',
      incomePrimary: 'income_primary',
      incomeOther: 'income_other',
      incomeNotes: 'income_notes',
      assetsHomeValue: 'assets_home_value',
      assetsOtherPropertyValue: 'assets_other_property_value',
      assetsEquityMutualFunds: 'assets_equity_mutual_funds',
      assetsFixedIncome: 'assets_fixed_income',
      assetsCrypto: 'assets_crypto',
      assetsCashBank: 'assets_cash_bank',
      assetsOtherAssetsNotes: 'assets_other_assets_notes',
      liabilitiesHomeLoan: 'liabilities_home_loan',
      liabilitiesPersonalLoan: 'liabilities_personal_loan',
      liabilitiesCreditCardDues: 'liabilities_credit_card_dues',
      liabilitiesBusinessOtherCommitments:
        'liabilities_business_other_commitments',
      insuranceLifeCover: 'insurance_life_cover',
      insuranceHealthCover: 'insurance_health_cover',
      insurancePensionValue: 'insurance_pension_value',
      insuranceNomineeDetails: 'insurance_nominee_details',
      estatePrimaryBeneficiaries: 'estate_primary_beneficiaries',
      estateGuardianshipWishes: 'estate_guardianship_wishes',
      estateAssetDistributionInstructions:
        'estate_asset_distribution_instructions',
      estateFuneralPreferences: 'estate_funeral_preferences',
    };

    const updates: Record<string, unknown> = {};

    Object.entries(map).forEach(([bodyKey, column]) => {
      if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
        const rawValue = body[bodyKey as keyof typeof body];
        const value =
          rawValue === '' || rawValue === null || rawValue === undefined
            ? null
            : rawValue;
        updates[column] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: true, message: 'No changes to apply' },
        { status: 200 },
      );
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, message: 'Profile updated successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in POST /api/user/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}


