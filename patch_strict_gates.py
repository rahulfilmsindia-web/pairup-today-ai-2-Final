#!/usr/bin/env python3
"""
patch_strict_gates.py
Patches CompanionDashboard.tsx in ~/pairup-today-prod to enforce strict
isolated gate screens when membership or bank verification is incomplete.
Run from Cloud Shell: python3 patch_strict_gates.py
"""

import os, sys, shutil, re, datetime

TARGET = os.path.expanduser(
    '~/pairup-today-prod/src/pages/CompanionDashboard.tsx'
)

BACKUP = TARGET + '.bak_gates_' + datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%S')

if not os.path.isfile(TARGET):
    print(f'ERROR: file not found: {TARGET}')
    sys.exit(1)

with open(TARGET, 'r', encoding='utf-8') as f:
    src = f.read()

shutil.copy2(TARGET, BACKUP)
print(f'Backup written: {BACKUP}')

# ───────────────────────────────────────────────────────────────────────────────
# STEP 1: Remove the old auto-navigation ref block from fetchCompanionStatus.
#         (The ref-based auto-nav inside fetchCompanionStatus is no longer
#          needed because the early-return gates fully replace it.)
# ───────────────────────────────────────────────────────────────────────────────
OLD_AUTO_NAV = r"""
        // Automatic smart gate navigation on initial companion portal entry
        if (!hasAutoNavigatedRef.current) {
          hasAutoNavigatedRef.current = true;
          const membershipValid = Boolean(
            data.conditions?.membershipValid ?? data.profile?.membership?.isActive
          );
          const bankVerified = Boolean(
            data.conditions?.bankVerified ?? data.profile?.bankDetails?.isVerified
          );

          if (!membershipValid) {
            // Gate 2: Membership unpaid -> open membership page
            setActiveTab('membership');
          } else if (!bankVerified) {
            // Gate 2 paid, Gate 3: Bank verification remaining -> open bank verify page
            setActiveTab('bank');
          } else {
            // All verified -> direct login to overview according to previous flow
            setActiveTab('overview');
          }
        }"""

NEW_AUTO_NAV = ""  # Remove entirely; gates handle routing via early return

if OLD_AUTO_NAV.strip() in src.replace('\r\n', '\n'):
    src = src.replace('\r\n', '\n').replace(OLD_AUTO_NAV.strip(), NEW_AUTO_NAV)
    print('Step 1 OK: Removed old auto-navigation ref block from fetchCompanionStatus.')
else:
    # Try a relaxed match ignoring leading whitespace differences
    pattern = re.compile(
        r'// Automatic smart gate navigation.*?setActiveTab\([\'"]overview[\'"]\);\s*\}',
        re.DOTALL
    )
    if pattern.search(src):
        src = pattern.sub('', src)
        print('Step 1 OK (relaxed match): Removed old auto-nav block.')
    else:
        print('Step 1 SKIP: Old auto-nav block not found (may already be clean).')

# ───────────────────────────────────────────────────────────────────────────────
# STEP 2: Insert the two isolated gate early-return blocks right before the
#         main `return (` statement of the component (after all state
#         declarations and the loading spinner early-return).
# ───────────────────────────────────────────────────────────────────────────────

