'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { Trophy, Clock, User, Sun, Moon, LogOut } from 'lucide-react';
import Link from 'next/link';

interface LeaderboardEntry {
    name: string;
    joinedAt: string;
}

interface WaitlistData {
    position: number;
    total_waitlist: number;
    public_name: string;
    leaderboard: LeaderboardEntry[];
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, session, loading, signOut } = useAuth();
    const { darkMode, toggleDarkMode } = useDarkMode();
    const theme = useThemeClasses(darkMode);

    const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [newName, setNewName] = useState('');
    const [updatingName, setUpdatingName] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login?redirect=/dashboard');
        }
    }, [user, loading, router]);

    useEffect(() => {
        const fetchData = async () => {
            if (!session?.access_token) return;

            try {
                const res = await fetch('/api/waitlist', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    setWaitlistData(data);
                    setNewName(data.public_name || '');
                } else {
                    console.error('Failed to fetch waitlist data');
                }
            } catch (e) {
                console.error('Error fetching waitlist data', e);
            } finally {
                setLoadingData(false);
            }
        };

        if (session?.access_token) {
            fetchData();
        }
    }, [session]);

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.access_token || !newName.trim()) return;

        setUpdatingName(true);
        setError('');

        try {
            const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ public_name: newName.trim() })
            });

            if (!res.ok) {
                throw new Error('Failed to update name');
            }

            // Refresh data
            const dataRes = await fetch('/api/waitlist', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (dataRes.ok) {
                const data = await dataRes.json();
                setWaitlistData(data);
            }

        } catch (e) {
            console.error(e);
            setError('Failed to update name. Please try again.');
        } finally {
            setUpdatingName(false);
        }
    };

    if (loading || loadingData) {
        return (
            <div className={`min-h-screen ${theme.bgClass} flex items-center justify-center`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) return null; // Will redirect

    return (
        <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
            {/* Navigation */}
            <nav className={`border-b ${theme.borderClass}`}>
                <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/">
                            <ZoroLogo className="h-8" isDark={darkMode} />
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleDarkMode}
                            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                            aria-label="Toggle dark mode"
                        >
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => signOut()}
                            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors flex items-center gap-2 text-sm`}
                        >
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-12 text-center">
                    <h1 className={`text-4xl font-bold ${darkMode ? theme.textClass : 'text-slate-900'} mb-4`}>
                        Welcome to the Waitlist
                    </h1>
                    <p className={`${theme.textSecondaryClass} text-lg`}>
                        We are handling access in batches. Stay tuned!
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Left Column: Status Card */}
                    <div className={`p-8 rounded-3xl ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${theme.borderClass} shadow-xl`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Clock className="w-6 h-6" />
                            </div>
                            <h2 className={`text-2xl font-bold ${theme.textClass}`}>Your Status</h2>
                        </div>

                        <div className="mb-8">
                            <p className={`text-sm uppercase tracking-wider ${theme.textSecondaryClass} mb-1`}>Current Position</p>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-6xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                                    #{waitlistData?.position?.toLocaleString() || '-'}
                                </span>
                            </div>
                        </div>

                        <div className="mb-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                            <p className={`text-sm font-medium ${theme.textClass} mb-2`}>Waitlist Perks:</p>
                            <ul className={`text-sm ${theme.textSecondaryClass} space-y-2`}>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Priority access to new features</li>
                                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Founder portfolio review (Top 10)</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className={`text-lg font-semibold ${theme.textClass} mb-4`}>Public Profile</h3>
                            <form onSubmit={handleUpdateName} className="space-y-4">
                                <div>
                                    <label className={`block text-sm ${theme.textSecondaryClass} mb-1`}>
                                        Display Name on Leaderboard
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="Enter public name"
                                            className={`flex-1 px-4 py-2 rounded-lg border ${theme.borderClass} bg-transparent ${theme.textClass} focus:ring-2 focus:ring-blue-500 outline-none`}
                                            maxLength={30}
                                        />
                                        <Button
                                            variant="primary"
                                            darkMode={!darkMode}
                                            disabled={updatingName || !newName.trim()}
                                            className="whitespace-nowrap px-4"
                                        >
                                            {updatingName ? 'Saving...' : 'Update'}
                                        </Button>
                                    </div>
                                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                                    <p className="text-xs text-slate-400 mt-2">
                                        This name will be visible to other users on the leaderboard.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Leaderboard */}
                    <div className={`p-8 rounded-3xl ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${theme.borderClass} shadow-xl`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <h2 className={`text-2xl font-bold ${theme.textClass}`}>Leaderboard</h2>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {waitlistData?.leaderboard?.map((entry, idx) => (
                                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold 
                                    ${idx < 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}
                                `}>
                                            {idx + 1}
                                        </span>
                                        <span className={`font-medium ${theme.textClass}`}>
                                            {entry.name || 'Anonymous'}
                                        </span>
                                    </div>
                                    <span className={`text-xs ${theme.textSecondaryClass}`}>
                                        {new Date(entry.joinedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}

                            {(!waitlistData?.leaderboard || waitlistData.leaderboard.length === 0) && (
                                <p className={`text-center ${theme.textSecondaryClass} py-8`}>
                                    No users yet. Be the first!
                                </p>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
                            <p className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 text-xl`}>
                                Coming Soon
                            </p>
                            <p className={`text-sm ${theme.textSecondaryClass} mt-2`}>
                                We are working hard to bring you the best AI financial planning experience.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
