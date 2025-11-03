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
import { apiCall, getAuthHeaders } from '@/lib/api-client';

// Helper to convert DB post (snake_case) to BlogPost type (camelCase)
function convertDbPostToBlogPost(dbPost: {
  id: string;
  title: string;
  excerpt: string;
  tags?: string[];
  author: string;
  publish_date: string;
  estimated_read_time: number;
  category: string;
  target_audience?: string[];
  complexity: string;
  jurisdiction?: string[];
  key_topics?: string[];
  engagement_score?: number;
}): BlogPost {
  return {
    id: dbPost.id,
    title: dbPost.title,
    excerpt: dbPost.excerpt,
    tags: dbPost.tags || [],
    author: dbPost.author,
    publishDate: dbPost.publish_date,
    estimatedReadTime: dbPost.estimated_read_time,
    category: dbPost.category,
    targetAudience: dbPost.target_audience || [],
    complexity: dbPost.complexity,
    jurisdiction: dbPost.jurisdiction || [],
    keyTopics: dbPost.key_topics || [],
    engagementScore: dbPost.engagement_score || 0
  };
}

// Legacy sample data - fallback if no posts in DB
const BLOG_POSTS_LEGACY: BlogPost[] = [
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
  const { user, signOut, session } = useAuth();
  const theme = useThemeClasses(darkMode);
  const [viewMode, setViewMode] = useState<ViewMode>('user');
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState<SearchExpanded>('');
  const [readTime, setReadTime] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [savedArticles, setSavedArticles] = useState<Set<string>>(new Set());
  const [zoroArticles, setZoroArticles] = useState<Set<string>>(new Set());
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [authorFilter, setAuthorFilter] = useState('all');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [showZoroPanel, setShowZoroPanel] = useState(false);

  // Fetch blog posts from API
  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        const response = await fetch('/api/blog/posts', {
          headers
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        
        const data = await response.json();
        const posts: BlogPost[] = (data.posts || []).map(convertDbPostToBlogPost);
        setBlogPosts(posts);
        
        // Initialize view counts and read time from DB or defaults
        const initialViews: Record<string, number> = {};
        const initialReadTime: Record<string, number> = {};
        posts.forEach(post => {
          initialViews[post.id] = 0;
          initialReadTime[post.id] = 0;
        });
        setViewCounts(initialViews);
        setReadTime(initialReadTime);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
        // Fallback to legacy data if API fails
        setBlogPosts(BLOG_POSTS_LEGACY);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPosts();
  }, []);

  // Fetch saved articles and zoro context when posts are loaded (optimized - single API call)
  useEffect(() => {
    if (!user || blogPosts.length === 0) {
      if (!user) {
        setSavedArticles(new Set());
        setZoroArticles(new Set());
      }
      return;
    }
    
    async function fetchSavedArticles() {
      try {
        const headers = await getAuthHeaders();
        // Fetch posts with saves data in one call
        const response = await fetch('/api/blog/posts', {
          headers
        });
        
        if (response.ok) {
          const { saves }: { saves?: Record<string, { saved: boolean; zoroContext: boolean }> } = await response.json();
          
          if (saves) {
            const savedSet = new Set<string>();
            const zoroSet = new Set<string>();
            
            // Process saves data efficiently
            Object.entries(saves).forEach(([postId, saveData]) => {
              if (saveData.saved) {
                savedSet.add(postId);
              }
              if (saveData.zoroContext) {
                zoroSet.add(postId);
              }
            });
            
            setSavedArticles(savedSet);
            setZoroArticles(zoroSet);
          }
        }
      } catch (error) {
        console.error('Error fetching saved articles:', error);
      }
    }
    
    fetchSavedArticles();
  }, [user, blogPosts.length]);

  // Track read time when article is opened
  useEffect(() => {
    if (selectedArticle) {
      // Track view on open
      trackView(selectedArticle.id);
      
      const interval = setInterval(() => {
        const currentReadTime = (readTime[selectedArticle.id] || 0) + 1;
        setReadTime(prev => ({
          ...prev,
          [selectedArticle.id]: currentReadTime
        }));
        
        // Update read time in DB every 10 seconds
        if (currentReadTime % 10 === 0) {
          updateReadTime(selectedArticle.id, currentReadTime);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedArticle]);
  
  // Track view in database
  async function trackView(postId: string) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/blog/posts/${postId}/view`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ readTimeSeconds: readTime[postId] || 0 })
      });
      
      // Update local view count
      setViewCounts(prev => ({
        ...prev,
        [postId]: (prev[postId] || 0) + 1
      }));
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }
  
  // Update read time in database
  async function updateReadTime(postId: string, readTimeSeconds: number) {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/blog/posts/${postId}/view`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ readTimeSeconds })
      });
    } catch (error) {
      console.error('Error updating read time:', error);
    }
  }

  // Get all unique tags and authors
  const { allTags, allAuthors } = useMemo(() => {
    const tags = ['all', ...new Set(blogPosts.flatMap(post => post.tags))];
    const authors = ['all', ...new Set(blogPosts.map(post => post.author))];
    return { allTags: tags, allAuthors: authors };
  }, [blogPosts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return blogPosts.filter(post => {
      const matchesTag = selectedTag === 'all' || post.tags.includes(selectedTag);
      const matchesAuthor = authorFilter === 'all' || post.author === authorFilter;
      const matchesSearch = searchQuery === '' || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTag && matchesSearch && matchesAuthor;
    });
  }, [blogPosts, selectedTag, authorFilter, searchQuery]);

  // Calculate engagement metrics
  const totalViews = useMemo(() => {
    return Object.values(viewCounts).reduce((a, b) => a + b, 0);
  }, [viewCounts]);

  const avgEngagement = useMemo(() => {
    if (blogPosts.length === 0) return 0;
    return blogPosts.reduce((a, b) => a + b.engagementScore, 0) / blogPosts.length;
  }, [blogPosts]);

  const toggleSaveArticle = async (postId: string) => {
    if (!user) {
      router.push('/login?redirect=/blog');
      return;
    }
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/blog/posts/${postId}/save?type=save`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle save');
      }
      
      const { saved } = await response.json();
      setSavedArticles(prev => {
        const newSet = new Set(prev);
        if (saved) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error toggling save:', error);
      // Still update UI optimistically
      setSavedArticles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
    }
  };

  const toggleZoroArticle = async (postId: string) => {
    if (!user) {
      router.push('/login?redirect=/blog');
      return;
    }
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/blog/posts/${postId}/save?type=zoro_context`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle zoro context');
      }
      
      const { saved } = await response.json();
      setZoroArticles(prev => {
        const newSet = new Set(prev);
        if (saved) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error toggling zoro context:', error);
      // Still update UI optimistically
      setZoroArticles(prev => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
        } else {
          newSet.add(postId);
        }
        return newSet;
      });
    }
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
            blogPosts={blogPosts}
            totalViews={totalViews}
            avgEngagement={avgEngagement}
            darkMode={darkMode}
          />
        )}
        
        {loading && (
          <div className="text-center py-12">
            <p className={theme.textSecondaryClass}>Loading posts...</p>
          </div>
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
                trackView(post.id);
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
          blogPosts={blogPosts.filter(post => savedArticles.has(post.id))}
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
          blogPosts={blogPosts.filter(post => zoroArticles.has(post.id))}
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

