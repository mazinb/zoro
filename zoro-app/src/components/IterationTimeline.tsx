"use client";

import { useState } from "react";
import { useThemeClasses } from "@/hooks/useThemeClasses";

interface Round {
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
}

interface IterationMeta {
  rounds: Round[];
}

export default function IterationTimeline({ iteration }: { iteration: IterationMeta }) {
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const theme = useThemeClasses(false);
  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");

  if (!iteration?.rounds?.length) return null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400";
    if (score >= 7) return "text-green-400";
    if (score >= 6) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return "bg-emerald-500/10 border-emerald-500/30";
    if (score >= 7) return "bg-green-500/10 border-green-500/30";
    if (score >= 6) return "bg-amber-500/10 border-amber-500/30";
    return "bg-red-500/10 border-red-500/30";
  };

  const getVerdictBadge = (round: Round) => {
    if (round.type === "published") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <span className="text-sm">✓</span> Published
        </span>
      );
    }
    if (round.verdict === "PASS" || round.status === "PASS") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          PASS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        REVISE
      </span>
    );
  };

  return (
    <div className="mt-8">
      <div className={`border-t ${isDark ? "border-slate-700" : "border-slate-300"} pt-6`}>
        <h2 className={`text-lg font-semibold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>
          Review Timeline
        </h2>

        <div className="relative">
          {/* Vertical timeline line */}
          <div className={`absolute left-3.5 top-3 bottom-3 w-px ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />

          <div className="space-y-4">
            {iteration.rounds.map((round, idx) => {
              const isExpanded = expandedRound === round.round;

              return (
                <div key={round.round} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-1.5 top-3">
                    {round.type === "published" ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    ) : round.type === "review" ? (
                      <div className={`w-4 h-4 rounded-full border-2 ${getScoreColor(round.score || 0)} ${isDark ? "bg-slate-900" : "bg-white"}`} />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 ${isDark ? "border-amber-500 bg-slate-900" : "border-amber-500 bg-white"}`} />
                    )}
                  </div>

                  {/* Card */}
                  <div
                    className={`rounded-lg border p-4 cursor-pointer transition-colors ${isDark ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800" : "bg-white border-slate-200 hover:bg-slate-50"} ${isExpanded ? (isDark ? "bg-slate-800 border-slate-600" : "bg-slate-50 border-slate-300") : ""}`}
                    onClick={() => setExpandedRound(isExpanded ? null : round.round)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Round badge */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${round.type === "published" ? "bg-emerald-500/20 text-emerald-400" : round.type === "review" ? (isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600") : "bg-amber-500/20 text-amber-400"}`}>
                          {round.type === "published" ? "✓" : `R${round.round}`}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                              {round.type === "review" ? "Review" : round.type === "revision" ? "Revision" : "Published"}
                            </span>
                            {getVerdictBadge(round)}
                            <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{round.date}</span>
                          </div>

                          <p className={`text-sm mt-1 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                            {round.summary}
                          </p>
                        </div>
                      </div>

                      {/* Score */}
                      {round.type === "review" && round.score && (
                        <div className="flex-shrink-0 text-right">
                          <div className={`text-2xl font-bold ${getScoreColor(round.score)}`}>
                            {round.score.toFixed(1)}
                          </div>
                          <div className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            / 10
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Expand arrow */}
                    <div className={`mt-2 text-xs ${isDark ? "text-slate-500" : "text-slate-400"} flex items-center gap-1`}>
                      <span>{isExpanded ? "Hide" : "Show"} details</span>
                      <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className={`mt-2 ml-2 pl-4 border-l-2 ${isDark ? "border-slate-700" : "border-slate-200"} space-y-3`}>
                      {/* Dimension scores */}
                      {round.dimensions && Object.keys(round.dimensions).length > 0 && (
                        <div>
                          <h4 className={`text-xs font-semibold mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Dimensions
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(round.dimensions).map(([dim, score]) => (
                              <div key={dim} className={`rounded-md p-2 ${isDark ? "bg-slate-900/50" : "bg-slate-100"}`}>
                                <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                  {dim.replace(/([A-Z])/g, " $1").trim()}
                                </div>
                                <div className={`text-sm font-bold ${getScoreColor(score)}`}>
                                  {score.toFixed(1)}/10
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* KILL items */}
                      {round.kills && round.kills.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-red-400 mb-1">
                            KILL ({round.kills.length})
                          </h4>
                          <ul className="space-y-1">
                            {round.kills.map((kill, i) => (
                              <li key={i} className={`text-xs pl-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                • {kill}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* FIX items */}
                      {round.fixes && round.fixes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-amber-400 mb-1">
                            FIX ({round.fixes.length})
                          </h4>
                          <ul className="space-y-1">
                            {round.fixes.map((fix, i) => (
                              <li key={i} className={`text-xs pl-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                • {fix}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Revision changes */}
                      {round.changes && round.changes.length > 0 && (
                        <div>
                          <h4 className={`text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Changes Applied
                          </h4>
                          <ul className="space-y-1">
                            {round.changes.map((change, i) => (
                              <li key={i} className={`text-xs pl-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                                • {change}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
