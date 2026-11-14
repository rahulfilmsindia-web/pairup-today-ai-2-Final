import React from 'react';
import { ShieldCheck, Scale, FileText, AlertCircle, HeartHandshake, UserCheck, CreditCard, Lock } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs font-semibold mb-4 border border-pink-500/20">
            <FileText className="w-3.5 h-3.5" />
            Official Platform Policy
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            Terms of Service – Pairup Today
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Last Updated: November 14, 2026
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mx-auto mt-4 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            Welcome to Pairup Today ("we," "our," or "us"). Pairup Today is a platform that connects clients with verified companions for platonic social interactions, activities, and friendly company ("Service"). By registering, booking, or providing services on Pairup Today, you agree to be legally bound by these Terms of Service ("Terms").
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">

          {/* Section 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                1. Nature of Service & Strict Anti-Escort Policy
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Platonic Companionship Only:</strong> Pairup Today is strictly a platform for platonic, friendly, and social companionship (such as dining, attending events, conversations, or sightseeing).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">No Escort or Adult Services:</strong> Pairup Today strictly does NOT provide escort, dating, sexual, or adult services of any kind.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 font-bold">•</span>
                <span><strong className="text-slate-100">Zero Tolerance & Legal Action:</strong> Any solicitation, promotion, or engagement in sexual favors, human trafficking, fraud, or any illegal activity is strictly forbidden. Any user or companion found violating this rule will face immediate permanent account termination and strict legal action under the applicable laws of India (including reporting to law enforcement authorities).</span>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                2. Eligibility, Voluntary Participation & Verification
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">Voluntary Registration & Free Will:</strong> Both clients and companions confirm that they are registering, using our platform, and offering or booking services entirely of their own free will and voluntary choice. We have not forced, coerced, misled, or lured any individual through false promises or inducements to join or use this Service.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">Age Requirement:</strong> Both clients and companions must be at least 18 years old to use Pairup Today.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span><strong className="text-slate-100">Mandatory Verification:</strong> Users must provide accurate personal details and valid government-issued ID proof when requested. Fake profiles will be permanently banned.</span>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                3. Bookings, Payments & Platform Fees (15% Commission)
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">Client Payments:</strong> Clients must pay the full booking amount upfront through the Pairup Today platform to confirm a session.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">Companion Payouts & 15% Platform Fee:</strong> We deduct a 15% platform service fee from the total booking amount earned by the companion. The remaining 85% will be credited to the companion’s registered payout account upon successful completion of the booking.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">No Off-Platform Transactions:</strong> All bookings and payments must occur strictly within our app. Bypassing the platform to pay or accept cash or direct transfers is a breach of these Terms and will result in account suspension.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong className="text-slate-100">Activity Expenses:</strong> Unless mutually agreed otherwise, clients are responsible for their own expenses (food, tickets, travel) during in-person meetups.</span>
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-rose-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                4. Strict Cancellation, No-Show & Refund Policy
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">No Cancellation Once Accepted:</strong> Once a booking request is accepted by a companion, neither the client nor the companion is permitted to cancel the booking.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong className="text-slate-100">Client Cancellation / No-Show:</strong> If a client cancels after acceptance or fails to arrive at the booking location on time, no refund will be issued.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <div>
                  <strong className="text-slate-100">Companion No-Show Penalty & Full Refund:</strong> If the companion fails to arrive at the designated booking location at the scheduled time:
                  <ol className="list-decimal list-inside ml-4 mt-1.5 space-y-1 text-slate-300">
                    <li>The client will receive a 100% full refund of the booking amount.</li>
                    <li>The companion will be subjected to monetary fines/penalties (deducted from future payouts or security deposits) and/or temporary or permanent account suspension at our discretion.</li>
                  </ol>
                </div>
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                5. Safety & Code of Conduct
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">Public Venues Only:</strong> All in-person meetups must take place strictly in safe, public locations (e.g., cafes, restaurants, malls, parks, public events). Meetups in private homes, hotel rooms, or isolated areas are strictly prohibited.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">Mutual Respect:</strong> Both parties must maintain respectful behavior. Harassment, abusive language, intoxication, or unwanted physical contact will lead to immediate session termination and a permanent ban.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span><strong className="text-slate-100">Emergency Exit:</strong> A companion may immediately end a session if the client violates the platonic policy or behaves inappropriately, without forfeiting their payout (subject to our investigation).</span>
              </li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                6. Data Privacy & Information Security
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span><strong className="text-slate-100">Strict Confidentiality of Personal Data:</strong> All sensitive personal and financial information provided by clients and companions—including Government-issued ID proofs, phone numbers, email addresses, and bank account details—is kept strictly private and encrypted under our security protocols.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span><strong className="text-slate-100">No Unauthorized Disclosure:</strong> We do not sell, rent, or publicly display your private contact or financial details to other users or unauthorized third parties. Information is used strictly for identity verification, secure payment processing, and legal compliance under Indian law when required by law enforcement authorities.</span>
              </li>
            </ul>
          </div>

          {/* Section 7 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                7. Limitation of Liability
              </h2>
            </div>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong className="text-slate-100">Independent Companions:</strong> Companions are independent individuals, not employees of PairUp Today. We act solely as a technology facilitator.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong className="text-slate-100">Personal Responsibility:</strong> Users are solely responsible for their personal safety and interactions during meetups. PairUp Today is not liable for any personal injury, loss, damage, or disputes arising from user interactions.</span>
              </li>
            </ul>
          </div>

          {/* Section 8 */}
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-400/30 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                8. Governing Law & Jurisdiction
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-2 sm:pl-4">
              These Terms are governed by and construed in accordance with the laws of India. Any disputes, legal claims, or violations arising out of the use of PairUp Today shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
