'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, CheckCircle2, Circle, Clock } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Sun, Moon } from 'lucide-react';
import { useWaitlistCount } from '@/hooks/useWaitlistCount';
import { buildTimelineMilestones } from '@/lib/timeline';

export default function TimelinePage() {
    const { darkMode, toggleDarkMode } = useDarkMode();
    const theme = useThemeClasses(darkMode);
    const signupCount = useWaitlistCount();

    const headerTextClass = darkMode ? theme.textClass : 'text-slate-900';
    const numberBgClass = darkMode ? theme.buttonClass : 'bg-slate-900 text-white';

    const milestones = buildTimelineMilestones(signupCount);

    return (
        <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
            {/* Navigation */}
            <nav className={`border-b ${theme.borderClass}`}>
                <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/">
                            <ZoroLogo className="h-10" isDark={darkMode} />
                        </Link>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link
                            href="/"
                            className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors flex items-center gap-1`}
                        >
                            <ChevronLeft className="w-4 h-4" /> Back to Home
                        </Link>
                        <button
                            onClick={toggleDarkMode}
                            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                            aria-label="Toggle dark mode"
                        >
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-3xl mx-auto px-6 py-16">
                <h1 className={`text-4xl font-bold ${headerTextClass} mb-4 text-center`}>
                    Project Roadmap & Milestones
                </h1>
                <p className={`${theme.textSecondaryClass} text-center mb-6 max-w-xl mx-auto text-lg`}>
                    We are building Zoro in public. Here is our plan to scale and what our early adopters get in return for their trust.
                </p>
                <p className={`${theme.textSecondaryClass} text-center mb-16 max-w-xl mx-auto`}>
                    Current signups: {signupCount !== null ? signupCount.toLocaleString() : 'Loading...'}
                </p>

                <div className="space-y-12 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent dark:before:via-slate-700">

                    {milestones.map((milestone, index) => {
                        const isComplete = milestone.status === 'complete';
                        const isCurrent = milestone.status === 'current';
                        const isUpcoming = milestone.status === 'upcoming';
                        const statusLabel = isComplete ? 'Complete' : isCurrent ? 'Current' : 'Upcoming';

                        return (
                            <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">

                                {/* Icon */}
                                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 
                  ${isComplete
                                        ? 'bg-green-500 border-green-100 dark:border-green-900 text-white'
                                        : isCurrent
                                            ? 'bg-blue-600 border-blue-100 dark:border-blue-900 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.3)]'
                                            : 'bg-slate-100 border-slate-50 dark:bg-slate-800 dark:border-slate-900 text-slate-400'
                                    }`}
                                >
                                    {isComplete ? <CheckCircle2 className="w-6 h-6" /> : isCurrent ? <Clock className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                </div>

                                {/* Content */}
                                <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl border ${theme.borderClass} ${darkMode ? 'bg-slate-800/50' : 'bg-white'} shadow-sm`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                        <span className={`font-bold text-lg ${isCurrent ? 'text-blue-600 dark:text-blue-400' : theme.textClass}`}>
                                            {milestone.title}
                                        </span>
                                        <span
                                            className={`text-xs px-2 py-1 rounded-full w-fit ${isComplete
                                                ? 'bg-green-600 text-white'
                                                : isCurrent
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                                }`}
                                        >
                                            {statusLabel}
                                        </span>
                                    </div>
                                    <p className={`${theme.textSecondaryClass} leading-relaxed`}>
                                        {milestone.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                </div>
            </div>
        </div>
    );
}
