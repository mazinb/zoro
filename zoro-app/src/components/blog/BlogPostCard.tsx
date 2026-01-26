'use client';

import React from 'react';
import { Clock, Tag } from 'lucide-react';
import { BlogPost } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Card } from '@/components/ui/Card';

interface BlogPostCardProps {
  post: BlogPost;
  darkMode: boolean;
  onSelect: () => void;
}

export const BlogPostCard: React.FC<BlogPostCardProps> = ({
  post,
  darkMode,
  onSelect
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <Card 
      darkMode={darkMode} 
      hover 
      onClick={onSelect}
      className="rounded-xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group relative cursor-pointer"
    >
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

        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.slice(0, 3).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs text-slate-500">
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>

        <div className={`flex items-center justify-between text-sm ${theme.textSecondaryClass} pt-4 border-t ${theme.borderClass}`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.estimatedReadTime}m
            </span>
            <span className="text-slate-400">·</span>
            <span>{post.author}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

