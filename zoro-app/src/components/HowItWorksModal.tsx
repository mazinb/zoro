'use client';

import { X, Search, User, Bot, Eye, Send } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
}

const steps = [
  {
    icon: Search,
    title: 'Topic Scout',
    description: 'A script scans dozens of sources — arXiv, RSS feeds, Hacker News — and curates topic queues by category.',
  },
  {
    icon: User,
    title: 'Pipeline Manager',
    description: 'For each category, a manager selects top topics and delegates sub-agents to read and summarize every candidate.',
  },
  {
    icon: Bot,
    title: 'Summarizer Agents',
    description: 'Each article is read by a dedicated agent that extracts key claims, evidence, and relevance to the category.',
  },
  {
    icon: Eye,
    title: 'Reviewer',
    description: 'A quality gate checks for AI-isms, factual errors, and structural flaws before publishing.',
  },
  {
    icon: Send,
    title: 'Publisher',
    description: 'Approved articles are written as markdown, enriched with research notes, and published as polished reports.',
  },
];

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ open, onClose, darkMode }) => {
  const theme = useThemeClasses(darkMode);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="How the reports are generated">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${theme.textSecondaryClass} hover:${theme.textClass}`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className={`text-lg font-bold ${theme.textClass}`}>How reports are generated</h2>
          <p className={`text-sm ${theme.textSecondaryClass} mt-1`}>
            Every report on this page is created by a multi-agent pipeline.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              {/* Step number + icon */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <step.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-px h-8 mt-1 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                )}
              </div>

              {/* Content */}
              <div className="pb-5 flex-1">
                <p className={`text-sm font-semibold ${theme.textClass}`}>{step.title}</p>
                <p className={`text-sm ${theme.textSecondaryClass} mt-0.5 leading-relaxed`}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
