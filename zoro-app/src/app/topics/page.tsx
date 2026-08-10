// app/topics/page.tsx — Clean Topics + Reports with modal
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, TrendingUp, ExternalLink, ThumbsUp, Send, X, FileText, RefreshCw, Sparkles } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useThemeClasses } from "@/hooks/useThemeClasses";

interface Topic {
  id: string;
  title: string;
  description: string;
  source: string;
  source_name: string;
  url: string;
  votes: number;
  category: string;
  created_at: string;
  updated_at: string;
  notes: string;
  status: string;
}

interface ReportMeta {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
}

type Tab = "topics" | "reports";

export default function CombinedPage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [activeTab, setActiveTab] = useState<Tab>("topics");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modal form
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newCategory, setNewCategory] = useState("AI");

  useEffect(() => {
    Promise.all([
      fetch("/api/topics").then((r) => r.json()),
      fetch("/api/reports").then((r) => r.json()),
    ])
      .then(([tData, rData]) => {
        setTopics(tData.topics || []);
        setReports(rData.reports || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  /* ---- actions ---- */

  const handleVote = async (id: string) => {
    setVoting(id);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", id }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, votes: data.topic.votes, updated_at: new Date().toISOString() } : t
          )
        );
      }
    } catch { /* ignore */ }
    finally { setVoting(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newTitle.length < 5) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          title: newTitle,
          url: newUrl,
          notes: newNotes,
          category: newCategory,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics((prev) => {
          const all = [...prev, data.topic];
          all.sort((a, b) => b.votes - a.votes);
          return all;
        });
        setNewTitle("");
        setNewUrl("");
        setNewNotes("");
        setNewCategory("AI");
        setModalOpen(false);
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/topics/refresh", { method: "POST" });
      if (res.ok) {
        // Refresh topics list
        const tRes = await fetch("/api/topics");
        const tData = await tRes.json();
        setTopics(tData.topics || []);
      }
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Article generation started!");
      }
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  /* ---- helpers ---- */

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  /* ---- render ---- */

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? "dark" : ""}`}>
      {/* ── Top bar ── */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center cursor-pointer" aria-label="Home">
            <ZoroLogo className="h-10" isDark={darkMode} />
          </button>
          <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`} aria-label="Toggle theme">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* ── Tabs ── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className={`flex border-b ${theme.borderClass}`}>
          <button
            onClick={() => setActiveTab("topics")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "topics"
                ? `border-blue-500 ${theme.textClass}`
                : `border-transparent ${theme.textSecondaryClass} hover:${theme.textClass}`
            }`}
          >
            Topics {topics.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{topics.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "reports"
                ? `border-blue-500 ${theme.textClass}`
                : `border-transparent ${theme.textSecondaryClass} hover:${theme.textClass}`
            }`}
          >
            Reports {reports.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{reports.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto py-10 px-5 md:px-20">
        {activeTab === "topics" ? <TopicsTab /> : <ReportsTab />}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className={`relative w-full max-w-lg rounded-xl border shadow-2xl ${theme.cardBorderClass} ${theme.cardBgClass}`}>
            <div className={`flex items-center justify-between p-6 border-b ${theme.borderClass}`}>
              <h2 className={`text-xl font-semibold ${theme.textClass}`}>Submit a Topic</h2>
              <button onClick={() => setModalOpen(false)} className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={`text-sm font-medium ${theme.textClass} mb-1 block`}>Topic title *</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. The economics of AI training data"
                  className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} placeholder:${theme.textSecondaryClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required autoFocus
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${theme.textClass} mb-1 block`}>Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  {["AI","finance","behavioral-econ","tech","general"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`text-sm font-medium ${theme.textClass} mb-1 block`}>URL (optional)</label>
                <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} placeholder:${theme.textSecondaryClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <div>
                <label className={`text-sm font-medium ${theme.textClass} mb-1 block`}>Notes (optional)</label>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Why is this interesting? Key context..."
                  className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} placeholder:${theme.textSecondaryClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows={3}
                />
              </div>
              <button type="submit" disabled={submitting || newTitle.length < 5}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                <Send className="w-4 h-4" />
                {submitting ? "Submitting..." : "Submit Topic"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Tab components (defined inside so they share state via closure) ── */

  function TopicsTab() {
    return (
      <div>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-semibold mb-3 ${theme.textClass}`}>Topic Queue</h1>
          <p className={`${theme.textSecondaryClass} mb-4`}>
            Topics selected for the next daily article. Upvote to influence what gets published.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
              <TrendingUp className="w-4 h-4" />
              On-demand: pick a topic to generate
            </span>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Topics"}
            </button>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              <Send className="w-4 h-4" />
              Submit
            </button>
            <button onClick={handleGenerate} disabled={generating || topics.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              {generating ? "Generating..." : "Generate Article"}
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>Loading...</div>
        ) : topics.length === 0 ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>No topics yet. Submit one!</div>
        ) : (
          <div className="space-y-3">
            {topics.map((t, idx) => (
              <div key={t.id} className={`rounded-lg border p-5 transition ${theme.cardBorderClass} ${theme.cardBgClass}`}>
                <div className="flex items-start gap-4">
                  {/* Rank badge */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? "bg-yellow-500 text-white" :
                    idx === 1 ? "bg-slate-400 text-white" :
                    idx === 2 ? "bg-amber-700 text-white" :
                    darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`font-semibold ${theme.textClass}`}>{t.title}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{t.category}</span>
                    </div>

                    {t.description && (
                      <p className={`text-sm mb-2 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{t.description}</p>
                    )}

                    {t.notes && (
                      <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>{t.notes}</p>
                    )}

                    {t.url && (
                      <a href={t.url} target="_blank" rel="noreferrer" className={`text-sm flex items-center gap-1 ${theme.linkClass} hover:${theme.textClass}`}>
                        <span className="truncate">{t.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    )}

                    <div className={`flex items-center gap-4 mt-2 text-xs ${theme.textSecondaryClass}`}>
                      <span>📎 {t.source_name}</span>
                      <span>📅 {formatDate(t.created_at)}</span>
                    </div>
                  </div>

                  {/* Vote */}
                  <button onClick={() => handleVote(t.id)} disabled={voting === t.id}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme.cardBorderClass} ${theme.cardBgClass} hover:${theme.cardHoverClass} disabled:opacity-50`}>
                    <ThumbsUp className={`w-4 h-4 ${t.votes > 0 ? "text-blue-500" : ""}`} />
                    <span className={`font-semibold ${t.votes > 0 ? "text-blue-500" : ""}`}>{t.votes}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`mt-10 text-center text-sm ${theme.textSecondaryClass}`}>
          Topics auto-expire after 5 days. Upvote the ones you want first.
        </div>
      </div>
    );
  }

  function ReportsTab() {
    return (
      <div>
        <h1 className={`text-3xl font-semibold text-center mb-4 ${theme.textClass}`}>Reports</h1>
        <p className={`text-center mb-10 ${theme.textSecondaryClass}`}>Deep-dive reports from the Zoro research engine.</p>

        {loading ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>Loading...</div>
        ) : reports.length === 0 ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>No reports yet. Check back soon.</div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <button key={r.slug} onClick={() => router.push(`/reports/${r.slug}`)}
                className={`w-full text-left p-5 rounded-lg border transition cursor-pointer ${theme.cardBorderClass} ${theme.cardBgClass} ${theme.cardHoverClass} group`}>
                <div className="flex items-start gap-4">
                  <FileText className={`w-5 h-5 mt-0.5 flex-shrink-0 ${darkMode ? "text-slate-500" : "text-slate-400"} group-hover:${theme.textClass}`} />
                  <div>
                    <h2 className={`text-lg font-semibold mb-1 ${theme.textClass}`}>{r.title}</h2>
                    <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>{r.date} · {r.category}</p>
                    <p className={`text-sm leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{r.summary}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={`mt-10 text-center text-sm ${theme.textSecondaryClass}`}>
          <button onClick={() => setActiveTab("topics")} className={theme.linkClass}>← Back to Topic Queue</button>
        </div>
      </div>
    );
  }
}
