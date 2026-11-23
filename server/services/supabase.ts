import { createClient } from '@supabase/supabase-js';

// Supabase client for server-side operations
// Uses service role key for full backend access
const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const isConfigured = Boolean(supabaseUrl && supabaseServiceKey);

if (process.env.NODE_ENV === 'production' && !isConfigured) {
  throw new Error('Production startup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

if (!isConfigured) {
  console.warn('Supabase URL or Service Role Key not configured; only the local-development adapter may be used.');
}

// In non-production testing/build without live credentials, initialize with placeholder to prevent module load crash.
// Any real database call will fail safely if credentials are not configured.
const activeUrl = isConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const activeKey = isConfigured ? supabaseServiceKey : 'placeholder-service-role-key-for-offline-builds';

export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Type-safe query helpers
export const db = {
  rpc: (functionName: string, args?: Record<string, unknown>) => supabase.rpc(functionName, args),
  users: () => supabase.from('users'),
  kycSubmissions: () => supabase.from('kyc_submissions'),
  companionProfiles: () => supabase.from('companion_profiles'),
  companionMemberships: () => supabase.from('companion_memberships'),
  memberships: () => supabase.from('companion_memberships'),
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
  firebaseDeviceTokens: () => supabase.from('firebase_device_tokens'),
  paymentRefunds: () => supabase.from('payment_refunds'),
  paymentWebhookEvents: () => supabase.from('payment_webhook_events'),
  userLocations: () => supabase.from('user_locations'),
  userPresence: () => supabase.from('user_presence')
};

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}
