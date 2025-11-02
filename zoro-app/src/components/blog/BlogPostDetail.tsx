'use client';

import React from 'react';
import { Clock, Eye, Calendar, User, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import { BlogPost, ViewMode } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ZoroZIcon } from './ZoroZIcon';

interface BlogPostDetailProps {
  post: BlogPost;
  viewMode: ViewMode;
  darkMode: boolean;
  isSaved: boolean;
  isInZoroContext: boolean;
  viewCount: number;
  readTime: number;
  metadataExpanded: boolean;
  onBack: () => void;
  onToggleSave: () => void;
  onToggleZoro: () => void;
  onToggleMetadata: () => void;
}

export const BlogPostDetail: React.FC<BlogPostDetailProps> = ({
  post,
  viewMode,
  darkMode,
  isSaved,
  isInZoroContext,
  viewCount,
  readTime,
  metadataExpanded,
  onBack,
  onToggleSave,
  onToggleZoro,
  onToggleMetadata
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="secondary"
            darkMode={darkMode}
            onClick={onBack}
          >
            ← Back to Articles
          </Button>
          
          {viewMode === 'user' && (
            <div className="flex gap-2">
              <button
                onClick={onToggleSave}
                className={`p-2 rounded-lg transition-all ${
                  isSaved
                    ? 'bg-blue-600 text-white shadow-lg'
                    : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
                title={isSaved ? "Remove from saved" : "Save for later"}
                aria-label={isSaved ? "Remove from saved" : "Save for later"}
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button
                onClick={onToggleZoro}
                className={`p-2 rounded-lg transition-all ${
                  isInZoroContext
                    ? 'bg-blue-600 text-white shadow-lg'
                    : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
                title={isInZoroContext ? "Remove from Zoro context" : "Add to Zoro context"}
                aria-label={isInZoroContext ? "Remove from Zoro context" : "Add to Zoro context"}
              >
                <ZoroZIcon postId={post.id} isSelected={isInZoroContext} className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        
        <Card darkMode={darkMode} className="rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag: string) => (
                <span key={tag} className={`px-3 py-1 ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'} rounded-full text-sm font-medium`}>
                  {tag}
                </span>
              ))}
            </div>
            <h1 className={`text-4xl font-bold ${theme.textClass} mb-4`}>{post.title}</h1>
            <div className={`flex items-center gap-6 text-sm ${theme.textSecondaryClass} mb-4 flex-wrap`}>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {post.author}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.estimatedReadTime} min read
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {viewCount?.toLocaleString()} views
              </span>
            </div>
          </div>

          {/* Engagement Stats */}
          {viewMode === 'planner' && (
            <div className={`grid grid-cols-3 gap-4 mb-8 p-4 ${darkMode ? 'bg-gradient-to-r from-blue-900 to-indigo-900' : 'bg-gradient-to-r from-blue-50 to-indigo-50'} rounded-xl`}>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{readTime || 0}s</div>
                <div className={`text-sm ${theme.textSecondaryClass}`}>Avg Time Reading</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{post.engagementScore}%</div>
                <div className={`text-sm ${theme.textSecondaryClass}`}>Engagement Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{viewCount?.toLocaleString()}</div>
                <div className={`text-sm ${theme.textSecondaryClass}`}>Total Views</div>
              </div>
            </div>
          )}

          <div className="prose max-w-none mb-8">
            <p className={`text-lg ${theme.textClass} leading-relaxed`}>{post.excerpt}</p>
            <p className={`${theme.textClass} leading-relaxed mt-4`}>
              [Article content would be loaded from Google Drive here. This is a placeholder for the full article content that will be dynamically loaded based on the post ID.]
            </p>
          </div>

          {/* Collapsible LLM-Friendly Structured Metadata */}
          <div className={`border-t ${theme.borderClass} pt-6 mt-8`}>
            <button
              onClick={onToggleMetadata}
              className="flex items-center justify-between w-full text-left"
              aria-expanded={metadataExpanded}
            >
              <h3 className={`text-lg font-bold ${theme.textClass}`}>Article Metadata (LLM-Structured)</h3>
              {metadataExpanded ? <ChevronUp className={`w-5 h-5 ${theme.textSecondaryClass}`} /> : <ChevronDown className={`w-5 h-5 ${theme.textSecondaryClass}`} />}
            </button>
            
            {metadataExpanded && (
              <div className={`${theme.accentBgClass} rounded-lg p-4 font-mono text-sm mt-4 border ${theme.cardBorderClass}`}>
                <pre className={`whitespace-pre-wrap ${theme.textClass}`}>
                  {JSON.stringify({
                    id: post.id,
                    title: post.title,
                    category: post.category,
                    targetAudience: post.targetAudience,
                    complexity: post.complexity,
                    jurisdiction: post.jurisdiction,
                    keyTopics: post.keyTopics,
                    tags: post.tags,
                    publishDate: post.publishDate,
                    author: post.author,
                    estimatedReadTime: post.estimatedReadTime,
                    engagementMetrics: {
                      views: viewCount,
                      engagementScore: post.engagementScore,
                      currentReadTime: readTime || 0
                    }
                  }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

