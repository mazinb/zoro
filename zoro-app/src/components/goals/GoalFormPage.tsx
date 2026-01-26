'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '@/components/ui/Button';

export type GoalField = {
  id: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'number' | 'textarea';
};

type GoalFormPageProps = {
  title: string;
  subtitle: string;
  fields: GoalField[];
};

export const GoalFormPage: React.FC<GoalFormPageProps> = ({ title, subtitle, fields }) => {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const inputClass = useMemo(() => {
    return `w-full px-4 py-3 rounded-lg border text-sm transition-colors ${theme.inputBgClass}`;
  }, [theme.inputBgClass]);

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setValues({});
    setSubmitted(false);
  };

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center cursor-pointer"
            aria-label="Back to home"
          >
            <ZoroLogo className="h-10" isDark={darkMode} />
          </button>
          <div className="flex items-center gap-6">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className={`border ${theme.cardBorderClass} ${theme.cardBgClass} rounded-2xl p-8`}>
          <div className="mb-6">
            <h1 className={`text-3xl font-bold ${theme.textClass} mb-2`}>{title}</h1>
            <p className={`${theme.textSecondaryClass}`}>{subtitle}</p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <p className={`${theme.textClass}`}>
                Thanks for sharing. We saved your responses and will use them as we refine this form.
              </p>
              <div className="flex gap-3">
                <Button variant="primary" darkMode={darkMode} onClick={handleReset}>
                  Submit another response
                </Button>
                <Button variant="ghost" darkMode={darkMode} onClick={() => router.push('/')}>
                  Back to home
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {fields.map((field) => (
                <label key={field.id} className="flex flex-col gap-2">
                  <span className={`text-sm font-medium ${theme.textClass}`}>{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={4}
                      value={values[field.id] || ''}
                      onChange={(event) => handleChange(field.id, event.target.value)}
                      placeholder={field.placeholder}
                      className={`${inputClass} resize-none`}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={values[field.id] || ''}
                      onChange={(event) => handleChange(field.id, event.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  )}
                </label>
              ))}
              <div className="flex gap-3">
                <Button variant="primary" darkMode={darkMode} type="submit">
                  Save responses
                </Button>
                <Button variant="ghost" darkMode={darkMode} type="button" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

