'use client';

import React, { useState, useEffect } from 'react';
import { Search, Clock, TrendingUp, Eye, Tag, Calendar, BarChart3, Users, Filter, ChevronDown, ChevronUp, Bookmark, Zap, User, Settings, Plus, Edit, X, Moon, Sun } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ZoroLogo } from '@/components/ZoroLogo';
import Link from 'next/link';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  author: string;
  publishDate: string;
  estimatedReadTime: number;
  category: string;
  targetAudience: string[];
  complexity: string;
  jurisdiction: string[];
  keyTopics: string[];
  engagementScore: number;
}

const WealthBlog = () => {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [viewMode, setViewMode] = useState<'user' | 'planner'>('user');
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState('');
  const [readTime, setReadTime] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [savedArticles, setSavedArticles] = useState(new Set());
  const [zoroArticles, setZoroArticles] = useState(new Set());
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [authorFilter, setAuthorFilter] = useState('all');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [showZoroPanel, setShowZoroPanel] = useState(false);

  // Sample blog posts with LLM-friendly structured metadata
  const blogPosts: BlogPost[] = [
    {
      id: 'post-1',
      title: 'Tax-Efficient Investment Strategies for NRIs in 2025',
      excerpt: 'Navigate the complexities of NRI taxation with strategic investment planning across multiple jurisdictions. Learn how to leverage Double Taxation Avoidance Agreements (DTAA) to minimize your tax burden while maximizing returns. This comprehensive guide covers capital gains treatment, TDS implications, and portfolio structuring for NRIs residing in the US, UAE, and other key jurisdictions.',
      tags: ['NRI', 'Tax Planning', 'Investments'],
      author: 'Priya Sharma',
      publishDate: '2025-10-28',
      estimatedReadTime: 8,
      category: 'Tax Planning',
      targetAudience: ['NRI', 'HNI'],
      complexity: 'Intermediate',
      jurisdiction: ['India', 'USA', 'UAE'],
      keyTopics: ['DTAA', 'Capital Gains', 'FEMA Compliance'],
      engagementScore: 87
    },
    {
      id: 'post-2',
      title: 'Building a Retirement Corpus: A Guide for Indian Millennials',
      excerpt: 'Start your retirement planning early with systematic investment strategies tailored for Indian millennials. Discover how to build a retirement corpus of ₹5-10 crores through disciplined SIPs, NPS contributions, and strategic asset allocation.',
      tags: ['Retirement', 'Millennials', 'Wealth Building'],
      author: 'Rajesh Kumar',
      publishDate: '2025-10-25',
      estimatedReadTime: 12,
      category: 'Retirement Planning',
      targetAudience: ['Millennials', 'Young Professionals'],
      complexity: 'Beginner',
      jurisdiction: ['India'],
      keyTopics: ['NPS', 'PPF', 'Equity Mutual Funds', 'SIP'],
      engagementScore: 92
    },
    {
      id: 'post-3',
      title: 'Real Estate vs. Gold: Asset Allocation for Wealth Preservation',
      excerpt: 'Compare traditional Indian investment avenues and their role in modern diversified portfolios. This detailed analysis examines historical returns, liquidity considerations, and tax implications of real estate and gold investments. We explore REITs and Sovereign Gold Bonds as modern alternatives to physical assets, helping you make informed decisions about wealth preservation strategies that align with your financial goals and risk tolerance.',
      tags: ['Asset Allocation', 'Real Estate', 'Gold'],
      author: 'Anita Desai',
      publishDate: '2025-10-20',
      estimatedReadTime: 10,
      category: 'Investment Strategy',
      targetAudience: ['HNI', 'Conservative Investors'],
      complexity: 'Intermediate',
      jurisdiction: ['India'],
      keyTopics: ['Diversification', 'Inflation Hedge', 'REITs', 'SGBs'],
      engagementScore: 78
    },
    {
      id: 'post-4',
      title: 'FEMA Regulations Every NRI Must Know in 2025',
      excerpt: 'Stay compliant with the latest FEMA guidelines affecting NRI investments and remittances. Understanding the Foreign Exchange Management Act is crucial for NRIs managing assets in India. This guide covers everything from NRE and NRO account differences to repatriation limits, LRS provisions, and recent regulatory updates that impact your cross-border financial planning.',
      tags: ['NRI', 'Compliance', 'FEMA'],
      author: 'Vikram Mehta',
      publishDate: '2025-10-15',
      estimatedReadTime: 15,
      category: 'Regulatory',
      targetAudience: ['NRI'],
      complexity: 'Advanced',
      jurisdiction: ['India'],
      keyTopics: ['NRE Account', 'NRO Account', 'Repatriation', 'LRS'],
      engagementScore: 81
    },
    {
      id: 'post-5',
      title: 'Health Insurance Planning for Families: Comprehensive Coverage',
      excerpt: 'Protect your family with optimal health insurance strategies balancing coverage and cost. Learn about family floater plans, super top-ups, and critical illness riders.',
      tags: ['Insurance', 'Health', 'Family Planning'],
      author: 'Dr. Sunita Rao',
      publishDate: '2025-10-10',
      estimatedReadTime: 9,
      category: 'Insurance',
      targetAudience: ['Families', 'Working Professionals'],
      complexity: 'Beginner',
      jurisdiction: ['India'],
      keyTopics: ['Family Floater', 'Top-up Plans', 'Critical Illness', 'Tax Benefits'],
      engagementScore: 95
    },
    {
      id: 'post-6',
      title: 'Estate Planning Essentials for High Net Worth Individuals',
      excerpt: 'Secure your family\'s financial future with comprehensive estate planning strategies. From will drafting to trust structures, learn how to efficiently transfer wealth across generations while minimizing tax implications. This guide covers succession planning, nomination updates, power of attorney, and the role of family settlements in preserving your legacy. Essential reading for anyone with significant assets looking to ensure smooth wealth transition and protect their loved ones from legal complications.',
      tags: ['Estate Planning', 'HNI', 'Wealth Transfer'],
      author: 'Priya Sharma',
      publishDate: '2025-10-05',
      estimatedReadTime: 14,
      category: 'Estate Planning',
      targetAudience: ['HNI', 'Business Owners'],
      complexity: 'Advanced',
      jurisdiction: ['India'],
      keyTopics: ['Will', 'Trust', 'Succession Planning', 'Wealth Transfer'],
      engagementScore: 85
    }
  ];

  // Initialize mock engagement data
  useEffect(() => {
    const initialViews: Record<string, number> = {};
    const initialReadTime: Record<string, number> = {};
    blogPosts.forEach(post => {
      initialViews[post.id] = Math.floor(Math.random() * 5000) + 500;
      initialReadTime[post.id] = 0;
    });
    setViewCounts(initialViews);
    setReadTime(initialReadTime);
  }, []);

  // Track read time when article is opened
  useEffect(() => {
    if (selectedArticle) {
      const interval = setInterval(() => {
        setReadTime(prev => ({
          ...prev,
          [selectedArticle.id]: (prev[selectedArticle.id] || 0) + 1
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedArticle]);

  // Get all unique tags and authors
  const allTags = ['all', ...new Set(blogPosts.flatMap(post => post.tags))];
  const allAuthors = ['all', ...new Set(blogPosts.map(post => post.author))];

  // Filter posts
  const filteredPosts = blogPosts.filter(post => {
    const matchesTag = selectedTag === 'all' || post.tags.includes(selectedTag);
    const matchesAuthor = authorFilter === 'all' || post.author === authorFilter;
    const matchesSearch = searchQuery === '' || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTag && matchesSearch && matchesAuthor;
  });

  // Calculate engagement metrics
  const totalViews = Object.values(viewCounts).reduce((a: number, b: number) => a + b, 0);
  const avgEngagement = blogPosts.reduce((a: number, b: BlogPost) => a + b.engagementScore, 0) / blogPosts.length;

  const toggleSaveArticle = (postId: string) => {
    setSavedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleZoroArticle = (postId: string) => {
    setZoroArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // Zoro Z Icon Component
  const ZoroZIcon = ({ postId, isSelected, className = "w-5 h-5" }: { postId: string; isSelected: boolean; className?: string }) => {
    // Simple Z icon - white when selected, grey when not selected (same as save button)
    // Extract just the Z part (viewBox from 0 0 44 45 to center the Z)
    const iconColor = isSelected ? "white" : "#64748B";
    
    return (
      <svg 
        className={className}
        viewBox="0 0 44 45" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          <rect 
            x="6"
            y="8"
            width="32"
            height="5"
            rx="2.5"
            fill={iconColor}
          />
          <path 
            d="M 10 30 L 19 20 L 25 25 L 34 16"
            stroke={iconColor}
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
          <path 
            d="M 10 37 L 19 27 L 25 32 L 34 23"
            stroke={iconColor}
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
          <rect 
            x="6"
            y="37"
            width="32"
            height="5"
            rx="2.5"
            fill={iconColor}
          />
        </g>
      </svg>
    );
  };

  // Saved Articles Panel Component
  const SavedArticlesPanel = () => {
    const savedPosts = blogPosts.filter(post => savedArticles.has(post.id));
    
    return (
      <>
        {/* Mobile overlay - only on mobile */}
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowSavedPanel(false)} />
        
        {/* Desktop - no overlay, just side panel */}
        <div className="hidden md:block fixed right-0 top-0 bottom-0 w-96 z-50">
          <div className={`${theme.cardBgClass} h-full overflow-y-auto border-l ${theme.cardBorderClass} shadow-xl`}>
            <div className={`p-6 border-b ${theme.borderClass} flex items-center justify-between sticky top-0 ${theme.cardBgClass} z-10`}>
            <div className="flex items-center gap-2">
              <Bookmark className={`w-5 h-5 ${theme.textSecondaryClass}`} />
              <h2 className={`text-xl font-bold ${theme.textClass}`}>Read Later</h2>
              <span className={`px-2 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'} rounded-full text-xs font-medium`}>
                {savedArticles.size}
              </span>
            </div>
              <button onClick={() => setShowSavedPanel(false)} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 pb-24">
              {savedPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className={`w-12 h-12 ${theme.textSecondaryClass} mx-auto mb-4`} />
                  <p className={theme.textSecondaryClass}>No saved articles yet</p>
                  <p className={`text-sm ${theme.textSecondaryClass} mt-2`}>Click the bookmark icon on articles to save them for later</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedPosts.map(post => (
                    <div key={post.id} className={`border ${theme.cardBorderClass} rounded-lg p-4 hover:shadow-md transition-shadow ${theme.cardBgClass}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold ${theme.textClass} text-sm line-clamp-2 flex-1`}>{post.title}</h3>
                        <button
                          onClick={() => toggleSaveArticle(post.id)}
                          className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className={`text-xs ${theme.textSecondaryClass} mb-3 line-clamp-2`}>{post.excerpt}</p>
                      <div className={`flex items-center justify-between text-xs ${theme.textSecondaryClass}`}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.estimatedReadTime}m
                        </span>
                        <button
                          onClick={() => {
                            setSelectedArticle(post);
                            setShowSavedPanel(false);
                          }}
                          className={`${theme.textClass} font-medium hover:${theme.textClass} transition-colors`}
                        >
                          Read →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile - bottom sheet with overlay */}
        <div className="md:hidden fixed inset-0 flex items-end z-50 pointer-events-none">
          <div className={`${theme.cardBgClass} w-full max-h-[85vh] rounded-t-xl overflow-hidden border-t ${theme.cardBorderClass} shadow-2xl pointer-events-auto flex flex-col`}>
            <div className={`p-6 border-b ${theme.borderClass} flex items-center justify-between flex-shrink-0`}>
              <div className="flex items-center gap-2">
                <Bookmark className={`w-5 h-5 ${theme.textSecondaryClass}`} />
                <h2 className={`text-xl font-bold ${theme.textClass}`}>Read Later</h2>
                <span className={`px-2 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'} rounded-full text-xs font-medium`}>
                  {savedArticles.size}
                </span>
              </div>
              <button onClick={() => setShowSavedPanel(false)} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {savedPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className={`w-12 h-12 ${theme.textSecondaryClass} mx-auto mb-4`} />
                  <p className={theme.textSecondaryClass}>No saved articles yet</p>
                  <p className={`text-sm ${theme.textSecondaryClass} mt-2`}>Click the bookmark icon on articles to save them for later</p>
                </div>
              ) : (
                <div className="space-y-4 pb-8">
                  {savedPosts.map(post => (
                    <div key={post.id} className={`border ${theme.cardBorderClass} rounded-lg p-4 hover:shadow-md transition-shadow ${theme.cardBgClass}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold ${theme.textClass} text-sm line-clamp-2 flex-1`}>{post.title}</h3>
                        <button
                          onClick={() => toggleSaveArticle(post.id)}
                          className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className={`text-xs ${theme.textSecondaryClass} mb-3 line-clamp-2`}>{post.excerpt}</p>
                      <div className={`flex items-center justify-between text-xs ${theme.textSecondaryClass}`}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.estimatedReadTime}m
                        </span>
                        <button
                          onClick={() => {
                            setSelectedArticle(post);
                            setShowSavedPanel(false);
                          }}
                          className={`${theme.textClass} font-medium hover:${theme.textClass} transition-colors`}
                        >
                          Read →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Zoro Context Panel Component
  const ZoroContextPanel = () => {
    const zoroPosts = blogPosts.filter(post => zoroArticles.has(post.id));
    
    return (
      <>
        {/* Mobile overlay - only on mobile */}
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowZoroPanel(false)} />
        
        {/* Desktop - no overlay, just side panel */}
        <div className="hidden md:block fixed right-0 top-0 bottom-0 w-96 z-50">
          <div className={`${theme.cardBgClass} h-full overflow-y-auto border-l ${theme.cardBorderClass} shadow-xl`}>
            <div className={`p-6 border-b ${theme.borderClass} flex items-center justify-between sticky top-0 ${theme.cardBgClass} z-10`}>
              <div className="flex items-center gap-2">
                <ZoroZIcon postId="panel" isSelected={zoroArticles.size > 0} className="w-5 h-5" />
                <h2 className={`text-xl font-bold ${theme.textClass}`}>Zoro Context</h2>
                <span className={`px-2 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'} rounded-full text-xs font-medium`}>
                  {zoroArticles.size}
                </span>
              </div>
              <button onClick={() => setShowZoroPanel(false)} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 pb-24">
              <div className={`${theme.accentBgClass} rounded-lg p-4 mb-6 border ${theme.cardBorderClass}`}>
                <p className={`text-sm ${theme.textClass}`}>
                  Articles added here will be used by Zoro, your AI advisor, to provide personalized wealth management recommendations based on your reading interests.
                </p>
              </div>
              {zoroPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className={`w-12 h-12 ${theme.textSecondaryClass} mx-auto mb-4`} />
                  <p className={theme.textSecondaryClass}>No articles in context yet</p>
                  <p className={`text-sm ${theme.textSecondaryClass} mt-2`}>Click the Z icon on articles to add them to Zoro's context</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {zoroPosts.map(post => (
                    <div key={post.id} className={`border ${theme.cardBorderClass} rounded-lg p-4 hover:shadow-md transition-shadow ${theme.cardBgClass}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold ${theme.textClass} text-sm line-clamp-2 flex-1`}>{post.title}</h3>
                        <button
                          onClick={() => toggleZoroArticle(post.id)}
                          className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {post.keyTopics.slice(0, 3).map(topic => (
                          <span key={topic} className={`px-2 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'} rounded text-xs`}>
                            {topic}
                          </span>
                        ))}
                      </div>
                      <div className={`flex items-center justify-between text-xs ${theme.textSecondaryClass}`}>
                        <span>{post.category}</span>
                        <button
                          onClick={() => {
                            setSelectedArticle(post);
                            setShowZoroPanel(false);
                          }}
                          className={`${theme.textClass} font-medium hover:${theme.textClass} transition-colors`}
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile - bottom sheet with overlay */}
        <div className="md:hidden fixed inset-0 flex items-end z-50 pointer-events-none">
          <div className={`${theme.cardBgClass} w-full max-h-[85vh] rounded-t-xl overflow-hidden border-t ${theme.cardBorderClass} shadow-2xl pointer-events-auto flex flex-col`}>
            <div className={`p-6 border-b ${theme.borderClass} flex items-center justify-between flex-shrink-0`}>
              <div className="flex items-center gap-2">
                <ZoroZIcon postId="panel" isSelected={zoroArticles.size > 0} className="w-5 h-5" />
                <h2 className={`text-xl font-bold ${theme.textClass}`}>Zoro Context</h2>
                <span className={`px-2 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'} rounded-full text-xs font-medium`}>
                  {zoroArticles.size}
                </span>
              </div>
              <button onClick={() => setShowZoroPanel(false)} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className={`${theme.accentBgClass} rounded-lg p-4 mb-6 border ${theme.cardBorderClass}`}>
                <p className={`text-sm ${theme.textClass}`}>
                  Articles added here will be used by Zoro, your AI advisor, to provide personalized wealth management recommendations based on your reading interests.
                </p>
              </div>
              {zoroPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className={`w-12 h-12 ${theme.textSecondaryClass} mx-auto mb-4`} />
                  <p className={theme.textSecondaryClass}>No articles in context yet</p>
                  <p className={`text-sm ${theme.textSecondaryClass} mt-2`}>Click the Z icon on articles to add them to Zoro's context</p>
                </div>
              ) : (
                <div className="space-y-4 pb-8">
                  {zoroPosts.map(post => (
                    <div key={post.id} className={`border ${theme.cardBorderClass} rounded-lg p-4 hover:shadow-md transition-shadow ${theme.cardBgClass}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold ${theme.textClass} text-sm line-clamp-2 flex-1`}>{post.title}</h3>
                        <button
                          onClick={() => toggleZoroArticle(post.id)}
                          className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {post.keyTopics.slice(0, 3).map(topic => (
                          <span key={topic} className={`px-2 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'} rounded text-xs`}>
                            {topic}
                          </span>
                        ))}
                      </div>
                      <div className={`flex items-center justify-between text-xs ${theme.textSecondaryClass}`}>
                        <span>{post.category}</span>
                        <button
                          onClick={() => {
                            setSelectedArticle(post);
                            setShowZoroPanel(false);
                          }}
                          className={`${theme.textClass} font-medium hover:${theme.textClass} transition-colors`}
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  // New Post Modal Component
  const NewPostModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${theme.cardBgClass} rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${theme.cardBorderClass}`}>
        <div className={`p-6 border-b ${theme.borderClass} flex items-center justify-between sticky top-0 ${theme.cardBgClass}`}>
          <h2 className={`text-2xl font-bold ${theme.textClass}`}>Add New Article</h2>
          <button onClick={() => setShowNewPostModal(false)} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Title</label>
            <input type="text" className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} placeholder="Article title" />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Excerpt</label>
            <textarea className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} rows={3} placeholder="Brief description"></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Category</label>
              <select className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                <option>Tax Planning</option>
                <option>Investment Strategy</option>
                <option>Retirement Planning</option>
                <option>Insurance</option>
                <option>Regulatory</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Complexity</label>
              <select className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Tags (comma-separated)</label>
            <input type="text" className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} placeholder="NRI, Tax Planning, Investments" />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Google Drive Document ID</label>
            <input type="text" className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} placeholder="Will connect to Google Drive later" />
          </div>
          <div className="flex gap-3 pt-4">
            <button className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Publish Article
            </button>
            <button className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
              Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (selectedArticle) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setSelectedArticle(null)}
              className={`px-4 py-2 ${theme.cardBgClass} rounded-lg shadow hover:shadow-md transition-shadow text-blue-600 font-medium border ${theme.cardBorderClass}`}
            >
              ← Back to Articles
            </button>
            
            {viewMode === 'user' && (
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSaveArticle(selectedArticle.id)}
                  className={`p-2 rounded-lg transition-all ${
                    savedArticles.has(selectedArticle.id)
                      ? 'bg-blue-600 text-white shadow-lg'
                      : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Save for later"
                >
                  <Bookmark className="w-5 h-5" />
                </button>
                  <button
                    onClick={() => toggleZoroArticle(selectedArticle.id)}
                    className={`p-2 rounded-lg transition-all ${
                      zoroArticles.has(selectedArticle.id)
                        ? 'bg-blue-600 text-white shadow-lg'
                        : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Add to Zoro context"
                  >
                    <ZoroZIcon postId={selectedArticle.id} isSelected={zoroArticles.has(selectedArticle.id)} className="w-5 h-5" />
                  </button>
              </div>
            )}
          </div>
          
          <article className={`${theme.cardBgClass} rounded-2xl shadow-xl p-8 border ${theme.cardBorderClass}`}>
            <div className="mb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedArticle.tags.map((tag: string) => (
                  <span key={tag} className={`px-3 py-1 ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'} rounded-full text-sm font-medium`}>
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className={`text-4xl font-bold ${theme.textClass} mb-4`}>{selectedArticle.title}</h1>
              <div className={`flex items-center gap-6 text-sm ${theme.textSecondaryClass} mb-4`}>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {selectedArticle.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(selectedArticle.publishDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {selectedArticle.estimatedReadTime} min read
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {viewCounts[selectedArticle.id]?.toLocaleString()} views
                </span>
              </div>
            </div>

            {/* Engagement Stats */}
            {viewMode === 'planner' && (
              <div className={`grid grid-cols-3 gap-4 mb-8 p-4 ${darkMode ? 'bg-gradient-to-r from-blue-900 to-indigo-900' : 'bg-gradient-to-r from-blue-50 to-indigo-50'} rounded-xl`}>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{readTime[selectedArticle.id] || 0}s</div>
                  <div className={`text-sm ${theme.textSecondaryClass}`}>Avg Time Reading</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedArticle.engagementScore}%</div>
                  <div className={`text-sm ${theme.textSecondaryClass}`}>Engagement Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{viewCounts[selectedArticle.id]?.toLocaleString()}</div>
                  <div className={`text-sm ${theme.textSecondaryClass}`}>Total Views</div>
                </div>
              </div>
            )}

            <div className="prose max-w-none mb-8">
              <p className={`text-lg ${theme.textClass} leading-relaxed`}>{selectedArticle.excerpt}</p>
              <p className={`${theme.textClass} leading-relaxed mt-4`}>
                [Article content would be loaded from Google Drive here. This is a placeholder for the full article content that will be dynamically loaded based on the post ID.]
              </p>
            </div>

            {/* Collapsible LLM-Friendly Structured Metadata */}
            <div className={`border-t ${theme.borderClass} pt-6 mt-8`}>
              <button
                onClick={() => setMetadataExpanded(!metadataExpanded)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className={`text-lg font-bold ${theme.textClass}`}>Article Metadata (LLM-Structured)</h3>
                {metadataExpanded ? <ChevronUp className={`w-5 h-5 ${theme.textSecondaryClass}`} /> : <ChevronDown className={`w-5 h-5 ${theme.textSecondaryClass}`} />}
              </button>
              
              {metadataExpanded && (
                <div className={`${theme.accentBgClass} rounded-lg p-4 font-mono text-sm mt-4 border ${theme.cardBorderClass}`}>
                  <pre className={`whitespace-pre-wrap ${theme.textClass}`}>
{JSON.stringify({
  id: selectedArticle.id,
  title: selectedArticle.title,
  category: selectedArticle.category,
  targetAudience: selectedArticle.targetAudience,
  complexity: selectedArticle.complexity,
  jurisdiction: selectedArticle.jurisdiction,
  keyTopics: selectedArticle.keyTopics,
  tags: selectedArticle.tags,
  publishDate: selectedArticle.publishDate,
  author: selectedArticle.author,
  estimatedReadTime: selectedArticle.estimatedReadTime,
  engagementMetrics: {
    views: viewCounts[selectedArticle.id],
    engagementScore: selectedArticle.engagementScore,
    currentReadTime: readTime[selectedArticle.id] || 0
  }
}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      {/* Navigation */}
      <nav className={`border-b ${theme.borderClass} ${theme.cardBgClass} shadow-md`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <ZoroLogo className="h-8" isDark={darkMode} />
            </Link>
            <div className="flex items-center gap-6">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Header with View Toggle */}
      <header className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className={`text-3xl font-bold ${theme.textClass}`}>Wealth Management Insights</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode(viewMode === 'user' ? 'planner' : 'user')}
                className={`hidden md:flex px-4 py-2 rounded-lg font-medium transition-all items-center ${
                  viewMode === 'planner'
                    ? darkMode ? 'bg-white text-slate-900 shadow-lg' : 'bg-slate-800 text-white shadow-lg'
                    : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Settings className="w-5 h-5 mr-2" />
                {viewMode === 'planner' ? 'Planner View' : 'Switch to Planner'}
              </button>

              {viewMode === 'user' && (
                <>
                  <button
                    onClick={() => setShowSavedPanel(true)}
                    className={`relative px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    <Bookmark className="w-5 h-5" />
                    {savedArticles.size > 0 && (
                      <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${darkMode ? 'bg-blue-500' : 'bg-slate-800'}`}>
                        {savedArticles.size}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowZoroPanel(true)}
                    className={`relative px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    <ZoroZIcon postId="header" isSelected={zoroArticles.size > 0} className="w-5 h-5" />
                    {zoroArticles.size > 0 && (
                      <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${darkMode ? 'bg-blue-500' : 'bg-slate-800'}`}>
                        {zoroArticles.size}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className={theme.textSecondaryClass}>
            {viewMode === 'user' 
              ? 'Expert guidance for Indians and NRIs on financial planning, investments, and wealth building'
              : 'Admin dashboard for content management and analytics'}
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Analytics Dashboard - Only for Planners */}
        {viewMode === 'planner' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className={`${theme.cardBgClass} rounded-xl shadow-lg p-6 border ${theme.cardBorderClass}`}>
              <div className="flex items-center justify-between mb-2">
                <Users className={`w-8 h-8 ${theme.textSecondaryClass}`} />
                <span className={`text-2xl font-bold ${theme.textClass}`}>{totalViews.toLocaleString()}</span>
              </div>
              <div className={`text-sm ${theme.textSecondaryClass}`}>Total Views</div>
            </div>
            
            <div className={`${theme.cardBgClass} rounded-xl shadow-lg p-6 border ${theme.cardBorderClass}`}>
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className={`w-8 h-8 ${theme.textSecondaryClass}`} />
                <span className={`text-2xl font-bold ${theme.textClass}`}>{avgEngagement.toFixed(0)}%</span>
              </div>
              <div className={`text-sm ${theme.textSecondaryClass}`}>Avg Engagement</div>
            </div>
            
            <div className={`${theme.cardBgClass} rounded-xl shadow-lg p-6 border ${theme.cardBorderClass}`}>
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className={`w-8 h-8 ${theme.textSecondaryClass}`} />
                <span className={`text-2xl font-bold ${theme.textClass}`}>{blogPosts.length}</span>
              </div>
              <div className={`text-sm ${theme.textSecondaryClass}`}>Published Articles</div>
            </div>
            
            <div className={`${theme.cardBgClass} rounded-xl shadow-lg p-6 border ${theme.cardBorderClass}`}>
              <div className="flex items-center justify-between mb-2">
                <Clock className={`w-8 h-8 ${theme.textSecondaryClass}`} />
                <span className={`text-2xl font-bold ${theme.textClass}`}>
                  {Math.round(blogPosts.reduce((a, b) => a + b.estimatedReadTime, 0) / blogPosts.length)}m
                </span>
              </div>
              <div className={`text-sm ${theme.textSecondaryClass}`}>Avg Read Time</div>
            </div>
          </div>
        )}

        {/* Add New Post Button - Only for Planners */}
        {viewMode === 'planner' && (
          <div className="mb-6">
            <button
              onClick={() => setShowNewPostModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Article
            </button>
          </div>
        )}

        {/* Search and Filter */}
        <div className={`${theme.cardBgClass} rounded-xl shadow-sm mb-8 p-6 border ${theme.cardBorderClass}`}>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-5 h-5`} />
              <input
                type="text"
                placeholder="Search articles, tags, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 ${darkMode ? 'focus:ring-blue-500' : 'focus:ring-blue-500'}`}
              />
            </div>
            
            <button
              onClick={() => setSearchExpanded(searchExpanded === 'tags' ? '' : 'tags')}
              className={`p-3 rounded-lg transition-all ${
                searchExpanded === 'tags'
                  ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                  : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Filter by tags"
            >
              <Tag className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setSearchExpanded(searchExpanded === 'author' ? '' : 'author')}
              className={`p-3 rounded-lg transition-all ${
                searchExpanded === 'author'
                  ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                  : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Filter by author"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tag Filter */}
          {searchExpanded === 'tags' && (
            <div className={`mt-4 pt-4 border-t ${theme.borderClass}`}>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTag === tag
                        ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                        : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Author Filter */}
          {searchExpanded === 'author' && (
            <div className={`mt-4 pt-4 border-t ${theme.borderClass}`}>
              <div className="flex flex-wrap gap-2">
                {allAuthors.map(author => (
                  <button
                    key={author}
                    onClick={() => setAuthorFilter(author)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      authorFilter === author
                        ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                        : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {author}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <div
              key={post.id}
              className={`${theme.cardBgClass} rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group relative border ${theme.cardBorderClass} ${theme.cardHoverClass}`}
            >
              {/* Quick Actions for Users */}
              {viewMode === 'user' && (
                <div className="absolute top-3 right-3 flex gap-2 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveArticle(post.id);
                    }}
                    className={`p-2 rounded-lg transition-all shadow-md ${
                      savedArticles.has(post.id)
                        ? 'bg-blue-600 text-white'
                        : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Save for later"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleZoroArticle(post.id);
                    }}
                    className={`p-2 rounded-lg transition-all shadow-md ${
                      zoroArticles.has(post.id)
                        ? 'bg-blue-600 text-white'
                        : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Add to Zoro"
                  >
                    <ZoroZIcon postId={post.id} isSelected={zoroArticles.has(post.id)} className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div
                onClick={() => {
                  setSelectedArticle(post);
                  setViewCounts(prev => ({
                    ...prev,
                    [post.id]: prev[post.id] + 1
                  }));
                }}
                className="p-6 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-3 py-1 ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'} rounded-lg text-xs font-medium`}>
                    {post.category}
                  </span>
                </div>

                <h3 className={`text-xl font-bold ${theme.textClass} mb-3 ${darkMode ? 'group-hover:text-slate-300' : 'group-hover:text-slate-600'} transition-colors`}>
                  {post.title}
                </h3>

                <p className={`${theme.textSecondaryClass} text-sm mb-4 line-clamp-3`}>{post.excerpt}</p>

                {viewMode === 'planner' && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-xs text-slate-500">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className={`flex items-center justify-between text-sm ${theme.textSecondaryClass} pt-4 border-t ${theme.borderClass}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {post.estimatedReadTime}m
                    </span>
                    <span className="text-slate-400">·</span>
                    <span>{post.author}</span>
                  </div>
                  {viewMode === 'planner' && (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {viewCounts[post.id]?.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        {post.engagementScore}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <p className={`${theme.textSecondaryClass} text-lg`}>No articles found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* New Post Modal */}
      {showNewPostModal && <NewPostModal />}
      
      {/* Saved Articles Panel */}
      {showSavedPanel && <SavedArticlesPanel />}
      
      {/* Zoro Context Panel */}
      {showZoroPanel && <ZoroContextPanel />}
    </div>
  );
};

export default WealthBlog;