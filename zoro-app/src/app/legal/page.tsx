// app/legal/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import { ZoroLogo } from "@/components/ZoroLogo";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useThemeClasses } from "@/hooks/useThemeClasses";

function LegalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  
  // Get tab from URL params, default to "terms"
  const tabFromUrl = searchParams?.get("tab") as "terms" | "privacy" | null;
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(
    tabFromUrl === "privacy" ? "privacy" : "terms"
  );

  // Update active tab when URL param changes
  useEffect(() => {
    if (tabFromUrl === "privacy" || tabFromUrl === "terms") {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = (tab: "terms" | "privacy") => {
    setActiveTab(tab);
    router.push(`/legal?tab=${tab}`, { scroll: false });
  };

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
        <h1 className={`text-3xl font-semibold text-center mb-8 ${theme.textClass}`}>
          Zoro Legal Information
        </h1>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-10">
          <button
            onClick={() => handleTabChange("terms")}
            className={`px-4 py-2 rounded-md border transition 
              ${activeTab === "terms"
                ? darkMode 
                  ? "bg-white text-black border-white" 
                  : "bg-black text-white border-black"
                : `${theme.borderClass} ${theme.textSecondaryClass} hover:${theme.textClass}`
              }`}
          >
            Terms of Use
          </button>

          <button
            onClick={() => handleTabChange("privacy")}
            className={`px-4 py-2 rounded-md border transition 
              ${activeTab === "privacy"
                ? darkMode 
                  ? "bg-white text-black border-white" 
                  : "bg-black text-white border-black"
                : `${theme.borderClass} ${theme.textSecondaryClass} hover:${theme.textClass}`
              }`}
          >
            Privacy Policy
          </button>
        </div>

        {/* Content */}
        <div className={`prose dark:prose-invert prose-neutral max-w-none leading-relaxed`}>
          {activeTab === "terms" ? <TermsOfUse /> : <PrivacyPolicy />}
        </div>
      </div>
    </div>
  );
}

export default function LegalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-[#0c0c0c] flex items-center justify-center">
        <div className="text-black dark:text-gray-200">Loading...</div>
      </div>
    }>
      <LegalPageContent />
    </Suspense>
  );
}

/* ----------------- TERMS OF USE COMPONENT ----------------- */

