'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, Compass, ArrowRight, Moon, Sun, ThumbsUp, Lightbulb, LogIn, X, Send } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Button } from '@/components/ui/Button';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeaders } from '@/lib/api-client';

interface PhilosophyPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onGetStarted: () => void;
  onBack: () => void;
}

// Interface for ideas (UI only, no DB integration yet)
interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  votes: number;
  userVoted: boolean;
  author: string;
  createdAt: string;
}

export const PhilosophyPage: React.FC<PhilosophyPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onGetStarted,
  onBack
}) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState('philosophy');
  const theme = useThemeClasses(darkMode);
  const { user, loading: authLoading } = useAuth();

  // Idea submission state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaCategory, setIdeaCategory] = useState('new-agent');

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);

  // Helper to format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
  };

  // Fetch ideas from API
  useEffect(() => {
    async function fetchIdeas() {
      try {
        setLoadingIdeas(true);
        const headers = await getAuthHeaders();
        const response = await fetch('/api/community/ideas', {
          headers
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch ideas');
        }
        
        const data = await response.json();
        // Format ideas with relative time
        const formattedIdeas = (data.ideas || []).map((idea: any) => ({
          ...idea,
          createdAt: formatRelativeTime(idea.createdAt)
        }));
        setIdeas(formattedIdeas);
      } catch (error) {
        console.error('Error fetching ideas:', error);
        // Keep empty array on error
        setIdeas([]);
      } finally {
        setLoadingIdeas(false);
      }
    }
    
    fetchIdeas();
  }, [user]);

  const bgGradientClass = darkMode 
    ? 'bg-gradient-to-br from-slate-900 to-slate-800' 
    : 'bg-gradient-to-br from-slate-50 to-blue-50';

  const handleCheckinClick = () => {
    router.push('/checkin');
  };

  // Handle idea submission
  const handleSubmitIdea = async () => {
    if (!ideaTitle.trim() || !ideaDescription.trim() || !user) return;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/community/ideas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: ideaTitle,
          description: ideaDescription,
          category: ideaCategory
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit idea');
      }
      
      const { idea } = await response.json();
      
      // Add new idea to the list
      const formattedIdea: Idea = {
        ...idea,
        createdAt: formatRelativeTime(idea.createdAt)
      };
      
      setIdeas([formattedIdea, ...ideas]);
      setIdeaTitle('');
      setIdeaDescription('');
      setIdeaCategory('new-agent');
      setShowSubmitForm(false);
    } catch (error) {
      console.error('Error submitting idea:', error);
      alert('Failed to submit idea. Please try again.');
    }
  };

  // Handle vote toggle
  const handleVote = async (ideaId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/community/ideas/${ideaId}/vote`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to vote');
      }
      
      const { voted, votes } = await response.json();
      
      // Update idea in the list
      setIdeas(ideas.map(idea => {
        if (idea.id === ideaId) {
          return {
            ...idea,
            userVoted: voted,
            votes: votes
          };
        }
        return idea;
      }));
    } catch (error) {
      console.error('Error voting:', error);
      // Optimistically update UI
      setIdeas(ideas.map(idea => {
        if (idea.id === ideaId) {
          const newVoted = !idea.userVoted;
          return {
            ...idea,
            userVoted: newVoted,
            votes: newVoted ? idea.votes + 1 : Math.max(0, idea.votes - 1)
          };
        }
        return idea;
      }));
    }
  };

  // Adaptive Intelligence page
  if (currentPage === 'adaptive') {
    return (
      <div className={`min-h-screen ${bgGradientClass} transition-colors duration-300`}>
        <header className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentPage('philosophy')}
                className={`${theme.textSecondaryClass} hover:${theme.textClass} flex items-center gap-2 transition-colors`}
              >
                ← Back to Philosophy
              </button>
              <button
                onClick={onToggleDarkMode}
                className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            <h1 className={`text-3xl font-bold ${theme.textClass} mb-2`}>Adaptive Intelligence</h1>
            <p className={theme.textSecondaryClass}>How Zoro learns and adapts to your financial context</p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-12">
          {/* Header Section */}
          <div className={`${theme.cardBgClass} rounded-2xl shadow-lg p-12 border ${theme.borderClass} mb-8`}>
            <div className="text-center mb-8">
              <div className={`w-24 h-24 ${theme.accentBgClass} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <Sparkles className={`w-12 h-12 ${darkMode ? 'text-blue-400' : 'text-slate-700'}`} />
              </div>
              <h2 className={`text-3xl font-bold ${theme.textClass} mb-4`}>Community-Driven Development</h2>
              <p className={`text-lg ${theme.textSecondaryClass} max-w-2xl mx-auto`}>
                Help shape how Zoro evolves. Submit ideas for new agents and features, and vote on what you'd like to see next.
              </p>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className={`p-6 ${theme.accentBgClass} rounded-xl border ${theme.borderClass}`}>
                <h4 className={`font-bold ${theme.textClass} text-lg mb-2`}>Specialized Sub-Agents</h4>
                <p className={`${theme.textSecondaryClass} text-sm`}>Tax optimization, portfolio analysis, regulatory compliance, and more.</p>
              </div>
              <div className={`p-6 ${theme.accentBgClass} rounded-xl border ${theme.borderClass}`}>
                <h4 className={`font-bold ${theme.textClass} text-lg mb-2`}>Your Voice Matters</h4>
                <p className={`${theme.textSecondaryClass} text-sm`}>Submit and vote on ideas to help us prioritize features.</p>
              </div>
              <div className={`p-6 ${theme.accentBgClass} rounded-xl border ${theme.borderClass}`}>
                <h4 className={`font-bold ${theme.textClass} text-lg mb-2`}>Context-Aware Reasoning</h4>
                <p className={`${theme.textSecondaryClass} text-sm`}>Understands NRI vs resident status, tax jurisdictions, and life stages.</p>
              </div>
            </div>

            {/* Submit Idea Section */}
            {user ? (
              <div className="mt-8">
                {!showSubmitForm ? (
                  <Button
                    variant="primary"
                    darkMode={darkMode}
                    onClick={() => setShowSubmitForm(true)}
                    className="w-full md:w-auto"
                  >
                    <Lightbulb className="w-5 h-5 mr-2" />
                    Submit Your Idea
                  </Button>
                ) : (
                  <div className={`${theme.cardBgClass} rounded-xl p-6 border ${theme.borderClass}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-xl font-bold ${theme.textClass}`}>Submit a New Idea</h3>
                      <button
                        onClick={() => {
                          setShowSubmitForm(false);
                          setIdeaTitle('');
                          setIdeaDescription('');
                        }}
                        className={`p-1 rounded-lg ${theme.textSecondaryClass} ${darkMode ? 'hover:text-white' : 'hover:text-slate-900'} transition-colors`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
                          Category
                        </label>
                        <select
                          value={ideaCategory}
                          onChange={(e) => setIdeaCategory(e.target.value)}
                          className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        >
                          <option value="new-agent">New Agent</option>
                          <option value="feature">Feature</option>
                          <option value="tool">Tool</option>
                          <option value="improvement">Improvement</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={ideaTitle}
                          onChange={(e) => setIdeaTitle(e.target.value)}
                          placeholder="e.g., Estate Planning Agent"
                          className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
                          Description
                        </label>
                        <textarea
                          value={ideaDescription}
                          onChange={(e) => setIdeaDescription(e.target.value)}
                          placeholder="Describe your idea in detail..."
                          rows={4}
                          className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                        />
                      </div>
                      <Button
                        variant="primary"
                        darkMode={darkMode}
                        onClick={handleSubmitIdea}
                        disabled={!ideaTitle.trim() || !ideaDescription.trim()}
                        className="w-full"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Submit Idea
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`${theme.accentBgClass} rounded-xl p-6 border ${theme.borderClass} text-center`}>
                <LogIn className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-xl font-bold ${theme.textClass} mb-2`}>Sign In to Participate</h3>
                <p className={`${theme.textSecondaryClass} mb-4`}>
                  Please sign in to submit ideas and vote on features you'd like to see.
                </p>
                <Button
                  variant="primary"
                  darkMode={darkMode}
                  onClick={() => router.push('/login')}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </div>
            )}
          </div>

          {/* Ideas List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl font-bold ${theme.textClass}`}>Community Ideas</h3>
              <div className={`text-sm ${theme.textSecondaryClass}`}>
                {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}
              </div>
            </div>

            {user ? (
              <div className="space-y-4">
                {loadingIdeas && (
                  <div className={`${theme.cardBgClass} rounded-xl p-6 border ${theme.borderClass} text-center`}>
                    <p className={theme.textSecondaryClass}>Loading ideas...</p>
                  </div>
                )}
                {!loadingIdeas && ideas.length === 0 && (
                  <div className={`${theme.cardBgClass} rounded-xl p-6 border ${theme.borderClass} text-center`}>
                    <p className={theme.textSecondaryClass}>No ideas yet. Be the first to submit one!</p>
                  </div>
                )}
                {!loadingIdeas && ideas.map((idea) => (
                  <div
                    key={idea.id}
                    className={`${theme.cardBgClass} rounded-xl p-6 border ${theme.borderClass} hover:shadow-lg transition-shadow`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            idea.category === 'new-agent' 
                              ? darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700' :
                            idea.category === 'feature' 
                              ? darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700' :
                            idea.category === 'tool' 
                              ? darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700' :
                              darkMode ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {idea.category === 'new-agent' ? 'New Agent' :
                             idea.category === 'feature' ? 'Feature' :
                             idea.category === 'tool' ? 'Tool' : 'Improvement'}
                          </span>
                          <span className={`text-xs ${theme.textSecondaryClass}`}>
                            by {idea.author} • {idea.createdAt}
                          </span>
                        </div>
                        <h4 className={`text-xl font-bold ${theme.textClass} mb-2`}>{idea.title}</h4>
                        <p className={`${theme.textSecondaryClass} leading-relaxed`}>{idea.description}</p>
                      </div>
                      <button
                        onClick={() => handleVote(idea.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                          idea.userVoted
                            ? 'bg-blue-600 text-white border-blue-600'
                            : `${theme.borderClass} ${theme.accentBgClass} ${theme.textSecondaryClass} hover:bg-blue-50 hover:border-blue-300`
                        }`}
                        title={idea.userVoted ? 'Remove vote' : 'Vote for this idea'}
                      >
                        <ThumbsUp className={`w-5 h-5 mb-1 ${idea.userVoted ? 'text-white' : ''}`} />
                        <span className={`text-sm font-bold ${idea.userVoted ? 'text-white' : ''}`}>
                          {idea.votes}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${theme.cardBgClass} rounded-xl p-12 border ${theme.borderClass} text-center`}>
                <LogIn className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-xl font-bold ${theme.textClass} mb-2`}>Sign In to View Ideas</h3>
                <p className={`${theme.textSecondaryClass} mb-6`}>
                  Please sign in to see community ideas and vote on features you'd like to see.
                </p>
                <Button
                  variant="primary"
                  darkMode={darkMode}
                  onClick={() => router.push('/login')}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // About Us & Roadmap page
  if (currentPage === 'about') {
    return (
      <div className={`min-h-screen ${bgGradientClass} transition-colors duration-300`}>
        <header className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentPage('philosophy')}
                className={`${theme.textSecondaryClass} hover:${theme.textClass} flex items-center gap-2 transition-colors`}
              >
                ← Back to Philosophy
              </button>
              <button
                onClick={onToggleDarkMode}
                className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
            <h1 className={`text-3xl font-bold ${theme.textClass} mb-2`}>About Us & Roadmap</h1>
            <p className={theme.textSecondaryClass}>Our mission and what we're building next</p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className={`${theme.cardBgClass} rounded-2xl shadow-lg p-12 border ${theme.borderClass}`}>
            <div className="text-center mb-12">
              <div className={`w-24 h-24 ${theme.accentBgClass} rounded-full flex items-center justify-center mx-auto mb-6`}>
                <Compass className={`w-12 h-12 ${darkMode ? 'text-blue-400' : 'text-slate-700'}`} />
              </div>
              <h2 className={`text-3xl font-bold ${theme.textClass} mb-4`}>Guided Independence</h2>
              <p className={`text-lg ${theme.textSecondaryClass} max-w-3xl mx-auto`}>
                We believe financial decisions should be made by you, with AI as your trusted advisor. Here's what we're working on to make that vision a reality.
              </p>
            </div>

            {/* Roadmap */}
            <div className="space-y-8 max-w-3xl mx-auto mb-12">
              <div className={`border-l-4 ${darkMode ? 'border-blue-400' : 'border-slate-800'} pl-6 py-2`}>
                <div className={`text-sm ${theme.textSecondaryClass} mb-1`}>Q4 2025</div>
                <h4 className={`font-bold ${theme.textClass} text-xl mb-2`}>✅ Financial Check-ins</h4>
                <p className={theme.textSecondaryClass}>Regular email check-ins with personalized financial snapshots and actionable suggestions. Reply to update goals and preferences.</p>
              </div>

              <div className={`border-l-4 ${darkMode ? 'border-blue-500' : 'border-slate-600'} pl-6 py-2`}>
                <div className={`text-sm ${theme.textSecondaryClass} mb-1`}>Q1 2026</div>
                <h4 className={`font-bold ${theme.textClass} text-xl mb-2`}>🔄 Profile & Estate Planning</h4>
                <p className={theme.textSecondaryClass}>Comprehensive financial profile builder and estate planning tools. Track assets, liabilities, insurance, and estate preferences all in one place.</p>
              </div>

              <div className={`border-l-4 ${darkMode ? 'border-blue-300' : 'border-slate-400'} pl-6 py-2`}>
                <div className={`text-sm ${theme.textSecondaryClass} mb-1`}>Q2 2026</div>
                <h4 className={`font-bold ${theme.textClass} text-xl mb-2`}>🤖 Specialized Sub-Agents</h4>
                <p className={theme.textSecondaryClass}>Tax optimization agent, portfolio analysis agent, estate planning agent—each focusing on specific wealth management domains.</p>
              </div>

              <div className={`border-l-4 ${darkMode ? 'border-blue-200' : 'border-slate-300'} pl-6 py-2`}>
                <div className={`text-sm ${theme.textSecondaryClass} mb-1`}>Q3 2026</div>
                <h4 className={`font-bold ${theme.textClass} text-xl mb-2`}>🔗 Financial Institution Integration</h4>
                <p className={theme.textSecondaryClass}>Connect your accounts securely for real-time personalized advice based on your actual financial data.</p>
              </div>

              <div className={`border-l-4 ${darkMode ? 'border-blue-100' : 'border-slate-200'} pl-6 py-2`}>
                <div className={`text-sm ${theme.textSecondaryClass} mb-1`}>Future</div>
                <h4 className={`font-bold ${theme.textClass} text-xl mb-2`}>🌐 Community Platform</h4>
                <p className={theme.textSecondaryClass}>Connect with certified advisors, share insights with peers, and participate in collaborative learning experiences.</p>
              </div>
            </div>

            <div className={`p-6 ${theme.accentBgClass} rounded-xl text-center border ${theme.borderClass}`}>
              <p className={`${theme.textClass} font-medium mb-4`}>Want to influence our roadmap?</p>
              <Button
                variant="primary"
                darkMode={darkMode}
                className="px-6 py-3"
              >
                Join Our Community
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Philosophy page (main)
  return (
    <div className={`min-h-screen ${bgGradientClass} transition-colors duration-300`}>
      <header className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center cursor-pointer"
            aria-label="Back to home"
          >
            <ZoroLogo className="h-8" isDark={darkMode} />
          </button>
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
          <h1 className={`text-3xl font-bold ${theme.textClass} mb-2 mt-4`}>Our Philosophy</h1>
          <p className={theme.textSecondaryClass}>How Zoro works with you to build wealth wisdom</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className={`text-4xl font-bold ${theme.textClass} mb-4`}>Meet Zoro, Your Financial Companion</h2>
          <p className={`text-xl ${theme.textSecondaryClass} max-w-3xl mx-auto`}>
            Like a curious cat that learns your habits and preferences, Zoro adapts to you but you are always in control.
        </p>
      </div>

        {/* Three Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Principle 1: Goal Setting */}
          <div 
            className={`${theme.cardBgClass} rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all group cursor-pointer border ${theme.borderClass} ${theme.cardHoverClass}`}
            onClick={handleCheckinClick}
          >
            <div className={`w-16 h-16 ${theme.accentBgClass} rounded-full flex items-center justify-center mb-6 transition-colors ${darkMode ? 'group-hover:bg-blue-600' : 'group-hover:bg-slate-800'}`}>
              <BookOpen className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
                </div>
            <h3 className={`text-2xl font-bold ${theme.textClass} mb-4`}>You Set Your Goals</h3>
            <p className={`${theme.textSecondaryClass} mb-6`}>
              Just like you choose what treats to give your cat, you decide what financial goals matter most to you. Select from saving, investing, home planning, insurance, tax optimization, or retirement. You control what Zoro focuses on in your regular check-ins.
            </p>
            <div className={`flex items-center font-medium transition-colors ${theme.textSecondaryClass} ${darkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900'}`}>
              Set Up Check-ins <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

          {/* Principle 2: Adaptive Intelligence */}
          <div 
            className={`${theme.cardBgClass} rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all group cursor-pointer border ${theme.borderClass} ${theme.cardHoverClass}`}
            onClick={() => setCurrentPage('adaptive')}
          >
            <div className={`w-16 h-16 ${theme.accentBgClass} rounded-full flex items-center justify-center mb-6 transition-colors ${darkMode ? 'group-hover:bg-blue-600' : 'group-hover:bg-slate-800'}`}>
              <Sparkles className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
            </div>
            <h3 className={`text-2xl font-bold ${theme.textClass} mb-4`}>Zoro Learns</h3>
            <p className={`${theme.textSecondaryClass} mb-6`}>
              Every cat has its own personality, Zoro develops yours. The more you reply to check-in emails and update your goals, the better Zoro understands your context: NRI or resident, risk appetite, life stage, and financial priorities. Powered by specialized agents working for you behind the scenes.
            </p>
            <div className={`flex items-center font-medium transition-colors ${theme.textSecondaryClass} ${darkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900'}`}>
              See How It Works <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Principle 3: Guided Independence */}
          <div 
            className={`${theme.cardBgClass} rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all group cursor-pointer border ${theme.borderClass} ${theme.cardHoverClass}`}
            onClick={() => setCurrentPage('about')}
          >
            <div className={`w-16 h-16 ${theme.accentBgClass} rounded-full flex items-center justify-center mb-6 transition-colors ${darkMode ? 'group-hover:bg-blue-600' : 'group-hover:bg-slate-800'}`}>
              <Compass className={`w-8 h-8 transition-colors ${darkMode ? 'text-blue-300 group-hover:text-white' : 'text-slate-700 group-hover:text-white'}`} />
            </div>
            <h3 className={`text-2xl font-bold ${theme.textClass} mb-4`}>You Decide</h3>
            <p className={`${theme.textSecondaryClass} mb-6`}>
              Cats are independent, but they still need their humans. Zoro provides insights and recommendations, but YOU make the final decisions. AI assists, you control. Financial planning is deeply personal. Zoro is your guide, not your master.
            </p>
            <div className={`flex items-center font-medium transition-colors ${theme.textSecondaryClass} ${darkMode ? 'group-hover:text-white' : 'group-hover:text-slate-900'}`}>
              About Us & Roadmap <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
          </div>
      </div>

        {/* Why This Matters */}
        <div className={`${darkMode ? 'bg-white' : 'bg-slate-800'} ${darkMode ? 'text-blue-600' : 'text-white'} rounded-2xl p-12 border ${theme.borderClass}`}>
          <h3 className={`text-3xl font-bold mb-4 text-center ${darkMode ? 'text-blue-600' : 'text-white'}`}>Why This Approach Works</h3>
          <p className={`text-lg ${darkMode ? 'text-slate-700' : 'text-slate-200'} max-w-3xl mx-auto mb-8 text-center`}>
            Traditional financial advice is too generic, expensive and slow. Zoro delivers regular, personalized check-ins via email that adapt to your goals and context. You remain in full control—reply to any email to update your preferences. Tailored for Indians and NRIs.
          </p>
          <div className="text-center mb-8">
          <Button
            variant="primary"
            darkMode={darkMode}
              onClick={handleCheckinClick}
              className="px-8 py-4 text-lg"
          >
              Set Up Your Check-ins
          </Button>
          </div>
          <p className={`text-sm ${darkMode ? 'text-slate-600' : 'text-slate-400'} text-center italic`}>
            Zoro is your money cat. It is always on your side. Set your goals and it helps you stay on track with regular, actionable check-ins.
          </p>
        </div>
      </div>
    </div>
  );
};

