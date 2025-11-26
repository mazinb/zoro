'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';

type ProfileState = {
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  incomePrimary: string;
  incomeOther: string;
  incomeNotes: string;
  assetsHomeValue: string;
  assetsOtherPropertyValue: string;
  assetsEquityMutualFunds: string;
  assetsFixedIncome: string;
  assetsCrypto: string;
  assetsCashBank: string;
  assetsOtherAssetsNotes: string;
  liabilitiesHomeLoan: string;
  liabilitiesPersonalLoan: string;
  liabilitiesCreditCardDues: string;
  liabilitiesBusinessOtherCommitments: string;
  insuranceLifeCover: string;
  insuranceHealthCover: string;
  insurancePensionValue: string;
  insuranceNomineeDetails: string;
  estatePrimaryBeneficiaries: string;
  estateGuardianshipWishes: string;
  estateAssetDistributionInstructions: string;
  estateFuneralPreferences: string;
};

const emptyProfile: ProfileState = {
  fullName: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  address: '',
  incomePrimary: '',
  incomeOther: '',
  incomeNotes: '',
  assetsHomeValue: '',
  assetsOtherPropertyValue: '',
  assetsEquityMutualFunds: '',
  assetsFixedIncome: '',
  assetsCrypto: '',
  assetsCashBank: '',
  assetsOtherAssetsNotes: '',
  liabilitiesHomeLoan: '',
  liabilitiesPersonalLoan: '',
  liabilitiesCreditCardDues: '',
  liabilitiesBusinessOtherCommitments: '',
  insuranceLifeCover: '',
  insuranceHealthCover: '',
  insurancePensionValue: '',
  insuranceNomineeDetails: '',
  estatePrimaryBeneficiaries: '',
  estateGuardianshipWishes: '',
  estateAssetDistributionInstructions: '',
  estateFuneralPreferences: '',
};

