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
          {activeTab === "terms" ? <TermsOfUse theme={theme} /> : <PrivacyPolicy theme={theme} />}
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

function TermsOfUse({ theme }: { theme: ReturnType<typeof useThemeClasses> }) {
  return (
    <>
      <h2>Terms of Use</h2>
      <p><strong>Last updated:</strong> February 20, 2026</p>

      <p>
        Welcome to Zoro ("we", "us", "our", "Company"). These Terms of Use ("Terms") constitute a legally binding agreement between you and Zoro governing your access to and use of our website, mobile application, tools, and services (collectively, the "Services"). By accessing or using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must immediately discontinue use of the Services.
      </p>

      <h3>1. Definitions</h3>
      <p>
        <strong>1.1.</strong> "End User" or "User" refers to any individual who uses the Services to access financial information, insights, or estate planning tools for personal use.
      </p>
      <p>
        <strong>1.2.</strong> "Advisor" refers to any registered financial advisor, planner, or professional who uses the Services to provide financial advisory services to clients through the Zoro platform.
      </p>
      <p>
        <strong>1.3.</strong> "Services" includes all features, functionality, content, and services provided by Zoro, including but not limited to AI-powered financial insights, estate planning tools, and advisor-client matching services.
      </p>

      <h3>2. Eligibility and Account Registration</h3>
      <p>
        <strong>2.1.</strong> You must be at least 18 years of age and legally capable of entering into a binding contract under the Indian Contract Act, 1872, to use the Services.
      </p>
      <p>
        <strong>2.2.</strong> End Users may register for a personal account to access financial planning tools and insights.
      </p>
      <p>
        <strong>2.3.</strong> Advisors must complete a verification process and provide professional credentials, certifications, and regulatory compliance information as required by Zoro and applicable Indian regulations, including but not limited to the Securities and Exchange Board of India (SEBI) regulations.
      </p>
      <p>
        <strong>2.4.</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
      </p>

      <h3>3. Nature of the Service</h3>
      <p>
        <strong>3.1.</strong> Zoro provides general financial information, AI-powered insights, and estate planning tools. The Services are designed to assist Users in understanding their financial situation and making informed decisions.
      </p>
      <p>
        <strong>3.2.</strong> <strong>For End Users:</strong> Zoro does not provide personalized investment advice, portfolio management services, tax advice, or regulated financial advisory services. All financial decisions based on our tools and insights are your sole responsibility. The Services are informational in nature and do not constitute a recommendation to buy, sell, or hold any financial instrument.
      </p>
      <p>
        <strong>3.3.</strong> <strong>For Advisors:</strong> Advisors may use the Services to provide professional financial advisory services to their clients. Advisors are responsible for ensuring compliance with all applicable Indian laws and regulations, including SEBI regulations, the Companies Act, 2013, and any other relevant financial services regulations.
      </p>
      <p>
        <strong>3.4.</strong> Zoro acts as a technology platform facilitating connections between End Users and Advisors. Zoro is not a party to any advisory relationship between Users and Advisors.
      </p>

      <h3>4. User Responsibilities and Prohibited Conduct</h3>
      <p>
        <strong>4.1.</strong> You agree not to misuse the Services, including but not limited to:
      </p>
      <ul>
        <li>Attempting unauthorized access to the Services or other users' accounts</li>
        <li>Providing false, misleading, or inaccurate information</li>
        <li>Using the Services for any illegal or unauthorized purpose</li>
        <li>Interfering with or disrupting the Services or servers</li>
        <li>Reverse engineering, decompiling, or disassembling any part of the Services</li>
        <li>Violating any applicable laws, rules, or regulations</li>
      </ul>
      <p>
        <strong>4.2.</strong> <strong>Advisor-Specific Obligations:</strong> Advisors must maintain professional standards, provide accurate and ethical advice, maintain client confidentiality, and comply with all applicable professional codes of conduct and regulatory requirements.
      </p>

      <h3>5. Financial Information and Data</h3>
      <p>
        <strong>5.1.</strong> You may voluntarily provide financial information such as income, expenses, assets, liabilities, financial goals, and estate planning preferences.
      </p>
      <p>
        <strong>5.2.</strong> Zoro does not request, collect, or store bank login credentials, one-time passwords (OTPs), credit card numbers, or other sensitive authentication data unless explicitly stated and with your express consent.
      </p>
      <p>
        <strong>5.3.</strong> All financial information provided by you remains your property. You grant Zoro a limited license to use such information solely for the purpose of providing the Services, in accordance with our Privacy Policy and applicable data protection laws.
      </p>

      <h3>6. Intellectual Property Rights</h3>
      <p>
        <strong>6.1.</strong> All content, design, software, algorithms, AI models, trademarks, logos, and other intellectual property on the Services are the exclusive property of Zoro or its licensors and are protected under the Copyright Act, 1957, and the Trade Marks Act, 1999.
      </p>
      <p>
        <strong>6.2.</strong> You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Services for personal or professional purposes in accordance with these Terms.
      </p>
      <p>
        <strong>6.3.</strong> You may not copy, modify, distribute, sell, lease, or create derivative works from any part of the Services without prior written authorization from Zoro.
      </p>

      <h3>7. AI-Generated Content and Disclaimers</h3>
      <p>
        <strong>7.1.</strong> The Services utilize artificial intelligence and machine learning technologies to generate insights, recommendations, and content. AI-generated content may contain inaccuracies, errors, or outdated information.
      </p>
      <p>
        <strong>7.2.</strong> You acknowledge that all AI-generated insights are provided "as is" and should be independently verified before making any financial decisions. Zoro does not guarantee the accuracy, completeness, or suitability of AI-generated content for your specific circumstances.
      </p>
      <p>
        <strong>7.3.</strong> Zoro shall not be liable for any decisions, actions, or consequences arising from reliance on AI-generated content or insights provided through the Services.
      </p>

      <h3>8. Limitation of Liability</h3>
      <p>
        <strong>8.1.</strong> To the maximum extent permitted under the Indian Contract Act, 1872, and other applicable Indian laws, Zoro, its directors, officers, employees, agents, and affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to financial losses, data loss, loss of profits, or business interruption, arising from or related to your use of or inability to use the Services.
      </p>
      <p>
        <strong>8.2.</strong> Zoro's total liability, if any, shall not exceed the amount you have paid to Zoro in the twelve (12) months preceding the claim, or INR 1,000, whichever is lower.
      </p>
      <p>
        <strong>8.3.</strong> The limitations set forth in this section shall apply regardless of the legal theory on which the claim is based, including but not limited to contract, tort, negligence, or strict liability.
      </p>

      <h3>9. Indemnification</h3>
      <p>
        <strong>9.1.</strong> You agree to indemnify, defend, and hold harmless Zoro, its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorney's fees) arising from:
      </p>
      <ul>
        <li>Your use of or access to the Services</li>
        <li>Your violation of these Terms</li>
        <li>Your violation of any third-party rights, including intellectual property or privacy rights</li>
        <li>Any content or information you submit, post, or transmit through the Services</li>
        <li>For Advisors: any claims arising from your professional services provided to clients through the platform</li>
      </ul>

      <h3>10. Termination</h3>
      <p>
        <strong>10.1.</strong> Zoro reserves the right to suspend or terminate your access to the Services at any time, with or without cause or notice, for any violation of these Terms or for any other reason deemed necessary by Zoro.
      </p>
      <p>
        <strong>10.2.</strong> You may terminate your account at any time by contacting us at the email address provided below.
      </p>
      <p>
        <strong>10.3.</strong> Upon termination, your right to use the Services will immediately cease, and we may delete or restrict access to your account and data, subject to our data retention obligations under applicable law.
      </p>

      <h3>11. Governing Law and Dispute Resolution</h3>
      <p>
        <strong>11.1.</strong> These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
      </p>
      <p>
        <strong>11.2.</strong> Any disputes arising out of or in connection with these Terms or the Services shall be subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra, India.
      </p>
      <p>
        <strong>11.3.</strong> The parties agree to first attempt to resolve any dispute through good faith negotiations. If such negotiations are unsuccessful, the dispute shall be resolved through arbitration in accordance with the Arbitration and Conciliation Act, 1996, by a sole arbitrator appointed by mutual agreement.
      </p>

      <h3>12. Compliance with Indian Laws</h3>
      <p>
        <strong>12.1.</strong> These Terms are designed to comply with applicable Indian laws, including but not limited to:
      </p>
      <ul>
        <li>The Information Technology Act, 2000, and its associated rules</li>
        <li>The Digital Personal Data Protection Act, 2023</li>
        <li>The Indian Contract Act, 1872</li>
        <li>SEBI regulations (for Advisor-related services)</li>
        <li>The Companies Act, 2013</li>
      </ul>

      <h3>13. Modifications to Terms</h3>
      <p>
        <strong>13.1.</strong> Zoro reserves the right to modify these Terms at any time. Material changes will be notified to you through the Services or via email.
      </p>
      <p>
        <strong>13.2.</strong> Your continued use of the Services after such modifications constitutes your acceptance of the updated Terms.
      </p>

      <h3>14. Severability</h3>
      <p>
        If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect.
      </p>

      <h3>15. Contact Information</h3>
      <p>
        For any questions, concerns, or legal notices regarding these Terms, please contact us at:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:admin@getzoro.com" className="text-blue-600 dark:text-blue-400 hover:underline">admin@getzoro.com</a>
      </p>
      <p>
        <strong>Zoro</strong><br />
        Mumbai, Maharashtra, India
      </p>
    </>
  );
}

