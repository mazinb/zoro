'use client';

import React, { useState } from 'react';
import { Mail, Search, ShieldCheck } from 'lucide-react';
import { AdvisorRecord } from '@/types';
import { ZoroLogo } from '@/components/ZoroLogo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const emailRegex = /.+@.+\..+/;

export const AdvisorOnboarding: React.FC = () => {
  const [registrationNo, setRegistrationNo] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [advisor, setAdvisor] = useState<AdvisorRecord | null>(null);
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleLookup = async () => {
    setIsLookingUp(true);
    setStatusMessage('');
    const normalized = registrationNo.replace(/\s+/g, '').toUpperCase();
    try {
      const params = new URLSearchParams({ registration: normalized });
      const response = await fetch(`/api/advisors?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to search advisors');
      }
      const payload = await response.json();
      const match: AdvisorRecord | undefined = payload.data?.[0];
      if (match) {
        setAdvisor(match);
        setEmail(match.email || '');
        setLookupError('');
      } else {
        setAdvisor(null);
        setLookupError('We could not find that registration number. Please double-check and try again.');
      }
    } catch (error) {
      console.error('Advisor lookup error:', error);
      setAdvisor(null);
      setLookupError('Unable to search right now. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSendVerification = async () => {
    if (!advisor) return;
    if (!emailRegex.test(email.trim())) {
      setStatusMessage('Please enter a valid email address so we can verify you.');
      return;
    }

    setIsSendingEmail(true);
    setStatusMessage('');

    try {
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkResponse.json();

      if (checkData.exists) {
        setStatusMessage('This email already has access. Redirecting you to login...');
        setTimeout(() => {
          window.location.href = `/login?email=${encodeURIComponent(email)}&message=${encodeURIComponent('Welcome back! Please log in to continue.')}`;
        }, 1500);
        setIsSendingEmail(false);
        return;
      }

      const token = checkData.token;
      await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          name: advisor.contactPerson || advisor.name,
          goals: [],
          context: 'advisor',
          registrationNo: advisor.registrationNo,
        }),
      });

        const pendingData = {
          advisorId: advisor.id,
          registrationNo: advisor.registrationNo,
          name: advisor.name,
          email,
          token,
          expiresAt: checkData.expiresAt,
        };
        sessionStorage.setItem('pendingAdvisorOnboarding', JSON.stringify(pendingData));

        // Log for debugging (especially helpful in development)
        console.log('Advisor onboarding data saved:', {
          advisorId: advisor.id,
          registrationNo: advisor.registrationNo,
          email,
          verificationLink: `${window.location.origin}/login?email=${encodeURIComponent(email)}&token=${token}&mode=signup`,
        });

      setStatusMessage('Verification email sent! Please check your inbox to finish setting up. You will complete your advisor profile after verifying your email.');
    } catch (error) {
      console.error('Advisor verification error:', error);
      setStatusMessage('Something went wrong while sending your verification email. Please retry.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <ZoroLogo className="h-10 mx-auto" isDark={false} />
          <p className="text-sm uppercase tracking-[0.3em] text-blue-600">Advisors</p>
          <h1 className="text-4xl font-semibold">
            Bring Zoro into your practice
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Verify your SEBI registration, confirm your contact email, and get instant access to client-ready
            tools. No paperwork, no sales calls.
          </p>
        </div>

        <Card darkMode={false} className="p-8 space-y-6 border border-slate-200 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SEBI Registration number
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex items-center gap-3 flex-1 border border-slate-200 rounded-lg px-4 py-3 bg-white">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
                  placeholder="e.g. INA000017523"
                  className="flex-1 bg-transparent focus:outline-none text-slate-900"
                />
              </div>
              <Button
                variant="primary"
                darkMode={false}
                onClick={handleLookup}
                disabled={!registrationNo || isLookingUp}
                className="whitespace-nowrap"
              >
                {isLookingUp ? 'Checking…' : 'Find my record'}
              </Button>
            </div>
            {lookupError && <p className="text-sm text-red-500 mt-2">{lookupError}</p>}
          </div>

          {advisor && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                <ShieldCheck className="w-5 h-5" />
                Verified record found
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Firm name</p>
                  <p className="font-semibold text-slate-900">{advisor.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{advisor.registrationNo}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Contact person</p>
                  <p className="font-semibold text-slate-900">{advisor.contactPerson || 'Not provided yet'}</p>
                  {advisor.validity && (
                    <p className="text-xs text-slate-500 mt-1">Validity: {advisor.validity}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirmation email
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex items-center gap-3 flex-1 border border-slate-200 rounded-lg px-4 py-3 bg-white">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="compliance@example.com"
                      className="flex-1 bg-transparent focus:outline-none text-slate-900"
                    />
                  </div>
                  <Button
                    variant="primary"
                    darkMode={false}
                    onClick={handleSendVerification}
                    disabled={isSendingEmail}
                    className="whitespace-nowrap"
                    showArrow
                  >
                    {isSendingEmail ? 'Sending…' : 'Send verification link'}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  We’ll use this email for compliance notices and login. You can change it later.
                </p>
              </div>
            </div>
          )}

          {statusMessage && (
            <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              {statusMessage}
            </p>
          )}
        </Card>

        <div className="text-center">
          <Button
            variant="secondary"
            darkMode={false}
            onClick={() => {
              window.location.href = '/';
            }}
          >
            ← Back to home
          </Button>
        </div>
      </div>
    </div>
  );
};

