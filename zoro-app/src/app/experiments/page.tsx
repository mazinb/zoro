// app/experiments/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, TrendingUp, Target, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useThemeClasses } from "@/hooks/useThemeClasses";

interface ScoreMap {
  revenue: number;
  market: number;
  competition: number;
  setup: number;
  maintenance: number;
  time: number;
}

interface Experiment {
  id: string;
  title: string;
  rank: number;
  analysis: string;
  scores: ScoreMap;
  weighted: number;
  key_strength: string;
  key_weakness: string;
  recommendation: string;
  status: string;
}

function ExperimentsPageContent() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/experiments")
      .then((r) => r.json())
      .then((data) => {
        setExperiments(data.experiments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getRecBadge = (rec: string) => {
    if (rec === "start") return { label: "🚀 Start Now", color: darkMode ? "bg-emerald-900 text-emerald-300" : "bg-emerald-100 text-emerald-800" };
    if (rec === "later") return { label: "⏳ Later", color: darkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800" };
    return { label: "❌ Avoid", color: darkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800" };
  };

  const selectedExp = experiments.find((e) => e.id === selectedId);
  const sorted = [...experiments].sort((a, b) => a.rank - b.rank);
  const top3 = sorted.slice(0, 3);

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
            <h1 className={`text-xl font-semibold ${theme.textClass}`}>
              Experiments
            </h1>
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

      <div className="max-w-6xl mx-auto py-10 px-5 md:px-20">
        {/* Top 3 Podium */}
        <div className="mb-12">
          <h2 className={`text-2xl font-semibold text-center mb-8 ${theme.textClass}`}>
            Top 3 Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {top3.map((exp, idx) => {
              const medals = ["🥇", "🥈", "🥉"];
              const gradients = [
                "from-yellow-600/20 to-yellow-900/20",
                "from-gray-500/20 to-gray-700/20",
                "from-orange-700/20 to-orange-900/20"
              ];
              return (
                <button
                  key={exp.id}
                  onClick={() => setSelectedId(exp.id)}
                  className={`relative p-6 rounded-xl border transition-all cursor-pointer bg-gradient-to-br ${gradients[idx]} ${theme.cardBorderClass} ${theme.cardBgClass} hover:scale-105`}
                >
                  <div className="absolute top-3 right-3 text-2xl">{medals[idx]}</div>
                  <div className={`text-3xl font-bold mb-2 ${theme.textClass}`}>
                    #{exp.rank}
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${theme.textClass}`}>
                    {exp.title}
                  </h3>
                  <div className={`text-2xl font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {exp.weighted.toFixed(2)}
                  </div>
                  <div className={`text-xs mt-2 ${theme.textSecondaryClass}`}>
                    Weighted Score
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Matrix Legend */}
        <div className={`mb-8 p-4 rounded-lg ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
          <h3 className={`text-lg font-semibold mb-3 ${theme.textClass}`}>
            Evaluation Matrix
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className={`p-2 rounded ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <span className="font-semibold">Revenue</span> — 25%
            </div>
            <div className={`p-2 rounded ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <span className="font-semibold">Market</span> — 20%
            </div>
            <div className={`p-2 rounded ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <span className="font-semibold">Competition</span> — 15%
            </div>
            <div className={`p-2 rounded ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <span className="font-semibold">Setup</span> — 15%
            </div>
            <div className={`p-2 rounded ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <span className="font-semibold">Maintenance</span> — 15%
            </div>
            <div className={`p-2 rounded ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <span className="font-semibold">Time</span> — 10%
            </div>
          </div>
        </div>

        {/* Full List */}
        <h2 className={`text-2xl font-semibold mb-6 ${theme.textClass}`}>
          All Ideas ({sorted.length})
        </h2>

        {loading ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>
            Loading experiments...
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((exp) => {
              const badge = getRecBadge(exp.recommendation);
              return (
                <button
                  key={exp.id}
                  onClick={() => setSelectedId(selectedId === exp.id ? null : exp.id)}
                  className={`w-full text-left p-5 rounded-lg border transition cursor-pointer ${
                    selectedId === exp.id
                      ? `${theme.textClass} ${darkMode ? 'border-emerald-500/50' : 'border-emerald-400'} shadow-lg`
                      : `${theme.cardBorderClass} ${theme.cardBgClass} ${theme.cardHoverClass}`
                  } group`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      exp.rank <= 3
                        ? "bg-emerald-500 text-white"
                        : darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-700"
                    }`}>
                      {exp.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-semibold ${theme.textClass}`}>
                          {exp.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className={`text-sm mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {exp.analysis}
                      </p>

                      {/* Score bars */}
                      <div className="flex items-center gap-4 text-xs mb-2">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span className={theme.textSecondaryClass}>Revenue:</span>
                          <span className={theme.textClass}>{exp.scores.revenue}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span className={theme.textSecondaryClass}>Market:</span>
                          <span className={theme.textClass}>{exp.scores.market}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span className={theme.textSecondaryClass}>Competition:</span>
                          <span className={theme.textClass}>{exp.scores.competition}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span className={theme.textSecondaryClass}>Setup:</span>
                          <span className={theme.textClass}>{exp.scores.setup}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className={theme.textSecondaryClass}>Maint:</span>
                          <span className={theme.textClass}>{exp.scores.maintenance}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className={theme.textSecondaryClass}>Time:</span>
                          <span className={theme.textClass}>{exp.scores.time}/10</span>
                        </div>
                      </div>

                      {/* Weighted score */}
                      <div className={`text-lg font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        Weighted Score: {exp.weighted.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedId === exp.id && (
                    <div className={`mt-4 pt-4 border-t ${theme.borderClass}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            ✅ Key Strength
                          </h4>
                          <p className={`text-sm ${theme.textClass}`}>
                            {exp.key_strength}
                          </p>
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                            ⚠️ Key Weakness
                          </h4>
                          <p className={`text-sm ${theme.textClass}`}>
                            {exp.key_weakness}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Insights */}
        <div className={`mt-12 p-6 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme.textClass}`}>
            Key Insights
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                <strong className={theme.textClass}>Service first, product second:</strong> Start with content agency (#1) for cash flow, then productize into autonomous tools (#2, #3).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                <strong className={theme.textClass}>DGX Spark's moat:</strong> Local compute = data privacy (legal/research) + zero marginal inference cost (content scale) + on-premise fine-tuning.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">•</span>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                <strong className={theme.textClass}>Content pipeline is the unfair advantage:</strong> Everything Zoro already does applies directly to the top ideas.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                <strong className={theme.textClass}>Avoid exam prep:</strong> Dominated by Unacademy/PW/Byju's who raised $4B+. Competition score: 2/10.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  return <ExperimentsPageContent />;
}