function TermsOfUse() {
  return (
    <>
      <h2>Terms of Use</h2>
      <p><strong>Last updated:</strong> June 7, 2026</p>

      <p>
        These Terms of Use (&quot;Terms&quot;) govern your use of the Zoro mobile application,
        website at getzoro.com, and related services (collectively, the &quot;Services&quot;)
        operated by Zoro (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By using the Services,
        you agree to these Terms. If you do not agree, do not use the Services.
      </p>

      <h3>1. Who may use Zoro</h3>
      <p>
        You must be at least 18 years old and able to enter a binding contract under applicable law.
        You are responsible for your account credentials (where applicable) and for all activity
        under your account.
      </p>

      <h3>2. What Zoro is</h3>
      <p>
        Zoro is a personal finance tool that helps you track net worth, cash flow, context, and
        goals. The mobile app stores your ledger on your device by default. We do not offer bank
        login, brokerage services, portfolio management, or regulated financial advisory services.
      </p>
      <p>
        Optional features may use artificial intelligence (AI) after you grant in-app permission.
        AI output is generated automatically and may be incomplete or wrong.
      </p>

      <h3>3. Not financial advice</h3>
      <p>
        <strong>
          Nothing in the Services is financial, investment, tax, legal, or insurance advice.
        </strong>{' '}
        Content, calculations, projections, and AI responses are for general information and
        personal organization only. You are solely responsible for your financial decisions.
        Consult a qualified professional before acting on any information from Zoro.
      </p>

      <h3>4. Provided &quot;as is&quot;</h3>
      <p>
        The Services are provided on an <strong>&quot;as is&quot;</strong> and{' '}
        <strong>&quot;as available&quot;</strong> basis, without warranties of any kind, whether
        express or implied, including merchantability, fitness for a particular purpose, accuracy,
        or non-infringement. We do not guarantee uninterrupted or error-free operation.
      </p>

      <h3>5. Your responsibilities</h3>
      <ul>
        <li>Provide accurate information you choose to enter</li>
        <li>Keep your device secure</li>
        <li>Use the Services only for lawful purposes</li>
        <li>Not misuse, reverse engineer, or interfere with the Services</li>
        <li>Comply with the terms of any third-party AI service you opt into</li>
      </ul>

      <h3>6. Zoro Pro and in-app purchases</h3>
      <p>
        The Zoro iOS app offers an optional auto-renewing subscription, <strong>Zoro Pro</strong>,
        and optional consumable <strong>import credits</strong>. Purchases are processed by Apple
        through your App Store account. Payment is charged to your Apple ID at confirmation of
        purchase.
      </p>
      <ul>
        <li>
          <strong>Zoro Pro</strong> is a monthly subscription that renews automatically unless
          canceled at least 24 hours before the end of the current period. Manage or cancel in
          iOS Settings → Apple ID → Subscriptions, or from Settings → Usage in the app.
        </li>
        <li>
          <strong>Import credits</strong> are one-time consumable purchases that add import
          capacity for free-tier users.
        </li>
      </ul>
      <p>
        Subscription price, length, and renewal terms are shown in the in-app purchase flow before
        you confirm. Free-tier import limits (setup pool and monthly allowance) are described in
        Settings → Usage in the app.
      </p>

      <h3>7. Your data</h3>
      <p>
        In the mobile app, your ledger and related data are stored locally on your device unless you
        export, back up, or use optional features that send data elsewhere. You control what you
        enter and what you share. See our Privacy Policy for how we handle information on the
        website and optional online features.
      </p>

      <h3>8. Third parties and AI</h3>
      <p>
        If you enable AI features, Zoro shows an in-app disclosure before your data is sent for the
        first time. Depending on the feature, data may be processed on your device (Apple
        Intelligence) or sent to Google&apos;s cloud AI when you opt in to Cloud AI for imports.
        Each provider&apos;s terms and privacy policy apply. We are not responsible for third-party
        services.
      </p>

      <h3>9. Intellectual property</h3>
      <p>
        Zoro owns the Services, branding, and software. We grant you a limited, personal,
        non-transferable licence to use the Services. You may not copy, resell, or create derivative
        works without our written permission.
      </p>

      <h3>10. Limitation of liability</h3>
      <p>
        To the fullest extent permitted by law, Zoro and its affiliates will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or for any loss of
        profits, data, or goodwill, arising from your use of the Services. Our total liability for
        any claim relating to the Services will not exceed the amounts you paid us for the Services
        in the twelve months before the claim (or, if you have not paid us, zero).
      </p>

      <h3>11. Indemnity</h3>
      <p>
        You agree to indemnify and hold Zoro harmless from claims arising from your use of the
        Services, your content, or your violation of these Terms or applicable law.
      </p>

      <h3>12. Changes and termination</h3>
      <p>
        We may update these Terms or discontinue parts of the Services. Material changes will be
        posted on this page. Continued use after changes means you accept the updated Terms. We may
        suspend access if you breach these Terms.
      </p>

      <h3>13. Governing law and disputes</h3>
      <p>
        These Terms are interpreted according to applicable law. Mandatory consumer protections
        where you live continue to apply where they cannot be waived. For App Store purchases,
        Apple&apos;s terms and refund policies also apply.
      </p>

      <h3>14. Contact</h3>
      <p>
        <strong>Email:</strong>{' '}
        <a href="mailto:admin@getzoro.com" className="text-blue-600 dark:text-blue-400 hover:underline">
          admin@getzoro.com
        </a>
      </p>
    </>
  );
}

/* ----------------- PRIVACY POLICY COMPONENT ----------------- */

function PrivacyPolicy() {
  return (
    <>
      <h2>Privacy Policy</h2>
      <p><strong>Last updated:</strong> June 7, 2026</p>

      <p>
        This Privacy Policy explains how Zoro (&quot;we&quot;, &quot;us&quot;) handles information
        when you use the Zoro mobile app, getzoro.com, and related services (the
        &quot;Services&quot;). We are committed to privacy by design.
      </p>

      <h3>1. The short version</h3>
      <ul>
        <li>
          <strong>Mobile app:</strong> Your ledger, context, and goals are stored on your device.
          We do not run bank sync and we do not receive your full financial ledger unless you
          choose to export, back up, or use an optional online feature you authorize.
        </li>
        <li>
          <strong>Website:</strong> We collect only what you submit (for example a waitlist email) or
          what is needed to run the site (basic logs, cookies).
        </li>
        <li>
          <strong>AI (optional):</strong> On-device AI runs on your iPhone. Cloud AI for imports runs
          only after you grant in-app permission and sends data to Google&apos;s servers.
        </li>
        <li>
          <strong>We do not sell your personal data.</strong>
        </li>
      </ul>

      <h3>2. Zoro mobile app</h3>
      <p>
        The app is built so your financial data stays on your phone. You enter assets, liabilities,
        income, expenses, and related notes locally. Optional features include:
      </p>
      <ul>
        <li>Local reminders (handled by your device, not our servers)</li>
        <li>Export/import of your ledger file for your own backup</li>
        <li>AI-assisted import and helpers when you explicitly grant permission</li>
      </ul>

      <h3>2a. Third-party AI services (mobile app)</h3>
      <p>
        If you enable AI in the app, Zoro shows an in-app disclosure before your data is sent for
        the first time with each service. The disclosure identifies what categories of data may be
        sent and who receives them. We record your consent on your device and in our backend for
        audit purposes (device identifier, provider name, consent timestamp, app version). You can
        opt out of Cloud AI anytime in Settings → Usage.
      </p>
      <p>Depending on the feature you use, data may be sent to:</p>
      <ul>
        <li>
          <strong>Apple Inc.</strong> — Apple Intelligence Foundation Models processed on your
          iPhone (on-device). See{' '}
          <a href="https://www.apple.com/legal/privacy/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Apple&apos;s Privacy Policy
          </a>
          .
        </li>
        <li>
          <strong>Google LLC</strong> — when you opt in to Cloud AI for imports, Zoro sends your
          import files and related context to Google&apos;s cloud AI service operated by Google. See{' '}
          <a href="https://policies.google.com/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
            Google&apos;s Privacy Policy
          </a>{' '}
          and{' '}
          <a href="https://developers.google.com/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
            Google&apos;s Terms of Service
          </a>
          .
        </li>
      </ul>
      <p>Categories of data that may be included in AI requests when you use helpers or imports:</p>
      <ul>
        <li>Text you type or paste</li>
        <li>Summarized ledger information (names, balances, types of assets and liabilities)</li>
        <li>Cash flow, expense estimates, goals context, and notes you wrote in the app</li>
        <li>Text extracted from PDFs or images you choose to attach for import</li>
      </ul>
      <p>
        We do not use AI requests to build advertising profiles. Cloud AI providers process data under
        their own terms and privacy policies; you should review them before enabling Cloud AI.
        Zoro does not store the contents of your import files on our servers as part of normal
        processing — files are forwarded for extraction and discarded after the request completes.
      </p>

      <h3>3. Website and optional online features</h3>
      <p>If you use getzoro.com or related tools, we may process:</p>
      <ul>
        <li>
          <strong>Contact details</strong> you submit (for example email on a waitlist or support
          request)
        </li>
        <li>
          <strong>Account data</strong> if you sign in to optional web features (such as reminders or
          forms that sync to our backend)
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, pages visited, and similar
          server logs for security and operation
        </li>
        <li>
          <strong>Cookies</strong> needed for the site to function and, where enabled, basic
          analytics
        </li>
      </ul>
      <p>
        We do not ask for bank passwords or brokerage login credentials on the website or in the
        app.
      </p>

      <h3>4. How we use information</h3>
      <ul>
        <li>Operate and improve the Services</li>
        <li>Respond to your requests and support messages</li>
        <li>Send service-related emails you ask for (for example beta or account links)</li>
        <li>Protect against abuse, fraud, and security incidents</li>
        <li>Comply with law</li>
      </ul>
      <p>We do not use your app ledger for advertising profiles.</p>

      <h3>5. Sharing</h3>
      <p>We may share information only with:</p>
      <ul>
        <li>
          <strong>Service providers</strong> who host the website, send email, or provide analytics,
          under confidentiality obligations
        </li>
        <li>
          <strong>AI providers you opt into</strong> when you grant in-app permission (Apple on-device
          or Google Cloud AI for imports)
        </li>
        <li>
          <strong>Authorities</strong> when required by law or to protect rights and safety
        </li>
      </ul>
      <p>We do not sell personal data.</p>

      <h3>6. Retention</h3>
      <p>
        App data on your device is kept until you delete it or uninstall the app. Website and account
        data are kept only as long as needed for the purpose collected, or as required by law, then
        deleted or anonymised.
      </p>

      <h3>7. Security</h3>
      <p>
        We use reasonable technical and organisational measures for information we process online.
        No system is perfectly secure; you are responsible for securing your device and backups.
      </p>

      <h3>8. Your rights</h3>
      <p>
        Depending on applicable law where you live, you may have rights to access, correct, delete,
        or withdraw consent for personal data we hold about you. To exercise these rights, email us.
        You may also lodge a complaint with a relevant privacy authority if one applies where you
        live.
      </p>

      <h3>9. Children</h3>
      <p>The Services are not directed at anyone under 18. We do not knowingly collect data from children.</p>

      <h3>10. International transfers</h3>
      <p>
        Some service providers or AI vendors may process data in countries other than where you
        live. Where required, we use appropriate safeguards for such transfers.
      </p>

      <h3>11. Changes to this Policy</h3>
      <p>
        We may update this Policy. The &quot;Last updated&quot; date will change. Continued use after
        material changes means you accept the updated Policy.
      </p>

      <h3>12. App Store and Apple</h3>
      <p>
        If you download Zoro from the Apple App Store, Apple&apos;s terms apply to your App Store
        account and purchases. Apple processes subscription and payment data for Zoro Pro and import
        credits; we do not receive your full payment card details. The App Store privacy nutrition
        label for Zoro summarizes data types the app may access; this Policy provides additional
        detail. Manage subscriptions in iOS Settings → Apple ID → Subscriptions.
      </p>

      <h3>13. Contact</h3>
      <p>
        <strong>Email:</strong>{' '}
        <a href="mailto:admin@getzoro.com" className="text-blue-600 dark:text-blue-400 hover:underline">
          admin@getzoro.com
        </a>
      </p>
      <p>
        For privacy questions or concerns, contact us at the same address. We will respond within a
        reasonable time.
      </p>
    </>
  );
}

