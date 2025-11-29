import React, { useEffect, useState, useRef } from "react";

/* ============================================
   DESIGN TOKENS
   Centralized color and style values for theming
   ============================================ */
const TOKENS = {
  accent: "#2563eb",
  bgLight: "#fafafa",
  bgDark: "#0a0a0a",
  cardLight: "#ffffff",
  cardDark: "#111111",
  textLight: "#171717",
  textDark: "#e5e5e5",
  mutedLight: "#737373",
  mutedDark: "#a3a3a3",
  borderLight: "#e5e5e5",
  borderDark: "#262626",
};

/* ============================================
   HOOKS
   ============================================ */

/**
 * useOnScreen - Detects when an element enters viewport
 * Used for scroll-triggered animations
 */
function useOnScreen(ref, rootMargin = "0px") {
  const [isIntersecting, setIntersecting] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true);
          obs.disconnect(); // Only trigger once
        }
      },
      { root: null, rootMargin, threshold: 0.12 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return isIntersecting;
}

/* ============================================
   SVG ICONS (Single color, accessible)
   ============================================ */

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const InvestIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const TaxIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const RetirementIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

/* ============================================
   MAIN COMPONENT
   ============================================ */

export default function CheckinPage() {
  // UI State
  const [frequency, setFrequency] = useState("Weekly");
  const [theme, setTheme] = useState(null); // null = auto (follows OS preference)
  
  // Goal selection state
  const [selectedGoals, setSelectedGoals] = useState([]); // Currently selected (staged)
  const [savedGoals, setSavedGoals] = useState([]); // Last saved state (from DB)
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation state
  const [lastGoalUpdate, setLastGoalUpdate] = useState(null); // Timestamp of last save
  const [showUpdateError, setShowUpdateError] = useState(false); // Show hourly limit error
  const [isSaving, setIsSaving] = useState(false);

  // Apply theme based on user preference or OS setting
  useEffect(() => {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const activeTheme = theme ?? (prefersDark ? "dark" : "light");
    document.documentElement.dataset.theme = activeTheme;
  }, [theme]);

  /**
   * Simulate user login and loading saved goals from database
   * In production, this would be an API call
   */
  const handleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      // Simulate loaded goals from DB
      const initialGoals = ["save", "invest"];
      setSelectedGoals(initialGoals);
      setSavedGoals(initialGoals);
      // Set last update to >1 hour ago so user can immediately update
      setLastGoalUpdate(Date.now() - 3700000); 
      setIsLoading(false);
    }, 1200);
  };

  /**
   * Handle user logout - clear all state
   */
  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedGoals([]);
    setSavedGoals([]);
    setLastGoalUpdate(null);
    setShowUpdateError(false);
  };

  /**
   * Toggle goal selection (staging only, not saved until saveGoals is called)
   */
  const toggleGoal = (id) => {
    setSelectedGoals(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  /**
   * Save goal selection with validation
   * - Checks 1-hour cooldown for logged-in users
   * - Simulates API save with loading state
   */
  const saveGoals = () => {
    // If logged in, enforce 1-hour cooldown between saves
    if (isLoggedIn && lastGoalUpdate) {
      const hourInMs = 60 * 60 * 1000;
      const timeSinceUpdate = Date.now() - lastGoalUpdate;
      
      if (timeSinceUpdate < hourInMs) {
        setShowUpdateError(true);
        setTimeout(() => setShowUpdateError(false), 4000); // Auto-hide after 4s
        return;
      }
    }

    // Simulate API save
    setIsSaving(true);
    setTimeout(() => {
      setSavedGoals([...selectedGoals]);
      if (isLoggedIn) {
        setLastGoalUpdate(Date.now());
      }
      setIsSaving(false);
    }, 800);
  };

  // Check if user has unsaved changes
  const hasUnsavedChanges = JSON.stringify(selectedGoals.sort()) !== JSON.stringify(savedGoals.sort());

  return (
    <>
      {/* Global styles with CSS custom properties for theming */}
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        
        /* CSS Custom Properties for theming */
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
        
        /* Reusable component styles */
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
        
        /* Goal card styles with selection state */
        .goal-card {
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .goal-card:hover {
          transform: translateY(-2px);
        }
        .goal-card.selected {
          border-color: var(--text);
          background: var(--bg);
        }
        /* Checkmark indicator for selected goals */
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
      `}</style>

      <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", transition: "background 0.3s, color 0.3s" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
          <Header theme={theme} setTheme={setTheme} isLoggedIn={isLoggedIn} onLogin={handleLogin} onLogout={handleLogout} isLoading={isLoading} />
          <Hero frequency={frequency} setFrequency={setFrequency} isLoggedIn={isLoggedIn} />
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
          <HowItWorks isLoggedIn={isLoggedIn} />
          <CTA isLoggedIn={isLoggedIn} selectedGoals={selectedGoals} />
          <Footer />
        </div>
      </main>
    </>
  );
}

/* ============================================
   HEADER COMPONENT
   Theme toggle and auth controls
   ============================================ */

function Header({ theme, setTheme, isLoggedIn, onLogin, onLogout, isLoading }) {
  // Cycle through: dark → light → auto (OS preference)
  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : prev === "light" ? null : "dark"));
  
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>Zoro</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Financial check-ins</div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-secondary" onClick={toggle} style={{ fontSize: 13 }}>
          {theme === "dark" ? "Light" : theme === "light" ? "Auto" : "Dark"}
        </button>
        {!isLoggedIn ? (
          <button className="btn" onClick={onLogin} disabled={isLoading} style={{ fontSize: 13 }}>
            {isLoading ? "Loading..." : "Login (Demo)"}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={onLogout} style={{ fontSize: 13 }}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

/* ============================================
   HERO COMPONENT
   Main value proposition and frequency selector
   ============================================ */

function Hero({ frequency, setFrequency, isLoggedIn }) {
  const freqs = ["Daily", "Every 3 days", "Weekly", "Bi-weekly", "Monthly"];
  
  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
        {isLoggedIn ? "Your check-in settings" : "Regular check-ins delivered to your inbox"}
      </h1>
      {!isLoggedIn && (
        <p className="muted" style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, maxWidth: 640 }}>
          Choose how often you want reminders. Each email contains a snapshot of your finances and one actionable suggestion. Reply to update your goals and the system adapts to you.
        </p>
      )}

      <div style={{ marginTop: 32 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {isLoggedIn ? "Your frequency" : "Pick your frequency"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {freqs.map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: frequency === f ? "var(--text)" : "transparent",
                color: frequency === f ? "var(--bg)" : "var(--text)",
                cursor: "pointer",
                fontSize: 14,
                transition: "all 0.2s",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!isLoggedIn && (
        <div style={{ marginTop: 28 }}>
          <button className="btn" onClick={() => alert("Redirect to onboarding flow")}>Get started</button>
          <span className="muted" style={{ fontSize: 13, marginLeft: 16 }}>Takes 30 seconds</span>
        </div>
      )}
    </section>
  );
}

/* ============================================
   SAMPLE EMAIL COMPONENT
   Shows example of what user will receive
   Only visible for non-logged-in users
   ============================================ */

function SampleEmail({ frequency, isLoggedIn }) {
  const ref = useRef();
  const visible = useOnScreen(ref, "-80px");
  
  // Hide for logged-in users (they already know what emails look like)
  if (isLoggedIn) return null;
  
  return (
    <section className="card" style={{ marginTop: 64 }} ref={ref}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Sample {frequency.toLowerCase()} email</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Here's what lands in your inbox</div>
      
      <div style={{ padding: 20, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)" }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>{frequency} financial check-in</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 24 }}>Your personalized summary</div>

        {/* Mini chart with scroll animation */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>This week's snapshot</div>
          <MiniBarChart animate={visible} />
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Spending: ₹42,300 • Saved: ₹8,200 • Progress: On track
          </div>
        </div>

        {/* Priority section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Priority for this week</div>
          <div style={{ fontSize: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 6, lineHeight: 1.5 }}>
            Review recurring subscriptions — you're spending ₹1,700/month on services you rarely use
          </div>
        </div>

        {/* Action section */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>One action to take</div>
          <div style={{ fontSize: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 6, lineHeight: 1.5 }}>
            Move 20% of this month's savings (₹1,640) into your index fund SIP. Set up auto-review in 6 months.
          </div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        💬 Reply to any email to update your goals, change frequency, or ask questions
      </div>
    </section>
  );
}

/* ============================================
   MINI BAR CHART
   Animated chart for sample email
   ============================================ */

function MiniBarChart({ animate }) {
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
            style={{ transition: "all 0.6s ease-out" }}
          />
        );
      })}
    </svg>
  );
}

/* ============================================
   GOALS COMPONENT
   Selectable goal cards with validation
   ============================================ */

function Goals({ selectedGoals, toggleGoal, isLoggedIn, showUpdateError, saveGoals, hasUnsavedChanges, isSaving }) {
  const goals = [
    { id: "save", icon: SaveIcon, title: "Save more consistently", desc: "Build emergency fund, reduce unnecessary spending" },
    { id: "invest", icon: InvestIcon, title: "Invest smarter", desc: "Diversify portfolio, understand index funds, track returns" },
    { id: "home", icon: HomeIcon, title: "Plan for big purchases", desc: "Home down payment, car, education funding" },
    { id: "insurance", icon: ShieldIcon, title: "Review insurance", desc: "Health, life, and property coverage checkups" },
    { id: "tax", icon: TaxIcon, title: "Tax optimization", desc: "Maximize deductions, plan for tax-saving investments" },
    { id: "retirement", icon: RetirementIcon, title: "Retirement planning", desc: "Set goals, calculate needs, build sustainable strategy" },
  ];

  return (
    <section style={{ marginTop: 64 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.02em" }}>
        {isLoggedIn ? "Your financial goals" : "Pick your financial goals"}
      </h2>
      <p className="muted" style={{ fontSize: 15, marginBottom: 32, lineHeight: 1.5 }}>
        {isLoggedIn 
          ? `You've selected ${selectedGoals.length} goal${selectedGoals.length !== 1 ? 's' : ''}. Your check-ins will focus on these priorities.`
          : "Select 1-3 goals. Your check-ins will focus on these priorities."
        }
      </p>
      
      {/* Goal cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
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
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{goal.desc}</div>
            </div>
          );
        })}
      </div>
      
      {/* Status and save controls */}
      {selectedGoals.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {!isLoggedIn 
                  ? "Sign up to save your preferences"
                  : hasUnsavedChanges 
                    ? "You have unsaved changes"
                    : "All changes saved"
                }
              </div>
            </div>
            {/* Save button - only shown for logged-in users with changes */}
            {isLoggedIn && hasUnsavedChanges && (
              <button 
                className="btn" 
                onClick={saveGoals}
                disabled={isSaving || selectedGoals.length > 3}
                style={{ fontSize: 13, flexShrink: 0 }}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            )}
          </div>
          {/* Validation messages - shown below button row */}
          {(selectedGoals.length > 3 || (isLoggedIn && hasUnsavedChanges && showUpdateError)) && (
            <div style={{ 
              fontSize: 13, 
              marginTop: 12,
              color: "#dc2626"
            }}>
              {selectedGoals.length > 3 
                ? "Add more goals after you finish these 3"
                : "Can only update goals once per hour"
              }
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ============================================
   HOW IT WORKS COMPONENT
   3-step explainer (hidden for logged-in users)
   ============================================ */

function HowItWorks({ isLoggedIn }) {
  if (isLoggedIn) return null;
  
  return (
    <section style={{ marginTop: 64 }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 32, letterSpacing: "-0.02em" }}>How it works</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 32 }}>
        <div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>1</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Set up in 2 mins</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>Choose your frequency and pick 1-3 financial goals to focus on</div>
        </div>
        <div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>2</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Receive personalized emails</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>Get regular snapshots of your finances and one specific action to take</div>
        </div>
        <div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>3</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Adjust anytime</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>Reply to any email to update goals, change frequency, or refine suggestions</div>
        </div>
      </div>
    </section>
  );
}

/* ============================================
   CTA COMPONENT
   Context-aware call to action
   ============================================ */

function CTA({ isLoggedIn, selectedGoals }) {
  if (isLoggedIn) {
    return (
      <section className="card" style={{ marginTop: 64, textAlign: "center" }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.02em" }}>
          {selectedGoals.length > 0 ? "All set!" : "Select your goals to continue"}
        </h3>
        <p className="muted" style={{ fontSize: 15, marginBottom: 24 }}>
          {selectedGoals.length > 0 
            ? "Your settings have been saved. You'll receive your first check-in soon."
            : "Pick at least one goal above to start receiving check-ins"
          }
        </p>
        {selectedGoals.length > 0 && (
          <button className="btn" onClick={() => alert("Navigate to dashboard")}>View dashboard</button>
        )}
      </section>
    );
  }
  
  return (
    <section className="card" style={{ marginTop: 64, textAlign: "center" }}>
      <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.02em" }}>Ready to start?</h3>
      <p className="muted" style={{ fontSize: 15, marginBottom: 24 }}>
        {selectedGoals.length > 0 
          ? `You've selected ${selectedGoals.length} goal${selectedGoals.length !== 1 ? 's' : ''}. Sign up to save your preferences.`
          : "Set up your first check-in in 2 minutes"
        }
      </p>
      <button className="btn" onClick={() => alert("Redirect to onboarding flow")}>Get started</button>
    </section>
  );
}

/* ============================================
   FOOTER COMPONENT
   ============================================ */

function Footer() {
  return (
    <footer style={{ marginTop: 80, paddingTop: 32, borderTop: "1px solid var(--border)", textAlign: "center" }}>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
        Built by people who believe small, regular nudges beat complex dashboards.<br />
        Privacy-friendly. Email only. Cancel anytime.
      </div>
    </footer>
  );
}