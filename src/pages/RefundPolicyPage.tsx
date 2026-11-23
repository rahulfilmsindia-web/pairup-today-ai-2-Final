import React from 'react';
import { CreditCard, Clock, RotateCcw, AlertTriangle, ShieldCheck, Mail, CheckCircle2, XCircle } from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
            <RotateCcw className="w-3.5 h-3.5" />
            Official Refund &amp; Cancellation Policy
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            Refund &amp; Cancellation Policy – Pairup Today
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Last Updated: November 23, 2026
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mx-auto mt-4 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            We understand that plans can change unexpectedly. Pairup Today operates a transparent, fair refund and cancellation policy for both clients and companions.
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
                1. Client Cancellation Slabs
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>More than 12 Hours</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">100% Full Refund:</strong> Cancel more than 12 hours before the scheduled session start time for a 100% full refund of the booking amount.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>3 to 12 Hours</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">50% Refund:</strong> Cancel between 3 and 12 hours before the scheduled time to receive a 50% refund of the booking amount.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2 font-bold text-rose-400 mb-1">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Less than 3 Hours</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">No Refund (0%):</strong> Cancellations made less than 3 hours prior to the scheduled start time are non-refundable (the booking amount is forfeited).
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Client & Companion No-Show */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                2. No-Show Policies
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">Client No-Show:</strong> If a client fails to arrive at the designated booking location at the scheduled time without prior cancellation (and the Start OTP is not verified), no refund will be issued, and the amount will be forfeited to compensate the companion. Repeated no-shows may lead to account suspension.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">Companion No-Show Penalty &amp; Full Refund:</strong> If the companion fails to arrive at the designated booking location at the scheduled time without reasonable justification: (1) The client will immediately receive a 100% full refund of the booking amount. (2) The companion will be subject to monetary penalties (deducted from wallet/future payouts) and/or temporary or permanent account suspension.</span>
              </li>
            </ul>
          </div>

          {/* Section 3: Early Departure & Platform Errors */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                3. Early Departure &amp; Technical Errors
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">Early Departure or Dissatisfaction:</strong> If a session ends earlier than the booked duration upon mutual agreement or due to client preference, no partial refund will be provided. If ended due to misconduct or rule violation, the incident will be reviewed by support before determining refund eligibility.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">Technical or Platform Errors:</strong> If an amount is debited but the booking is not confirmed due to network or gateway failure, the full amount will be automatically refunded within 48 hours.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">Non-Refundable Items:</strong> One-time profile verification fees or premium membership charges (if applicable) are non-refundable once the verification process has begun.</span>
              </li>
            </ul>
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
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
              Approved refunds are initiated immediately and credited back to the original payment source:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>UPI:</strong> 1–5 business days</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Net Banking:</strong> 3–5 business days</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong>Credit / Debit Cards:</strong> 5–7 business days</span>
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
                5. Contact for Refund Support
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
              For any cancellation or refund queries, contact our dedicated support team:
            </p>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
              <div><strong className="text-white">Email:</strong> Support@pairuptoday.com</div>
              <div><strong className="text-white">Subject Format:</strong> "Refund Request - [Booking Code]"</div>
              <div><strong className="text-white">Response Time:</strong> Within 12–24 business hours</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
