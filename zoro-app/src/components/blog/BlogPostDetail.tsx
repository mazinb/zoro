'use client';

import React from 'react';
import { Clock, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import { BlogPost } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface BlogPostDetailProps {
  post: BlogPost;
  darkMode: boolean;
  metadataExpanded: boolean;
  onBack: () => void;
  onToggleMetadata: () => void;
}

export const BlogPostDetail: React.FC<BlogPostDetailProps> = ({
  post,
  darkMode,
  metadataExpanded,
  onBack,
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
            </div>
          </div>

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
                      engagementScore: post.engagementScore
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

