'use client';

import React from 'react';
import { Clock, Eye, TrendingUp, Tag, Bookmark } from 'lucide-react';
import { BlogPost, ViewMode } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Card } from '@/components/ui/Card';
import { ZoroZIcon } from './ZoroZIcon';

interface BlogPostCardProps {
  post: BlogPost;
  viewMode: ViewMode;
  darkMode: boolean;
  isSaved: boolean;
  isInZoroContext: boolean;
  viewCount: number;
  onSelect: () => void;
  onToggleSave: (e: React.MouseEvent) => void;
  onToggleZoro: (e: React.MouseEvent) => void;
}

export const BlogPostCard: React.FC<BlogPostCardProps> = ({
  post,
  viewMode,
  darkMode,
  isSaved,
  isInZoroContext,
  viewCount,
  onSelect,
  onToggleSave,
  onToggleZoro
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <Card 
      darkMode={darkMode} 
      hover 
      onClick={onSelect}
      className="rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group relative cursor-pointer"
    >
      {/* Quick Actions for Users */}
      {viewMode === 'user' && (
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={onToggleSave}
            className={`p-2 rounded-lg transition-all shadow-md ${
              isSaved
                ? 'bg-blue-600 text-white'
                : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
            title="Save for later"
            aria-label={isSaved ? "Remove from saved" : "Save for later"}
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleZoro}
            className={`p-2 rounded-lg transition-all shadow-md ${
              isInZoroContext
                ? 'bg-blue-600 text-white'
                : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
            title="Add to Zoro"
            aria-label={isInZoroContext ? "Remove from Zoro context" : "Add to Zoro context"}
          >
            <ZoroZIcon postId={post.id} isSelected={isInZoroContext} className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-6">
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
                {viewCount?.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {post.engagementScore}%
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

