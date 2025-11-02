'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/hooks/useAuth';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { BlogPost, ViewMode, SearchExpanded } from '@/types';
import { BlogNavigation } from './BlogNavigation';
import { BlogAnalytics } from './BlogAnalytics';
import { BlogSearchFilter } from './BlogSearchFilter';
import { BlogPostCard } from './BlogPostCard';
import { BlogPostDetail } from './BlogPostDetail';
import { NewPostModal } from './NewPostModal';
import { SavedArticlesPanel } from './SavedArticlesPanel';
import { ZoroContextPanel } from './ZoroContextPanel';
import { Button } from '@/components/ui/Button';

// Sample blog posts data - will be moved to constants or database later
const BLOG_POSTS: BlogPost[] = [
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

export const BlogPage: React.FC = () => {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { user, signOut } = useAuth();
  const theme = useThemeClasses(darkMode);
  const [viewMode, setViewMode] = useState<ViewMode>('user');
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState<SearchExpanded>('');
  const [readTime, setReadTime] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());
  const [zoroArticles, setZoroArticles] = useState<Set<string>>(new Set());
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [authorFilter, setAuthorFilter] = useState('all');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [showZoroPanel, setShowZoroPanel] = useState(false);

  // Initialize mock engagement data
  useEffect(() => {
    const initialViews: Record<string, number> = {};
    const initialReadTime: Record<string, number> = {};
    BLOG_POSTS.forEach(post => {
      initialViews[post.id] = Math.floor(Math.random() * 5000) + 500;
      initialReadTime[post.id] = 0;
    });
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(() => {
      setViewCounts(initialViews);
      setReadTime(initialReadTime);
    });
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
  const { allTags, allAuthors } = useMemo(() => {
    const tags = ['all', ...new Set(BLOG_POSTS.flatMap(post => post.tags))];
    const authors = ['all', ...new Set(BLOG_POSTS.map(post => post.author))];
    return { allTags: tags, allAuthors: authors };
  }, []);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter(post => {
      const matchesTag = selectedTag === 'all' || post.tags.includes(selectedTag);
      const matchesAuthor = authorFilter === 'all' || post.author === authorFilter;
      const matchesSearch = searchQuery === '' || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTag && matchesSearch && matchesAuthor;
    });
  }, [selectedTag, authorFilter, searchQuery]);

  // Calculate engagement metrics
  const totalViews = useMemo(() => {
    return Object.values(viewCounts).reduce((a, b) => a + b, 0);
  }, [viewCounts]);

  const avgEngagement = useMemo(() => {
    return BLOG_POSTS.reduce((a, b) => a + b.engagementScore, 0) / BLOG_POSTS.length;
  }, []);

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

  // Handle view mode toggle with auth check for planner
  const handleToggleViewMode = () => {
    const newMode = viewMode === 'user' ? 'planner' : 'user';
    
    if (newMode === 'planner') {
      // Require authentication for planner view
      if (!user) {
        router.push('/login?redirect=/blog&mode=planner');
        return;
      }
      
      // Check if user has planner role
      const userRole = user.role || 'user';
      if (userRole !== 'planner' && userRole !== 'admin') {
        alert('Planner view is only available to authorized planners and administrators.');
        return;
      }
    }
    
    setViewMode(newMode);
  };

  // Show article detail view
  if (selectedArticle) {
    return (
      <BlogPostDetail
        post={selectedArticle}
        viewMode={viewMode}
        darkMode={darkMode}
        isSaved={savedArticles.has(selectedArticle.id)}
        isInZoroContext={zoroArticles.has(selectedArticle.id)}
        viewCount={viewCounts[selectedArticle.id] || 0}
        readTime={readTime[selectedArticle.id] || 0}
        metadataExpanded={metadataExpanded}
        onBack={() => setSelectedArticle(null)}
        onToggleSave={() => toggleSaveArticle(selectedArticle.id)}
        onToggleZoro={() => toggleZoroArticle(selectedArticle.id)}
        onToggleMetadata={() => setMetadataExpanded(!metadataExpanded)}
      />
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      <BlogNavigation
        darkMode={darkMode}
        viewMode={viewMode}
        user={user}
        savedArticlesCount={savedArticles.size}
        zoroArticlesCount={zoroArticles.size}
        onToggleDarkMode={toggleDarkMode}
        onToggleViewMode={handleToggleViewMode}
        onShowSavedPanel={() => setShowSavedPanel(true)}
        onShowZoroPanel={() => setShowZoroPanel(true)}
        onSignOut={async () => {
          await signOut();
          router.push('/');
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Analytics Dashboard - Only for Planners */}
        {viewMode === 'planner' && (
          <BlogAnalytics
            blogPosts={BLOG_POSTS}
            totalViews={totalViews}
            avgEngagement={avgEngagement}
            darkMode={darkMode}
          />
        )}

        {/* Add New Post Button - Only for Planners */}
        {viewMode === 'planner' && (
          <div className="mb-6">
            <Button
              variant="primary"
              darkMode={darkMode}
              onClick={() => setShowNewPostModal(true)}
              className="px-6 py-3 shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Article
            </Button>
          </div>
        )}

        {/* Search and Filter */}
        <BlogSearchFilter
          searchQuery={searchQuery}
          searchExpanded={searchExpanded}
          selectedTag={selectedTag}
          authorFilter={authorFilter}
          allTags={allTags}
          allAuthors={allAuthors}
          darkMode={darkMode}
          onSearchChange={setSearchQuery}
          onSearchExpandedChange={setSearchExpanded}
          onTagSelect={setSelectedTag}
          onAuthorSelect={setAuthorFilter}
        />

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <BlogPostCard
              key={post.id}
              post={post}
              viewMode={viewMode}
              darkMode={darkMode}
              isSaved={savedArticles.has(post.id)}
              isInZoroContext={zoroArticles.has(post.id)}
              viewCount={viewCounts[post.id] || 0}
              onSelect={() => {
                setSelectedArticle(post);
                setViewCounts(prev => ({
                  ...prev,
                  [post.id]: (prev[post.id] || 0) + 1
                }));
              }}
              onToggleSave={(e) => {
                e.stopPropagation();
                toggleSaveArticle(post.id);
              }}
              onToggleZoro={(e) => {
                e.stopPropagation();
                toggleZoroArticle(post.id);
              }}
            />
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <p className={`${theme.textSecondaryClass} text-lg`}>No articles found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Modals and Panels */}
      {showNewPostModal && (
        <NewPostModal
          darkMode={darkMode}
          onClose={() => setShowNewPostModal(false)}
        />
      )}
      
      {showSavedPanel && (
        <SavedArticlesPanel
          blogPosts={BLOG_POSTS}
          savedArticles={savedArticles}
          darkMode={darkMode}
          onClose={() => setShowSavedPanel(false)}
          onRemove={toggleSaveArticle}
          onSelectArticle={(post) => {
            setSelectedArticle(post);
            setShowSavedPanel(false);
          }}
        />
      )}
      
      {showZoroPanel && (
        <ZoroContextPanel
          blogPosts={BLOG_POSTS}
          zoroArticles={zoroArticles}
          darkMode={darkMode}
          onClose={() => setShowZoroPanel(false)}
          onRemove={toggleZoroArticle}
          onSelectArticle={(post) => {
            setSelectedArticle(post);
            setShowZoroPanel(false);
          }}
        />
      )}
    </div>
  );
};

export default BlogPage;

