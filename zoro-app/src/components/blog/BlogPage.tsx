'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { BlogPost, SearchExpanded } from '@/types';
import { BlogNavigation } from './BlogNavigation';
import { BlogSearchFilter } from './BlogSearchFilter';
import { BlogPostCard } from './BlogPostCard';
import { BlogPostDetail } from './BlogPostDetail';

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
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState<SearchExpanded>('');
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [authorFilter, setAuthorFilter] = useState('all');

  // Fetch blog posts from API
  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        const response = await fetch('/api/blog/posts');
        
        if (!response.ok) {
          throw new Error('Failed to fetch posts');
        }
        
        const data = await response.json();
        const posts: BlogPost[] = (data.posts || []).map(convertDbPostToBlogPost);
        setBlogPosts(posts);
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

  // Show article detail view
  if (selectedArticle) {
    return (
      <BlogPostDetail
        post={selectedArticle}
        darkMode={darkMode}
        metadataExpanded={metadataExpanded}
        onBack={() => setSelectedArticle(null)}
        onToggleMetadata={() => setMetadataExpanded(!metadataExpanded)}
      />
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      <BlogNavigation
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading && (
          <div className="text-center py-12">
            <p className={theme.textSecondaryClass}>Loading posts...</p>
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
              darkMode={darkMode}
              onSelect={() => {
                setSelectedArticle(post);
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

    </div>
  );
};

export default BlogPage;

