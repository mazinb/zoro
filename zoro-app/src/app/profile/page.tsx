'use client';

import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const { user, signOut } = useAuth();
  const isLoggedIn = !!user;

  const handleLogout = async () => {
    await signOut();
    router.push('/');
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

      {/* Profile Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Profile</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Full Name</span>
            <input className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Date of Birth</span>
            <input type="date" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Email</span>
            <input type="email" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Phone</span>
            <input className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Address</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
          </label>
        </div>
      </div>

      {/* Income Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Income</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Primary Income (Annual)</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Other Income (Annual)</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Income Notes</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
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
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Other Property Value</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>

        <h3 className={`text-base font-medium ${darkMode ? theme.textClass : 'text-slate-900'} mt-4 mb-3`}>Investments</h3>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Equity / Mutual Funds</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Fixed Income</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Crypto</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Cash & Bank</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>

        <h3 className={`text-base font-medium ${darkMode ? theme.textClass : 'text-slate-900'} mt-4 mb-3`}>Other Assets</h3>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Vehicles, valuables, collectibles</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
          </label>
        </div>
      </div>

      {/* Liabilities Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Liabilities</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Home Loan</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Personal Loan</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Credit Card Dues</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Business / Other Commitments</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
      </div>

      {/* Insurance & Pensions Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Insurance & Pensions</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Life Insurance Cover</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Health Insurance Cover</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Pension / NPS / 401k Value</span>
            <input type="number" className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${theme.textClass}`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Nominee Details</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
          </label>
        </div>
      </div>

      {/* Estate Section */}
      <div className={`max-w-3xl mx-auto mb-6 ${theme.cardBgClass} border ${theme.borderClass} rounded-lg p-6`}>
        <h2 className={`text-lg font-semibold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>Estate</h2>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Primary Beneficiaries</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Guardianship Wishes (if children)</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Asset Distribution Instructions</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
          </label>
        </div>
        <div className="mb-4">
          <label className="flex flex-col">
            <span className={`text-sm ${darkMode ? theme.textClass : 'text-slate-900'} mb-1`}>Funeral / Organ Donation Preferences</span>
            <textarea className={`w-full px-3 py-2 ${theme.inputBgClass} rounded-lg border ${theme.borderClass} ${darkMode ? theme.textClass : 'text-slate-900'} min-h-[80px] resize-y`} />
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

      <div className="h-24"></div>
      </div>
    </div>
  );
}

