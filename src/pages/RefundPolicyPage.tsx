import React from 'react';
import { CreditCard, Clock, RotateCcw, AlertTriangle, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
            <RotateCcw className="w-3.5 h-3.5" />
            48-Hour Escrow Protection
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            Refund &amp; Cancellation Policy – PairUpToday
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Last Updated: November 22, 2026
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mx-auto mt-4 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            PairUpToday operates an automated 48-Hour Escrow Protection model for all paid bookings. Client payments are securely held in escrow until the meeting is completed and validated via cryptographic Start &amp; Finish OTPs. Below is our transparent cancellation and refund process.
          </p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-8">

          {/* Section 1: Client Cancellation Rules */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                1. Client Cancellation Tiers
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>More than 2 Hours Before Slot</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">100% Full Refund:</strong> If you cancel your booking at least 2 hours before the scheduled start time, the entire booking fee is refunded with zero cancellation penalty.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Within 2 Hours of Scheduled Slot</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Partial Companion Compensation:</strong> Late cancellations within 2 hours incur a 30% slot reservation fee paid directly to the companion to compensate for reserved travel and preparation time. The remaining 70% is refunded to your source payment method.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Companion Cancellation & No-Show */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                2. Companion Cancellation or No-Show
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">100% Immediate Refund to Client:</strong> If a companion cancels the booking or fails to arrive at the agreed location within 15 minutes of the start time without mutual agreement, the client receives an automatic 100% full refund.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">Companion Reliability Penalty:</strong> Repeated cancellations or unexcused no-shows by companions result in profile suspension and forfeiture of platform membership privileges.</span>
              </li>
            </ul>
          </div>

          {/* Section 3: 48-Hour Escrow & Dispute Resolution */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                3. 48-Hour Escrow Lock &amp; Dispute Period
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Companion payouts are locked in escrow for 48 hours following completion of the booking. If any safety violation, improper conduct, early departure, or service discrepancy occurred, either party can file an incident report from their dashboard within this 48-hour window. Our Trust &amp; Safety team investigates all evidence and mediates fair resolution or refund prior to releasing funds.
            </p>
          </div>

          {/* Section 4: Refund Processing Timelines */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                4. Refund Processing Timelines
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>Refunds are initiated back to the original payment source (UPI, Debit Card, Credit Card, Net Banking) via our payment gateway partner Razorpay.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>UPI refunds typically credit within 24–48 hours. Credit card, debit card, and net banking refunds are credited within 5 to 7 business days according to your bank's clearing cycle.</span>
              </li>
            </ul>
          </div>

          {/* Section 5: Support & Claims */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                5. Refund Assistance
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
              Need assistance with a cancelled booking or pending refund? Our dedicated support team is available to assist you:
            </p>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
              <div><strong className="text-white">Email:</strong> support@pairuptoday.com</div>
              <div><strong className="text-white">Subject Format:</strong> "Refund Request - [Booking Code]"</div>
              <div><strong className="text-white">Response Time:</strong> Within 12–24 business hours</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
