'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Search, ShieldCheck, UserPlus, Sparkles } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';
import { AdvisorRecord } from '@/types';
import { useAdvisorDirectory } from '@/hooks/useAdvisorDirectory';

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

type AdvisorPreferenceState = {
  advisorMode: 'self' | 'advisor' | 'pending';
  advisor: {
    id: string;
    registrationNo: string;
    name: string;
    email?: string | null;
    contactPerson?: string | null;
    telephone?: string | null;
    validity?: string | null;
  } | null;
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
  const [advisorPreference, setAdvisorPreference] = useState<AdvisorPreferenceState | null>(null);
  const [advisorPrefLoading, setAdvisorPrefLoading] = useState(false);
  const [advisorPrefError, setAdvisorPrefError] = useState<string | null>(null);
  const [showAdvisorEditor, setShowAdvisorEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<'self' | 'advisor'>('self');
  const [pendingAdvisor, setPendingAdvisor] = useState<AdvisorRecord | null>(null);
  const [savingAdvisor, setSavingAdvisor] = useState(false);

  const {
    advisors: directoryAdvisors,
    loading: directoryLoading,
    error: directoryError,
    searchTerm: directorySearchTerm,
    setSearchTerm: setDirectorySearchTerm,
    hasMore: directoryHasMore,
    loadMore: directoryLoadMore,
    refresh: directoryRefresh,
  } = useAdvisorDirectory({
    perPage: 6,
    enabled: showAdvisorEditor && !!session?.access_token,
  });

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const loadAdvisorPreference = useCallback(async () => {
    if (!session?.access_token) {
      setAdvisorPreference(null);
      return;
    }
    setAdvisorPrefLoading(true);
    setAdvisorPrefError(null);
    try {
      const response = await fetch('/api/advisors/selection', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          setAdvisorPreference(null);
        } else if (response.status === 401) {
          setAdvisorPreference(null);
        } else {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load advisor preference');
        }
      } else {
        const payload = await response.json();
        setAdvisorPreference(payload.preference || null);
      }
    } catch (error) {
      setAdvisorPrefError(
        error instanceof Error ? error.message : 'Failed to load advisor preference',
      );
    } finally {
      setAdvisorPrefLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) {
      setAdvisorPreference(null);
      return;
    }
    loadAdvisorPreference();
  }, [loadAdvisorPreference, session?.access_token]);

  const openAdvisorEditor = () => {
    if (!isLoggedIn) return;
    setShowAdvisorEditor(true);
    setAdvisorPrefError(null);
    setEditorMode(advisorPreference?.advisorMode === 'advisor' ? 'advisor' : 'self');
    setPendingAdvisor(advisorPreference?.advisor ?? null);
    directoryRefresh();
  };

  const closeAdvisorEditor = () => {
    setShowAdvisorEditor(false);
    setAdvisorPrefError(null);
    setEditorMode(advisorPreference?.advisorMode === 'advisor' ? 'advisor' : 'self');
    setPendingAdvisor(advisorPreference?.advisor ?? null);
  };

  const handleAdvisorPreferenceSave = async () => {
    if (!session?.access_token) {
      setAdvisorPrefError('Please sign in to update your advisor preference.');
      return;
    }
    if (editorMode === 'advisor' && !pendingAdvisor) {
      setAdvisorPrefError('Select an advisor to continue.');
      return;
    }
    setSavingAdvisor(true);
    setAdvisorPrefError(null);
    try {
      const response = await fetch('/api/advisors/selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          advisorMode: editorMode,
          advisorId: editorMode === 'advisor' ? pendingAdvisor?.id : undefined,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save advisor preference');
      }
      const payload = await response.json();
      setAdvisorPreference(payload.preference || null);
      setShowAdvisorEditor(false);
    } catch (error) {
      setAdvisorPrefError(
        error instanceof Error ? error.message : 'Failed to save advisor preference',
      );
    } finally {
      setSavingAdvisor(false);
    }
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

      <div className={`max-w-3xl mx-auto mt-8 mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className={`text-sm font-semibold ${darkMode ? theme.textClass : 'text-slate-900'}`}>
              Advisor collaboration
            </p>
            {advisorPrefLoading ? (
              <p className={`${theme.textSecondaryClass} text-sm mt-1`}>
                Checking your advisor status…
              </p>
            ) : advisorPreference?.advisorMode === 'advisor' && advisorPreference.advisor ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={darkMode ? 'text-blue-300' : 'text-blue-600'} />
                  <span className={`font-medium ${theme.textClass}`}>
                    {advisorPreference.advisor.name}
                  </span>
                </div>
                <p className={`${theme.textSecondaryClass} text-sm`}>
                  Reg. {advisorPreference.advisor.registrationNo}
                </p>
                {advisorPreference.advisor.email && (
                  <p className={`${theme.textSecondaryClass} text-sm`}>
                    {advisorPreference.advisor.email}
                  </p>
                )}
              </div>
            ) : (
              <p className={`${theme.textSecondaryClass} text-sm mt-1`}>
                You’re currently self-directed. Loop in a SEBI-registered advisor whenever you like.
              </p>
            )}
          </div>
          {isLoggedIn ? (
            <button
              onClick={showAdvisorEditor ? closeAdvisorEditor : openAdvisorEditor}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${theme.borderClass} ${
                darkMode ? 'text-white hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100'
              }`}
            >
              {showAdvisorEditor
                ? 'Close editor'
                : advisorPreference?.advisor
                ? 'Change advisor'
                : 'Add an advisor'}
            </button>
          ) : (
            <div className={`flex items-center gap-2 text-sm ${theme.textSecondaryClass}`}>
              <UserPlus className="w-4 h-4" />
              Login to manage advisors
            </div>
          )}
        </div>
        {advisorPrefError && (
          <p className="text-sm text-red-500 mt-3" role="alert">
            {advisorPrefError}
          </p>
        )}
        {showAdvisorEditor && isLoggedIn && (
          <div className={`mt-6 border-t ${theme.borderClass} pt-4 space-y-4`}>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  className="accent-blue-600"
                  checked={editorMode === 'self'}
                  onChange={() => setEditorMode('self')}
                />
                <div>
                  <p className={`text-sm font-medium ${theme.textClass}`}>Keep it self-directed</p>
                  <p className={`text-xs ${theme.textSecondaryClass}`}>
                    Stay in charge and invite an advisor later.
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  className="accent-blue-600"
                  checked={editorMode === 'advisor'}
                  onChange={() => setEditorMode('advisor')}
                />
                <div>
                  <p className={`text-sm font-medium ${theme.textClass}`}>Work with an advisor</p>
                  <p className={`text-xs ${theme.textSecondaryClass}`}>
                    Pick from the SEBI registry and we’ll keep them in the loop.
                  </p>
                </div>
              </label>
            </div>

            {editorMode === 'advisor' && (
              <>
                <button
                  onClick={() => {
                    // TODO: Implement goal-based advisor matching
                    alert('This feature will help you find advisors based on your financial goals. Coming soon!');
                  }}
                  className={`w-full px-4 py-3 rounded-lg text-sm font-semibold mb-3 flex items-center justify-center gap-2 ${
                    darkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Help me find based on my goals
                </button>

                <div className="flex items-center gap-3 my-2">
                  <div className={`flex-1 h-px ${theme.borderClass}`}></div>
                  <span className={`text-xs font-medium ${theme.textSecondaryClass}`}>OR</span>
                  <div className={`flex-1 h-px ${theme.borderClass}`}></div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${theme.borderClass}`}>
                  <Search className={darkMode ? 'text-slate-400' : 'text-slate-500'} />
                  <input
                    type="text"
                    value={directorySearchTerm}
                    onChange={(e) => setDirectorySearchTerm(e.target.value)}
                    placeholder="Search by registration no. or name"
                    className={`flex-1 bg-transparent focus:outline-none ${theme.textClass} placeholder:${theme.textSecondaryClass}`}
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {directoryLoading && directoryAdvisors.length === 0 ? (
                    <p className={`${theme.textSecondaryClass} text-sm`}>Loading advisors…</p>
                  ) : directoryAdvisors.length === 0 ? (
                    <p className={`${theme.textSecondaryClass} text-sm`}>
                      No advisors found. Adjust your search.
                    </p>
                  ) : (
                    directoryAdvisors.map((advisor) => {
                      const isSelected = pendingAdvisor?.id === advisor.id;
                      return (
                        <button
                          key={advisor.id}
                          onClick={() => setPendingAdvisor(advisor)}
                          className={`w-full text-left border rounded-lg p-3 transition ${
                            isSelected
                              ? darkMode
                                ? 'border-blue-400 bg-blue-900/20'
                                : 'border-blue-500 bg-blue-50'
                              : theme.borderClass
                          }`}
                        >
                          <p className={`font-semibold ${theme.textClass}`}>{advisor.name}</p>
                          <p className={`text-xs ${theme.textSecondaryClass}`}>
                            {advisor.registrationNo}
                          </p>
                          {advisor.contactPerson && (
                            <p className={`text-xs ${theme.textSecondaryClass}`}>
                              Contact: {advisor.contactPerson}
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {directoryError && (
                  <p className="text-sm text-red-500" role="alert">
                    {directoryError}
                  </p>
                )}

                {directoryHasMore && (
                  <button
                    onClick={directoryLoadMore}
                    disabled={directoryLoading}
                    className={`w-full text-sm px-4 py-2 rounded-lg border ${theme.borderClass} ${
                      darkMode ? 'text-white hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {directoryLoading ? 'Loading…' : 'Load more advisors'}
                  </button>
                )}
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeAdvisorEditor}
                className={`px-4 py-2 rounded-lg text-sm ${
                  darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleAdvisorPreferenceSave}
                disabled={
                  savingAdvisor || (editorMode === 'advisor' && !pendingAdvisor)
                }
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  savingAdvisor || (editorMode === 'advisor' && !pendingAdvisor)
                    ? 'bg-slate-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {savingAdvisor ? 'Saving…' : 'Save preference'}
              </button>
            </div>
          </div>
        )}
      </div>

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

