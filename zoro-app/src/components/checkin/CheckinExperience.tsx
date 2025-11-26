'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProfilePanel from '@/components/checkin/ProfilePanel';
import { ProfileProvider, useProfile } from '@/components/checkin/ProfileContext';

const TOKENS = {
  accent: '#2563eb',
  bgLight: '#fafafa',
  bgDark: '#0a0a0a',
  cardLight: '#ffffff',
  cardDark: '#111111',
  textLight: '#171717',
  textDark: '#e5e5e5',
  mutedLight: '#737373',
  mutedDark: '#a3a3a3',
  borderLight: '#e5e5e5',
  borderDark: '#262626',
};

function useOnScreen(ref: React.RefObject<HTMLElement>, rootMargin = '0px') {
  const [isIntersecting, setIntersecting] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.12 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return isIntersecting;
}

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const InvestIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const TaxIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const RetirementIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ProfilePulse = () => {
  const { profile, loading } = useProfile();

  const nudges = useMemo(() => {
    if (loading) return [];
    const suggestions: { label: string; reason: string }[] = [];
    if (numeric(profile.liabilities.homeLoan) > 0) {
      suggestions.push({
        label: 'Plan for big purchases',
        reason: 'Mortgage + upcoming assets detected',
      });
    }
    if (numeric(profile.assets.equity) > 0) {
      suggestions.push({
        label: 'Invest smarter',
        reason: 'Equity and SIP footprints spotted',
      });
    }
    if (numeric(profile.insurance.lifeCover) < numeric(profile.income.primaryIncome) * 4) {
      suggestions.push({
        label: 'Review insurance',
        reason: 'Life cover looks light for your income',
      });
    }
    return suggestions.slice(0, 2);
  }, [loading, profile]);

  if (loading) {
    return null;
  }

  return (
    <section
      className="card"
      style={{
        marginTop: 32,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Zoro's quick read on you</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Drafted from your profile. Tune it on the right anytime.
      </div>
      {nudges.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          Fill out your profile to unlock personalized nudges.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nudges.map((nudge) => (
            <div
              key={nudge.label}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{nudge.label}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {nudge.reason}
                </div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const Hero = ({
  frequency,
  setFrequency,
  isLoggedIn,
}: {
  frequency: string;
  setFrequency: (value: string) => void;
  isLoggedIn: boolean;
}) => {
  const freqs = ['Daily', 'Every 3 days', 'Weekly', 'Bi-weekly', 'Monthly'];

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
        {isLoggedIn ? 'Check-in workspace' : 'Your financial OS in one place'}
      </h1>
      {!isLoggedIn && (
        <p className="muted" style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, maxWidth: 640 }}>
          Zoro drafts your profile from signals, you edit what matters, and personalized check-ins keep you honest. Reply
          to any mail or tweak the control panel here.
        </p>
      )}

      <div style={{ marginTop: 32 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {isLoggedIn ? 'Your frequency' : 'Pick your frequency'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {freqs.map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: frequency === f ? 'var(--text)' : 'transparent',
                color: frequency === f ? 'var(--bg)' : 'var(--text)',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.2s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!isLoggedIn && (
        <div style={{ marginTop: 28 }}>
          <button className="btn" onClick={() => alert('Redirect to onboarding flow')}>
            Sync with WhatsApp
          </button>
          <span className="muted" style={{ fontSize: 13, marginLeft: 16 }}>
            Takes 30 seconds
          </span>
        </div>
      )}
    </section>
  );
};

const SampleEmail = ({ frequency, isLoggedIn }: { frequency: string; isLoggedIn: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useOnScreen(ref, '-80px');

  if (isLoggedIn) return null;

  return (
    <section className="card" style={{ marginTop: 64 }} ref={ref}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Sample {frequency.toLowerCase()} check-in</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        This is what hits your inbox (and WhatsApp)
      </div>

      <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)' }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{frequency} financial check-in</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
          Your personalized summary
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>This week's snapshot</div>
          <MiniBarChart animate={visible} />
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Spending: ₹42,300 • Saved: ₹8,200 • Progress: On track
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Priority for this week</div>
          <div style={{ fontSize: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 6, lineHeight: 1.5 }}>
            Review recurring subscriptions — you're spending ₹1,700/month on services you rarely use
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>One action to take</div>
          <div style={{ fontSize: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 6, lineHeight: 1.5 }}>
            Move 20% of this month's savings (₹1,640) into your index fund SIP. Set up auto-review in 6 months.
          </div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        💬 Reply or edit your workspace to update goals, change frequency, or ask questions
      </div>
    </section>
  );
};

const MiniBarChart = ({ animate }: { animate: boolean }) => {
  const bars = [28, 45, 35, 70, 60];
  return (
    <svg viewBox="0 0 160 40" width="160" height="40" style={{ marginTop: 4 }}>
      {bars.map((v, i) => {
        const x = 4 + i * 30;
        const h = (v / 100) * 32;
        const y = 36 - h;
        return (
          <rect
            key={i}
            x={x}
            y={animate ? y : 36}
            width="14"
            height={animate ? h : 0}
            rx="2"
            fill="var(--text)"
            opacity="0.5"
            style={{ transition: 'all 0.6s ease-out' }}
          />
        );
      })}
    </svg>
  );
};

const Goals = ({
  selectedGoals,
  toggleGoal,
  isLoggedIn,
  showUpdateError,
  saveGoals,
  hasUnsavedChanges,
  isSaving,
}: {
  selectedGoals: string[];
  toggleGoal: (id: string) => void;
  isLoggedIn: boolean;
  showUpdateError: boolean;
  saveGoals: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
}) => {
  const goals = [
    { id: 'save', icon: SaveIcon, title: 'Save consistently', desc: 'Build reserves, tame spending' },
    { id: 'invest', icon: InvestIcon, title: 'Invest smarter', desc: 'Diversify, monitor returns, rebalance calmly' },
    { id: 'home', icon: HomeIcon, title: 'Big purchases', desc: 'Home down payments, education, lifestyle upgrades' },
    { id: 'insurance', icon: ShieldIcon, title: 'Review insurance', desc: 'Health, life, property coverage gaps' },
    { id: 'tax', icon: TaxIcon, title: 'Tax optimization', desc: 'Maximize deductions, plan long-term shelters' },
    { id: 'retirement', icon: RetirementIcon, title: 'Retirement planning', desc: 'Set targets, simulate cashflows' },
  ];

  return (
    <section style={{ marginTop: 64 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' }}>
        {isLoggedIn ? 'Your financial goals' : 'Pick your financial goals'}
      </h2>
      <p className="muted" style={{ fontSize: 15, marginBottom: 32, lineHeight: 1.5 }}>
        {isLoggedIn
          ? `You've selected ${selectedGoals.length} goal${selectedGoals.length !== 1 ? 's' : ''}. Check-ins prioritise these.`
          : 'Select 1-3 goals. Your check-ins will focus on these priorities.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {goals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <div
              key={goal.id}
              className={`card goal-card ${isSelected ? 'selected' : ''}`}
              style={{ padding: 20 }}
              onClick={() => toggleGoal(goal.id)}
            >
              <div style={{ marginBottom: 12 }}>
                <Icon />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{goal.title}</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                {goal.desc}
              </div>
            </div>
          );
        })}
      </div>

      {selectedGoals.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {!isLoggedIn ? 'Log in to sync with WhatsApp' : hasUnsavedChanges ? 'Unsaved edits' : 'All changes saved'}
              </div>
            </div>
            {isLoggedIn && hasUnsavedChanges && (
              <button
                className="btn"
                onClick={saveGoals}
                disabled={isSaving || selectedGoals.length > 3}
                style={{ fontSize: 13, flexShrink: 0 }}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            )}
          </div>
          {(selectedGoals.length > 3 || (isLoggedIn && hasUnsavedChanges && showUpdateError)) && (
            <div
              style={{
                fontSize: 13,
                marginTop: 12,
                color: '#dc2626',
              }}
            >
              {selectedGoals.length > 3 ? 'Focus on max 3 goals. Add more later.' : 'Can only update goals once per hour'}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const CTA = ({ isLoggedIn, selectedGoals }: { isLoggedIn: boolean; selectedGoals: string[] }) => {
  if (isLoggedIn) {
    return (
      <section className="card" style={{ marginTop: 64, textAlign: 'center' }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>
          {selectedGoals.length > 0 ? 'All set!' : 'Select your goals to continue'}
        </h3>
        <p className="muted" style={{ fontSize: 15, marginBottom: 24 }}>
          {selectedGoals.length > 0
            ? 'We will send your next check-in soon. Peek at the profile panel anytime to keep Zoro honest.'
            : 'Pick at least one goal above to start receiving nudges.'}
        </p>
        {selectedGoals.length > 0 && (
          <button className="btn" onClick={() => alert('Navigate to dashboard')}>
            View dashboard
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="card" style={{ marginTop: 64, textAlign: 'center' }}>
      <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>Ready to start?</h3>
      <p className="muted" style={{ fontSize: 15, marginBottom: 24 }}>
        {selectedGoals.length > 0
          ? `You've selected ${selectedGoals.length} goal${selectedGoals.length !== 1 ? 's' : ''}. Sign up to sync with AI drafts.`
          : 'Set up your first check-in in less than a minute'}
      </p>
      <button className="btn" onClick={() => alert('Redirect to onboarding flow')}>
        Launch workspace
      </button>
    </section>
  );
};

const Footer = () => (
  <footer style={{ marginTop: 80, paddingTop: 32, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
    <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
      Built for people who prefer clarity to chaos. AI drafts, you approve. Privacy-friendly. Cancel anytime.
    </div>
  </footer>
);

const CheckinExperienceInner = () => {
  const [frequency, setFrequency] = useState('Weekly');
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [savedGoals, setSavedGoals] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGoalUpdate, setLastGoalUpdate] = useState<number | null>(null);
  const [showUpdateError, setShowUpdateError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeTheme = theme ?? (prefersDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = activeTheme;
  }, [theme]);

  const handleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      const initialGoals = ['save', 'invest'];
      setSelectedGoals(initialGoals);
      setSavedGoals(initialGoals);
      setLastGoalUpdate(Date.now() - 3700000);
      setIsLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedGoals([]);
    setSavedGoals([]);
    setLastGoalUpdate(null);
    setShowUpdateError(false);
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const saveGoals = () => {
    if (isLoggedIn && lastGoalUpdate) {
      const hourInMs = 60 * 60 * 1000;
      const timeSinceUpdate = Date.now() - lastGoalUpdate;

      if (timeSinceUpdate < hourInMs) {
        setShowUpdateError(true);
        setTimeout(() => setShowUpdateError(false), 4000);
        return;
      }
    }

    setIsSaving(true);
    setTimeout(() => {
      setSavedGoals([...selectedGoals]);
      if (isLoggedIn) {
        setLastGoalUpdate(Date.now());
      }
      setIsSaving(false);
    }, 800);
  };

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify([...selectedGoals].sort()) !== JSON.stringify([...savedGoals].sort());
  }, [selectedGoals, savedGoals]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        :root {
          --bg: ${TOKENS.bgLight};
          --card: ${TOKENS.cardLight};
          --text: ${TOKENS.textLight};
          --muted: ${TOKENS.mutedLight};
          --border: ${TOKENS.borderLight};
          --accent: ${TOKENS.accent};
        }
        [data-theme="dark"] {
          --bg: ${TOKENS.bgDark};
          --card: ${TOKENS.cardDark};
          --text: ${TOKENS.textDark};
          --muted: ${TOKENS.mutedDark};
          --border: ${TOKENS.borderDark};
        }
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 24px;
        }
        .muted { color: var(--muted); }
        .btn {
          background: var(--text);
          color: var(--bg);
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
          text-decoration: none;
          display: inline-block;
        }
        .btn:hover { opacity: 0.8; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
        }
        .goal-card {
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .goal-card:hover { transform: translateY(-2px); }
        .goal-card.selected {
          border-color: var(--text);
          background: var(--bg);
        }
        .goal-card.selected::after {
          content: '✓';
          position: absolute;
          top: 12px;
          right: 12px;
          width: 20px;
          height: 20px;
          background: var(--text);
          color: var(--bg);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        .checkin-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 32px;
          align-items: flex-start;
        }
        @media (max-width: 1024px) {
          .checkin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <main
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--text)',
          transition: 'background 0.3s, color 0.3s',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Zoro workspace</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                AI drafts + your edits = aligned finances
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? null : 'dark'))}
                style={{ fontSize: 13 }}
              >
                {theme === 'dark' ? 'Light' : theme === 'light' ? 'Auto' : 'Dark'}
              </button>
              {!isLoggedIn ? (
                <button className="btn" onClick={handleLogin} disabled={isLoading} style={{ fontSize: 13 }}>
                  {isLoading ? 'Loading...' : 'Login (demo)'}
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={handleLogout} style={{ fontSize: 13 }}>
                  Logout
                </button>
              )}
            </div>
          </header>

          <div className="checkin-grid">
            <div>
              <Hero frequency={frequency} setFrequency={setFrequency} isLoggedIn={isLoggedIn} />

              <ProfilePulse />

              <SampleEmail frequency={frequency} isLoggedIn={isLoggedIn} />

              <Goals
                selectedGoals={selectedGoals}
                toggleGoal={toggleGoal}
                isLoggedIn={isLoggedIn}
                showUpdateError={showUpdateError}
                saveGoals={saveGoals}
                hasUnsavedChanges={hasUnsavedChanges}
                isSaving={isSaving}
              />

              <CTA isLoggedIn={isLoggedIn} selectedGoals={selectedGoals} />

              <Footer />
            </div>
            <aside>
              <ProfilePanel />
            </aside>
          </div>
        </div>
      </main>
    </>
  );
};

const CheckinExperience = () => (
  <ProfileProvider>
    <CheckinExperienceInner />
  </ProfileProvider>
);

export default CheckinExperience;

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProfilePanel from '@/components/checkin/ProfilePanel';
import { ProfileProvider, useProfile } from '@/components/checkin/ProfileContext';

const TOKENS = {
  accent: '#2563eb',
  bgLight: '#fafafa',
  bgDark: '#0a0a0a',
  cardLight: '#ffffff',
  cardDark: '#111111',
  textLight: '#171717',
  textDark: '#e5e5e5',
  mutedLight: '#737373',
  mutedDark: '#a3a3a3',
  borderLight: '#e5e5e5',
  borderDark: '#262626',
};

function useOnScreen(ref: React.RefObject<HTMLElement>, rootMargin = '0px') {
  const [isIntersecting, setIntersecting] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.12 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return isIntersecting;
}

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const InvestIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const TaxIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const RetirementIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ProfilePulse = () => {
  const { profile, loading } = useProfile();

  const nudges = useMemo(() => {
    if (loading) return [];
    const suggestions: { label: string; reason: string }[] = [];
    if (numeric(profile.liabilities.homeLoan) > 0) {
      suggestions.push({
        label: 'Plan for big purchases',
        reason: 'Mortgage + upcoming assets detected',
      });
    }
    if (numeric(profile.assets.equity) > 0) {
      suggestions.push({
        label: 'Invest smarter',
        reason: 'Equity + SIP footprints spotted',
      });
    }
    if (numeric(profile.insurance.lifeCover) < numeric(profile.income.primaryIncome) * 4) {
      suggestions.push({
        label: 'Review insurance',
        reason: 'Life cover looks light for your income',
      });
    }
    return suggestions.slice(0, 2);
  }, [loading, profile]);

  if (loading) {
    return null;
  }

  return (
    <section
      className="card"
      style={{
        marginTop: 32,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Zoro’s quick read on you</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Drafted from your profile. Fine-tune on the right anytime.
      </div>
      {nudges.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          Fill out your profile to unlock personalized nudges.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {nudges.map((nudge) => (
            <div
              key={nudge.label}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{nudge.label}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {nudge.reason}
                </div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const Hero = ({
  frequency,
  setFrequency,
  isLoggedIn,
}: {
  frequency: string;
  setFrequency: (value: string) => void;
  isLoggedIn: boolean;
}) => {
  const freqs = ['Daily', 'Every 3 days', 'Weekly', 'Bi-weekly', 'Monthly'];

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
        {isLoggedIn ? 'Check-in workspace' : 'Your financial OS in one place'}
      </h1>
      {!isLoggedIn && (
        <p className="muted" style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, maxWidth: 640 }}>
          Zoro drafts your profile from signals, you edit what matters, and personalized check-ins keep you honest.
          Reply to any mail or tweak the control panel here.
        </p>
      )}

      <div style={{ marginTop: 32 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {isLoggedIn ? 'Your frequency' : 'Pick your frequency'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {freqs.map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: frequency === f ? 'var(--text)' : 'transparent',
                color: frequency === f ? 'var(--bg)' : 'var(--text)',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.2s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!isLoggedIn && (
        <div style={{ marginTop: 28 }}>
          <button className="btn" onClick={() => alert('Redirect to onboarding flow')}>
            Sync with WhatsApp
          </button>
          <span className="muted" style={{ fontSize: 13, marginLeft: 16 }}>
            Takes 30 seconds
          </span>
        </div>
      )}
    </section>
  );
};

const SampleEmail = ({ frequency, isLoggedIn }: { frequency: string; isLoggedIn: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useOnScreen(ref, '-80px');

  if (isLoggedIn) return null;

  return (
    <section className="card" style={{ marginTop: 64 }} ref={ref}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Sample {frequency.toLowerCase()} check-in</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
        This is what hits your inbox (and WhatsApp)
      </div>

      <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)' }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{frequency} financial check-in</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
          Your personalized summary
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>This week’s snapshot</div>
          <MiniBarChart animate={visible} />
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Spending: ₹42,300 • Saved: ₹8,200 • Progress: On track
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Priority for this week</div>
          <div style={{ fontSize: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 6, lineHeight: 1.5 }}>
            Review recurring subscriptions — you’re spending ₹1,700/month on services you rarely use
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>One action to take</div>
          <div style={{ fontSize: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 6, lineHeight: 1.5 }}>
            Move 20% of this month’s savings (₹1,640) into your index fund SIP. Set up auto-review in 6 months.
          </div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        💬 Reply or edit your workspace to update goals, change frequency, or ask questions
      </div>
    </section>
  );
};

const MiniBarChart = ({ animate }: { animate: boolean }) => {
  const bars = [28, 45, 35, 70, 60];
  return (
    <svg viewBox="0 0 160 40" width="160" height="40" style={{ marginTop: 4 }}>
      {bars.map((v, i) => {
        const x = 4 + i * 30;
        const h = (v / 100) * 32;
        const y = 36 - h;
        return (
          <rect
            key={i}
            x={x}
            y={animate ? y : 36}
            width="14"
            height={animate ? h : 0}
            rx="2"
            fill="var(--text)"
            opacity="0.5"
            style={{ transition: 'all 0.6s ease-out' }}
          />
        );
      })}
    </svg>
  );
};

const Goals = ({
  selectedGoals,
  toggleGoal,
  isLoggedIn,
  showUpdateError,
  saveGoals,
  hasUnsavedChanges,
  isSaving,
}: {
  selectedGoals: string[];
  toggleGoal: (id: string) => void;
  isLoggedIn: boolean;
  showUpdateError: boolean;
  saveGoals: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
}) => {
  const goals = [
    { id: 'save', icon: SaveIcon, title: 'Save consistently', desc: 'Build reserves, tame spending' },
    { id: 'invest', icon: InvestIcon, title: 'Invest smarter', desc: 'Diversify, monitor returns, rebalance calmly' },
    { id: 'home', icon: HomeIcon, title: 'Big purchases', desc: 'Home down payments, education, lifestyle upgrades' },
    { id: 'insurance', icon: ShieldIcon, title: 'Review insurance', desc: 'Health, life, property coverage gaps' },
    { id: 'tax', icon: TaxIcon, title: 'Tax optimization', desc: 'Maximize deductions, plan long-term shelters' },
    { id: 'retirement', icon: RetirementIcon, title: 'Retirement planning', desc: 'Set targets, simulate cashflows' },
  ];

  return (
    <section style={{ marginTop: 64 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' }}>
        {isLoggedIn ? 'Your financial goals' : 'Pick your financial goals'}
      </h2>
      <p className="muted" style={{ fontSize: 15, marginBottom: 32, lineHeight: 1.5 }}>
        {isLoggedIn
          ? `You’ve selected ${selectedGoals.length} goal${selectedGoals.length !== 1 ? 's' : ''}. Check-ins prioritise these.`
          : 'Select 1-3 goals. Your check-ins will focus on these priorities.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {goals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <div
              key={goal.id}
              className={`card goal-card ${isSelected ? 'selected' : ''}`}
              style={{ padding: 20 }}
              onClick={() => toggleGoal(goal.id)}
            >
              <div style={{ marginBottom: 12 }}>
                <Icon />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{goal.title}</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                {goal.desc}
              </div>
            </div>
          );
        })}
      </div>

      {selectedGoals.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {!isLoggedIn ? 'Log in to sync with WhatsApp' : hasUnsavedChanges ? 'Unsaved edits' : 'All changes saved'}
              </div>
            </div>
            {isLoggedIn && hasUnsavedChanges && (
              <button
                className='btn'
                onClick={saveGoals}
                disabled={isSaving || selectedGoals.length > 3}
                style={{ fontSize: 13, flexShrink: 0 }}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            )}
          </div>
          {(selectedGoals.length > 3 || (isLoggedIn && hasUnsavedChanges && showUpdateError)) && (
            <div
              style={{
                fontSize: 13,
                marginTop: 12,
                color: '#dc2626',
              }}
            >
              {selectedGoals.length > 3 ? 'Focus on max 3 goals. Add more later.' : 'Can only update goals once per hour'}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const CTA = ({ isLoggedIn, selectedGoals }: { isLoggedIn: boolean; selectedGoals: string[] }) => {
  if (isLoggedIn) {
    return (
      <section className="card" style={{ marginTop: 64, textAlign: 'center' }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>
          {selectedGoals.length > 0 ? 'All set!' : 'Select your goals to continue'}
        </h3>
        <p className="muted" style={{ fontSize: 15, marginBottom: 24 }}>
          {selectedGoals.length > 0
            ? 'We’ll send your next check-in soon. Peek at the profile panel anytime to keep Zoro honest.'
            : 'Pick at least one goal above to start receiving nudges.'}
        </p>
        {selectedGoals.length > 0 && (
          <button className="btn" onClick={() => alert('Navigate to dashboard')}>
            View dashboard
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="card" style={{ marginTop: 64, textAlign: 'center' }}>
      <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>Ready to start?</h3>
      <p className="muted" style={{ fontSize: 15, marginBottom: 24 }}>
        {selectedGoals.length > 0
          ? `You’ve selected ${selectedGoals.length} goal${selectedGoals.length !== 1 ? 's' : ''}. Sign up to sync with AI drafts.`
          : 'Set up your first check-in in less than a minute'}
      </p>
      <button className="btn" onClick={() => alert('Redirect to onboarding flow')}>
        Launch workspace
      </button>
    </section>
  );
};

const Footer = () => (
  <footer style={{ marginTop: 80, paddingTop: 32, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
    <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
      Built for people who prefer clarity to chaos. AI drafts, you approve. Privacy-friendly. Cancel anytime.
    </div>
  </footer>
);

const CheckinExperienceInner = () => {
  const [frequency, setFrequency] = useState('Weekly');
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [savedGoals, setSavedGoals] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGoalUpdate, setLastGoalUpdate] = useState<number | null>(null);
  const [showUpdateError, setShowUpdateError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const activeTheme = theme ?? (prefersDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = activeTheme;
  }, [theme]);

  const handleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      const initialGoals = ['save', 'invest'];
      setSelectedGoals(initialGoals);
      setSavedGoals(initialGoals);
      setLastGoalUpdate(Date.now() - 3700000);
      setIsLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedGoals([]);
    setSavedGoals([]);
    setLastGoalUpdate(null);
    setShowUpdateError(false);
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const saveGoals = () => {
    if (isLoggedIn && lastGoalUpdate) {
      const hourInMs = 60 * 60 * 1000;
      const timeSinceUpdate = Date.now() - lastGoalUpdate;

      if (timeSinceUpdate < hourInMs) {
        setShowUpdateError(true);
        setTimeout(() => setShowUpdateError(false), 4000);
        return;
      }
    }

    setIsSaving(true);
    setTimeout(() => {
      setSavedGoals([...selectedGoals]);
      if (isLoggedIn) {
        setLastGoalUpdate(Date.now());
      }
      setIsSaving(false);
    }, 800);
  };

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify([...selectedGoals].sort()) !== JSON.stringify([...savedGoals].sort());
  }, [selectedGoals, savedGoals]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        :root {
          --bg: ${TOKENS.bgLight};
          --card: ${TOKENS.cardLight};
          --text: ${TOKENS.textLight};
          --muted: ${TOKENS.mutedLight};
          --border: ${TOKENS.borderLight};
          --accent: ${TOKENS.accent};
        }
        [data-theme="dark"] {
          --bg: ${TOKENS.bgDark};
          --card: ${TOKENS.cardDark};
          --text: ${TOKENS.textDark};
          --muted: ${TOKENS.mutedDark};
          --border: ${TOKENS.borderDark};
        }
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 24px;
        }
        .muted { color: var(--muted); }
        .btn {
          background: var(--text);
          color: var(--bg);
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
          text-decoration: none;
          display: inline-block;
        }
        .btn:hover { opacity: 0.8; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
        }
        .goal-card {
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .goal-card:hover { transform: translateY(-2px); }
        .goal-card.selected {
          border-color: var(--text);
          background: var(--bg);
        }
        .goal-card.selected::after {
          content: '✓';
          position: absolute;
          top: 12px;
          right: 12px;
          width: 20px;
          height: 20px;
          background: var(--text);
          color: var(--bg);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        .checkin-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 32px;
          align-items: flex-start;
        }
        @media (max-width: 1024px) {
          .checkin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <main
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--text)',
          transition: 'background 0.3s, color 0.3s',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Zoro Workspace</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                AI drafts + your edits = aligned finances
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? null : 'dark'))}
                style={{ fontSize: 13 }}
              >
                {theme === 'dark' ? 'Light' : theme === 'light' ? 'Auto' : 'Dark'}
              </button>
              {!isLoggedIn ? (
                <button className="btn" onClick={handleLogin} disabled={isLoading} style={{ fontSize: 13 }}>
                  {isLoading ? 'Loading...' : 'Login (demo)'}
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={handleLogout} style={{ fontSize: 13 }}>
                  Logout
                </button>
              )}
            </div>
          </header>

          <div className="checkin-grid">
            <div>
              <Hero frequency={frequency} setFrequency={setFrequency} isLoggedIn={isLoggedIn} />

              <ProfilePulse />

              <SampleEmail frequency={frequency} isLoggedIn={isLoggedIn} />

              <Goals
                selectedGoals={selectedGoals}
                toggleGoal={toggleGoal}
                isLoggedIn={isLoggedIn}
                showUpdateError={showUpdateError}
                saveGoals={saveGoals}
                hasUnsavedChanges={hasUnsavedChanges}
                isSaving={isSaving}
              />

              <CTA isLoggedIn={isLoggedIn} selectedGoals={selectedGoals} />

              <Footer />
            </div>
            <aside>
              <ProfilePanel />
            </aside>
          </div>
        </div>
      </main>
    </>
  );
};

const CheckinExperience = () => (
  <ProfileProvider>
    <CheckinExperienceInner />
  </ProfileProvider>
);

export default CheckinExperience;


