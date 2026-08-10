// app/reports/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, FileText, GitBranch } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import IterationTimeline from "@/components/IterationTimeline";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { marked } from "marked";

interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  qualityGates?: {
    minWordCount?: number;
    minCitations?: number;
    hasCounterargument?: boolean;
    hasCallToAction?: boolean;
    noHallucinatedClaims?: boolean;
  };
}

interface IterationMeta {
  rounds: {
    round: number;
    type: "review" | "revision" | "published";
    status: "FAIL" | "PASS" | "APPLIED" | "PUBLISH";
    score?: number;
    date: string;
    summary: string;
    verdict?: string;
    dimensions?: Record<string, number>;
    kills?: string[];
    fixes?: string[];
    changes?: string[];
  }[];
}

interface ReportData {
  meta: ReportMeta;
  html: string;
  iteration?: IterationMeta;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
      return next;
    });
  };
  const theme = useThemeClasses(darkMode);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const baseUrl = "/reports/" + slug;
    const fetchReport = async () => {
      try {
        const [metaRes, contentRes, iterationRes] = await Promise.all([
          fetch(baseUrl + ".json"),
          fetch(baseUrl + ".md"),
          fetch(baseUrl + "-iteration.json").catch(() => null),
        ]);

        const meta = await metaRes.json();
        const content = await contentRes.text();

        marked.setOptions({
          breaks: true,
          gfm: true,
        });
        const html = marked.parse(content) as string;

        let iteration: IterationMeta | undefined;
        const iterationResData = await iterationRes?.json().catch(() => null);
        if (iterationResData?.rounds?.length) {
          iteration = iterationResData;
        }

        setReport({ meta, html, iteration });
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

  const hasIteration = !!report?.iteration?.rounds?.length;
  const finalRound = hasIteration ? report.iteration!.rounds[report.iteration!.rounds.length - 1] : undefined;
  const finalScore = finalRound?.type === "review" ? finalRound.score : undefined;

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
            {hasIteration && (
              <div className="hidden sm:flex items-center gap-2">
                <GitBranch className={`w-4 h-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`} />
                <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {report.iteration?.rounds?.length} iterations
                </span>
              </div>
            )}
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
          <div className="flex items-center gap-3 mb-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              <FileText className="w-3 h-3" />
              {report.meta.category}
            </div>
            {hasIteration && finalScore && (
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${finalScore >= 7 ? (darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (darkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700')}`}>
                <GitBranch className="w-3 h-3" />
                Final score: {finalScore.toFixed(1)}/10
              </div>
            )}
          </div>
          <h1 className={`text-3xl font-bold mb-3 ${theme.textClass}`}>
            {report.meta.title}
          </h1>
          <p className={`${theme.textSecondaryClass}`}>
            {report.meta.date}
          </p>
        </div>

        {/* Quality gates (if any) */}
        {report.meta.qualityGates && (
          <div className={`mb-6 rounded-lg border p-4 ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-xs font-semibold mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quality Gates</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.entries(report.meta.qualityGates).map(([key, value]) => (
                <div key={key} className={`rounded-md p-2 text-center ${darkMode ? 'bg-slate-900/50' : 'bg-white'}`}>
                  <div className={`text-lg ${value ? 'text-emerald-400' : 'text-red-400'}`}>{value ? '✓' : '✗'}</div>
                  <div className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HTML content rendered by marked */}
        <div
          className={`${theme.legalContentClass} [&_pre]:bg-[var(--pre-bg)] [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-slate-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:p-2 [&_th]:border [&_th]:${darkMode ? 'border-slate-700' : 'border-slate-300'} [&_td]:p-2 [&_td]:border [&_td]:${darkMode ? 'border-slate-700' : 'border-slate-300'}`}
          dangerouslySetInnerHTML={{ __html: report.html }}
        />

        {/* Iteration timeline */}
        {hasIteration && (
          <IterationTimeline iteration={report.iteration!} />
        )}
      </div>
    </div>
  );
}
