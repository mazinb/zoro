'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Primitive = string | number | null;

export interface PersonalInfo {
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
}

export interface IncomeInfo {
  primaryIncome: Primitive;
  otherIncome: Primitive;
  notes: string;
}

export interface AssetsInfo {
  homeValue: Primitive;
  otherProperty: Primitive;
  equity: Primitive;
  fixedIncome: Primitive;
  crypto: Primitive;
  cash: Primitive;
  otherAssets: string;
}

export interface LiabilitiesInfo {
  homeLoan: Primitive;
  personalLoan: Primitive;
  creditCard: Primitive;
  businessCommitments: Primitive;
}

export interface InsuranceInfo {
  lifeCover: Primitive;
  healthCover: Primitive;
  pensionValue: Primitive;
  nomineeDetails: string;
}

export interface EstateInfo {
  beneficiaries: string;
  guardianship: string;
  distribution: string;
  finalWishes: string;
}

export interface PrivateMessageInfo {
  note: string;
  attachmentName: string;
}

export interface ProfileData {
  personal: PersonalInfo;
  income: IncomeInfo;
  assets: AssetsInfo;
  liabilities: LiabilitiesInfo;
  insurance: InsuranceInfo;
  estate: EstateInfo;
  privateMessages: PrivateMessageInfo;
}

interface ProfileContextValue {
  profile: ProfileData;
  loading: boolean;
  dirtySections: Record<keyof ProfileData, boolean>;
  lastAIGeneration: string | null;
  updateSection: <K extends keyof ProfileData>(section: K, values: Partial<ProfileData[K]>) => void;
  resetToAIDraft: () => void;
}

const DEFAULT_PROFILE: ProfileData = {
  personal: {
    fullName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    address: '',
  },
  income: {
    primaryIncome: '',
    otherIncome: '',
    notes: '',
  },
  assets: {
    homeValue: '',
    otherProperty: '',
    equity: '',
    fixedIncome: '',
    crypto: '',
    cash: '',
    otherAssets: '',
  },
  liabilities: {
    homeLoan: '',
    personalLoan: '',
    creditCard: '',
    businessCommitments: '',
  },
  insurance: {
    lifeCover: '',
    healthCover: '',
    pensionValue: '',
    nomineeDetails: '',
  },
  estate: {
    beneficiaries: '',
    guardianship: '',
    distribution: '',
    finalWishes: '',
  },
  privateMessages: {
    note: '',
    attachmentName: '',
  },
};

const AI_PROFILE_DRAFT: ProfileData = {
  personal: {
    fullName: 'Aanya Sharma',
    dateOfBirth: '1989-04-12',
    email: 'aanya.sharma@email.com',
    phone: '+91 90000 12345',
    address: 'Indiranagar, Bengaluru',
  },
  income: {
    primaryIncome: 4200000,
    otherIncome: 650000,
    notes: 'Salary from fintech startup. Rental income from Pune property.',
  },
  assets: {
    homeValue: 15000000,
    otherProperty: 6500000,
    equity: 3200000,
    fixedIncome: 1800000,
    crypto: 350000,
    cash: 1200000,
    otherAssets: 'VW Taigun, gold jewellery (₹8L), art (₹3L)',
  },
  liabilities: {
    homeLoan: 8200000,
    personalLoan: 0,
    creditCard: 120000,
    businessCommitments: 500000,
  },
  insurance: {
    lifeCover: 15000000,
    healthCover: 2500000,
    pensionValue: 900000,
    nomineeDetails: 'Primary: Arjun Sharma (spouse). Secondary: Rhea Sharma (sister).',
  },
  estate: {
    beneficiaries: 'Arjun Sharma (60%), Parents Anand & Leela (20%), Education trust (20%)',
    guardianship: 'If we have kids, appoint Rhea Sharma & Aman Joshi as guardians.',
    distribution: 'Primary home to spouse, investments split between spouse and trust.',
    finalWishes: 'Prefer cremation, organ donation consent recorded at Apollo.',
  },
  privateMessages: {
    note: 'Drafted “Birthday message for future kids” audio note. Upload pending.',
    attachmentName: 'family_legacy_message.m4a',
  },
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const cloneProfile = (profile: ProfileData): ProfileData => JSON.parse(JSON.stringify(profile));

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<ProfileData>(() => cloneProfile(DEFAULT_PROFILE));
  const [loading, setLoading] = useState(true);
  const [dirtySections, setDirtySections] = useState<Record<keyof ProfileData, boolean>>({
    personal: false,
    income: false,
    assets: false,
    liabilities: false,
    insurance: false,
    estate: false,
    privateMessages: false,
  });
  const [lastAIGeneration, setLastAIGeneration] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProfile(cloneProfile(AI_PROFILE_DRAFT));
      setLastAIGeneration(new Date().toISOString());
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const updateSection = <K extends keyof ProfileData>(section: K, values: Partial<ProfileData[K]>) => {
    setProfile((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...values,
      },
    }));
    setDirtySections((prev) => ({
      ...prev,
      [section]: true,
    }));
  };

  const resetToAIDraft = () => {
    setProfile(cloneProfile(AI_PROFILE_DRAFT));
    setDirtySections({
      personal: false,
      income: false,
      assets: false,
      liabilities: false,
      insurance: false,
      estate: false,
      privateMessages: false,
    });
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        dirtySections,
        lastAIGeneration,
        updateSection,
        resetToAIDraft,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
};

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Primitive = string | number | null;

