import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeFavicon } from "@/components/ThemeFavicon";
import { DarkModeProvider } from "@/hooks/useDarkMode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Zoro | Your AI Financial Advisor",
    template: "%s | Zoro"
  },
  description: "Zoro analyzes your finances, plans your estate, and gives you instant AI-powered insights. Always transparent. Always your decision.",
  keywords: ["AI financial advisor", "financial planning", "estate planning", "personal finance", "AI insights", "financial analysis"],
  authors: [{ name: "Zoro" }],
  creator: "Zoro",
  publisher: "Zoro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://zoro.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Zoro - Your AI Financial Advisor",
    description: "Zoro analyzes your finances, plans your estate, and gives you instant AI-powered insights. Always transparent. Always your decision.",
    siteName: "Zoro",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zoro - Your AI Financial Advisor",
    description: "Zoro analyzes your finances, plans your estate, and gives you instant AI-powered insights. Always transparent. Always your decision.",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/apple-icon.png', type: 'image/png', sizes: '180x180', rel: 'apple-touch-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <DarkModeProvider>
          <ThemeFavicon />
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
