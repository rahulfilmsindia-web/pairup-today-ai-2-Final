import React from 'react';
import { Shield, Lock, Eye, FileText, Database, UserCheck, Bell, Mail } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs font-semibold mb-4 border border-pink-500/20">
            <Lock className="w-3.5 h-3.5" />
            DPDP Act (India) 2023 Compliant
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            Privacy Policy – PairUpToday
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Last Updated: November 22, 2026
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mx-auto mt-4 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            At PairUpToday ("we," "our," or "us"), we are deeply committed to protecting your personal data, identity, and privacy. This Privacy Policy outlines how we collect, process, store, and safeguard your data in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000 of India.
          </p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-8">

          {/* Section 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                1. Information We Collect
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Account Credentials:</strong> Mobile phone number, secure hashed password credentials, and session tokens issued upon SMS OTP verification.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Identity &amp; KYC Records:</strong> Government photo ID (Aadhaar, PAN, Passport, Voter ID) uploaded strictly for identity verification and anti-fraud safety. KYC documents are stored in private encrypted storage and never exposed to other users or search engines.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Profile Details:</strong> Public display name, age, city, bio, companion hourly rates, services offered, and optional public photographs.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Transactional &amp; Escrow Logs:</strong> Razorpay payment order IDs, payment statuses, and 48-hour escrow transaction identifiers. We do not store complete credit card or debit card numbers on our servers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Geolocation:</strong> Approximate city or GPS coordinates provided with your explicit browser consent solely for displaying nearby companions and distance calculations.</span>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                2. How We Use Your Data
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>To facilitate verified, safe connections between clients and companion hosts for approved platonic activities.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>To verify identity, age compliance (18+), and prevent bad actors, impersonation, or fraudulent behavior.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>To deliver essential transactional SMS alerts, booking confirmations, and dual Start/Finish OTPs.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>To process secure payments, platform service splits (85% companion, 15% platform), and companion bank payouts.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">Zero Selling:</strong> We NEVER sell, rent, or trade your personal information or contact details to third-party advertisers or data brokers.</span>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                3. Data Security &amp; Encryption
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We employ military-grade AES-256 and scrypt cryptographic standards to protect your passwords and sensitive fields. All web traffic between your device and our servers is encrypted using modern TLS 1.3 protocol. Access to administrative moderation tools is strictly restricted to authenticated personnel with multi-factor authentication (MFA) and granular audit logging.
            </p>
          </div>

          {/* Section 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                4. Your Rights Under DPDP Act 2023
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">Right to Access &amp; Summary:</strong> You may request a copy of the personal information stored in your account at any time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">Right to Correction &amp; Erasure:</strong> You can update your profile information directly from your dashboard or request permanent deletion of your account and associated records.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">Right to Grievance Redressal:</strong> In case of questions or concerns regarding your privacy, you can contact our designated Data Protection Officer.</span>
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                5. Contact &amp; Grievance Officer
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
              If you have any questions, feedback, or wish to exercise your rights under Indian privacy regulations, please reach out to us at:
            </p>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
              <div><strong className="text-white">Organization:</strong> PairUpToday</div>
              <div><strong className="text-white">Email:</strong> Support@pairuptoday.com</div>
              <div><strong className="text-white">Jurisdiction:</strong> Kolkata, West Bengal, India</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
