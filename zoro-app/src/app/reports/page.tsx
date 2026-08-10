// app/reports/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, FileText } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useThemeClasses } from "@/hooks/useThemeClasses";

interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
}

function ReportsPageContent() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      {/* Navigation Header */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center cursor-pointer"
              aria-label="Home"
            >
              <ZoroLogo className="h-10" isDark={darkMode} />
            </button>
          </div>
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

      <div className="max-w-3xl mx-auto py-10 px-5 md:px-20">
        {/* Header */}
        <h1 className={`text-3xl font-semibold text-center mb-4 ${theme.textClass}`}>
          Reports
        </h1>
        <p className={`text-center mb-10 ${theme.textSecondaryClass}`}>
          Research notes and deep-dive reports from the Zoro team.
        </p>

        {/* Content */}
        {loading ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>
            No reports yet. Check back soon.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <button
                key={report.slug}
                onClick={() => router.push(`/reports/${report.slug}`)}
                className={`w-full text-left p-5 rounded-lg border transition cursor-pointer ${theme.cardBorderClass} ${theme.cardBgClass} ${theme.cardHoverClass} group`}
              >
                <div className="flex items-start gap-4">
                  <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'} group-hover:${theme.textClass}`} />
                  <div className="flex-1">
                    <h2 className={`text-lg font-semibold mb-1 ${theme.textClass}`}>
                      {report.title}
                    </h2>
                    <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>
                      {report.date} · {report.category}
                    </p>
                    <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {report.summary}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return <ReportsPageContent />;
}