export default function ProfilePage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const { user, session, signOut } = useAuth();
  const isLoggedIn = !!user;

  const [profile, setProfile] = useState<ProfileState>(emptyProfile);
  const [initialProfile, setInitialProfile] = useState<ProfileState | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoadError(null);
      if (!isLoggedIn || !session?.access_token) {
        setProfile(emptyProfile);
        setInitialProfile(null);
        setLoadingProfile(false);
        return;
      }

      const storageKey = `zoro_profile_${user?.id}_v1`;

      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as ProfileState;
            setProfile(parsed);
            setInitialProfile(parsed);
            setLoadingProfile(false);
            return;
          } catch (e) {
            console.error('Error parsing cached profile:', e);
          }
        }
      }

      try {
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const data = await response.json();
        const p = data.profile || {};

        const loaded: ProfileState = {
          fullName: p.fullName || '',
          dateOfBirth: p.dateOfBirth || '',
          email: p.email || user?.email || '',
          phone: p.phone || '',
          address: p.address || '',
          incomePrimary: p.incomePrimary || '',
          incomeOther: p.incomeOther || '',
          incomeNotes: p.incomeNotes || '',
          assetsHomeValue: p.assetsHomeValue || '',
          assetsOtherPropertyValue: p.assetsOtherPropertyValue || '',
          assetsEquityMutualFunds: p.assetsEquityMutualFunds || '',
          assetsFixedIncome: p.assetsFixedIncome || '',
          assetsCrypto: p.assetsCrypto || '',
          assetsCashBank: p.assetsCashBank || '',
          assetsOtherAssetsNotes: p.assetsOtherAssetsNotes || '',
          liabilitiesHomeLoan: p.liabilitiesHomeLoan || '',
          liabilitiesPersonalLoan: p.liabilitiesPersonalLoan || '',
          liabilitiesCreditCardDues: p.liabilitiesCreditCardDues || '',
          liabilitiesBusinessOtherCommitments:
            p.liabilitiesBusinessOtherCommitments || '',
          insuranceLifeCover: p.insuranceLifeCover || '',
          insuranceHealthCover: p.insuranceHealthCover || '',
          insurancePensionValue: p.insurancePensionValue || '',
          insuranceNomineeDetails: p.insuranceNomineeDetails || '',
          estatePrimaryBeneficiaries: p.estatePrimaryBeneficiaries || '',
          estateGuardianshipWishes: p.estateGuardianshipWishes || '',
          estateAssetDistributionInstructions:
            p.estateAssetDistributionInstructions || '',
          estateFuneralPreferences: p.estateFuneralPreferences || '',
        };

        setProfile(loaded);
        setInitialProfile(loaded);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, JSON.stringify(loaded));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setProfileLoadError(error instanceof Error ? error.message : 'Failed to load profile');
        // Set empty profile so user can still interact
        setProfile(emptyProfile);
        setInitialProfile(emptyProfile);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, session?.access_token, user?.id]);

  const handleChange = (field: keyof ProfileState, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const computeDirtyPayload = () => {
    if (!initialProfile) return {};
    const updates: Partial<ProfileState> = {};
    (Object.keys(profile) as (keyof ProfileState)[]).forEach((key) => {
      if (profile[key] !== initialProfile[key]) {
        updates[key] = profile[key];
      }
    });
    return updates;
  };

  const hasUnsavedChanges =
    !!initialProfile && Object.keys(computeDirtyPayload()).length > 0;

  const handleSave = async () => {
    if (!isLoggedIn || !session?.access_token || !initialProfile) return;
    const updates = computeDirtyPayload();
    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save profile');
      }

      const nextInitial: ProfileState = { ...profile };
      setInitialProfile(nextInitial);

      const storageKey = `zoro_profile_${user?.id}_v1`;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(nextInitial));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to save profile';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      {/* Navigation - matching landing page */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center cursor-pointer"
            aria-label="Back to home"
          >
            <ZoroLogo className="h-10" isDark={darkMode} />
          </button>
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/checkin')}
              className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            >
              Check-ins
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {isLoggedIn ? (
              <button 
                onClick={handleLogout}
                className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                Logout
              </button>
            ) : (
              <button 
                onClick={() => router.push('/login?redirect=/profile')}
                className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <div style={{ padding: '20px', fontFamily: '-apple-system, Inter, sans-serif' }}>

      <h1 className={`text-center text-2xl font-bold ${darkMode ? theme.textClass : 'text-slate-900'} mb-8 mt-8`}>
        Financial Profile & Estate Planner
      </h1>

      {loadingProfile && (
        <div className="max-w-3xl mx-auto mb-6">
          <p className={`${theme.textSecondaryClass} mb-6 text-center`}>Loading your profile…</p>
        </div>
      )}

      {!loadingProfile && (
        <>
          {profileLoadError && (
            <div className={`max-w-3xl mx-auto mb-4 border ${theme.borderClass} rounded-lg p-3 text-sm text-yellow-600 dark:text-yellow-400`}>
              {profileLoadError}. You can still edit and save your profile.
            </div>
          )}
          {saveError && (
            <div className={`max-w-3xl mx-auto mb-4 border ${theme.borderClass} rounded-lg p-3 text-sm text-red-600 dark:text-red-400`}>
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className={`max-w-3xl mx-auto mb-4 border ${theme.borderClass} rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-400`}>
              Profile saved
            </div>
          )}

          {/* Profile Section */}
          <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
            <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Profile</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Full Name</span>
            <input
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'}`}
              value={profile.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Date of Birth</span>
            <input
              type="date"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.dateOfBirth}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Email</span>
            <input
              type="email"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.email}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Phone</span>
            <input
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'}`}
              value={profile.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Address</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.address}
              onChange={(e) => handleChange('address', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
      </div>

      {/* Income Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Income</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Primary Income (Annual)</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.incomePrimary}
              onChange={(e) => handleChange('incomePrimary', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Other Income (Annual)</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.incomeOther}
              onChange={(e) => handleChange('incomeOther', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Income Notes</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.incomeNotes}
              onChange={(e) => handleChange('incomeNotes', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
      </div>

      {/* Assets Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Assets</h2>
        <h3 className={`text-base font-medium ${darkMode ? theme.textClass : 'text-slate-900'} mt-4 mb-3`}>Property</h3>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Home Value</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.assetsHomeValue}
              onChange={(e) => handleChange('assetsHomeValue', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Other Property Value</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.assetsOtherPropertyValue}
              onChange={(e) =>
                handleChange('assetsOtherPropertyValue', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>

        <h3 className={`text-base font-medium ${darkMode ? theme.textClass : 'text-slate-900'} mt-4 mb-3`}>Investments</h3>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Equity / Mutual Funds</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.assetsEquityMutualFunds}
              onChange={(e) =>
                handleChange('assetsEquityMutualFunds', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Fixed Income</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.assetsFixedIncome}
              onChange={(e) =>
                handleChange('assetsFixedIncome', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Crypto</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.assetsCrypto}
              onChange={(e) => handleChange('assetsCrypto', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Cash & Bank</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.assetsCashBank}
              onChange={(e) => handleChange('assetsCashBank', e.target.value)}
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>

        <h3 className={`text-base font-medium ${darkMode ? theme.textClass : 'text-slate-900'} mt-4 mb-3`}>Other Assets</h3>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Vehicles, valuables, collectibles</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.assetsOtherAssetsNotes}
              onChange={(e) =>
                handleChange('assetsOtherAssetsNotes', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
      </div>

      {/* Liabilities Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Liabilities</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Home Loan</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.liabilitiesHomeLoan}
              onChange={(e) =>
                handleChange('liabilitiesHomeLoan', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Personal Loan</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.liabilitiesPersonalLoan}
              onChange={(e) =>
                handleChange('liabilitiesPersonalLoan', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Credit Card Dues</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.liabilitiesCreditCardDues}
              onChange={(e) =>
                handleChange('liabilitiesCreditCardDues', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Business / Other Commitments</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.liabilitiesBusinessOtherCommitments}
              onChange={(e) =>
                handleChange(
                  'liabilitiesBusinessOtherCommitments',
                  e.target.value,
                )
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
      </div>

      {/* Insurance & Pensions Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Insurance & Pensions</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Life Insurance Cover</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.insuranceLifeCover}
              onChange={(e) =>
                handleChange('insuranceLifeCover', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Health Insurance Cover</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.insuranceHealthCover}
              onChange={(e) =>
                handleChange('insuranceHealthCover', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Pension / NPS / 401k Value</span>
            <input
              type="number"
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              value={profile.insurancePensionValue}
              onChange={(e) =>
                handleChange('insurancePensionValue', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Nominee Details</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.insuranceNomineeDetails}
              onChange={(e) =>
                handleChange('insuranceNomineeDetails', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
      </div>

      {/* Estate Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Estate</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Primary Beneficiaries</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.estatePrimaryBeneficiaries}
              onChange={(e) =>
                handleChange('estatePrimaryBeneficiaries', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Guardianship Wishes (if children)</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.estateGuardianshipWishes}
              onChange={(e) =>
                handleChange('estateGuardianshipWishes', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Asset Distribution Instructions</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.estateAssetDistributionInstructions}
              onChange={(e) =>
                handleChange(
                  'estateAssetDistributionInstructions',
                  e.target.value,
                )
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Funeral / Organ Donation Preferences</span>
            <textarea
              className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`}
              value={profile.estateFuneralPreferences}
              onChange={(e) =>
                handleChange('estateFuneralPreferences', e.target.value)
              }
              disabled={loadingProfile}
              readOnly={loadingProfile}
            />
          </label>
        </div>
      </div>

      {/* Private Messages Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Private Messages</h2>
        <p className={`text-sm ${theme.textSecondaryClass} mb-4`}>
          Upload private voice or video messages for your family.
        </p>
        <input type="file" accept="audio/*,video/*" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
      </div>

          <div className="max-w-3xl mx-auto mb-10 flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={!isLoggedIn || !hasUnsavedChanges || saving || loadingProfile}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                !isLoggedIn || !hasUnsavedChanges || saving || loadingProfile
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {!isLoggedIn ? 'Login to save' : saving ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </>
      )}

      <div className="h-24"></div>
      </div>
    </div>
  );
}

