'use client';

import React from 'react';
import { Users, BarChart3, TrendingUp, Clock } from 'lucide-react';
import { BlogPost } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Card } from '@/components/ui/Card';

interface BlogAnalyticsProps {
  blogPosts: BlogPost[];
  totalViews: number;
  avgEngagement: number;
  darkMode: boolean;
}

export const BlogAnalytics: React.FC<BlogAnalyticsProps> = ({
  blogPosts,
  totalViews,
  avgEngagement,
  darkMode
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card darkMode={darkMode} className="rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <Users className={`w-8 h-8 ${theme.textSecondaryClass}`} />
          <span className={`text-2xl font-bold ${theme.textClass}`}>{totalViews.toLocaleString()}</span>
        </div>
        <div className={`text-sm ${theme.textSecondaryClass}`}>Total Views</div>
      </Card>
      
      <Card darkMode={darkMode} className="rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <BarChart3 className={`w-8 h-8 ${theme.textSecondaryClass}`} />
          <span className={`text-2xl font-bold ${theme.textClass}`}>{avgEngagement.toFixed(0)}%</span>
        </div>
        <div className={`text-sm ${theme.textSecondaryClass}`}>Avg Engagement</div>
      </Card>
      
      <Card darkMode={darkMode} className="rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <TrendingUp className={`w-8 h-8 ${theme.textSecondaryClass}`} />
          <span className={`text-2xl font-bold ${theme.textClass}`}>{blogPosts.length}</span>
        </div>
        <div className={`text-sm ${theme.textSecondaryClass}`}>Published Articles</div>
      </Card>
      
      <Card darkMode={darkMode} className="rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <Clock className={`w-8 h-8 ${theme.textSecondaryClass}`} />
          <span className={`text-2xl font-bold ${theme.textClass}`}>
            {Math.round(blogPosts.reduce((a, b) => a + b.estimatedReadTime, 0) / blogPosts.length)}m
          </span>
        </div>
        <div className={`text-sm ${theme.textSecondaryClass}`}>Avg Read Time</div>
      </Card>
    </div>
  );
};

