import crypto from 'crypto';

export interface ApitxtOtpResponse {
  success: boolean;
  requestId?: string;
  mobile?: string;
  cost?: number;
  message?: string;
  error?: string;
  errorCode?: number | string;
  isSimulated?: boolean;
}

export interface ApitxtBankResponse {
  success: boolean;
  requestId?: string;
  accountExists?: boolean;
  nameAtBank?: string;
  ifsc?: string;
  accountNumber?: string;
  method?: string;
  nameMatched?: boolean;
  message?: string;
  error?: string;
  errorCode?: number;
  isSimulated?: boolean;
}

export function isApitxtConfigured(): boolean {
  const apiKey = process.env.APITXT_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_APITXT_API_KEY');
}

/**
 * Normalizes Indian phone number to 91XXXXXXXXXX (for APITXT API parameter)
 */
export function formatPhoneForApitxt(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return digits;
  }
  return null;
}

/**
 * Name comparison algorithm between KYC legal name and name returned by bank
 */
export function compareLegalAndBankNames(kycName: string, bankName: string): boolean {
  if (!kycName || !bankName) return false;

  const clean = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const kycTokens = clean(kycName);
  const bankTokens = clean(bankName);

  if (kycTokens.length === 0 || bankTokens.length === 0) return false;

  // Exact match
  if (kycTokens.join(' ') === bankTokens.join(' ')) return true;

  // Check token intersection
  const matchedTokens = kycTokens.filter(t => bankTokens.includes(t));
  const minTokens = Math.min(kycTokens.length, bankTokens.length);

  // If at least one major token matches (e.g. first name or last name)
  return matchedTokens.length >= Math.max(1, Math.floor(minTokens * 0.6));
}

/**
 * Sends real SMS OTP via APITXT
 * Critical: template_id MUST BE OMITTED per APITXT specification.
 */