GATE_BLOCKS = r"""
  // ─────────────────────────────────────────────────────────────────────────────
  // GATE 2: Membership not yet paid -> show ONLY the isolated Membership screen.
  // Dashboard tabs, sidebar, and all other content are completely hidden.
  // ─────────────────────────────────────────────────────────────────────────────
  if (!conditions.membershipValid) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Minimal top bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-pink-400 text-sm tracking-wide">PairUpToday</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-semibold">
              Companion Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{user?.legalName}</p>
              <p className="text-[11px] text-slate-500">{user?.phone}</p>
            </div>
            <button
              onClick={() => { if (window.confirm('Log out of PairUpToday?')) logout(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Activation progress steps */}
        <div className="max-w-3xl mx-auto w-full px-4 pt-8 pb-2">
          <div className="flex items-center gap-2 text-xs mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>KYC Submitted</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold animate-pulse">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Membership Required &larr;</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 font-semibold">
              <Landmark className="w-3.5 h-3.5" />
              <span>Bank Verification</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-extrabold text-slate-100 mb-1">Choose Your Membership Plan</h2>
            <p className="text-slate-400 text-xs max-w-md mx-auto">
              A paid membership is mandatory before you can receive bookings. Select a plan below to activate your Companion profile on PairUp Verified Network.
            </p>
          </div>

          {actionMsg && (
            <div className="mb-4 p-3 rounded-xl bg-pink-500/10 border border-pink-500/30 text-xs text-pink-300 flex items-center justify-between">
              <span>{actionMsg}</span>
              <button onClick={() => setActionMsg(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Starter</span>
                <div className="text-2xl font-extrabold text-amber-400 my-2">&#8377;449 <span className="text-xs font-normal text-slate-400">/ 1 month</span></div>
                <ul className="text-[11px] text-slate-400 space-y-1.5 mt-3">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 30 days active hosting profile</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Listed on PairUp Verified Network</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 85% gross earning share</li>
                </ul>
              </div>
              <button onClick={() => handleSubscribePlan('STARTER')} disabled={subscribingPlan !== null} className="mt-5 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold disabled:opacity-60 transition-colors">
                {subscribingPlan === 'STARTER' ? 'Processing...' : 'Subscribe STARTER'}
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border-2 border-pink-500/60 flex flex-col justify-between shadow-xl shadow-pink-500/10 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950">MOST POPULAR</span>
              </div>
              <div>
                <span className="text-xs uppercase font-bold text-pink-400">Professional</span>
                <div className="text-2xl font-extrabold text-amber-400 my-2">&#8377;1,099 <span className="text-xs font-normal text-slate-400">/ 3 months</span></div>
                <ul className="text-[11px] text-slate-400 space-y-1.5 mt-3">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 90 days active hosting</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Priority discovery placement</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 85% gross earning share</li>
                </ul>
              </div>
              <button onClick={() => handleSubscribePlan('PROFESSIONAL')} disabled={subscribingPlan !== null} className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-slate-950 font-extrabold disabled:opacity-60 transition-colors">
                {subscribingPlan === 'PROFESSIONAL' ? 'Processing...' : 'Subscribe PROFESSIONAL'}
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-pink-500/50 transition-colors">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Premium</span>
                <div className="text-2xl font-extrabold text-amber-400 my-2">&#8377;5,999 <span className="text-xs font-normal text-slate-400">/ 1 year</span></div>
                <ul className="text-[11px] text-slate-400 space-y-1.5 mt-3">
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> 365 days unlimited hosting</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> VIP verification badge</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> Zero renewal interruption</li>
                </ul>
              </div>
              <button onClick={() => handleSubscribePlan('PREMIUM')} disabled={subscribingPlan !== null} className="mt-5 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold disabled:opacity-60 transition-colors">
                {subscribingPlan === 'PREMIUM' ? 'Processing...' : 'Subscribe PREMIUM'}
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-600 mt-6">
            All payments are processed securely via Razorpay. Your profile will be activated immediately after payment confirmation.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GATE 3: Membership paid, but Bank Verification not done.
  // Dashboard tabs and sidebar are completely hidden.
  // ─────────────────────────────────────────────────────────────────────────────
  if (!conditions.bankVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-pink-400 text-sm tracking-wide">PairUpToday</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-semibold">Companion Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{user?.legalName}</p>
              <p className="text-[11px] text-slate-500">{user?.phone}</p>
            </div>
            <button onClick={() => { if (window.confirm('Log out of PairUpToday?')) logout(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors">
              <LogOut className="w-3.5 h-3.5" /><span>Logout</span>
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full px-4 pt-8 pb-2">
          <div className="flex items-center gap-2 text-xs mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /><span>KYC Submitted</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /><span>Membership Active</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold animate-pulse">
              <Landmark className="w-3.5 h-3.5" /><span>Bank Required &larr;</span>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-300">Membership Plan Active &mdash; {statusData?.profile?.membership?.plan || 'Plan'} &#10003;</p>
              <p className="text-[11px] text-slate-400">{statusData?.profile?.membership?.expiryDate ? 'Valid until ' + new Date(statusData.profile.membership.expiryDate).toLocaleDateString() : 'Your membership is active and paid.'}</p>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold text-slate-100 mb-1">Verify Your Bank Account</h2>
            <p className="text-slate-400 text-xs max-w-md mx-auto">One final step - add your bank details to receive earnings from completed sessions.</p>
          </div>

          {bankMsg && (
            <div className={`mb-4 p-3 rounded-xl border text-xs ${bankMsg.includes('success') || bankMsg.includes('verified') ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-200'}`}>{bankMsg}</div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-5">
              <Landmark className="w-4 h-4 text-sky-400" />Bank Account Details (Gate 3)
            </h3>
            <form onSubmit={handleVerifyBank} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Account Holder Legal Name</label>
                <input type="text" value={accountHolderName} onChange={e => setAccountHolderName(e.target.value)} placeholder="Full name as printed in passbook" className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:border-pink-500 outline-none" required />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Bank Name</label>
                <select value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:border-pink-500 outline-none">
                  {['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Mahindra Bank','Punjab National Bank','Bank of Baroda','Canara Bank','Union Bank of India','IndusInd Bank','Yes Bank','IDFC First Bank','Federal Bank','South Indian Bank','Other'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Bank Account Number</label>
                <input type="password" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Enter 9 to 18 digit account number" className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:border-pink-500 outline-none" required />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">IFSC Code</label>
                <input type="text" value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono focus:border-pink-500 outline-none" required />
              </div>
              <button type="submit" disabled={bankSubmitting} className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold disabled:opacity-60 transition-colors">
                {bankSubmitting ? 'Verifying Account...' : 'Submit Bank Verification'}
              </button>
            </form>
          </div>
          <p className="text-center text-[11px] text-slate-600 mt-4">Your bank details are secured with 256-bit encryption via PairUp Verified Network.</p>
        </div>
      </div>
    );
  }

  // All 3 gates satisfied -> render full Companion Dashboard below.

"""

# Insert gate blocks just before the final `  return (` of the component
# (the one after all early returns are done).
ANCHOR = '  return (\n    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-8">'

if ANCHOR in src:
    src = src.replace(ANCHOR, GATE_BLOCKS + ANCHOR, 1)
    print('Step 2 OK: Inserted Gate 2 & Gate 3 isolated early-return blocks.')
else:
    print('Step 2 SKIP: Anchor not found. File may already be patched or structure changed.')
    print('  Inspect the file manually and ensure the final return() starts with the expected wrapper div.')

# ───────────────────────────────────────────────────────────────────────────────
# Write patched file
# ───────────────────────────────────────────────────────────────────────────────
with open(TARGET, 'w', encoding='utf-8') as f:
    f.write(src)

print(f'\nPatch complete. File written: {TARGET}')
print('Run:  cd ~/pairup-today-prod && npm run build && npm run build:admin')
print('Then build and push the Docker image to Cloud Run.')
