'use client';

import React from 'react';
import { Search, Tag, User } from 'lucide-react';
import { SearchExpanded } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Card } from '@/components/ui/Card';

interface BlogSearchFilterProps {
  searchQuery: string;
  searchExpanded: SearchExpanded;
  selectedTag: string;
  authorFilter: string;
  allTags: string[];
  allAuthors: string[];
  darkMode: boolean;
  onSearchChange: (query: string) => void;
  onSearchExpandedChange: (expanded: SearchExpanded) => void;
  onTagSelect: (tag: string) => void;
  onAuthorSelect: (author: string) => void;
}

export const BlogSearchFilter: React.FC<BlogSearchFilterProps> = ({
  searchQuery,
  searchExpanded,
  selectedTag,
  authorFilter,
  allTags,
  allAuthors,
  darkMode,
  onSearchChange,
  onSearchExpandedChange,
  onTagSelect,
  onAuthorSelect
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <Card darkMode={darkMode} className="rounded-xl shadow-sm mb-8 p-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-5 h-5`} />
          <input
            type="text"
            placeholder="Search articles, tags, topics..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label="Search articles"
          />
        </div>
        
        <button
          onClick={() => onSearchExpandedChange(searchExpanded === 'tags' ? '' : 'tags')}
          className={`p-3 rounded-lg transition-all ${
            searchExpanded === 'tags'
              ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
              : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title="Filter by tags"
          aria-label="Filter by tags"
        >
          <Tag className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => onSearchExpandedChange(searchExpanded === 'author' ? '' : 'author')}
          className={`p-3 rounded-lg transition-all ${
            searchExpanded === 'author'
              ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
              : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title="Filter by author"
          aria-label="Filter by author"
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
                onClick={() => onTagSelect(tag)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTag === tag
                    ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                    : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                aria-label={selectedTag === tag ? `Remove ${tag} filter` : `Filter by ${tag}`}
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
                onClick={() => onAuthorSelect(author)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  authorFilter === author
                    ? darkMode ? 'bg-white text-slate-900' : 'bg-slate-800 text-white'
                    : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                aria-label={authorFilter === author ? `Remove ${author} filter` : `Filter by ${author}`}
              >
                {author}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

