'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

interface FaqSectionProps {
  faqs: FaqItem[];
  darkMode: boolean;
  textClass: string;
  textSecondaryClass: string;
  borderClass: string;
  headerTextClass: string;
}

export function FaqSection({
  faqs,
  darkMode,
  textClass,
  textSecondaryClass,
  borderClass,
  headerTextClass,
}: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10 lg:mb-12">
        <h2 className={`text-2xl sm:text-3xl font-bold ${headerTextClass} mb-3`}>
          Frequently asked questions
        </h2>
        <p className={textSecondaryClass}>Straight answers about how Zoro works.</p>
      </div>

      <div className={`divide-y ${borderClass} rounded-2xl border ${borderClass} overflow-hidden`}>
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.question}
              className={darkMode ? 'bg-slate-800/50' : 'bg-white'}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className={`flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 text-left transition-colors ${
                  darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                }`}
                aria-expanded={isOpen}
              >
                <span className={`text-base sm:text-lg font-semibold ${textClass}`}>
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 shrink-0 ${textSecondaryClass} transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div
                    className={`px-5 pb-5 sm:px-6 sm:pb-6 text-sm sm:text-base leading-relaxed ${textSecondaryClass}`}
                  >
                    {faq.answer}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
