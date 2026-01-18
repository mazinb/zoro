'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { Sun, Moon, Search, Edit2, Check, X, LogOut } from 'lucide-react';
import Link from 'next/link';

const ADMIN_EMAIL = 'mazin.biviji1@gmail.com';

interface Submission {
    id: string;
    email: string | null;
    public_name: string;
    joinedAt: string;
    net_worth: string;
    primary_goal: string;
    full_info: any;
}

export default function AdminPage() {
    const router = useRouter();
    const { user, session, loading, signOut } = useAuth();
    const { darkMode, toggleDarkMode } = useDarkMode();
    const theme = useThemeClasses(darkMode);

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [error, setError] = useState('');

    // Check auth
    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login?redirect=/admin');
            } else if (user.email !== ADMIN_EMAIL) {
                router.push('/dashboard');
            }
        }
    }, [user, loading, router]);

    // Fetch data
    const fetchData = async () => {
        if (!session?.access_token) return;

        try {
            setLoadingData(true);
            const res = await fetch('/api/admin/waitlist', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                setSubmissions(data.submissions || []);
            } else {
                setError('Failed to fetch data');
            }
        } catch (e) {
            setError('Error fetching data');
            console.error(e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (session?.access_token && user?.email === ADMIN_EMAIL) {
            fetchData();
        }
    }, [session, user]);

    const handleStartEdit = (sub: Submission) => {
        setEditingId(sub.id);
        setEditName(sub.public_name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!session?.access_token) return;

        try {
            const res = await fetch('/api/admin/waitlist', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ id, public_name: editName })
            });

            if (res.ok) {
                // Optimistic update
                setSubmissions(prev => prev.map(s =>
                    s.id === id ? { ...s, public_name: editName } : s
                ));
                setEditingId(null);
            } else {
                alert('Failed to update');
            }
        } catch (e) {
            console.error(e);
            alert('Error saving');
        }
    };

    if (loading || (user && user.email !== ADMIN_EMAIL)) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
            <nav className={`border-b ${theme.borderClass}`}>
                <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <ZoroLogo className="h-8" isDark={darkMode} />
                        </Link>
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold uppercase">Admin</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleDarkMode}
                            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                        >
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button onClick={() => signOut()} className={`p-2 ${theme.textSecondaryClass}`}>
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className={`text-2xl font-bold ${theme.textClass}`}>Waitlist Management</h1>
                    <Button variant="secondary" darkMode={!darkMode} onClick={fetchData}>
                        Refresh
                    </Button>
                </div>

                {error && <div className="p-4 rounded-lg bg-red-100 text-red-700 mb-6">{error}</div>}

                <div className={`overflow-x-auto rounded-xl border ${theme.borderClass} ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                    <table className="w-full text-left text-sm">
                        <thead className={`border-b ${theme.borderClass} ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                            <tr>
                                <th className={`p-4 font-medium ${theme.textSecondaryClass}`}>Joined</th>
                                <th className={`p-4 font-medium ${theme.textSecondaryClass}`}>Email</th>
                                <th className={`p-4 font-medium ${theme.textSecondaryClass}`}>Public Name</th>
                                <th className={`p-4 font-medium ${theme.textSecondaryClass}`}>Net Worth</th>
                                <th className={`p-4 font-medium ${theme.textSecondaryClass}`}>Goal</th>
                                <th className={`p-4 font-medium ${theme.textSecondaryClass}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {loadingData ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center">Loading data...</td>
                                </tr>
                            ) : submissions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center">No submissions found</td>
                                </tr>
                            ) : (
                                submissions.map((sub) => (
                                    <tr key={sub.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors`}>
                                        <td className={`p-4 ${theme.textSecondaryClass}`}>
                                            {new Date(sub.joinedAt).toLocaleDateString()}
                                        </td>
                                        <td className={`p-4 font-medium ${theme.textClass}`}>
                                            {sub.email || '-'}
                                        </td>
                                        <td className={`p-4 ${theme.textClass}`}>
                                            {editingId === sub.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className={`w-32 px-2 py-1 rounded border ${theme.borderClass} bg-transparent`}
                                                    />
                                                </div>
                                            ) : (
                                                sub.public_name || <span className="text-slate-400 italic">None</span>
                                            )}
                                        </td>
                                        <td className={`p-4 ${theme.textSecondaryClass}`}>
                                            {sub.net_worth}
                                        </td>
                                        <td className={`p-4 ${theme.textSecondaryClass}`}>
                                            {sub.primary_goal}
                                        </td>
                                        <td className="p-4">
                                            {editingId === sub.id ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleSaveEdit(sub.id)} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-1 text-red-600 hover:bg-red-100 rounded">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleStartEdit(sub)} className="p-1 text-blue-600 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
