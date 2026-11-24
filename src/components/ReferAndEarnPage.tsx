import React, { useState, useEffect } from 'react';
import { 
  Users, Share2, Copy, Check, Gift, Sparkles, Crown, 
  CheckCircle2, Clock, ShieldCheck, ArrowRight, ExternalLink, HelpCircle 
} from 'lucide-react';
import { 
  getReferralStatus, 
  generateWhatsAppShareUrl, 
  ReferralStatusResponse, 
  ReferredUserItem 
} from '../services/referralService';

interface ReferAndEarnPageProps {
  user: any;
  role?: 'CLIENT' | 'COMPANION' | 'DUAL';
}

export const ReferAndEarnPage: React.FC<ReferAndEarnPageProps> = ({ user, role = 'CLIENT' }) => {
  const [data, setData] = useState<ReferralStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      getReferralStatus(user.id)
        .then(res => {
          setData(res);
        })
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  const referralCode = data?.referralCode || user?.referralCode || user?.referral_code || 'PAIRUP2026';
  const verifiedCount = data?.verifiedCount || 0;
  const currentProgress = data?.currentMilestoneProgress || (verifiedCount % 5);
  const nextTarget = data?.nextMilestoneTarget || (Math.floor(verifiedCount / 5 + 1) * 5);
  const progressPercentage = Math.min(100, (currentProgress / 5) * 100);

  const isCompanion = (role === 'COMPANION' || user?.activeRole === 'COMPANION' || user?.role === 'COMPANION');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleWhatsAppShare = () => {
    const url = generateWhatsAppShareUrl(referralCode, user?.profileName || user?.legalName);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ─── HERO HEADER ─── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-950 text-white shadow-xl relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 font-black text-[11px] uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5" />
              <span>Milestone Rewards Program</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Refer 5 Real Users & Earn
            </h2>
            <p className="text-xs sm:text-sm text-purple-200 max-w-xl leading-relaxed">
              Invite your friends to PairUpToday. Every time 5 of your referred friends genuinely join and use the platform, unlock exclusive rewards!
            </p>
          </div>

          {/* Stat Pill */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0 min-w-[120px]">
            <span className="text-[11px] uppercase font-bold text-purple-200 block">Total Verified</span>
            <span className="text-3xl font-black text-amber-400">{verifiedCount}</span>
            <span className="text-[10px] text-purple-300 font-semibold block">Friends Joined</span>
          </div>
        </div>

        {/* ─── 5-USER MILESTONE PROGRESS BAR ─── */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-purple-200">
              Progress: <strong className="text-amber-300">{currentProgress} / 5</strong> Verified Friends Joined
            </span>
            <span className="text-purple-300">
              Next Milestone: #{nextTarget}
            </span>
          </div>

          <div className="h-4 w-full bg-slate-950/60 rounded-full overflow-hidden border border-purple-500/40 p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 transition-all duration-700 shadow-sm"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <p className="text-[11px] text-purple-200/80">
            {5 - currentProgress === 0 
              ? '🎉 Milestone Achieved! Rewards have been added to your profile.' 
              : `Only ${5 - currentProgress} more verified friend${5 - currentProgress > 1 ? 's' : ''} needed to reach the next reward milestone!`}
          </p>
        </div>

        {/* Active Reward Indicators */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-800/40">
          {data?.has10PercentBookingDiscount && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>10% OFF Next Booking Active!</span>
            </span>
          )}

          {data?.hasVerifiedReferrerBadge && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Top Referrer Badge</span>
            </span>
          )}

          {data?.isBoosted && (
            <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-black flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              <span>Host Profile Boosted</span>
            </span>
          )}
        </div>
      </div>

      {/* ─── SHARE & REFERRAL CODE SECTION ─── */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-purple-600" />
          <span>Your Personal Referral Code</span>
        </h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Copyable Box */}
          <div className="flex-1 flex items-center justify-between px-5 py-3.5 bg-slate-50 border-2 border-dashed border-purple-300 rounded-2xl">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Share this code with friends</span>
              <span className="font-mono text-xl sm:text-2xl font-black text-purple-900 tracking-wider">
                {referralCode}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-black flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* WhatsApp Share Button */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="min-h-[56px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </button>
        </div>
      </div>

      {/* ─── HOW IT WORKS (STRICT ANTI-FAKE RULES) ─── */}
      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-4">
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>How Referrals Count (Anti-Fake Policy)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Rule for Companions */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 font-black text-slate-900">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>When Referring a Companion:</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Friend must complete <strong>Govt ID KYC verification</strong>, have an <strong>active membership</strong>, and go <strong>online/live</strong> on the platform.
            </p>
          </div>

          {/* Rule for Clients */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 font-black text-slate-900">
              <Users className="w-4 h-4 text-purple-600" />
              <span>When Referring a Client:</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Friend must book a verified companion and <strong>successfully complete at least 1 real in-person booking</strong>.
            </p>
          </div>
        </div>

        {/* Milestone Rewards Breakdown */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 text-xs space-y-2">
          <span className="font-extrabold text-purple-950 block">5-User Milestone Rewards:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
            <div>
              <strong className="text-purple-900 block mb-0.5">👑 For Companion Referrers:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li><strong>+30 Days Free Membership</strong> (1 Month Free)</li>
                <li><strong>15 Days Profile Boost</strong> to top of listings</li>
                <li><strong>Verified Top Referrer Badge</strong> on profile</li>
              </ul>
            </div>
            <div>
              <strong className="text-pink-900 block mb-0.5">🎁 For Client Referrers:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li><strong>10% OFF</strong> applied automatically to your next booking total at checkout!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ─── INVITED FRIENDS ACTIVITY LIST ─── */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-base font-black text-slate-900">Invited Friends Activity</h4>
            <p className="text-xs text-slate-500">Track pending and verified friends who signed up with your code.</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {data?.referralsList.length || 0} Total
          </span>
        </div>

        {(!data?.referralsList || data.referralsList.length === 0) ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No referrals recorded yet.</p>
            <p className="text-slate-400">Share your referral code on WhatsApp to invite friends and start earning!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.referralsList.map(item => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <span className="font-bold text-slate-900 truncate block">
                    {item.refereeName}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Joined as {item.role === 'companion' ? 'Companion' : 'Client'} • {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="shrink-0">
                  {item.status === 'verified_active' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-extrabold text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Verified Active</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Pending Verification</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
