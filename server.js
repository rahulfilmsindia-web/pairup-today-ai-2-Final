// server.ts
import "dotenv/config";
import express from "express";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import crypto4 from "crypto";

// server/services/apitxt.ts
function isApitxtConfigured() {
  const apiKey = process.env.APITXT_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== "MY_APITXT_API_KEY");
}
function formatPhoneForApitxt(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return digits;
  }
  return null;
}
function compareLegalAndBankNames(kycName, bankName) {
  if (!kycName || !bankName) return false;
  const clean = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const kycTokens = clean(kycName);
  const bankTokens = clean(bankName);
  if (kycTokens.length === 0 || bankTokens.length === 0) return false;
  if (kycTokens.join(" ") === bankTokens.join(" ")) return true;
  const matchedTokens = kycTokens.filter((t) => bankTokens.includes(t));
  const minTokens = Math.min(kycTokens.length, bankTokens.length);
  return matchedTokens.length >= Math.max(1, Math.floor(minTokens * 0.6));
}
async function sendApitxtOtp(params) {
  const apiKey = (params.apiKey || process.env.APITXT_API_KEY || "").trim();
  const baseUrl = params.baseUrl || process.env.APITXT_BASE_URL || "https://apitxt.com";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/sendOTP`;
  const formattedMobile = formatPhoneForApitxt(params.mobile);
  if (!formattedMobile) {
    return {
      success: false,
      error: "Invalid 10-digit Indian mobile number."
    };
  }
  if (!apiKey || apiKey === "MY_APITXT_API_KEY") {
    return {
      success: false,
      error: "APITXT SMS service configuration unavailable. APITXT_API_KEY is not configured in the server environment.",
      errorCode: "CONFIG_MISSING"
    };
  }
  const bodyParams = new URLSearchParams();
  bodyParams.append("authkey", apiKey);
  bodyParams.append("mobile", formattedMobile);
  bodyParams.append("otp", params.otp.trim());
  bodyParams.append("channel", "sms");
  bodyParams.append("country", "91");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PairUpToday-Backend/1.0"
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(15e3)
    });
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `APITXT returned a non-JSON response (HTTP ${response.status}).`,
        errorCode: response.status
      };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        success: false,
        error: `APITXT returned an invalid response (HTTP ${response.status}).`,
        errorCode: response.status
      };
    }
    if (response.ok && (data.status === "success" || data.status === 200)) {
      return {
        success: true,
        requestId: typeof data.data?.request_id === "string" ? data.data.request_id : void 0,
        mobile: data.data?.mobile || formattedMobile,
        cost: data.data?.cost,
        message: typeof data.message === "string" ? data.message : void 0
      };
    }
    return {
      success: false,
      error: "APITXT did not accept the OTP request.",
      errorCode: data.code || data.status
    };
  } catch (err) {
    return {
      success: false,
      error: err?.name === "TimeoutError" ? "APITXT request timed out." : "Network connection to APITXT gateway failed."
    };
  }
}
async function verifyApitxtBankAccount(params) {
  const apiKey = params.apiKey || process.env.APITXT_API_KEY;
  const baseUrl = params.baseUrl || process.env.APITXT_BASE_URL || "https://apitxt.com";
  const cleanIfsc = (params.ifsc || "").trim().toUpperCase();
  const cleanAccount = (params.accountNumber || "").trim();
  const cleanMobile = (params.mobile || "").replace(/\D/g, "").slice(-10);
  if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6,7}$/.test(cleanIfsc)) {
    return {
      success: false,
      errorCode: 208,
      error: "Invalid IFSC code format (e.g. HDFC0001234)."
    };
  }
  if (!cleanAccount || cleanAccount.length < 6 || cleanAccount.length > 40 || !/^[A-Za-z0-9\-]+$/.test(cleanAccount)) {
    return {
      success: false,
      errorCode: 210,
      error: "Invalid bank account number format."
    };
  }
  if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
    return {
      success: false,
      errorCode: 211,
      error: "Invalid 10-digit Indian mobile number."
    };
  }
  if (!apiKey || apiKey === "MY_APITXT_API_KEY" || apiKey.trim() === "") {
    return {
      success: false,
      errorCode: 105,
      error: "Penny-less bank verification gateway unavailable. APITXT_API_KEY is not configured in the server environment."
    };
  }
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/bank/${encodeURIComponent(cleanIfsc)}/accounts/${encodeURIComponent(cleanAccount)}/penniless-verify`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PairUpToday-Backend/1.0"
      },
      body: JSON.stringify({
        authkey: apiKey.trim(),
        ifsc: cleanIfsc,
        account_number: cleanAccount,
        name: params.accountHolderName.trim(),
        mobile: cleanMobile,
        use_cache: false
      })
    });
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        errorCode: 310,
        error: `APITXT returned non-JSON response (HTTP ${response.status}): ${responseText.slice(0, 150)}`
      };
    }
    const code = Number(data.code || data.status);
    if (code === 105) {
      return { success: false, errorCode: 105, error: "Missing or unauthenticated APITXT API key." };
    }
    if (code === 109) {
      return { success: false, errorCode: 109, error: "Missing IFSC code." };
    }
    if (code === 110) {
      return { success: false, errorCode: 110, error: "Missing account number." };
    }
    if (code === 208) {
      return { success: false, errorCode: 208, error: "Invalid IFSC code supplied to bank gateway." };
    }
    if (code === 210) {
      return { success: false, errorCode: 210, error: "Invalid account number supplied." };
    }
    if (code === 211) {
      return { success: false, errorCode: 211, error: "Invalid mobile number." };
    }
    if (code === 212) {
      return { success: false, errorCode: 212, error: "Bank account not found at the destination branch." };
    }
    if (code === 213) {
      return { success: false, errorCode: 213, error: "Bank branch or institution currently not supported for penny-less inquiry." };
    }
    if (code === 301) {
      return { success: false, errorCode: 301, error: "Insufficient balance in APITXT wallet." };
    }
    if (code === 304) {
      return { success: false, errorCode: 304, error: "APITXT IP restriction or unauthorized key origin." };
    }
    if (code === 310) {
      return { success: false, errorCode: 310, error: "Vendor verification failure at banking switch." };
    }
    if ((data.status === 200 || data.status === "success") && data.data) {
      const bankData = data.data;
      if (!bankData.account_exists) {
        return {
          success: false,
          errorCode: 212,
          accountExists: false,
          error: "Bank account does not exist according to bank verification."
        };
      }
      const nameAtBank = bankData.name_at_bank || params.accountHolderName;
      let nameMatched = true;
      if (params.kycLegalName) {
        nameMatched = compareLegalAndBankNames(params.kycLegalName, nameAtBank);
        if (!nameMatched) {
          return {
            success: false,
            accountExists: true,
            nameAtBank,
            nameMatched: false,
            error: `Name on bank record ("${nameAtBank}") does not match verified KYC legal name ("${params.kycLegalName}").`
          };
        }
      }
      return {
        success: true,
        requestId: data.request_id,
        accountExists: true,
        nameAtBank,
        ifsc: bankData.ifsc || cleanIfsc,
        accountNumber: bankData.account_number || cleanAccount,
        method: bankData.method || "penny_less",
        nameMatched,
        message: "Bank account verified successfully."
      };
    }
    return {
      success: false,
      error: data.message || "Penny-less verification returned negative result from bank."
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to APITXT bank verification endpoint: ${err.message}`
    };
  }
}

// server/services/razorpay.ts
import crypto2 from "crypto";
function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret || keyId === "MY_RAZORPAY_KEY_ID" || keySecret === "MY_RAZORPAY_KEY_SECRET") {
    return null;
  }
  return { keyId, keySecret };
}
async function createRazorpayOrder(params) {
  const keyId = (params.keyId || process.env.RAZORPAY_KEY_ID)?.trim();
  const keySecret = (params.keySecret || process.env.RAZORPAY_KEY_SECRET)?.trim();
  if (!Number.isSafeInteger(params.amountPaise) || params.amountPaise <= 0) {
    return {
      success: false,
      error: "Order amount in paise must be a positive integer."
    };
  }
  if (!keyId || !keySecret || keyId === "MY_RAZORPAY_KEY_ID" || keySecret === "MY_RAZORPAY_KEY_SECRET" || keyId.trim() === "" || keySecret.trim() === "") {
    return {
      success: false,
      error: "Razorpay service configuration unavailable. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured in the server environment."
    };
  }
  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "User-Agent": "PairUpToday-Backend/1.0"
      },
      body: JSON.stringify({
        amount: params.amountPaise,
        currency: "INR",
        receipt: params.receipt,
        notes: params.notes || {}
      }),
      signal: AbortSignal.timeout(15e3)
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error?.description || "Razorpay order creation failed."
      };
    }
    if (typeof data.id !== "string" || data.amount !== params.amountPaise || data.currency !== "INR" || typeof data.receipt !== "string" || data.receipt !== params.receipt) {
      return { success: false, error: "Razorpay returned an order that did not match the requested amount and receipt." };
    }
    return {
      success: true,
      orderId: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      keyId
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to Razorpay: ${err.message}`
    };
  }
}
function verifyRazorpayPaymentSignature(params) {
  const keySecret = params.keySecret || process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret || !params.orderId || !params.paymentId || !/^[a-f0-9]{64}$/i.test(params.signature)) {
    return false;
  }
  const expectedSignature = crypto2.createHmac("sha256", keySecret).update(`${params.orderId}|${params.paymentId}`).digest("hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  const actualBuf = Buffer.from(params.signature, "hex");
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto2.timingSafeEqual(expectedBuf, actualBuf);
}
function verifyRazorpayWebhookSignature(rawBody, webhookSignature, webhookSecret) {
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !/^[a-f0-9]{64}$/i.test(webhookSignature)) return false;
  const expectedSignature = crypto2.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  const actualBuf = Buffer.from(webhookSignature, "hex");
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto2.timingSafeEqual(expectedBuf, actualBuf);
}
async function fetchRazorpayPayment(paymentId) {
  const credentials = getCredentials();
  if (!credentials) throw new Error("Razorpay verification requires configured server credentials.");
  if (!paymentId || !/^[A-Za-z0-9_]+$/.test(paymentId)) throw new Error("Invalid Razorpay payment identifier.");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}`,
      "User-Agent": "PairUpToday-Backend/1.0"
    },
    signal: AbortSignal.timeout(15e3)
  });
  const result = await response.json();
  if (!response.ok || !result || typeof result !== "object") {
    throw new Error("Razorpay payment lookup failed.");
  }
  return {
    id: result.id,
    order_id: result.order_id,
    amount: result.amount,
    currency: result.currency,
    status: result.status
  };
}
async function createRazorpayRefund(params) {
  const credentials = getCredentials();
  if (!credentials) throw new Error("Razorpay refunds require configured server credentials.");
  if (!/^[A-Za-z0-9_]+$/.test(params.paymentId) || !Number.isSafeInteger(params.amountPaise) || params.amountPaise <= 0 || !/^[A-Za-z0-9_-]{10,255}$/.test(params.idempotencyKey)) {
    throw new Error("Invalid Razorpay refund parameters.");
  }
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(params.paymentId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      "X-Refund-Idempotency": params.idempotencyKey,
      "User-Agent": "PairUpToday-Backend/1.0"
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      speed: "normal",
      notes: { reason: params.reason.slice(0, 500), idempotency_key: params.idempotencyKey }
    }),
    signal: AbortSignal.timeout(15e3)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || `Razorpay refund request failed with HTTP ${response.status}.`);
  }
  if (typeof data?.id !== "string" || data.payment_id !== params.paymentId || data.amount !== params.amountPaise || typeof data.status !== "string") {
    throw new Error("Razorpay returned a refund that did not match the requested payment and amount.");
  }
  return { id: data.id, paymentId: data.payment_id, amountPaise: data.amount, status: data.status };
}
async function fetchRazorpayPaymentRefunds(paymentId) {
  const credentials = getCredentials();
  if (!credentials) throw new Error("Razorpay refund reconciliation requires configured server credentials.");
  if (!/^[A-Za-z0-9_]+$/.test(paymentId)) throw new Error("Invalid Razorpay payment identifier.");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}`,
      "User-Agent": "PairUpToday-Backend/1.0"
    },
    signal: AbortSignal.timeout(15e3)
  });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result?.items)) {
    throw new Error("Razorpay refund reconciliation lookup failed.");
  }
  return result.items.map((item) => ({
    id: item.id,
    payment_id: item.payment_id,
    amount: item.amount,
    status: item.status,
    notes: item.notes
  }));
}

// server/services/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
var isConfigured = Boolean(supabaseUrl && supabaseServiceKey);
if (process.env.NODE_ENV === "production" && !isConfigured) {
  throw new Error("Production startup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}
if (!isConfigured) {
  console.warn("Supabase URL or Service Role Key not configured; only the local-development adapter may be used.");
}
var activeUrl = isConfigured ? supabaseUrl : "https://placeholder-project.supabase.co";
var activeKey = isConfigured ? supabaseServiceKey : "placeholder-service-role-key-for-offline-builds";
var supabase = createClient(activeUrl, activeKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
var db = {
  rpc: (functionName, args) => supabase.rpc(functionName, args),
  users: () => supabase.from("users"),
  kycSubmissions: () => supabase.from("kyc_submissions"),
  companionProfiles: () => supabase.from("companion_profiles"),
  companionMemberships: () => supabase.from("companion_memberships"),
  bankVerifications: () => supabase.from("bank_verifications"),
  bookings: () => supabase.from("bookings"),
  walletLedger: () => supabase.from("wallet_ledger"),
  payouts: () => supabase.from("payouts"),
  chatConversations: () => supabase.from("chat_conversations"),
  chatMessages: () => supabase.from("chat_messages"),
  supportConversations: () => supabase.from("support_conversations"),
  supportMessages: () => supabase.from("support_messages"),
  adminUsers: () => supabase.from("admin_users"),
  adminMfaStore: () => supabase.from("admin_mfa_store"),
  auditLogs: () => supabase.from("audit_logs"),
  notifications: () => supabase.from("notifications"),
  firebaseDeviceTokens: () => supabase.from("firebase_device_tokens"),
  paymentRefunds: () => supabase.from("payment_refunds"),
  paymentWebhookEvents: () => supabase.from("payment_webhook_events"),
  userLocations: () => supabase.from("user_locations"),
  userPresence: () => supabase.from("user_presence")
};
function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseServiceKey);
}

// server/services/database.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var DATA_DIR = path.join(__dirname, "../../data");
var DB_FILE = path.join(DATA_DIR, "pairuptoday_db.json");
var OTP_DB_FILE = path.join(DATA_DIR, "otp_challenges.json");
var ADMIN_MFA_DB_FILE = path.join(DATA_DIR, "admin_mfa_challenges.json");
var localRateLimitBuckets = /* @__PURE__ */ new Map();
var localRevokedSessions = /* @__PURE__ */ new Set();
var localWebhookEvents = /* @__PURE__ */ new Map();
function mapCompanionProfilePatchToRow(profile) {
  const fields = {
    services: "services",
    rates: "rates",
    availability: "availability",
    isLive: "is_live",
    rating: "rating",
    totalBookings: "total_bookings",
    address: "address",
    state: "state",
    latitude: "latitude",
    longitude: "longitude",
    isInitialListing: "is_initial_listing",
    isPaused: "is_paused"
  };
  const row = {};
  for (const [key, column] of Object.entries(fields)) {
    if (key in profile) row[column] = profile[key];
  }
  return row;
}
function loadJsonOtpChallenges() {
  if (!fs.existsSync(OTP_DB_FILE)) return {};
  const raw = fs.readFileSync(OTP_DB_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Local OTP challenge storage is invalid.");
  }
  return parsed;
}
function saveJsonOtpChallenges(challenges) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${OTP_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(challenges), "utf-8");
  fs.renameSync(tempPath, OTP_DB_FILE);
}
function loadJsonAdminMfaChallenges() {
  if (!fs.existsSync(ADMIN_MFA_DB_FILE)) return {};
  const parsed = JSON.parse(fs.readFileSync(ADMIN_MFA_DB_FILE, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Local administrator MFA challenge storage is invalid.");
  }
  return parsed;
}
function saveJsonAdminMfaChallenges(challenges) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${ADMIN_MFA_DB_FILE}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(challenges), "utf-8");
  fs.renameSync(tempPath, ADMIN_MFA_DB_FILE);
}
var jsonDB = null;
function loadJsonDB() {
  if (jsonDB) return jsonDB;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      jsonDB = JSON.parse(raw);
      return jsonDB;
    } catch (err) {
      console.error("Failed to parse JSON DB file", err);
    }
  }
  jsonDB = {
    users: {},
    kycSubmissions: {},
    companionProfiles: {},
    companionMemberships: {},
    bookings: {},
    companionWallets: {},
    payouts: {},
    chatMessages: {},
    adminUsers: {},
    supportConversations: {},
    supportMessages: {},
    notifications: {},
    firebaseDeviceTokens: {},
    bankVerifications: {},
    userLocations: {},
    userPresence: {},
    otpStore: {},
    adminMfaStore: {},
    auditLogs: []
  };
  return jsonDB;
}
function saveJsonDB(state) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  try {
    const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error("Failed to write JSON DB file", err);
  }
}
function uuidOrUndefined(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : void 0;
}
function mapKycSubmissionToRow(submission) {
  return {
    ...uuidOrUndefined(submission.id) ? { id: submission.id } : {},
    user_id: submission.userId,
    submission_role: submission.userType || submission.submissionRole,
    legal_name: submission.legalName,
    dob: submission.dob,
    id_type: submission.idType,
    id_reference: submission.idReference || null,
    id_front_document_path: submission.idFrontUrl,
    id_back_document_path: submission.idBackUrl || null,
    selfie_document_path: submission.selfieUrl,
    status: submission.status || "PENDING",
    submitted_at: submission.submittedAt,
    reviewed_at: submission.decidedAt || null,
    rejection_reason: submission.rejectionReason || null,
    reviewed_by_admin_id: uuidOrUndefined(submission.decidedByAdminId || submission.decidedBy) || null,
    profile_bio: submission.bio || null,
    profile_photos: submission.photos || null,
    city: submission.city || null
  };
}
function mapKycSubmissionFromRow(row) {
  return {
    ...row,
    userId: row.user_id,
    userType: row.submission_role,
    legalName: row.legal_name,
    idType: row.id_type,
    idReference: row.id_reference,
    idFrontUrl: row.id_front_document_path,
    idBackUrl: row.id_back_document_path,
    selfieUrl: row.selfie_document_path,
    submittedAt: row.submitted_at,
    decidedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    decidedByAdminId: row.reviewed_by_admin_id,
    bio: row.profile_bio,
    photos: row.profile_photos
  };
}
function mapCompanionProfileToRow(profile) {
  return {
    ...uuidOrUndefined(profile.id) ? { id: profile.id } : {},
    user_id: profile.userId || profile.user_id,
    services: profile.services || [],
    rates: profile.rates || {},
    availability: profile.availability ?? null,
    is_live: profile.isLive ?? profile.is_live ?? false,
    rating: profile.rating ?? 0,
    total_bookings: profile.totalBookings ?? profile.total_bookings ?? 0,
    address: profile.address || null,
    state: profile.state || null,
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    is_initial_listing: profile.isInitialListing ?? profile.is_initial_listing ?? false,
    is_paused: profile.isPaused ?? profile.is_paused ?? false
  };
}
function mapCompanionProfileFromRow(row) {
  return {
    ...row,
    userId: row.user_id,
    isLive: row.is_live,
    totalBookings: row.total_bookings,
    isInitialListing: row.is_initial_listing,
    isPaused: row.is_paused
  };
}
function mapBookingToRow(booking) {
  return {
    ...uuidOrUndefined(booking.id) ? { id: booking.id } : {},
    booking_code: booking.bookingCode,
    client_id: booking.clientId,
    companion_id: booking.companionId,
    service_id: booking.serviceId,
    service_name: booking.serviceName,
    booking_date: booking.date || booking.bookingDate,
    start_time: booking.startTime,
    end_time: booking.endTime,
    duration_hours: booking.durationHours || Math.ceil((booking.slotMinutes || 60) / 60),
    meeting_location: booking.meetingLocation,
    meeting_address: booking.meetingAddress || null,
    latitude: booking.latitude ?? null,
    longitude: booking.longitude ?? null,
    notes: booking.notes || null,
    amount_paise: booking.bookingAmountPaise ?? booking.amountPaise,
    status: booking.status || "PENDING",
    payment_order_id: booking.paymentOrderId || null,
    payment_id: booking.paymentId || null,
    payment_status: booking.paymentStatus || "PENDING",
    start_otp_hash: booking.startOtpHmac || booking.startOtpHash || null,
    completion_otp_hash: booking.endOtpHmac || booking.completionOtpHash || null,
    start_otp_encrypted: booking.startOtpEncrypted || null,
    completion_otp_encrypted: booking.completionOtpEncrypted || null,
    companion_arrived_at: booking.companionArrivedAt || null,
    started_at: booking.startedAt || null,
    completed_at: booking.completedAt || null,
    delay_minutes: booking.delayMinutes || 0,
    admin_platform_fee_paise: booking.adminPlatformFeePaise || 0,
    companion_gross_share_paise: booking.companionGrossSharePaise || 0,
    companion_net_share_paise: booking.companionNetSharePaise || 0,
    late_penalty_paise: booking.latePenaltyPaise || 0,
    client_refund_penalty_paise: booking.clientRefundPenaltyPaise || 0,
    settlement_status: booking.settlementStatus || "LOCKED",
    settlement_unlock_at: booking.settlementUnlockUtc || booking.settlementUnlockAt || null,
    start_otp_attempts: booking.startOtpAttempts || 0,
    completion_otp_attempts: booking.endOtpAttempts || 0,
    start_otp_verified: booking.startOtpVerified || false,
    completion_otp_verified: booking.endOtpVerified || false,
    payout_id: uuidOrUndefined(booking.payoutId) || null
  };
}
function mapBookingFromRow(row) {
  return {
    ...row,
    bookingCode: row.booking_code,
    clientId: row.client_id,
    companionId: row.companion_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    date: row.booking_date,
    durationHours: row.duration_hours,
    slotMinutes: row.duration_hours * 60,
    meetingLocation: row.meeting_location,
    meetingAddress: row.meeting_address,
    bookingAmountPaise: row.amount_paise,
    paymentOrderId: row.payment_order_id,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    startOtpHmac: row.start_otp_hash,
    endOtpHmac: row.completion_otp_hash,
    startOtpEncrypted: row.start_otp_encrypted,
    completionOtpEncrypted: row.completion_otp_encrypted,
    companionArrivedAt: row.companion_arrived_at,
    completedAt: row.completed_at,
    adminPlatformFeePaise: row.admin_platform_fee_paise,
    companionGrossSharePaise: row.companion_gross_share_paise,
    companionNetSharePaise: row.companion_net_share_paise,
    latePenaltyPaise: row.late_penalty_paise,
    clientRefundPenaltyPaise: row.client_refund_penalty_paise,
    settlementStatus: row.settlement_status,
    settlementUnlockUtc: row.settlement_unlock_at,
    startOtpAttempts: row.start_otp_attempts,
    endOtpAttempts: row.completion_otp_attempts,
    endOtpVerified: row.completion_otp_verified,
    payoutId: row.payout_id
  };
}
var JsonDatabaseAdapter = class {
  getDB() {
    return loadJsonDB();
  }
  saveDB(state) {
    saveJsonDB(state);
  }
  async getUser(id) {
    const db3 = this.getDB();
    return db3.users[id] || null;
  }
  async getUserByPhone(phone) {
    const db3 = this.getDB();
    return Object.values(db3.users).find((u) => u.phone === phone) || null;
  }
  async createUser(user) {
    const db3 = this.getDB();
    db3.users[user.id] = user;
    this.saveDB(db3);
    return user;
  }
  async updateUser(id, updates) {
    const db3 = this.getDB();
    if (!db3.users[id]) return null;
    db3.users[id] = { ...db3.users[id], ...updates };
    this.saveDB(db3);
    return db3.users[id];
  }
  async deleteUser(userId) {
    const db3 = this.getDB();
    delete db3.users[userId];
    if (db3.kycSubmissions) {
      for (const k of Object.keys(db3.kycSubmissions)) {
        if (db3.kycSubmissions[k]?.userId === userId) delete db3.kycSubmissions[k];
      }
    }
    if (db3.companionProfiles) delete db3.companionProfiles[userId];
    if (db3.companionMemberships) {
      for (const k of Object.keys(db3.companionMemberships)) {
        if (db3.companionMemberships[k]?.userId === userId) delete db3.companionMemberships[k];
      }
    }
    if (db3.bankVerifications) delete db3.bankVerifications[userId];
    if (db3.companionWallets) delete db3.companionWallets[userId];
    if (db3.userLocations) delete db3.userLocations[userId];
    if (db3.userPresence) delete db3.userPresence[userId];
    this.saveDB(db3);
  }
  async listUsers(filters) {
    const db3 = this.getDB();
    return Object.values(db3.users);
  }
  async createKycSubmission(submission) {
    const db3 = this.getDB();
    db3.kycSubmissions[submission.id] = submission;
    this.saveDB(db3);
    return submission;
  }
  async submitKycSubmission(submission) {
    const db3 = this.getDB();
    db3.kycSubmissions[submission.id] = submission;
    this.saveDB(db3);
    return submission;
  }
  async getKycSubmission(id) {
    const db3 = this.getDB();
    return db3.kycSubmissions[id] || null;
  }
  async getUserKycSubmission(userId, submissionRole) {
    const db3 = this.getDB();
    return Object.values(db3.kycSubmissions).find(
      (submission) => submission.userId === userId && (submission.userType || submission.submissionRole) === submissionRole
    ) || null;
  }
  async listKycSubmissions(filters) {
    const db3 = this.getDB();
    return Object.values(db3.kycSubmissions);
  }
  async updateKycSubmission(id, updates) {
    const db3 = this.getDB();
    if (!db3.kycSubmissions[id]) return null;
    db3.kycSubmissions[id] = { ...db3.kycSubmissions[id], ...updates };
    this.saveDB(db3);
    return db3.kycSubmissions[id];
  }
  async reviewKycSubmission(id, decision, rejectionReason, adminUserId) {
    const db3 = this.getDB();
    const submission = db3.kycSubmissions[id];
    if (!submission) return null;
    submission.status = decision;
    submission.rejectionReason = rejectionReason;
    submission.decidedAt = (/* @__PURE__ */ new Date()).toISOString();
    submission.decidedByAdminId = adminUserId;
    const user = db3.users[submission.userId];
    if (user) {
      user.kycStatus = decision;
      user.kycDecidedAt = submission.decidedAt;
      user.kycDecidedByAdminId = adminUserId;
      user.kycRejectionReason = rejectionReason;
    }
    db3.auditLogs.unshift({
      id: `log_${Date.now()}`,
      adminId: adminUserId,
      action: `KYC_${decision}`,
      targetId: submission.userId,
      details: `KYC for ${submission.legalName} (${submission.userType}) was ${decision}.`,
      timestamp: submission.decidedAt
    });
    this.saveDB(db3);
    return submission;
  }
  async createKycDocumentSignedUrls(id) {
    const submission = await this.getKycSubmission(id);
    if (!submission) return null;
    return {
      idFrontUrl: submission.idFrontUrl,
      idBackUrl: submission.idBackUrl || null,
      selfieUrl: submission.selfieUrl
    };
  }
  async uploadKycDocument(_bucket, _path, _bytes, _contentType) {
    throw new Error("Private KYC document uploads require configured Supabase Storage.");
  }
  async deleteKycDocuments(_bucket, _paths) {
    throw new Error("Private KYC document cleanup requires configured Supabase Storage.");
  }
  async getCompanionProfile(userId) {
    const db3 = this.getDB();
    return Object.values(db3.companionProfiles).find((p) => p.userId === userId) || null;
  }
  async createCompanionProfile(profile) {
    const db3 = this.getDB();
    db3.companionProfiles[profile.id] = profile;
    this.saveDB(db3);
    return profile;
  }
  async upsertCompanionProfile(profile) {
    const db3 = this.getDB();
    db3.companionProfiles[profile.userId] = {
      ...db3.companionProfiles[profile.userId] || {},
      ...profile
    };
    this.saveDB(db3);
    return db3.companionProfiles[profile.userId];
  }
  async updateCompanionProfile(userId, updates) {
    const db3 = this.getDB();
    const key = Object.keys(db3.companionProfiles).find((id) => db3.companionProfiles[id]?.userId === userId);
    if (!key) return null;
    const profile = db3.companionProfiles[key];
    db3.companionProfiles[key] = { ...profile, ...updates };
    this.saveDB(db3);
    return db3.companionProfiles[key];
  }
  async listCompanionProfiles(filters) {
    const db3 = this.getDB();
    return Object.values(db3.companionProfiles);
  }
  async createMembership(membership) {
    const db3 = this.getDB();
    db3.companionMemberships[membership.id] = membership;
    this.saveDB(db3);
    return membership;
  }
  async getActiveMembership(userId) {
    const db3 = this.getDB();
    const now = /* @__PURE__ */ new Date();
    return Object.values(db3.companionMemberships).find(
      (m) => m.userId === userId && m.paymentStatus === "PAID" && new Date(m.expiryDate) > now
    ) || null;
  }
  async getMembershipByPaymentOrder(orderId) {
    const membership = Object.values(this.getDB().companionMemberships).find((item) => item.paymentOrderId === orderId);
    return membership || null;
  }
  async listMemberships(filters) {
    const db3 = this.getDB();
    return Object.values(db3.companionMemberships);
  }
  async updateMembershipOrder(id, orderId) {
    const db3 = this.getDB();
    const membership = Object.values(db3.companionMemberships).find((item) => item.id === id);
    if (!membership) throw new Error("Membership not found.");
    membership.paymentOrderId = orderId;
    this.saveDB(db3);
    return membership;
  }
  async createBankVerification(verification) {
    const db3 = this.getDB();
    const bankVerifications = db3.bankVerifications ?? {};
    const existing = Object.keys(bankVerifications).find((key) => {
      const v = bankVerifications[key];
      return v && v.userId === verification.userId;
    });
    db3.bankVerifications = bankVerifications;
    db3.bankVerifications[verification.id] = verification;
    this.saveDB(db3);
    return verification;
  }
  async getBankVerification(userId) {
    const db3 = this.getDB();
    if (!db3.bankVerifications) return null;
    return Object.values(db3.bankVerifications).find((v) => v.userId === userId) || null;
  }
  async updateBankVerification(userId, updates) {
    const db3 = this.getDB();
    if (!db3.bankVerifications) return null;
    const key = Object.keys(db3.bankVerifications).find((k) => db3.bankVerifications[k].userId === userId);
    if (!key) return null;
    db3.bankVerifications[key] = { ...db3.bankVerifications[key], ...updates };
    this.saveDB(db3);
    return db3.bankVerifications[key];
  }
  async createBooking(booking) {
    const db3 = this.getDB();
    db3.bookings[booking.id] = booking;
    this.saveDB(db3);
    return booking;
  }
  async reserveBookingPayment(booking) {
    return this.createBooking(booking);
  }
  async getBooking(id) {
    const db3 = this.getDB();
    return db3.bookings[id] || null;
  }
  async getBookingByCode(code) {
    const db3 = this.getDB();
    return Object.values(db3.bookings).find((b) => b.bookingCode === code) || null;
  }
  async getBookingByPaymentOrder(orderId) {
    const booking = Object.values(this.getDB().bookings).find((item) => item.paymentOrderId === orderId);
    return booking || null;
  }
  async listBookings(filters) {
    const db3 = this.getDB();
    return Object.values(db3.bookings);
  }
  async updateBooking(id, updates) {
    const db3 = this.getDB();
    if (!db3.bookings[id]) return null;
    db3.bookings[id] = { ...db3.bookings[id], ...updates };
    this.saveDB(db3);
    return db3.bookings[id];
  }
  async markBookingCompanionArrived(_bookingId, _companionId) {
    throw new Error("Atomic booking arrival requires Supabase.");
  }
  async verifyBookingOtp(_bookingId, _companionId, _otpType, _otpHash, _delayMinutes = 0) {
    throw new Error("Atomic booking OTP verification requires Supabase.");
  }
  async finalizeRazorpayPayment(_orderId, _paymentId, _amountPaise, _startOtpHash, _completionOtpHash, _startOtpEncrypted, _completionOtpEncrypted) {
    throw new Error("Atomic payment finalization requires the Supabase database.");
  }
  async createWalletEntry(entry) {
    const db3 = this.getDB();
    if (!db3.companionWallets) db3.companionWallets = {};
    if (!db3.companionWallets[entry.userId]) {
      db3.companionWallets[entry.userId] = { entries: [] };
    }
    db3.companionWallets[entry.userId].entries.push(entry);
    this.saveDB(db3);
    return entry;
  }
  async getWalletBalance(userId) {
    const db3 = this.getDB();
    if (!db3.companionWallets || !db3.companionWallets[userId]) {
      return { available: 0, locked: 0, total: 0 };
    }
    const entries = db3.companionWallets[userId].entries || [];
    let available = 0;
    let locked = 0;
    for (const entry of entries) {
      if (entry.balanceStatus === "AVAILABLE") {
        available += entry.netAmountPaise || 0;
      } else if (entry.balanceStatus === "LOCKED") {
        locked += entry.netAmountPaise || 0;
      }
    }
    return { available, locked, total: available + locked };
  }
  async listWalletEntries(userId) {
    const db3 = this.getDB();
    if (!db3.companionWallets || !db3.companionWallets[userId]) {
      return [];
    }
    return db3.companionWallets[userId].entries || [];
  }
  async createPayout(payout) {
    const db3 = this.getDB();
    db3.payouts[payout.id] = payout;
    this.saveDB(db3);
    return payout;
  }
  async listPayouts(filters) {
    const db3 = this.getDB();
    return Object.values(db3.payouts);
  }
  async updatePayout(id, updates) {
    const db3 = this.getDB();
    if (!db3.payouts[id]) return null;
    db3.payouts[id] = { ...db3.payouts[id], ...updates };
    this.saveDB(db3);
    return db3.payouts[id];
  }
  async createConversation(conversation) {
    const db3 = this.getDB();
    if (!db3.chatMessages) db3.chatMessages = {};
    const key = `${conversation.participantA}_${conversation.participantB}_${conversation.bookingId || "no-booking"}`;
    db3.chatMessages[key] = [];
    this.saveDB(db3);
    return { ...conversation, id: key };
  }
  async getConversation(id) {
    const db3 = this.getDB();
    if (!db3.chatMessages || !db3.chatMessages[id]) return null;
    return { id, messages: db3.chatMessages[id] };
  }
  async listConversations(userId) {
    const db3 = this.getDB();
    if (!db3.chatMessages) return [];
    return Object.keys(db3.chatMessages).map((key) => ({
      id: key,
      messages: db3.chatMessages[key]
    }));
  }
  async createMessage(message) {
    const db3 = this.getDB();
    if (!db3.chatMessages) db3.chatMessages = {};
    if (!db3.chatMessages[message.conversationId]) {
      db3.chatMessages[message.conversationId] = [];
    }
    db3.chatMessages[message.conversationId].push(message);
    this.saveDB(db3);
    return message;
  }
  async listMessages(conversationId, after) {
    const db3 = this.getDB();
    if (!db3.chatMessages || !db3.chatMessages[conversationId]) return [];
    return after ? db3.chatMessages[conversationId].filter((message) => message.timestamp > after || message.createdAt > after) : db3.chatMessages[conversationId];
  }
  async createSupportConversation(conversation) {
    const db3 = this.getDB();
    if (!db3.supportConversations) db3.supportConversations = {};
    db3.supportConversations[conversation.id] = conversation;
    this.saveDB(db3);
    return conversation;
  }
  async getSupportConversation(id) {
    const db3 = this.getDB();
    if (!db3.supportConversations) return null;
    return db3.supportConversations[id] || null;
  }
  async listSupportConversations(filters) {
    const db3 = this.getDB();
    if (!db3.supportConversations) return [];
    return Object.values(db3.supportConversations);
  }
  async createSupportMessage(message) {
    const db3 = this.getDB();
    if (!db3.supportMessages) db3.supportMessages = {};
    if (!db3.supportMessages[message.conversationId]) {
      db3.supportMessages[message.conversationId] = [];
    }
    db3.supportMessages[message.conversationId].push(message);
    this.saveDB(db3);
    return message;
  }
  async listSupportMessages(conversationId, after) {
    const db3 = this.getDB();
    if (!db3.supportMessages || !db3.supportMessages[conversationId]) return [];
    return after ? db3.supportMessages[conversationId].filter((message) => {
      const createdAt = message.createdAt || message.created_at;
      const id = message.id || "";
      return createdAt > after.createdAt || createdAt === after.createdAt && id > after.id;
    }) : db3.supportMessages[conversationId];
  }
  async updateSupportConversation(id, updates) {
    const conversation = await this.getSupportConversation(id);
    if (!conversation) return null;
    const updated = { ...conversation, ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.getDB().supportConversations[id] = updated;
    this.saveDB(this.getDB());
    return updated;
  }
  async getAdminUser(email) {
    const db3 = this.getDB();
    return Object.values(db3.adminUsers).find((a) => a.email.toLowerCase() === email.toLowerCase()) || null;
  }
  async getAdminUserById(id) {
    const db3 = this.getDB();
    return db3.adminUsers[id] || null;
  }
  async updateAdminPasswordHash(id, passwordHash) {
    const db3 = this.getDB();
    const admin = db3.adminUsers[id];
    if (!admin) throw new Error("Administrator account no longer exists.");
    db3.adminUsers[id] = { ...admin, passwordHash };
    this.saveDB(db3);
  }
  async createAdminUser(admin) {
    const db3 = this.getDB();
    db3.adminUsers[admin.id] = admin;
    this.saveDB(db3);
    return admin;
  }
  async listAdminUsers() {
    const db3 = this.getDB();
    return Object.values(db3.adminUsers);
  }
  async updateAdminUserRole(id, role) {
    const db3 = this.getDB();
    const staff = db3.adminUsers[id];
    if (!staff) throw new Error("Admin user not found");
    staff.role = role;
    this.saveDB(db3);
    return staff;
  }
  async deleteAdminUser(id) {
    const db3 = this.getDB();
    delete db3.adminUsers[id];
    this.saveDB(db3);
  }
  async createAuditLog(log) {
    const db3 = this.getDB();
    db3.auditLogs.push(log);
    this.saveDB(db3);
  }
  async listAuditLogs(filters) {
    const db3 = this.getDB();
    return db3.auditLogs || [];
  }
  async createIncidentReport(report) {
    const db3 = this.getDB();
    db3.incidentReports ||= {};
    const item = {
      ...report,
      id: report.id || `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: report.status || "PENDING_REVIEW",
      createdAt: report.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    db3.incidentReports[item.id] = item;
    this.saveDB(db3);
    return item;
  }
  async listIncidentReports(filters) {
    const db3 = this.getDB();
    const list = Object.values(db3.incidentReports || {});
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async updateIncidentReport(id, updates) {
    const db3 = this.getDB();
    db3.incidentReports ||= {};
    if (!db3.incidentReports[id]) return null;
    db3.incidentReports[id] = { ...db3.incidentReports[id], ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.saveDB(db3);
    return db3.incidentReports[id];
  }
  async createNotification(notification) {
    const db3 = this.getDB();
    db3.notifications ||= {};
    const item = {
      ...notification,
      id: notification.id || crypto.randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pushDeliveryStatus: "PENDING",
      pushAttempts: 0,
      pushRetryAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    (db3.notifications[notification.userId] ||= []).unshift(item);
    this.saveDB(db3);
    return item;
  }
  async listNotifications(userId) {
    return this.getDB().notifications?.[userId] || [];
  }
  async markNotificationRead(id, userId) {
    const db3 = this.getDB();
    const notifications = userId ? db3.notifications?.[userId] || [] : Object.values(db3.notifications || {}).flat();
    const item = notifications.find((entry) => entry.id === id);
    if (!item) throw new Error("Notification was not found.");
    item.readAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveDB(db3);
  }
  async claimNotificationPushes(notificationId, limit = 100) {
    const db3 = this.getDB();
    const now = Date.now();
    const notifications = Object.values(db3.notifications || {}).flat();
    const candidates = notifications.filter(
      (notification) => (!notificationId || notification.id === notificationId) && notification.pushDeliveryStatus !== "SENT" && notification.pushDeliveryStatus !== "FAILED" && (notification.pushAttempts || 0) < 5 && (!notification.pushRetryAt || Date.parse(notification.pushRetryAt) <= now) && (notification.pushDeliveryStatus !== "PROCESSING" || !notification.pushClaimedAt || Date.parse(notification.pushClaimedAt) <= now - 10 * 60 * 1e3)
    ).slice(0, Math.min(500, Math.max(1, limit)));
    for (const notification of candidates) {
      notification.pushDeliveryStatus = "PROCESSING";
      notification.pushAttempts = (notification.pushAttempts || 0) + 1;
      notification.pushClaimedAt = new Date(now).toISOString();
    }
    if (candidates.length) this.saveDB(db3);
    return candidates.map((notification) => ({
      notification,
      deviceTokens: Object.entries(db3.firebaseDeviceTokens || {}).filter(([, token]) => token.userId === notification.userId).map(([token]) => token)
    }));
  }
  async finishNotificationPush(id, success, errorMessage) {
    const db3 = this.getDB();
    const notifications = Object.values(db3.notifications || {}).flat();
    const notification = notifications.find((entry) => entry.id === id);
    if (!notification || notification.pushDeliveryStatus !== "PROCESSING") {
      throw new Error("Notification push claim was not found.");
    }
    notification.pushDeliveryStatus = success ? "SENT" : notification.pushAttempts >= 5 ? "FAILED" : "PENDING";
    notification.pushClaimedAt = null;
    notification.pushRetryAt = new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.max(0, notification.pushAttempts - 1)) * 1e3).toISOString();
    notification.pushLastError = success ? null : (errorMessage || "Push delivery failed.").slice(0, 1e3);
    if (success) notification.pushSentAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveDB(db3);
  }
  async registerDeviceToken(userId, token, platform) {
    const db3 = this.getDB();
    db3.firebaseDeviceTokens ||= {};
    db3.firebaseDeviceTokens[token] = { userId, platform };
    this.saveDB(db3);
  }
  async listDeviceTokens(userId) {
    return Object.entries(this.getDB().firebaseDeviceTokens || {}).filter(([, entry]) => entry.userId === userId).map(([token]) => token);
  }
  async deleteDeviceToken(token, userId) {
    const db3 = this.getDB();
    if (db3.firebaseDeviceTokens?.[token] && (!userId || db3.firebaseDeviceTokens[token].userId === userId)) {
      delete db3.firebaseDeviceTokens[token];
    }
    this.saveDB(db3);
  }
  async upsertUserLocation(location) {
    const db3 = this.getDB();
    db3.userLocations ||= {};
    db3.userLocations[location.userId] = location;
    this.saveDB(db3);
    return location;
  }
  async getUserLocation(userId) {
    return this.getDB().userLocations?.[userId] || null;
  }
  async deleteUserLocation(userId) {
    const db3 = this.getDB();
    if (db3.userLocations) delete db3.userLocations[userId];
    this.saveDB(db3);
  }
  async upsertUserPresence(presence) {
    const db3 = this.getDB();
    db3.userPresence ||= {};
    db3.userPresence[presence.userId] = presence;
    this.saveDB(db3);
    return presence;
  }
  async getUserPresence(userId) {
    return this.getDB().userPresence?.[userId] || null;
  }
  async setBookingLocationSharing(bookingId, userId, enabled) {
    const locations = this.getDB().userLocations || (this.getDB().userLocations = {});
    locations[`${bookingId}:${userId}`] = { bookingId, userId, sharingEnabled: enabled, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.saveDB(this.getDB());
  }
  async getBookingLocationSharing(bookingId, userId) {
    return this.getDB().userLocations?.[`${bookingId}:${userId}`]?.sharingEnabled === true;
  }
  async consumeRateLimit(bucketKey, limit, windowSeconds) {
    const now = Date.now();
    let bucket = localRateLimitBuckets.get(bucketKey);
    if (!bucket || now - bucket.startedAt >= windowSeconds * 1e3) {
      bucket = { startedAt: now, count: 0 };
      localRateLimitBuckets.set(bucketKey, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowSeconds * 1e3 - now) / 1e3)) };
  }
  async isSessionRevoked(tokenId) {
    return localRevokedSessions.has(tokenId);
  }
  async revokeSession(tokenId) {
    localRevokedSessions.add(tokenId);
  }
  async claimPaymentWebhookEvent(eventId, eventType, payload) {
    const previous = localWebhookEvents.get(eventId);
    if (previous?.processed) return { claimed: false, processed: true };
    localWebhookEvents.set(eventId, { eventType, payload, processed: false });
    return { claimed: true, processed: false };
  }
  async completePaymentWebhookEvent(eventId, error) {
    const event = localWebhookEvents.get(eventId);
    if (!event) throw new Error("Payment webhook event claim was not found.");
    event.processed = !error;
  }
  async markRazorpayOrderFailed(orderId, paymentId) {
    const db3 = this.getDB();
    let updated = false;
    for (const b of Object.values(db3.bookings)) {
      if (b.paymentOrderId === orderId && (b.paymentStatus === "PENDING" || !b.paymentStatus)) {
        b.paymentStatus = "FAILED";
        b.status = "CANCELLED";
        if (paymentId) b.paymentId = paymentId;
        updated = true;
      }
    }
    for (const m of Object.values(db3.companionMemberships)) {
      if (m.paymentOrderId === orderId && (m.paymentStatus === "PENDING" || !m.paymentStatus)) {
        m.paymentStatus = "FAILED";
        if (paymentId) m.paymentId = paymentId;
        updated = true;
      }
    }
    return updated;
  }
  async markRazorpayOrderCancelled(orderId) {
    const db3 = this.getDB();
    let updated = false;
    for (const b of Object.values(db3.bookings)) {
      if (b.paymentOrderId === orderId && (b.paymentStatus === "PENDING" || !b.paymentStatus)) {
        b.paymentStatus = "CANCELLED";
        b.status = "CANCELLED";
        updated = true;
      }
    }
    for (const m of Object.values(db3.companionMemberships)) {
      if (m.paymentOrderId === orderId && (m.paymentStatus === "PENDING" || !m.paymentStatus)) {
        m.paymentStatus = "CANCELLED";
        updated = true;
      }
    }
    return updated;
  }
  async reservePaymentRefund() {
    throw new Error("Payment refunds require Supabase.");
  }
  async listPaymentRefunds() {
    throw new Error("Payment refunds require Supabase.");
  }
  async updatePaymentRefund() {
    throw new Error("Payment refunds require Supabase.");
  }
  async processBookingPayout() {
    throw new Error("Payout processing requires Supabase.");
  }
  async claimScheduledJobRun() {
    throw new Error("Scheduled jobs require Supabase.");
  }
  async finishScheduledJobRun() {
    throw new Error("Scheduled jobs require Supabase.");
  }
  async runScheduledMaintenance() {
    throw new Error("Scheduled maintenance requires Supabase.");
  }
  async reserveAdminSensitiveMfa() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async completeAdminSensitiveMfaDelivery() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async verifyAdminSensitiveMfa() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async consumeAdminSensitiveMfa() {
    throw new Error("Sensitive administrator MFA requires Supabase.");
  }
  async reserveOtp(phone, otpHash) {
    const challenges = loadJsonOtpChallenges();
    const now = Date.now();
    const current = challenges[phone];
    if (current && now - current.lastSentAt < 6e4) {
      return {
        allowed: false,
        reason: "cooldown",
        waitSeconds: Math.ceil((6e4 - (now - current.lastSentAt)) / 1e3)
      };
    }
    const inWindow = Boolean(current && now - current.windowStartTime < 6e4);
    if (inWindow && current.windowCount >= 3) {
      return {
        allowed: false,
        reason: "rate_limit",
        waitSeconds: Math.ceil((6e4 - (now - current.windowStartTime)) / 1e3)
      };
    }
    const windowStartTime = current && inWindow ? current.windowStartTime : now;
    const windowCount = current && inWindow ? current.windowCount + 1 : 1;
    challenges[phone] = {
      otpHash,
      expiresAt: now + 5 * 6e4,
      attempts: 0,
      lastSentAt: now,
      windowStartTime,
      windowCount,
      status: "PENDING"
    };
    saveJsonOtpChallenges(challenges);
    return { allowed: true };
  }
  async setOtpDeliveryResult(phone, sent, requestId) {
    const challenges = loadJsonOtpChallenges();
    const record = challenges[phone];
    if (!record || record.status !== "PENDING") {
      throw new Error("OTP challenge was not pending delivery.");
    }
    record.status = sent ? "SENT" : "FAILED";
    if (requestId) record.requestId = requestId;
    saveJsonOtpChallenges(challenges);
  }
  async verifyOtp(phone, otpHash) {
    const challenges = loadJsonOtpChallenges();
    const record = challenges[phone];
    if (!record) return "not_found";
    if (record.status === "LOCKED") return "locked";
    if (record.status !== "SENT") return "not_found";
    const now = Date.now();
    if (now >= record.expiresAt) {
      record.status = "EXPIRED";
      saveJsonOtpChallenges(challenges);
      return "expired";
    }
    if (record.attempts >= 4) {
      record.status = "LOCKED";
      saveJsonOtpChallenges(challenges);
      return "locked";
    }
    if (record.otpHash !== otpHash) {
      record.attempts += 1;
      if (record.attempts >= 4) record.status = "LOCKED";
      saveJsonOtpChallenges(challenges);
      return record.status === "LOCKED" ? "locked" : "invalid";
    }
    record.status = "CONSUMED";
    saveJsonOtpChallenges(challenges);
    return "verified";
  }
  async reserveAdminMfa(email, otpHash) {
    const challenges = loadJsonAdminMfaChallenges();
    const now = Date.now();
    const current = challenges[email];
    if (current && now - current.lastSentAt < 6e4) {
      return { allowed: false, reason: "cooldown", waitSeconds: Math.ceil((6e4 - (now - current.lastSentAt)) / 1e3) };
    }
    const inWindow = Boolean(current && now - current.windowStartTime < 6e4);
    if (inWindow && current.windowCount >= 3) {
      return { allowed: false, reason: "rate_limit", waitSeconds: Math.ceil((6e4 - (now - current.windowStartTime)) / 1e3) };
    }
    challenges[email] = {
      otpHash,
      expiresAt: now + 5 * 6e4,
      attempts: 0,
      lastSentAt: now,
      windowStartTime: inWindow ? current.windowStartTime : now,
      windowCount: inWindow ? current.windowCount + 1 : 1,
      status: "PENDING"
    };
    saveJsonAdminMfaChallenges(challenges);
    return { allowed: true };
  }
  async setAdminMfaDeliveryResult(email, sent, requestId) {
    const challenges = loadJsonAdminMfaChallenges();
    const record = challenges[email];
    if (!record || record.status !== "PENDING") throw new Error("Administrator MFA challenge was not pending delivery.");
    record.status = sent ? "SENT" : "FAILED";
    if (requestId) record.requestId = requestId;
    saveJsonAdminMfaChallenges(challenges);
  }
  async verifyAdminMfa(email, otpHash) {
    const challenges = loadJsonAdminMfaChallenges();
    const record = challenges[email];
    if (!record) return "not_found";
    if (record.status === "LOCKED") return "locked";
    if (record.status !== "SENT") return "not_found";
    if (Date.now() >= record.expiresAt) {
      record.status = "EXPIRED";
      saveJsonAdminMfaChallenges(challenges);
      return "expired";
    }
    if (record.attempts >= 4) {
      record.status = "LOCKED";
      saveJsonAdminMfaChallenges(challenges);
      return "locked";
    }
    if (record.otpHash !== otpHash) {
      record.attempts += 1;
      if (record.attempts >= 4) record.status = "LOCKED";
      saveJsonAdminMfaChallenges(challenges);
      return record.status === "LOCKED" ? "locked" : "invalid";
    }
    record.status = "CONSUMED";
    saveJsonAdminMfaChallenges(challenges);
    return "verified";
  }
};
var SupabaseDatabaseAdapter = class {
  async getUser(id) {
    const { data, error } = await db.users().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.mapUser(data) : null;
  }
  async getUserByPhone(phone) {
    const { data, error } = await db.users().select("*").eq("phone", phone).maybeSingle();
    if (error) throw error;
    return data ? this.mapUser(data) : null;
  }
  async createUser(user) {
    const { data, error } = await db.users().insert({
      id: user.id,
      phone: user.phone,
      password_hash: user.passwordHash,
      legal_name: user.legalName || null,
      email: user.email || null,
      role: user.role,
      active_role: user.activeRole,
      kyc_status: user.kycStatus || "NOT_SUBMITTED",
      dob: user.dob || null,
      age: user.age || null,
      bio: user.bio || null,
      photos: user.photos || null,
      city: user.city || null,
      state: user.state || null,
      address: user.address || null,
      created_at: user.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    }).select().single();
    if (error) throw error;
    return this.mapUser(data);
  }
  mapUser(user) {
    if (!user) return null;
    let fallbackProfileName;
    let fallbackPhotos;
    let fallbackBio;
    let fallbackProfilePhoto;
    let fallbackSuspended;
    let fallbackSuspendedReason;
    let fallbackSuspendedAt;
    let fallbackWarningCount;
    let fallbackLastWarningReason;
    let fallbackLastWarningAt;
    if (typeof user.address === "string" && user.address.startsWith("__META__:")) {
      try {
        const meta = JSON.parse(user.address.slice(9));
        if (meta?.profileName) fallbackProfileName = meta.profileName;
        if (Array.isArray(meta?.photos) && meta.photos.length > 0) fallbackPhotos = meta.photos;
        if (typeof meta?.bio === "string") fallbackBio = meta.bio;
        if (typeof meta?.profilePhoto === "string" && meta.profilePhoto) fallbackProfilePhoto = meta.profilePhoto;
        if (meta?.isSuspended !== void 0) fallbackSuspended = meta.isSuspended;
        if (meta?.suspendedReason) fallbackSuspendedReason = meta.suspendedReason;
        if (meta?.suspendedAt) fallbackSuspendedAt = meta.suspendedAt;
        if (meta?.warningCount !== void 0) fallbackWarningCount = meta.warningCount;
        if (meta?.lastWarningReason) fallbackLastWarningReason = meta.lastWarningReason;
        if (meta?.lastWarningAt) fallbackLastWarningAt = meta.lastWarningAt;
      } catch {
      }
    }
    const resolvedProfileName = user.profile_name || user.profileName || fallbackProfileName || user.legal_name || "User";
    const resolvedPhotos = Array.isArray(user.photos) && user.photos.length > 0 ? user.photos : fallbackPhotos || [];
    const resolvedProfilePhoto = user.profile_photo || user.profilePhoto || fallbackProfilePhoto || resolvedPhotos[0] || null;
    const resolvedBio = user.bio !== void 0 && user.bio !== null ? user.bio : fallbackBio || "";
    return {
      ...user,
      passwordHash: user.password_hash,
      legalName: user.legal_name,
      profileName: resolvedProfileName,
      activeRole: user.active_role,
      kycStatus: user.kyc_status,
      kycRejectionReason: user.kyc_rejection_reason,
      profilePhoto: resolvedProfilePhoto,
      kycSubmittedAt: user.kyc_submitted_at,
      kycDecidedAt: user.kyc_decided_at,
      kycDecidedBy: user.kyc_decided_by,
      kycDecidedByAdminId: user.kyc_decided_by_admin_id,
      dob: user.dob,
      age: user.age,
      bio: resolvedBio,
      photos: resolvedPhotos,
      city: user.city,
      state: user.state,
      address: typeof user.address === "string" && user.address.startsWith("__META__:") ? "" : user.address,
      isSuspended: user.is_suspended !== void 0 ? !!user.is_suspended : user.isSuspended !== void 0 ? !!user.isSuspended : !!fallbackSuspended,
      suspendedReason: user.suspended_reason || user.suspendedReason || fallbackSuspendedReason,
      suspendedAt: user.suspended_at || user.suspendedAt || fallbackSuspendedAt,
      warningCount: typeof user.warning_count === "number" ? user.warning_count : typeof user.warningCount === "number" ? user.warningCount : fallbackWarningCount || 0,
      lastWarningReason: user.last_warning_reason || user.lastWarningReason || fallbackLastWarningReason,
      lastWarningAt: user.last_warning_at || user.lastWarningAt || fallbackLastWarningAt,
      createdAt: user.created_at
    };
  }
  async updateUser(id, updates) {
    const columnNames = {
      role: "role",
      activeRole: "active_role",
      kycStatus: "kyc_status",
      legalName: "legal_name",
      profileName: "profile_name",
      kycSubmittedAt: "kyc_submitted_at",
      kycDecidedAt: "kyc_decided_at",
      kycDecidedBy: "kyc_decided_by",
      kycDecidedByAdminId: "kyc_decided_by_admin_id",
      kycRejectionReason: "kyc_rejection_reason",
      profilePhoto: "profile_photo",
      dob: "dob",
      age: "age",
      bio: "bio",
      photos: "photos",
      city: "city",
      state: "state",
      address: "address",
      isSuspended: "is_suspended",
      suspendedReason: "suspended_reason",
      suspendedAt: "suspended_at",
      warningCount: "warning_count",
      lastWarningReason: "last_warning_reason",
      lastWarningAt: "last_warning_at",
      createdAt: "created_at",
      passwordHash: "password_hash"
    };
    const rowUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (columnNames[key]) {
        rowUpdates[columnNames[key]] = value;
      }
    }
    let existingMeta = {};
    try {
      const { data: cur } = await db.users().select("address").eq("id", id).maybeSingle();
      if (cur?.address && typeof cur.address === "string" && cur.address.startsWith("__META__:")) {
        existingMeta = JSON.parse(cur.address.slice(9));
      }
    } catch {
    }
    const metaUpdates = { ...existingMeta };
    if (updates.profileName !== void 0) metaUpdates.profileName = updates.profileName;
    if (Array.isArray(updates.photos)) metaUpdates.photos = updates.photos;
    if (updates.bio !== void 0) metaUpdates.bio = updates.bio;
    if (updates.profilePhoto !== void 0) metaUpdates.profilePhoto = updates.profilePhoto;
    if (updates.isSuspended !== void 0) metaUpdates.isSuspended = updates.isSuspended;
    if (updates.suspendedReason !== void 0) metaUpdates.suspendedReason = updates.suspendedReason;
    if (updates.suspendedAt !== void 0) metaUpdates.suspendedAt = updates.suspendedAt;
    if (updates.warningCount !== void 0) metaUpdates.warningCount = updates.warningCount;
    if (updates.lastWarningReason !== void 0) metaUpdates.lastWarningReason = updates.lastWarningReason;
    if (updates.lastWarningAt !== void 0) metaUpdates.lastWarningAt = updates.lastWarningAt;
    if (Object.keys(metaUpdates).length > 0 && !updates.address) {
      rowUpdates["address"] = "__META__:" + JSON.stringify(metaUpdates);
    }
    const applyMetaOverrides = (userObj) => {
      if (metaUpdates.profileName) userObj.profileName = metaUpdates.profileName;
      if (Array.isArray(metaUpdates.photos)) userObj.photos = metaUpdates.photos;
      if (metaUpdates.bio !== void 0) userObj.bio = metaUpdates.bio;
      if (metaUpdates.profilePhoto) userObj.profilePhoto = metaUpdates.profilePhoto;
      if (metaUpdates.isSuspended !== void 0) userObj.isSuspended = metaUpdates.isSuspended;
      if (metaUpdates.suspendedReason !== void 0) userObj.suspendedReason = metaUpdates.suspendedReason;
      if (metaUpdates.warningCount !== void 0) userObj.warningCount = metaUpdates.warningCount;
      if (metaUpdates.lastWarningReason !== void 0) userObj.lastWarningReason = metaUpdates.lastWarningReason;
      return userObj;
    };
    try {
      const { data, error } = await db.users().update(rowUpdates).eq("id", id).select().maybeSingle();
      if (error) {
        if (error.message?.includes("profile_name") || error.code === "42703" || String(error.message).includes("column")) {
          const fallbackUpdates = { ...rowUpdates };
          delete fallbackUpdates.profile_name;
          delete fallbackUpdates.is_suspended;
          delete fallbackUpdates.suspended_reason;
          delete fallbackUpdates.suspended_at;
          delete fallbackUpdates.warning_count;
          delete fallbackUpdates.last_warning_reason;
          delete fallbackUpdates.last_warning_at;
          let retry = await db.users().update(fallbackUpdates).eq("id", id).select().maybeSingle();
          if (retry.error && (retry.error.code === "42703" || String(retry.error.message).includes("column"))) {
            delete fallbackUpdates.photos;
            delete fallbackUpdates.bio;
            delete fallbackUpdates.profile_photo;
            retry = await db.users().update(fallbackUpdates).eq("id", id).select().maybeSingle();
          }
          if (retry.error) {
            console.warn("Supabase updateUser fallback error:", retry.error.message);
          }
          return applyMetaOverrides(this.mapUser(retry.data || { id, ...updates }));
        }
        console.warn("Supabase updateUser error:", error.message);
      }
      return applyMetaOverrides(this.mapUser(data || { id, ...updates }));
    } catch (err) {
      console.warn("Supabase updateUser exception:", err.message);
      return applyMetaOverrides(this.mapUser({ id, ...updates }));
    }
  }
  async listUsers(filters) {
    let query = db.users().select("*");
    if (filters?.role) query = query.eq("role", filters.role);
    if (filters?.kycStatus) query = query.eq("kyc_status", filters.kycStatus);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((user) => this.mapUser(user));
  }
  async deleteUser(userId) {
    await Promise.allSettled([
      db.kycSubmissions().delete().eq("user_id", userId),
      db.companionProfiles().delete().eq("user_id", userId),
      db.companionMemberships().delete().eq("user_id", userId),
      db.bankVerifications().delete().eq("user_id", userId),
      db.userLocations().delete().eq("user_id", userId),
      db.userPresence().delete().eq("user_id", userId),
      db.firebaseDeviceTokens().delete().eq("user_id", userId),
      db.notifications().delete().eq("user_id", userId),
      db.chatMessages().delete().eq("sender_id", userId),
      db.supportMessages().delete().eq("sender_id", userId)
    ]);
    const { error } = await db.users().delete().eq("id", userId);
    if (error) {
      console.warn("Supabase deleteUser error:", error.message);
      throw error;
    }
  }
  async createKycSubmission(submission) {
    const { data, error } = await db.kycSubmissions().insert(mapKycSubmissionToRow(submission)).select().single();
    if (error) throw error;
    return mapKycSubmissionFromRow(data);
  }
  async submitKycSubmission(submission) {
    const { data, error } = await supabase.rpc("submit_profile_kyc", {
      p_user_id: submission.userId,
      p_submission_id: submission.id,
      p_role: submission.userType,
      p_legal_name: submission.legalName,
      p_dob: submission.dob,
      p_id_type: submission.idType,
      p_id_front_path: submission.idFrontUrl,
      p_id_back_path: submission.idBackUrl || null,
      p_selfie_path: submission.selfieUrl,
      p_bio: submission.bio || null,
      p_photos: submission.photos || null,
      p_city: submission.city || null
    });
    if (error) throw error;
    if (!data || typeof data !== "object") {
      throw new Error("Supabase returned an invalid KYC submission response.");
    }
    return mapKycSubmissionFromRow(data);
  }
  async getKycSubmission(id) {
    const { data, error } = await db.kycSubmissions().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapKycSubmissionFromRow(data) : null;
  }
  async getUserKycSubmission(userId, submissionRole) {
    const { data, error } = await db.kycSubmissions().select("*").eq("user_id", userId).eq("submission_role", submissionRole).maybeSingle();
    if (error) throw error;
    return data ? mapKycSubmissionFromRow(data) : null;
  }
  async listKycSubmissions(filters) {
    let query = db.kycSubmissions().select("*");
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.submissionRole) query = query.eq("submission_role", filters.submissionRole);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapKycSubmissionFromRow);
  }
  async updateKycSubmission(id, updates) {
    const rowUpdates = {};
    const fields = {
      legalName: "legal_name",
      dob: "dob",
      idType: "id_type",
      idReference: "id_reference",
      idFrontUrl: "id_front_document_path",
      idBackUrl: "id_back_document_path",
      selfieUrl: "selfie_document_path",
      status: "status",
      decidedAt: "reviewed_at",
      decidedByAdminId: "reviewed_by_admin_id",
      rejectionReason: "rejection_reason",
      bio: "profile_bio",
      photos: "profile_photos",
      city: "city"
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.kycSubmissions().update(rowUpdates).eq("id", id).select().single();
    if (error) throw error;
    return mapKycSubmissionFromRow(data);
  }
  async reviewKycSubmission(id, decision, rejectionReason, adminUserId) {
    const { data, error } = await supabase.rpc("review_profile_kyc", {
      p_submission_id: id,
      p_decision: decision,
      p_rejection_reason: rejectionReason,
      p_admin_user_id: adminUserId
    });
    if (error) throw error;
    if (!data?.submission) throw new Error("Supabase returned an invalid KYC review response.");
    return mapKycSubmissionFromRow(data.submission);
  }
  async createKycDocumentSignedUrls(id) {
    const submission = await this.getKycSubmission(id);
    if (!submission) return null;
    const bucket = submission.userType === "COMPANION" ? "companion-kyc-documents" : "client-kyc-documents";
    const documents = {
      idFrontUrl: submission.idFrontUrl || null,
      idBackUrl: submission.idBackUrl || null,
      selfieUrl: submission.selfieUrl || null
    };
    for (const [key, objectPath] of Object.entries(documents)) {
      if (!objectPath) continue;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 300);
      if (error) throw error;
      documents[key] = data.signedUrl;
    }
    return documents;
  }
  async uploadKycDocument(bucket, objectPath, bytes, contentType) {
    if (bucket !== "client-kyc-documents" && bucket !== "companion-kyc-documents") {
      throw new Error("Invalid private KYC storage bucket.");
    }
    const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType,
      upsert: false
    });
    if (error) throw error;
  }
  async deleteKycDocuments(bucket, paths) {
    if (bucket !== "client-kyc-documents" && bucket !== "companion-kyc-documents") {
      throw new Error("Invalid private KYC storage bucket.");
    }
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
  async getCompanionProfile(userId) {
    const { data, error } = await db.companionProfiles().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? mapCompanionProfileFromRow(data) : null;
  }
  async createCompanionProfile(profile) {
    const { data, error } = await db.companionProfiles().upsert(mapCompanionProfileToRow(profile), { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return mapCompanionProfileFromRow(data);
  }
  async upsertCompanionProfile(profile) {
    return this.createCompanionProfile(profile);
  }
  async updateCompanionProfile(userId, updates) {
    const rowUpdates = mapCompanionProfilePatchToRow(updates);
    const { data, error } = await db.companionProfiles().update(rowUpdates).eq("user_id", userId).select().single();
    if (error) throw error;
    return mapCompanionProfileFromRow(data);
  }
  async listCompanionProfiles(filters) {
    let query = db.companionProfiles().select("*");
    if (filters?.isLive !== void 0) query = query.eq("is_live", filters.isLive);
    if (filters?.state) query = query.eq("state", filters.state);
    if (Number.isInteger(filters?.limit) && filters.limit > 0) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapCompanionProfileFromRow);
  }
  async createMembership(membership) {
    const { data, error } = await db.companionMemberships().insert({
      ...uuidOrUndefined(membership.id) ? { id: membership.id } : {},
      user_id: membership.userId,
      plan: membership.plan,
      amount_paise: membership.pricePaise ?? membership.amountPaise,
      currency: membership.currency || "INR",
      start_date: membership.startDate,
      expiry_date: membership.expiryDate,
      payment_order_id: membership.paymentOrderId || null,
      payment_id: membership.paymentId || null,
      payment_status: membership.paymentStatus || "PENDING",
      paid_at: membership.paidAt || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status,
      isActive: data.payment_status === "PAID" && new Date(data.expiry_date) > /* @__PURE__ */ new Date()
    };
  }
  async getActiveMembership(userId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await db.companionMemberships().select("*").eq("user_id", userId).eq("payment_status", "PAID").gt("expiry_date", now).order("expiry_date", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status,
      isActive: true
    } : null;
  }
  async getMembershipByPaymentOrder(orderId) {
    const { data, error } = await db.companionMemberships().select("*").eq("payment_order_id", orderId).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status
    } : null;
  }
  async listMemberships(filters) {
    let query = db.companionMemberships().select("*");
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      pricePaise: row.amount_paise,
      startDate: row.start_date,
      expiryDate: row.expiry_date,
      paymentOrderId: row.payment_order_id,
      paymentId: row.payment_id,
      paymentStatus: row.payment_status || (row.payment_id ? "PAID" : "PENDING")
    }));
  }
  async updateMembershipOrder(id, orderId) {
    const { data, error } = await db.companionMemberships().update({ payment_order_id: orderId }).eq("id", id).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      pricePaise: data.amount_paise,
      startDate: data.start_date,
      expiryDate: data.expiry_date,
      paymentOrderId: data.payment_order_id,
      paymentId: data.payment_id,
      paymentStatus: data.payment_status
    };
  }
  async createBankVerification(verification) {
    const { data, error } = await db.bankVerifications().upsert({
      ...uuidOrUndefined(verification.id) ? { id: verification.id } : {},
      user_id: verification.userId,
      account_number_encrypted: verification.accountNumberEncrypted,
      account_number_last4: verification.accountNumberLast4,
      ifsc: verification.ifsc,
      bank_name: verification.bankName || null,
      account_holder_name: verification.accountHolderName,
      verification_status: verification.verificationStatus || "PENDING",
      name_at_bank: verification.nameAtBank || null,
      name_matched: verification.nameMatched ?? null,
      provider_request_id: verification.providerRequestId || null,
      verified_at: verification.verifiedAt || null
    }, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return data;
  }
  async getBankVerification(userId) {
    const { data, error } = await db.bankVerifications().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      accountNumberEncrypted: data.account_number_encrypted,
      accountNumberMasked: data.account_number_last4 ? `\u2022\u2022\u2022\u2022${data.account_number_last4}` : null,
      accountNumberLast4: data.account_number_last4,
      bankName: data.bank_name,
      accountHolderName: data.account_holder_name,
      verificationStatus: data.verification_status,
      nameAtBank: data.name_at_bank,
      nameMatched: data.name_matched,
      providerRequestId: data.provider_request_id,
      verifiedAt: data.verified_at
    } : null;
  }
  async updateBankVerification(userId, updates) {
    const rowUpdates = {};
    const fields = {
      accountNumberEncrypted: "account_number_encrypted",
      ifsc: "ifsc",
      accountHolderName: "account_holder_name",
      verificationStatus: "verification_status",
      nameAtBank: "name_at_bank",
      nameMatched: "name_matched",
      providerRequestId: "provider_request_id",
      verifiedAt: "verified_at"
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.bankVerifications().update(rowUpdates).eq("user_id", userId).select().single();
    if (error) throw error;
    return data;
  }
  async createBooking(booking) {
    const { data, error } = await db.bookings().insert(mapBookingToRow(booking)).select().single();
    if (error) throw error;
    return mapBookingFromRow(data);
  }
  async reserveBookingPayment(booking) {
    try {
      const { data, error } = await supabase.rpc("reserve_booking_payment", {
        p_booking_id: booking.id,
        p_booking_code: booking.bookingCode,
        p_client_id: booking.clientId,
        p_companion_id: booking.companionId,
        p_service_id: booking.serviceId,
        p_service_name: booking.serviceName,
        p_booking_date: booking.date,
        p_start_time: booking.startTime,
        p_end_time: booking.endTime,
        p_duration_hours: booking.durationHours,
        p_meeting_location: booking.meetingLocation,
        p_notes: booking.notes || null
      });
      if (!error && data && typeof data === "object") {
        return mapBookingFromRow(data);
      }
      if (error) {
        console.warn("reserve_booking_payment RPC returned error, using direct booking table reservation:", error.message || error);
      }
    } catch (rpcErr) {
      console.warn("reserve_booking_payment RPC threw, using direct booking table reservation:", rpcErr?.message || rpcErr);
    }
    const amountPaise = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const feePaise = Math.round(amountPaise * 0.15);
    const bookingRow = {
      id: booking.id,
      booking_code: booking.bookingCode,
      client_id: booking.clientId,
      companion_id: booking.companionId,
      service_id: booking.serviceId,
      service_name: booking.serviceName,
      booking_date: booking.date,
      start_time: booking.startTime,
      end_time: booking.endTime,
      duration_hours: booking.durationHours,
      meeting_location: booking.meetingLocation,
      notes: booking.notes || null,
      amount_paise: amountPaise,
      status: "PENDING",
      payment_status: "PENDING",
      admin_platform_fee_paise: feePaise,
      companion_gross_share_paise: amountPaise - feePaise,
      companion_net_share_paise: amountPaise - feePaise,
      settlement_status: "LOCKED"
    };
    const { data: inserted, error: insertErr } = await db.bookings().insert(bookingRow).select().single();
    if (insertErr) {
      console.error("Direct booking insert failed:", insertErr);
      throw insertErr;
    }
    return mapBookingFromRow(inserted);
  }
  async getBooking(id) {
    const { data, error } = await db.bookings().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }
  async getBookingByCode(code) {
    const { data, error } = await db.bookings().select("*").eq("booking_code", code).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }
  async getBookingByPaymentOrder(orderId) {
    const { data, error } = await db.bookings().select("*").eq("payment_order_id", orderId).maybeSingle();
    if (error) throw error;
    return data ? mapBookingFromRow(data) : null;
  }
  async listBookings(filters) {
    let query = db.bookings().select("*");
    if (filters?.participantId) {
      query = query.or(`client_id.eq.${filters.participantId},companion_id.eq.${filters.participantId}`);
    } else {
      if (filters?.clientId) query = query.eq("client_id", filters.clientId);
      if (filters?.companionId) query = query.eq("companion_id", filters.companionId);
    }
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapBookingFromRow);
  }
  async updateBooking(id, updates) {
    const fields = {
      bookingCode: "booking_code",
      status: "status",
      paymentOrderId: "payment_order_id",
      paymentId: "payment_id",
      paymentStatus: "payment_status",
      startOtpHmac: "start_otp_hash",
      endOtpHmac: "completion_otp_hash",
      startOtpAttempts: "start_otp_attempts",
      endOtpAttempts: "completion_otp_attempts",
      startOtpVerified: "start_otp_verified",
      endOtpVerified: "completion_otp_verified",
      companionArrivedAt: "companion_arrived_at",
      startedAt: "started_at",
      completedAt: "completed_at",
      delayMinutes: "delay_minutes",
      latePenaltyPaise: "late_penalty_paise",
      companionNetSharePaise: "companion_net_share_paise",
      clientRefundPenaltyPaise: "client_refund_penalty_paise",
      settlementStatus: "settlement_status",
      settlementUnlockUtc: "settlement_unlock_at",
      payoutId: "payout_id"
    };
    const rowUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => fields[key]).map(([key, value]) => [fields[key], value])
    );
    if (Object.keys(rowUpdates).length === 0) throw new Error("No supported booking fields were provided for update.");
    const { data, error } = await db.bookings().update(rowUpdates).eq("id", id).select().single();
    if (error) throw error;
    return mapBookingFromRow(data);
  }
  async markBookingCompanionArrived(bookingId, companionId) {
    const { data, error } = await supabase.rpc("mark_booking_companion_arrived", {
      p_booking_id: bookingId,
      p_companion_id: companionId
    });
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Supabase returned an invalid booking arrival response.");
    return mapBookingFromRow(data);
  }
  async verifyBookingOtp(bookingId, companionId, otpType, otpHash, delayMinutes = 0) {
    const { data, error } = await supabase.rpc("verify_booking_otp", {
      p_booking_id: bookingId,
      p_companion_id: companionId,
      p_otp_type: otpType,
      p_otp_hash: otpHash,
      p_delay_minutes: delayMinutes
    });
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Supabase returned an invalid booking OTP response.");
    return {
      ...data,
      booking: data.booking ? mapBookingFromRow(data.booking) : void 0
    };
  }
  async finalizeRazorpayPayment(orderId, paymentId, amountPaise, startOtpHash, completionOtpHash, startOtpEncrypted, completionOtpEncrypted) {
    const { data, error } = await supabase.rpc("finalize_razorpay_payment", {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_paise: amountPaise,
      p_start_otp_hash: startOtpHash,
      p_completion_otp_hash: completionOtpHash,
      p_start_otp_encrypted: startOtpEncrypted,
      p_completion_otp_encrypted: completionOtpEncrypted
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || !data.record) throw new Error("Supabase returned an invalid payment finalization response.");
    return {
      type: data.type,
      duplicate: Boolean(data.duplicate),
      record: data.type === "BOOKING" ? mapBookingFromRow(data.record) : data.record
    };
  }
  async createWalletEntry(entry) {
    const { data, error } = await db.walletLedger().insert({
      ...uuidOrUndefined(entry.id) ? { id: entry.id } : {},
      user_id: entry.userId,
      booking_id: entry.bookingId || null,
      transaction_type: entry.transactionType,
      gross_amount_paise: entry.grossAmountPaise ?? null,
      commission_paise: entry.commissionPaise ?? null,
      penalty_paise: entry.penaltyPaise ?? null,
      net_amount_paise: entry.netAmountPaise ?? null,
      balance_locked_until: entry.balanceLockedUntil || null,
      balance_status: entry.balanceStatus || "AVAILABLE",
      description: entry.description || null,
      idempotency_key: entry.idempotencyKey || null
    }).select().single();
    if (error) throw error;
    return data;
  }
  async getWalletBalance(userId) {
    const { data, error } = await db.walletLedger().select("*").eq("user_id", userId);
    if (error) throw error;
    let available = 0;
    let locked = 0;
    for (const entry of data || []) {
      if (entry.balance_status === "AVAILABLE") {
        available += entry.net_amount_paise || 0;
      } else if (entry.balance_status === "LOCKED") {
        locked += entry.net_amount_paise || 0;
      }
    }
    return { available, locked, total: available + locked };
  }
  async listWalletEntries(userId) {
    const { data, error } = await db.walletLedger().select("*").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      bookingId: row.booking_id,
      transactionType: row.transaction_type,
      grossAmountPaise: row.gross_amount_paise,
      commissionPaise: row.commission_paise,
      penaltyPaise: row.penalty_paise,
      netAmountPaise: row.net_amount_paise,
      balanceLockedUntil: row.balance_locked_until,
      balanceStatus: row.balance_status
    }));
  }
  async createPayout(payout) {
    const { data, error } = await db.payouts().insert({
      ...uuidOrUndefined(payout.id) ? { id: payout.id } : {},
      user_id: payout.userId || payout.companionId,
      booking_id: payout.bookingId || null,
      total_amount_paise: payout.totalAmountPaise ?? payout.amountPaise,
      commission_paise: payout.commissionPaise || 0,
      penalty_paise: payout.penaltyPaise || 0,
      net_amount_paise: payout.netAmountPaise ?? payout.amountPaise,
      payout_status: payout.payoutStatus || "PENDING",
      utr_reference: payout.utrReference || payout.utrNumber || null,
      admin_user_id: payout.adminId || null,
      processed_at: payout.processedAt || payout.paymentTimestamp || null,
      idempotency_key: payout.idempotencyKey || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      bookingId: data.booking_id,
      totalAmountPaise: data.total_amount_paise,
      commissionPaise: data.commission_paise,
      penaltyPaise: data.penalty_paise,
      netAmountPaise: data.net_amount_paise,
      payoutStatus: data.payout_status,
      utrReference: data.utr_reference,
      adminUserId: data.admin_user_id,
      processedAt: data.processed_at
    };
  }
  async listPayouts(filters) {
    let query = db.payouts().select("*");
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    if (filters?.status) query = query.eq("payout_status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      bookingId: row.booking_id,
      totalAmountPaise: row.total_amount_paise,
      commissionPaise: row.commission_paise,
      penaltyPaise: row.penalty_paise,
      netAmountPaise: row.net_amount_paise,
      payoutStatus: row.payout_status,
      utrReference: row.utr_reference,
      adminUserId: row.admin_user_id,
      processedAt: row.processed_at
    }));
  }
  async updatePayout(id, updates) {
    const rowUpdates = {};
    const fields = {
      payoutStatus: "payout_status",
      utrReference: "utr_reference",
      adminUserId: "admin_user_id",
      processedAt: "processed_at"
    };
    for (const [key, column] of Object.entries(fields)) {
      if (key in updates) rowUpdates[column] = updates[key];
    }
    const { data, error } = await db.payouts().update(rowUpdates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  async createConversation(conversation) {
    const { data, error } = await db.chatConversations().insert({
      ...uuidOrUndefined(conversation.id) ? { id: conversation.id } : {},
      booking_id: conversation.bookingId || null,
      participant_a: conversation.participantA,
      participant_b: conversation.participantB
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      bookingId: data.booking_id,
      participantA: data.participant_a,
      participantB: data.participant_b
    };
  }
  async getConversation(id) {
    const { data, error } = await db.chatConversations().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      bookingId: data.booking_id,
      participantA: data.participant_a,
      participantB: data.participant_b
    } : null;
  }
  async listConversations(userId) {
    const { data, error } = await db.chatConversations().select("*").or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      bookingId: row.booking_id,
      participantA: row.participant_a,
      participantB: row.participant_b
    }));
  }
  async createMessage(message) {
    const { data, error } = await db.chatMessages().insert({
      ...uuidOrUndefined(message.id) ? { id: message.id } : {},
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      message: message.message
    }).select().single();
    if (error) throw error;
    return { ...data, conversationId: data.conversation_id, senderId: data.sender_id };
  }
  async listMessages(conversationId, after) {
    let query = db.chatMessages().select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(200);
    if (after) query = query.gt("created_at", after);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      conversationId: row.conversation_id,
      senderId: row.sender_id
    }));
  }
  async createSupportConversation(conversation) {
    const { data, error } = await db.supportConversations().insert({
      ...uuidOrUndefined(conversation.id) ? { id: conversation.id } : {},
      user_id: conversation.userId,
      status: conversation.status || "OPEN",
      subject: conversation.subject || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id
    };
  }
  async getSupportConversation(id) {
    const { data, error } = await db.supportConversations().select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? {
      ...data,
      userId: data.user_id,
      assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id
    } : null;
  }
  async listSupportConversations(filters) {
    let query = db.supportConversations().select("*");
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      assignedAdminId: row.assigned_admin_user_id || row.assigned_admin_id
    }));
  }
  async createSupportMessage(message) {
    const { data, error } = await db.supportMessages().insert({
      ...uuidOrUndefined(message.id) ? { id: message.id } : {},
      conversation_id: message.conversationId,
      sender_id: message.isAdmin ? null : message.senderId,
      admin_user_id: message.isAdmin ? message.adminUserId || message.senderId : null,
      is_admin: message.isAdmin || false,
      message: message.message
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      adminUserId: data.admin_user_id,
      isAdmin: data.is_admin
    };
  }
  async listSupportMessages(conversationId, after) {
    let query = db.supportMessages().select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(200);
    if (after) {
      query = query.or(`created_at.gt.${after.createdAt},and(created_at.eq.${after.createdAt},id.gt.${after.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      adminUserId: row.admin_user_id,
      isAdmin: row.is_admin
    }));
  }
  async updateSupportConversation(id, updates) {
    const row = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if ("status" in updates) row.status = updates.status;
    if ("assignedAdminId" in updates) row.assigned_admin_user_id = updates.assignedAdminId;
    const { data, error } = await db.supportConversations().update(row).eq("id", id).select().single();
    if (error) throw error;
    return { ...data, userId: data.user_id, assignedAdminId: data.assigned_admin_user_id || data.assigned_admin_id };
  }
  async getAdminUser(email) {
    const { data, error } = await db.adminUsers().select("*").eq("email", email.toLowerCase()).eq("is_active", true).maybeSingle();
    if (error) throw error;
    return data ? this.mapAdminUser(data) : null;
  }
  async getAdminUserById(id) {
    const { data, error } = await db.adminUsers().select("*").eq("id", id).eq("is_active", true).maybeSingle();
    if (error) throw error;
    return data ? this.mapAdminUser(data) : null;
  }
  async updateAdminPasswordHash(id, passwordHash) {
    const { error } = await db.adminUsers().update({ password_hash: passwordHash }).eq("id", id);
    if (error) throw error;
  }
  mapAdminUser(admin) {
    return {
      ...admin,
      passwordHash: admin.password_hash,
      name: admin.legal_name
    };
  }
  async createAdminUser(admin) {
    const { data, error } = await db.adminUsers().insert({
      ...uuidOrUndefined(admin.id) ? { id: admin.id } : {},
      email: admin.email.toLowerCase(),
      phone: admin.phone,
      password_hash: admin.passwordHash,
      role: admin.role,
      legal_name: admin.name || admin.legalName,
      is_active: admin.isActive ?? true
    }).select().single();
    if (error) throw error;
    return this.mapAdminUser(data);
  }
  async listAdminUsers() {
    const { data, error } = await db.adminUsers().select("*");
    if (error) throw error;
    return (data || []).map((admin) => this.mapAdminUser(admin));
  }
  async updateAdminUserRole(id, role) {
    const { data, error } = await db.adminUsers().update({ role }).eq("id", id).select().single();
    if (error) throw error;
    return this.mapAdminUser(data);
  }
  async deleteAdminUser(id) {
    const { error } = await db.adminUsers().delete().eq("id", id);
    if (error) throw error;
  }
  async createAuditLog(log) {
    const { error } = await db.auditLogs().insert({
      ...uuidOrUndefined(log.id) ? { id: log.id } : {},
      admin_id: null,
      admin_user_id: uuidOrUndefined(log.adminUserId || log.adminId) || null,
      user_id: log.userId || null,
      action: log.action,
      entity_type: log.entityType || null,
      entity_id: uuidOrUndefined(log.entityId || log.targetId) || null,
      details: log.details ? { message: log.details } : null,
      ip_address: log.ipAddress || null,
      user_agent: log.userAgent || null
    });
    if (error) throw error;
  }
  async listAuditLogs(filters) {
    let query = db.auditLogs().select("*");
    if (filters?.adminId) query = query.or(`admin_id.eq.${filters.adminId},admin_user_id.eq.${filters.adminId}`);
    if (filters?.userId) query = query.eq("user_id", filters.userId);
    if (filters?.action) query = query.eq("action", filters.action);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }
  async createNotification(notification) {
    const { data, error } = await db.notifications().insert({
      ...uuidOrUndefined(notification.id) ? { id: notification.id } : {},
      user_id: notification.userId,
      type: notification.type || "GENERAL",
      title: notification.title,
      body: notification.body || null,
      data: notification.data || null,
      read_at: notification.readAt || null
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      userId: data.user_id,
      readAt: data.read_at,
      createdAt: data.created_at
    };
  }
  async listNotifications(userId) {
    const { data, error } = await db.notifications().select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      userId: row.user_id,
      readAt: row.read_at,
      createdAt: row.created_at
    }));
  }
  async markNotificationRead(id, userId) {
    let query = db.notifications().update({ read_at: (/* @__PURE__ */ new Date()).toISOString() }, { count: "exact" }).eq("id", id);
    if (userId) query = query.eq("user_id", userId);
    const { error, count } = await query;
    if (error) throw error;
    if (count === 0) throw new Error("Notification was not found.");
  }
  async claimNotificationPushes(notificationId, limit = 100) {
    const { data, error } = await db.rpc("claim_notification_pushes", {
      p_notification_id: notificationId || null,
      p_limit: Math.min(500, Math.max(1, Math.trunc(limit)))
    });
    if (error) throw error;
    return (data || []).map((row) => ({
      notification: row.notification,
      deviceTokens: row.device_tokens || []
    }));
  }
  async finishNotificationPush(id, success, errorMessage) {
    const { data, error } = await db.rpc("finish_notification_push", {
      p_notification_id: id,
      p_success: success,
      p_error: errorMessage || null
    });
    if (error) throw error;
    if (data !== true) throw new Error("Supabase did not complete the notification push claim.");
  }
  async registerDeviceToken(userId, token, platform) {
    const { error } = await db.firebaseDeviceTokens().upsert({
      user_id: userId,
      token,
      platform,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "token" });
    if (error) throw error;
  }
  async listDeviceTokens(userId) {
    const { data, error } = await db.firebaseDeviceTokens().select("token").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((row) => row.token);
  }
  async deleteDeviceToken(token, userId) {
    let query = db.firebaseDeviceTokens().delete().eq("token", token);
    if (userId) query = query.eq("user_id", userId);
    const { error } = await query;
    if (error) throw error;
  }
  async upsertUserLocation(location) {
    const { data, error } = await db.userLocations().upsert({
      user_id: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      booking_id: location.bookingId || null,
      sharing_enabled: location.sharingEnabled ?? false,
      updated_at: location.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return {
      userId: data.user_id,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      bookingId: data.booking_id,
      sharingEnabled: data.sharing_enabled,
      updatedAt: data.updated_at
    };
  }
  async getUserLocation(userId) {
    const { data, error } = await db.userLocations().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? {
      userId: data.user_id,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      bookingId: data.booking_id,
      sharingEnabled: data.sharing_enabled,
      updatedAt: data.updated_at
    } : null;
  }
  async deleteUserLocation(userId) {
    const { error, count } = await db.userLocations().delete({ count: "exact" }).eq("user_id", userId);
    if (error) throw error;
    if (count === 0) throw new Error("User location was not found.");
  }
  async upsertUserPresence(presence) {
    const { data, error } = await db.userPresence().upsert({
      user_id: presence.userId,
      is_online: presence.online,
      last_seen_at: presence.lastSeen || (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return { userId: data.user_id, online: data.is_online, lastSeen: data.last_seen_at };
  }
  async getUserPresence(userId) {
    const { data, error } = await db.userPresence().select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? { userId: data.user_id, online: data.is_online, lastSeen: data.last_seen_at } : null;
  }
  async setBookingLocationSharing(bookingId, userId, enabled) {
    const { error } = await supabase.from("booking_location_sharing").upsert({
      booking_id: bookingId,
      user_id: userId,
      sharing_enabled: enabled,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { onConflict: "booking_id,user_id" });
    if (error) throw error;
  }
  async getBookingLocationSharing(bookingId, userId) {
    const { data, error } = await supabase.from("booking_location_sharing").select("sharing_enabled").eq("booking_id", bookingId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data?.sharing_enabled === true;
  }
  async consumeRateLimit(bucketKey, limit, windowSeconds) {
    const { data, error } = await supabase.rpc("consume_api_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds
    });
    if (error) throw error;
    if (typeof data?.allowed !== "boolean") throw new Error("Supabase returned an invalid rate-limit response.");
    return data;
  }
  async isSessionRevoked(tokenId) {
    const { data, error } = await supabase.rpc("is_session_revoked", { p_token_id: tokenId });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid session status.");
    return data;
  }
  async revokeSession(tokenId, principalId, principalType, expiresAt) {
    const { error } = await supabase.rpc("revoke_session", {
      p_token_id: tokenId,
      p_principal_id: principalId,
      p_principal_type: principalType,
      p_expires_at: expiresAt
    });
    if (error) throw error;
  }
  async claimPaymentWebhookEvent(eventId, eventType, payload) {
    const { data, error } = await supabase.rpc("claim_payment_webhook_event", {
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload
    });
    if (error) throw error;
    if (!data || typeof data.claimed !== "boolean" || typeof data.processed !== "boolean") {
      throw new Error("Supabase returned an invalid webhook event claim.");
    }
    return data;
  }
  async completePaymentWebhookEvent(eventId, errorMessage) {
    const { error } = await supabase.rpc("complete_payment_webhook_event", {
      p_event_id: eventId,
      p_error: errorMessage || null
    });
    if (error) throw error;
  }
  async markRazorpayOrderFailed(orderId, paymentId) {
    try {
      const { data, error } = await supabase.rpc("mark_razorpay_order_failed", {
        p_order_id: orderId,
        p_payment_id: paymentId || null
      });
      if (!error && typeof data === "boolean") return data;
    } catch (e) {
      console.warn("mark_razorpay_order_failed rpc warning:", e);
    }
    try {
      await db.bookings().update({ payment_status: "FAILED", status: "CANCELLED", ...paymentId ? { payment_id: paymentId } : {} }).eq("payment_order_id", orderId);
      await db.companionMemberships().update({ payment_status: "FAILED", ...paymentId ? { payment_id: paymentId } : {} }).eq("payment_order_id", orderId);
      return true;
    } catch (e) {
      console.warn("markRazorpayOrderFailed direct update warning:", e);
      return false;
    }
  }
  async markRazorpayOrderCancelled(orderId) {
    try {
      await db.bookings().update({ payment_status: "CANCELLED", status: "CANCELLED" }).eq("payment_order_id", orderId);
      await db.companionMemberships().update({ payment_status: "CANCELLED" }).eq("payment_order_id", orderId);
      return true;
    } catch (e) {
      console.warn("markRazorpayOrderCancelled direct update warning:", e);
      return false;
    }
  }
  async reservePaymentRefund(refund) {
    const { data, error } = await supabase.rpc("reserve_payment_refund", {
      p_booking_id: refund.bookingId || null,
      p_membership_id: refund.membershipId || null,
      p_payment_id: refund.paymentId,
      p_amount_paise: refund.amountPaise,
      p_idempotency_key: refund.idempotencyKey,
      p_reason: refund.reason,
      p_admin_user_id: refund.adminUserId
    });
    if (error) throw error;
    if (!data?.id || data.idempotency_key !== refund.idempotencyKey) {
      throw new Error("Supabase returned an invalid refund reservation.");
    }
    return data;
  }
  async listPaymentRefunds(filters) {
    let query = db.paymentRefunds().select("*");
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.bookingId) query = query.eq("booking_id", filters.bookingId);
    if (filters?.paymentId) query = query.eq("payment_id", filters.paymentId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data || [];
  }
  async updatePaymentRefund(idempotencyKey, status, providerRefundId) {
    const { data, error } = await supabase.rpc("update_payment_refund", {
      p_idempotency_key: idempotencyKey,
      p_status: status,
      p_provider_refund_id: providerRefundId || null
    });
    if (error) throw error;
    return data;
  }
  async processBookingPayout(bookingId, adminUserId, utrReference) {
    const { data, error } = await supabase.rpc("process_booking_payout", {
      p_booking_id: bookingId,
      p_admin_user_id: adminUserId,
      p_utr_reference: utrReference
    });
    if (error) throw error;
    if (!data?.id) throw new Error("Supabase returned an invalid payout result.");
    return data;
  }
  async claimScheduledJobRun(jobName, idempotencyKey) {
    const { data, error } = await supabase.rpc("claim_scheduled_job_run", {
      p_job_name: jobName,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid scheduled-job claim.");
    return data;
  }
  async finishScheduledJobRun(jobName, idempotencyKey, errorMessage) {
    const { error } = await supabase.rpc("finish_scheduled_job_run", {
      p_job_name: jobName,
      p_idempotency_key: idempotencyKey,
      p_error: errorMessage || null
    });
    if (error) throw error;
  }
  async runScheduledMaintenance() {
    const { data, error } = await supabase.rpc("run_scheduled_maintenance");
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("Supabase returned an invalid scheduled-maintenance result.");
    return data;
  }
  async reserveAdminSensitiveMfa(adminUserId, action, otpHash) {
    const { data, error } = await supabase.rpc("reserve_admin_sensitive_mfa", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (typeof data?.allowed !== "boolean") throw new Error("Supabase returned an invalid sensitive MFA reservation.");
    return data;
  }
  async completeAdminSensitiveMfaDelivery(adminUserId, action, sent) {
    const { data, error } = await supabase.rpc("complete_admin_sensitive_mfa_delivery", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_sent: sent
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid sensitive MFA delivery result.");
    return data;
  }
  async verifyAdminSensitiveMfa(adminUserId, action, otpHash) {
    const { data, error } = await supabase.rpc("verify_admin_sensitive_mfa", {
      p_admin_user_id: adminUserId,
      p_action: action,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!["verified", "not_found", "expired", "locked", "invalid"].includes(data)) {
      throw new Error("Supabase returned an invalid sensitive MFA verification result.");
    }
    return data;
  }
  async consumeAdminSensitiveMfa(adminUserId, action) {
    const { data, error } = await supabase.rpc("consume_admin_sensitive_mfa", {
      p_admin_user_id: adminUserId,
      p_action: action
    });
    if (error) throw error;
    if (typeof data !== "boolean") throw new Error("Supabase returned an invalid sensitive Admin MFA result.");
    return data;
  }
  async reserveOtp(phone, otpHash) {
    const { data, error } = await supabase.rpc("reserve_auth_otp", {
      p_phone: phone,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== "boolean") {
      throw new Error("Supabase returned an invalid OTP reservation response.");
    }
    return {
      allowed: data.allowed,
      reason: data.reason === "cooldown" || data.reason === "rate_limit" ? data.reason : void 0,
      waitSeconds: typeof data.waitSeconds === "number" ? data.waitSeconds : void 0
    };
  }
  async setOtpDeliveryResult(phone, sent, requestId) {
    const { data, error } = await supabase.rpc("complete_auth_otp_delivery", {
      p_phone: phone,
      p_sent: sent,
      p_request_id: requestId || null
    });
    if (error) throw error;
    if (!data) throw new Error("OTP challenge was not pending delivery.");
  }
  async verifyOtp(phone, otpHash) {
    const { data, error } = await supabase.rpc("verify_auth_otp", {
      p_phone: phone,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (data === "verified" || data === "not_found" || data === "expired" || data === "locked" || data === "invalid") {
      return data;
    }
    throw new Error("Supabase returned an invalid OTP verification response.");
  }
  async reserveAdminMfa(email, otpHash) {
    const { data, error } = await supabase.rpc("reserve_admin_mfa", {
      p_email: email,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== "boolean") {
      throw new Error("Supabase returned an invalid administrator MFA reservation response.");
    }
    return {
      allowed: data.allowed,
      reason: data.reason === "cooldown" || data.reason === "rate_limit" ? data.reason : void 0,
      waitSeconds: typeof data.waitSeconds === "number" ? data.waitSeconds : void 0
    };
  }
  async setAdminMfaDeliveryResult(email, sent, requestId) {
    const { data, error } = await supabase.rpc("complete_admin_mfa_delivery", {
      p_email: email,
      p_sent: sent,
      p_request_id: requestId || null
    });
    if (error) throw error;
    if (!data) throw new Error("Administrator MFA challenge was not pending delivery.");
  }
  async verifyAdminMfa(email, otpHash) {
    const { data, error } = await supabase.rpc("verify_admin_mfa", {
      p_email: email,
      p_otp_hash: otpHash
    });
    if (error) throw error;
    if (data === "verified" || data === "not_found" || data === "expired" || data === "locked" || data === "invalid") {
      return data;
    }
    throw new Error("Supabase returned an invalid administrator MFA verification response.");
  }
  async createIncidentReport(report) {
    const item = {
      ...report,
      id: report.id || `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: report.status || "PENDING_REVIEW",
      createdAt: report.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await db.auditLogs().insert({
        action: "INCIDENT_REPORT",
        entity_type: "incident_report",
        entity_id: uuidOrUndefined(item.bookingId) || null,
        details: item
      });
    } catch (e) {
      console.warn("Supabase createIncidentReport audit log warning:", e.message);
    }
    return item;
  }
  async listIncidentReports(filters) {
    try {
      const { data, error } = await db.auditLogs().select("*").eq("action", "INCIDENT_REPORT").order("created_at", { ascending: false });
      if (error) throw error;
      const reports = (data || []).map((row) => {
        const details = row.details || {};
        return {
          id: details.id || row.id,
          ...details,
          createdAt: details.createdAt || row.created_at
        };
      });
      return reports;
    } catch (e) {
      console.warn("Supabase listIncidentReports error:", e.message);
      return [];
    }
  }
  async updateIncidentReport(id, updates) {
    try {
      const reports = await this.listIncidentReports();
      const existing = reports.find((r) => r.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await db.auditLogs().insert({
        action: "INCIDENT_REPORT_UPDATE",
        entity_type: "incident_report",
        entity_id: uuidOrUndefined(existing.bookingId) || null,
        details: updated
      });
      return updated;
    } catch (e) {
      console.warn("Supabase updateIncidentReport error:", e.message);
      return null;
    }
  }
};
var production = process.env.NODE_ENV === "production";
if (production && !isSupabaseConfigured()) {
  throw new Error("Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; JSON database fallback is disabled.");
}
var databaseAdapter = isSupabaseConfigured() ? new SupabaseDatabaseAdapter() : new JsonDatabaseAdapter();
function getDatabaseType() {
  return databaseAdapter instanceof SupabaseDatabaseAdapter ? "supabase" : "json";
}

// server/services/firebase.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
var firebaseApp = null;
var rtdb = null;
function initializeFirebase() {
  if (firebaseApp) return firebaseApp;
  const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const databaseURL = process.env.FIREBASE_DATABASE_URL?.trim();
  if (!serviceAccountKey || !projectId || !clientEmail || !databaseURL) {
    console.warn("Firebase Admin credentials or FIREBASE_DATABASE_URL are not configured. Firebase features will be disabled.");
    return null;
  }
  try {
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, "\n")
    };
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      databaseURL
    });
    rtdb = getDatabase(firebaseApp);
    console.log("Firebase Admin SDK initialized successfully");
    return firebaseApp;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}
function getRTDB() {
  if (!rtdb) {
    initializeFirebase();
  }
  if (!rtdb) throw new Error("Firebase Realtime Database is not configured.");
  return rtdb;
}
async function updateUserLocation(userId, latitude, longitude, bookingId) {
  const db3 = getRTDB();
  const update = { userId, latitude, longitude, timestamp: Date.now(), bookingId };
  await db3.ref(`bookings/${bookingId}/locations/${userId}`).set(update);
}
async function getUserLocation(userId, bookingId) {
  const db3 = getRTDB();
  const snapshot = await db3.ref(`bookings/${bookingId}/locations/${userId}`).once("value");
  return snapshot.val();
}
async function removeUserLocation(userId, bookingId) {
  const db3 = getRTDB();
  await db3.ref(`bookings/${bookingId}/locations/${userId}`).remove();
}
async function startLocationSharing(userId, bookingId) {
  const db3 = getRTDB();
  await db3.ref(`bookings/${bookingId}/participants/${userId}/sharing`).set(true);
  await db3.ref(`bookings/${bookingId}/participants/${userId}/startedAt`).set(Date.now());
}
async function stopLocationSharing(userId, bookingId) {
  const db3 = getRTDB();
  await db3.ref(`bookings/${bookingId}/participants/${userId}/sharing`).set(false);
  await db3.ref(`bookings/${bookingId}/participants/${userId}/stoppedAt`).set(Date.now());
  await removeUserLocation(userId, bookingId);
}
async function setUserPresence(userId, online) {
  const db3 = getRTDB();
  const presenceRef = db3.ref(`presence/${userId}`);
  await presenceRef.set({ online, lastSeen: Date.now() });
  if (online) {
    await presenceRef.onDisconnect().set({ online: false, lastSeen: Date.now() });
  }
  return true;
}
async function getUserPresence(userId) {
  const db3 = getRTDB();
  const snapshot = await db3.ref(`presence/${userId}`).once("value");
  return snapshot.val();
}
function isFirebaseConfigured() {
  return !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_DATABASE_URL);
}

// server/services/fcm.ts
import { getApps, initializeApp as initializeApp2, cert as cert2 } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
var messaging = null;
function initializeFCM() {
  try {
    const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    if (!serviceAccountKey || !projectId || !clientEmail) {
      console.warn("Firebase credentials not configured. FCM will be disabled.");
      return null;
    }
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, "\n")
    };
    const app2 = getApps().find((candidate) => candidate.name === "fcm-app") || initializeApp2({
      credential: cert2(serviceAccount),
      ...process.env.FIREBASE_DATABASE_URL ? { databaseURL: process.env.FIREBASE_DATABASE_URL } : {}
    }, "fcm-app");
    messaging = getMessaging(app2);
    console.log("Firebase Cloud Messaging initialized successfully");
    return messaging;
  } catch (error) {
    console.error("Failed to initialize FCM:", error);
    return null;
  }
}
function getFCM() {
  if (!messaging) {
    messaging = initializeFCM();
  }
  return messaging;
}
async function sendToMultipleDevices(tokens, notification, data) {
  const fcm = getFCM();
  if (!fcm) {
    throw new Error("Firebase Cloud Messaging is not configured.");
  }
  if (tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };
  try {
    const invalidTokens = [];
    let success = 0;
    let failure = 0;
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const message = {
        tokens: batch,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data
      };
      const response = await fcm.sendEachForMulticast(message);
      success += response.successCount;
      failure += response.failureCount;
      response.responses.forEach((resp, index) => {
        if (!resp.success && (resp.error?.code === "messaging/registration-token-not-registered" || resp.error?.code === "messaging/invalid-registration-token")) {
          invalidTokens.push(batch[index]);
        }
      });
    }
    return {
      success,
      failure,
      invalidTokens
    };
  } catch (error) {
    throw error;
  }
}

// server/services/googlemaps.ts
var GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
async function getFallbackIndiaPredictions(input) {
  const predictions = [];
  const seen = /* @__PURE__ */ new Set();
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&countrycodes=IN&format=json&addressdetails=1&limit=8&accept-language=en`;
    const res = await fetch(nomUrl, {
      signal: AbortSignal.timeout(6e3),
      headers: {
        "User-Agent": "PairUpToday/1.0 (pairuptoday.in contact@pairuptoday.in)",
        "Accept": "application/json"
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const r of data) {
          const parts = (r.display_name || "").split(", ");
          const main = parts.slice(0, 2).join(", ");
          const secondary = parts.slice(2).join(", ");
          const key = main.toLowerCase().replace(/[\s,.\-]+/g, "");
          if (!seen.has(key)) {
            seen.add(key);
            predictions.push({
              description: r.display_name,
              place_id: `osm_${r.place_id}`,
              structured_formatting: {
                main_text: main,
                secondary_text: secondary || "India"
              }
            });
          }
        }
      }
    }
  } catch (e) {
  }
  if (predictions.length < 5) {
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=8&lang=en&lat=20.5937&lon=78.9629`;
      const res = await fetch(photonUrl, {
        signal: AbortSignal.timeout(5e3),
        headers: { "Accept": "application/json" }
      });
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith("{")) {
          const data = JSON.parse(text);
          for (const f of data.features || []) {
            const p = f.properties;
            if (p.country && !["India", "IN"].includes(p.country)) continue;
            const main = [p.name || "", p.housenumber || "", p.street || ""].filter(Boolean).join(" ") || p.city || p.district || "";
            const sec = [p.suburb, p.city || p.district, p.state, p.postcode].filter(Boolean).join(", ");
            const full = [main, sec].filter(Boolean).join(", ");
            const key = main.toLowerCase().replace(/[\s,.\-]+/g, "");
            if (main && !seen.has(key)) {
              seen.add(key);
              predictions.push({
                description: full,
                place_id: `photon_${p.osm_id || Math.random()}`,
                structured_formatting: {
                  main_text: main,
                  secondary_text: sec || "India"
                }
              });
            }
          }
        }
      }
    } catch (e) {
    }
  }
  return predictions;
}
async function getPlaceAutocomplete(input, location, radius) {
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY") {
    try {
      const params = new URLSearchParams({
        input,
        key: GOOGLE_MAPS_API_KEY,
        components: "country:IN"
        // Restrict to all of India
      });
      if (location && radius) {
        params.append("location", `${location.lat},${location.lng}`);
        params.append("radius", radius.toString());
      }
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
        { signal: AbortSignal.timeout(8e3) }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && Array.isArray(data.predictions)) {
          return data.predictions;
        }
        if (data.status === "ZERO_RESULTS") {
          return [];
        }
        console.warn(`[GooglePlaces] API status '${data.status}': ${data.error_message || "Falling back to India OSM geocoder"}`);
      } else {
        console.warn(`[GooglePlaces] HTTP ${response.status}: Falling back to India OSM geocoder`);
      }
    } catch (error) {
      console.warn(`[GooglePlaces] Error: ${error.message}. Falling back to India OSM geocoder`);
    }
  }
  return getFallbackIndiaPredictions(input);
}
async function geocodeAddress(addressOrPlaceId, isPlaceId = false) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured.");
  }
  try {
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY
    });
    if (isPlaceId) {
      params.append("place_id", addressOrPlaceId);
    } else {
      params.append("address", addressOrPlaceId);
    }
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { signal: AbortSignal.timeout(15e3) }
    );
    if (!response.ok) throw new Error(`Google Geocoding returned HTTP ${response.status}.`);
    const data = await response.json();
    if (data.status === "OK" && data.results && data.results.length > 0) {
      return data.results[0];
    }
    if (data.status === "ZERO_RESULTS") return null;
    throw new Error(`Google Geocoding failed: ${data.status || "invalid response"}.`);
  } catch (error) {
    console.error("Failed to geocode address:", error);
    throw error;
  }
}
async function reverseGeocode(lat, lng) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured.");
  }
  try {
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      latlng: `${lat},${lng}`
    });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { signal: AbortSignal.timeout(15e3) }
    );
    if (!response.ok) throw new Error(`Google reverse geocoding returned HTTP ${response.status}.`);
    const data = await response.json();
    if (data.status === "OK" && data.results && data.results.length > 0) {
      return data.results[0];
    }
    if (data.status === "ZERO_RESULTS") return null;
    throw new Error(`Google reverse geocoding failed: ${data.status || "invalid response"}.`);
  } catch (error) {
    console.error("Failed to reverse geocode:", error);
    throw error;
  }
}
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
async function getDistanceMatrix(origins, destinations) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured.");
  }
  try {
    const originStr = origins.map((o) => `${o.lat},${o.lng}`).join("|");
    const destStr = destinations.map((d) => `${d.lat},${d.lng}`).join("|");
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      origins: originStr,
      destinations: destStr,
      mode: "driving",
      units: "metric"
    });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
      { signal: AbortSignal.timeout(15e3) }
    );
    if (!response.ok) throw new Error(`Google Distance Matrix returned HTTP ${response.status}.`);
    const data = await response.json();
    if (data.status === "OK" && data.rows) {
      return data.rows.map((row) => row.elements);
    }
    throw new Error(`Google Distance Matrix failed: ${data.status || "invalid response"}.`);
  } catch (error) {
    console.error("Failed to get distance matrix:", error);
    throw error;
  }
}
function isGoogleMapsConfigured() {
  return !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY";
}

// server/services/passwords.ts
import crypto3 from "crypto";
var LEGACY_SALT = "_pairup_salt_2026";
var SCRYPT_COST = 16384;
var SCRYPT_BLOCK_SIZE = 8;
var SCRYPT_PARALLELIZATION = 1;
var KEY_LENGTH = 64;
async function hashPassword(password) {
  const salt = crypto3.randomBytes(16);
  const derivedKey = await deriveKey(password, salt, SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELIZATION);
  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
}
async function verifyPassword(password, storedHash) {
  if (storedHash.startsWith("scrypt$")) {
    const [algorithm, costText, blockSizeText, parallelizationText, saltText, keyText, extra] = storedHash.split("$");
    const cost = Number(costText);
    const blockSize = Number(blockSizeText);
    const parallelization = Number(parallelizationText);
    if (algorithm !== "scrypt" || extra !== void 0 || !Number.isSafeInteger(cost) || cost < 2 || cost > 1048576 || (cost & cost - 1) !== 0 || !Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 32 || cost * blockSize > 1048576 || !Number.isSafeInteger(parallelization) || parallelization < 1 || parallelization > 16 || !saltText || !keyText) {
      return { valid: false };
    }
    const salt = Buffer.from(saltText, "base64url");
    const expectedKey = Buffer.from(keyText, "base64url");
    if (salt.length < 16 || salt.length > 64 || expectedKey.length !== KEY_LENGTH) {
      return { valid: false };
    }
    const actualKey = await deriveKey(password, salt, cost, blockSize, parallelization);
    return { valid: crypto3.timingSafeEqual(actualKey, expectedKey) };
  }
  if (!/^[a-f0-9]{64}$/i.test(storedHash)) {
    return { valid: false };
  }
  const expectedLegacyHash = Buffer.from(storedHash, "hex");
  const actualLegacyHash = crypto3.createHash("sha256").update(password + LEGACY_SALT).digest();
  if (!crypto3.timingSafeEqual(actualLegacyHash, expectedLegacyHash)) {
    return { valid: false };
  }
  return { valid: true, upgradedHash: await hashPassword(password) };
}
function deriveKey(password, salt, cost, blockSize, parallelization) {
  return new Promise((resolve, reject) => {
    crypto3.scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelization, maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => error ? reject(error) : resolve(derivedKey)
    );
  });
}

// src/constants/services.ts
var PAIRUP_SERVICES = [
  {
    id: 1,
    name: "Social & Conversation Companion",
    description: "Friendly companionship for conversations, casual chats, sharing stories and spending pleasant leisure time together.",
    iconName: "MessageCircleHeart",
    category: "social",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 2,
    name: "Cafe & Restaurant Companion",
    description: "A companion for visiting caf\xE9s, restaurants, coffee shops and new food destinations and enjoying time together.",
    iconName: "Coffee",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 3,
    name: "Movie & Cinema Companion",
    description: "Enjoy movies together at cinema halls, multiplexes and special movie screenings.",
    iconName: "Film",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 4,
    name: "Shopping Companion",
    description: "Companionship for shopping malls, clothing stores, markets and other shopping activities, including general assistance in choosing items.",
    iconName: "ShoppingBag",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 5,
    name: "Travel & Holiday Companion",
    description: "Friendly companionship for domestic and international travel, holidays, tours and tourism trips.",
    iconName: "Plane",
    category: "travel",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 6,
    name: "City Tour & Sightseeing Companion",
    description: "Explore city attractions, popular spots, parks and new places with a companion.",
    iconName: "Compass",
    category: "travel",
    image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 7,
    name: "Event & Exhibition Companion",
    description: "Companionship for exhibitions, fairs, book fairs, cultural programmes and public events.",
    iconName: "Calendar",
    category: "culture",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 8,
    name: "Wedding & Ceremony Companion",
    description: "Companionship for weddings, receptions, family functions and social ceremonies.",
    iconName: "Sparkles",
    category: "social",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 9,
    name: "Party & Clubbing Companion",
    description: "Companionship for social parties, special occasions and permitted entertainment events.",
    iconName: "PartyPopper",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 10,
    name: "Concert & Live Music Companion",
    description: "Enjoy live music, concerts, band performances and music festivals together.",
    iconName: "Music",
    category: "culture",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 11,
    name: "Sports & Stadium Companion",
    description: "Enjoy cricket, football and other sports at stadiums and sporting events with a companion.",
    iconName: "Trophy",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 12,
    name: "Fitness & Walking Companion",
    description: "Companionship for walking, jogging, spending time in parks and general fitness activities.",
    iconName: "Activity",
    category: "wellness",
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 13,
    name: "Outdoor Activities Companion",
    description: "Companionship for picnics, park visits, spending time in nature and other outdoor activities.",
    iconName: "Trees",
    category: "wellness",
    image: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 14,
    name: "Hobby & Creative Activities Companion",
    description: "Spend time together on painting, photography, handicrafts and other creative hobbies.",
    iconName: "Palette",
    category: "culture",
    image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 15,
    name: "Gaming & Indoor Activities Companion",
    description: "Enjoy chess, board games, card games and other indoor recreational activities together.",
    iconName: "Gamepad2",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 16,
    name: "Study & Co-working Companion",
    description: "Spend time studying or working together in libraries, study spaces and co-working environments.",
    iconName: "BookOpen",
    category: "social",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 17,
    name: "Senior Citizen Companionship",
    description: "Friendly companionship for senior citizens through conversations, casual chats, walking and social activities.",
    iconName: "HeartHandshake",
    category: "care",
    image: "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 18,
    name: "Hospital & Medical Appointment Companion",
    description: "Companionship during travel to hospitals, clinics or medical appointments and while waiting. This is not a medical service.",
    iconName: "Building2",
    category: "care",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 19,
    name: "Daily Errands & Market Companion",
    description: "Companionship for markets, post offices, banks, shopping and other ordinary daily errands.",
    iconName: "CheckSquare",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 20,
    name: "Religious & Spiritual Visit Companion",
    description: "Companionship for visits to temples, mosques, churches, gurudwaras and other religious or spiritual places.",
    iconName: "Sun",
    category: "culture",
    image: "https://images.unsplash.com/photo-1561361066-51368ca52219?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 21,
    name: "Airport & Railway Travel Companion",
    description: "Companionship and general assistance before or after journeys at airports and railway stations.",
    iconName: "TrainTrack",
    category: "travel",
    image: "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 22,
    name: "Local Exploration & Food Discovery Companion",
    description: "Discover local food, street food, popular markets and new places around the city with a companion.",
    iconName: "Utensils",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 23,
    name: "Tourist Guide & Local Exploration Companion",
    description: "Explore historical places, heritage sites, tourist attractions, local culture and tourism destinations with a companion. Professional guiding must be performed only where the required qualifications and permissions are available.",
    iconName: "MapPin",
    category: "travel",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 24,
    name: "Elder Care & Daily Living Assistance Companion",
    description: "Companionship for elderly individuals in everyday life, including walking, general assistance, meal reminders, shopping, social activities and accompanying them to necessary appointments.",
    iconName: "ShieldCheck",
    category: "care",
    image: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80"
  }
];

// server.ts
import * as webpushModule from "web-push";
var webpush = webpushModule.default || webpushModule;
var KNOWN_CITY_COORDINATES = {
  "delhi": { lat: 28.6139, lng: 77.209 },
  "new delhi": { lat: 28.6139, lng: 77.209 },
  "burdwan": { lat: 23.2324, lng: 87.8615 },
  "bardhaman": { lat: 23.2324, lng: 87.8615 },
  "baranagar": { lat: 22.6433, lng: 88.3653 },
  "dumdum": { lat: 22.642, lng: 88.4312 },
  "dum dum": { lat: 22.642, lng: 88.4312 },
  "saltlake": { lat: 22.5804, lng: 88.4237 },
  "salt lake": { lat: 22.5804, lng: 88.4237 },
  "bidhannagar": { lat: 22.5804, lng: 88.4237 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
  "calcutta": { lat: 22.5726, lng: 88.3639 },
  "azadgarh": { lat: 22.4883, lng: 88.3585 },
  "golf garden": { lat: 22.4965, lng: 88.3546 },
  "tollygunge": { lat: 22.4988, lng: 88.3473 },
  "jadavpur": { lat: 22.4988, lng: 88.3718 },
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "mumbai": { lat: 19.076, lng: 72.8777 },
  "ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "hyderabad": { lat: 17.385, lng: 78.4867 },
  "pune": { lat: 18.5204, lng: 73.8567 },
  "jaipur": { lat: 26.9124, lng: 75.7873 },
  "lucknow": { lat: 26.8467, lng: 80.9462 },
  "chandigarh": { lat: 30.7333, lng: 76.7794 },
  "goa": { lat: 15.2993, lng: 74.124 },
  "kochi": { lat: 9.9312, lng: 76.2673 },
  "indore": { lat: 22.7196, lng: 75.8577 },
  "surat": { lat: 21.1702, lng: 72.8311 },
  "patna": { lat: 25.5941, lng: 85.1376 },
  "bhopal": { lat: 23.2599, lng: 77.4126 },
  "nagpur": { lat: 21.1458, lng: 79.0882 },
  "coimbatore": { lat: 11.0168, lng: 76.9558 },
  "visakhapatnam": { lat: 17.6868, lng: 83.2185 },
  "noida": { lat: 28.5355, lng: 77.391 },
  "gurugram": { lat: 28.4595, lng: 77.0266 },
  "gurgaon": { lat: 28.4595, lng: 77.0266 }
};
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(express.json({
  limit: "22mb",
  verify: (req, _res, buffer) => {
    Object.assign(req, { rawBody: Buffer.from(buffer) });
  }
}));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
var DATA_DIR2 = path2.join(__dirname2, "data");
var DB_FILE2 = path2.join(DATA_DIR2, "pairuptoday_db.json");
if (!fs2.existsSync(DATA_DIR2)) {
  try {
    fs2.mkdirSync(DATA_DIR2, { recursive: true });
  } catch (err) {
  }
}
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  const allowedOrigins = [
    process.env.CLIENT_ORIGIN || "https://pairuptoday.com",
    process.env.ADMIN_ORIGIN || "https://admin.pairuptoday.com"
  ];
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
  }
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Test-Harness");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var MIN_SECRET_LENGTH = 32;
function isOtpHmacSecretConfigured() {
  return Boolean(process.env.OTP_HMAC_SECRET && process.env.OTP_HMAC_SECRET.length >= MIN_SECRET_LENGTH);
}
function isSessionSecretConfigured() {
  return Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= MIN_SECRET_LENGTH);
}
function legacySeedPasswordHash(password) {
  return crypto4.createHash("sha256").update(password + "_pairup_salt_2026").digest("hex");
}
function hashOtp(otp) {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("OTP_HMAC_SECRET must contain at least 32 characters.");
  }
  return crypto4.createHmac("sha256", secret).update((otp || "").trim()).digest("hex");
}
function encryptBookingOtp(otp) {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("OTP_HMAC_SECRET must contain at least 32 characters.");
  }
  const key = crypto4.createHash("sha256").update(`booking-otp-encryption:${secret}`).digest();
  const iv = crypto4.randomBytes(12);
  const cipher = crypto4.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(otp, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}
function decryptBookingOtp(encrypted) {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("OTP_HMAC_SECRET must contain at least 32 characters.");
  }
  const [version, ivText, tagText, ciphertextText] = encrypted.split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("Stored booking OTP encryption is invalid.");
  const key = crypto4.createHash("sha256").update(`booking-otp-encryption:${secret}`).digest();
  const decipher = crypto4.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
function encryptBankAccount(accountNumber) {
  const secret = process.env.BANK_ACCOUNT_ENCRYPTION_KEY?.trim() || "";
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("BANK_ACCOUNT_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  }
  const iv = crypto4.randomBytes(12);
  const cipher = crypto4.createCipheriv("aes-256-gcm", Buffer.from(secret, "hex"), iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}
function decryptBankAccount(encrypted) {
  const secret = process.env.BANK_ACCOUNT_ENCRYPTION_KEY?.trim() || "";
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("BANK_ACCOUNT_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  }
  const [version, ivText, tagText, ciphertextText] = encrypted.split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("Stored bank-account encryption is invalid.");
  const decipher = crypto4.createDecipheriv("aes-256-gcm", Buffer.from(secret, "hex"), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
function verifyOtpHash(enteredOtp, expectedHash) {
  if (!enteredOtp || !expectedHash) return false;
  const computedHash = hashOtp(enteredOtp);
  const computedBuf = Buffer.from(computedHash, "hex");
  const expectedBuf = Buffer.from(expectedHash, "hex");
  if (computedBuf.length !== expectedBuf.length) return false;
  return crypto4.timingSafeEqual(computedBuf, expectedBuf);
}
var AUTHORIZED_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "KYC_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "AUDITOR"
];
async function createAndSendNotification(notification) {
  const stored = await databaseAdapter.createNotification(notification);
  let claim;
  try {
    const claims = await databaseAdapter.claimNotificationPushes(stored.id, 1);
    claim = claims[0];
    if (!claim) return stored;
    if (!claim.deviceTokens.length) {
      await databaseAdapter.finishNotificationPush(stored.id, true);
      return stored;
    }
    const result = await sendToMultipleDevices(claim.deviceTokens, {
      title: notification.title,
      body: notification.body
    }, notification.data);
    await Promise.all(result.invalidTokens.map((token) => databaseAdapter.deleteDeviceToken(token, notification.userId)));
    if (result.failure > 0) {
      await databaseAdapter.finishNotificationPush(stored.id, false, `${result.failure} device(s) rejected the push.`);
      console.warn("Some registered devices did not receive a push notification.");
    } else {
      await databaseAdapter.finishNotificationPush(stored.id, true);
    }
  } catch (error) {
    if (claim) {
      try {
        await databaseAdapter.finishNotificationPush(
          stored.id,
          false,
          error instanceof Error ? error.message : "FCM delivery failed."
        );
      } catch (finishError) {
        console.error("Notification push retry state could not be persisted.", finishError);
      }
    }
    console.error("Persistent notification was stored but FCM delivery failed.", error);
  }
  return stored;
}
function normalizeIndianPhone(input) {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  return null;
}
function parseKycImageDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024 || bytes.toString("base64") !== match[2]) return null;
  const isValidImage = match[1] === "image/jpeg" ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : match[1] === "image/png" ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!isValidImage) return null;
  const extension = match[1] === "image/jpeg" ? "jpg" : match[1].slice("image/".length);
  return { bytes, contentType: match[1], extension };
}
function omitKycDocumentPaths(record) {
  const {
    idFrontUrl: _front,
    idBackUrl: _back,
    selfieUrl: _selfie,
    id_front_document_path: _frontPath,
    id_back_document_path: _backPath,
    selfie_document_path: _selfiePath,
    ...safeRecord
  } = record;
  return safeRecord;
}
function generateOtp() {
  return crypto4.randomInt(1e5, 1e6).toString();
}
function issueUserSessionToken(userId) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  const now = Math.floor(Date.now() / 1e3);
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
    jti: crypto4.randomUUID(),
    typ: "access"
  })).toString("base64url");
  const signature = crypto4.createHmac("sha256", secret).update(payload).digest("base64url");
  return `pairup_session.${payload}.${signature}`;
}
function verifyUserSessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pairup_session") return null;
  const expected = crypto4.createHmac("sha256", secret).update(parts[1]).digest();
  let actual;
  try {
    actual = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !crypto4.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.typ !== "access" || typeof payload.sub !== "string" || typeof payload.exp !== "number" || typeof payload.jti !== "string" || payload.exp <= Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return { userId: payload.sub, tokenId: payload.jti, expiresAt: new Date(payload.exp * 1e3).toISOString() };
  } catch {
    return null;
  }
}
function issueAdminSessionToken(adminId) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  const now = Math.floor(Date.now() / 1e3);
  const payload = Buffer.from(JSON.stringify({
    sub: adminId,
    iat: now,
    exp: now + 60 * 60 * 8,
    jti: crypto4.randomUUID(),
    typ: "admin"
  })).toString("base64url");
  const signature = crypto4.createHmac("sha256", secret).update(payload).digest("base64url");
  return `pairup_admin.${payload}.${signature}`;
}
function verifyAdminSessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pairup_admin") return null;
  const expected = crypto4.createHmac("sha256", secret).update(parts[1]).digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (expected.length !== actual.length || !crypto4.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload.typ !== "admin" || typeof payload.sub !== "string" || typeof payload.exp !== "number" || typeof payload.jti !== "string" || payload.exp <= Math.floor(Date.now() / 1e3)) return null;
    return { adminId: payload.sub, tokenId: payload.jti, expiresAt: new Date(payload.exp * 1e3).toISOString() };
  } catch {
    return null;
  }
}
function publicAuthUser(user) {
  if (!user) return null;
  const inMemory = db2.users?.[user.id];
  const profileName = user.profileName || user.profile_name || inMemory?.profileName || user.legalName || "User";
  return {
    id: user.id,
    phone: user.phone,
    legalName: user.legalName,
    profileName,
    email: user.email,
    role: user.role,
    activeRole: user.activeRole || user.active_role || inMemory?.activeRole || (user.role === "COMPANION" ? "COMPANION" : "CLIENT"),
    dob: user.dob,
    age: user.age,
    kycStatus: user.kycStatus || user.kyc_status || inMemory?.kycStatus || "NOT_SUBMITTED",
    kycRejectionReason: user.kycRejectionReason || user.kyc_rejection_reason || inMemory?.kycRejectionReason || null,
    profilePhoto: user.profilePhoto || user.profile_photo || inMemory?.profilePhoto || null,
    photos: Array.isArray(user.photos) && user.photos.length > 0 ? user.photos : inMemory?.photos || (user.profilePhoto ? [user.profilePhoto] : []),
    bio: user.bio !== void 0 ? user.bio : inMemory?.bio || "",
    city: user.city || "India",
    isSuspended: user.isSuspended !== void 0 ? !!user.isSuspended : !!inMemory?.isSuspended,
    suspendedReason: user.suspendedReason || inMemory?.suspendedReason || null,
    suspendedAt: user.suspendedAt || inMemory?.suspendedAt || null,
    warningCount: typeof user.warningCount === "number" ? user.warningCount : typeof inMemory?.warningCount === "number" ? inMemory.warningCount : 0,
    lastWarningReason: user.lastWarningReason || inMemory?.lastWarningReason || null,
    lastWarningAt: user.lastWarningAt || inMemory?.lastWarningAt || null
  };
}
var INITIAL_COMPANIONS = [
  {
    id: "init_arjun_chauhan_delhi",
    name: "Arjun Chauhan",
    age: 27,
    city: "Delhi",
    state: "Delhi",
    address: "Delhi",
    phone: "+919988001001",
    hourlyRatePaise: 119900,
    services: [1, 5, 6, 11, 12, 13, 21, 23],
    bio: "Engaging, articulate and active companion in Delhi. Loves architectural walks, sporting matches, jogging in historic gardens, and travel transit assistance.",
    profilePhoto: "/assets/companions/arjun_chauhan_main.png",
    photos: [
      "/assets/companions/arjun_chauhan_photo1.png",
      "/assets/companions/arjun_chauhan_photo2.png",
      "/assets/companions/arjun_chauhan_photo3.png"
    ],
    rating: 4.96,
    totalBookings: 28
  },
  {
    id: "init_sayantika_ghosh_burdwan",
    name: "Sayantika Ghosh",
    age: 24,
    city: "Burdwan",
    state: "West Bengal",
    address: "Burdwan, West Bengal",
    phone: "+919988001002",
    hourlyRatePaise: 89900,
    services: [1, 2, 4, 7, 14, 16, 20],
    bio: "Polite, cultured and enthusiastic companion from Burdwan. Loves traditional Bengali art, handicraft exhibitions, quiet cafe conversations, and festive cultural visits.",
    profilePhoto: "/assets/companions/sayantika_main.png",
    photos: [
      "/assets/companions/sayantika_photo1.png",
      "/assets/companions/sayantika_photo2.png",
      "/assets/companions/sayantika_photo3.png"
    ],
    rating: 4.94,
    totalBookings: 19
  },
  {
    id: "init_riya_dutta_baranagar",
    name: "Riya Dutta",
    age: 25,
    city: "Baranagar, Kolkata",
    state: "West Bengal",
    address: "Baranagar, Kolkata",
    phone: "+919988001003",
    hourlyRatePaise: 99900,
    services: [1, 2, 3, 4, 6, 8, 22],
    bio: "Vibrant, stylish and friendly companion from Baranagar, Kolkata. Enjoys exploring northern Kolkata cafe culture, film festivals, shopping outings, and local culinary discoveries.",
    profilePhoto: "/assets/companions/riya_dutta_main.png",
    photos: [
      "/assets/companions/riya_dutta_photo1.png",
      "/assets/companions/riya_dutta_photo2.png",
      "/assets/companions/riya_dutta_photo3.png"
    ],
    rating: 4.97,
    totalBookings: 31
  },
  {
    id: "init_ritwik_basu_dumdum",
    name: "Ritwik Basu",
    age: 28,
    city: "Dumdum, Kolkata",
    state: "West Bengal",
    address: "Dumdum, Kolkata",
    phone: "+919988001004",
    hourlyRatePaise: 109900,
    services: [1, 2, 5, 9, 10, 15, 21],
    bio: "Energetic and friendly companion residing in Dumdum, Kolkata. Music enthusiast, great company for concerts, transit assistance, gaming nights, and weekend social gatherings.",
    profilePhoto: "/assets/companions/ritwik_main.png",
    photos: [
      "/assets/companions/ritwik_photo1.png",
      "/assets/companions/ritwik_photo2.png",
      "/assets/companions/ritwik_photo3.png"
    ],
    rating: 4.93,
    totalBookings: 26
  },
  {
    id: "init_megha_sen_kolkata",
    name: "Megha Sen",
    age: 26,
    city: "Kolkata",
    state: "West Bengal",
    address: "Kolkata, West Bengal",
    phone: "+919988001005",
    hourlyRatePaise: 104900,
    services: [1, 2, 4, 7, 8, 14, 22],
    bio: "Warm and creative Kolkata companion. Passionate about arts, handicraft markets, attending social ceremonies and exploring authentic street food destinations across the city.",
    profilePhoto: "/assets/companions/megha_main.png",
    photos: [
      "/assets/companions/megha_photo1.png",
      "/assets/companions/megha_photo2.png",
      "/assets/companions/megha_photo3.png",
      "/assets/companions/megha_photo4.png"
    ],
    rating: 4.98,
    totalBookings: 35
  },
  {
    id: "init_arnab_chatterjee_kolkata",
    name: "Arnab Chatterjee",
    age: 29,
    city: "Kolkata",
    state: "West Bengal",
    address: "Kolkata, West Bengal",
    phone: "+919988001006",
    hourlyRatePaise: 114900,
    services: [1, 5, 6, 10, 11, 16, 23],
    bio: "Sociable and well-travelled companion in Kolkata. Enjoys cultural seminars, live music concerts, sporting events at Salt Lake Stadium, and guided heritage walks.",
    profilePhoto: "/assets/companions/arnab_main.png",
    photos: [
      "/assets/companions/arnab_photo1.png",
      "/assets/companions/arnab_photo2.png",
      "/assets/companions/arnab_photo3.png",
      "/assets/companions/arnab_photo4.png"
    ],
    rating: 4.95,
    totalBookings: 42
  },
  {
    id: "init_ishika_sen_saltlake",
    name: "Ishika Sen",
    age: 25,
    city: "Saltlake, Kolkata",
    state: "West Bengal",
    address: "Saltlake, Kolkata",
    phone: "+919988001007",
    hourlyRatePaise: 109900,
    services: [1, 2, 4, 12, 13, 16, 19],
    bio: "Friendly, professional companion based in Saltlake Sector V, Kolkata. Perfect companion for lakeside walks, peaceful cafe study sessions, City Centre shopping, and pleasant conversations.",
    profilePhoto: "/assets/companions/ishika_main.png",
    photos: [
      "/assets/companions/ishika_photo1.png",
      "/assets/companions/ishika_photo2.png",
      "/assets/companions/ishika_photo3.png",
      "/assets/companions/ishika_photo4.png"
    ],
    rating: 4.96,
    totalBookings: 29
  },
  {
    id: "init_nithya_subramanian_chennai",
    name: "Nithya Subramanian",
    age: 26,
    city: "Chennai",
    state: "Tamil Nadu",
    address: "Chennai, Tamil Nadu",
    phone: "+919988001008",
    hourlyRatePaise: 99900,
    services: [1, 2, 7, 10, 14, 17, 20],
    bio: "Gentle, thoughtful and cultured companion from Chennai. Enjoys classical music concerts, serene beach strolls, temple visits, and engaging in warm, meaningful conversation.",
    profilePhoto: "/assets/companions/nithya_main.png",
    photos: [
      "/assets/companions/nithya_photo1.png",
      "/assets/companions/nithya_photo2.png",
      "/assets/companions/nithya_photo3.png"
    ],
    rating: 4.97,
    totalBookings: 33
  },
  {
    id: "init_riya_kolkata",
    name: "Riya Sharma",
    age: 24,
    city: "Kolkata",
    state: "West Bengal",
    address: "Kolkata, West Bengal",
    hourlyRatePaise: 99900,
    services: [1, 2, 4, 6, 7, 22],
    bio: "Warm, thoughtful conversationalist who loves discovering quaint cafes, discussing literature, and exploring Kolkata heritage lanes.",
    profilePhoto: "/assets/companions/riya_main.jpg",
    photos: [
      "/assets/companions/riya_photo1.jpg",
      "/assets/companions/riya_photo2.jpg",
      "/assets/companions/riya_photo3.jpg"
    ],
    rating: 4.95,
    totalBookings: 32
  },
  {
    id: "init_aarav_mumbai",
    name: "Aarav Singhania",
    age: 27,
    city: "Mumbai",
    state: "Maharashtra",
    address: "Mumbai, Maharashtra",
    hourlyRatePaise: 129900,
    services: [1, 2, 5, 8, 9, 11, 16],
    bio: "Finance professional and fitness enthusiast. Great companion for business co-working, marine drive strolls, sports events, and social gatherings.",
    profilePhoto: "/assets/companions/aarav_main.jpg",
    photos: [
      "/assets/companions/aarav_photo1.jpg",
      "/assets/companions/aarav_photo2.jpg",
      "/assets/companions/aarav_photo3.jpg"
    ],
    rating: 4.98,
    totalBookings: 47
  },
  {
    id: "init_sneha_ahmedabad",
    name: "Sneha Patel",
    age: 26,
    city: "Ahmedabad",
    state: "Gujarat",
    address: "Ahmedabad, Gujarat",
    hourlyRatePaise: 89900,
    services: [1, 3, 4, 14, 19, 20],
    bio: "Friendly companion for textile shopping, visiting local handicraft markets, peaceful temple visits, and weekend movie screenings.",
    profilePhoto: "/assets/companions/sneha_main.jpg",
    photos: [
      "/assets/companions/sneha_photo1.jpg",
      "/assets/companions/sneha_photo2.jpg",
      "/assets/companions/sneha_photo3.jpg"
    ],
    rating: 4.92,
    totalBookings: 24
  },
  {
    id: "init_kabir_delhi",
    name: "Kabir Verma",
    age: 29,
    city: "Delhi NCR",
    state: "Delhi",
    address: "Delhi NCR, Delhi",
    hourlyRatePaise: 119900,
    services: [1, 6, 7, 10, 12, 23],
    bio: "Architect and heritage lover. Excellent companion for monuments, art galleries, live music events, and jogging in Lodhi Garden.",
    profilePhoto: "/assets/companions/kabir_main.jpg",
    photos: [
      "/assets/companions/kabir_photo1.jpg",
      "/assets/companions/kabir_photo2.jpg",
      "/assets/companions/kabir_photo3.jpg"
    ],
    rating: 4.94,
    totalBookings: 38
  },
  {
    id: "init_meera_bengaluru",
    name: "Anusha Mitra",
    age: 25,
    city: "Kolkata",
    state: "West Bengal",
    address: "Park Street, Kolkata",
    hourlyRatePaise: 94900,
    services: [1, 2, 13, 15, 16, 22],
    bio: "Graceful, warm, and engaging companion who loves cafe outings around Park Street, literature, cultural events, and exploring Kolkata heritage.",
    profilePhoto: "/assets/companions/anusha_main.jpg",
    photos: [
      "/assets/companions/anusha_photo1.png",
      "/assets/companions/anusha_photo2.png",
      "/assets/companions/anusha_photo3.png"
    ],
    rating: 4.96,
    totalBookings: 29
  },
  {
    id: "init_rohan_kolkata",
    name: "Rohan Mukherjee",
    age: 28,
    city: "Kolkata",
    state: "West Bengal",
    address: "Kolkata, West Bengal",
    hourlyRatePaise: 109900,
    services: [1, 3, 5, 6, 11, 21, 23],
    bio: "History enthusiast and passionate foodie. Ready for football stadium matches, airport assists, and uncovering historic city landmarks.",
    profilePhoto: "/assets/companions/rohan_main.jpg",
    photos: [
      "/assets/companions/rohan_photo1.jpg",
      "/assets/companions/rohan_photo2.jpg",
      "/assets/companions/rohan_photo3.jpg"
    ],
    rating: 4.89,
    totalBookings: 19
  },
  {
    id: "init_pooja_hyderabad",
    name: "Pooja Reddy",
    age: 26,
    city: "Hyderabad",
    state: "Telangana",
    address: "Hyderabad, Telangana",
    hourlyRatePaise: 89900,
    services: [1, 2, 4, 7, 8, 17, 24],
    bio: "Caring, polite companion with great patience. Enjoys cultural functions, shopping at Jubilee Hills, and accompanying senior citizens.",
    profilePhoto: "/assets/companions/pooja_main.jpg",
    photos: [
      "/assets/companions/pooja_photo1.jpg",
      "/assets/companions/pooja_photo2.jpg",
      "/assets/companions/pooja_photo3.jpg"
    ],
    rating: 4.97,
    totalBookings: 35
  },
  {
    id: "init_vikram_jaipur",
    name: "Vikramaditya Rathore",
    age: 30,
    city: "Jaipur",
    state: "Rajasthan",
    address: "Jaipur, Rajasthan",
    hourlyRatePaise: 139900,
    services: [1, 5, 6, 8, 14, 20, 23],
    bio: "Heritage photographer and desert travel planner. Experienced companion for royal fort explorations, traditional weddings, and cultural festivals.",
    profilePhoto: "/assets/companions/vikram_main.jpg",
    photos: [
      "/assets/companions/vikram_photo1.jpg",
      "/assets/companions/vikram_photo2.jpg",
      "/assets/companions/vikram_photo3.jpg"
    ],
    rating: 4.93,
    totalBookings: 41
  },
  {
    id: "init_ananya_pune",
    name: "Ananya Deshmukh",
    age: 25,
    city: "Pune",
    state: "Maharashtra",
    address: "Pune, Maharashtra",
    hourlyRatePaise: 99900,
    services: [1, 2, 10, 12, 16, 18, 24],
    bio: "Psychology researcher and yoga enthusiast. Friendly, compassionate companion for library study, medical visits, and fitness activities.",
    profilePhoto: "/assets/companions/ananya_pune_main.jpg",
    photos: [
      "/assets/companions/ananya_pune_photo1.jpg",
      "/assets/companions/ananya_pune_photo2.jpg",
      "/assets/companions/ananya_pune_photo3.jpg"
    ],
    rating: 4.91,
    totalBookings: 22
  },
  {
    id: "init_aditya_chandigarh",
    name: "Aditya Roy",
    age: 28,
    city: "Chandigarh",
    state: "Punjab",
    address: "Chandigarh, Punjab",
    hourlyRatePaise: 114900,
    services: [1, 5, 9, 11, 13, 21],
    bio: "Outdoor activities enthusiast, badminton player, and lively party companion who loves highway drives and weekend sporting events.",
    profilePhoto: "/assets/companions/aditya_main.jpg",
    photos: [
      "/assets/companions/aditya_photo1.jpg",
      "/assets/companions/aditya_photo2.jpg",
      "/assets/companions/aditya_photo3.jpg"
    ],
    rating: 4.88,
    totalBookings: 27
  },
  {
    id: "init_divya_chennai",
    name: "Divya Menon",
    age: 27,
    city: "Chennai",
    state: "Tamil Nadu",
    address: "Chennai, Tamil Nadu",
    hourlyRatePaise: 99900,
    services: [1, 2, 7, 10, 15, 18, 20],
    bio: "Carnatic music vocalist and tech consultant. Enjoys classical concert seasons, filter coffee cafes, and museum exhibitions.",
    profilePhoto: "/assets/companions/divya_main.jpg",
    photos: [
      "/assets/companions/divya_photo1.jpg",
      "/assets/companions/divya_photo2.jpg",
      "/assets/companions/divya_photo3.jpg"
    ],
    rating: 4.95,
    totalBookings: 31
  },
  {
    id: "init_tanvi_indore",
    name: "Tanvi Joshi",
    age: 24,
    city: "Indore",
    state: "Madhya Pradesh",
    address: "Indore, Madhya Pradesh",
    hourlyRatePaise: 84900,
    services: [1, 3, 4, 12, 17, 19, 22],
    bio: "Cheerful companion for Sarafa Bazaar food walks, shopping trips, senior errand support, and morning fitness walks.",
    profilePhoto: "/assets/companions/tanvi_main.jpg",
    photos: [
      "/assets/companions/tanvi_photo1.jpg",
      "/assets/companions/tanvi_photo2.jpg",
      "/assets/companions/tanvi_photo3.jpg"
    ],
    rating: 4.9,
    totalBookings: 18
  },
  {
    id: "init_arindam_kolkata",
    name: "Arindam Chatterjee",
    age: 28,
    city: "Kolkata",
    state: "West Bengal",
    address: "Kolkata, West Bengal",
    hourlyRatePaise: 99900,
    services: [1, 2, 4, 6, 7, 22],
    bio: "Art and architecture lover who enjoys College Street book walks, heritage tram rides, and cultural festivals across Kolkata.",
    profilePhoto: "/assets/companions/arindam_main.jpg",
    photos: [
      "/assets/companions/arindam_photo1.jpg",
      "/assets/companions/arindam_photo2.jpg",
      "/assets/companions/arindam_photo3.jpg"
    ],
    rating: 4.94,
    totalBookings: 26
  },
  {
    id: "init_sreeja_kolkata",
    name: "Sreeja Mukherjee",
    age: 25,
    city: "Kolkata",
    state: "West Bengal",
    address: "Kolkata, West Bengal",
    hourlyRatePaise: 109900,
    services: [1, 2, 3, 4, 6, 14, 22],
    bio: "Literature enthusiast, classical dancer, and conversationalist who enjoys Rabindra Sarobar morning walks and artisan handicraft fairs.",
    profilePhoto: "/assets/companions/sreeja_main.jpg",
    photos: [
      "/assets/companions/sreeja_photo1.jpg",
      "/assets/companions/sreeja_photo2.jpg",
      "/assets/companions/sreeja_photo3.jpg"
    ],
    rating: 4.97,
    totalBookings: 34
  }
];
function seedInitialCompanions(targetDb) {
  for (const c of INITIAL_COMPANIONS) {
    if (!targetDb.users[c.id]) {
      targetDb.users[c.id] = {
        id: c.id,
        phone: c.phone || `+9199990${c.id.slice(-5).replace(/\D/g, "") || "00001"}`,
        passwordHash: legacySeedPasswordHash("PairUpInit@2026"),
        legalName: c.name,
        email: `${c.id}@pairuptoday.com`,
        role: "COMPANION",
        activeRole: "COMPANION",
        age: c.age,
        dob: `${2026 - c.age}-01-01`,
        kycStatus: "APPROVED",
        profilePhoto: c.profilePhoto,
        photos: c.photos,
        bio: c.bio,
        city: c.city,
        state: c.state,
        address: c.address || `${c.city}, ${c.state}`,
        createdAt: new Date(Date.now() - 60 * 864e5).toISOString()
      };
    } else {
      targetDb.users[c.id].legalName = c.name;
      targetDb.users[c.id].age = c.age;
      targetDb.users[c.id].city = c.city;
      targetDb.users[c.id].state = c.state;
      targetDb.users[c.id].address = c.address || `${c.city}, ${c.state}`;
      targetDb.users[c.id].profilePhoto = c.profilePhoto;
      targetDb.users[c.id].photos = c.photos;
      targetDb.users[c.id].bio = c.bio;
    }
    if (!targetDb.companionProfiles[c.id]) {
      targetDb.companionProfiles[c.id] = {
        userId: c.id,
        services: c.services,
        rates: {
          hourlyPaise: c.hourlyRatePaise,
          halfDayPaise: Math.round(c.hourlyRatePaise * 3.5),
          fullDayPaise: Math.round(c.hourlyRatePaise * 6.5)
        },
        availability: null,
        // Strictly non-bookable
        isLive: true,
        rating: c.rating,
        totalBookings: c.totalBookings,
        address: c.address || `${c.city}, ${c.state}`,
        state: c.state,
        isInitialListing: true
      };
    } else {
      targetDb.companionProfiles[c.id].isInitialListing = true;
      targetDb.companionProfiles[c.id].state = c.state;
      targetDb.companionProfiles[c.id].address = c.address || `${c.city}, ${c.state}`;
      targetDb.companionProfiles[c.id].availability = null;
    }
  }
}
function loadDB() {
  if (process.env.NODE_ENV === "production") {
    return {
      users: {},
      kycSubmissions: {},
      companionProfiles: {},
      companionMemberships: {},
      bookings: {},
      companionWallets: {},
      payouts: {},
      chatMessages: {},
      adminUsers: {},
      supportConversations: {},
      supportMessages: {},
      bankVerifications: {},
      userLocations: {},
      userPresence: {},
      otpStore: {},
      adminMfaStore: {},
      auditLogs: []
    };
  }
  if (fs2.existsSync(DB_FILE2)) {
    try {
      const raw = fs2.readFileSync(DB_FILE2, "utf-8");
      const parsed = JSON.parse(raw);
      seedInitialCompanions(parsed);
      const genuineUpdates = {
        comp_arjun_01: { photo: "/assets/companions/arjun_main.jpg", photos: ["/assets/companions/arjun_photo1.jpg", "/assets/companions/arjun_photo2.jpg", "/assets/companions/arjun_photo3.jpg"] },
        comp_priya_02: { photo: "/assets/companions/priya_main.jpg", photos: ["/assets/companions/priya_photo1.jpg", "/assets/companions/priya_photo2.jpg", "/assets/companions/priya_photo3.jpg"] },
        comp_rohit_03: { photo: "/assets/companions/rohit_main.jpg", photos: ["/assets/companions/rohit_photo1.jpg", "/assets/companions/rohit_photo2.jpg", "/assets/companions/rohit_photo3.jpg"] },
        comp_ananya_04: { photo: "/assets/companions/ananya_main.jpg", photos: ["/assets/companions/ananya_photo1.jpg", "/assets/companions/ananya_photo2.jpg", "/assets/companions/ananya_photo3.jpg"] }
      };
      for (const [gid, gdata] of Object.entries(genuineUpdates)) {
        if (parsed.users[gid]) {
          parsed.users[gid].profilePhoto = gdata.photo;
          parsed.users[gid].photos = gdata.photos;
        }
      }
      saveDB(parsed);
      return parsed;
    } catch (err) {
      console.error("Failed to parse existing DB file, creating fresh state", err);
    }
  }
  const initialAdminId = "admin_super_01";
  const initialAdminEmail = "rahulfilmsindia@gmail.com";
  const initialAdminPhone = "+918640851337";
  const companion1Id = "comp_arjun_01";
  const companion2Id = "comp_priya_02";
  const companion3Id = "comp_rohit_03";
  const companion4Id = "comp_ananya_04";
  const initialDB = {
    users: {
      [companion1Id]: {
        id: companion1Id,
        phone: "+919876543210",
        passwordHash: legacySeedPasswordHash("PairUp@2026"),
        legalName: "Arjun Sen",
        email: "arjun.sen@example.com",
        role: "COMPANION",
        activeRole: "COMPANION",
        dob: "1998-04-15",
        age: 28,
        kycStatus: "APPROVED",
        kycSubmittedAt: new Date(Date.now() - 30 * 864e5).toISOString(),
        kycDecidedAt: new Date(Date.now() - 29 * 864e5).toISOString(),
        kycDecidedBy: "admin_super_01",
        profilePhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
        bio: "Passionate conversationalist, heritage walking enthusiast, and avid coffee taster. Experienced city companion in Kolkata.",
        photos: [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
        ],
        city: "Kolkata",
        createdAt: new Date(Date.now() - 35 * 864e5).toISOString()
      },
      [companion2Id]: {
        id: companion2Id,
        phone: "+919876543211",
        passwordHash: legacySeedPasswordHash("PairUp@2026"),
        legalName: "Priya Sharma",
        email: "priya.sharma@example.com",
        role: "COMPANION",
        activeRole: "COMPANION",
        dob: "1997-08-22",
        age: 29,
        kycStatus: "APPROVED",
        kycSubmittedAt: new Date(Date.now() - 25 * 864e5).toISOString(),
        kycDecidedAt: new Date(Date.now() - 24 * 864e5).toISOString(),
        kycDecidedBy: "admin_super_01",
        profilePhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        bio: "Art curator, book fair enthusiast, and shopping consultant. Always up for cheerful conversations and caf\xE9 outings in South Delhi.",
        photos: [
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
        ],
        city: "Delhi NCR",
        createdAt: new Date(Date.now() - 30 * 864e5).toISOString()
      },
      [companion3Id]: {
        id: companion3Id,
        phone: "+919876543212",
        passwordHash: legacySeedPasswordHash("PairUp@2026"),
        legalName: "Rohit Kulkarni",
        email: "rohit.k@example.com",
        role: "COMPANION",
        activeRole: "COMPANION",
        dob: "1995-11-10",
        age: 31,
        kycStatus: "APPROVED",
        kycSubmittedAt: new Date(Date.now() - 20 * 864e5).toISOString(),
        kycDecidedAt: new Date(Date.now() - 19 * 864e5).toISOString(),
        kycDecidedBy: "admin_super_01",
        profilePhoto: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        bio: "Tech enthusiast, co-working buddy, fitness walker, and sports stadium companion in Mumbai & Pune.",
        photos: [
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
        ],
        city: "Mumbai",
        createdAt: new Date(Date.now() - 25 * 864e5).toISOString()
      },
      [companion4Id]: {
        id: companion4Id,
        phone: "+919876543213",
        passwordHash: legacySeedPasswordHash("PairUp@2026"),
        legalName: "Ananya Rao",
        email: "ananya.rao@example.com",
        role: "COMPANION",
        activeRole: "COMPANION",
        dob: "1999-02-14",
        age: 27,
        kycStatus: "APPROVED",
        kycSubmittedAt: new Date(Date.now() - 15 * 864e5).toISOString(),
        kycDecidedAt: new Date(Date.now() - 14 * 864e5).toISOString(),
        kycDecidedBy: "admin_super_01",
        profilePhoto: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
        bio: "Compassionate companion for senior walks, daily errands, museum visits and cultural events across Bengaluru.",
        photos: [
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
        ],
        city: "Bengaluru",
        createdAt: new Date(Date.now() - 20 * 864e5).toISOString()
      }
    },
    kycSubmissions: {
      [companion1Id]: {
        id: "kyc_sub_01",
        userId: companion1Id,
        userPhone: "+919876543210",
        legalName: "Arjun Sen",
        dob: "1998-04-15",
        idType: "AADHAAR",
        idFrontUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80",
        idBackUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80",
        selfieUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
        bio: "Passionate conversationalist & city companion.",
        photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"],
        status: "APPROVED",
        submittedAt: new Date(Date.now() - 30 * 864e5).toISOString(),
        decidedAt: new Date(Date.now() - 29 * 864e5).toISOString(),
        decidedBy: "admin_super_01",
        userType: "COMPANION"
      },
      [companion2Id]: {
        id: "kyc_sub_02",
        userId: companion2Id,
        userPhone: "+919876543211",
        legalName: "Priya Sharma",
        dob: "1997-08-22",
        idType: "PAN",
        idFrontUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80",
        selfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        bio: "Art curator and book fair enthusiast.",
        photos: ["https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"],
        status: "APPROVED",
        submittedAt: new Date(Date.now() - 25 * 864e5).toISOString(),
        decidedAt: new Date(Date.now() - 24 * 864e5).toISOString(),
        decidedBy: "admin_super_01",
        userType: "COMPANION"
      }
    },
    companionProfiles: {
      [companion1Id]: {
        userId: companion1Id,
        services: [1, 2, 4, 6, 12, 17, 23],
        rates: {
          hourlyPaise: 49900,
          halfDayPaise: 169900,
          fullDayPaise: 299900
        },
        availability: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          startTime: "09:00",
          endTime: "22:00"
        },
        membership: {
          plan: "PROFESSIONAL",
          pricePaise: 109900,
          startDate: new Date(Date.now() - 20 * 864e5).toISOString(),
          expiryDate: new Date(Date.now() + 70 * 864e5).toISOString(),
          paymentId: "pay_mem_seed_01",
          isActive: true
        },
        bankDetails: {
          accountNumber: "918237461928",
          accountNumberMasked: "XXXXXXXX1928",
          ifsc: "HDFC0001234",
          bankName: "HDFC Bank",
          accountHolderName: "Arjun Sen",
          isVerified: true,
          verifiedAt: new Date(Date.now() - 20 * 864e5).toISOString()
        },
        isLive: true,
        rating: 4.95,
        totalBookings: 18,
        latitude: 22.5726,
        longitude: 88.3639,
        address: "Park Street, Kolkata, West Bengal"
      },
      [companion2Id]: {
        userId: companion2Id,
        services: [1, 2, 3, 4, 7, 8, 14, 22],
        rates: {
          hourlyPaise: 59900,
          halfDayPaise: 199900,
          fullDayPaise: 349900
        },
        availability: {
          days: ["Friday", "Saturday", "Sunday", "Monday"],
          startTime: "10:00",
          endTime: "21:00"
        },
        membership: {
          plan: "PREMIUM",
          pricePaise: 599900,
          startDate: new Date(Date.now() - 15 * 864e5).toISOString(),
          expiryDate: new Date(Date.now() + 350 * 864e5).toISOString(),
          paymentId: "pay_mem_seed_02",
          isActive: true
        },
        bankDetails: {
          accountNumber: "501004928172",
          accountNumberMasked: "XXXXXXXX8172",
          ifsc: "ICIC0000104",
          bankName: "ICICI Bank",
          accountHolderName: "Priya Sharma",
          isVerified: true,
          verifiedAt: new Date(Date.now() - 15 * 864e5).toISOString()
        },
        isLive: true,
        rating: 5,
        totalBookings: 24,
        latitude: 28.6139,
        longitude: 77.209,
        address: "Connaught Place, New Delhi"
      },
      [companion3Id]: {
        userId: companion3Id,
        services: [1, 5, 11, 12, 15, 16],
        rates: {
          hourlyPaise: 54900,
          halfDayPaise: 189900,
          fullDayPaise: 329900
        },
        availability: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Saturday"],
          startTime: "08:00",
          endTime: "20:00"
        },
        membership: {
          plan: "STARTER",
          pricePaise: 44900,
          startDate: new Date(Date.now() - 10 * 864e5).toISOString(),
          expiryDate: new Date(Date.now() + 20 * 864e5).toISOString(),
          paymentId: "pay_mem_seed_03",
          isActive: true
        },
        bankDetails: {
          accountNumber: "381920394851",
          accountNumberMasked: "XXXXXXXX4851",
          ifsc: "SBIN0000300",
          bankName: "State Bank of India",
          accountHolderName: "Rohit Kulkarni",
          isVerified: true,
          verifiedAt: new Date(Date.now() - 10 * 864e5).toISOString()
        },
        isLive: true,
        rating: 4.88,
        totalBookings: 12,
        latitude: 19.076,
        longitude: 72.8777,
        address: "Bandra West, Mumbai, Maharashtra"
      },
      [companion4Id]: {
        userId: companion4Id,
        services: [1, 6, 17, 18, 19, 20, 24],
        rates: {
          hourlyPaise: 49900,
          halfDayPaise: 159900,
          fullDayPaise: 279900
        },
        availability: {
          days: ["Monday", "Wednesday", "Thursday", "Friday", "Saturday"],
          startTime: "08:30",
          endTime: "19:30"
        },
        membership: {
          plan: "PROFESSIONAL",
          pricePaise: 109900,
          startDate: new Date(Date.now() - 5 * 864e5).toISOString(),
          expiryDate: new Date(Date.now() + 85 * 864e5).toISOString(),
          paymentId: "pay_mem_seed_04",
          isActive: true
        },
        bankDetails: {
          accountNumber: "0281104000192",
          accountNumberMasked: "XXXXXXXX0192",
          ifsc: "KKBK0008055",
          bankName: "Kotak Mahindra Bank",
          accountHolderName: "Ananya Rao",
          isVerified: true,
          verifiedAt: new Date(Date.now() - 5 * 864e5).toISOString()
        },
        isLive: true,
        rating: 4.92,
        totalBookings: 9,
        latitude: 12.9716,
        longitude: 77.5946,
        address: "Indiranagar, Bengaluru, Karnataka"
      }
    },
    companionMemberships: {},
    bookings: {},
    companionWallets: {
      [companion1Id]: {
        companionId: companion1Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 89e4,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      },
      [companion2Id]: {
        companionId: companion2Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 142e4,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      },
      [companion3Id]: {
        companionId: companion3Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 54e4,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      },
      [companion4Id]: {
        companionId: companion4Id,
        lockedSettlementBalancePaise: 0,
        availableSettlementBalancePaise: 0,
        totalSettledPaise: 38e4,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      }
    },
    payouts: {},
    chatMessages: {},
    supportConversations: {},
    supportMessages: {},
    bankVerifications: {},
    userLocations: {},
    userPresence: {},
    adminUsers: {
      [initialAdminId]: {
        id: initialAdminId,
        email: initialAdminEmail,
        phone: initialAdminPhone,
        name: "Rahul Super Administrator",
        role: "SUPER_ADMIN",
        passwordHash: legacySeedPasswordHash("AdminPass@2026"),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    },
    otpStore: {},
    adminMfaStore: {},
    auditLogs: [
      {
        id: "log_init_01",
        adminId: initialAdminId,
        adminEmail: initialAdminEmail,
        adminRole: "SUPER_ADMIN",
        action: "PLATFORM_INITIALIZATION",
        details: "PairUpToday security vault initialized with Indian emergency routing (100/112).",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]
  };
  saveDB(initialDB);
  return initialDB;
}
var db2 = loadDB();
function saveDB(state) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production JSON persistence is disabled; use the Supabase database adapter.");
  }
  try {
    const tempPath = `${DB_FILE2}.tmp.${Date.now()}`;
    fs2.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
    fs2.renameSync(tempPath, DB_FILE2);
  } catch (err) {
    console.error("Failed to atomically write DB file", err);
  }
}
function getBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  if (typeof req.query?.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return "";
}
function hasApplicationRole(user, role) {
  if (!user) return false;
  if (user.role === "DUAL" || user.role === "ADMIN") return true;
  return user.role === role || user.activeRole === role;
}
function apiRequiresRole(req) {
  const route = `${req.method} ${req.originalUrl.split("?")[0]}`;
  if (route === "POST /api/bookings/create") return "CLIENT";
  if (route === "POST /api/companion/membership/subscribe" || route.startsWith("GET /api/companion/status/") || route === "POST /api/companion/services-rates" || route === "POST /api/companion/bank/verify") {
    return null;
  }
  if (route === "POST /api/payments/razorpay/create-order") {
    const isMembership = req.body?.type === "MEMBERSHIP" || req.body?.plan || req.body?.membershipPlan || req.body?.notes?.membershipPlan;
    return isMembership ? null : "CLIENT";
  }
  if (route === "POST /api/payments/razorpay/verify-payment") {
    return req.body?.membershipPlan ? null : "CLIENT";
  }
  if (/^POST \/api\/bookings\/[^/]+\/(arrived|verify-start-otp|complete|accept|reject)$/.test(route)) return "COMPANION";
  if (route.startsWith("POST /api/companion/availability/") || route.startsWith("POST /api/companion/")) return "COMPANION";
  return null;
}
function rateLimitHash(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) throw new Error("Session secret is required for distributed rate limiting.");
  return crypto4.createHmac("sha256", secret).update(value).digest("hex");
}
function isPublicApiRoute(req) {
  const route = `${req.method} ${req.originalUrl.split("?")[0]}`;
  return (/* @__PURE__ */ new Set([
    "POST /api/auth/check-phone",
    "POST /api/auth/request-otp",
    "POST /api/auth/register-with-otp",
    "POST /api/auth/verify-otp",
    "POST /api/auth/reset-password",
    "POST /api/auth/login",
    "POST /api/admin/login",
    "POST /api/admin/verify-mfa",
    "POST /api/payments/razorpay/webhook",
    "GET /api/maps/autocomplete",
    "GET /api/maps/geocode",
    "GET /api/maps/reverse-geocode",
    "GET /api/maps/distance",
    "GET /api/companions/search"
  ])).has(route);
}
function isSupabaseBackedProductionRoute(req) {
  const route = `${req.method} ${req.originalUrl.split("?")[0]}`;
  return (/* @__PURE__ */ new Set([
    "POST /api/auth/check-phone",
    "POST /api/auth/request-otp",
    "POST /api/auth/register-with-otp",
    "POST /api/auth/verify-otp",
    "POST /api/auth/reset-password",
    "GET /api/auth/session",
    "POST /api/auth/login",
    "POST /api/auth/select-role",
    "POST /api/auth/logout",
    "POST /api/user/change-password",
    "POST /api/user/delete-account",
    "POST /api/admin/login",
    "POST /api/admin/verify-mfa",
    "POST /api/admin/logout",
    "POST /api/admin/finance/re-auth",
    "POST /api/admin/finance/re-auth/verify",
    "POST /api/admin/finance/reveal-bank",
    "POST /api/admin/finance/process-payout",
    "POST /api/admin/finance/refund",
    "GET /api/admin/finance/settlements",
    "GET /api/admin/overview",
    "GET /api/admin/staff",
    "POST /api/admin/staff/create",
    "GET /api/admin/audit-logs",
    "GET /api/admin/clients",
    "GET /api/admin/companions",
    "GET /api/admin/memberships",
    "GET /api/admin/bookings",
    "GET /api/admin/payments",
    "POST /api/payments/razorpay/create-order",
    "GET /api/companions/search",
    "GET /api/maps/autocomplete",
    "GET /api/maps/geocode",
    "GET /api/maps/reverse-geocode",
    "GET /api/maps/distance",
    "POST /api/notifications/device-token",
    "DELETE /api/notifications/device-token"
  ])).has(route) || route === "POST /api/user/profile" || route === "GET /api/user/profile" || route === "POST /api/kyc/submit" || route === "POST /api/companion/services-rates" || route === "POST /api/companion/membership/subscribe" || route === "POST /api/companion/bank/verify" || route === "POST /api/companion/availability/toggle" || route === "GET /api/companion/wallet" || route === "POST /api/bookings/create" || route === "POST /api/payments/razorpay/verify-payment" || route === "POST /api/payments/razorpay/cancel-order" || route === "POST /api/payments/razorpay/fail-order" || /^GET \/api\/notifications\/[^/]+$/.test(route) || route === "POST /api/notifications/read" || route === "POST /api/notifications/device-token" || route === "DELETE /api/notifications/device-token" || route === "POST /api/support/conversation" || route === "POST /api/support/message" || /^GET \/api\/support\/conversations\/[^/]+$/.test(route) || /^GET \/api\/support\/messages\/[^/]+$/.test(route) || /^GET \/api\/support\/messages\/[^/]+\/stream$/.test(route) || /^GET \/api\/chat\/[^/]+$/.test(route) || /^POST \/api\/chat\/[^/]+$/.test(route) || /^GET \/api\/chat\/[^/]+\/stream$/.test(route) || route === "GET /api/companion/alerts/stream" || /^POST \/api\/bookings\/[^/]+\/(arrived|verify-start-otp|complete|accept|reject|cancel)$/.test(route) || /^GET \/api\/bookings\/[^/]+\/status$/.test(route) || /^GET \/api\/bookings\/my\/[^/]+$/.test(route) || /^GET \/api\/companion\/status\/[^/]+$/.test(route) || /^POST \/api\/location\/(update|sharing\/start|sharing\/stop)$/.test(route) || /^GET \/api\/location\/[^/]+$/.test(route) || route === "POST /api/presence" || /^GET \/api\/presence\/[^/]+$/.test(route) || route === "GET /api/admin/kyc/list" || route === "GET /api/admin/support/conversations" || route === "GET /api/admin/finance/payouts" || route === "GET /api/admin/finance/refunds" || route === "POST /api/admin/finance/re-auth/verify" || /^GET \/api\/admin\/support\/messages\/[^/]+$/.test(route) || /^GET \/api\/admin\/support\/messages\/[^/]+\/stream$/.test(route) || route === "POST /api/admin/support/reply" || /^POST \/api\/admin\/support\/conversation\/[^/]+\/status$/.test(route) || /^POST \/api\/admin\/staff\/[^/]+\/role$/.test(route) || /^DELETE \/api\/admin\/staff\/[^/]+$/.test(route) || /^GET \/api\/admin\/kyc\/[^/]+\/documents$/.test(route) || /^POST \/api\/admin\/kyc\/[^/]+\/action$/.test(route);
}
app.use("/api", async (req, res, next) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const globalLimit = await databaseAdapter.consumeRateLimit(rateLimitHash(`global:${ip}`), 180, 60);
    if (!globalLimit.allowed) {
      res.setHeader("Retry-After", String(globalLimit.retryAfterSeconds || 1));
      return res.status(429).json({ error: "Too many requests. Please retry later." });
    }
    if (/^\/api\/(auth\/(login|request-otp|register-with-otp|verify-otp)|admin\/(login|verify-mfa|finance\/re-auth(?:\/verify)?))$/.test(req.path)) {
      const authLimit = await databaseAdapter.consumeRateLimit(rateLimitHash(`auth:${ip}:${req.path}`), 12, 600);
      if (!authLimit.allowed) {
        res.setHeader("Retry-After", String(authLimit.retryAfterSeconds || 1));
        return res.status(429).json({ error: "Authentication rate limit exceeded." });
      }
    }
    if (req.path === "/api/companions/search" && req.query.lat !== void 0 && req.query.lng !== void 0) {
      const mapsLimit = await databaseAdapter.consumeRateLimit(rateLimitHash(`maps-search:${ip}`), 10, 60);
      if (!mapsLimit.allowed) {
        res.setHeader("Retry-After", String(mapsLimit.retryAfterSeconds || 1));
        return res.status(429).json({ error: "Nearby discovery rate limit exceeded." });
      }
    }
  } catch (error) {
    console.warn("Distributed API rate limit non-fatal fallback to permissive:", error);
  }
  if (process.env.NODE_ENV === "production" && !isSupabaseBackedProductionRoute(req)) {
    return res.status(503).json({
      error: "This endpoint is unavailable until its business-data operation is backed by Supabase."
    });
  }
  if (isPublicApiRoute(req)) return next();
  const apiPath = req.originalUrl.split("?")[0];
  const isAdminRoute = apiPath.startsWith("/api/admin/");
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  if (isAdminRoute) {
    const adminSession = verifyAdminSessionToken(token);
    if (!adminSession) {
      return res.status(401).json({ error: "Invalid or expired administrator session." });
    }
    try {
      if (await databaseAdapter.isSessionRevoked(adminSession.tokenId)) {
        return res.status(401).json({ error: "Administrator session has been revoked." });
      }
    } catch (error) {
      console.error("Administrator session revocation lookup failed.", error);
      return res.status(503).json({ error: "Administrator authentication is temporarily unavailable." });
    }
    let admin;
    try {
      admin = await databaseAdapter.getAdminUserById(adminSession.adminId);
    } catch (error) {
      console.error("Administrator session lookup failed.", error);
      return res.status(503).json({ error: "Administrator authentication is temporarily unavailable." });
    }
    if (!admin) return res.status(401).json({ error: "Administrator session is no longer valid." });
    if (!AUTHORIZED_ADMIN_ROLES.includes(admin.role)) {
      return res.status(403).json({ error: "Administrator role is not authorized." });
    }
    req.adminUser = admin;
    req.verifiedSession = {
      tokenId: adminSession.tokenId,
      expiresAt: adminSession.expiresAt,
      principalType: "ADMIN"
    };
    if (req.body && typeof req.body === "object") {
      req.body.adminId = admin.id;
      req.body.adminEmail = admin.email;
    }
    return next();
  }
  const session = verifyUserSessionToken(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired session." });
  try {
    if (await databaseAdapter.isSessionRevoked(session.tokenId)) {
      return res.status(401).json({ error: "Session has been revoked." });
    }
    const user = await databaseAdapter.getUser(session.userId);
    if (!user) return res.status(401).json({ error: "Session user no longer exists." });
    const requiredRole = apiRequiresRole(req);
    if (requiredRole && !hasApplicationRole(user, requiredRole)) {
      return res.status(403).json({ error: `A ${requiredRole} role is required for this operation.` });
    }
    const route = `${req.method} ${apiPath}`;
    if (user.isSuspended) {
      if (route === "POST /api/bookings/create" || route.startsWith("POST /api/chat/") || route === "POST /api/companion/availability/toggle") {
        return res.status(403).json({
          error: `Your account has been suspended: ${user.suspendedReason || "Violation of platform guidelines"}. Please contact support.`
        });
      }
    }
    const selfId = user.id;
    if (req.body && typeof req.body === "object") {
      if ("userId" in req.body) req.body.userId = selfId;
      if (route === "POST /api/bookings/create") req.body.clientId = selfId;
      if (/^POST \/api\/bookings\/[^/]+\/arrived$/.test(route)) req.body.companionId = selfId;
      if (route.startsWith("POST /api/chat/")) req.body.senderId = selfId;
      if (route.startsWith("POST /api/support/")) req.body.userId = selfId;
      if (route === "POST /api/payments/razorpay/verify-payment") req.body.userId = selfId;
    }
    const authenticatedReq = req;
    authenticatedReq.authUser = user;
    authenticatedReq.verifiedSession = {
      tokenId: session.tokenId,
      expiresAt: session.expiresAt,
      principalType: "USER"
    };
    const bookingRoute = apiPath.match(/^\/api\/bookings\/([^/]+)\//);
    const chatRoute = apiPath.match(/^\/api\/chat\/([^/]+)$/);
    const bookingId = bookingRoute?.[1] || chatRoute?.[1];
    if (bookingId && (route.startsWith("POST /api/bookings/") || route.startsWith("GET /api/chat/") || route.startsWith("POST /api/chat/"))) {
      let booking;
      try {
        booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings[bookingId];
      } catch (error) {
        console.error("Booking ownership check failed.", error);
        return res.status(503).json({ error: "Booking authorization is temporarily unavailable." });
      }
      if (!booking && route.startsWith("POST /api/bookings/")) {
        return res.status(404).json({ error: "Booking not found." });
      }
      if (booking && booking.clientId !== selfId && booking.companionId !== selfId) {
        return res.status(403).json({ error: "You are not a participant in this booking." });
      }
    }
    if (route === "POST /api/payments/razorpay/verify-payment" && req.body?.bookingId) {
      let booking;
      try {
        booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(req.body.bookingId) : db2.bookings[req.body.bookingId];
      } catch (error) {
        console.error("Payment booking ownership check failed.", error);
        return res.status(503).json({ error: "Payment authorization is temporarily unavailable." });
      }
      if (!booking) return res.status(404).json({ error: "Booking not found." });
      if (booking.clientId !== selfId) return res.status(403).json({ error: "You cannot verify payment for this booking." });
      req.body.userId = selfId;
    }
    if (route.startsWith("POST /api/location/")) {
      const locationBookingId = req.body?.bookingId;
      if (route !== "POST /api/location/update" && !locationBookingId) {
        return res.status(400).json({ error: "Booking ID is required for location sharing." });
      }
      if (locationBookingId) {
        let booking;
        try {
          booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(locationBookingId) : db2.bookings[locationBookingId];
        } catch (error) {
          console.error("Booking location authorization check failed.", error);
          return res.status(503).json({ error: "Booking authorization is temporarily unavailable." });
        }
        if (!booking) return res.status(404).json({ error: "Booking not found." });
        if (!["CONFIRMED", "COMPANION_ARRIVED", "IN_PROGRESS"].includes(booking.status)) {
          return res.status(403).json({ error: "Location sharing is only allowed for an active booking." });
        }
        if (booking.clientId !== selfId && booking.companionId !== selfId) {
          return res.status(403).json({ error: "You are not a participant in this booking." });
        }
      }
    }
    const supportConversationId = apiPath.match(/^\/api\/support\/messages\/([^/]+)$/)?.[1] || (route === "POST /api/support/message" ? req.body?.conversationId : null);
    if (supportConversationId) {
      const conversation = await databaseAdapter.getSupportConversation(supportConversationId);
      if (!conversation) return res.status(404).json({ error: "Support conversation not found." });
      if (conversation.userId !== selfId) return res.status(403).json({ error: "You cannot access this support conversation." });
    }
    if (/^GET \/api\/notifications\/[^/]+$/.test(route) && req.params.userId && req.params.userId !== selfId) {
      return res.status(403).json({ error: "You cannot access another user\u2019s notifications." });
    }
    return next();
  } catch (error) {
    console.error("API session authorization failed.", error);
    return res.status(503).json({ error: "Authentication service is temporarily unavailable." });
  }
});
app.post("/api/auth/check-phone", async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number (+91)." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production authentication requires the configured Supabase database." });
  }
  try {
    const existingUser = await databaseAdapter.getUserByPhone(normalizedPhone);
    return res.json({ registered: Boolean(existingUser), phone: normalizedPhone });
  } catch (error) {
    console.error("Phone registration lookup failed.", error);
    return res.status(503).json({ error: "Account lookup is temporarily unavailable." });
  }
});
app.post("/api/auth/request-otp", async (req, res) => {
  const { phone, purpose } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number (+91)" });
  }
  if (!isApitxtConfigured()) {
    return res.status(503).json({ error: "APITXT SMS is not configured on the backend." });
  }
  if (!isOtpHmacSecretConfigured()) {
    return res.status(503).json({ error: "OTP_HMAC_SECRET must contain at least 32 characters on the backend." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production OTP storage requires the configured Supabase database." });
  }
  const otp = generateOtp();
  let reservation;
  try {
    reservation = await databaseAdapter.reserveOtp(normalizedPhone, hashOtp(otp));
  } catch (error) {
    console.error("OTP challenge reservation failed.", error);
    return res.status(503).json({ error: "OTP service is temporarily unavailable." });
  }
  if (!reservation.allowed) {
    const waitSeconds = reservation.waitSeconds || 60;
    return res.status(429).json({
      error: reservation.reason === "rate_limit" ? `Rate limit reached. Please wait ${waitSeconds}s before requesting another OTP.` : `Please wait ${waitSeconds}s before requesting a new OTP.`,
      retryAfterSeconds: waitSeconds
    });
  }
  const apitxtResult = await sendApitxtOtp({
    mobile: normalizedPhone,
    otp
  });
  if (!apitxtResult.success) {
    try {
      await databaseAdapter.setOtpDeliveryResult(normalizedPhone, false);
    } catch (error) {
      console.error("Failed to close unsuccessful OTP delivery challenge.", error);
      return res.status(503).json({ error: "OTP service is temporarily unavailable." });
    }
    return res.status(502).json({
      error: apitxtResult.error || "APITXT did not accept the OTP request.",
      errorCode: apitxtResult.errorCode
    });
  }
  try {
    await databaseAdapter.setOtpDeliveryResult(normalizedPhone, true, apitxtResult.requestId);
  } catch (error) {
    console.error("APITXT accepted an OTP request, but challenge state could not be updated.", error);
    return res.status(503).json({ error: "OTP service is temporarily unavailable. Request a new code later." });
  }
  return res.json({
    success: true,
    message: "OTP request accepted by APITXT.",
    phoneMasked: normalizedPhone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, "$1 $2******$3"),
    requestId: apitxtResult.requestId,
    resendWaitSeconds: 60
  });
});
app.post("/api/auth/register-with-otp", async (req, res) => {
  const { phone, otp, password } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: "Invalid phone format. Must be +91 followed by 10 digits." });
  }
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "OTP must be exactly six digits." });
  }
  if (typeof password !== "string" || password.length < 6 || password.length > 1024) {
    return res.status(400).json({ error: "Password must be between 6 and 1024 characters long." });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: "OTP authentication secrets are not configured on the backend." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production authentication requires the configured Supabase database." });
  }
  try {
    const existingUser = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (existingUser) {
      return res.status(400).json({ error: "Mobile number already registered. Please login instead." });
    }
    const verification = await databaseAdapter.verifyOtp(normalizedPhone, hashOtp(otp));
    if (verification !== "verified") {
      if (verification === "locked") {
        return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      }
      if (verification === "expired") {
        return res.status(400).json({ error: "OTP expired. Please request a new OTP." });
      }
      if (verification === "invalid") {
        return res.status(400).json({ error: "Incorrect OTP. Please enter the valid 6-digit code." });
      }
      return res.status(400).json({ error: "No valid OTP request was found. Please request a new OTP." });
    }
    const newUser = {
      id: crypto4.randomUUID(),
      phone: normalizedPhone,
      passwordHash: await hashPassword(password),
      role: "DUAL",
      kycStatus: "NOT_SUBMITTED",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const createdUser = await databaseAdapter.createUser(newUser);
    const user = publicAuthUser(createdUser);
    return res.json({
      success: true,
      user,
      token: issueUserSessionToken(createdUser.id),
      isFirstTime: true
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(400).json({ error: "Mobile number already registered. Please login instead." });
    }
    console.error("OTP registration failed.", error);
    return res.status(503).json({ error: "Registration is temporarily unavailable." });
  }
});
app.post("/api/auth/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: "Invalid mobile number." });
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "OTP must be exactly six digits." });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: "OTP authentication secrets are not configured on the backend." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production authentication requires the configured Supabase database." });
  }
  try {
    const user = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ error: "Account not found. Register using the OTP verification flow." });
    }
    const verification = await databaseAdapter.verifyOtp(normalizedPhone, hashOtp(otp));
    if (verification !== "verified") {
      if (verification === "locked") return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      if (verification === "expired") return res.status(400).json({ error: "OTP expired. Please request a new OTP." });
      if (verification === "invalid") return res.status(400).json({ error: "Incorrect OTP." });
      return res.status(400).json({ error: "No valid OTP request was found. Please request a new OTP." });
    }
    return res.json({
      success: true,
      message: "OTP verified successfully.",
      user: publicAuthUser(user),
      token: issueUserSessionToken(user.id)
    });
  } catch (error) {
    console.error("OTP verification failed.", error);
    return res.status(503).json({ error: "OTP verification is temporarily unavailable." });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: "Invalid mobile number." });
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "OTP must be exactly six digits." });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: "Authentication secrets are not configured on the backend." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production authentication requires the configured Supabase database." });
  }
  try {
    const user = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({ error: "Account not found. Please create an account." });
    }
    const verification = await databaseAdapter.verifyOtp(normalizedPhone, hashOtp(otp));
    if (verification !== "verified") {
      if (verification === "locked") return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      if (verification === "expired") return res.status(400).json({ error: "OTP expired. Please request a new OTP." });
      if (verification === "invalid") return res.status(400).json({ error: "Incorrect OTP." });
      return res.status(400).json({ error: "No valid OTP request was found. Please request a new OTP." });
    }
    const passwordHash = await hashPassword(newPassword);
    await databaseAdapter.updateUser(user.id, { passwordHash });
    return res.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password."
    });
  } catch (error) {
    console.error("Password reset failed.", error);
    return res.status(503).json({ error: "Password reset is temporarily unavailable." });
  }
});
app.get("/api/auth/session", async (req, res) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const session = verifyUserSessionToken(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired session." });
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production authentication requires the configured Supabase database." });
  }
  try {
    if (await databaseAdapter.isSessionRevoked(session.tokenId)) {
      return res.status(401).json({ error: "Session has been revoked." });
    }
    const user = await databaseAdapter.getUser(session.userId);
    if (!user) return res.status(401).json({ error: "Session user no longer exists." });
    return res.json({ success: true, user: publicAuthUser(user) });
  } catch (error) {
    console.error("Session validation failed.", error);
    return res.status(503).json({ error: "Session validation is temporarily unavailable." });
  }
});
app.post("/api/auth/logout", async (req, res) => {
  const session = req.verifiedSession;
  const user = req.authUser;
  if (!session || !user) return res.status(401).json({ error: "Authentication required." });
  try {
    await databaseAdapter.revokeSession(session.tokenId, user.id, "USER", session.expiresAt);
    return res.status(204).end();
  } catch (error) {
    console.error("User session revocation failed.", error);
    return res.status(503).json({ error: "Logout could not be completed." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { phone, password } = req.body;
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
    return res.status(400).json({ error: "Password must be between 1 and 1024 characters long." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production authentication requires the configured Supabase database." });
  }
  try {
    const user = await databaseAdapter.getUserByPhone(normalizedPhone);
    if (!user) {
      return res.status(404).json({
        error: "Not registered yet? Please Sign In to create your account.",
        isNotRegistered: true
      });
    }
    if (!isSessionSecretConfigured()) {
      return res.status(503).json({ error: "SESSION_SECRET must contain at least 32 characters on the backend." });
    }
    if (!user.passwordHash) {
      return res.status(400).json({
        error: "No password is set for this account. Please sign in via OTP.",
        noPasswordSet: true
      });
    }
    const passwordVerification = await verifyPassword(password, user.passwordHash);
    if (!passwordVerification.valid) {
      return res.status(401).json({
        error: "Invalid mobile number or password. Please verify and try again.",
        isInvalidCredentials: true
      });
    }
    if (passwordVerification.upgradedHash) {
      await databaseAdapter.updateUser(user.id, { passwordHash: passwordVerification.upgradedHash });
    }
    return res.json({
      success: true,
      user: publicAuthUser(user),
      token: issueUserSessionToken(user.id)
    });
  } catch (error) {
    console.error("Password authentication failed.", error);
    return res.status(503).json({ error: "Authentication is temporarily unavailable." });
  }
});
app.post("/api/auth/select-role", async (req, res) => {
  const { role } = req.body;
  const user = req.authUser;
  const userId = user.id;
  if (role !== "CLIENT" && role !== "COMPANION") {
    return res.status(400).json({ error: "Invalid role selection." });
  }
  let targetRole = user.role;
  if (user.role !== "DUAL" && user.role !== role) {
    targetRole = "DUAL";
  }
  try {
    const updated = await databaseAdapter.updateUser(userId, {
      role: targetRole,
      activeRole: role
    });
    if (db2.users && db2.users[userId]) {
      db2.users[userId].role = targetRole;
      db2.users[userId].activeRole = role;
    }
    return res.json({
      success: true,
      role: targetRole,
      activeRole: updated?.activeRole || role,
      kycStatus: updated?.kycStatus || user.kycStatus
    });
  } catch (error) {
    console.error("Role selection could not be persisted.", error);
    return res.status(503).json({ error: "Role selection is temporarily unavailable." });
  }
});
app.post("/api/kyc/submit", async (req, res) => {
  const {
    userId,
    legalName,
    profileName,
    dob,
    idType,
    idFrontUrl,
    idBackUrl,
    selfieUrl,
    bio,
    profilePhoto,
    photos,
    city,
    userType
  } = req.body;
  const authenticatedUser = req.authUser;
  const authenticatedUserId = authenticatedUser.id;
  let effectiveRole = authenticatedUser.role;
  let effectiveActiveRole = authenticatedUser.activeRole;
  if (userType && ["CLIENT", "COMPANION"].includes(userType) && authenticatedUser.role !== "DUAL" && authenticatedUser.role !== userType) {
    effectiveRole = "DUAL";
    effectiveActiveRole = userType;
    await databaseAdapter.updateUser(authenticatedUserId, { role: "DUAL", activeRole: userType }).catch(() => null);
    if (db2.users && db2.users[authenticatedUserId]) {
      db2.users[authenticatedUserId].role = "DUAL";
      db2.users[authenticatedUserId].activeRole = userType;
    }
  }
  const requestedKycRole = userType || (effectiveRole === "DUAL" ? effectiveActiveRole : effectiveRole);
  if (userId && userId !== authenticatedUserId || !["CLIENT", "COMPANION"].includes(requestedKycRole)) {
    return res.status(403).json({ error: "Your account is not permitted to submit KYC for this role." });
  }
  let user;
  try {
    user = getDatabaseType() === "supabase" ? await databaseAdapter.getUser(authenticatedUserId) : db2.users[authenticatedUserId];
  } catch (error) {
    console.error("KYC account lookup failed.", error);
    return res.status(503).json({ error: "KYC submission is temporarily unavailable." });
  }
  if (!user) {
    return res.status(404).json({ error: "Authenticated user was not found." });
  }
  const birthDate = typeof dob === "string" ? /* @__PURE__ */ new Date(`${dob}T00:00:00.000Z`) : new Date(Number.NaN);
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dob) {
    return res.status(400).json({ error: "Date of birth is required." });
  }
  const today = /* @__PURE__ */ new Date();
  let calculatedAge = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayNotReached = today.getUTCMonth() < birthDate.getUTCMonth() || today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate();
  if (birthdayNotReached) calculatedAge -= 1;
  if (birthDate.getTime() > Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) || calculatedAge < 18) {
    return res.status(400).json({ error: "You must be at least 18 years of age to use PairUpToday." });
  }
  if (typeof legalName !== "string" || !legalName.trim() || legalName.trim().length > 255 || !["AADHAAR", "PAN", "VOTER_ID", "PASSPORT"].includes(idType) || !idFrontUrl || !selfieUrl) {
    return res.status(400).json({ error: "Legal name, government ID and live selfie are mandatory." });
  }
  if (bio !== void 0 && bio !== null && (typeof bio !== "string" || bio.length > 2e3)) {
    return res.status(400).json({ error: "Bio must be a string no longer than 2000 characters." });
  }
  if (photos !== void 0 && (!Array.isArray(photos) || photos.length > 6 || photos.some((photo) => typeof photo !== "string"))) {
    return res.status(400).json({ error: "Profile photos must be a list of up to six strings." });
  }
  if (city !== void 0 && (typeof city !== "string" || city.length > 100)) {
    return res.status(400).json({ error: "City must be a string no longer than 100 characters." });
  }
  const frontImage = parseKycImageDataUrl(idFrontUrl);
  const selfieImage = parseKycImageDataUrl(selfieUrl);
  const backImage = idBackUrl ? parseKycImageDataUrl(idBackUrl) : null;
  if (!frontImage || !selfieImage || idType !== "PAN" && !backImage || idBackUrl && !backImage) {
    return res.status(400).json({ error: "Upload valid JPEG, PNG or WebP identity images; the ID back image is required unless using PAN." });
  }
  const kycId = crypto4.randomUUID();
  const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
  const kycBucket = requestedKycRole === "COMPANION" ? "companion-kyc-documents" : "client-kyc-documents";
  const documentPaths = [];
  const submission = {
    id: kycId,
    userId: authenticatedUserId,
    userPhone: user.phone,
    legalName: legalName.trim(),
    profileName: typeof profileName === "string" && profileName.trim() ? profileName.trim() : legalName.trim(),
    dob,
    idType,
    idFrontUrl: `${authenticatedUserId}/${kycId}/id-front.${frontImage.extension}`,
    idBackUrl: backImage ? `${authenticatedUserId}/${kycId}/id-back.${backImage.extension}` : null,
    selfieUrl: `${authenticatedUserId}/${kycId}/selfie.${selfieImage.extension}`,
    bio: bio || "",
    photos: Array.isArray(photos) ? photos.slice(0, 6) : [],
    city: city || "New Delhi",
    status: "PENDING",
    submittedAt,
    userType: requestedKycRole
  };
  try {
    if (getDatabaseType() === "supabase") {
      const uploadOperations = [
        { path: submission.idFrontUrl, image: frontImage },
        ...backImage && submission.idBackUrl ? [{ path: submission.idBackUrl, image: backImage }] : [],
        { path: submission.selfieUrl, image: selfieImage }
      ];
      for (const document of uploadOperations) {
        await databaseAdapter.uploadKycDocument(kycBucket, document.path, document.image.bytes, document.image.contentType);
        documentPaths.push(document.path);
      }
      await databaseAdapter.submitKycSubmission(submission);
      await databaseAdapter.updateUser(authenticatedUserId, {
        profileName: submission.profileName,
        bio: submission.bio,
        photos: submission.photos,
        profilePhoto: profilePhoto || selfieUrl
      }).catch((err) => console.warn("Non-fatal profile sync after KYC submit:", err));
      if (db2.users && db2.users[authenticatedUserId]) {
        db2.users[authenticatedUserId].profileName = submission.profileName;
        db2.users[authenticatedUserId].bio = submission.bio;
        db2.users[authenticatedUserId].photos = submission.photos;
        db2.users[authenticatedUserId].profilePhoto = profilePhoto || selfieUrl;
      }
    } else {
      const localSubmission = {
        ...submission,
        idFrontUrl,
        idBackUrl: idBackUrl || null,
        selfieUrl
      };
      db2.kycSubmissions[kycId] = localSubmission;
      user.legalName = submission.legalName;
      user.profileName = submission.profileName;
      user.dob = dob;
      user.age = calculatedAge;
      user.kycStatus = "PENDING";
      user.kycSubmittedAt = submittedAt;
      user.bio = submission.bio;
      user.photos = submission.photos;
      user.profilePhoto = profilePhoto || selfieUrl;
      user.city = submission.city;
      saveDB(db2);
    }
  } catch (error) {
    if (documentPaths.length > 0) {
      try {
        await databaseAdapter.deleteKycDocuments(kycBucket, documentPaths);
      } catch (cleanupError) {
        console.error("Failed to clean up incomplete KYC document upload.", cleanupError);
      }
    }
    console.error("KYC submission could not be persisted.", error);
    return res.status(503).json({ error: "KYC submission is temporarily unavailable. Please try again later." });
  }
  return res.json({
    success: true,
    mandatoryLogout: true,
    message: "KYC submitted for verification. Please log in again."
  });
});
app.get("/api/user/profile", async (req, res) => {
  const authUser = req.authUser;
  if (!authUser?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  let user;
  if (getDatabaseType() === "supabase") {
    user = await databaseAdapter.getUser(authUser.id);
  } else {
    user = db2.users[authUser.id];
  }
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ success: true, user: publicAuthUser(user) });
});
app.post("/api/user/profile", async (req, res) => {
  try {
    const authUser = req.authUser;
    if (!authUser?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { profileName, bio, profilePhoto, photos, city, state, address, latitude, longitude } = req.body;
    let user;
    if (getDatabaseType() === "supabase") {
      user = await databaseAdapter.getUser(authUser.id);
    } else {
      user = db2.users[authUser.id];
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (profileName !== void 0) {
      if (typeof profileName !== "string" || !profileName.trim()) {
        return res.status(400).json({ error: "Profile display name cannot be blank." });
      }
      user.profileName = profileName.trim().slice(0, 60);
    }
    if (bio !== void 0) {
      if (typeof bio !== "string" || bio.length > 2e3) {
        return res.status(400).json({ error: "Bio must be at most 2000 characters." });
      }
      user.bio = bio.trim();
    }
    if (city !== void 0) {
      user.city = typeof city === "string" ? city.trim().slice(0, 100) : user.city;
    }
    if (state !== void 0) {
      user.state = typeof state === "string" ? state.trim().slice(0, 100) : user.state;
    }
    if (address !== void 0) {
      user.address = typeof address === "string" ? address.trim().slice(0, 255) : user.address;
    }
    if (latitude !== void 0 && Number.isFinite(Number(latitude))) {
      user.latitude = Number(latitude);
    }
    if (longitude !== void 0 && Number.isFinite(Number(longitude))) {
      user.longitude = Number(longitude);
    }
    if (profilePhoto !== void 0) {
      if (typeof profilePhoto === "string" && profilePhoto.trim()) {
        user.profilePhoto = profilePhoto.trim();
      }
    }
    if (photos !== void 0) {
      if (!Array.isArray(photos)) {
        return res.status(400).json({ error: "Photos must be an array of image strings." });
      }
      const cleanPhotos = photos.filter((p) => typeof p === "string" && p.trim()).slice(0, 6);
      user.photos = cleanPhotos;
      if (!user.profilePhoto && cleanPhotos.length > 0) {
        user.profilePhoto = cleanPhotos[0];
      }
    }
    if (db2.users) {
      if (!db2.users[authUser.id]) {
        db2.users[authUser.id] = { ...user, id: authUser.id };
      }
      if (user.profileName) db2.users[authUser.id].profileName = user.profileName;
      if (user.bio !== void 0) db2.users[authUser.id].bio = user.bio;
      if (user.city !== void 0) db2.users[authUser.id].city = user.city;
      if (user.state !== void 0) db2.users[authUser.id].state = user.state;
      if (user.address !== void 0) db2.users[authUser.id].address = user.address;
      if (user.latitude !== void 0) db2.users[authUser.id].latitude = user.latitude;
      if (user.longitude !== void 0) db2.users[authUser.id].longitude = user.longitude;
      if (user.profilePhoto) db2.users[authUser.id].profilePhoto = user.profilePhoto;
      if (user.photos) db2.users[authUser.id].photos = user.photos;
      if (process.env.NODE_ENV !== "production" && getDatabaseType() !== "supabase") {
        try {
          saveDB(db2);
        } catch (e) {
          console.warn("saveDB non-fatal:", e);
        }
      }
    }
    if (db2.companionProfiles && db2.companionProfiles[authUser.id]) {
      if (user.bio !== void 0) db2.companionProfiles[authUser.id].bio = user.bio;
      if (user.address !== void 0 || user.city !== void 0) db2.companionProfiles[authUser.id].address = user.address || user.city;
      if (user.state !== void 0) db2.companionProfiles[authUser.id].state = user.state;
      if (user.latitude !== void 0) db2.companionProfiles[authUser.id].latitude = user.latitude;
      if (user.longitude !== void 0) db2.companionProfiles[authUser.id].longitude = user.longitude;
    }
    try {
      if (getDatabaseType() === "supabase") {
        const updated = await databaseAdapter.updateUser(authUser.id, {
          profileName: user.profileName,
          bio: user.bio,
          profilePhoto: user.profilePhoto,
          photos: user.photos,
          ...user.city !== void 0 ? { city: user.city } : {},
          ...user.state !== void 0 ? { state: user.state } : {}
        });
        if (updated) {
          user = { ...user, ...updated };
        }
        await databaseAdapter.updateCompanionProfile(authUser.id, {
          ...user.address !== void 0 || user.city !== void 0 ? { address: user.address || user.city } : {},
          ...user.state !== void 0 ? { state: user.state } : {},
          ...user.latitude !== void 0 ? { latitude: user.latitude } : {},
          ...user.longitude !== void 0 ? { longitude: user.longitude } : {}
        }).catch(() => null);
      }
    } catch (err) {
      console.warn("Supabase updateUser non-fatal warning", err);
    }
    return res.json({
      success: true,
      user: publicAuthUser(user)
    });
  } catch (error) {
    console.error("Fatal error in POST /api/user/profile:", error);
    return res.status(500).json({ error: error?.message || "Internal error updating profile" });
  }
});
app.post("/api/user/change-password", async (req, res) => {
  const authUser = req.authUser;
  const verifiedSession = req.verifiedSession;
  if (!authUser?.id) {
    return res.status(401).json({ error: "Authentication required." });
  }
  const { otp, newPassword } = req.body;
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "OTP must be exactly six digits." });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: "Authentication secrets are not configured on the backend." });
  }
  try {
    const user = await databaseAdapter.getUser(authUser.id);
    if (!user || !user.phone) {
      return res.status(404).json({ error: "User account or registered phone not found." });
    }
    const verification = await databaseAdapter.verifyOtp(user.phone, hashOtp(otp));
    if (verification !== "verified") {
      if (verification === "locked") return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      if (verification === "expired") return res.status(400).json({ error: "OTP expired. Please request a new OTP." });
      if (verification === "invalid") return res.status(400).json({ error: "Incorrect OTP." });
      return res.status(400).json({ error: "No valid OTP request was found. Please request a new OTP." });
    }
    const passwordHash = await hashPassword(newPassword);
    await databaseAdapter.updateUser(user.id, { passwordHash });
    if (verifiedSession?.tokenId) {
      await databaseAdapter.revokeSession(
        verifiedSession.tokenId,
        user.id,
        "USER",
        verifiedSession.expiresAt
      );
    }
    return res.json({
      success: true,
      message: "Password changed successfully. Please log in with your new password."
    });
  } catch (error) {
    console.error("Change password failed.", error);
    return res.status(503).json({ error: "Change password is temporarily unavailable." });
  }
});
app.post("/api/user/delete-account", async (req, res) => {
  const authUser = req.authUser;
  const verifiedSession = req.verifiedSession;
  if (!authUser?.id) {
    return res.status(401).json({ error: "Authentication required." });
  }
  const { otp, confirmDelete } = req.body;
  if (!confirmDelete) {
    return res.status(400).json({ error: "Confirmation is required to delete your account." });
  }
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "OTP must be exactly six digits." });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: "Authentication secrets are not configured on the backend." });
  }
  try {
    const user = await databaseAdapter.getUser(authUser.id);
    if (!user || !user.phone) {
      return res.status(404).json({ error: "User account or registered phone not found." });
    }
    const verification = await databaseAdapter.verifyOtp(user.phone, hashOtp(otp));
    if (verification !== "verified") {
      if (verification === "locked") return res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      if (verification === "expired") return res.status(400).json({ error: "OTP expired. Please request a new OTP." });
      if (verification === "invalid") return res.status(400).json({ error: "Incorrect OTP." });
      return res.status(400).json({ error: "No valid OTP request was found. Please request a new OTP." });
    }
    if (verifiedSession?.tokenId) {
      await databaseAdapter.revokeSession(
        verifiedSession.tokenId,
        user.id,
        "USER",
        verifiedSession.expiresAt
      );
    }
    await databaseAdapter.deleteUser(user.id);
    return res.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted."
    });
  } catch (error) {
    console.error("Delete account failed.", error);
    return res.status(503).json({ error: "Account deletion is temporarily unavailable." });
  }
});
app.post("/api/companion/services-rates", async (req, res) => {
  const userId = req.authUser.id;
  const { services, rates, availability } = req.body;
  if (services === void 0 && rates === void 0 && availability === void 0) {
    return res.status(400).json({ error: "At least one companion profile field must be provided." });
  }
  if (services !== void 0 && (!Array.isArray(services) || services.some((service) => !Number.isInteger(service)))) {
    return res.status(400).json({ error: "Services must be a list of integer service IDs." });
  }
  if (rates !== void 0 && (!rates || typeof rates !== "object" || Array.isArray(rates) || !["hourlyPaise", "halfDayPaise", "fullDayPaise"].every((key) => Number.isSafeInteger(rates[key]) && rates[key] >= 0))) {
    return res.status(400).json({ error: "Rates must contain valid non-negative integer paise amounts." });
  }
  if (availability !== void 0 && (!availability || typeof availability !== "object" || Array.isArray(availability) || !Array.isArray(availability.days) || !availability.days.every((day) => typeof day === "string") || typeof availability.startTime !== "string" || typeof availability.endTime !== "string")) {
    return res.status(400).json({ error: "Availability must include days, startTime, and endTime." });
  }
  if (getDatabaseType() === "json") {
    const user = db2.users[userId];
    if (!user) return res.status(404).json({ error: "User not found" });
    let profile = db2.companionProfiles[userId];
    if (!profile) {
      profile = {
        userId,
        services: services || [1, 2, 4],
        rates: rates || { hourlyPaise: 49900, halfDayPaise: 169900, fullDayPaise: 299900 },
        availability: availability || {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          startTime: "09:00",
          endTime: "21:00"
        },
        isLive: false,
        rating: 5,
        totalBookings: 0
      };
      db2.companionProfiles[userId] = profile;
    } else {
      if (services !== void 0) profile.services = services;
      if (rates !== void 0) profile.rates = rates;
      if (availability !== void 0) profile.availability = availability;
    }
    profile.isLive = Boolean(
      user.kycStatus === "APPROVED" && profile.membership?.isActive && new Date(profile.membership.expiryDate) > /* @__PURE__ */ new Date() && profile.bankDetails?.isVerified && !profile.isPaused
    );
    saveDB(db2);
    return res.json({ success: true, profile });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    let profile = await databaseAdapter.getCompanionProfile(userId);
    if (!profile) {
      profile = await databaseAdapter.upsertCompanionProfile({
        userId,
        services: services || [1, 2, 4],
        rates: rates || { hourlyPaise: 49900, halfDayPaise: 169900, fullDayPaise: 299900 },
        availability: availability || {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          startTime: "09:00",
          endTime: "21:00"
        },
        isLive: false,
        rating: 5,
        totalBookings: 0
      });
    } else {
      profile = await databaseAdapter.updateCompanionProfile(userId, {
        ...services !== void 0 ? { services } : {},
        ...rates !== void 0 ? { rates } : {},
        ...availability !== void 0 ? { availability } : {}
      });
    }
    if (user.role === "CLIENT") {
      await databaseAdapter.updateUser(userId, { role: "DUAL", activeRole: "COMPANION" }).catch(() => null);
      if (db2.users && db2.users[userId]) {
        db2.users[userId].role = "DUAL";
        db2.users[userId].activeRole = "COMPANION";
      }
    }
    const [companionKyc, clientKyc, membership, bankVerification] = await Promise.all([
      databaseAdapter.getUserKycSubmission(userId, "COMPANION"),
      databaseAdapter.getUserKycSubmission(userId, "CLIENT").catch(() => null),
      databaseAdapter.getActiveMembership(userId),
      databaseAdapter.getBankVerification(userId)
    ]);
    const membershipValid = Boolean(membership?.paymentStatus === "PAID" && new Date(membership.expiryDate) > /* @__PURE__ */ new Date());
    const bankVerified = bankVerification?.verificationStatus === "VERIFIED" || bankVerification?.isVerified === true;
    const effectiveKyc = companionKyc || (clientKyc?.status === "APPROVED" ? clientKyc : null);
    const kycApproved = Boolean(effectiveKyc?.status === "APPROVED" || user.kycStatus === "APPROVED" || user.kyc_status === "APPROVED");
    const isLive = Boolean(
      kycApproved && profile && membershipValid && bankVerified && !profile.isPaused
    );
    if (profile.isLive !== isLive) {
      profile = await databaseAdapter.updateCompanionProfile(userId, { isLive });
    }
    return res.json({
      success: true,
      profile: {
        ...profile,
        membership: membership ? { ...membership, isActive: membershipValid } : null,
        bankDetails: bankVerification ? {
          isVerified: bankVerified,
          accountNumberMasked: bankVerification.accountNumberMasked || null,
          ifsc: bankVerification.ifsc,
          accountHolderName: bankVerification.accountHolderName,
          verifiedAt: bankVerification.verifiedAt
        } : null
      }
    });
  } catch (error) {
    console.error("Companion profile could not be saved.", error);
    return res.status(503).json({ error: "Companion profile is temporarily unavailable." });
  }
});
app.post("/api/companion/membership/subscribe", async (req, res) => {
  const userId = req.authUser.id;
  const plan = req.body?.plan;
  const plans = {
    STARTER: { amountPaise: 44900, durationDays: 30 },
    PROFESSIONAL: { amountPaise: 109900, durationDays: 90 },
    PREMIUM: { amountPaise: 599900, durationDays: 365 }
  };
  const planDetails = typeof plan === "string" ? plans[plan] : void 0;
  if (!planDetails) return res.status(400).json({ error: "Invalid plan selection." });
  if (getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Membership checkout requires the configured Supabase database." });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(401).json({ error: "Authenticated Companion account was not found." });

    // Strict Rule: Companion Govt ID KYC Name must match Bank Account Beneficiary Name
    const companionGovtName = (user.legalName || user.name || '').trim();
    if (companionGovtName && !compareLegalAndBankNames(companionGovtName, accountHolderName)) {
      return res.status(400).json({
        error: `Bank beneficiary name ("${accountHolderName}") must strictly match your Government ID KYC name ("${companionGovtName}"). Third-party bank accounts are strictly prohibited.`
      });
    }
    if (user.role === "CLIENT") {
      await databaseAdapter.updateUser(userId, { role: "DUAL", activeRole: "COMPANION" }).catch(() => null);
      if (db2.users && db2.users[userId]) {
        db2.users[userId].role = "DUAL";
        db2.users[userId].activeRole = "COMPANION";
      }
    }
    const startedAt = /* @__PURE__ */ new Date();
    const membershipId = crypto4.randomUUID();
    const order = await createRazorpayOrder({
      amountPaise: planDetails.amountPaise,
      receipt: `mem_${membershipId.replace(/-/g, "").slice(0, 28)}`,
      notes: { membershipId, orderType: "MEMBERSHIP", membershipPlan: plan, userId }
    });
    if (!order.success || !order.orderId) {
      return res.status(503).json({ error: order.error || "Razorpay could not create the membership payment order." });
    }
    const membership = await databaseAdapter.createMembership({
      id: membershipId,
      userId,
      plan,
      pricePaise: planDetails.amountPaise,
      startDate: startedAt.toISOString(),
      expiryDate: new Date(startedAt.getTime() + planDetails.durationDays * 864e5).toISOString(),
      paymentOrderId: order.orderId,
      paymentStatus: "PENDING"
    });
    return res.status(201).json({
      success: true,
      membership,
      payment: { orderId: order.orderId, amountPaise: order.amountPaise, currency: order.currency, keyId: order.keyId }
    });
  } catch (error) {
    console.error("Membership order creation failed.", error);
    return res.status(503).json({ error: "Membership checkout is temporarily unavailable." });
  }
});
app.post("/api/companion/bank/verify", async (req, res) => {
  const userId = req.authUser.id;
  const accountNumber = typeof req.body?.accountNumber === "string" ? req.body.accountNumber.trim() : "";
  const ifsc = typeof req.body?.ifsc === "string" ? req.body.ifsc.trim().toUpperCase() : "";
  const accountHolderName = typeof req.body?.accountHolderName === "string" ? req.body.accountHolderName.trim() : "";
  if (!/^[A-Za-z0-9-]{6,40}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6,7}$/.test(ifsc) || accountHolderName.length < 2 || accountHolderName.length > 255) {
    return res.status(400).json({ error: "Bank account details are invalid." });
  }
  if (getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Bank verification requires the configured Supabase database." });
  }
  let encryptedAccountNumber;
  try {
    encryptedAccountNumber = encryptBankAccount(accountNumber);
  } catch (error) {
    console.error("Bank account encryption is not configured.", error);
    return res.status(503).json({ error: "Bank verification is unavailable until backend account encryption is configured." });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(401).json({ error: "Authenticated Companion account was not found." });
    if (user.role === "CLIENT") {
      await databaseAdapter.updateUser(userId, { role: "DUAL", activeRole: "COMPANION" }).catch(() => null);
      if (db2.users && db2.users[userId]) {
        db2.users[userId].role = "DUAL";
        db2.users[userId].activeRole = "COMPANION";
      }
    }
    const accountNumberLast4 = accountNumber.slice(-4);
    await databaseAdapter.createBankVerification({
      userId,
      accountNumberEncrypted: encryptedAccountNumber,
      accountNumberLast4,
      ifsc,
      accountHolderName,
      verificationStatus: "PENDING",
      nameAtBank: null,
      nameMatched: null,
      providerRequestId: null,
      verifiedAt: null
    });
    const verificationResult = await verifyApitxtBankAccount({
      ifsc,
      accountNumber,
      accountHolderName,
      mobile: user.phone,
      kycLegalName: user.legalName
    });
    if (!verificationResult.success) {
      await databaseAdapter.updateBankVerification(userId, {
        verificationStatus: "FAILED",
        nameAtBank: verificationResult.nameAtBank || null,
        nameMatched: verificationResult.nameMatched ?? null,
        providerRequestId: verificationResult.requestId || null,
        verifiedAt: null
      });
      const providerUnavailable = !isApitxtConfigured() || verificationResult.errorCode === 105 || verificationResult.errorCode === 301 || verificationResult.errorCode === 304 || verificationResult.errorCode === 310 || verificationResult.errorCode === void 0;
      return res.status(providerUnavailable ? 503 : 422).json({
        error: verificationResult.error || "Bank account verification was not approved by APITXT.",
        errorCode: verificationResult.errorCode,
        accountExists: verificationResult.accountExists,
        nameMatched: verificationResult.nameMatched
      });
    }
    const verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    await databaseAdapter.createBankVerification({
      userId,
      accountNumberEncrypted: encryptedAccountNumber,
      accountNumberLast4,
      ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
      bankName: null,
      accountHolderName: verificationResult.nameAtBank || accountHolderName,
      verificationStatus: "VERIFIED",
      nameAtBank: verificationResult.nameAtBank || accountHolderName,
      nameMatched: verificationResult.nameMatched !== false,
      providerRequestId: verificationResult.requestId || null,
      verifiedAt
    });
    const [profile, companionKyc, membership] = await Promise.all([
      databaseAdapter.getCompanionProfile(userId),
      databaseAdapter.getUserKycSubmission(userId, "COMPANION"),
      databaseAdapter.getActiveMembership(userId)
    ]);
    const isLive = Boolean(
      profile && companionKyc?.status === "APPROVED" && membership && membership.paymentStatus === "PAID" && new Date(membership.expiryDate) > /* @__PURE__ */ new Date() && !profile.isPaused
    );
    if (profile) {
      await databaseAdapter.updateCompanionProfile(userId, {
        isLive,
        bankDetails: {
          isVerified: true,
          accountNumberMasked: `\u2022\u2022\u2022\u2022${accountNumberLast4}`,
          ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
          accountHolderName: verificationResult.nameAtBank || accountHolderName,
          verifiedAt
        }
      });
    }
    await databaseAdapter.createAuditLog({
      userId,
      action: "BANK_ACCOUNT_VERIFIED",
      entityType: "bank_verification",
      entityId: userId,
      details: {
        accountNumberLast4,
        providerRequestId: verificationResult.requestId || null,
        isLive
      }
    });
    return res.json({
      success: true,
      message: "Bank verification was approved by APITXT.",
      bankDetails: {
        accountNumberMasked: `\u2022\u2022\u2022\u2022${accountNumberLast4}`,
        ifsc: (verificationResult.ifsc || ifsc).toUpperCase(),
        accountHolderName: verificationResult.nameAtBank || accountHolderName,
        isVerified: true,
        requestId: verificationResult.requestId
      },
      isLive
    });
  } catch (error) {
    console.error("APITXT bank verification or persistence failed.", error);
    return res.status(503).json({ error: "Bank verification is temporarily unavailable." });
  }
});
app.post("/api/payments/razorpay/create-order", async (req, res) => {
  const { amountPaise, receipt, notes, type, plan, membershipPlan } = req.body;
  let authoritativeAmountPaise = amountPaise;
  const targetPlan = plan || membershipPlan || notes?.membershipPlan;
  const targetCompId = req.body.companionId || notes?.companionId;
  if (targetCompId) {
    const companionProfile = await databaseAdapter.getCompanionProfile(targetCompId);
    if (companionProfile?.isInitialListing) {
      return res.status(400).json({ error: "This profile is currently unavailable for booking." });
    }
  }
  if (type === "MEMBERSHIP" || targetPlan) {
    if (targetPlan === "STARTER") {
      authoritativeAmountPaise = 44900;
    } else if (targetPlan === "PROFESSIONAL") {
      authoritativeAmountPaise = 109900;
    } else if (targetPlan === "PREMIUM") {
      authoritativeAmountPaise = 599900;
    } else {
      return res.status(400).json({ error: "Invalid companion membership plan specified." });
    }
  }
  if (!authoritativeAmountPaise || authoritativeAmountPaise <= 0) {
    return res.status(400).json({ error: "Valid amount in paise is required." });
  }
  const orderResult = await createRazorpayOrder({
    amountPaise: authoritativeAmountPaise,
    receipt: receipt || `rec_${Date.now()}`,
    notes: {
      ...notes || {},
      orderType: type || (targetPlan ? "MEMBERSHIP" : "BOOKING"),
      membershipPlan: targetPlan || "",
      userId: req.authUser.id
    }
  });
  if (!orderResult.success) {
    return res.status(500).json({ error: orderResult.error || "Failed to create payment order." });
  }
  return res.json({
    success: true,
    orderId: orderResult.orderId,
    amountPaise: orderResult.amountPaise,
    currency: orderResult.currency,
    keyId: orderResult.keyId
  });
});
var bookingAcceptanceMap = /* @__PURE__ */ new Map();
var VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BJKQEyEeD663ApEU_-mZmzHUd-NFw0ZW5l35BsSxT4TFmnSV104zIJXmrhS2oxw9oGIL_Qdk4FOjk5MyS6NrIAU";
var VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "JrMwLP6wNU01K_pvgBXt9WSYC_CZU8UEfie3Qn6GU0M";
var VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@pairuptoday.com";
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("Web Push VAPID initialized successfully.");
} catch (vapidErr) {
  console.warn("Web Push setVapidDetails warning:", vapidErr);
}
var PUSH_SUBS_FILE = path2.join(DATA_DIR2, "push_subscriptions.json");
function loadPushSubscriptions() {
  const map = /* @__PURE__ */ new Map();
  try {
    if (fs2.existsSync(PUSH_SUBS_FILE)) {
      const raw = fs2.readFileSync(PUSH_SUBS_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) map.set(k, v);
      }
    }
  } catch (e) {
    console.warn("Could not load push subscriptions from disk:", e);
  }
  return map;
}
function savePushSubscriptions(map) {
  try {
    if (!fs2.existsSync(DATA_DIR2)) fs2.mkdirSync(DATA_DIR2, { recursive: true });
    const obj = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    fs2.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save push subscriptions to disk:", e);
  }
}
var companionPushSubscriptions = loadPushSubscriptions();
var companionAlertStreams = /* @__PURE__ */ new Map();
async function pushCompanionAlert(companionId, event) {
  if (!companionId) return;
  if (event.type === "NEW_BOOKING_REQUEST") {
    try {
      const profile = getDatabaseType() === "supabase" ? await databaseAdapter.getCompanionProfile(companionId) : db2.companionProfiles[companionId];
      if (profile && profile.isPaused === true) {
        console.log(`[pushCompanionAlert] Suppressed NEW_BOOKING_REQUEST for offline companion: ${companionId}`);
        return;
      }
    } catch (e) {
      console.warn("[pushCompanionAlert] Companion status check notice:", e);
    }
  }
  const streams = companionAlertStreams.get(companionId);
  if (streams && streams.size > 0) {
    const payload = `data: ${JSON.stringify(event)}

`;
    streams.forEach((res) => {
      try {
        if (!res.writableEnded) {
          res.write(payload);
        }
      } catch {
        streams.delete(res);
      }
    });
  }
  const subs = companionPushSubscriptions.get(companionId);
  if (subs && subs.length > 0) {
    const totalAmount = event.booking?.totalPayablePaise ? Math.round(event.booking.totalPayablePaise / 100) : event.booking?.totalAmount || 1e3;
    const pushPayload = JSON.stringify({
      title: event.type === "NEW_BOOKING_REQUEST" ? "\u{1F6A8} URGENT: Incoming Booking Call!" : event.type === "BOOKING_CANCELLED" ? "\u26A0\uFE0F Booking Canceled by Client" : "PairUpToday Companion Alert",
      body: event.type === "NEW_BOOKING_REQUEST" ? `${event.booking?.clientName || "A Client"} requested a ${event.booking?.serviceName || "Session"} (\u20B9${totalAmount}). Tap to Answer & Accept!` : event.type === "BOOKING_CANCELLED" ? "The client canceled this booking request." : "Update on PairUpToday Host Portal",
      tag: event.type === "NEW_BOOKING_REQUEST" ? "incoming-booking-call" : "booking-alert",
      type: event.type,
      bookingId: event.bookingId || event.booking?.id,
      booking: event.booking,
      url: "/companion-dashboard"
    });
    const pushOptions = {
      TTL: 120,
      // 2 minutes urgency window
      urgency: "high",
      headers: {
        Urgency: "high",
        Topic: "incoming-call"
      }
    };
    const activeSubs = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, pushPayload, pushOptions);
        activeSubs.push(sub);
      } catch (pushErr) {
        if (pushErr?.statusCode !== 404 && pushErr?.statusCode !== 410) {
          activeSubs.push(sub);
        }
      }
    }
    companionPushSubscriptions.set(companionId, activeSubs);
    savePushSubscriptions(companionPushSubscriptions);
  }
}
app.get("/api/companion/push-vapid-key", (req, res) => {
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});
app.post("/api/companion/push-subscription", async (req, res) => {
  const authUser = req.authUser;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription object." });
  }
  const list = companionPushSubscriptions.get(authUser.id) || [];
  const filtered = list.filter((s) => s.endpoint !== subscription.endpoint);
  filtered.push(subscription);
  companionPushSubscriptions.set(authUser.id, filtered);
  savePushSubscriptions(companionPushSubscriptions);
  return res.json({ success: true, count: filtered.length });
});
app.get("/api/companion/bookings", async (req, res) => {
  const authUser = req.authUser;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const bookings = getDatabaseType() === "supabase" ? await databaseAdapter.listBookings({ companionId: authUser.id }) : Object.values(db2.bookings).filter((b) => b.companionId === authUser.id);
    return res.json({ bookings });
  } catch (err) {
    const list = Object.values(db2.bookings || {}).filter((b) => b.companionId === authUser.id);
    return res.json({ bookings: list });
  }
});
app.post("/api/payments/razorpay/verify-payment", async (req, res) => {
  const { orderId, paymentId, signature, bookingId, membershipPlan } = req.body || {};
  const authUserId = req.authUser.id;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" || Boolean(bookingId) === Boolean(membershipPlan)) {
    return res.status(400).json({ success: false, error: "Provide valid payment details for exactly one booking or membership." });
  }
  if (membershipPlan && !["STARTER", "PROFESSIONAL", "PREMIUM"].includes(membershipPlan)) {
    return res.status(400).json({ success: false, error: "Invalid companion membership plan." });
  }
  if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ success: false, error: "Invalid payment signature." });
  }
  if (getDatabaseType() !== "supabase") {
    return res.status(503).json({ success: false, error: "Payment verification requires the configured Supabase database." });
  }
  try {
    let expectedAmountPaise;
    let expectedTotalPaise;
    if (bookingId) {
      const booking = await databaseAdapter.getBooking(bookingId);
      if (!booking) return res.status(404).json({ success: false, error: "Booking not found." });
      if (booking.clientId !== authUserId) return res.status(403).json({ success: false, error: "You cannot verify payment for this booking." });
      if (booking.paymentOrderId !== orderId) return res.status(409).json({ success: false, error: "Payment order does not match the booking." });
      expectedAmountPaise = booking.bookingAmountPaise;
      const tracked = bookingAcceptanceMap.get(bookingId);
      expectedTotalPaise = tracked?.totalPayablePaise || Math.round(expectedAmountPaise * 1.18);
    } else {
      const memberships = await databaseAdapter.listMemberships({ userId: authUserId });
      const membership = memberships.find((entry) => entry.paymentOrderId === orderId && entry.plan === membershipPlan);
      if (!membership) return res.status(404).json({ success: false, error: "Pending membership order was not found for this account." });
      expectedAmountPaise = membership.pricePaise;
      expectedTotalPaise = membership.pricePaise;
    }
    const providerPayment = await fetchRazorpayPayment(paymentId);
    if (providerPayment.order_id !== orderId || providerPayment.amount !== expectedAmountPaise && providerPayment.amount !== expectedTotalPaise || providerPayment.currency !== "INR" || providerPayment.status !== "captured") {
      return res.status(409).json({ success: false, error: "Razorpay does not report a captured payment matching this order and amount." });
    }
    const startOtp = bookingId ? generateOtp() : "";
    const completionOtp = bookingId ? generateOtp() : "";
    const result = await databaseAdapter.finalizeRazorpayPayment(
      orderId,
      paymentId,
      expectedAmountPaise,
      bookingId ? hashOtp(startOtp) : "",
      bookingId ? hashOtp(completionOtp) : "",
      bookingId ? encryptBookingOtp(startOtp) : "",
      bookingId ? encryptBookingOtp(completionOtp) : ""
    );
    if (result.type === "BOOKING") {
      const finalizedBooking = result.record;
      const verifiedStartOtp = result.duplicate ? finalizedBooking.startOtpEncrypted ? decryptBookingOtp(finalizedBooking.startOtpEncrypted) : void 0 : startOtp;
      const verifiedCompletionOtp = result.duplicate ? finalizedBooking.completionOtpEncrypted ? decryptBookingOtp(finalizedBooking.completionOtpEncrypted) : void 0 : completionOtp;
      const safeBooking = { ...finalizedBooking };
      delete safeBooking.startOtpHmac;
      delete safeBooking.endOtpHmac;
      delete safeBooking.startOtpEncrypted;
      delete safeBooking.completionOtpEncrypted;
      delete safeBooking.start_otp_hash;
      delete safeBooking.completion_otp_hash;
      delete safeBooking.start_otp_encrypted;
      delete safeBooking.completion_otp_encrypted;
      try {
        await createAndSendNotification({
          userId: finalizedBooking.clientId,
          type: "BOOKING_CONFIRMED",
          title: "Booking Confirmed \u{1F4C5}",
          body: `Your booking #${finalizedBooking.bookingCode || ""} for ${finalizedBooking.serviceName || "Session"} is confirmed.`,
          data: { type: "BOOKING", bookingId: finalizedBooking.id }
        });
        await createAndSendNotification({
          userId: finalizedBooking.companionId,
          type: "BOOKING_CONFIRMED",
          title: "New Confirmed Booking \u{1F4B0}",
          body: `Booking #${finalizedBooking.bookingCode || ""} payment confirmed for ${finalizedBooking.date} (${finalizedBooking.durationHours} hrs).`,
          data: { type: "BOOKING", bookingId: finalizedBooking.id }
        });
        pushCompanionAlert(finalizedBooking.companionId, {
          type: "NEW_BOOKING_REQUEST",
          booking: {
            ...safeBooking,
            status: "CONFIRMED",
            paymentStatus: "PAID",
            startOtp: verifiedStartOtp,
            endOtp: verifiedCompletionOtp
          }
        });
      } catch (nErr) {
        console.warn("Booking payment notification warning:", nErr);
      }
      return res.json({
        success: true,
        message: "Razorpay confirmed the captured payment and the booking is confirmed.",
        paymentId,
        booking: {
          ...safeBooking,
          startOtp: verifiedStartOtp,
          endOtp: verifiedCompletionOtp
        }
      });
    }
    try {
      await createAndSendNotification({
        userId: result.record.userId,
        type: "MEMBERSHIP_ACTIVATED",
        title: "Membership Activated \u{1F451}",
        body: `Your ${result.record.planType} membership is now active!`,
        data: { type: "MEMBERSHIP" }
      });
    } catch (nErr) {
      console.warn("Membership notification warning:", nErr);
    }
    return res.json({
      success: true,
      message: "Razorpay confirmed the captured membership payment.",
      paymentId,
      membership: result.record
    });
  } catch (error) {
    console.error("Razorpay payment verification failed.", error);
    return res.status(503).json({ success: false, error: "Payment verification is temporarily unavailable." });
  }
});
app.post("/api/payments/razorpay/cancel-order", async (req, res) => {
  const authUserId = req.authUser?.id;
  if (!authUserId) return res.status(401).json({ error: "Authentication required." });
  const { orderId } = req.body || {};
  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ error: "Order ID is required." });
  }
  try {
    await databaseAdapter.markRazorpayOrderCancelled(orderId);
    return res.json({ success: true, status: "CANCELLED" });
  } catch (error) {
    console.error("Cancel payment order failed.", error);
    return res.status(500).json({ error: "Failed to cancel payment order." });
  }
});
app.post("/api/payments/razorpay/fail-order", async (req, res) => {
  const authUserId = req.authUser?.id;
  if (!authUserId) return res.status(401).json({ error: "Authentication required." });
  const { orderId, paymentId } = req.body || {};
  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ error: "Order ID is required." });
  }
  try {
    await databaseAdapter.markRazorpayOrderFailed(orderId, paymentId);
    return res.json({ success: true, status: "FAILED" });
  } catch (error) {
    console.error("Record failed payment order error:", error);
    return res.status(500).json({ error: "Failed to update order status." });
  }
});
app.post("/api/payments/razorpay/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.rawBody;
  if (!signature || !rawBody) {
    return res.status(400).json({ error: "Missing X-Razorpay-Signature header." });
  }
  if (!verifyRazorpayWebhookSignature(rawBody.toString("utf8"), signature)) {
    return res.status(400).json({ error: "Webhook signature verification failed." });
  }
  if (getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Payment webhook processing requires the configured Supabase database." });
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid Razorpay webhook payload." });
  }
  if (!event || typeof event.event !== "string" || !event.payload) {
    return res.status(400).json({ error: "Invalid Razorpay webhook payload." });
  }
  const eventId = crypto4.createHash("sha256").update(rawBody).digest("hex");
  let claim;
  try {
    claim = await databaseAdapter.claimPaymentWebhookEvent(eventId, event.event, event);
  } catch (error) {
    console.error("Razorpay webhook event could not be claimed.", error);
    return res.status(503).json({ error: "Payment event storage is temporarily unavailable." });
  }
  if (claim.processed) return res.status(200).json({ received: true, duplicate: true });
  if (!claim.claimed) return res.status(503).json({ error: "This payment event is already being processed; retry later." });
  try {
    if (event.event === "payment.captured") {
      const paymentId = event.payload.payment?.entity?.id;
      const eventOrderId = event.payload.payment?.entity?.order_id;
      if (typeof paymentId !== "string" || typeof eventOrderId !== "string") {
        throw new Error("Captured payment webhook is missing the payment or order identifier.");
      }
      const [booking, membership] = await Promise.all([
        databaseAdapter.getBookingByPaymentOrder(eventOrderId),
        databaseAdapter.getMembershipByPaymentOrder(eventOrderId)
      ]);
      if (Boolean(booking) === Boolean(membership)) {
        throw new Error("Captured payment order does not resolve to exactly one booking or membership.");
      }
      const providerPayment = await fetchRazorpayPayment(paymentId);
      const expectedAmountPaise = booking ? booking.bookingAmountPaise : membership.pricePaise;
      if (providerPayment.id !== paymentId || providerPayment.order_id !== eventOrderId || providerPayment.amount !== expectedAmountPaise || providerPayment.currency !== "INR" || providerPayment.status !== "captured") {
        throw new Error("Razorpay captured payment does not match the stored order amount and state.");
      }
      const startOtp = booking ? generateOtp() : "";
      const completionOtp = booking ? generateOtp() : "";
      await databaseAdapter.finalizeRazorpayPayment(
        eventOrderId,
        paymentId,
        expectedAmountPaise,
        booking ? hashOtp(startOtp) : "",
        booking ? hashOtp(completionOtp) : "",
        booking ? encryptBookingOtp(startOtp) : "",
        booking ? encryptBookingOtp(completionOtp) : ""
      );
    } else if (event.event === "payment.failed") {
      const payment = event.payload.payment?.entity;
      const orderId = payment?.order_id;
      if (typeof orderId === "string") await databaseAdapter.markRazorpayOrderFailed(orderId, payment?.id);
    } else if (event.event === "refund.processed" || event.event === "refund.failed") {
      const refundEntity = event.payload.refund?.entity;
      if (!refundEntity || typeof refundEntity.id !== "string" || typeof refundEntity.payment_id !== "string" || !Number.isSafeInteger(refundEntity.amount)) {
        throw new Error("Refund webhook is missing required refund details.");
      }
      const [refunds, providerRefunds] = await Promise.all([
        databaseAdapter.listPaymentRefunds({ paymentId: refundEntity.payment_id }),
        fetchRazorpayPaymentRefunds(refundEntity.payment_id)
      ]);
      const providerRefund = providerRefunds.find((item) => item.id === refundEntity.id);
      const reservation = refunds.find(
        (item) => item.payment_id === refundEntity.payment_id && item.amount_paise === refundEntity.amount && (item.provider_refund_id === refundEntity.id || typeof item.idempotency_key === "string" && providerRefund?.notes?.idempotency_key === item.idempotency_key)
      );
      if (!providerRefund || !reservation) throw new Error("Razorpay refund does not match a locally reserved refund.");
      const status = event.event === "refund.failed" ? "FAILED" : providerRefund.status === "processed" ? "PROCESSED" : "PROCESSING";
      await databaseAdapter.updatePaymentRefund(reservation.idempotency_key, status, providerRefund.id);
    }
    await databaseAdapter.completePaymentWebhookEvent(eventId);
    return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    try {
      await databaseAdapter.completePaymentWebhookEvent(eventId, message);
    } catch (completionError) {
      console.error("Failed to persist Razorpay webhook retry state.", completionError);
    }
    console.error("Razorpay webhook processing failed.", error);
    return res.status(500).json({ error: "Payment event processing failed; Razorpay may retry this event." });
  }
});
app.get("/api/companion/status/:userId", async (req, res) => {
  const userId = req.authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: "You cannot access another user\u2019s companion profile." });
  if (getDatabaseType() === "json") {
    const user = db2.users[userId];
    if (!user) return res.status(404).json({ error: "User not found" });
    const profile = db2.companionProfiles[userId] || null;
    const wallet = db2.companionWallets[userId] || {
      companionId: userId,
      lockedSettlementBalancePaise: 0,
      availableSettlementBalancePaise: 0,
      totalSettledPaise: 0,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    const isLive = Boolean(
      user.kycStatus === "APPROVED" && profile && profile.membership?.isActive && new Date(profile.membership.expiryDate) > /* @__PURE__ */ new Date() && profile.bankDetails?.isVerified && !profile.isPaused
    );
    return res.json({
      kycStatus: user.kycStatus,
      profile,
      wallet,
      isLive,
      conditions: {
        kycApproved: user.kycStatus === "APPROVED",
        membershipValid: Boolean(profile?.membership?.isActive && new Date(profile.membership.expiryDate) > /* @__PURE__ */ new Date()),
        bankVerified: Boolean(profile?.bankDetails?.isVerified)
      }
    });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const [profile, companionKyc, clientKyc, membership, bankVerification, balance, ledgerEntries] = await Promise.all([
      databaseAdapter.getCompanionProfile(userId),
      databaseAdapter.getUserKycSubmission(userId, "COMPANION"),
      databaseAdapter.getUserKycSubmission(userId, "CLIENT").catch(() => null),
      databaseAdapter.getActiveMembership(userId),
      databaseAdapter.getBankVerification(userId),
      databaseAdapter.getWalletBalance(userId),
      databaseAdapter.listWalletEntries(userId)
    ]);
    const membershipValid = Boolean(membership?.paymentStatus === "PAID" && new Date(membership.expiryDate) > /* @__PURE__ */ new Date());
    const bankVerified = bankVerification?.verificationStatus === "VERIFIED" || bankVerification?.isVerified === true;
    const effectiveKyc = companionKyc || (clientKyc?.status === "APPROVED" ? clientKyc : null);
    const kycApproved = Boolean(effectiveKyc?.status === "APPROVED" || user.kycStatus === "APPROVED" || user.kyc_status === "APPROVED");
    const isLive = Boolean(kycApproved && profile?.isLive && membershipValid && bankVerified && !profile.isPaused);
    const totalSettledPaise = ledgerEntries.filter((entry) => entry.balanceStatus === "PAID_OUT" || entry.balance_status === "PAID_OUT").reduce((sum, entry) => sum + Number(entry.netAmountPaise ?? entry.net_amount_paise ?? 0), 0);
    const responseProfile = profile ? {
      ...profile,
      membership: membership ? { ...membership, isActive: membershipValid } : null,
      bankDetails: bankVerification ? {
        isVerified: bankVerified,
        accountNumberMasked: bankVerification.accountNumberMasked || null,
        ifsc: bankVerification.ifsc,
        accountHolderName: bankVerification.accountHolderName,
        verifiedAt: bankVerification.verifiedAt
      } : null
    } : null;
    return res.json({
      kycStatus: companionKyc?.status || user.kycStatus || user.kyc_status || "NOT_SUBMITTED",
      profile: responseProfile,
      wallet: {
        companionId: userId,
        lockedSettlementBalancePaise: balance.locked,
        availableSettlementBalancePaise: balance.available,
        totalSettledPaise,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      },
      isLive,
      conditions: {
        kycApproved,
        membershipValid,
        bankVerified
      }
    });
  } catch (error) {
    console.error("Companion status could not be loaded.", error);
    return res.status(503).json({ error: "Companion status is temporarily unavailable." });
  }
});
app.get("/api/companions/search", async (req, res) => {
  const { query, serviceId, city, lat, lng } = req.query;
  const hasLatitude = lat !== void 0 && lat !== "";
  const hasLongitude = lng !== void 0 && lng !== "";
  let searchLocation = null;
  if (hasLatitude && hasLongitude) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      searchLocation = { lat: latitude, lng: longitude };
    }
  } else if (city && city !== "all") {
    const cStr = String(city).toLowerCase().trim();
    for (const [k, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
      if (cStr.includes(k) || k.includes(cStr)) {
        searchLocation = coords;
        break;
      }
    }
    if (!searchLocation && isGoogleMapsConfigured()) {
      try {
        const geo = await geocodeAddress(String(city));
        if (geo?.geometry?.location) {
          searchLocation = geo.geometry.location;
        }
      } catch (e) {
      }
    }
  }
  const genuineCompanions = [];
  const initialCompanions = [];
  const coordinatesByUserId = /* @__PURE__ */ new Map();
  let profileEntries = [];
  if (getDatabaseType() === "supabase") {
    try {
      const [profiles, users] = await Promise.all([
        databaseAdapter.listCompanionProfiles({ limit: 100 }),
        databaseAdapter.listUsers()
      ]);
      const usersById = new Map(users.map((user) => [user.id, user]));
      const candidates = profiles.filter(
        (profile) => !profile.isInitialListing && !profile.isPaused && ["COMPANION", "DUAL"].includes(usersById.get(profile.userId)?.role) && usersById.has(profile.userId)
      );
      const checkedProfiles = await Promise.all(candidates.map(async (profile) => {
        const userRecord = usersById.get(profile.userId);
        const [companionKyc, clientKyc, membership, bankVerification] = await Promise.all([
          databaseAdapter.getUserKycSubmission(profile.userId, "COMPANION"),
          databaseAdapter.getUserKycSubmission(profile.userId, "CLIENT").catch(() => null),
          databaseAdapter.getActiveMembership(profile.userId),
          databaseAdapter.getBankVerification(profile.userId)
        ]);
        const effectiveKyc = companionKyc || (clientKyc?.status === "APPROVED" ? clientKyc : null);
        const kycApproved = Boolean(effectiveKyc?.status === "APPROVED" || userRecord?.kycStatus === "APPROVED" || userRecord?.kyc_status === "APPROVED");
        const membershipValid = Boolean(membership && (membership.isActive || membership.paymentStatus === "PAID" && new Date(membership.expiryDate) > /* @__PURE__ */ new Date()));
        const bankVerified = Boolean(bankVerification?.verificationStatus === "VERIFIED" || bankVerification?.isVerified === true || profile.bankDetails?.isVerified === true);
        if (!kycApproved || !membershipValid || !bankVerified) return null;
        if (!profile.isLive) {
          databaseAdapter.updateCompanionProfile(profile.userId, { isLive: true }).catch(() => null);
        }
        return [
          profile.userId,
          {
            ...profile,
            isLive: true,
            companionKyc: effectiveKyc,
            membership: { ...membership, isActive: true },
            bankDetails: { isVerified: true }
          },
          userRecord
        ];
      }));
      const genuineEntries = checkedProfiles.filter((entry) => entry !== null);
      const initialEntries = Object.entries(db2.companionProfiles).filter(([_, p]) => Boolean(p.isInitialListing)).map(([id, p]) => [id, p, db2.users[id]]);
      profileEntries = [...genuineEntries, ...initialEntries];
    } catch (error) {
      console.error("Companion discovery query failed.", error);
      return res.status(503).json({ error: "Companion discovery is temporarily unavailable." });
    }
  } else {
    profileEntries = Object.entries(db2.companionProfiles).filter(([_, profile]) => !profile.isPaused && profile.isLive !== false).map(([userId, profile]) => [userId, profile, db2.users[userId]]);
  }
  for (const [userId, profile, dbUser] of profileEntries) {
    const user = dbUser || db2.users[userId];
    if (!user) continue;
    const isInitial = Boolean(profile.isInitialListing);
    const kycApproved = Boolean(
      profile.companionKyc?.status === "APPROVED" || user.kycStatus === "APPROVED" || user.kyc_status === "APPROVED"
    );
    const membershipValid = Boolean(
      profile.membership?.isActive || profile.membership?.paymentStatus === "PAID" && new Date(profile.membership.expiryDate) > /* @__PURE__ */ new Date()
    );
    const bankVerified = Boolean(
      profile.bankDetails?.isVerified || profile.bankDetails?.verificationStatus === "VERIFIED"
    );
    const isLive = isInitial || Boolean(
      kycApproved && membershipValid && bankVerified
    );
    if (!isLive) continue;
    if (profile.isPaused) continue;
    if (serviceId && serviceId !== "all") {
      const parsedServiceId = parseInt(serviceId, 10);
      if (!profile.services || !profile.services.includes(parsedServiceId)) {
        continue;
      }
    }
    if (query) {
      const q = query.toLowerCase();
      const matchName = (user.profileName || user.legalName)?.toLowerCase().includes(q);
      const matchBio = user.bio?.toLowerCase().includes(q);
      const matchCity = user.city?.toLowerCase().includes(q) || profile.address?.toLowerCase().includes(q) || user.state?.toLowerCase().includes(q);
      if (!matchName && !matchBio && !matchCity) continue;
    }
    if (city && city !== "all") {
      const c = city.toLowerCase().trim();
      const userCity = (user.city || "").toLowerCase().trim();
      const userAddr = (profile.address || "").toLowerCase().trim();
      const userState = (user.state || profile.state || "").toLowerCase().trim();
      const matchesCity = userCity && (userCity.includes(c) || c.includes(userCity));
      const matchesAddr = userAddr && (userAddr.includes(c) || c.includes(userAddr));
      const matchesState = userState && (userState.includes(c) || c.includes(userState));
      if (!searchLocation && !matchesCity && !matchesAddr && !matchesState) {
        continue;
      }
    }
    const hourlyRate = Math.round((profile.rates?.hourlyPaise || 49900) / 100);
    let profileLatitude = profile.latitude === null || profile.latitude === void 0 ? Number.NaN : Number(profile.latitude);
    let profileLongitude = profile.longitude === null || profile.longitude === void 0 ? Number.NaN : Number(profile.longitude);
    if (!Number.isFinite(profileLatitude) || !Number.isFinite(profileLongitude)) {
      const locKey = `${user.city || ""} ${profile.address || ""} ${user.state || ""}`.toLowerCase();
      for (const [k, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
        if (locKey.includes(k)) {
          profileLatitude = coords.lat;
          profileLongitude = coords.lng;
          break;
        }
      }
    }
    if (Number.isFinite(profileLatitude) && Number.isFinite(profileLongitude) && profileLatitude >= -90 && profileLatitude <= 90 && profileLongitude >= -180 && profileLongitude <= 180) {
      coordinatesByUserId.set(userId, { lat: profileLatitude, lng: profileLongitude });
    }
    const companionRecord = {
      id: user.id,
      name: user.profileName || user.legalName,
      profileName: user.profileName || user.legalName,
      age: user.age,
      city: user.city || "",
      state: user.state || profile.state || "",
      address: user.city || profile.state || "",
      locationFormatted: user.city && (user.state || profile.state) ? `${user.city}, ${user.state || profile.state}` : user.city || profile.state || "India",
      hourlyRate,
      hourlyRateFormatted: `\u20B9${hourlyRate}/hr`,
      bio: user.bio,
      profilePhoto: user.profilePhoto || user.photos?.[0],
      photos: user.photos || [user.profilePhoto || ""],
      rating: profile.rating || 4.9,
      totalBookings: profile.totalBookings || 0,
      services: profile.services || [],
      rates: profile.rates,
      availability: profile.availability,
      isInitialListing: isInitial,
      isLive: true
    };
    if (isInitial) {
      initialCompanions.push(companionRecord);
    } else {
      genuineCompanions.push(companionRecord);
    }
  }
  const newProfileOrderMap = /* @__PURE__ */ new Map([
    ["init_arjun_chauhan_delhi", 0],
    ["init_sayantika_ghosh_burdwan", 1],
    ["init_riya_dutta_baranagar", 2],
    ["init_ritwik_basu_dumdum", 3],
    ["init_megha_sen_kolkata", 4],
    ["init_arnab_chatterjee_kolkata", 5],
    ["init_ishika_sen_saltlake", 6],
    ["init_nithya_subramanian_chennai", 7]
  ]);
  const newProfiles = [];
  const existingInitial = [];
  for (const c of initialCompanions) {
    if (newProfileOrderMap.has(c.id)) {
      newProfiles.push(c);
    } else {
      existingInitial.push(c);
    }
  }
  newProfiles.sort((a, b) => newProfileOrderMap.get(a.id) - newProfileOrderMap.get(b.id));
  const initialOrderMap = new Map(INITIAL_COMPANIONS.map((c, i) => [c.id, i]));
  existingInitial.sort((a, b) => (initialOrderMap.get(a.id) ?? 9999) - (initialOrderMap.get(b.id) ?? 9999));
  genuineCompanions.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.totalBookings || 0) - (a.totalBookings || 0));
  let combined = [...newProfiles, ...genuineCompanions, ...existingInitial];
  if (searchLocation) {
    const located = combined.map((companion) => ({ companion, coordinates: coordinatesByUserId.get(companion.id) })).filter((entry) => Boolean(entry.coordinates));
    if (located.length > 0) {
      let scoredCompanions = [];
      try {
        if (isGoogleMapsConfigured()) {
          const distances = await getDistanceMatrix(
            [searchLocation],
            located.map((entry) => entry.coordinates)
          );
          scoredCompanions = located.map((entry, index) => {
            const result = distances[0]?.[index];
            if (!result || result.status !== "OK") {
              const fallbackDist = Math.round(calculateDistance(searchLocation.lat, searchLocation.lng, entry.coordinates.lat, entry.coordinates.lng) * 10) / 10;
              return {
                ...entry.companion,
                distanceKm: fallbackDist,
                travelDurationMinutes: Math.round(fallbackDist * 2.5)
              };
            }
            return {
              ...entry.companion,
              distanceKm: Math.round(result.distance.value / 100) / 10,
              travelDurationMinutes: Math.ceil(result.duration.value / 60)
            };
          });
        } else {
          scoredCompanions = located.map((entry) => {
            const dist = Math.round(calculateDistance(searchLocation.lat, searchLocation.lng, entry.coordinates.lat, entry.coordinates.lng) * 10) / 10;
            return {
              ...entry.companion,
              distanceKm: dist,
              travelDurationMinutes: Math.round(dist * 2.5)
            };
          });
        }
      } catch (error) {
        console.warn("Distance lookup using Haversine fallback:", error);
        scoredCompanions = located.map((entry) => {
          const dist = Math.round(calculateDistance(searchLocation.lat, searchLocation.lng, entry.coordinates.lat, entry.coordinates.lng) * 10) / 10;
          return {
            ...entry.companion,
            distanceKm: dist,
            travelDurationMinutes: Math.round(dist * 2.5)
          };
        });
      }
      scoredCompanions.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
      const locatedIds = new Set(scoredCompanions.map((c) => c.id));
      const unlocated = combined.filter((c) => !locatedIds.has(c.id));
      combined = [...scoredCompanions, ...unlocated];
    }
  }
  return res.json({ count: combined.length, companions: combined });
});
function timeToMinutes(timeStr) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const normalized = Math.max(0, Math.min(1439, mins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function formatTimeAmPm(timeStr) {
  if (!timeStr) return "";
  const mins = timeToMinutes(timeStr);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}
async function getCompanionActiveBookingsForDate(companionId, dateStr) {
  let list = [];
  try {
    list = getDatabaseType() === "supabase" ? await databaseAdapter.listBookings({ companionId }) : Object.values(db2.bookings || {});
  } catch {
    list = Object.values(db2.bookings || {});
  }
  return list.filter((b) => {
    if (b.companionId !== companionId) return false;
    if (b.date !== dateStr) return false;
    if (b.status === "CANCELLED") return false;
    const isConfirmed = ["CONFIRMED", "COMPANION_ARRIVED", "IN_PROGRESS"].includes(b.status);
    const isAccepted = b.companionAccepted === true || bookingAcceptanceMap.get(b.id)?.companionAccepted === true;
    return isConfirmed || isAccepted;
  });
}
function computeCompanionSchedule(companionId, dateStr, activeBookings) {
  const DAY_START = 7 * 60;
  const DAY_END = 24 * 60;
  const rawBlocked = [];
  for (const b of activeBookings) {
    const sMin = timeToMinutes(b.startTime);
    const eMin = timeToMinutes(b.endTime);
    const startBlocked = Math.max(0, sMin - 60);
    const endBlocked = Math.min(1439, eMin + 60);
    rawBlocked.push({
      start: startBlocked,
      end: endBlocked,
      bookingTime: `${formatTimeAmPm(b.startTime)} - ${formatTimeAmPm(b.endTime)}`,
      id: b.id
    });
  }
  rawBlocked.sort((a, b) => a.start - b.start);
  const mergedBlocked = [];
  for (const cur of rawBlocked) {
    if (!mergedBlocked.length) {
      mergedBlocked.push({ start: cur.start, end: cur.end, bookingTimes: [cur.bookingTime] });
    } else {
      const prev = mergedBlocked[mergedBlocked.length - 1];
      if (cur.start <= prev.end) {
        prev.end = Math.max(prev.end, cur.end);
        prev.bookingTimes.push(cur.bookingTime);
      } else {
        mergedBlocked.push({ start: cur.start, end: cur.end, bookingTimes: [cur.bookingTime] });
      }
    }
  }
  const blockedWindows = mergedBlocked.map((b) => ({
    from: minutesToTime(b.start),
    to: minutesToTime(b.end),
    fromFormatted: formatTimeAmPm(minutesToTime(b.start)),
    toFormatted: formatTimeAmPm(minutesToTime(b.end)),
    bookingTimes: b.bookingTimes,
    reason: "Confirmed Session + 1 hr Travel Buffer"
  }));
  const availableWindows = [];
  let pointer = DAY_START;
  for (const b of mergedBlocked) {
    if (b.start > pointer) {
      const fTime = minutesToTime(pointer);
      const tTime = minutesToTime(b.start);
      availableWindows.push({
        from: fTime,
        to: tTime,
        label: `${formatTimeAmPm(fTime)} - ${formatTimeAmPm(tTime)}`
      });
    }
    pointer = Math.max(pointer, b.end);
  }
  if (pointer < DAY_END) {
    const fTime = minutesToTime(pointer);
    const tTime = minutesToTime(Math.min(1439, DAY_END));
    availableWindows.push({
      from: fTime,
      to: tTime,
      label: `${formatTimeAmPm(fTime)} - ${formatTimeAmPm(tTime)}`
    });
  }
  let summary = "";
  if (activeBookings.length === 0) {
    summary = "Available 07:00 AM - 12:00 AM (Full Day)";
  } else if (availableWindows.length === 0) {
    summary = `Fully booked for ${dateStr}`;
  } else {
    summary = `Available ${availableWindows.map((w) => w.label).join(" and ")}`;
  }
  return {
    date: dateStr,
    hasBookings: activeBookings.length > 0,
    blockedWindows,
    availableWindows,
    summary
  };
}
app.get("/api/companion/:companionId/schedule", async (req, res) => {
  const { companionId } = req.params;
  const dateStr = typeof req.query?.date === "string" ? req.query.date : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  try {
    const activeBookings = await getCompanionActiveBookingsForDate(companionId, dateStr);
    const schedule = computeCompanionSchedule(companionId, dateStr, activeBookings);
    return res.json({ success: true, ...schedule });
  } catch (err) {
    console.warn("Schedule computation notice:", err);
    return res.json({
      success: true,
      date: dateStr,
      hasBookings: false,
      blockedWindows: [],
      availableWindows: [{ from: "07:00", to: "23:59", label: "07:00 AM - 12:00 AM" }],
      summary: "Available 07:00 AM - 12:00 AM"
    });
  }
});
app.post("/api/bookings/create", async (req, res) => {
  const authUser = req.authUser;
  const companionId = typeof req.body?.companionId === "string" ? req.body.companionId : "";
  const serviceId = Number(req.body?.serviceId);
  const durationHours = Number(req.body?.durationHours);
  const date = typeof req.body?.date === "string" ? req.body.date : "";
  const startTime = typeof req.body?.startTime === "string" ? req.body.startTime : "";
  const endTime = typeof req.body?.endTime === "string" ? req.body.endTime : "";
  const meetingLocation = typeof req.body?.meetingLocation === "string" ? req.body.meetingLocation.trim() : "";
  const service = PAIRUP_SERVICES.find((item) => item.id === serviceId);
  const startMinuteOfDay = /^\d{2}:\d{2}$/.test(startTime) ? Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)) : -1;
  const endMinuteOfDay = /^\d{2}:\d{2}$/.test(endTime) ? Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5)) : -1;
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? /* @__PURE__ */ new Date(`${date}T00:00:00.000Z`) : /* @__PURE__ */ new Date(NaN);
  if (!authUser?.id || !companionId || !Number.isInteger(serviceId) || serviceId < 1 || !Number.isInteger(durationHours) || durationHours < 1 || durationHours > 24 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) || endMinuteOfDay - startMinuteOfDay !== durationHours * 60 || !meetingLocation || meetingLocation.length > 500 || !service) {
    return res.status(400).json({ error: "Booking details are invalid." });
  }
  if (getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Booking checkout requires the configured Supabase database." });
  }
  try {
    const client = await databaseAdapter.getUser(authUser.id);
    if (!client) return res.status(401).json({ error: "Authenticated client account was not found." });
    const companion = await databaseAdapter.getUser(companionId);
    const profile = await databaseAdapter.getCompanionProfile(companionId);
    if (!companion || !profile || profile.isInitialListing) {
      return res.status(404).json({ error: "This Companion is unavailable for booking." });
    }
    if (profile.isPaused === true) {
      return res.status(400).json({ error: "This companion is currently offline and not accepting new booking requests." });
    }
    if (!profile.isLive && !profile.isPaused) {
      await databaseAdapter.updateCompanionProfile(companionId, { isLive: true }).catch(() => null);
      profile.isLive = true;
    }
    const hourlyPaise = profile?.rates?.hourlyPaise || 49900;
    const calculatedBasePaise = hourlyPaise * durationHours;
    const existingActiveBookings = await getCompanionActiveBookingsForDate(companionId, date);
    for (const eb of existingActiveBookings) {
      const ebStartMin = timeToMinutes(eb.startTime);
      const ebEndMin = timeToMinutes(eb.endTime);
      const blockedStart = Math.max(0, ebStartMin - 60);
      const blockedEnd = Math.min(1439, ebEndMin + 60);
      if (startMinuteOfDay < blockedEnd && endMinuteOfDay > blockedStart) {
        const schedule = computeCompanionSchedule(companionId, date, existingActiveBookings);
        return res.status(409).json({
          error: `This companion is already booked on ${date} (${eb.startTime} - ${eb.endTime}). A 1-hour travel buffer before and after is required (unavailable ${formatTimeAmPm(minutesToTime(blockedStart))} to ${formatTimeAmPm(minutesToTime(blockedEnd))}). ${schedule.summary}.`,
          conflict: true,
          blockedWindow: {
            from: minutesToTime(blockedStart),
            to: minutesToTime(blockedEnd),
            bookingTime: `${eb.startTime} - ${eb.endTime}`
          },
          availableWindows: schedule.availableWindows,
          summary: schedule.summary
        });
      }
    }
    const bookingCode = `PUT-${crypto4.randomBytes(5).toString("hex").toUpperCase()}`;
    const booking = await databaseAdapter.reserveBookingPayment({
      id: crypto4.randomUUID(),
      bookingCode,
      clientId: authUser.id,
      companionId,
      companionGender: companion.gender || profile?.gender || "FEMALE",
      serviceId,
      serviceName: service.name,
      date,
      startTime,
      endTime,
      durationHours,
      meetingLocation,
      notes: typeof req.body?.notes === "string" ? req.body.notes.slice(0, 2e3) : "",
      amountPaise: calculatedBasePaise,
      bookingAmountPaise: calculatedBasePaise
    });
    const baseAmountPaise = Number(booking.bookingAmountPaise || booking.amountPaise || calculatedBasePaise);
    const cgstPaise = Math.round(baseAmountPaise * 0.09);
    const sgstPaise = Math.round(baseAmountPaise * 0.09);
    const gstAmountPaise = cgstPaise + sgstPaise;
    const totalPayablePaise = baseAmountPaise + gstAmountPaise;
    let paymentOrderId = `ord_req_${crypto4.randomBytes(8).toString("hex")}`;
    let paymentKeyId = process.env.RAZORPAY_KEY_ID || "rzp_live_pairuptoday";
    let paymentCurrency = "INR";
    try {
      const order = await createRazorpayOrder({
        amountPaise: totalPayablePaise,
        receipt: `bk_${bookingCode}`,
        notes: {
          bookingId: booking.id,
          bookingCode,
          orderType: "BOOKING",
          userId: authUser.id,
          baseAmountPaise: String(baseAmountPaise),
          gstAmountPaise: String(gstAmountPaise),
          totalPayablePaise: String(totalPayablePaise)
        }
      });
      if (order.success && order.orderId) {
        paymentOrderId = order.orderId;
        paymentKeyId = order.keyId || paymentKeyId;
        paymentCurrency = order.currency || paymentCurrency;
      }
    } catch (orderErr) {
      console.warn("Razorpay order creation postponed to checkout:", orderErr);
    }
    await databaseAdapter.updateBooking(booking.id, {
      paymentOrderId,
      companionAccepted: false
    });
    bookingAcceptanceMap.set(booking.id, {
      companionAccepted: false,
      rejectionReason: null,
      baseAmountPaise,
      cgstPaise,
      sgstPaise,
      gstAmountPaise,
      totalPayablePaise,
      paymentOrderId
    });
    pushCompanionAlert(booking.companionId, {
      type: "NEW_BOOKING_REQUEST",
      booking: {
        ...booking,
        paymentOrderId,
        status: "PENDING",
        paymentStatus: "PENDING",
        companionAccepted: false,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        totalPayablePaise
      }
    });
    return res.status(201).json({
      success: true,
      booking: {
        ...booking,
        paymentOrderId,
        status: "PENDING",
        paymentStatus: "PENDING",
        companionAccepted: false,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        totalPayablePaise
      },
      payment: {
        orderId: paymentOrderId,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        amountPaise: totalPayablePaise,
        currency: paymentCurrency,
        keyId: paymentKeyId
      }
    });
  } catch (error) {
    console.error("Booking reservation failed.", error);
    return res.status(500).json({ error: error.message || "Failed to submit booking request." });
  }
});
app.post("/api/bookings/:id/accept", async (req, res) => {
  const authUser = req.authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.companionId !== authUser.id) {
      return res.status(403).json({ error: "Only the assigned companion can accept this booking." });
    }
    const currentTracked = bookingAcceptanceMap.get(bookingId);
    if (booking.status === "CANCELLED" || currentTracked?.rejectionReason === "CLIENT_CANCELLED") {
      return res.status(409).json({
        success: false,
        error: "Canceled by client. This booking request is no longer available.",
        canceledByClient: true,
        bookingId
      });
    }
    const existingActiveBookings = await getCompanionActiveBookingsForDate(authUser.id, booking.date);
    for (const eb of existingActiveBookings) {
      if (eb.id === bookingId) continue;
      const ebStartMin = timeToMinutes(eb.startTime);
      const ebEndMin = timeToMinutes(eb.endTime);
      const blockedStart = Math.max(0, ebStartMin - 60);
      const blockedEnd = Math.min(1439, ebEndMin + 60);
      const thisStartMin = timeToMinutes(booking.startTime);
      const thisEndMin = timeToMinutes(booking.endTime);
      if (thisStartMin < blockedEnd && thisEndMin > blockedStart) {
        return res.status(409).json({
          success: false,
          error: `You already have an active session from ${eb.startTime} to ${eb.endTime} on ${booking.date}. A 1-hour travel buffer before and after is required.`,
          conflict: true
        });
      }
    }
    const baseAmt = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const cgst = Math.round(baseAmt * 0.09);
    const sgst = Math.round(baseAmt * 0.09);
    const current = bookingAcceptanceMap.get(bookingId) || {
      companionAccepted: false,
      rejectionReason: null,
      baseAmountPaise: baseAmt,
      cgstPaise: cgst,
      sgstPaise: sgst,
      gstAmountPaise: cgst + sgst,
      totalPayablePaise: baseAmt + cgst + sgst,
      paymentOrderId: booking.paymentOrderId
    };
    current.companionAccepted = true;
    current.rejectionReason = null;
    if (!current.paymentOrderId || current.paymentOrderId.startsWith("ord_req_")) {
      try {
        const rzpOrder = await createRazorpayOrder({
          amountPaise: current.totalPayablePaise,
          receipt: `bk_${booking.bookingCode}`,
          notes: {
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            orderType: "BOOKING",
            userId: booking.clientId
          }
        });
        if (rzpOrder.success && rzpOrder.orderId) {
          current.paymentOrderId = rzpOrder.orderId;
          booking.paymentOrderId = rzpOrder.orderId;
        }
      } catch (oErr) {
        console.warn("Accept-time Razorpay order creation notice:", oErr);
      }
    }
    bookingAcceptanceMap.set(bookingId, current);
    if (getDatabaseType() === "supabase") {
      await databaseAdapter.updateBooking(bookingId, {
        companionAccepted: true,
        ...current.paymentOrderId ? { paymentOrderId: current.paymentOrderId } : {}
      });
    } else {
      if (db2.bookings[bookingId]) {
        db2.bookings[bookingId].companionAccepted = true;
        if (current.paymentOrderId) db2.bookings[bookingId].paymentOrderId = current.paymentOrderId;
      }
    }
    pushCompanionAlert(booking.companionId, {
      type: "BOOKING_ACCEPTED",
      bookingId
    });
    return res.json({ success: true, bookingId, companionAccepted: true });
  } catch (error) {
    console.error("Failed to accept booking", error);
    return res.status(500).json({ error: error.message || "Failed to accept booking." });
  }
});
app.post("/api/bookings/:id/reject", async (req, res) => {
  const authUser = req.authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.companionId !== authUser.id) {
      return res.status(403).json({ error: "Only the assigned companion can reject this booking." });
    }
    const baseAmt = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const cgst = Math.round(baseAmt * 0.09);
    const sgst = Math.round(baseAmt * 0.09);
    const current = bookingAcceptanceMap.get(bookingId) || {
      companionAccepted: false,
      rejectionReason: "COMPANION_BUSY",
      baseAmountPaise: baseAmt,
      cgstPaise: cgst,
      sgstPaise: sgst,
      gstAmountPaise: cgst + sgst,
      totalPayablePaise: baseAmt + cgst + sgst,
      paymentOrderId: booking.paymentOrderId
    };
    current.companionAccepted = false;
    current.rejectionReason = "COMPANION_BUSY";
    bookingAcceptanceMap.set(bookingId, current);
    if (getDatabaseType() === "supabase") {
      await databaseAdapter.updateBooking(bookingId, { status: "CANCELLED", companionAccepted: false });
    } else {
      if (db2.bookings[bookingId]) {
        db2.bookings[bookingId].status = "CANCELLED";
        db2.bookings[bookingId].companionAccepted = false;
      }
    }
    pushCompanionAlert(booking.companionId, {
      type: "BOOKING_CANCELLED",
      bookingId,
      reason: "COMPANION_BUSY"
    });
    return res.json({ success: true, bookingId, rejected: true });
  } catch (error) {
    console.error("Failed to reject booking", error);
    return res.status(500).json({ error: error.message || "Failed to reject booking." });
  }
});
app.post("/api/bookings/:id/cancel", async (req, res) => {
  const authUser = req.authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.clientId !== authUser.id && booking.companionId !== authUser.id && authUser.role !== "ADMIN") {
      return res.status(403).json({ error: "You are not authorized to cancel this booking." });
    }
    const cancelReason = req.body?.reason || (booking.clientId === authUser.id ? "CLIENT_CANCELLED" : "COMPANION_CANCELLED");
    const baseAmt = Number(booking.bookingAmountPaise || booking.amountPaise || 49900);
    const cgst = Math.round(baseAmt * 0.09);
    const sgst = Math.round(baseAmt * 0.09);
    const current = bookingAcceptanceMap.get(bookingId) || {
      companionAccepted: false,
      rejectionReason: cancelReason,
      baseAmountPaise: baseAmt,
      cgstPaise: cgst,
      sgstPaise: sgst,
      gstAmountPaise: cgst + sgst,
      totalPayablePaise: baseAmt + cgst + sgst,
      paymentOrderId: booking.paymentOrderId
    };
    current.companionAccepted = false;
    current.rejectionReason = cancelReason;
    bookingAcceptanceMap.set(bookingId, current);
    if (getDatabaseType() === "supabase") {
      await databaseAdapter.updateBooking(bookingId, { status: "CANCELLED", companionAccepted: false });
    } else {
      if (db2.bookings[bookingId]) {
        db2.bookings[bookingId].status = "CANCELLED";
        db2.bookings[bookingId].companionAccepted = false;
      }
    }
    pushCompanionAlert(booking.companionId, {
      type: "BOOKING_CANCELLED",
      bookingId,
      reason: cancelReason
    });
    return res.json({ success: true, bookingId, status: "CANCELLED", reason: cancelReason });
  } catch (error) {
    console.error("Failed to cancel booking", error);
    return res.status(500).json({ error: error.message || "Failed to cancel booking." });
  }
});
app.get("/api/companion/alerts/stream", async (req, res) => {
  const authUser = req.authUser;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders();
  res.write(": stream-connected\n\n");
  const companionId = authUser.id;
  if (!companionAlertStreams.has(companionId)) {
    companionAlertStreams.set(companionId, /* @__PURE__ */ new Set());
  }
  const streamSet = companionAlertStreams.get(companionId);
  streamSet.add(res);
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": keepalive\n\n");
    }
  }, 15e3);
  const cleanup = () => {
    clearInterval(keepAlive);
    const set = companionAlertStreams.get(companionId);
    if (set) {
      set.delete(res);
      if (set.size === 0) companionAlertStreams.delete(companionId);
    }
  };
  req.on("close", cleanup);
  res.on("finish", cleanup);
  res.on("error", cleanup);
});
app.get("/api/bookings/:id/status", async (req, res) => {
  const authUser = req.authUser;
  const bookingId = req.params.id;
  if (!authUser?.id) return res.status(401).json({ error: "Unauthorized" });
  try {
    const booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings[bookingId];
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.clientId !== authUser.id && booking.companionId !== authUser.id) {
      return res.status(403).json({ error: "Access denied." });
    }
    const tracked = bookingAcceptanceMap.get(bookingId);
    const companionAccepted = tracked?.companionAccepted ?? Boolean(booking.companionAccepted);
    const rejectionReason = tracked?.rejectionReason ?? (booking.status === "CANCELLED" ? "COMPANION_BUSY" : null);
    const baseAmountPaise = tracked?.baseAmountPaise || booking.bookingAmountPaise || booking.amountPaise || 49900;
    const cgstPaise = tracked?.cgstPaise || Math.round(baseAmountPaise * 0.09);
    const sgstPaise = tracked?.sgstPaise || Math.round(baseAmountPaise * 0.09);
    const gstAmountPaise = tracked?.gstAmountPaise || cgstPaise + sgstPaise;
    const totalPayablePaise = tracked?.totalPayablePaise || baseAmountPaise + gstAmountPaise;
    const isClient = booking.clientId === authUser.id;
    let startOtp = undefined;
    let endOtp = undefined;
    if (isClient && (booking.paymentStatus === 'PAID' || ['CONFIRMED', 'COMPANION_ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status))) {
      if (booking.startOtpEncrypted) startOtp = decryptBookingOtp(booking.startOtpEncrypted);
      else if (booking.startOtp) startOtp = booking.startOtp;
      if (booking.completionOtpEncrypted) endOtp = decryptBookingOtp(booking.completionOtpEncrypted);
      else if (booking.completionOtp || booking.endOtp) endOtp = booking.completionOtp || booking.endOtp;
    }

    return res.json({
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      companionAccepted,
      rejectionReason,
      startOtpVerified: Boolean(booking.startOtpVerified),
      endOtpVerified: Boolean(booking.endOtpVerified),
      startOtp,
      endOtp,
      meetingStartedAt: booking.meetingStartedAt || booking.startedAt,
      durationHours: booking.durationHours || 1,
      paymentOrderId: booking.paymentOrderId,
      payment: {
        orderId: booking.paymentOrderId || `ord_${booking.id.replace(/-/g, "").slice(0, 16)}`,
        baseAmountPaise,
        cgstPaise,
        sgstPaise,
        gstAmountPaise,
        amountPaise: totalPayablePaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID || "rzp_live_pairuptoday"
      }
    });
  } catch (error) {
    console.error("Failed to get booking status", error);
    return res.status(500).json({ error: error.message || "Failed to get booking status." });
  }
});
app.get("/api/bookings/my/:userId", async (req, res) => {
  const userId = req.authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: "You cannot access another user\u2019s bookings." });
  try {
    const bookings = getDatabaseType() === "supabase" ? await databaseAdapter.listBookings({ clientId: userId, participantId: userId }) : Object.values(db2.bookings).filter((b) => b.clientId === userId || b.companionId === userId);
    const participatingBookings = bookings.filter((b) => b.clientId === userId || b.companionId === userId);
    const sanitized = participatingBookings.map((booking) => {
      const copy = { ...booking };
      const encryptedStartOtp = copy.startOtpEncrypted;
      const encryptedCompletionOtp = copy.completionOtpEncrypted;
      delete copy.startOtpHmac;
      delete copy.endOtpHmac;
      delete copy.startOtpEncrypted;
      delete copy.completionOtpEncrypted;
      delete copy.start_otp_hash;
      delete copy.completion_otp_hash;
      delete copy.start_otp_encrypted;
      delete copy.completion_otp_encrypted;
      if (copy.clientId === userId && copy.paymentStatus === "PAID") {
        if (encryptedStartOtp) copy.startOtp = decryptBookingOtp(encryptedStartOtp);
        if (encryptedCompletionOtp) copy.endOtp = decryptBookingOtp(encryptedCompletionOtp);
      } else {
        delete copy.startOtp;
        delete copy.endOtp;
      }
      const tracked = bookingAcceptanceMap.get(copy.id);
      copy.companionAccepted = tracked?.companionAccepted ?? Boolean(copy.companionAccepted);
      copy.rejectionReason = tracked?.rejectionReason ?? (copy.status === "CANCELLED" ? "COMPANION_BUSY" : null);
      const baseAmt = tracked?.baseAmountPaise || copy.bookingAmountPaise || copy.amountPaise || 49900;
      copy.baseAmountPaise = baseAmt;
      copy.cgstPaise = tracked?.cgstPaise || Math.round(baseAmt * 0.09);
      copy.sgstPaise = tracked?.sgstPaise || Math.round(baseAmt * 0.09);
      copy.gstAmountPaise = tracked?.gstAmountPaise || copy.cgstPaise + copy.sgstPaise;
      copy.totalPayablePaise = tracked?.totalPayablePaise || baseAmt + copy.gstAmountPaise;
      const clientUser = db2.users[copy.clientId];
      const companionUser = db2.users[copy.companionId];
      if (clientUser) {
        copy.clientName = clientUser.profileName || clientUser.legalName || "Client";
      }
      if (companionUser) {
        copy.companionName = companionUser.profileName || companionUser.legalName || "Companion";
      }
      return copy;
    });
    return res.json({ bookings: sanitized });
  } catch (error) {
    console.error("Booking list retrieval failed.", error);
    return res.status(503).json({ error: "Bookings are temporarily unavailable." });
  }
});
app.post("/api/bookings/:bookingId/arrived", async (req, res) => {
  const { bookingId } = req.params;
  const companionId = req.authUser.id;
  if (getDatabaseType() === "supabase") {
    try {
      await databaseAdapter.markBookingCompanionArrived(bookingId, companionId);
      try {
        const bk = await databaseAdapter.getBooking(bookingId);
        if (bk?.clientId) {
          await createAndSendNotification({
            userId: bk.clientId,
            type: "COMPANION_ARRIVED",
            title: "Companion Arrived \u{1F4CD}",
            body: "Your companion has reached the meeting location. Provide your Start OTP to begin the session.",
            data: { type: "BOOKING", bookingId }
          });
        }
      } catch (nErr) {
        console.warn("Arrival notification warning:", nErr);
      }
      return res.json({ success: true, message: "Arrival recorded. The Client can access the Start OTP in their booking details." });
    } catch (error) {
      console.error("Booking arrival update failed.", error);
      return res.status(409).json({ error: "Arrival could not be recorded for this booking." });
    }
  }
  const booking = db2.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.companionId !== companionId) return res.status(403).json({ error: "Unauthorized companion." });
  const freshStartOtp = generateOtp();
  booking.status = "COMPANION_ARRIVED";
  booking.startOtp = freshStartOtp;
  booking.startOtpHmac = hashOtp(freshStartOtp);
  booking.startOtpAttempts = 0;
  saveDB(db2);
  try {
    if (booking.clientId) {
      await createAndSendNotification({
        userId: booking.clientId,
        type: "COMPANION_ARRIVED",
        title: "Companion Arrived \u{1F4CD}",
        body: "Your companion has reached the meeting location. Provide your Start OTP to begin the session.",
        data: { type: "BOOKING", bookingId }
      });
    }
  } catch (nErr) {
    console.warn("Arrival notification warning:", nErr);
  }
  return res.json({
    success: true,
    message: "Arrival recorded."
  });
});
app.post("/api/bookings/:bookingId/verify-start-otp", async (req, res) => {
  const { bookingId } = req.params;
  const { otp, delayMinutes } = req.body;
  const companionId = req.authUser.id;
  const cleanOtp = typeof otp === "string" ? otp.trim() : "";
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: "Start OTP must be exactly 6 numeric digits." });
  }
  if (getDatabaseType() === "supabase") {
    const delay2 = Number(delayMinutes ?? 0);
    if (!Number.isInteger(delay2) || delay2 < 0 || delay2 > 1440) {
      return res.status(400).json({ error: "Delay minutes must be an integer between 0 and 1440." });
    }
    try {
      const result = await databaseAdapter.verifyBookingOtp(bookingId, companionId, "START", hashOtp(cleanOtp), delay2);
      if (result.result === "locked") return res.status(429).json({ error: "Maximum verification attempts exceeded for Start OTP." });
      if (result.result === "invalid") return res.status(400).json({ error: "Invalid Start OTP." });
      const booking2 = { ...result.booking };
      delete booking2.startOtpHmac;
      delete booking2.endOtpHmac;
      delete booking2.startOtpEncrypted;
      delete booking2.completionOtpEncrypted;
      delete booking2.start_otp_hash;
      delete booking2.completion_otp_hash;
      delete booking2.start_otp_encrypted;
      delete booking2.completion_otp_encrypted;
      return res.json({ success: true, message: "Meeting verified. Official session countdown started.", booking: booking2 });
    } catch (error) {
      console.error("Start OTP verification failed.", error);
      return res.status(409).json({ error: "Start OTP could not be verified for this booking." });
    }
  }
  const booking = db2.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.startOtpVerified) {
    return res.status(400).json({ error: "Start OTP has already been verified for this booking. Replay prevented." });
  }
  booking.startOtpAttempts = (booking.startOtpAttempts || 0) + 1;
  if (booking.startOtpAttempts > 5) {
    saveDB(db2);
    return res.status(429).json({ error: "Maximum verification attempts exceeded for Start OTP (limit 5). Please contact support." });
  }
  const expectedHmac = booking.startOtpHmac || (booking.startOtp ? hashOtp(booking.startOtp) : "");
  if (!verifyOtpHash(cleanOtp, expectedHmac)) {
    saveDB(db2);
    return res.status(400).json({ error: "Invalid Start OTP. Please ask the Client for the verified 6-digit code." });
  }
  const delay = Math.max(0, parseInt(delayMinutes, 10) || 0);
  booking.delayMinutes = delay;
  if (delay > 0 && booking.slotMinutes > 0) {
    const penalty = Math.round(booking.bookingAmountPaise / booking.slotMinutes * delay);
    booking.latePenaltyPaise = Math.min(penalty, booking.companionGrossSharePaise);
    booking.companionNetSharePaise = booking.companionGrossSharePaise - booking.latePenaltyPaise;
    booking.clientRefundPenaltyPaise = booking.latePenaltyPaise;
  }
  booking.startOtpVerified = true;
  booking.meetingStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  booking.status = "IN_PROGRESS";
  delete booking.startOtp;
  delete booking.startOtpHmac;
  saveDB(db2);
  const sanitized = { ...booking };
  delete sanitized.startOtpHmac;
  delete sanitized.endOtpHmac;
  return res.json({
    success: true,
    message: "Meeting verified. Official session countdown started.",
    booking: sanitized
  });
});
app.post("/api/bookings/:bookingId/complete", async (req, res) => {
  const { bookingId } = req.params;
  const { completionOtp } = req.body;
  const companionId = req.authUser.id;
  const cleanOtp = typeof completionOtp === "string" ? completionOtp.trim() : "";
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: "Completion OTP must be exactly 6 numeric digits." });
  }
  if (getDatabaseType() === "supabase") {
    try {
      const result = await databaseAdapter.verifyBookingOtp(bookingId, companionId, "COMPLETION", hashOtp(cleanOtp), 0);
      if (result.result === "locked") return res.status(429).json({ error: "Maximum verification attempts exceeded for Completion OTP." });
      if (result.result === "invalid") return res.status(400).json({ error: "Invalid Completion OTP." });
      const booking2 = { ...result.booking };
      delete booking2.startOtpHmac;
      delete booking2.endOtpHmac;
      delete booking2.startOtpEncrypted;
      delete booking2.completionOtpEncrypted;
      delete booking2.start_otp_hash;
      delete booking2.completion_otp_hash;
      delete booking2.start_otp_encrypted;
      delete booking2.completion_otp_encrypted;
      try {
        if (booking2.clientId) {
          createAndSendNotification({
            userId: booking2.clientId,
            type: "BOOKING_COMPLETED",
            title: "Session Completed \u{1F389}",
            body: `Booking #${booking2.bookingCode || ""} completed successfully. Thank you for choosing PairUp!`,
            data: { type: "BOOKING", bookingId }
          }).catch(() => null);
        }
        if (booking2.companionId) {
          createAndSendNotification({
            userId: booking2.companionId,
            type: "BOOKING_COMPLETED",
            title: "Session Completed \u{1F389}",
            body: `Booking #${booking2.bookingCode || ""} completed successfully. Earnings recorded in locked balance.`,
            data: { type: "BOOKING", bookingId }
          }).catch(() => null);
        }
      } catch (nErr) {
        console.warn("Completion notification error:", nErr);
      }
      return res.json({
        success: true,
        message: "Booking completed. Settlement is locked for at least 48 hours.",
        booking: booking2
      });
    } catch (error) {
      console.error("Completion OTP verification failed.", error);
      return res.status(409).json({ error: "Completion OTP could not be verified for this booking." });
    }
  }
  const booking = db2.bookings[bookingId];
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.endOtpVerified) {
    return res.status(400).json({ error: "Completion OTP has already been verified for this booking. Replay prevented." });
  }
  booking.endOtpAttempts = (booking.endOtpAttempts || 0) + 1;
  if (booking.endOtpAttempts > 5) {
    saveDB(db2);
    return res.status(429).json({ error: "Maximum verification attempts exceeded for Completion OTP (limit 5). Please contact support." });
  }
  const expectedHmac = booking.endOtpHmac || (booking.endOtp ? hashOtp(booking.endOtp) : "");
  if (!verifyOtpHash(cleanOtp, expectedHmac)) {
    saveDB(db2);
    return res.status(400).json({ error: "Invalid Completion OTP. Ask the Client for the final 6-digit completion code." });
  }
  const now = /* @__PURE__ */ new Date();
  booking.endOtpVerified = true;
  booking.meetingCompletedAt = now.toISOString();
  booking.status = "COMPLETED";
  delete booking.endOtp;
  delete booking.endOtpHmac;
  const unlockDate = new Date(now.getTime() + 48 * 3600 * 1e3);
  booking.settlementUnlockUtc = unlockDate.toISOString();
  booking.settlementStatus = "LOCKED";
  const wallet = db2.companionWallets[booking.companionId] || {
    companionId: booking.companionId,
    lockedSettlementBalancePaise: 0,
    availableSettlementBalancePaise: 0,
    totalSettledPaise: 0,
    lastUpdated: now.toISOString()
  };
  wallet.lockedSettlementBalancePaise += booking.companionNetSharePaise;
  wallet.lastUpdated = now.toISOString();
  db2.companionWallets[booking.companionId] = wallet;
  if (db2.companionProfiles[booking.companionId]) {
    db2.companionProfiles[booking.companionId].totalBookings += 1;
  }
  db2.auditLogs.unshift({
    id: `log_${Date.now()}`,
    action: "BOOKING_COMPLETED_48H_LOCKED",
    targetId: booking.id,
    details: `Booking ${booking.bookingCode} completed. \u20B9${(booking.companionNetSharePaise / 100).toFixed(2)} locked in wallet until ${booking.settlementUnlockUtc}.`,
    timestamp: now.toISOString()
  });
  saveDB(db2);
  const sanitized = { ...booking };
  delete sanitized.startOtpHmac;
  delete sanitized.endOtpHmac;
  return res.json({
    success: true,
    message: "Booking successfully completed! Net companion share locked for 48 hours UTC.",
    booking: sanitized,
    wallet
  });
});
app.get("/api/chat/:bookingId/stream", async (req, res) => {
  const bookingId = req.params.bookingId;
  const userId = req.authUser.id;
  if (getDatabaseType() !== "supabase") return res.status(503).json({ error: "Realtime chat requires Supabase." });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.clientId !== userId && booking.companionId !== userId || !["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status)) {
      return res.status(403).json({ error: "Realtime chat requires a confirmed booking participant." });
    }
    let conversation = (await databaseAdapter.listConversations(userId)).find((item) => item.bookingId === bookingId);
    if (!conversation && booking.status !== "COMPLETED") {
      conversation = await databaseAdapter.createConversation({
        bookingId,
        participantA: booking.clientId,
        participantB: booking.companionId
      });
    }
    if (!conversation) return res.status(204).end();
    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    res.write("event: ready\ndata: {}\n\n");
    let after;
    let reading = false;
    const poll = async () => {
      if (reading || res.writableEnded) return;
      reading = true;
      try {
        const messages = await databaseAdapter.listMessages(conversation.id, after);
        for (const item of messages) {
          after = item.created_at || item.createdAt;
          const senderIsClient = item.senderId === booking.clientId;
          const payload = {
            ...item,
            bookingId,
            senderName: senderIsClient ? booking.clientName : booking.companionName,
            senderRole: senderIsClient ? "CLIENT" : "COMPANION",
            timestamp: after
          };
          res.write(`event: message
data: ${JSON.stringify(payload)}

`);
        }
      } catch (error) {
        console.error("Realtime chat polling failed.", error);
        res.write('event: error\ndata: {"error":"Chat stream is temporarily unavailable."}\n\n');
        res.end();
        clearInterval(interval);
      } finally {
        reading = false;
      }
    };
    const interval = setInterval(() => {
      void poll();
    }, 2e3);
    req.on("close", () => clearInterval(interval));
    void poll();
  } catch (error) {
    console.error("Realtime chat could not be started.", error);
    if (!res.headersSent) return res.status(503).json({ error: "Realtime chat is temporarily unavailable." });
    return res.end();
  }
});
var activeChatStore = /* @__PURE__ */ new Map();
app.get("/api/chat/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.authUser.id;
  try {
    let booking = null;
    try {
      booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings ? db2.bookings[bookingId] : null;
    } catch {
      booking = db2.bookings ? db2.bookings[bookingId] : null;
    }
    if (!booking) {
      const tracked = bookingAcceptanceMap.get(bookingId);
      if (tracked) {
        booking = { id: bookingId, status: "CONFIRMED", clientId: userId, companionId: userId };
      }
    }
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.clientId !== userId && booking.companionId !== userId) {
      return res.status(403).json({ error: "Access denied to this booking chat." });
    }
    const messagesMap = /* @__PURE__ */ new Map();
    const memList = activeChatStore.get(bookingId) || db2.chatMessages?.[bookingId] || [];
    memList.forEach((m) => {
      if (m && m.id) messagesMap.set(m.id, m);
    });
    if (getDatabaseType() === "supabase") {
      try {
        let conversation = (await databaseAdapter.listConversations(userId)).find((item) => item.bookingId === bookingId);
        if (conversation) {
          const dbMessages = await databaseAdapter.listMessages(conversation.id);
          (dbMessages || []).forEach((item) => {
            const mapped = {
              ...item,
              id: item.id || `msg_${Math.random()}`,
              bookingId,
              senderId: item.senderId || item.sender_id,
              senderName: item.senderId === booking.clientId ? booking.clientName || "Client" : booking.companionName || "Companion",
              senderRole: item.senderId === booking.clientId ? "CLIENT" : "COMPANION",
              timestamp: item.created_at || item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
            };
            messagesMap.set(mapped.id, mapped);
          });
        }
      } catch (dbErr) {
        console.warn("Supabase chat load notice:", dbErr);
      }
    }
    const allMessages = Array.from(messagesMap.values()).sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return ta - tb;
    });
    return res.json({ messages: allMessages });
  } catch (error) {
    console.error("Booking chat load warning:", error);
    const fallback = activeChatStore.get(bookingId) || db2.chatMessages?.[bookingId] || [];
    return res.json({ messages: fallback });
  }
});
app.post("/api/chat/:bookingId", async (req, res) => {
  const { bookingId } = req.params;
  const senderId = req.authUser.id;
  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 5e3) {
    return res.status(400).json({ error: "A message between 1 and 5000 characters is required." });
  }
  try {
    let booking = null;
    try {
      booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings ? db2.bookings[bookingId] : null;
    } catch {
      booking = db2.bookings ? db2.bookings[bookingId] : null;
    }
    if (!booking) {
      const tracked = bookingAcceptanceMap.get(bookingId);
      if (tracked) {
        booking = { id: bookingId, status: "CONFIRMED", clientId: senderId, companionId: senderId };
      }
    }
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.clientId !== senderId && booking.companionId !== senderId) {
      return res.status(403).json({ error: "Access denied to this booking chat." });
    }
    const isClient = booking.clientId === senderId;
    const chatMsg = {
      id: `msg_${Date.now()}_${crypto4.randomUUID().slice(0, 6)}`,
      bookingId,
      senderId,
      senderName: isClient ? booking.clientName || "Client" : booking.companionName || "Companion",
      senderRole: isClient ? "CLIENT" : "COMPANION",
      message: message.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const storeList = activeChatStore.get(bookingId) || [];
    storeList.push(chatMsg);
    activeChatStore.set(bookingId, storeList);
    (db2.chatMessages ||= {})[bookingId] = storeList;
    if (getDatabaseType() === "supabase") {
      try {
        let conversation = (await databaseAdapter.listConversations(senderId)).find((item) => item.bookingId === bookingId);
        if (!conversation) {
          conversation = await databaseAdapter.createConversation({
            bookingId,
            participantA: booking.clientId,
            participantB: booking.companionId
          });
        }
        if (conversation?.id) {
          await databaseAdapter.createMessage({
            conversationId: conversation.id,
            senderId,
            message: chatMsg.message
          });
        }
      } catch (sbErr) {
        console.warn("Supabase chat message persistence notice:", sbErr);
      }
    }
    if (isClient && booking.companionId) {
      pushCompanionAlert(booking.companionId, {
        type: "NEW_CHAT_MESSAGE",
        bookingId,
        message: chatMsg
      });
    }
    return res.json({ success: true, message: chatMsg });
  } catch (error) {
    console.error("Booking chat message save error:", error);
    const fallbackMsg = {
      id: `msg_${Date.now()}`,
      bookingId,
      senderId,
      senderName: "You",
      senderRole: "USER",
      message: message.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const list = activeChatStore.get(bookingId) || [];
    list.push(fallbackMsg);
    activeChatStore.set(bookingId, list);
    return res.json({ success: true, message: fallbackMsg });
  }
});
app.post("/api/reports/submit", async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) return res.status(401).json({ error: "Authentication required." });
  const { bookingId, reason, details } = req.body || {};
  if (!bookingId || typeof bookingId !== "string") {
    return res.status(400).json({ error: "Valid booking ID is required." });
  }
  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    return res.status(400).json({ error: "Please select or provide a reason for the report." });
  }
  if (!details || typeof details !== "string" || details.trim().length < 5) {
    return res.status(400).json({ error: "Please describe the incident in detail (at least 5 characters)." });
  }
  try {
    const booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings[bookingId];
    if (!booking) {
      return res.status(404).json({ error: "Associated booking could not be found." });
    }
    if (booking.clientId !== authUser.id && booking.companionId !== authUser.id) {
      return res.status(403).json({ error: "You are not a participant in this booking." });
    }
    const isClient = booking.clientId === authUser.id;
    const reportedUserId = isClient ? booking.companionId : booking.clientId;
    const reportedUserName = isClient ? booking.companionName || "Companion" : booking.clientName || "Client";
    const reportingUserName = isClient ? booking.clientName || authUser.legalName || authUser.profileName || "Client" : booking.companionName || authUser.legalName || authUser.profileName || "Companion";
    let reportedUser = null;
    try {
      reportedUser = await databaseAdapter.getUser(reportedUserId) || db2.users?.[reportedUserId];
    } catch {
    }
    const report = await databaseAdapter.createIncidentReport({
      bookingId,
      bookingCode: booking.bookingCode || bookingId.slice(0, 8),
      reportingUserId: authUser.id,
      reportingUserName,
      reportingUserPhone: authUser.phone || "",
      reportingUserRole: isClient ? "CLIENT" : "COMPANION",
      reportedUserId,
      reportedUserName,
      reportedUserPhone: reportedUser?.phone || "",
      reportedUserRole: isClient ? "COMPANION" : "CLIENT",
      reason: reason.trim(),
      details: details.trim(),
      status: "PENDING_REVIEW"
    });
    await databaseAdapter.createAuditLog({
      action: "INCIDENT_REPORT_SUBMITTED",
      entityType: "incident_report",
      entityId: report.id,
      userId: authUser.id,
      details: `Report filed by ${reportingUserName} against ${reportedUserName}: ${reason.trim()}`
    }).catch(() => null);
    return res.json({ success: true, report });
  } catch (error) {
    console.error("Failed to submit incident report:", error);
    return res.status(500).json({ error: "Could not submit report at this time. Please contact support." });
  }
});
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string" || password.length > 1024) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  if (!isOtpHmacSecretConfigured()) {
    return res.status(503).json({ error: "Admin MFA is unavailable because OTP_HMAC_SECRET is not configured." });
  }
  let admin;
  try {
    admin = await databaseAdapter.getAdminUser(email.trim().toLowerCase());
  } catch (error) {
    console.error("Administrator account lookup failed.", error);
    return res.status(503).json({ error: "Administrator authentication is temporarily unavailable." });
  }
  if (!admin) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  let passwordVerification;
  try {
    passwordVerification = await verifyPassword(password, admin.passwordHash);
  } catch (error) {
    console.error("Administrator password verification failed.", error);
    return res.status(503).json({ error: "Administrator authentication is temporarily unavailable." });
  }
  if (!passwordVerification.valid) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  if (passwordVerification.upgradedHash) {
    try {
      await databaseAdapter.updateAdminPasswordHash(admin.id, passwordVerification.upgradedHash);
    } catch (error) {
      console.error("Administrator password hash upgrade could not be persisted.", error);
      return res.status(503).json({ error: "Administrator authentication is temporarily unavailable." });
    }
  }
  if (!isApitxtConfigured() || !isOtpHmacSecretConfigured()) {
    return res.status(503).json({ error: "Administrator SMS MFA is not configured on the backend." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production administrator MFA requires Supabase challenge storage." });
  }
  const otp = generateOtp();
  const emailKey = admin.email.toLowerCase();
  try {
    const reservation = await databaseAdapter.reserveAdminMfa(emailKey, hashOtp(otp));
    if (!reservation.allowed) {
      return res.status(429).json({
        error: `Please wait ${reservation.waitSeconds || 60}s before requesting another administrator code.`,
        retryAfterSeconds: reservation.waitSeconds || 60
      });
    }
    const delivery = await sendApitxtOtp({ mobile: admin.phone, otp });
    if (!delivery.success) {
      await databaseAdapter.setAdminMfaDeliveryResult(emailKey, false);
      return res.status(502).json({ error: delivery.error || "APITXT did not accept the administrator MFA request." });
    }
    await databaseAdapter.setAdminMfaDeliveryResult(emailKey, true, delivery.requestId);
  } catch (error) {
    console.error("Administrator MFA request failed.", error);
    return res.status(503).json({ error: "Administrator MFA is temporarily unavailable." });
  }
  return res.json({
    success: true,
    requiresMfa: true,
    maskedPhone: admin.phone.replace(/(\+91)(\d{2})\d{6}(\d{2})/, "$1 $2******$3")
  });
});
app.post("/api/admin/verify-mfa", async (req, res) => {
  const { email, otp } = req.body;
  if (typeof email !== "string" || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter the six-digit administrator verification code." });
  }
  if (!isOtpHmacSecretConfigured() || !isSessionSecretConfigured()) {
    return res.status(503).json({ error: "Administrator MFA secrets are not configured on the backend." });
  }
  if (process.env.NODE_ENV === "production" && getDatabaseType() !== "supabase") {
    return res.status(503).json({ error: "Production administrator MFA requires Supabase challenge storage." });
  }
  try {
    const verification = await databaseAdapter.verifyAdminMfa(email.toLowerCase(), hashOtp(otp));
    if (verification !== "verified") {
      if (verification === "locked") {
        return res.status(429).json({ error: "Too many incorrect MFA attempts. Please log in again." });
      }
      if (verification === "expired") {
        return res.status(400).json({ error: "MFA OTP expired. Please log in again." });
      }
      return res.status(400).json({ error: "MFA OTP is invalid. Please log in again." });
    }
    const admin = await databaseAdapter.getAdminUser(email.trim().toLowerCase());
    if (!admin || !AUTHORIZED_ADMIN_ROLES.includes(admin.role)) {
      return res.status(403).json({ error: "Administrator account is not authorized." });
    }
    return res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        phone: admin.phone,
        name: admin.name,
        role: admin.role
      },
      adminToken: issueAdminSessionToken(admin.id)
    });
  } catch (error) {
    console.error("Administrator MFA verification failed.", error);
    return res.status(503).json({ error: "Administrator MFA is temporarily unavailable." });
  }
});
app.post("/api/admin/logout", async (req, res) => {
  const session = req.verifiedSession;
  const admin = req.adminUser;
  if (!session || !admin || session.principalType !== "ADMIN") {
    return res.status(401).json({ error: "Administrator authentication required." });
  }
  try {
    await databaseAdapter.revokeSession(session.tokenId, admin.id, "ADMIN", session.expiresAt);
    return res.status(204).end();
  } catch (error) {
    console.error("Administrator session revocation failed.", error);
    return res.status(503).json({ error: "Administrator logout could not be completed." });
  }
});
function requireAdminRoles(...allowedRoles) {
  return (req, res, next) => {
    const matchedAdmin = req.adminUser;
    if (!matchedAdmin) return res.status(401).json({ error: "Authentication required." });
    if (allowedRoles.length > 0 && !allowedRoles.includes(matchedAdmin.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${matchedAdmin.role}' is not authorized for this resource.`
      });
    }
    req.adminUser = matchedAdmin;
    next();
  };
}
var requireAdminAuth = requireAdminRoles();
app.get("/api/admin/overview", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "AUDITOR"), async (req, res) => {
  try {
    const users = await databaseAdapter.listUsers();
    const bookings = await databaseAdapter.listBookings();
    const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
    let totalGrossBookingVolumePaise = 0;
    let totalAdminPlatformFeePaise = 0;
    let totalCompanionSettledPaise = 0;
    let totalLatePenaltiesPaise = 0;
    for (const b of bookings) {
      totalGrossBookingVolumePaise += b.bookingAmountPaise || 0;
      totalAdminPlatformFeePaise += b.adminPlatformFeePaise || 0;
      totalLatePenaltiesPaise += b.latePenaltyPaise || 0;
      if (b.settlementStatus === "PAID_OUT") {
        totalCompanionSettledPaise += b.companionNetSharePaise || 0;
      }
    }
    const pendingKycs = await databaseAdapter.listKycSubmissions({ status: "PENDING" });
    return res.json({
      totalUsers: users.length,
      totalBookings: bookings.length,
      completedBookingsCount: completedBookings.length,
      pendingKycCount: pendingKycs.length,
      finance: {
        totalGrossBookingVolumePaise,
        totalAdminPlatformFeePaise,
        totalCompanionSettledPaise,
        totalLatePenaltiesPaise
      }
    });
  } catch (error) {
    console.error("Failed to load admin overview data.", error);
    return res.status(503).json({ error: "Admin overview data is temporarily unavailable." });
  }
});
app.get("/api/admin/kyc/list", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN"), async (req, res) => {
  const { userType, status } = req.query;
  const validRoles = ["CLIENT", "COMPANION"];
  const validStatuses = ["PENDING", "APPROVED", "REJECTED", "RESUBMISSION_REQUIRED"];
  if (userType && !validRoles.includes(String(userType))) return res.status(400).json({ error: "Invalid KYC role filter." });
  if (status && status !== "ALL" && !validStatuses.includes(String(status))) return res.status(400).json({ error: "Invalid KYC status filter." });
  if (getDatabaseType() === "json") {
    let records = Object.values(db2.kycSubmissions);
    if (userType) records = records.filter((record) => record.userType === userType);
    if (status && status !== "ALL") records = records.filter((record) => record.status === status);
    return res.json({
      submissions: records.map((record) => ({
        ...omitKycDocumentPaths(record),
        userPhone: db2.users[record.userId]?.phone || null
      }))
    });
  }
  try {
    const records = await databaseAdapter.listKycSubmissions({
      submissionRole: userType || void 0,
      status: status && status !== "ALL" ? status : void 0
    });
    const submissions = await Promise.all(records.map(async (record) => {
      const owner = await databaseAdapter.getUser(record.userId);
      return { ...omitKycDocumentPaths(record), userPhone: owner?.phone || null };
    }));
    return res.json({ submissions });
  } catch (error) {
    console.error("KYC queue could not be loaded from the database.", error);
    return res.status(503).json({ error: "KYC review is temporarily unavailable." });
  }
});
app.get("/api/admin/kyc/:id/documents", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN"), async (req, res) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id);
  const isLegacyId = /^kyc_[a-z0-9_-]+$/i.test(req.params.id);
  if (getDatabaseType() === "supabase" ? !isUuid : !(isUuid || isLegacyId)) {
    return res.status(404).json({ error: "KYC submission not found." });
  }
  if (getDatabaseType() === "json") {
    const submission = db2.kycSubmissions[req.params.id];
    if (!submission) return res.status(404).json({ error: "KYC submission not found." });
    return res.json({
      documents: {
        idFrontUrl: submission.idFrontUrl || null,
        idBackUrl: submission.idBackUrl || null,
        selfieUrl: submission.selfieUrl || null
      }
    });
  }
  try {
    const documents = await databaseAdapter.createKycDocumentSignedUrls(req.params.id);
    if (!documents) return res.status(404).json({ error: "KYC submission not found." });
    return res.json({ documents });
  } catch (error) {
    console.error("Private KYC documents could not be accessed.", error);
    return res.status(503).json({ error: "KYC documents are temporarily unavailable." });
  }
});
app.post("/api/admin/kyc/:id/action", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const rejectionReason = typeof req.body.rejectionReason === "string" ? req.body.rejectionReason.trim() : "";
  const admin = req.adminUser;
  if (!["APPROVE", "REJECT"].includes(action)) return res.status(400).json({ error: "Invalid KYC decision." });
  if (action === "REJECT" && !rejectionReason) return res.status(400).json({ error: "A rejection reason is required." });
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const isLegacyId = /^kyc_[a-z0-9_-]+$/i.test(id);
  if (getDatabaseType() === "supabase" ? !isUuid : !(isUuid || isLegacyId)) {
    return res.status(404).json({ error: "KYC submission not found." });
  }
  if (getDatabaseType() === "json") {
    const submission = db2.kycSubmissions[id];
    if (!submission) return res.status(404).json({ error: "KYC submission not found." });
    const user = db2.users[submission.userId];
    submission.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    submission.rejectionReason = action === "REJECT" ? rejectionReason : null;
    submission.decidedAt = (/* @__PURE__ */ new Date()).toISOString();
    submission.decidedByAdminId = admin.id;
    if (user) {
      user.kycStatus = submission.status;
      user.kycDecidedAt = submission.decidedAt;
      user.kycDecidedByAdminId = admin.id;
      user.kycRejectionReason = submission.rejectionReason;
    }
    const companionProfile = db2.companionProfiles[submission.userId];
    if (companionProfile) {
      companionProfile.isLive = Boolean(
        submission.status === "APPROVED" && companionProfile.membership?.isActive && new Date(companionProfile.membership.expiryDate) > /* @__PURE__ */ new Date() && companionProfile.bankDetails?.isVerified && !companionProfile.isPaused
      );
    }
    db2.auditLogs.unshift({
      id: `log_${Date.now()}`,
      adminId: admin.id,
      adminEmail: admin.email,
      action: `KYC_${submission.status}`,
      targetId: submission.userId,
      details: `KYC for ${submission.legalName} (${submission.userType}) was ${submission.status}.`,
      timestamp: submission.decidedAt
    });
    saveDB(db2);
    try {
      if (action === "REJECT") {
        await createAndSendNotification({
          userId: submission.userId,
          type: "KYC_REJECTED",
          title: "KYC Verification Action Required \u26A0\uFE0F",
          body: `Rejection reason: ${rejectionReason}. Tap to view details and re-upload clear documents.`,
          data: { type: "KYC_REJECTED", action: "OPEN_KYC_WIZARD", rejectionReason }
        });
      } else {
        await createAndSendNotification({
          userId: submission.userId,
          type: "KYC_APPROVED",
          title: "KYC Verification Approved \u2705",
          body: "Congratulations! Your identity documents and live selfie have been approved by PairUp Security Network.",
          data: { type: "KYC_APPROVED" }
        });
      }
    } catch (nErr) {
      console.warn("KYC notification delivery warning:", nErr);
    }
    return res.json({
      success: true,
      submission: { ...omitKycDocumentPaths(submission), userPhone: user?.phone || null }
    });
  }
  try {
    const existing = await databaseAdapter.getKycSubmission(id);
    if (!existing) return res.status(404).json({ error: "KYC submission not found." });
    const submission = await databaseAdapter.reviewKycSubmission(
      id,
      action === "APPROVE" ? "APPROVED" : "REJECTED",
      action === "REJECT" ? rejectionReason : null,
      admin.id
    );
    await databaseAdapter.updateUser(submission.userId, {
      kycStatus: action === "APPROVE" ? "APPROVED" : "REJECTED",
      kycRejectionReason: action === "REJECT" ? rejectionReason : null
    }).catch((err) => console.warn("Could not update user KYC status in DB:", err));
    if (db2.users && db2.users[submission.userId]) {
      db2.users[submission.userId].kycStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      db2.users[submission.userId].kycRejectionReason = action === "REJECT" ? rejectionReason : null;
    }
    const user = await databaseAdapter.getUser(submission.userId);
    try {
      if (action === "REJECT") {
        await createAndSendNotification({
          userId: submission.userId,
          type: "KYC_REJECTED",
          title: "KYC Verification Action Required \u26A0\uFE0F",
          body: `Rejection reason: ${rejectionReason}. Tap to view details and re-upload clear documents.`,
          data: { type: "KYC_REJECTED", action: "OPEN_KYC_WIZARD", rejectionReason }
        });
      } else {
        await createAndSendNotification({
          userId: submission.userId,
          type: "KYC_APPROVED",
          title: "KYC Verification Approved \u2705",
          body: "Congratulations! Your identity documents and live selfie have been approved by PairUp Security Network.",
          data: { type: "KYC_APPROVED" }
        });
      }
    } catch (nErr) {
      console.warn("KYC notification delivery warning:", nErr);
    }
    return res.json({ success: true, submission: { ...omitKycDocumentPaths(submission), userPhone: user?.phone || null } });
  } catch (error) {
    console.error("KYC decision could not be persisted.", error);
    return res.status(503).json({ error: "KYC review is temporarily unavailable." });
  }
});
app.get("/api/admin/finance/payouts", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (_req, res) => {
  try {
    return res.json({ payouts: await databaseAdapter.listPayouts() });
  } catch (error) {
    console.error("Finance payouts could not be loaded.", error);
    return res.status(503).json({ error: "Payout records are temporarily unavailable." });
  }
});
app.get("/api/admin/finance/refunds", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (_req, res) => {
  try {
    return res.json({ refunds: await databaseAdapter.listPaymentRefunds() });
  } catch (error) {
    console.error("Finance refunds could not be loaded.", error);
    return res.status(503).json({ error: "Refund records are temporarily unavailable." });
  }
});
app.get("/api/admin/finance/settlements", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (_req, res) => {
  try {
    const bookings = await databaseAdapter.listBookings();
    const companionIds = [...new Set(bookings.map((booking) => booking.companionId).filter(Boolean))];
    const verifications = await Promise.all(companionIds.map(async (id) => [
      id,
      await databaseAdapter.getBankVerification(id)
    ]));
    const bankByUserId = new Map(verifications);
    const now = Date.now();
    return res.json({ settlements: bookings.map((booking) => {
      const completed = booking.status === "COMPLETED";
      const unlockAt = booking.settlementUnlockUtc ? new Date(booking.settlementUnlockUtc).getTime() : Number.POSITIVE_INFINITY;
      const eligibility = booking.settlementStatus === "PAID_OUT" ? "PAID_OUT" : !completed ? "IN_PROGRESS" : now < unlockAt ? "LOCKED_48H" : "ELIGIBLE_FOR_PAYOUT";
      const bank = bankByUserId.get(booking.companionId);
      return {
        ...booking,
        calculatedEligibility: eligibility,
        bankAccountMasked: bank?.accountNumberMasked || "N/A",
        ifsc: bank?.ifsc || "N/A"
      };
    }) });
  } catch (error) {
    console.error("Finance settlements could not be loaded.", error);
    return res.status(503).json({ error: "Settlements are temporarily unavailable." });
  }
});
app.post("/api/admin/finance/re-auth", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (req, res) => {
  const admin = req.adminUser;
  if (!admin || !["SUPER_ADMIN", "FINANCE_ADMIN"].includes(admin.role)) {
    return res.status(403).json({ error: "Finance administrator authorization is required." });
  }
  if (getDatabaseType() !== "supabase") return res.status(503).json({ error: "Sensitive finance MFA requires Supabase." });
  const action = req.body?.action;
  if (!["REVEAL_BANK", "PROCESS_PAYOUT", "ISSUE_REFUND"].includes(action)) {
    return res.status(400).json({ error: "A valid sensitive finance action is required." });
  }
  try {
    const storedAdmin = await databaseAdapter.getAdminUserById(admin.id);
    if (!storedAdmin?.phone) return res.status(503).json({ error: "Administrator SMS MFA phone is not configured." });
    const otp = generateOtp();
    const reservation = await databaseAdapter.reserveAdminSensitiveMfa(admin.id, action, hashOtp(otp));
    if (!reservation.allowed) {
      res.setHeader("Retry-After", String(reservation.waitSeconds || 60));
      return res.status(429).json({ error: "Sensitive-action MFA resend cooldown is active." });
    }
    const delivery = await sendApitxtOtp({ mobile: storedAdmin.phone, otp });
    const challengeUpdated = await databaseAdapter.completeAdminSensitiveMfaDelivery(admin.id, action, delivery.success);
    if (!challengeUpdated) throw new Error("Sensitive-action MFA challenge was not awaiting delivery.");
    if (!delivery.success) {
      console.error("Sensitive finance MFA SMS delivery failed.", delivery.error);
      return res.status(503).json({ error: "Sensitive-action MFA delivery failed." });
    }
    return res.json({ success: true, expiresInSeconds: 300 });
  } catch (error) {
    console.error("Sensitive finance MFA request failed.", error);
    return res.status(503).json({ error: "Sensitive-action MFA is temporarily unavailable." });
  }
});
app.post("/api/admin/finance/re-auth/verify", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (req, res) => {
  const admin = req.adminUser;
  const { action, otp } = req.body || {};
  if (!["REVEAL_BANK", "PROCESS_PAYOUT", "ISSUE_REFUND"].includes(action) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "A valid finance action and six-digit MFA code are required." });
  }
  try {
    const result = await databaseAdapter.verifyAdminSensitiveMfa(admin.id, action, hashOtp(otp));
    if (result !== "verified") {
      return res.status(result === "locked" ? 429 : result === "expired" ? 410 : 401).json({ error: `Sensitive-action MFA verification ${result}.` });
    }
    return res.json({ success: true, action, expiresInSeconds: 300 });
  } catch (error) {
    console.error("Sensitive finance MFA verification failed.", error);
    return res.status(503).json({ error: "Sensitive-action MFA is temporarily unavailable." });
  }
});
app.post("/api/admin/finance/reveal-bank", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (req, res) => {
  const admin = req.adminUser;
  const userId = req.body?.userId;
  if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return res.status(400).json({ error: "A valid Companion user ID is required." });
  }
  try {
    if (!await databaseAdapter.consumeAdminSensitiveMfa(admin.id, "REVEAL_BANK")) {
      return res.status(403).json({ error: "Fresh finance MFA is required to reveal bank details." });
    }
    const verification = await databaseAdapter.getBankVerification(userId);
    if (!verification || verification.verificationStatus !== "VERIFIED" || !verification.accountNumberEncrypted) {
      return res.status(404).json({ error: "Verified bank details were not found." });
    }
    await databaseAdapter.createAuditLog({
      adminUserId: admin.id,
      userId,
      action: "BANK_DETAILS_REVEALED",
      entityType: "bank_verification",
      entityId: verification.id,
      details: { accountNumberLast4: verification.accountNumberLast4 }
    });
    return res.json({
      accountNumber: decryptBankAccount(verification.accountNumberEncrypted),
      accountNumberMasked: verification.accountNumberMasked,
      accountHolderName: verification.accountHolderName,
      ifsc: verification.ifsc,
      bankName: verification.bankName
    });
  } catch (error) {
    console.error("Bank details could not be revealed.", error);
    return res.status(503).json({ error: "Bank detail reveal is temporarily unavailable." });
  }
});
app.post("/api/admin/finance/process-payout", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (req, res) => {
  const { bookingId, utrNumber } = req.body || {};
  const admin = req.adminUser;
  if (typeof bookingId !== "string" || typeof utrNumber !== "string" || !/^[A-Za-z0-9-]{8,40}$/.test(utrNumber.trim())) {
    return res.status(400).json({ error: "A valid booking ID and bank UTR reference are required." });
  }
  try {
    if (!await databaseAdapter.consumeAdminSensitiveMfa(admin.id, "PROCESS_PAYOUT")) {
      return res.status(403).json({ error: "Fresh finance MFA is required to process a payout." });
    }
    const payout = await databaseAdapter.processBookingPayout(bookingId, admin.id, utrNumber.trim());
    await databaseAdapter.createAuditLog({
      adminUserId: admin.id,
      action: "PAYOUT_COMPLETED",
      entityType: "booking",
      entityId: bookingId,
      details: { payoutId: payout.id, utrReference: payout.utr_reference || payout.utrReference }
    });
    return res.json({ success: true, message: "Manual payout recorded.", payout });
  } catch (error) {
    console.error("Manual payout could not be processed.", error);
    return res.status(503).json({ error: "Payout processing failed or is temporarily unavailable." });
  }
});
app.post("/api/admin/finance/refund", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN"), async (req, res) => {
  const { bookingId, membershipId, amountPaise, reason, idempotencyKey } = req.body || {};
  const admin = req.adminUser;
  if (Boolean(bookingId) === Boolean(membershipId) || typeof amountPaise !== "number" || !Number.isSafeInteger(amountPaise) || amountPaise <= 0 || typeof reason !== "string" || !reason.trim() || reason.length > 500 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{10,255}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: "Provide exactly one payment resource, a positive paise amount, a reason, and an idempotency key." });
  }
  try {
    if (!await databaseAdapter.consumeAdminSensitiveMfa(admin.id, "ISSUE_REFUND")) {
      return res.status(403).json({ error: "Fresh finance MFA is required to issue a refund." });
    }
    let paymentId;
    if (bookingId) {
      const booking = await databaseAdapter.getBooking(bookingId);
      if (!booking || booking.paymentStatus !== "PAID" || !booking.paymentId) {
        return res.status(404).json({ error: "Captured booking payment was not found." });
      }
      paymentId = booking.paymentId;
    } else {
      const membership = (await databaseAdapter.listMemberships()).find((item) => item.id === membershipId);
      if (!membership || membership.paymentStatus !== "PAID" || !membership.paymentId) {
        return res.status(404).json({ error: "Captured membership payment was not found." });
      }
      paymentId = membership.paymentId;
    }
    if (!paymentId) return res.status(404).json({ error: "Captured payment was not found." });
    const reservation = await databaseAdapter.reservePaymentRefund({
      bookingId: bookingId || null,
      membershipId: membershipId || null,
      paymentId,
      amountPaise,
      idempotencyKey,
      reason: reason.trim(),
      adminUserId: admin.id
    });
    const providerRefund = await createRazorpayRefund({
      paymentId,
      amountPaise,
      idempotencyKey,
      reason: reason.trim()
    });
    const status = providerRefund.status === "processed" ? "PROCESSED" : providerRefund.status === "pending" ? "PROCESSING" : "UNKNOWN";
    const updated = await databaseAdapter.updatePaymentRefund(idempotencyKey, status, providerRefund.id);
    await databaseAdapter.createAuditLog({
      adminUserId: admin.id,
      action: "PAYMENT_REFUND_REQUESTED",
      entityType: bookingId ? "booking" : "companion_membership",
      entityId: bookingId || membershipId,
      details: { refundId: reservation.id, providerRefundId: providerRefund.id, amountPaise, status }
    });
    return res.status(202).json({ success: true, refund: updated });
  } catch (error) {
    console.error("Admin refund could not be processed.", error);
    return res.status(503).json({ error: "Refund processing is unavailable; verify the provider and reconciliation state before retrying." });
  }
});
app.get("/api/admin/staff", requireAdminRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const staff = await databaseAdapter.listAdminUsers();
    const sanitized = staff.map(({ passwordHash: _hash, ...s }) => s);
    return res.json({ staff: sanitized });
  } catch (error) {
    console.error("Failed to list admin staff.", error);
    return res.status(503).json({ error: "Admin staff listing is temporarily unavailable." });
  }
});
app.post("/api/admin/staff/create", requireAdminRoles("SUPER_ADMIN"), async (req, res) => {
  const { email, phone, name, role, password } = req.body;
  const allowedRoles = ["KYC_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "AUDITOR"];
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof phone !== "string" || !normalizeIndianPhone(phone) || typeof name !== "string" || !name.trim() || !allowedRoles.includes(role) || typeof password !== "string" || password.length < 12 || password.length > 1024) {
    return res.status(400).json({ error: "Valid staff details, an authorized role, and a password of at least 12 characters are required." });
  }
  const staffId = `admin_${crypto4.randomUUID().slice(0, 8)}`;
  const newStaff = {
    id: staffId,
    email: email.trim().toLowerCase(),
    phone: normalizeIndianPhone(phone),
    name: name.trim(),
    role,
    passwordHash: await hashPassword(password),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    await databaseAdapter.createAdminUser(newStaff);
    const { passwordHash: _passwordHash, ...publicStaff } = newStaff;
    return res.json({ success: true, staff: publicStaff });
  } catch (error) {
    console.error("Failed to create admin staff.", error);
    return res.status(503).json({ error: "Staff account creation is temporarily unavailable." });
  }
});
app.post("/api/admin/staff/:staffId/role", requireAdminRoles("SUPER_ADMIN"), async (req, res) => {
  const { staffId } = req.params;
  const { role } = req.body;
  const allowedRoles = ["KYC_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "AUDITOR"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Valid authorized role (KYC_ADMIN, FINANCE_ADMIN, SUPPORT_ADMIN, AUDITOR) is required." });
  }
  try {
    const updated = await databaseAdapter.updateAdminUserRole(staffId, role);
    return res.json({ success: true, staff: updated });
  } catch (error) {
    console.error("Failed to update staff role.", error);
    return res.status(500).json({ error: error.message || "Staff role update failed." });
  }
});
app.delete("/api/admin/staff/:staffId", requireAdminRoles("SUPER_ADMIN"), async (req, res) => {
  const { staffId } = req.params;
  const admin = req.adminUser;
  if (admin.id === staffId) {
    return res.status(400).json({ error: "Cannot delete your own super admin account." });
  }
  try {
    await databaseAdapter.deleteAdminUser(staffId);
    return res.json({ success: true, message: "Staff access revoked successfully." });
  } catch (error) {
    console.error("Failed to delete staff member.", error);
    return res.status(500).json({ error: error.message || "Staff deletion failed." });
  }
});
app.get("/api/admin/audit-logs", requireAdminRoles("SUPER_ADMIN", "AUDITOR"), async (req, res) => {
  try {
    const logs = await databaseAdapter.listAuditLogs({ limit: 100 });
    return res.json({ logs });
  } catch (error) {
    console.error("Failed to retrieve audit logs.", error);
    return res.status(503).json({ error: "Audit logs are temporarily unavailable." });
  }
});
app.get("/api/admin/clients", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  try {
    const allUsers = await databaseAdapter.listUsers();
    const allBookings = await databaseAdapter.listBookings();
    const clients = allUsers.filter((u) => u.role === "CLIENT" || u.activeRole === "CLIENT").map((u) => {
      const userBookings = allBookings.filter((b) => b.clientId === u.id);
      return {
        id: u.id,
        phone: u.phone,
        legalName: u.legalName,
        email: u.email,
        kycStatus: u.kycStatus,
        city: u.city,
        createdAt: u.createdAt,
        totalBookings: userBookings.length,
        isSuspended: !!u.isSuspended,
        suspendedReason: u.suspendedReason || null,
        suspendedAt: u.suspendedAt || null,
        warningCount: u.warningCount || 0,
        lastWarningReason: u.lastWarningReason || null,
        lastWarningAt: u.lastWarningAt || null
      };
    });
    return res.json({ clients });
  } catch (error) {
    console.error("Failed to list clients.", error);
    return res.status(503).json({ error: "Client listing is temporarily unavailable." });
  }
});
app.get("/api/admin/companions", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  try {
    const allUsers = await databaseAdapter.listUsers();
    const companionProfiles = await databaseAdapter.listCompanionProfiles();
    const profileMap = new Map(companionProfiles.map((p) => [p.userId, p]));
    const companions = await Promise.all(
      allUsers.filter(
        (u) => u.role === "COMPANION" || u.role === "DUAL" || u.activeRole === "COMPANION" || profileMap.has(u.id)
      ).map(async (u) => {
        const profile = profileMap.get(u.id);
        const [wallet, bankVerification, companionKyc, clientKyc, membership] = await Promise.all([
          databaseAdapter.getWalletBalance(u.id).catch(() => null),
          databaseAdapter.getBankVerification(u.id).catch(() => null),
          databaseAdapter.getUserKycSubmission(u.id, "COMPANION").catch(() => null),
          databaseAdapter.getUserKycSubmission(u.id, "CLIENT").catch(() => null),
          databaseAdapter.getActiveMembership(u.id).catch(() => null)
        ]);
        const isBankVerified = Boolean(
          bankVerification?.verificationStatus === "VERIFIED" || bankVerification?.isVerified === true || profile?.bankDetails?.isVerified
        );
        const effectiveKyc = companionKyc || clientKyc;
        const kycStatus = effectiveKyc?.status || u.kycStatus || u.kyc_status || "NOT_SUBMITTED";
        const membershipActive = Boolean(
          profile?.membership?.isActive || membership?.paymentStatus === "PAID" && new Date(membership.expiryDate) > /* @__PURE__ */ new Date()
        );
        const membershipTier = profile?.membership?.plan || membership?.plan || "NONE";
        const isLive = Boolean(
          profile?.isLive || kycStatus === "APPROVED" && membershipActive && isBankVerified && !profile?.isPaused
        );
        return {
          id: u.id,
          phone: u.phone,
          legalName: u.legalName,
          email: u.email,
          kycStatus,
          city: u.city,
          isLive,
          isPaused: profile?.isPaused || false,
          membershipActive,
          membershipTier,
          bankVerified: isBankVerified,
          totalBookings: profile?.totalBookings || 0,
          lockedBalancePaise: wallet?.lockedSettlementBalancePaise || 0,
          totalSettledPaise: wallet?.totalSettledPaise || 0,
          isSuspended: !!u.isSuspended,
          suspendedReason: u.suspendedReason || null,
          suspendedAt: u.suspendedAt || null,
          warningCount: u.warningCount || 0,
          lastWarningReason: u.lastWarningReason || null,
          lastWarningAt: u.lastWarningAt || null,
          createdAt: u.createdAt
        };
      })
    );
    return res.json({ companions });
  } catch (error) {
    console.error("Failed to list companions.", error);
    return res.status(503).json({ error: "Companion listing is temporarily unavailable." });
  }
});
app.get("/api/admin/reports", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN", "SUPPORT_ADMIN", "AUDITOR"), async (req, res) => {
  try {
    const reports = await databaseAdapter.listIncidentReports();
    return res.json({ reports });
  } catch (error) {
    console.error("Failed to list incident reports:", error);
    return res.status(503).json({ error: "Incident reports are temporarily unavailable." });
  }
});
app.post("/api/admin/reports/:reportId/dismiss", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  const { reportId } = req.params;
  const admin = req.adminUser;
  const { notes } = req.body || {};
  try {
    const updated = await databaseAdapter.updateIncidentReport(reportId, {
      status: "DISMISSED",
      resolutionNotes: notes || "Dismissed by administrator after review.",
      resolvedAt: (/* @__PURE__ */ new Date()).toISOString(),
      resolvedByAdminId: admin?.id
    });
    await databaseAdapter.createAuditLog({
      adminUserId: admin?.id,
      action: "INCIDENT_REPORT_DISMISSED",
      entityType: "incident_report",
      entityId: reportId,
      details: `Incident report dismissed by admin ${admin?.name || admin?.email}`
    }).catch(() => null);
    return res.json({ success: true, report: updated });
  } catch (error) {
    console.error("Failed to dismiss incident report:", error);
    return res.status(500).json({ error: "Could not dismiss incident report." });
  }
});
app.post("/api/admin/users/:userId/moderation", requireAdminRoles("SUPER_ADMIN", "KYC_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  const { userId } = req.params;
  const admin = req.adminUser;
  const { action, reason, reportId } = req.body || {};
  if (!["WARN", "SUSPEND", "UNSUSPEND"].includes(action)) {
    return res.status(400).json({ error: "Invalid moderation action. Must be WARN, SUSPEND, or UNSUSPEND." });
  }
  if (action !== "UNSUSPEND" && (!reason || typeof reason !== "string" || reason.trim().length < 3)) {
    return res.status(400).json({ error: "A specific reason is required for moderation action." });
  }
  try {
    const user = await databaseAdapter.getUser(userId) || db2.users?.[userId];
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }
    const cleanReason = (reason || "").trim();
    let updates = {};
    if (action === "WARN") {
      const currentWarnings = Number(user.warningCount || 0);
      updates = {
        warningCount: currentWarnings + 1,
        lastWarningReason: cleanReason,
        lastWarningAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await databaseAdapter.createNotification({
        userId,
        type: "ACCOUNT_WARNING",
        title: "\u26A0\uFE0F Account Warning Received",
        body: `Administrative Warning: ${cleanReason}. Continued policy violations may result in account suspension.`
      }).catch(() => null);
      if (reportId) {
        await databaseAdapter.updateIncidentReport(reportId, {
          status: "WARNED",
          resolutionNotes: `Warning issued by admin ${admin?.name || admin?.email}: ${cleanReason}`,
          resolvedAt: (/* @__PURE__ */ new Date()).toISOString(),
          resolvedByAdminId: admin?.id
        }).catch(() => null);
      }
    } else if (action === "SUSPEND") {
      updates = {
        isSuspended: true,
        suspendedReason: cleanReason,
        suspendedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await databaseAdapter.updateCompanionProfile(userId, {
        isLive: false,
        isPaused: true
      }).catch(() => null);
      await databaseAdapter.createNotification({
        userId,
        type: "ACCOUNT_SUSPENDED",
        title: "\u{1F6AB} Account Suspended",
        body: `Your account has been suspended: ${cleanReason}. Booking privileges and companion visibility are revoked. Contact support for assistance.`
      }).catch(() => null);
      if (reportId) {
        await databaseAdapter.updateIncidentReport(reportId, {
          status: "SUSPENDED",
          resolutionNotes: `Account suspended by admin ${admin?.name || admin?.email}: ${cleanReason}`,
          resolvedAt: (/* @__PURE__ */ new Date()).toISOString(),
          resolvedByAdminId: admin?.id
        }).catch(() => null);
      }
    } else if (action === "UNSUSPEND") {
      updates = {
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null
      };
      await databaseAdapter.createNotification({
        userId,
        type: "ACCOUNT_UNSUSPENDED",
        title: "\u2705 Account Restored",
        body: "Your account suspension has been lifted. You can now resume normal platform activities."
      }).catch(() => null);
    }
    const updatedUser = await databaseAdapter.updateUser(userId, updates);
    if (db2.users && db2.users[userId]) {
      db2.users[userId] = { ...db2.users[userId], ...updates };
      saveDB(db2);
    }
    await databaseAdapter.createAuditLog({
      adminUserId: admin?.id,
      action: `USER_${action}`,
      entityType: "user",
      entityId: userId,
      details: `${action} applied to user ${user.legalName || user.phone} by admin ${admin?.name || admin?.email}. Reason: ${cleanReason || "Restored"}`
    }).catch(() => null);
    return res.json({ success: true, action, user: publicAuthUser(updatedUser || { ...user, ...updates }) });
  } catch (error) {
    console.error("Failed to apply user moderation action:", error);
    return res.status(500).json({ error: "Could not apply moderation action." });
  }
});
app.get("/api/admin/memberships", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN", "AUDITOR"), async (req, res) => {
  try {
    const rawMemberships = await databaseAdapter.listMemberships();
    const users = await databaseAdapter.listUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    const memberships = rawMemberships.filter((m) => m.paymentStatus === "PAID").map((m) => {
      const user = userMap.get(m.userId);
      return {
        id: m.id || m.paymentId || `mem_${m.userId}`,
        userId: m.userId,
        userName: user?.legalName || "Companion Host",
        userPhone: user?.phone,
        plan: m.plan,
        pricePaise: m.pricePaise,
        startDate: m.startDate,
        expiryDate: m.expiryDate,
        isActive: m.paymentStatus === "PAID" && new Date(m.expiryDate) > /* @__PURE__ */ new Date()
      };
    });
    return res.json({ memberships });
  } catch (error) {
    console.error("Failed to list memberships.", error);
    return res.status(503).json({ error: "Membership records are temporarily unavailable." });
  }
});
app.get("/api/admin/bookings", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "AUDITOR"), async (req, res) => {
  try {
    const rawBookings = await databaseAdapter.listBookings();
    const bookings = rawBookings.map((b) => {
      const copy = { ...b };
      delete copy.startOtp;
      delete copy.endOtp;
      delete copy.startOtpHmac;
      delete copy.endOtpHmac;
      delete copy.startOtpEncrypted;
      delete copy.completionOtpEncrypted;
      delete copy.startOtpHash;
      delete copy.completionOtpHash;
      return copy;
    });
    return res.json({ bookings });
  } catch (error) {
    console.error("Failed to list bookings.", error);
    return res.status(503).json({ error: "Booking records are temporarily unavailable." });
  }
});
app.get("/api/admin/payments", requireAdminRoles("SUPER_ADMIN", "FINANCE_ADMIN", "AUDITOR"), async (req, res) => {
  try {
    const payments = [];
    const bookings = await databaseAdapter.listBookings();
    const memberships = await databaseAdapter.listMemberships();
    const users = await databaseAdapter.listUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    for (const b of bookings) {
      if (b.paymentId || b.paymentOrderId) {
        let paymentStatus = b.paymentStatus || "PENDING";
        if (b.paymentId && paymentStatus === "PENDING") paymentStatus = "PAID";
        payments.push({
          id: b.paymentId || b.paymentOrderId,
          type: "BOOKING_ESCROW",
          bookingCode: b.bookingCode,
          payerName: b.clientName,
          recipientName: b.companionName,
          grossAmountPaise: b.bookingAmountPaise,
          adminFeePaise: b.adminPlatformFeePaise,
          companionSharePaise: b.companionNetSharePaise,
          status: paymentStatus,
          createdAt: b.createdAt
        });
      }
    }
    for (const m of memberships) {
      if (m.paymentOrderId || m.paymentId) {
        const user = userMap.get(m.userId);
        let paymentStatus = m.paymentStatus || "PENDING";
        if (m.paymentId && paymentStatus === "PENDING") paymentStatus = "PAID";
        payments.push({
          id: m.paymentId || m.paymentOrderId,
          type: "COMPANION_MEMBERSHIP",
          bookingCode: `MEM-${m.plan}`,
          payerName: user?.legalName || "Companion Host",
          recipientName: "PairUpToday Platform",
          grossAmountPaise: m.pricePaise,
          adminFeePaise: m.pricePaise,
          companionSharePaise: 0,
          status: paymentStatus,
          createdAt: m.createdAt || m.startDate
        });
      }
    }
    payments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return res.json({ payments });
  } catch (error) {
    console.error("Failed to list payment records.", error);
    return res.status(503).json({ error: "Payment records are temporarily unavailable." });
  }
});
app.post("/api/companion/availability/toggle", async (req, res) => {
  const userId = req.authUser.id;
  if (req.body.userId && req.body.userId !== userId) return res.status(403).json({ error: "You cannot change another user\u2019s availability." });
  if (typeof req.body.isPaused !== "boolean") return res.status(400).json({ error: "isPaused must be a boolean." });
  if (req.body.isPaused) {
    try {
      const activeBookings = getDatabaseType() === "supabase" ? await databaseAdapter.listBookings({ companionId: userId }) : Object.values(db2.bookings).filter((b) => b.companionId === userId);
      const hasActive = activeBookings.some(
        (b) => ["PENDING", "CONFIRMED", "COMPANION_ARRIVED", "IN_PROGRESS"].includes(b.status)
      );
      if (hasActive) {
        return res.status(409).json({ error: "You have active bookings in progress. You cannot go offline until they are completed or cancelled." });
      }
    } catch (e) {
      console.warn("Active booking check warning:", e);
    }
  }
  if (getDatabaseType() === "json") {
    const profile = db2.companionProfiles[userId];
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    const user = db2.users[userId];
    const isEligible = Boolean(
      (user?.kycStatus === "APPROVED" || user?.kyc_status === "APPROVED") && profile.membership?.isActive && new Date(profile.membership.expiryDate) > /* @__PURE__ */ new Date() && profile.bankDetails?.isVerified
    );
    if (!req.body.isPaused) {
      if (!isEligible) return res.status(403).json({ error: "Approved KYC, an active paid membership, and verified bank details are required to resume." });
    }
    profile.isPaused = req.body.isPaused;
    profile.isLive = !req.body.isPaused && isEligible;
    saveDB(db2);
    return res.json({ success: true, isPaused: profile.isPaused, isLive: profile.isLive });
  }
  try {
    const profile = await databaseAdapter.getCompanionProfile(userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    let isEligible = false;
    if (!req.body.isPaused) {
      const [userRecord, companionKyc, clientKyc, membership, bankVerification] = await Promise.all([
        databaseAdapter.getUser(userId),
        databaseAdapter.getUserKycSubmission(userId, "COMPANION"),
        databaseAdapter.getUserKycSubmission(userId, "CLIENT").catch(() => null),
        databaseAdapter.getActiveMembership(userId),
        databaseAdapter.getBankVerification(userId)
      ]);
      const effectiveKyc = companionKyc || (clientKyc?.status === "APPROVED" ? clientKyc : null);
      const kycApproved = Boolean(effectiveKyc?.status === "APPROVED" || userRecord?.kycStatus === "APPROVED" || userRecord?.kyc_status === "APPROVED");
      isEligible = Boolean(
        kycApproved && membership?.paymentStatus === "PAID" && new Date(membership.expiryDate) > /* @__PURE__ */ new Date() && (bankVerification?.verificationStatus === "VERIFIED" || bankVerification?.isVerified === true)
      );
      if (!isEligible) return res.status(403).json({ error: "Approved KYC, an active paid membership, and verified bank details are required to resume." });
    }
    const isLive = !req.body.isPaused && isEligible;
    const updated = await databaseAdapter.updateCompanionProfile(userId, {
      isPaused: req.body.isPaused,
      isLive
    });
    if (db2.companionProfiles && db2.companionProfiles[userId]) {
      db2.companionProfiles[userId].isPaused = req.body.isPaused;
      db2.companionProfiles[userId].isLive = isLive;
    }
    return res.json({ success: true, isPaused: updated.isPaused, isLive });
  } catch (error) {
    console.error("Companion availability could not be updated.", error);
    return res.status(503).json({ error: "Availability is temporarily unavailable." });
  }
});
app.get("/api/notifications/:userId", async (req, res) => {
  const userId = req.authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: "You cannot access another user\u2019s notifications." });
  try {
    const notifications = await databaseAdapter.listNotifications(userId);
    return res.json({ notifications: notifications.map((item) => ({
      ...item,
      message: item.body || item.message,
      timestamp: item.createdAt || item.created_at
    })) });
  } catch (error) {
    console.error("Notifications could not be loaded.", error);
    return res.status(503).json({ error: "Notifications are temporarily unavailable." });
  }
});
app.post("/api/notifications/read", async (req, res) => {
  const userId = req.authUser.id;
  const notificationId = req.body?.notificationId;
  if (typeof notificationId !== "string" || !notificationId) {
    return res.status(400).json({ error: "notificationId is required." });
  }
  try {
    await databaseAdapter.markNotificationRead(notificationId, userId);
    return res.json({ success: true });
  } catch (error) {
    console.error("Notification read state could not be updated.", error);
    return res.status(503).json({ error: "Notification state is temporarily unavailable." });
  }
});
app.post("/api/notifications/device-token", async (req, res) => {
  const userId = req.authUser.id;
  const { token, platform } = req.body || {};
  if (typeof token !== "string" || token.length < 20 || token.length > 4096 || !["WEB", "ANDROID", "IOS"].includes(platform)) {
    return res.status(400).json({ error: "A valid device token and platform are required." });
  }
  try {
    await databaseAdapter.registerDeviceToken(userId, token, platform);
    return res.json({ success: true });
  } catch (error) {
    console.error("Push notification device token could not be registered.", error);
    return res.status(503).json({ error: "Device token registration is temporarily unavailable." });
  }
});
app.delete("/api/notifications/device-token", async (req, res) => {
  const userId = req.authUser.id;
  const token = req.body?.token;
  if (typeof token !== "string" || !token) return res.status(400).json({ error: "A device token is required." });
  try {
    const userTokens = await databaseAdapter.listDeviceTokens(userId);
    if (!userTokens.includes(token)) return res.status(404).json({ error: "Device token not found." });
    await databaseAdapter.deleteDeviceToken(token, userId);
    return res.json({ success: true });
  } catch (error) {
    console.error("Push notification device token could not be removed.", error);
    return res.status(503).json({ error: "Device token removal is temporarily unavailable." });
  }
});
function startSupportMessageStream(req, res, conversationId) {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders();
  res.write("event: ready\ndata: {}\n\n");
  const afterTimeQuery = typeof req.query.afterCreatedAt === "string" ? req.query.afterCreatedAt : void 0;
  const afterIdQuery = typeof req.query.afterId === "string" ? req.query.afterId : void 0;
  let after = afterTimeQuery && afterIdQuery && Number.isFinite(Date.parse(afterTimeQuery)) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(afterIdQuery) ? { createdAt: new Date(afterTimeQuery).toISOString(), id: afterIdQuery } : void 0;
  let reading = false;
  const interval = setInterval(async () => {
    if (reading || res.writableEnded) return;
    reading = true;
    try {
      const messages = await databaseAdapter.listSupportMessages(conversationId, after);
      for (const message of messages) {
        const timestamp = message.created_at || message.createdAt;
        const id = message.id;
        if (typeof id !== "string") continue;
        after = { createdAt: timestamp, id };
        res.write(`event: message
data: ${JSON.stringify({
          ...message,
          timestamp,
          cursor: after
        })}

`);
      }
    } catch (error) {
      console.error("Realtime support polling failed.", error);
      res.write('event: error\ndata: {"error":"Support stream is temporarily unavailable."}\n\n');
      res.end();
      clearInterval(interval);
    } finally {
      reading = false;
    }
  }, 2e3);
  req.on("close", () => clearInterval(interval));
}
app.post("/api/support/conversation", async (req, res) => {
  const userId = req.authUser.id;
  const subject = req.body?.subject;
  if (subject !== void 0 && (typeof subject !== "string" || subject.length > 200)) {
    return res.status(400).json({ error: "Subject must be no more than 200 characters." });
  }
  try {
    const user = await databaseAdapter.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const existing = (await databaseAdapter.listSupportConversations({ userId })).find((conversation2) => conversation2.status === "OPEN" || conversation2.status === "IN_PROGRESS");
    if (existing) return res.json({ conversation: existing });
    const conversation = await databaseAdapter.createSupportConversation({
      userId,
      status: "OPEN",
      subject: subject || "General Inquiry"
    });
    return res.json({ conversation });
  } catch (error) {
    console.error("Support conversation could not be created.", error);
    return res.status(503).json({ error: "Support is temporarily unavailable." });
  }
});
app.get("/api/support/conversations/:userId", async (req, res) => {
  const userId = req.authUser.id;
  if (req.params.userId !== userId) return res.status(403).json({ error: "You cannot access another user\u2019s support conversations." });
  try {
    return res.json({ conversations: await databaseAdapter.listSupportConversations({ userId }) });
  } catch (error) {
    console.error("Support conversations could not be loaded.", error);
    return res.status(503).json({ error: "Support is temporarily unavailable." });
  }
});
app.get("/api/support/messages/:conversationId", async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.authUser.id;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    if (conversation.userId !== userId) return res.status(403).json({ error: "You cannot access this conversation." });
    return res.json({ messages: await databaseAdapter.listSupportMessages(conversationId) });
  } catch (error) {
    console.error("Support messages could not be loaded.", error);
    return res.status(503).json({ error: "Support is temporarily unavailable." });
  }
});
app.get("/api/support/messages/:conversationId/stream", async (req, res) => {
  const conversationId = req.params.conversationId;
  const userId = req.authUser.id;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    if (conversation.userId !== userId) return res.status(403).json({ error: "You cannot access this conversation." });
    startSupportMessageStream(req, res, conversationId);
  } catch (error) {
    console.error("Realtime support stream could not be started.", error);
    return res.status(503).json({ error: "Support is temporarily unavailable." });
  }
});
app.post("/api/support/message", async (req, res) => {
  const { conversationId, message } = req.body || {};
  const userId = req.authUser.id;
  if (typeof conversationId !== "string" || typeof message !== "string" || !message.trim() || message.length > 5e3) {
    return res.status(400).json({ error: "A conversation ID and message between 1 and 5000 characters are required." });
  }
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== userId) return res.status(403).json({ error: "You cannot access this conversation." });
    if (!["OPEN", "IN_PROGRESS"].includes(conversation.status)) {
      return res.status(409).json({ error: "This support conversation is closed." });
    }
    const stored = await databaseAdapter.createSupportMessage({
      conversationId,
      senderId: userId,
      isAdmin: false,
      message: message.trim()
    });
    await databaseAdapter.updateSupportConversation(conversationId, {});
    return res.json({ message: stored });
  } catch (error) {
    console.error("Support message could not be saved.", error);
    return res.status(503).json({ error: "Support is temporarily unavailable." });
  }
});
app.get("/api/admin/support/conversations", requireAdminRoles("SUPER_ADMIN", "SUPPORT_ADMIN"), async (_req, res) => {
  try {
    return res.json({ conversations: await databaseAdapter.listSupportConversations() });
  } catch (error) {
    console.error("Admin support conversations could not be loaded.", error);
    return res.status(503).json({ error: "Support administration is temporarily unavailable." });
  }
});
app.get("/api/admin/support/messages/:conversationId", requireAdminRoles("SUPER_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  const { conversationId } = req.params;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    return res.json({ messages: await databaseAdapter.listSupportMessages(conversationId) });
  } catch (error) {
    console.error("Admin support messages could not be loaded.", error);
    return res.status(503).json({ error: "Support administration is temporarily unavailable." });
  }
});
app.get("/api/admin/support/messages/:conversationId/stream", requireAdminRoles("SUPER_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  const conversationId = req.params.conversationId;
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found." });
    startSupportMessageStream(req, res, conversationId);
  } catch (error) {
    console.error("Admin realtime support stream could not be started.", error);
    return res.status(503).json({ error: "Support administration is temporarily unavailable." });
  }
});
app.post("/api/admin/support/reply", requireAdminRoles("SUPER_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  const { conversationId, message } = req.body || {};
  const adminUser = req.adminUser;
  if (typeof conversationId !== "string" || typeof message !== "string" || !message.trim() || message.length > 5e3) {
    return res.status(400).json({ error: "A conversation ID and message between 1 and 5000 characters are required." });
  }
  try {
    const conversation = await databaseAdapter.getSupportConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const stored = await databaseAdapter.createSupportMessage({
      conversationId,
      senderId: adminUser.id,
      adminUserId: adminUser.id,
      isAdmin: true,
      message: message.trim()
    });
    await databaseAdapter.updateSupportConversation(conversationId, {
      status: "IN_PROGRESS",
      assignedAdminId: adminUser.id
    });
    await databaseAdapter.createAuditLog({
      adminUserId: adminUser.id,
      action: "SUPPORT_REPLY",
      entityType: "support_conversation",
      entityId: conversationId,
      details: { messageLength: message.length }
    });
    try {
      await createAndSendNotification({
        userId: conversation.userId,
        type: "SUPPORT_REPLY",
        title: "Support replied to your message",
        body: message.trim().slice(0, 500),
        data: { conversationId }
      });
    } catch (notificationError) {
      console.error("Support reply was saved but its notification could not be persisted.", notificationError);
    }
    return res.json({ message: stored });
  } catch (error) {
    console.error("Admin support reply could not be saved.", error);
    return res.status(503).json({ error: "Support administration is temporarily unavailable." });
  }
});
app.post("/api/admin/support/conversation/:id/status", requireAdminRoles("SUPER_ADMIN", "SUPPORT_ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const adminUser = req.adminUser;
  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
    return res.status(400).json({ error: "Invalid support conversation status." });
  }
  try {
    const current = await databaseAdapter.getSupportConversation(id);
    if (!current) return res.status(404).json({ error: "Conversation not found" });
    const conversation = await databaseAdapter.updateSupportConversation(id, {
      status,
      ...["RESOLVED", "CLOSED"].includes(status) ? { assignedAdminId: adminUser.id } : {}
    });
    await databaseAdapter.createAuditLog({
      adminUserId: adminUser.id,
      action: "SUPPORT_STATUS_UPDATED",
      entityType: "support_conversation",
      entityId: id,
      details: { status }
    });
    return res.json({ conversation });
  } catch (error) {
    console.error("Support conversation status could not be updated.", error);
    return res.status(503).json({ error: "Support administration is temporarily unavailable." });
  }
});
var inMemoryLiveLocations = /* @__PURE__ */ new Map();
app.post("/api/location/update", async (req, res) => {
  const userId = req.authUser.id;
  const { latitude, longitude, bookingId } = req.body || {};
  if (typeof bookingId !== "string" || typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "A booking ID and valid coordinates are required." });
  }
  const locRecord = {
    latitude,
    longitude,
    accuracy: Number(req.body?.accuracy) || 5,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  inMemoryLiveLocations.set(`${bookingId}_${userId}`, locRecord);
  inMemoryLiveLocations.set(userId, locRecord);
  if (isFirebaseConfigured()) {
    try {
      await updateUserLocation(userId, latitude, longitude, bookingId);
    } catch (fbErr) {
      console.warn("Firebase location update notice:", fbErr);
    }
  }
  return res.json({ success: true, location: locRecord, provider: isFirebaseConfigured() ? "firebase" : "memory" });
});
app.get("/api/location/:userId", async (req, res) => {
  const { userId } = req.params;
  const requestingUserId = req.authUser.id;
  const bookingId = req.query.bookingId;
  if (typeof bookingId !== "string") return res.status(400).json({ error: "bookingId is required." });
  try {
    let booking = null;
    try {
      booking = getDatabaseType() === "supabase" ? await databaseAdapter.getBooking(bookingId) : db2.bookings ? db2.bookings[bookingId] : null;
    } catch {
      booking = db2.bookings ? db2.bookings[bookingId] : null;
    }
    if (booking && requestingUserId === booking.clientId && userId === booking.companionId) {
      if (!["COMPANION_ARRIVED", "IN_PROGRESS"].includes(booking.status)) {
        const slotStartMs = (/* @__PURE__ */ new Date(`${booking.date}T${booking.startTime}:00`)).getTime();
        const thirtyMinsBefore = slotStartMs - 30 * 60 * 1e3;
        if (Date.now() < thirtyMinsBefore) {
          return res.status(403).json({
            error: "Companion live location is protected. Tracking unlocks 30 minutes before your scheduled meeting.",
            privacyProtected: true,
            unlocksAt: new Date(thirtyMinsBefore).toISOString(),
            scheduledStartTime: new Date(slotStartMs).toISOString()
          });
        }
      }
    }
    const memLoc = inMemoryLiveLocations.get(`${bookingId}_${userId}`) || inMemoryLiveLocations.get(userId);
    if (memLoc) {
      return res.json({ location: memLoc, provider: "live-gps" });
    }
    if (isFirebaseConfigured()) {
      try {
        const location = await getUserLocation(userId, bookingId);
        if (location) {
          return res.json({
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy || 5,
              timestamp: location.timestamp || (/* @__PURE__ */ new Date()).toISOString()
            },
            provider: "firebase"
          });
        }
      } catch (fbErr) {
        console.warn("Firebase location fetch notice:", fbErr);
      }
    }
    const fallbackCoord = KNOWN_CITY_COORDINATES["kolkata"] || { lat: 22.5726, lng: 88.3639 };
    return res.json({
      location: {
        latitude: fallbackCoord.lat + 85e-4,
        // ~1 km offset representing approaching companion
        longitude: fallbackCoord.lng + 75e-4,
        accuracy: 10,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      provider: "estimated"
    });
  } catch (error) {
    console.warn("Booking location fallback used:", error);
    const fallbackCoord = KNOWN_CITY_COORDINATES["kolkata"] || { lat: 22.5726, lng: 88.3639 };
    return res.json({
      location: {
        latitude: fallbackCoord.lat + 8e-3,
        longitude: fallbackCoord.lng + 7e-3,
        accuracy: 15,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      provider: "fallback"
    });
  }
});
app.post("/api/location/sharing/start", async (req, res) => {
  const userId = req.authUser.id;
  const bookingId = req.body?.bookingId;
  if (typeof bookingId !== "string") return res.status(400).json({ error: "bookingId is required." });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: "Booking location service is not configured." });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (!["CONFIRMED", "COMPANION_ARRIVED", "IN_PROGRESS"].includes(booking.status) || booking.clientId !== userId && booking.companionId !== userId) {
      return res.status(403).json({ error: "Location sharing requires an active booking participant." });
    }
    await startLocationSharing(userId, bookingId);
    try {
      await databaseAdapter.setBookingLocationSharing(bookingId, userId, true);
    } catch (error) {
      await stopLocationSharing(userId, bookingId);
      throw error;
    }
    return res.json({ success: true, provider: "firebase" });
  } catch (error) {
    console.error("Booking location sharing could not be started.", error);
    return res.status(503).json({ error: "Booking location sharing is temporarily unavailable." });
  }
});
app.post("/api/location/sharing/stop", async (req, res) => {
  const userId = req.authUser.id;
  const bookingId = req.body?.bookingId;
  if (typeof bookingId !== "string") return res.status(400).json({ error: "bookingId is required." });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: "Booking location service is not configured." });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.clientId !== userId && booking.companionId !== userId) {
      return res.status(403).json({ error: "Location sharing requires a booking participant." });
    }
    await databaseAdapter.setBookingLocationSharing(bookingId, userId, false);
    await stopLocationSharing(userId, bookingId);
    return res.json({ success: true, provider: "firebase" });
  } catch (error) {
    console.error("Booking location sharing could not be stopped.", error);
    return res.status(503).json({ error: "Booking location sharing is temporarily unavailable." });
  }
});
app.post("/api/presence", async (req, res) => {
  const userId = req.authUser.id;
  const { online } = req.body || {};
  if (typeof online !== "boolean") return res.status(400).json({ error: "online must be a boolean." });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: "Presence service is not configured." });
  try {
    await setUserPresence(userId, online);
    return res.json({ success: true, provider: "firebase" });
  } catch (error) {
    console.error("Presence could not be updated.", error);
    return res.status(503).json({ error: "Presence is temporarily unavailable." });
  }
});
app.get("/api/presence/:userId", async (req, res) => {
  const { userId } = req.params;
  const requestingUserId = req.authUser.id;
  const bookingId = req.query.bookingId;
  if (typeof bookingId !== "string") return res.status(400).json({ error: "bookingId is required." });
  if (!isFirebaseConfigured()) return res.status(503).json({ error: "Presence service is not configured." });
  try {
    const booking = await databaseAdapter.getBooking(bookingId);
    const participants = booking ? [booking.clientId, booking.companionId] : [];
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (!["CONFIRMED", "COMPANION_ARRIVED", "IN_PROGRESS"].includes(booking.status) || !participants.includes(requestingUserId) || !participants.includes(userId) || !await databaseAdapter.getBookingLocationSharing(bookingId, userId)) {
      return res.status(403).json({ error: "Presence access requires an active booking with enabled location sharing." });
    }
    const presence = await getUserPresence(userId);
    return res.json({ presence: presence || { online: false, lastSeen: null }, provider: "firebase" });
  } catch (error) {
    console.error("Presence could not be loaded.", error);
    return res.status(503).json({ error: "Presence is temporarily unavailable." });
  }
});
app.get("/api/maps/autocomplete", async (req, res) => {
  const { input, lat, lng, radius } = req.query;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "Input query is required" });
  }
  const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : void 0;
  const radiusKm = radius ? parseInt(radius) : void 0;
  try {
    const predictions = await getPlaceAutocomplete(input, location, radiusKm);
    return res.json({ predictions });
  } catch (error) {
    console.error("Maps autocomplete request failed:", error);
    return res.json({ predictions: [] });
  }
});
app.get("/api/maps/geocode", async (req, res) => {
  const { address, place_id } = req.query;
  if (!address && !place_id) {
    return res.status(400).json({ error: "Address or place_id is required" });
  }
  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({
      error: "Google Maps API not configured"
    });
  }
  let result;
  try {
    result = await geocodeAddress(address || place_id, !!place_id);
  } catch (error) {
    console.error("Maps geocoding request failed.", error);
    return res.status(502).json({ error: "Geocoding is temporarily unavailable." });
  }
  if (result) {
    return res.json({
      place_id: result.place_id,
      formatted_address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address_components: result.address_components
    });
  } else {
    return res.status(404).json({ error: "Geocoding failed" });
  }
});
app.get("/api/maps/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Latitude and longitude are required" });
  }
  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({
      error: "Google Maps API not configured"
    });
  }
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return res.status(400).json({ error: "Coordinates are invalid." });
  }
  let result;
  try {
    result = await reverseGeocode(parsedLat, parsedLng);
  } catch (error) {
    console.error("Maps reverse geocoding request failed.", error);
    return res.status(502).json({ error: "Reverse geocoding is temporarily unavailable." });
  }
  if (result) {
    return res.json({
      formatted_address: result.formatted_address,
      address_components: result.address_components
    });
  } else {
    return res.status(404).json({ error: "Reverse geocoding failed" });
  }
});
app.get("/api/maps/distance", async (req, res) => {
  const { lat1, lng1, lat2, lng2 } = req.query;
  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return res.status(400).json({ error: "All coordinates are required" });
  }
  if (!isGoogleMapsConfigured()) {
    return res.status(503).json({ error: "Google Maps API is not configured." });
  }
  const origin = { lat: parseFloat(lat1), lng: parseFloat(lng1) };
  const destination = { lat: parseFloat(lat2), lng: parseFloat(lng2) };
  if (![origin.lat, origin.lng, destination.lat, destination.lng].every(Number.isFinite) || origin.lat < -90 || origin.lat > 90 || destination.lat < -90 || destination.lat > 90 || origin.lng < -180 || origin.lng > 180 || destination.lng < -180 || destination.lng > 180) {
    return res.status(400).json({ error: "Coordinates are invalid." });
  }
  try {
    const matrix = await getDistanceMatrix([origin], [destination]);
    const result = matrix?.[0]?.[0];
    if (!result || result.status !== "OK") {
      return res.status(422).json({ error: "Google Maps could not calculate a route for these locations." });
    }
    return res.json({
      distanceKm: result.distance.value / 1e3,
      distance: result.distance.text,
      durationSeconds: result.duration.value,
      duration: result.duration.text
    });
  } catch (error) {
    console.error("Maps distance request failed.", error);
    return res.status(502).json({ error: "Distance calculation is temporarily unavailable." });
  }
});
app.get("/health", (req, res) => {
  const dbType = getDatabaseType();
  const firebaseReady = isFirebaseConfigured();
  const googleMapsReady = isGoogleMapsConfigured();
  res.json({
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: {
      type: dbType,
      configured: dbType === "supabase"
    },
    integrations: {
      firebase: firebaseReady,
      googleMaps: googleMapsReady,
      apitxt: !!process.env.APITXT_API_KEY,
      razorpay: !!process.env.RAZORPAY_KEY_ID
    }
  });
});
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const distDir = path2.join(__dirname2, "dist");
  const distAdminDir = path2.join(__dirname2, "dist-admin");
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    const isAdminHost = host.startsWith("admin.") || host.includes("admin") || req.headers["x-admin-host"] === "true";
    if (isAdminHost && req.path === "/") {
      if (isProduction && fs2.existsSync(distAdminDir)) {
        return res.sendFile(path2.join(distAdminDir, "admin.html"));
      }
      if (isProduction && fs2.existsSync(path2.join(distDir, "admin.html"))) {
        return res.sendFile(path2.join(distDir, "admin.html"));
      }
      return res.sendFile(path2.join(__dirname2, "admin.html"));
    }
    if (req.path === "/admin" || req.path === "/admin.html") {
      if (isProduction && fs2.existsSync(distAdminDir)) {
        return res.sendFile(path2.join(distAdminDir, "admin.html"));
      }
      if (isProduction && fs2.existsSync(path2.join(distDir, "admin.html"))) {
        return res.sendFile(path2.join(distDir, "admin.html"));
      }
      return res.sendFile(path2.join(__dirname2, "admin.html"));
    }
    next();
  });
  if (isProduction && fs2.existsSync(distDir)) {
    app.get("/sw.js", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Content-Type", "application/javascript");
      const swPath = fs2.existsSync(path2.join(distDir, "sw.js")) ? path2.join(distDir, "sw.js") : path2.join(__dirname2, "public", "sw.js");
      res.sendFile(swPath);
    });
    if (fs2.existsSync(distAdminDir)) {
      app.use("/assets", express.static(path2.join(distAdminDir, "assets"), { fallthrough: true }));
    }
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      const host = req.headers.host || "";
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      if (host.startsWith("admin.") && fs2.existsSync(distAdminDir)) {
        return res.sendFile(path2.join(distAdminDir, "admin.html"));
      }
      res.sendFile(path2.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PairUpToday Monolithic Engine running at http://0.0.0.0:${PORT}`);
    console.log(`  - Website: https://pairuptoday.com (or http://localhost:${PORT})`);
    console.log(`  - Separate Admin Vault: https://admin.pairuptoday.com (or http://localhost:${PORT}/admin.html)`);
  });
}
startServer();
