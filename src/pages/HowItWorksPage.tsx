import React, { useState } from 'react';
import { UserCheck, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface HowItWorksPageProps {
  onRegisterClient: () => void;
  onRegisterCompanion: () => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({
  onRegisterClient,
  onRegisterCompanion
}) => {
  const [activeTab, setActiveTab] = useState<'client' | 'companion'>('client');

  const clientSteps = [
    {
      num: 1,
      title: "Create Account",
      desc: "Register using your mobile number and password and complete secure OTP verification."
    },
    {
      num: 2,
      title: "Complete Profile & KYC",
      desc: "Submit basic details, identity documents and selfie. Account activation requires Admin verification."
    },
    {
      num: 3,
      title: "Discover Companions",
      desc: "Discover Companions using location, interests, preferred services, availability and budget."
    },
    {
      num: 4,
      title: "Choose Your Companion",
      desc: "View Companion profiles, photos, introductions, selected services and pricing."
    },
    {
      num: 5,
      title: "Select Your Booking",
      desc: "Choose date, time and duration, submit a booking request and complete secure payment."
    },
    {
      num: 6,
      title: "Meet & Enjoy",
      desc: "Access confirmed booking details, Secure Chat, location navigation and meeting OTP verification."
    },
    {
      num: 7,
      title: "Complete Booking",
      desc: "Complete final verification and provide feedback."
    }
  ];

  const companionSteps = [
    {
      num: 1,
      title: "Register as a Companion",
      desc: "Register using mobile number and password and verify OTP."
    },
    {
      num: 2,
      title: "Complete Profile & KYC",
      desc: "Submit legal details, identity documents, selfie, profile photos and introduction for Admin review."
    },
    {
      num: 3,
      title: "Select Services",
      desc: "Select the services offered."
    },
    {
      num: 4,
      title: "Set Rates & Availability",
      desc: "Set hourly, half-day and full-day rates and available days/hours."
    },
    {
      num: 5,
      title: "Activate Membership",
      desc: "Select a membership plan and pay securely through PairUp Secure Vault."
    },
    {
      num: 6,
      title: "Complete Bank Verification",
      desc: "Complete the required bank verification."
    },
    {
      num: 7,
      title: "Get Approved & Go Live",
      desc: "Go LIVE only after KYC approval, valid paid membership and successful bank verification."
    },
    {
      num: 8,
      title: "Receive & Manage Bookings",
      desc: "Receive requests, accept bookings according to availability and prevent overlapping bookings."
    },
    {
      num: 9,
      title: "Meet Clients Safely",
      desc: "Use Secure Chat, location navigation and meeting OTP."
    },
    {
      num: 10,
      title: "Complete Bookings & Earn",
      desc: "Complete booking verification and record earnings, fees and settlement details."
    }
  ];

  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* EXACT Heading & Intro */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            How PairUpToday Works
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Discover a simpler way to find the right companion or turn your time into an earning opportunity. PairUpToday brings people together for trusted companionship and meaningful experiences.
          </p>
        </div>

        {/* Tab switch between Client and Companion */}
        <div className="flex items-center justify-center mb-12">
          <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 flex gap-2">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'client'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              For Clients (100% Free)
            </button>
            <button
              onClick={() => setActiveTab('companion')}
              className={`px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'companion'
                  ? 'bg-pink-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              For Companions (Earn & Host)
            </button>
          </div>
        </div>

        {/* A. How It Works for Clients */}
        {activeTab === 'client' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-amber-300">
                  A. How It Works for Clients
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  7 straightforward steps to finding your ideal companion safely.
                </p>
              </div>
              <button
                onClick={onRegisterClient}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all"
              >
                Sign In as Client
              </button>
            </div>

            <div className="space-y-4">
              {clientSteps.map(step => (
                <div
                  key={step.num}
                  className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4 hover:border-amber-400/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 font-bold flex items-center justify-center shrink-0 text-sm">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* EXACT Client Tagline */}
            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-amber-950/20 via-slate-900 to-amber-950/20 border border-amber-500/20 text-center">
              <span className="text-base sm:text-lg font-bold text-amber-300 tracking-wide">
                Your time. Your choice. Your perfect companion.
              </span>
            </div>
          </div>
        )}

        {/* B. How It Works for Companions */}
        {activeTab === 'companion' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-pink-400">
                  B. How It Works for Companions
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  10 comprehensive steps to onboard, activate, and receive 85% net earnings safely.
                </p>
              </div>
              <button
                onClick={onRegisterCompanion}
                className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-slate-950 text-xs font-bold transition-all"
              >
                Join as Companion
              </button>
            </div>

            <div className="space-y-4">
              {companionSteps.map(step => (
                <div
                  key={step.num}
                  className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-4 hover:border-pink-500/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 font-bold flex items-center justify-center shrink-0 text-sm">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* EXACT Companion Tagline */}
            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-pink-950/20 via-slate-900 to-pink-950/20 border border-pink-500/20 text-center">
              <span className="text-base sm:text-lg font-bold text-pink-400 tracking-wide">
                Your time. Your skills. Your earning opportunity.
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
