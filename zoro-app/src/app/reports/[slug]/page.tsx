// app/reports/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, FileText } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { marked } from "marked";

interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [report, setReport] = useState<{ meta: ReportMeta; html: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    // Fetch metadata
    const baseUrl = "/reports/" + slug;
    const fetchReport = async () => {
      try {
        const [metaRes, contentRes] = await Promise.all([
          fetch(baseUrl + ".json"),
          fetch(baseUrl + ".md"),
        ]);

        const meta = await metaRes.json();
        const content = await contentRes.text();

        // Use marked to render markdown to HTML
        marked.setOptions({
          breaks: true,
          gfm: true,
        });
        const html = marked.parse(content) as string;

        setReport({ meta, html });
      } catch (err) {
        console.error("Failed to load report:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [slug]);

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
        <nav className={`border-b ${theme.borderClass}`}>
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <ZoroLogo className="h-10" isDark={darkMode} />
            </div>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </nav>
        <div className={`text-center py-12 ${theme.textSecondaryClass}`}>Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
        <nav className={`border-b ${theme.borderClass}`}>
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <ZoroLogo className="h-10" isDark={darkMode} />
            </div>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto py-10 px-5 md:px-20">
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>
            Report not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      {/* Navigation Header */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/reports")}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Back to reports"
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

      {/* Report Content */}
      <div className="max-w-3xl mx-auto py-10 px-5 md:px-20">
        {/* Title & metadata */}
        <div className="mb-8">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4 ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            <FileText className="w-3 h-3" />
            {report.meta.category}
          </div>
          <h1 className={`text-3xl font-bold mb-3 ${theme.textClass}`}>
            {report.meta.title}
          </h1>
          <p className={`${theme.textSecondaryClass}`}>
            {report.meta.date}
          </p>
        </div>

        {/* HTML content rendered by marked */}
        <div
          className={`${theme.legalContentClass} [&_pre]:bg-[var(--pre-bg)] [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-slate-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:p-2 [&_th]:border [&_th]:${darkMode ? 'border-slate-700' : 'border-slate-300'} [&_td]:p-2 [&_td]:border [&_td]:${darkMode ? 'border-slate-700' : 'border-slate-300'}`}
          dangerouslySetInnerHTML={{ __html: report.html }}
        />
      </div>
    </div>
  );
}
