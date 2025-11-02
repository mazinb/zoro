'use client';

import React from 'react';
import { Bookmark, Clock, X } from 'lucide-react';
import { BlogPost } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface SavedArticlesPanelProps {
  blogPosts: BlogPost[];
  savedArticles: Set<string>;
  darkMode: boolean;
  onClose: () => void;
  onRemove: (postId: string) => void;
  onSelectArticle: (post: BlogPost) => void;
}

export const SavedArticlesPanel: React.FC<SavedArticlesPanelProps> = ({
  blogPosts,
  savedArticles,
  darkMode,
  onClose,
  onRemove,
  onSelectArticle
}) => {
  const theme = useThemeClasses(darkMode);
  const savedPosts = blogPosts.filter(post => savedArticles.has(post.id));
  
  return (
    <>
      {/* Mobile overlay - only on mobile */}
      <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      
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
            <button onClick={onClose} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
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
                        onClick={() => onRemove(post.id)}
                        className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        aria-label="Remove from saved"
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
                          onSelectArticle(post);
                          onClose();
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
            <button onClick={onClose} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
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
                        onClick={() => onRemove(post.id)}
                        className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        aria-label="Remove from saved"
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
                          onSelectArticle(post);
                          onClose();
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

