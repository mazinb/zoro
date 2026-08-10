// app/topics/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, TrendingUp, ExternalLink, ThumbsUp, MessageSquare, Send } from "lucide-react";
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

export default function TopicsPage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((data) => {
        setTopics(data.topics || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
          prev.map((t) => (t.id === id ? { ...t, votes: data.topic.votes, updated_at: new Date().toISOString() } : t))
        );
      }
    } catch (err) {
      console.error("Vote failed:", err);
    } finally {
      setVoting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newTitle.length < 5) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", title: newTitle, url: newUrl, notes: newNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics((prev) => {
          const updated = [...prev, data.topic];
          updated.sort((a, b) => b.votes - a.votes);
          return updated;
        });
        setNewTitle("");
        setNewUrl("");
        setNewNotes("");
      }
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return d;
    }
  };

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      {/* Navigation */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/")} className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`} aria-label="Back to home">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={() => router.push("/")} className="flex items-center cursor-pointer" aria-label="Home">
              <ZoroLogo className="h-10" isDark={darkMode} />
            </button>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`} aria-label="Toggle dark mode">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-5 md:px-20">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className={`text-3xl font-semibold mb-3 ${theme.textClass}`}>Topic Queue</h1>
          <p className={`${theme.textSecondaryClass} mb-4`}>
            5 topics selected for the next daily article. Upvote the ones you want to see published first.
          </p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            <TrendingUp className="w-4 h-4" />
            Next article: Tomorrow at 9:00 AM (Bangkok Time)
          </div>
        </div>

        {/* Submit Form */}
        <form onSubmit={handleSubmit} className={`rounded-lg border p-6 mb-8 ${theme.cardBorderClass} ${theme.cardBgClass}`}>
          <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${theme.textClass}`}>
            <MessageSquare className="w-4 h-4" />
            Submit a Topic
          </h2>
          <div className="space-y-3">
            <div>
              <label className={`text-sm ${theme.textSecondaryClass} mb-1 block`}>Topic title *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. How AI is changing wealth management in India"
                className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} placeholder:${theme.textSecondaryClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                required
              />
            </div>
            <div>
              <label className={`text-sm ${theme.textSecondaryClass} mb-1 block`}>URL (optional)</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} placeholder:${theme.textSecondaryClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <div>
              <label className={`text-sm ${theme.textSecondaryClass} mb-1 block`}>Notes (optional)</label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Why is this topic interesting? Context or key points..."
                className={`w-full px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.inputBgClass} ${theme.textClass} placeholder:${theme.textSecondaryClass} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                rows={2}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || newTitle.length < 5}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Submitting..." : "Submit Topic"}
            </button>
          </div>
        </form>

        {/* Topics List */}
        <h2 className={`text-xl font-semibold mb-4 ${theme.textClass}`}>Current Topics</h2>

        {loading ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>Loading topics...</div>
        ) : topics.length === 0 ? (
          <div className={`text-center py-12 ${theme.textSecondaryClass}`}>No topics yet. Be the first to submit one!</div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic, idx) => (
              <div key={topic.id} className={`rounded-lg border p-5 ${theme.cardBorderClass} ${theme.cardBgClass} ${theme.cardHoverClass} transition`}>
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                    {idx + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${theme.textClass}`}>{topic.title}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {topic.category}
                      </span>
                    </div>

                    {topic.notes && (
                      <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>{topic.notes}</p>
                    )}

                    {topic.url && (
                      <a href={topic.url} target="_blank" rel="noopener noreferrer" className={`text-sm flex items-center gap-1 ${theme.linkClass} hover:${theme.textClass}`}>
                        <span className="truncate">{topic.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    )}

                    <div className={`flex items-center gap-4 mt-2 text-xs ${theme.textSecondaryClass}`}>
                      <span>📎 {topic.source_name}</span>
                      <span>📅 {formatDate(topic.created_at)}</span>
                    </div>
                  </div>

                  {/* Vote Button */}
                  <button
                    onClick={() => handleVote(topic.id)}
                    disabled={voting === topic.id}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme.cardBorderClass} ${theme.cardBgClass} hover:${theme.cardHoverClass} disabled:opacity-50`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${topic.votes > 0 ? 'text-blue-500' : ''}`} />
                    <span className={`font-semibold ${topic.votes > 0 ? 'text-blue-500' : ''}`}>
                      {topic.votes}
                    </span>
                    {voting === topic.id && <span className="text-xs">...</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className={`mt-10 text-center text-sm ${theme.textSecondaryClass}`}>
          The most-voted topic becomes tomorrow's article. Topics auto-refresh every 4 hours.
          <button onClick={() => router.push("/reports")} className={`ml-1 ${theme.linkClass}`}>
            View published articles →
          </button>
        </div>
      </div>
    </div>
  );
}
