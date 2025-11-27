'use client';

import React from 'react';
import { Handshake, UserCheck, Search, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { AdvisorRecord } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useAdvisorDirectory } from '@/hooks/useAdvisorDirectory';

interface AdvisorChoiceProps {
  darkMode: boolean;
  advisorMode: 'self' | 'advisor' | null;
  selectedAdvisor: AdvisorRecord | null;
  onSelectSelf: () => void;
  onSelectAdvisor: (advisor: AdvisorRecord) => void;
  onContinueAdvisor: () => void;
  onBackToHome: () => void;
}

export const AdvisorChoice: React.FC<AdvisorChoiceProps> = ({
  darkMode,
  advisorMode,
  selectedAdvisor,
  onSelectSelf,
  onSelectAdvisor,
  onContinueAdvisor,
  onBackToHome,
}) => {
  const {
    advisors,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    hasMore,
    loadMore,
    refresh,
  } = useAdvisorDirectory({ perPage: 12 });

  const themeClasses = {
    bgClass: darkMode ? 'bg-slate-900' : 'bg-white',
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    borderClass: darkMode ? 'border-slate-800' : 'border-slate-200',
    mutedCard: darkMode ? 'bg-slate-800' : 'bg-slate-50',
    highlight: darkMode ? 'bg-blue-900/40 border-blue-500' : 'bg-blue-50 border-blue-600',
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgClass} flex items-center justify-center p-4 transition-colors duration-300`}>
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center">
          <ZoroLogo className="h-10 mx-auto mb-4" isDark={darkMode} />
          <h1 className={`text-3xl font-bold ${themeClasses.textClass} mb-3`}>
            How would you like to set up Zoro?
          </h1>
          <p className={`${themeClasses.textSecondaryClass} max-w-2xl mx-auto`}>
            Choose between a guided journey with a SEBI-registered advisor or go hands-on yourself.
            You can switch later—your data always belongs to you.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Self-directed card */}
          <Card
            darkMode={darkMode}
            className={`p-8 border-2 transition-all ${
              advisorMode === 'self' ? themeClasses.highlight : themeClasses.borderClass
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className={`w-6 h-6 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <h2 className={`text-xl font-semibold ${themeClasses.textClass}`}>Do it yourself</h2>
            </div>
            <ul className={`space-y-2 text-sm ${themeClasses.textSecondaryClass}`}>
              <li>• Fastest path to get insights</li>
              <li>• Ideal if you already have a plan</li>
              <li>• Switch to an advisor any time</li>
            </ul>
            <Button
              variant="primary"
              darkMode={darkMode}
              className="w-full mt-6"
              onClick={onSelectSelf}
            >
              Continue without an advisor
            </Button>
          </Card>

          {/* Advisor card */}
          <Card
            darkMode={darkMode}
            className={`p-8 border-2 transition-all space-y-4 ${
              advisorMode === 'advisor' ? themeClasses.highlight : themeClasses.borderClass
            }`}
          >
            <div className="flex items-center gap-3">
              <Handshake className={`w-6 h-6 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
              <div>
                <h2 className={`text-xl font-semibold ${themeClasses.textClass}`}>Work with an advisor</h2>
                <p className={`text-sm ${themeClasses.textSecondaryClass}`}>
                  Browse SEBI-registered firms and invite them into your check-ins.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              darkMode={darkMode}
              className="w-full py-3 text-base font-semibold"
              onClick={() => {
                // TODO: Implement goal-based advisor matching
                alert('This feature will help you find advisors based on your financial goals. Coming soon!');
              }}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Help me find based on my goals
            </Button>

            <div className="flex items-center gap-3 my-2">
              <div className={`flex-1 h-px ${themeClasses.borderClass}`}></div>
              <span className={`text-xs font-medium ${themeClasses.textSecondaryClass}`}>OR</span>
              <div className={`flex-1 h-px ${themeClasses.borderClass}`}></div>
            </div>

            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${themeClasses.borderClass}`}>
              <Search className={darkMode ? 'text-slate-400' : 'text-slate-500'} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by registration no. or advisor name"
                className={`flex-1 bg-transparent focus:outline-none ${themeClasses.textClass} placeholder:${themeClasses.textSecondaryClass}`}
              />
              <button
                type="button"
                onClick={refresh}
                className={`p-2 rounded-full ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                aria-label="Refresh advisor list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {loading && advisors.length === 0 && (
                <div className={`text-sm ${themeClasses.textSecondaryClass} text-center py-6`}>
                  Loading advisors…
                </div>
              )}
              {!loading && advisors.length === 0 ? (
                <div className={`text-sm ${themeClasses.textSecondaryClass} text-center py-6`}>
                  No advisors found. Try a different spelling.
                </div>
              ) : (
                advisors.map((advisor) => {
                  const isSelected = advisor.id === selectedAdvisor?.id;
                  return (
                    <button
                      key={advisor.id}
                      onClick={() => onSelectAdvisor(advisor)}
                      className={`w-full text-left border rounded-lg p-3 transition-all ${
                        isSelected
                          ? darkMode
                            ? 'border-blue-400 bg-blue-900/20'
                            : 'border-blue-500 bg-blue-50'
                          : themeClasses.borderClass
                      }`}
                    >
                      <p className={`font-semibold ${themeClasses.textClass}`}>{advisor.name}</p>
                      <p className={`text-xs ${themeClasses.textSecondaryClass}`}>
                        {advisor.registrationNo}
                      </p>
                      {advisor.contactPerson && (
                        <p className={`text-xs ${themeClasses.textSecondaryClass}`}>
                          Contact: {advisor.contactPerson}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            {hasMore && (
              <Button
                variant="secondary"
                darkMode={darkMode}
                className="w-full"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more advisors'}
              </Button>
            )}

            {selectedAdvisor && (
              <div className={`${themeClasses.mutedCard} rounded-lg p-4 text-sm`}>
                <p className={`font-semibold ${themeClasses.textClass} mb-1`}>
                  {selectedAdvisor.name}
                </p>
                <p className={`${themeClasses.textSecondaryClass}`}>
                  Reg. No: {selectedAdvisor.registrationNo}
                </p>
                {selectedAdvisor.email && (
                  <p className={`${themeClasses.textSecondaryClass} mt-1`}>
                    Email: {selectedAdvisor.email}
                  </p>
                )}
                {selectedAdvisor.validity && (
                  <p className={`${themeClasses.textSecondaryClass} mt-1`}>
                    Validity: {selectedAdvisor.validity}
                  </p>
                )}
              </div>
            )}

            <Button
              variant="primary"
              darkMode={darkMode}
              className="w-full"
              disabled={!selectedAdvisor}
              onClick={onContinueAdvisor}
            >
              {selectedAdvisor ? `Continue with ${selectedAdvisor.name}` : 'Select an advisor to continue'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        </div>

        <div className="text-center">
          <button
            onClick={onBackToHome}
            className={`${themeClasses.textSecondaryClass} hover:${themeClasses.textClass} text-sm transition-colors`}
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