export async function sendApitxtOtp(params: {
  mobile: string;
  otp: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<ApitxtOtpResponse> {
  const apiKey = (params.apiKey || process.env.APITXT_API_KEY || '').trim();
  const baseUrl = params.baseUrl || process.env.APITXT_BASE_URL || 'https://apitxt.com';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/sendOTP`;

  const formattedMobile = formatPhoneForApitxt(params.mobile);
  if (!formattedMobile) {
    return {
      success: false,
      error: 'Invalid 10-digit Indian mobile number.'
    };
  }

  // If no live API key configured in environment, fail explicitly - do NOT simulate delivery
  if (!apiKey || apiKey === 'MY_APITXT_API_KEY') {
    return {
      success: false,
      error: 'APITXT SMS service configuration unavailable. APITXT_API_KEY is not configured in the server environment.',
      errorCode: 'CONFIG_MISSING'
    };
  }

  // Construct application/x-www-form-urlencoded body with template_id strictly OMITTED
  const bodyParams = new URLSearchParams();
  bodyParams.append('authkey', apiKey);
  bodyParams.append('mobile', formattedMobile);
  bodyParams.append('otp', params.otp.trim());
  bodyParams.append('channel', 'sms');
  bodyParams.append('country', '91');
  // CRITICAL: template_id MUST BE OMITTED - DO NOT APPEND template_id!

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PairUpToday-Backend/1.0'
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(15_000)
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `APITXT returned a non-JSON response (HTTP ${response.status}).`,
        errorCode: response.status
      };
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        success: false,
        error: `APITXT returned an invalid response (HTTP ${response.status}).`,
        errorCode: response.status
      };
    }

    if (response.ok && (data.status === 'success' || data.status === 200)) {
      return {
        success: true,
        requestId: typeof data.data?.request_id === 'string' ? data.data.request_id : undefined,
        mobile: data.data?.mobile || formattedMobile,
        cost: data.data?.cost,
        message: typeof data.message === 'string' ? data.message : undefined
      };
    }

    // Provider error response
    return {
      success: false,
      error: 'APITXT did not accept the OTP request.',
      errorCode: data.code || data.status
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.name === 'TimeoutError'
        ? 'APITXT request timed out.'
        : 'Network connection to APITXT gateway failed.'
    };
  }
}

/**
 * Penny-less bank account verification through APITXT
 */
export async function verifyApitxtBankAccount(params: {
  ifsc: string;
  accountNumber: string;
  accountHolderName: string;
  mobile: string;
  kycLegalName?: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<ApitxtBankResponse> {
  const apiKey = params.apiKey || process.env.APITXT_API_KEY;
  const baseUrl = params.baseUrl || process.env.APITXT_BASE_URL || 'https://apitxt.com';

  const cleanIfsc = (params.ifsc || '').trim().toUpperCase();
  const cleanAccount = (params.accountNumber || '').trim();
  const cleanMobile = (params.mobile || '').replace(/\D/g, '').slice(-10);

  // Validate format
  if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6,7}$/.test(cleanIfsc)) {
    return {
      success: false,
      errorCode: 208,
      error: 'Invalid IFSC code format (e.g. HDFC0001234).'
    };
  }

  if (!cleanAccount || cleanAccount.length < 6 || cleanAccount.length > 40 || !/^[A-Za-z0-9\-]+$/.test(cleanAccount)) {
    return {
      success: false,
      errorCode: 210,
      error: 'Invalid bank account number format.'
    };
  }

  if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
    return {
      success: false,
      errorCode: 211,
      error: 'Invalid 10-digit Indian mobile number.'
    };
  }

  // If no live API key configured in environment, fail explicitly - do NOT simulate bank verification
  if (!apiKey || apiKey === 'MY_APITXT_API_KEY' || apiKey.trim() === '') {
    return {
      success: false,
      errorCode: 105,
      error: 'Penny-less bank verification gateway unavailable. APITXT_API_KEY is not configured in the server environment.'
    };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/bank/${encodeURIComponent(cleanIfsc)}/accounts/${encodeURIComponent(cleanAccount)}/penniless-verify`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PairUpToday-Backend/1.0'
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
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        errorCode: 310,
        error: `APITXT returned non-JSON response (HTTP ${response.status}): ${responseText.slice(0, 150)}`
      };
    }

    // Handle documented APITXT error codes
    const code = Number(data.code || data.status);
    if (code === 105) {
      return { success: false, errorCode: 105, error: 'Missing or unauthenticated APITXT API key.' };
    }
    if (code === 109) {
      return { success: false, errorCode: 109, error: 'Missing IFSC code.' };
    }
    if (code === 110) {
      return { success: false, errorCode: 110, error: 'Missing account number.' };
    }
    if (code === 208) {
      return { success: false, errorCode: 208, error: 'Invalid IFSC code supplied to bank gateway.' };
    }
    if (code === 210) {
      return { success: false, errorCode: 210, error: 'Invalid account number supplied.' };
    }
    if (code === 211) {
      return { success: false, errorCode: 211, error: 'Invalid mobile number.' };
    }
    if (code === 212) {
      return { success: false, errorCode: 212, error: 'Bank account not found at the destination branch.' };
    }
    if (code === 213) {
      return { success: false, errorCode: 213, error: 'Bank branch or institution currently not supported for penny-less inquiry.' };
    }
    if (code === 301) {
      return { success: false, errorCode: 301, error: 'Insufficient balance in APITXT wallet.' };
    }
    if (code === 304) {
      return { success: false, errorCode: 304, error: 'APITXT IP restriction or unauthorized key origin.' };
    }
    if (code === 310) {
      return { success: false, errorCode: 310, error: 'Vendor verification failure at banking switch.' };
    }

    // Success validation
    if ((data.status === 200 || data.status === 'success') && data.data) {
      const bankData = data.data;
      if (!bankData.account_exists) {
        return {
          success: false,
          errorCode: 212,
          accountExists: false,
          error: 'Bank account does not exist according to bank verification.'
        };
      }

      const nameAtBank = bankData.name_at_bank || params.accountHolderName;
      let nameMatched = true;

      // Validate against KYC name if provided
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
        method: bankData.method || 'penny_less',
        nameMatched,
        message: 'Bank account verified successfully.'
      };
    }

    return {
      success: false,
      error: data.message || 'Penny-less verification returned negative result from bank.'
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Network error connecting to APITXT bank verification endpoint: ${err.message}`
    };
  }
}
