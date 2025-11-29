import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import "./globals.css";

// Only enable analytics in production
const isProduction = process.env.NODE_ENV === 'production' && 
                     process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zoro - Your AI Financial Advisor",
  description: "Zoro analyzes your finances, plans your estate, and gives you instant AI-powered insights. Always transparent. Always your decision.",
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
        <AnalyticsProvider>
          {children}
        </AnalyticsProvider>
        {isProduction && <Analytics />}
      </body>
    </html>
  );
}
