'use client';

import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useProfile } from '@/components/checkin/ProfileContext';

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
};

const Section = ({ title, description, children, defaultOpen = false }: SectionProps) => (
  <details
    open={defaultOpen}
    style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
      background: 'var(--card)',
    }}
  >
    <summary
      style={{
        listStyle: 'none',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 15,
        fontWeight: 600,
        marginBottom: 12,
      }}
      onClick={(event) => {
        event.preventDefault();
        const target = event.currentTarget.parentElement as HTMLDetailsElement | null;
        if (target) {
          target.open = !target.open;
        }
      }}
    >
      <div>
        {title}
        {description && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, fontWeight: 400 }}>{description}</div>
        )}
      </div>
      <span style={{ fontSize: 18, color: 'var(--muted)' }}>▾</span>
    </summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </details>
);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ProfilePanel = () => {
  const { profile, loading, dirtySections, resetToAIDraft, lastAIGeneration, updateSection } = useProfile();

  const summary = useMemo(() => {
    const totalAssets =
      numeric(profile.assets.homeValue) +
      numeric(profile.assets.otherProperty) +
      numeric(profile.assets.equity) +
      numeric(profile.assets.fixedIncome) +
      numeric(profile.assets.crypto) +
      numeric(profile.assets.cash);

    const totalLiabilities =
      numeric(profile.liabilities.homeLoan) +
      numeric(profile.liabilities.personalLoan) +
      numeric(profile.liabilities.creditCard) +
      numeric(profile.liabilities.businessCommitments);

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    };
  }, [profile.assets, profile.liabilities]);

  if (loading) {
    return (
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Loading AI draft...</div>
        <div className="muted" style={{ fontSize: 13 }}>
          Pulling your latest profile insights
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Profile intelligence</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            AI drafted {lastAIGeneration ? new Date(lastAIGeneration).toLocaleString() : 'just now'}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Net worth
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{formatCurrency(summary.netWorth)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Assets
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatCurrency(summary.totalAssets)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Liabilities
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatCurrency(summary.totalLiabilities)}</div>
          </div>
        </div>
        <button
          onClick={resetToAIDraft}
          className="btn btn-secondary"
          style={{ fontSize: 12, alignSelf: 'flex-start', display: 'flex', gap: 6, alignItems: 'center' }}
          disabled={!Object.values(dirtySections).some(Boolean)}
        >
          <RefreshCw size={14} />
          Revert to AI draft
        </button>
      </div>

      <Section title="Profile" description="Basic contact details" defaultOpen>
        <label style={labelStyle}>
          Full name
          <input
            style={inputStyle}
            value={profile.personal.fullName}
            onChange={(e) => updateSection('personal', { fullName: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Date of birth
          <input
            type="date"
            style={inputStyle}
            value={profile.personal.dateOfBirth}
            onChange={(e) => updateSection('personal', { dateOfBirth: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Email
          <input
            type="email"
            style={inputStyle}
            value={profile.personal.email}
            onChange={(e) => updateSection('personal', { email: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Phone
          <input
            style={inputStyle}
            value={profile.personal.phone}
            onChange={(e) => updateSection('personal', { phone: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Address
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.personal.address}
            onChange={(e) => updateSection('personal', { address: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Income" description="Annual flows the AI detected">
        <label style={labelStyle}>
          Primary income (annual)
          <input
            type="number"
            style={inputStyle}
            value={profile.income.primaryIncome ?? ''}
            onChange={(e) =>
              updateSection('income', { primaryIncome: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Other income
          <input
            type="number"
            style={inputStyle}
            value={profile.income.otherIncome ?? ''}
            onChange={(e) => updateSection('income', { otherIncome: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Notes
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.income.notes}
            onChange={(e) => updateSection('income', { notes: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Assets" description="Snapshot synced to your workspace">
        <label style={labelStyle}>
          Home value
          <input
            type="number"
            style={inputStyle}
            value={profile.assets.homeValue ?? ''}
            onChange={(e) => updateSection('assets', { homeValue: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Other property
          <input
            type="number"
            style={inputStyle}
            value={profile.assets.otherProperty ?? ''}
            onChange={(e) => updateSection('assets', { otherProperty: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Equity / Mutual funds
          <input
            type="number"
            style={inputStyle}
            value={profile.assets.equity ?? ''}
            onChange={(e) => updateSection('assets', { equity: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Fixed income
          <input
            type="number"
            style={inputStyle}
            value={profile.assets.fixedIncome ?? ''}
            onChange={(e) => updateSection('assets', { fixedIncome: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Crypto
          <input
            type="number"
            style={inputStyle}
            value={profile.assets.crypto ?? ''}
            onChange={(e) => updateSection('assets', { crypto: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Cash & bank
          <input
            type="number"
            style={inputStyle}
            value={profile.assets.cash ?? ''}
            onChange={(e) => updateSection('assets', { cash: e.target.value ? Number(e.target.value) : '' })}
          />
        </label>
        <label style={labelStyle}>
          Other assets
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.assets.otherAssets}
            onChange={(e) => updateSection('assets', { otherAssets: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Liabilities">
        <label style={labelStyle}>
          Home loan
          <input
            type="number"
            style={inputStyle}
            value={profile.liabilities.homeLoan ?? ''}
            onChange={(e) =>
              updateSection('liabilities', { homeLoan: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Personal loan
          <input
            type="number"
            style={inputStyle}
            value={profile.liabilities.personalLoan ?? ''}
            onChange={(e) =>
              updateSection('liabilities', { personalLoan: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Credit card dues
          <input
            type="number"
            style={inputStyle}
            value={profile.liabilities.creditCard ?? ''}
            onChange={(e) =>
              updateSection('liabilities', { creditCard: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Business / other commitments
          <input
            type="number"
            style={inputStyle}
            value={profile.liabilities.businessCommitments ?? ''}
            onChange={(e) =>
              updateSection('liabilities', { businessCommitments: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
      </Section>

      <Section title="Insurance & pensions">
        <label style={labelStyle}>
          Life cover
          <input
            type="number"
            style={inputStyle}
            value={profile.insurance.lifeCover ?? ''}
            onChange={(e) =>
              updateSection('insurance', { lifeCover: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Health cover
          <input
            type="number"
            style={inputStyle}
            value={profile.insurance.healthCover ?? ''}
            onChange={(e) =>
              updateSection('insurance', { healthCover: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Pension / NPS value
          <input
            type="number"
            style={inputStyle}
            value={profile.insurance.pensionValue ?? ''}
            onChange={(e) =>
              updateSection('insurance', { pensionValue: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </label>
        <label style={labelStyle}>
          Nominee details
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.insurance.nomineeDetails}
            onChange={(e) => updateSection('insurance', { nomineeDetails: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Estate instructions">
        <label style={labelStyle}>
          Primary beneficiaries
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.estate.beneficiaries}
            onChange={(e) => updateSection('estate', { beneficiaries: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Guardianship wishes
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.estate.guardianship}
            onChange={(e) => updateSection('estate', { guardianship: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Distribution instructions
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.estate.distribution}
            onChange={(e) => updateSection('estate', { distribution: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Final wishes
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.estate.finalWishes}
            onChange={(e) => updateSection('estate', { finalWishes: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Private messages" description="Upload notes or audio for your family">
        <label style={labelStyle}>
          Notes
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={profile.privateMessages.note}
            onChange={(e) => updateSection('privateMessages', { note: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Attachment name
          <input
            style={inputStyle}
            value={profile.privateMessages.attachmentName}
            onChange={(e) => updateSection('privateMessages', { attachmentName: e.target.value })}
          />
        </label>
        <div className="muted" style={{ fontSize: 12 }}>
          Secure uploads arrive soon. For now, document where the files live.
        </div>
      </Section>
    </div>
  );
};

export default ProfilePanel;

