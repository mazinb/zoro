'use client';

import React from 'react';
import Link from 'next/link';
import { Moon, Sun, Shield, Smartphone, KeyRound, Ban } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { DownloadButtons } from '@/components/landing/DownloadButtons';
import { PhoneFrame } from '@/components/landing/PhoneFrame';
import { APP_DEMO_VIDEO_URL } from '@/lib/app-download';
import { FeatureCarousel, type FeatureSlide } from '@/components/landing/FeatureCarousel';

interface DownloadLandingPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onShowPhilosophy: () => void;
}

const privacyPillars = [
  {
    icon: Ban,
    title: 'No bank sync',
    description:
      'Your accounts never connect to Zoro. You enter what you choose—nothing is pulled from banks or brokers.',
  },
  {
    icon: Smartphone,
    title: 'Data on your phone',
    description:
      'Balances, context, and chat history stay on device. Zoro is built for people who want control, not cloud copies of everything.',
  },
  {
    icon: KeyRound,
    title: 'Your API keys',
    description:
      'AI runs through keys you provide—OpenAI, Anthropic, or Gemini. No bundled model bill from us.',
  },
];

const features: FeatureSlide[] = [
  {
    num: 1,
    image: '/images/app/feature-private-by-design.png',
    title: 'Private by design',
    description:
      'Mask balances with a tap. No sign-in to a finance aggregator—just your numbers, your rules.',
  },
  {
    num: 2,
    image: '/images/app/feature-data-on-device.png',
    title: 'Data saved on your phone',
    description:
      'Multi-currency home with Sankey cash-flow views. Everything you track lives locally unless you choose to share.',
  },
  {
    num: 3,
    image: '/images/app/feature-track-assets.png',
    title: 'Track assets and liabilities',
    description:
      'Condos, brokerage, cash across countries—manual entries you control, with clear net-worth picture.',
  },
  {
    num: 4,
    image: '/images/app/feature-expense-monitoring.png',
    title: 'Quick expense monitoring',
    description:
      'Ledger splits income, expenses, and cashflow. Donut charts and month-by-month estimates at a glance.',
  },
  {
    num: 5,
    image: '/images/app/feature-remember-decisions.png',
    title: 'Remember key decisions',
    description:
      'Context holds assets, liabilities, and estimates—the background your AI assistants actually use.',
  },
  {
    num: 6,
    image: '/images/app/feature-ai-assistants.png',
    title: 'Custom AI assistants',
    description:
      'Retirement planner, FIRE strategist, expense analyzer, and more—each tuned for a specific money question.',
  },
  {
    num: 7,
    image: '/images/app/feature-api-keys.png',
    title: 'Bring your own API keys',
    description:
      'Pick models per provider in Settings. Your keys, your spend, no middleman markup on inference.',
  },
];

export const DownloadLandingPage: React.FC<DownloadLandingPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onShowPhilosophy,
}) => {
  const theme = useThemeClasses(darkMode);
  const headerTextClass = darkMode ? theme.textClass : 'text-slate-900';

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <ZoroLogo className="h-10" isDark={darkMode} />
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onShowPhilosophy}
              className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            >
              Our Philosophy
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className={`inline-flex items-center gap-2 ${theme.accentBgClass} border ${theme.cardBorderClass} rounded-full px-4 py-2 mb-6`}
          >
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className={`text-sm font-medium ${theme.textSecondaryClass}`}>
              Privacy-first · No bank sync
            </span>
          </div>

          <h1
            className={`text-4xl sm:text-5xl lg:text-6xl font-bold ${theme.textClass} mb-6 tracking-tight leading-[1.1]`}
          >
            Your personal
            <br />
            <span className="text-blue-600 dark:text-blue-400">financial planner</span>
          </h1>

          <p
            className={`text-lg sm:text-xl ${theme.textSecondaryClass} mb-8 max-w-xl mx-auto leading-relaxed`}
          >
            Zoro on iOS and Android: track net worth, cash flow, and context—then chat with
            specialists that know your numbers. No bank connections. Data stays on your phone.
          </p>

          <DownloadButtons darkMode={darkMode} className="justify-center" />

          <p className={`text-sm ${theme.textSecondaryClass} mt-4`}>
            Free to download · You bring your own AI keys
          </p>
        </div>
      </section>

      {/* Privacy pillars */}
      <section className={`${theme.accentBgClass} border-y ${theme.borderClass} py-16 lg:py-20`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className={`text-3xl font-bold ${headerTextClass} mb-3`}>
              Built for privacy
            </h2>
            <p className={`${theme.textSecondaryClass} max-w-2xl mx-auto`}>
              We skipped the bank-login playbook. Zoro is for people who want a clear financial
              picture without handing credentials to another aggregator.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {privacyPillars.map((pillar) => (
              <div
                key={pillar.title}
                className={`rounded-2xl border ${theme.borderClass} p-6 ${
                  darkMode ? 'bg-slate-800/50' : 'bg-white'
                }`}
              >
                <pillar.icon className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-4" />
                <h3 className={`text-lg font-bold ${theme.textClass} mb-2`}>{pillar.title}</h3>
                <p className={`text-sm ${theme.textSecondaryClass} leading-relaxed`}>
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video + frame */}
      <section className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 text-center lg:text-left">
            <h2 className={`text-3xl font-bold ${headerTextClass} mb-4`}>
              See it in action
            </h2>
            <p className={`${theme.textSecondaryClass} mb-6 max-w-md mx-auto lg:mx-0 leading-relaxed`}>
              Command center, ledger, context, and chat—one app for the full picture. Browse
              Sankey flows, update your ledger, and ask a specialist in seconds.
            </p>
            <DownloadButtons darkMode={darkMode} size="md" className="justify-center lg:justify-start" />
          </div>
          <div className="order-1 lg:order-2 flex justify-center">
            <PhoneFrame videoSrc={APP_DEMO_VIDEO_URL} posterSrc="/images/app/hero.png" />
          </div>
        </div>
      </section>

      {/* Feature carousel */}
      <section className={`${theme.accentBgClass} py-16 lg:py-20`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className={`text-3xl font-bold ${headerTextClass} mb-4`}>
              Everything in one app
            </h2>
            <p className={`${theme.textSecondaryClass} max-w-xl mx-auto`}>
              Swipe through seven ways Zoro helps you plan—no bank sync required.
            </p>
          </div>

          <FeatureCarousel
            features={features}
            darkMode={darkMode}
            textClass={theme.textClass}
            textSecondaryClass={theme.textSecondaryClass}
            borderClass={theme.borderClass}
          />
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        id="download"
        className={`border-t ${theme.borderClass} py-20`}
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className={`text-3xl font-bold ${headerTextClass} mb-4`}>
            Download Zoro
          </h2>
          <p className={`${theme.textSecondaryClass} mb-8 max-w-lg mx-auto`}>
            Available on iPhone and Android. No bank sync, no surprise cloud copies—just your
            finances, organized.
          </p>
          <DownloadButtons darkMode={darkMode} />
        </div>
      </section>

      <footer className={`border-t ${theme.borderClass} py-12`}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <ZoroLogo className="h-8" isDark={darkMode} />
          <div className={`text-sm ${theme.textSecondaryClass} flex items-center gap-2`}>
            <Link href="/legal?tab=terms" className="hover:underline transition-colors">
              Terms of use
            </Link>
            <span>|</span>
            <Link href="/legal?tab=privacy" className="hover:underline transition-colors">
              Privacy policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
