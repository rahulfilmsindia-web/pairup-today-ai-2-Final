import { createClient } from '@supabase/supabase-js';

// Supabase client for server-side operations
// Uses service role key for full backend access
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase URL or Service Role Key not configured. Database operations will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Type-safe query helpers
export const db = {
  users: () => supabase.from('users'),
  kycSubmissions: () => supabase.from('kyc_submissions'),
  companionProfiles: () => supabase.from('companion_profiles'),
  companionMemberships: () => supabase.from('companion_memberships'),
  bankVerifications: () => supabase.from('bank_verifications'),
  bookings: () => supabase.from('bookings'),
  walletLedger: () => supabase.from('wallet_ledger'),
  payouts: () => supabase.from('payouts'),
  chatConversations: () => supabase.from('chat_conversations'),
  chatMessages: () => supabase.from('chat_messages'),
  supportConversations: () => supabase.from('support_conversations'),
  supportMessages: () => supabase.from('support_messages'),
  adminUsers: () => supabase.from('admin_users'),
  adminMfaStore: () => supabase.from('admin_mfa_store'),
  auditLogs: () => supabase.from('audit_logs'),
  notifications: () => supabase.from('notifications'),
  paymentWebhookEvents: () => supabase.from('payment_webhook_events')
};

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}