export interface PersonalInfo {
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
}

export interface IncomeInfo {
  primaryIncome: Primitive;
  otherIncome: Primitive;
  notes: string;
}

export interface AssetsInfo {
  homeValue: Primitive;
  otherProperty: Primitive;
  equity: Primitive;
  fixedIncome: Primitive;
  crypto: Primitive;
  cash: Primitive;
  otherAssets: string;
}

export interface LiabilitiesInfo {
  homeLoan: Primitive;
  personalLoan: Primitive;
  creditCard: Primitive;
  businessCommitments: Primitive;
}

export interface InsuranceInfo {
  lifeCover: Primitive;
  healthCover: Primitive;
  pensionValue: Primitive;
  nomineeDetails: string;
}

export interface EstateInfo {
  beneficiaries: string;
  guardianship: string;
  distribution: string;
  finalWishes: string;
}

export interface PrivateMessageInfo {
  note: string;
  attachmentName: string;
}

export interface ProfileData {
  personal: PersonalInfo;
  income: IncomeInfo;
  assets: AssetsInfo;
  liabilities: LiabilitiesInfo;
  insurance: InsuranceInfo;
  estate: EstateInfo;
  privateMessages: PrivateMessageInfo;
}

interface ProfileContextValue {
  profile: ProfileData;
  loading: boolean;
  dirtySections: Record<keyof ProfileData, boolean>;
  lastAIGeneration: string | null;
  updateSection: <K extends keyof ProfileData>(section: K, values: Partial<ProfileData[K]>) => void;
  resetToAIDraft: () => void;
}

const DEFAULT_PROFILE: ProfileData = {
  personal: {
    fullName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    address: '',
  },
  income: {
    primaryIncome: '',
    otherIncome: '',
    notes: '',
  },
  assets: {
    homeValue: '',
    otherProperty: '',
    equity: '',
    fixedIncome: '',
    crypto: '',
    cash: '',
    otherAssets: '',
  },
  liabilities: {
    homeLoan: '',
    personalLoan: '',
    creditCard: '',
    businessCommitments: '',
  },
  insurance: {
    lifeCover: '',
    healthCover: '',
    pensionValue: '',
    nomineeDetails: '',
  },
  estate: {
    beneficiaries: '',
    guardianship: '',
    distribution: '',
    finalWishes: '',
  },
  privateMessages: {
    note: '',
    attachmentName: '',
  },
};

const AI_PROFILE_DRAFT: ProfileData = {
  personal: {
    fullName: 'Aanya Sharma',
    dateOfBirth: '1989-04-12',
    email: 'aanya.sharma@email.com',
    phone: '+91 90000 12345',
    address: 'Indiranagar, Bengaluru',
  },
  income: {
    primaryIncome: 4200000,
    otherIncome: 650000,
    notes: 'Salary from fintech startup. Rental income from Pune property.',
  },
  assets: {
    homeValue: 15000000,
    otherProperty: 6500000,
    equity: 3200000,
    fixedIncome: 1800000,
    crypto: 350000,
    cash: 1200000,
    otherAssets: 'VW Taigun, gold jewellery (₹8L), art (₹3L)',
  },
  liabilities: {
    homeLoan: 8200000,
    personalLoan: 0,
    creditCard: 120000,
    businessCommitments: 500000,
  },
  insurance: {
    lifeCover: 15000000,
    healthCover: 2500000,
    pensionValue: 900000,
    nomineeDetails: 'Primary: Arjun Sharma (spouse). Secondary: Rhea Sharma (sister).',
  },
  estate: {
    beneficiaries: 'Arjun Sharma (60%), Parents Anand & Leela (20%), Education trust (20%)',
    guardianship: 'If we have kids, appoint Rhea Sharma & Aman Joshi as guardians.',
    distribution: 'Primary home to spouse, investments split between spouse and trust.',
    finalWishes: 'Prefer cremation, organ donation consent recorded at Apollo.',
  },
  privateMessages: {
    note: 'Drafted “Birthday message for future kids” audio note. Upload pending.',
    attachmentName: 'family_legacy_message.m4a',
  },
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const cloneProfile = (profile: ProfileData): ProfileData => JSON.parse(JSON.stringify(profile));

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<ProfileData>(() => cloneProfile(DEFAULT_PROFILE));
  const [loading, setLoading] = useState(true);
  const [dirtySections, setDirtySections] = useState<Record<keyof ProfileData, boolean>>({
    personal: false,
    income: false,
    assets: false,
    liabilities: false,
    insurance: false,
    estate: false,
    privateMessages: false,
  });
  const [lastAIGeneration, setLastAIGeneration] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProfile(cloneProfile(AI_PROFILE_DRAFT));
      setLastAIGeneration(new Date().toISOString());
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const updateSection = <K extends keyof ProfileData>(section: K, values: Partial<ProfileData[K]>) => {
    setProfile((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...values,
      },
    }));
    setDirtySections((prev) => ({
      ...prev,
      [section]: true,
    }));
  };

  const resetToAIDraft = () => {
    setProfile(cloneProfile(AI_PROFILE_DRAFT));
    setDirtySections({
      personal: false,
      income: false,
      assets: false,
      liabilities: false,
      insurance: false,
      estate: false,
      privateMessages: false,
    });
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        dirtySections,
        lastAIGeneration,
        updateSection,
        resetToAIDraft,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
};


