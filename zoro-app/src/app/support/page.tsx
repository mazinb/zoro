// app/support/page.tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Sun, ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { REDDIT_URL } from "@/lib/app-download";

function SupportPageContent() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  return (
    <div
      className={`min-h-screen ${theme.bgClass} transition-colors duration-300 ${darkMode ? "dark" : ""}`}
    >
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
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-5 md:px-20">
        <h1 className={`text-3xl font-semibold text-center mb-3 ${theme.textClass}`}>
          Zoro Support
        </h1>
        <p className={`text-center mb-10 ${theme.textSecondaryClass}`}>
          Questions about the app, subscriptions, imports, or your privacy? We&apos;re here to help.
        </p>

        <div className={`prose dark:prose-invert prose-neutral max-w-none leading-relaxed`}>
          <h2>Contact us</h2>
          <p>
            Email is the fastest way to reach us for account, billing, and privacy questions:
          </p>
          <p>
            <a
              href="mailto:admin@getzoro.com"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <Mail className="w-4 h-4" aria-hidden />
              admin@getzoro.com
            </a>
          </p>
          <p>We aim to reply within a few business days.</p>

          <h2>Community</h2>
          <p>
            Share feedback, ask questions, and follow beta updates on our subreddit:
          </p>
          <p>
            <a
              href={REDDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              r/getzoro on Reddit
            </a>
          </p>

          <h2>Common topics</h2>
          <ul>
            <li>
              <strong>Subscriptions (Zoro Pro):</strong> Purchases are handled by Apple. Manage or
              cancel in iOS Settings → Apple ID → Subscriptions, or from Settings → Usage in the
              app.
            </li>
            <li>
              <strong>Import credits:</strong> One-time purchases that add import capacity on the
              free plan. Restore purchases from Settings → Usage.
            </li>
            <li>
              <strong>Cloud AI:</strong> Optional. Zoro asks for permission before sending import
              data to Google&apos;s cloud AI. You can turn it off anytime in Settings → Usage.
            </li>
            <li>
              <strong>Your data:</strong> Your ledger stays on your device by default. See our{" "}
              <Link href="/legal?tab=privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </Link>{" "}
              for details.
            </li>
          </ul>

          <h2>Legal</h2>
          <p>
            <Link href="/legal?tab=terms" className="text-blue-600 dark:text-blue-400 hover:underline">
              Terms of Use (EULA)
            </Link>
            {" · "}
            <Link href="/legal?tab=privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-[#0c0c0c] flex items-center justify-center">
          <div className="text-black dark:text-gray-200">Loading...</div>
        </div>
      }
    >
      <SupportPageContent />
    </Suspense>
  );
}
