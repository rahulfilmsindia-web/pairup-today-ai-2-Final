export type Language = 'en' | 'bn' | 'hi';

export type UserRole = 'CLIENT' | 'COMPANION';

export type AdminRole = 'SUPER_ADMIN' | 'KYC_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT_ADMIN' | 'AUDITOR';

export type KYCStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type GovernmentIdType = 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'PASSPORT';

export type MembershipPlanType = 'STARTER' | 'PROFESSIONAL' | 'PREMIUM';

export type BookingStatus = 
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPANION_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface User {
  id: string;
  phone: string;
  legalName?: string;
  profileName?: string;
  email?: string;
  role: 'CLIENT' | 'COMPANION' | 'DUAL';
  activeRole?: 'CLIENT' | 'COMPANION';
  dob?: string; // locked after KYC
  age?: number;
  kycStatus: KYCStatus;
  kycRejectionReason?: string;
  kycSubmittedAt?: string;
  kycDecidedAt?: string;
  kycDecidedBy?: string;
  profilePhoto?: string;
  bio?: string;
  photos?: string[];
  city?: string;
  state?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isSuspended?: boolean;
  suspendedReason?: string;
  suspendedAt?: string;
  warningCount?: number;
  lastWarningReason?: string;
  lastWarningAt?: string;
  createdAt: string;
}

export interface IncidentReport {
  id: string;
  bookingId: string;
  bookingCode?: string;
  reportingUserId: string;
  reportingUserName: string;
  reportingUserPhone?: string;
  reportingUserRole: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserPhone?: string;
  reportedUserRole: string;
  reason: string;
  details: string;
  status: 'PENDING_REVIEW' | 'WARNED' | 'SUSPENDED' | 'DISMISSED' | 'RESOLVED';
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
  createdAt: string;
}

export interface KYCSubmission {
  id: string;
  userId: string;
  userPhone: string;
  legalName: string;
  profileName?: string;
  dob: string;
  idType: GovernmentIdType;
  idFrontUrl: string;
  idBackUrl?: string;
  selfieUrl: string;
  bio?: string;
  photos: string[];
  status: KYCStatus;
  rejectionReason?: string;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  userType: 'CLIENT' | 'COMPANION';
}

export interface CompanionServiceConfig {
  serviceId: number;
  serviceName: string;
  selected: boolean;
}

export interface CompanionRates {
  hourlyPaise: number;
  halfDayPaise: number; // 4 hours
  fullDayPaise: number; // 8 hours
}

export interface CompanionAvailability {
  days: string[]; // ['Monday', 'Tuesday', ...]
  startTime: string; // "09:00"
  endTime: string; // "21:00"
}

export interface BankDetails {
  accountNumber: string;
  accountNumberMasked: string;
  ifsc: string;
  bankName: string;
  accountHolderName: string;
  isVerified: boolean;
  verifiedAt?: string;
}

export interface CompanionMembership {
  plan: MembershipPlanType;
  pricePaise: number;
  startDate: string;
  expiryDate: string;
  paymentId: string;
  isActive: boolean;
}

export interface CompanionProfile {
  userId: string;
  services: number[]; // service IDs
  rates: CompanionRates;
  availability: CompanionAvailability;
  membership?: CompanionMembership;
  bankDetails?: BankDetails;
  isLive: boolean; // KYC=APPROVED && Membership valid && Bank Verified
  rating: number;
  totalBookings: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  isInitialListing?: boolean;
}

export interface CompanionDiscoveryItem {
  id: string;
  name: string;
  age: number;
  city: string;
  state?: string;
  address?: string;
  locationFormatted: string;
  bio?: string;
  profilePhoto: string;
  photos: string[];
  rating: number;
  totalBookings: number;
  services: number[];
  rates: CompanionRates;
  hourlyRate?: number;
  hourlyRateFormatted?: string;
  availability?: CompanionAvailability | null;
  isInitialListing?: boolean;
  distanceKm?: number;
  travelDurationMinutes?: number;
}

export interface BookingContextData {
  companionId: string;
  companionName?: string;
  serviceId?: number;
  hourlyRate?: number;
  companion?: any;
}

export interface Booking {
  id: string;
  bookingCode: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  companionId: string;
  companionName: string;
  companionPhone: string;
  serviceId: number;
  serviceName: string;
  date: string;
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  slotMinutes: number;
  meetingLocation: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  status: BookingStatus;
  
  // Financial breakdown
  bookingAmountPaise: number; // 100% collected from client
  adminPlatformFeePaise: number; // 15%
  companionGrossSharePaise: number; // 85%
  delayMinutes: number;
  latePenaltyPaise: number; // (Booking Amount / Slot Minutes) * Delay Minutes
  companionNetSharePaise: number; // 85% - penalty
  clientRefundPenaltyPaise: number;
  
  paymentId: string;
  paymentStatus: 'PAID' | 'REFUNDED';
  
  // Meeting verification
  startOtp?: string;
  startOtpVerified: boolean;
  meetingStartedAt?: string; // UTC ISO string
  
  // Completion verification
  endOtp?: string;
  endOtpVerified: boolean;
  meetingCompletedAt?: string; // UTC ISO string
  
  // Lock 48h UTC
  settlementUnlockUtc?: string; // meetingCompletedAt + 48 hours
  settlementStatus: 'LOCKED' | 'ELIGIBLE_FOR_PAYOUT' | 'PAID_OUT';
  payoutId?: string;
  
  createdAt: string;
}

export interface CompanionWallet {
  companionId: string;
  lockedSettlementBalancePaise: number;
  availableSettlementBalancePaise: number;
  totalSettledPaise: number;
  lastUpdated: string;
}

export interface PayoutRecord {
  id: string;
  bookingId: string;
  companionId: string;
  companionName: string;
  amountPaise: number;
  adminId: string;
  adminEmail: string;
  utrNumber: string;
  paymentTimestamp: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  senderRole: 'CLIENT' | 'COMPANION';
  message: string;
  timestamp: string;
}

export interface AdminUser {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: AdminRole;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  adminRole: AdminRole;
  action: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}
