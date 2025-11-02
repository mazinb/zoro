'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface NewPostModalProps {
  darkMode: boolean;
  onClose: () => void;
}

export const NewPostModal: React.FC<NewPostModalProps> = ({
  darkMode,
  onClose
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`${theme.cardBgClass} rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${theme.cardBorderClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${theme.borderClass} flex items-center justify-between sticky top-0 ${theme.cardBgClass}`}>
          <h2 className={`text-2xl font-bold ${theme.textClass}`}>Add New Article</h2>
          <button onClick={onClose} className={`${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Title</label>
            <input 
              type="text" 
              className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} 
              placeholder="Article title" 
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Excerpt</label>
            <textarea 
              className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} 
              rows={3} 
              placeholder="Brief description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Category</label>
              <select className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                <option>Tax Planning</option>
                <option>Investment Strategy</option>
                <option>Retirement Planning</option>
                <option>Insurance</option>
                <option>Regulatory</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Complexity</label>
              <select className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Tags (comma-separated)</label>
            <input 
              type="text" 
              className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} 
              placeholder="NRI, Tax Planning, Investments" 
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>Google Drive Document ID</label>
            <input 
              type="text" 
              className={`w-full px-4 py-2 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`} 
              placeholder="Will connect to Google Drive later" 
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Publish Article
            </button>
            <button className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
              Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