/* ----------------- PRIVACY POLICY COMPONENT ----------------- */

function PrivacyPolicy({ theme }: { theme: ReturnType<typeof useThemeClasses> }) {
  return (
    <>
      <h2>Privacy Policy</h2>
      <p><strong>Last updated:</strong> February 20, 2026</p>

      <p>
        This Privacy Policy ("Policy") describes how Zoro ("we", "our", "us", "Company") collects, uses, processes, stores, and protects your personal data in accordance with applicable Indian data protection laws, including the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023 ("DPDPA").
      </p>
      <p>
        By using our Services, you consent to the collection and use of your personal data as described in this Policy. If you do not agree with this Policy, please discontinue use of the Services.
      </p>

      <h3>1. Definitions</h3>
      <p>
        <strong>1.1.</strong> "Personal Data" means any information that relates to a natural person and which, either directly or indirectly, in combination with other information available or likely to be available, is capable of identifying such person.
      </p>
      <p>
        <strong>1.2.</strong> "Sensitive Personal Data" includes financial information, passwords, and any other information categorized as sensitive under applicable Indian laws.
      </p>
      <p>
        <strong>1.3.</strong> "Data Principal" refers to the individual to whom the personal data relates (i.e., you, the user).
      </p>
      <p>
        <strong>1.4.</strong> "End User" refers to individuals using the Services for personal financial planning and insights.
      </p>
      <p>
        <strong>1.5.</strong> "Advisor" refers to registered financial advisors and professionals using the Services to provide advisory services.
      </p>

      <h3>2. Information We Collect</h3>
      <p>
        <strong>2.1. Information You Provide:</strong>
      </p>
      <ul>
        <li><strong>Account Information:</strong> Name, email address, phone number, date of birth, and account credentials</li>
        <li><strong>Financial Information:</strong> Income, expenses, assets, liabilities, financial goals, investment preferences, estate planning information, and beneficiary details</li>
        <li><strong>For Advisors:</strong> Professional credentials, certifications, license numbers, regulatory compliance information, business registration details, and client management data</li>
        <li><strong>Communication Data:</strong> Messages, inquiries, feedback, and other communications sent through the Services</li>
        <li><strong>Profile Information:</strong> Preferences, settings, and other information you choose to provide</li>
      </ul>
      <p>
        <strong>2.2. Information Collected Automatically:</strong>
      </p>
      <ul>
        <li><strong>Device Information:</strong> Device type, operating system, browser type, device identifiers, and mobile network information</li>
        <li><strong>Usage Data:</strong> IP address, access times, pages viewed, features used, clickstream data, and navigation patterns</li>
        <li><strong>Location Data:</strong> General location information derived from IP address (we do not collect precise GPS location without your explicit consent)</li>
        <li><strong>Cookies and Tracking Technologies:</strong> Cookies, web beacons, pixel tags, and similar technologies as described in Section 6</li>
        <li><strong>Log Data:</strong> Server logs, error logs, and system performance data</li>
      </ul>
      <p>
        <strong>2.3. Information from Third Parties:</strong>
      </p>
      <ul>
        <li>Information from financial institutions (only with your explicit authorization)</li>
        <li>Public records and databases for verification purposes (for Advisors)</li>
        <li>Analytics and marketing service providers</li>
      </ul>

      <h3>3. Legal Basis for Processing</h3>
      <p>
        We process your personal data based on the following legal grounds as recognized under Indian law:
      </p>
      <ul>
        <li><strong>Consent:</strong> Your explicit consent for specific processing activities, which you may withdraw at any time</li>
        <li><strong>Contractual Necessity:</strong> Processing necessary to perform our contract with you and provide the Services</li>
        <li><strong>Legitimate Interest:</strong> Processing necessary for our legitimate business interests, such as improving the Services, security, and fraud prevention, while respecting your fundamental rights</li>
        <li><strong>Legal Obligation:</strong> Processing required to comply with applicable laws, regulations, or court orders</li>
        <li><strong>Vital Interests:</strong> Processing necessary to protect your vital interests or those of another person</li>
      </ul>

      <h3>4. How We Use Your Information</h3>
      <p>
        <strong>4.1. Service Provision:</strong> To provide, maintain, and improve the Services, including personalized financial insights, estate planning tools, and advisor-client matching (for Advisors).
      </p>
      <p>
        <strong>4.2. Communication:</strong> To send you service-related notifications, updates, security alerts, and respond to your inquiries.
      </p>
      <p>
        <strong>4.3. Personalization:</strong> To customize your experience, provide tailored recommendations, and improve the relevance of content and features.
      </p>
      <p>
        <strong>4.4. Security and Fraud Prevention:</strong> To detect, prevent, and address security threats, fraud, abuse, and other harmful activities.
      </p>
      <p>
        <strong>4.5. Compliance and Legal Requirements:</strong> To comply with applicable laws, regulations, legal processes, and government requests, including SEBI regulations for Advisor services.
      </p>
      <p>
        <strong>4.6. Analytics and Improvement:</strong> To analyze usage patterns, conduct research, and improve our Services, algorithms, and user experience.
      </p>
      <p>
        <strong>4.7. Business Operations:</strong> To manage our business operations, including customer support, billing, and administrative functions.
      </p>
      <p>
        <strong>4.8. Marketing (with consent):</strong> To send you promotional communications about our Services, features, and updates, subject to your marketing preferences.
      </p>

      <h3>5. Data Sharing and Disclosure</h3>
      <p>
        <strong>5.1. We do not sell your personal data to third parties.</strong>
      </p>
      <p>
        <strong>5.2. We may share your personal data with the following categories of recipients:</strong>
      </p>
      <ul>
        <li><strong>Service Providers:</strong> Third-party vendors who perform services on our behalf, such as cloud hosting providers, analytics services, email service providers, payment processors, and customer support tools, subject to strict confidentiality obligations</li>
        <li><strong>Advisors (for End Users):</strong> If you choose to connect with an Advisor through our platform, we may share relevant financial information with the selected Advisor to facilitate advisory services</li>
        <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, reorganization, or sale of assets, your data may be transferred to the acquiring entity</li>
        <li><strong>Legal Authorities:</strong> When required by law, regulation, legal process, or government request, or to protect our rights, property, or safety, or that of our users or others</li>
        <li><strong>With Your Consent:</strong> We may share your data with third parties when you have provided explicit consent for such sharing</li>
      </ul>
      <p>
        <strong>5.3. All third parties with whom we share data are contractually obligated to:</strong>
      </p>
      <ul>
        <li>Use your data only for the specified purposes</li>
        <li>Implement appropriate security measures</li>
        <li>Comply with applicable data protection laws</li>
        <li>Not disclose your data to other parties without authorization</li>
      </ul>

      <h3>6. Cookies and Tracking Technologies</h3>
      <p>
        <strong>6.1.</strong> We use cookies, web beacons, pixel tags, and similar technologies to collect information about your interactions with the Services.
      </p>
      <p>
        <strong>6.2. Types of Cookies We Use:</strong>
      </p>
      <ul>
        <li><strong>Essential Cookies:</strong> Required for the Services to function properly</li>
        <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Services</li>
        <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
        <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements (with your consent)</li>
      </ul>
      <p>
        <strong>6.3.</strong> You can control cookies through your browser settings. However, disabling certain cookies may limit your ability to use some features of the Services.
      </p>

      <h3>7. Data Security</h3>
      <p>
        <strong>7.1.</strong> We implement reasonable security practices and procedures in accordance with the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, to protect your personal data from unauthorized access, disclosure, alteration, or destruction.
      </p>
      <p>
        <strong>7.2. Security Measures Include:</strong>
      </p>
      <ul>
        <li>Encryption of data in transit and at rest using industry-standard protocols</li>
        <li>Access controls and authentication mechanisms</li>
        <li>Regular security assessments and vulnerability testing</li>
        <li>Employee training on data protection and security</li>
        <li>Incident response procedures</li>
        <li>Secure data centers and infrastructure</li>
      </ul>
      <p>
        <strong>7.3.</strong> Despite our security measures, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security of your data.
      </p>
      <p>
        <strong>7.4.</strong> In the event of a data breach that may affect your personal data, we will notify you and relevant authorities as required by applicable law, including the DPDPA.
      </p>

      <h3>8. Data Retention</h3>
      <p>
        <strong>8.1.</strong> We retain your personal data only for as long as necessary to fulfill the purposes outlined in this Policy, unless a longer retention period is required or permitted by law.
      </p>
      <p>
        <strong>8.2. Retention Periods:</strong>
      </p>
      <ul>
        <li><strong>Account Data:</strong> Retained while your account is active and for a reasonable period after account closure to comply with legal obligations</li>
        <li><strong>Financial Information:</strong> Retained as necessary to provide Services and comply with legal and regulatory requirements</li>
        <li><strong>Legal and Compliance Records:</strong> Retained as required by applicable laws, including tax and financial regulations</li>
        <li><strong>Marketing Data:</strong> Retained until you withdraw consent or opt out</li>
      </ul>
      <p>
        <strong>8.3.</strong> Upon expiration of the retention period, we will securely delete or anonymize your personal data in accordance with our data disposal procedures.
      </p>

      <h3>9. Your Rights Under Indian Law</h3>
      <p>
        Under the Digital Personal Data Protection Act, 2023, and other applicable Indian laws, you have the following rights regarding your personal data:
      </p>
      <p>
        <strong>9.1. Right to Access:</strong> You may request access to your personal data and information about how we process it.
      </p>
      <p>
        <strong>9.2. Right to Correction:</strong> You may request correction of inaccurate or incomplete personal data.
      </p>
      <p>
        <strong>9.3. Right to Erasure:</strong> You may request deletion of your personal data, subject to our legal and contractual obligations.
      </p>
      <p>
        <strong>9.4. Right to Withdraw Consent:</strong> You may withdraw your consent for processing personal data at any time, where processing is based on consent.
      </p>
      <p>
        <strong>9.5. Right to Data Portability:</strong> You may request a copy of your personal data in a structured, machine-readable format.
      </p>
      <p>
        <strong>9.6. Right to Grievance Redressal:</strong> You may file a complaint with us or the relevant data protection authority regarding our data processing practices.
      </p>
      <p>
        <strong>9.7.</strong> To exercise these rights, please contact us at <a href="mailto:admin@getzoro.com" className="text-blue-600 dark:text-blue-400 hover:underline">admin@getzoro.com</a>. We will respond to your request within the timeframes prescribed by applicable law.
      </p>

      <h3>10. Children's Privacy</h3>
      <p>
        <strong>10.1.</strong> The Services are not intended for individuals under the age of 18. We do not knowingly collect personal data from children under 18.
      </p>
      <p>
        <strong>10.2.</strong> If we become aware that we have collected personal data from a child under 18 without parental consent, we will take steps to delete such information promptly.
      </p>
      <p>
        <strong>10.3.</strong> If you are a parent or guardian and believe your child has provided us with personal data, please contact us immediately.
      </p>

      <h3>11. International Data Transfers</h3>
      <p>
        <strong>11.1.</strong> Your personal data may be transferred to and processed in countries other than India, including countries that may not have the same data protection laws as India.
      </p>
      <p>
        <strong>11.2.</strong> When we transfer your data internationally, we ensure appropriate safeguards are in place, including contractual clauses and security measures, to protect your data in accordance with this Policy and applicable Indian laws.
      </p>

      <h3>12. Changes to This Privacy Policy</h3>
      <p>
        <strong>12.1.</strong> We may update this Privacy Policy from time to time to reflect changes in our practices, services, or legal requirements.
      </p>
      <p>
        <strong>12.2.</strong> Material changes will be notified to you through the Services, email, or other prominent means.
      </p>
      <p>
        <strong>12.3.</strong> Your continued use of the Services after such changes constitutes your acceptance of the updated Policy.
      </p>
      <p>
        <strong>12.4.</strong> We encourage you to review this Policy periodically to stay informed about how we protect your personal data.
      </p>

      <h3>13. Compliance with Indian Laws</h3>
      <p>
        This Privacy Policy is designed to comply with applicable Indian data protection laws, including:
      </p>
      <ul>
        <li>The Information Technology Act, 2000</li>
        <li>The Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</li>
        <li>The Digital Personal Data Protection Act, 2023</li>
        <li>Any other applicable data protection regulations issued by Indian authorities</li>
      </ul>

      <h3>14. Contact Information</h3>
      <p>
        For any questions, concerns, requests, or complaints regarding this Privacy Policy or our data practices, please contact us:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:admin@getzoro.com" className="text-blue-600 dark:text-blue-400 hover:underline">admin@getzoro.com</a>
      </p>
      <p>
        <strong>Zoro</strong><br />
        Mumbai, Maharashtra, India
      </p>
      <p>
        <strong>Grievance Officer:</strong> As required under the Information Technology Act, 2000, we have appointed a Grievance Officer. For any grievances related to data protection, please contact the Grievance Officer at the email address above.
      </p>
    </>
  );
}

