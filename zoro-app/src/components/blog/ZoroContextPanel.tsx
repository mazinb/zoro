'use client';

import React from 'react';
import { Zap, X } from 'lucide-react';
import { BlogPost } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ZoroZIcon } from './ZoroZIcon';

interface ZoroContextPanelProps {
  blogPosts: BlogPost[];
  zoroArticles: Set<string>;
  darkMode: boolean;
  onClose: () => void;
  onRemove: (postId: string) => void;
  onSelectArticle: (post: BlogPost) => void;
}

export const ZoroContextPanel: React.FC<ZoroContextPanelProps> = ({
  blogPosts,
  zoroArticles,
  darkMode,
  onClose,
  onRemove,
  onSelectArticle
}) => {
  const theme = useThemeClasses(darkMode);
  const zoroPosts = blogPosts.filter(post => zoroArticles.has(post.id));
  
  return (
    <>
      {/* Mobile overlay - only on mobile */}
      <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      
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
            <button onClick={onClose} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
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
                        onClick={() => onRemove(post.id)}
                        className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        aria-label="Remove from Zoro context"
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
                          onSelectArticle(post);
                          onClose();
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
            <button onClick={onClose} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
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
                        onClick={() => onRemove(post.id)}
                        className={`ml-2 p-1 ${theme.textSecondaryClass} hover:text-red-500 transition-colors`}
                        aria-label="Remove from Zoro context"
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
                          onSelectArticle(post);
                          onClose();
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

