import { Language } from '../types';

export interface TranslationDictionary {
  // Navigation & Header
  navPairUpToday: string;
  navAbout: string;
  navHowItWorks: string;
  navSafetyTrust: string;
  navTerms: string;
  navLanguage: string;
  navSignIn: string;
  navLogin: string;
  navDashboard: string;
  navLogout: string;
  navSwitchToClient: string;
  navSwitchToCompanion: string;
  navClientBadge: string;
  navCompanionBadge: string;
  
  // Hero Section
  heroKicker: string;
  heroFreeBadge: string;
  heroHeadline: string;
  heroHeadlineHighlight: string;
  heroSubheadline: string;
  heroCta: string;
  heroSupportingText: string;
  heroExploreButton: string;
  heroTrustKycTitle: string;
  heroTrustKycDesc: string;
  heroTrustFreeTitle: string;
  heroTrustFreeDesc: string;
  heroTrustOtpTitle: string;
  heroTrustOtpDesc: string;
  heroTrustSosTitle: string;
  heroTrustSosDesc: string;

  // Services Catalog
  servicesSectionKicker: string;
  servicesSectionTitle: string;
  servicesSectionDesc: string;
  catAll: string;
  catSocial: string;
  catLifestyle: string;
  catTravel: string;
  catWellness: string;
  catCulture: string;
  catCare: string;
  bookServiceAction: string;
  serviceHourlyRatePrefix: string;
  
  // About Page
  aboutBadge: string;
  aboutTitle: string;
  aboutTagline: string;
  aboutP1: string;
  aboutP2: string;
  aboutP3: string;
  aboutMissionTitle: string;
  aboutMissionText: string;
  aboutOfferTitle: string;
  aboutOffer1Title: string;
  aboutOffer1Desc: string;
  aboutOffer2Title: string;
  aboutOffer2Desc: string;
  aboutOffer3Title: string;
  aboutOffer3Desc: string;
  aboutOffer4Title: string;
  aboutOffer4Desc: string;
  aboutValuesTitle: string;
  aboutVal1Title: string;
  aboutVal1Desc: string;
  aboutVal2Title: string;
  aboutVal2Desc: string;
  aboutVal3Title: string;
  aboutVal3Desc: string;
  aboutVal4Title: string;
  aboutVal4Desc: string;
  aboutCtaTitle: string;
  aboutCtaDesc: string;
  aboutExploreBtn: string;
  aboutJoinBtn: string;

  // How It Works Page
  hiwBadge: string;
  hiwTitle: string;
  hiwSubtitle: string;
  hiwTabClient: string;
  hiwTabCompanion: string;
  hiwClientStepsTitle: string;
  hiwStep1ClientTitle: string;
  hiwStep1ClientDesc: string;
  hiwStep2ClientTitle: string;
  hiwStep2ClientDesc: string;
  hiwStep3ClientTitle: string;
  hiwStep3ClientDesc: string;
  hiwStep4ClientTitle: string;
  hiwStep4ClientDesc: string;
  hiwStep5ClientTitle: string;
  hiwStep5ClientDesc: string;
  hiwStep6ClientTitle: string;
  hiwStep6ClientDesc: string;
  hiwStep7ClientTitle: string;
  hiwStep7ClientDesc: string;
  hiwCompanionStepsTitle: string;
  hiwStep1CompTitle: string;
  hiwStep1CompDesc: string;
  hiwStep2CompTitle: string;
  hiwStep2CompDesc: string;
  hiwStep3CompTitle: string;
  hiwStep3CompDesc: string;
  hiwStep4CompTitle: string;
  hiwStep4CompDesc: string;
  hiwStep5CompTitle: string;
  hiwStep5CompDesc: string;
  hiwStep6CompTitle: string;
  hiwStep6CompDesc: string;
  hiwSafetyTitle: string;
  hiwSafetyText: string;
  hiwClientCta: string;
  hiwCompanionCta: string;

  // Safety & Trust Page
  safetyBadge: string;
  safetyTitle: string;
  safetySubtitle: string;
  safetyPillar1Title: string;
  safetyPillar1Desc: string;
  safetyPillar2Title: string;
  safetyPillar2Desc: string;
  safetyPillar3Title: string;
  safetyPillar3Desc: string;
  safetyPillar4Title: string;
  safetyPillar4Desc: string;
  safetyPillar5Title: string;
  safetyPillar5Desc: string;
  safetyPillar6Title: string;
  safetyPillar6Desc: string;
  safetyCommunityTitle: string;
  safetyRule1: string;
  safetyRule2: string;
  safetyRule3: string;
  safetyRule4: string;
  safetyEmergencyTitle: string;
  safetyEmergencyDesc: string;

  // Auth Gateway Modal
  authGatewayTitle: string;
  authGatewaySubtitle: string;
  tabLogin: string;
  tabSignIn: string;
  phoneLabel: string;
  phonePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  otpLabel: string;
  otpPlaceholder: string;
  sendOtp: string;
  resendOtp: string;
  resendIn: string;
  verifyAndContinue: string;
  loginButton: string;
  unregisteredMessagePrefix: string;
  unregisteredMessageLink: string;
  unregisteredMessageSuffix: string;
  invalidCredentialsMessage: string;
  securityBranding: string;
  errorPhoneRequired: string;
  errorPhonePasswordRequired: string;
  errorOtpRequired: string;

  // Role Selection Modal
  roleSelectionTitle: string;
  roleSelectionSubtitle: string;
  enterAsClient: string;
  enterAsClientDesc: string;
  enterAsCompanion: string;
  enterAsCompanionDesc: string;
  roleSecurityNotice: string;

  // KYC Wizard Modal
  kycWizardTitle: string;
  kycWizardSubtitle: string;
  ageGateAgreement: string;
  legalNameLabel: string;
  legalNamePlaceholder: string;
  dobLabel: string;
  dobNotice: string;
  idTypeLabel: string;
  idFrontLabel: string;
  idBackLabel: string;
  selfieLabel: string;
  bioLabel: string;
  bioPlaceholder: string;
  profileNameLabel: string;
  profileNamePlaceholder: string;
  profileNameHelp: string;
  profileSectionTitle: string;
  profileSectionSubtitle: string;
  profilePrivacyBadge: string;
  profileSaveBtn: string;
  profileSavingBtn: string;
  profilePhotosSection: string;
  profilePhotosHelp: string;
  profileUploadBtn: string;
  profileSetMainBtn: string;
  profileMainBadge: string;
  profileLockedIdentityTitle: string;
  profileLockedIdentityHelp: string;
  profileLegalNameLocked: string;
  profileDobLocked: string;
  profilePhoneLocked: string;
  profileSuccessMsg: string;
  photosLabel: string;
  fileChooseText: string;
  fileAttachedText: string;
  submitKyc: string;
  kycSubmittedNotice: string;
  kycPendingBanner: string;
  kycApprovedBanner: string;

  // Client Dashboard
  clientInactiveTitle: string;
  clientActiveTitle: string;
  clientFreeMembershipNotice: string;
  clientFreeActiveTag: string;
  tabOverview: string;
  tabProfile: string;
  tabKycStatus: string;
  tabDiscover: string;
  tabServices: string;
  tabBookings: string;
  tabHistory: string;
  tabChat: string;
  tabNotifications: string;
  tabPayments: string;
  tabSafety: string;
  tabSafetyAndHelp: string;
  tabSettings: string;
  welcomeBack: string;
  findPerfectCompanion: string;
  exploreMatches: string;
  totalMatches: string;
  thisMonth: string;
  upcomingPlans: string;
  kycVerified: string;
  accountVerified: string;
  viewProfile: string;
  bookNow: string;
  smartFilterAll: string;
  smartFilterOnline: string;
  smartFilterSuggested: string;
  viewAll: string;
  showLess: string;
  searchAndFilters: string;
  discoverCompanionsPlaceholder: string;
  loginAs: string;
  asClient: string;
  asCompanion: string;
  goBack: string;
  logoutText: string;
  findCompanionsTitle: string;
  searchPlaceholder: string;
  filterByService: string;
  filterByCity: string;
  allServices: string;
  allCities: string;
  maxBudget: string;
  nearbyCompanions: string;
  gpsActive: string;
  companionStatusLive: string;
  verifiedKycBadge: string;
  perHourRate: string;
  bookCompanion: string;
  bookingHistory: string;
  upcomingBookings: string;
  pastBookings: string;
  noBookingsYet: string;
  bookingCodeLabel: string;
  startOtpLabel: string;
  completionOtpLabel: string;
  clientOtpInstruction: string;
  bookingConfirmedStatus: string;
  bookingCompletedStatus: string;
  selectSlot: string;
  dateLabel: string;
  timeLabel: string;
  durationHours: string;
  meetingLocationLabel: string;
  notesLabel: string;
  totalAmount: string;
  payAndConfirm: string;
  confirmBookingTitle: string;
  cancellationNotice: string;

  // Companion Dashboard
  companionActivationTitle: string;
  companionLiveBadge: string;
  companionInactiveBadge: string;
  stepServices: string;
  stepMembership: string;
  stepBank: string;
  gateKycTitle: string;
  gateMembershipTitle: string;
  gateBankTitle: string;
  membershipPlanStarter: string;
  membershipPlanPro: string;
  membershipPlanPremium: string;
  starterPriceText: string;
  proPriceText: string;
  premiumPriceText: string;
  starterDurationText: string;
  proDurationText: string;
  premiumDurationText: string;
  purchaseMembershipPlan: string;
  bankAccountLabel: string;
  bankAccountPlaceholder: string;
  ifscLabel: string;
  ifscPlaceholder: string;
  accountHolderLabel: string;
  accountHolderPlaceholder: string;
  verifyBank: string;
  walletBalance: string;
  lockedEarnings: string;
  availableEarnings: string;
  hourlyRateSettings: string;
  saveRates: string;
  meetingArrivedAction: string;
  startOtpTitle: string;
  enterStartOtp: string;
  enterCompletionOtp: string;
  delayMinutesLabel: string;
  verifyOtpButton: string;
  countdownActive: string;
  completeBookingAction: string;

  // SOS & Emergency Hub
  sosEmergencyHub: string;
  sosEmergencySubtitle: string;
  emergencyHotline100: string;
  emergencyHotline112: string;
  emergencyHotline100Desc: string;
  emergencyHotline112Desc: string;
  safetyTipTitle: string;
  safetyTipText: string;

  // Footer & Contact With Us
  footerMission: string;
  footerRights: string;
  footerPlatformNav: string;
  footerContactWithUs: string;
  footerFacebookLabel: string;
  footerInstagramLabel: string;
  footerEmailLabel: string;
  footerEmergencyAssistance: string;
  footerPoliceEmergency: string;
  footerNationalSos: string;
  footerBuiltWithLove: string;
  footerCopyEmail: string;
  footerEmailCopied: string;

  // Common UI Actions
  closeAction: string;
  cancelAction: string;
  confirmAction: string;
  loadingAction: string;
  copiedAction: string;

  // Companion Listing & Profile Details
  companionListSectionTitle: string;
  companionListSectionSubtitle: string;
  quickViewAction: string;
  bookNowAction: string;
  availableServicesLabel: string;
  profileUnavailableForBooking: string;
  ageYearsLabel: string;
  ratePerHourLabel: string;
  selectLocationLabel: string;
  allLocationsLabel: string;
  filterByServiceLabel: string;
  allServicesLabel: string;
  viewDetailsAction: string;
  additionalPhotosLabel: string;
  // Additional Info & Legal Page Keys
  aboutSlogan: string;
  hiwClientStepsDesc: string;
  hiwClientTagline: string;
  hiwCompanionStepsDesc: string;
  hiwCompanionTagline: string;
  safetyEmergencyHeadline: string;
  policeLabel: string;
  sosLabel: string;
  safetyTagline: string;

  // Terms of Service Page (Full 8 Sections)
  termsBadge: string;
  termsTitle: string;
  termsLastUpdated: string;
  termsIntro: string;

  // Section 1
  termsSec1Title: string;
  termsSec1P1Title: string;
  termsSec1P1Desc: string;
  termsSec1P2Title: string;
  termsSec1P2Desc: string;
  termsSec1P3Title: string;
  termsSec1P3Desc: string;

  // Section 2
  termsSec2Title: string;
  termsSec2P1Title: string;
  termsSec2P1Desc: string;
  termsSec2P2Title: string;
  termsSec2P2Desc: string;
  termsSec2P3Title: string;
  termsSec2P3Desc: string;

  // Section 3
  termsSec3Title: string;
  termsSec3P1Title: string;
  termsSec3P1Desc: string;
  termsSec3P2Title: string;
  termsSec3P2Desc: string;
  termsSec3P3Title: string;
  termsSec3P3Desc: string;
  termsSec3P4Title: string;
  termsSec3P4Desc: string;

  // Section 4 (Refund & Cancellation Policy)
  termsSec4Title: string;
  termsSec4Intro: string;
  termsSec4ClientTitle: string;
  termsSec4ClientDesc: string;
  termsSec4Slab1: string;
  termsSec4Slab2: string;
  termsSec4Slab3: string;
  termsSec4NoShowClientTitle: string;
  termsSec4NoShowClientDesc: string;
  termsSec4NoShowCompTitle: string;
  termsSec4NoShowCompDesc: string;
  termsSec4NoShowCompItem1: string;
  termsSec4NoShowCompItem2: string;
  termsSec4EarlyEndTitle: string;
  termsSec4EarlyEndDesc: string;
  termsSec4TechErrorsTitle: string;
  termsSec4TechErrorsDesc: string;
  termsSec4TimelinesTitle: string;
  termsSec4TimelinesDesc: string;
  termsSec4TimelineUpi: string;
  termsSec4TimelineNb: string;
  termsSec4TimelineCards: string;
  termsSec4NonRefundTitle: string;
  termsSec4NonRefundDesc: string;
  termsSec4SupportTitle: string;
  termsSec4SupportDesc: string;

  // Section 5
  termsSec5Title: string;
  termsSec5P1Title: string;
  termsSec5P1Desc: string;
  termsSec5P2Title: string;
  termsSec5P2Desc: string;
  termsSec5P3Title: string;
  termsSec5P3Desc: string;

  // Section 6
  termsSec6Title: string;
  termsSec6P1Title: string;
  termsSec6P1Desc: string;
  termsSec6P2Title: string;
  termsSec6P2Desc: string;

  // Section 7
  termsSec7Title: string;
  termsSec7P1Title: string;
  termsSec7P1Desc: string;
  termsSec7P2Title: string;
  termsSec7P2Desc: string;

  // Section 8
  termsSec8Title: string;
  termsSec8Desc: string;

  // Booking Cancellation & Refund Workflow Keys
  cancelBookingBtn: string;
  cancelBookingModalTitle: string;
  cancelBookingWarning: string;
  selectReasonLabel: string;
  reasonChangeOfPlans: string;
  reasonScheduleConflict: string;
  reasonEmergency: string;
  reasonBookedByMistake: string;
  reasonOther: string;
  customReasonPlaceholder: string;
  timeRemainingLabel: string;
  applicableRefundSlab: string;
  refundSlab100: string;
  refundSlab50: string;
  refundSlab0: string;
  originalPaidAmount: string;
  refundableAmount: string;
  noRefundNotice: string;
  confirmZeroRefundBtn: string;
  savedBankTitle: string;
  savedBankVerifiedBadge: string;
  beneficiaryNameLabel: string;
  accountNumberLabel: string;
  ifscCodeLabel: string;
  changeBankBtn: string;
  confirmCancellationBtn: string;
  newBankFormTitle: string;
  nameMatchNote: string;
  verifyAndCancelBtn: string;
  nameMismatchError: string;
  cancellationSuccessTitle: string;
  refundProcessingNotice: string;
  closeBtn: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    // Navigation
    navPairUpToday: "PairUpToday",
    navAbout: "About",
    navHowItWorks: "How It Works",
    navSafetyTrust: "Safety & Trust",
    navTerms: "Terms of Service",
    navLanguage: "Language",
    navSignIn: "Sign In",
    navLogin: "Login",
    navDashboard: "Dashboard",
    navLogout: "Log Out",
    navSwitchToClient: "Switch to Client",
    navSwitchToCompanion: "Switch to Companion",
    navClientBadge: "Client",
    navCompanionBadge: "Companion",
    
    // Hero
    heroKicker: "Verified Social Companionship Across India",
    heroFreeBadge: "100% Free for Clients",
    heroHeadline: "Find Your Perfect Companion,",
    heroHeadlineHighlight: "Anytime, Anywhere.",
    heroSubheadline: "Whether you need a companion for a quiet café, shopping in the city, exploring cultural landmarks, or friendly conversation, PairUpToday connects you with verified individuals safely.",
    heroCta: "YOUR TIME. YOUR CHOICE. YOUR EARNINGS. →",
    heroSupportingText: "Join PairUpToday as a Companion and earn on your own terms.",
    heroExploreButton: "Explore Verified Companions in your City",
    heroTrustKycTitle: "100% Verified KYC",
    heroTrustKycDesc: "Govt ID & live selfie gate",
    heroTrustFreeTitle: "Free Client Access",
    heroTrustFreeDesc: "No membership fees",
    heroTrustOtpTitle: "Start & Finish OTP",
    heroTrustOtpDesc: "In-person meeting lock",
    heroTrustSosTitle: "India 100 & 112 SOS",
    heroTrustSosDesc: "Emergency support hub",

    // Services Catalog
    servicesSectionKicker: "Curated Experiences",
    servicesSectionTitle: "36 Distinctive Companionship Services",
    servicesSectionDesc: "Choose from our verified companionship offerings across social, lifestyle, travel, wellness, culture and care.",
    catAll: "All 36 Services",
    catSocial: "Social",
    catLifestyle: "Lifestyle",
    catTravel: "Travel & Tours",
    catWellness: "Fitness & Outdoors",
    catCulture: "Culture & Arts",
    catCare: "Care & Assistance",
    bookServiceAction: "Book Companion",
    serviceHourlyRatePrefix: "Starting at ₹499/hr",

    // About Page
    aboutBadge: "About Our Community",
    aboutTitle: "About PairUpToday",
    aboutTagline: "Bringing People Together, Creating Meaningful Experiences.",
    aboutP1: "PairUpToday is a companionship platform designed to bring people together and make everyday experiences more enjoyable, comfortable and meaningful.",
    aboutP2: "Whether you are looking for someone to accompany you to a café, explore a new city, attend an event, travel, go shopping or simply enjoy a friendly conversation, PairUpToday helps you discover a companion who matches your preferences and needs.",
    aboutP3: "We also create opportunities for individuals who want to offer companionship services, share their interests and skills, connect with people and earn through their time and availability.",
    aboutMissionTitle: "Our Mission",
    aboutMissionText: "Our mission is to make companionship more accessible by creating a platform where people can connect, discover experiences and build meaningful social connections.",
    aboutOfferTitle: "What We Offer",
    aboutOffer1Title: "Personal Companionship",
    aboutOffer1Desc: "Companions for conversations, dining out, café visits, shopping, movies, and social occasions.",
    aboutOffer2Title: "City & Travel Companions",
    aboutOffer2Desc: "Companions for sightseeing, exploring city attractions, holiday travel, and local exploration.",
    aboutOffer3Title: "Events & Activities",
    aboutOffer3Desc: "Companions for weddings, concerts, sports events, festivals, exhibitions, and fitness activities.",
    aboutOffer4Title: "Care & Support",
    aboutOffer4Desc: "Companionship for senior citizens, hospital visits, daily errands, and regular day-to-day support.",
    aboutValuesTitle: "Our Core Values",
    aboutVal1Title: "Safety & Trust",
    aboutVal1Desc: "Comprehensive KYC, OTP-verified meetings, and zero-tolerance safety standards.",
    aboutVal2Title: "Freedom & Flexibility",
    aboutVal2Desc: "Transparent bookings, flexible schedules, and independent companion pricing.",
    aboutVal3Title: "Respect & Integrity",
    aboutVal3Desc: "A safe, respectful environment where clients and companions interact with dignity.",
    aboutVal4Title: "Transparent Earnings",
    aboutVal4Desc: "85% net earnings for companions, 48-hour UTC escrow locks, and transparent accounting.",
    aboutCtaTitle: "Ready to Experience PairUpToday?",
    aboutCtaDesc: "Join thousands of clients and companions building safe, verified connections across India.",
    aboutExploreBtn: "Explore Companions",
    aboutJoinBtn: "Join as a Companion",

    // How It Works Page
    hiwBadge: "Step-by-Step Guide",
    hiwTitle: "How PairUpToday Works",
    hiwSubtitle: "A seamless, secure experience designed for both clients and companions.",
    hiwTabClient: "For Clients",
    hiwTabCompanion: "For Companions",
    hiwClientStepsTitle: "Client Journey (7 Simple Steps)",
    hiwStep1ClientTitle: "Create Account",
    hiwStep1ClientDesc: "Register using your mobile number and password, and complete secure 6-digit OTP verification.",
    hiwStep2ClientTitle: "Complete Profile & KYC",
    hiwStep2ClientDesc: "Submit government ID and live selfie verification for safety and account activation.",
    hiwStep3ClientTitle: "Discover Companions",
    hiwStep3ClientDesc: "Filter companions by location, interests, preferred services, availability, and hourly budget.",
    hiwStep4ClientTitle: "Choose Your Companion",
    hiwStep4ClientDesc: "Review companion profiles, introductions, verified badges, and selected service rates.",
    hiwStep5ClientTitle: "Select Your Booking",
    hiwStep5ClientDesc: "Choose date, time slot, duration, and complete transparent payment via PairUp Secure Vault.",
    hiwStep6ClientTitle: "Meet & Enjoy",
    hiwStep6ClientDesc: "Meet at the public venue and share your Start OTP to begin the session securely.",
    hiwStep7ClientTitle: "Complete Booking",
    hiwStep7ClientDesc: "Provide the Completion OTP at the end of the session to conclude the meeting safely.",
    hiwCompanionStepsTitle: "Companion Journey (6 Simple Steps)",
    hiwStep1CompTitle: "Register as Companion",
    hiwStep1CompDesc: "Sign in with your mobile number, set a password, and verify your 6-digit OTP.",
    hiwStep2CompTitle: "Complete Mandatory KYC",
    hiwStep2CompDesc: "Upload government identity documents and clear live selfie for admin audit and verification.",
    hiwStep3CompTitle: "Select Services & Rates",
    hiwStep3CompDesc: "Choose which of the 36 approved services you wish to offer and configure hourly rates.",
    hiwStep4CompTitle: "Activate Membership",
    hiwStep4CompDesc: "Choose a membership plan (Starter ₹449, Professional ₹1,099, or Premium ₹5,999) to activate bookings.",
    hiwStep5CompTitle: "Verify Bank Details",
    hiwStep5CompDesc: "Provide your bank account and IFSC code for penny-less name matching against your KYC ID.",
    hiwStep6CompTitle: "Go Live & Earn",
    hiwStep6CompDesc: "Once all 3 gates pass, your profile goes live. Receive bookings and earn 85% net shares.",
    hiwSafetyTitle: "Our Commitment to Safety",
    hiwSafetyText: "PairUpToday is strictly a professional companionship service. We maintain zero tolerance for harassment, misconduct, or unsafe behavior. All meetings occur in public spaces with dual OTP verification and 24/7 SOS helpline access.",
    hiwClientCta: "Register as Client (Free)",
    hiwCompanionCta: "Become a Companion Host",

    // Safety & Trust Page
    safetyBadge: "Safety & Trust Protocols",
    safetyTitle: "Safety & Trust at PairUpToday",
    safetySubtitle: "We prioritize mutual respect, identity verification, account integrity, and immediate emergency responsiveness for all community members.",
    safetyPillar1Title: "Identity Verification & Admin Approval",
    safetyPillar1Desc: "Every client and companion must complete KYC with government ID (Aadhaar, PAN, Voter ID, or Passport) and live selfie verification before approval. Profiles remain inactive until audited by trained verification personnel.",
    safetyPillar2Title: "Secure OTP-Based Meeting Protocol",
    safetyPillar2Desc: "Multi-factor 6-digit OTP verification ensures account protection. When meeting in person, the companion cannot start the session without the client's Meeting Start OTP, and cannot conclude it without the final Completion OTP.",
    safetyPillar3Title: "Secure Online Escrow Payments",
    safetyPillar3Desc: "All payments are processed securely through PairUp Secure Vault. Companion shares are held in escrow for a mandatory 48-hour UTC lock after meeting completion, ensuring safe resolution of any disputes.",
    safetyPillar4Title: "In-App Secure Chat",
    safetyPillar4Desc: "Communicate directly with your companion inside the application without sharing private phone numbers or personal social media handles.",
    safetyPillar5Title: "Emergency SOS Integration",
    safetyPillar5Desc: "Immediate direct access to India's official emergency helplines — Police Emergency 100 and National Emergency SOS 112 — accessible on every active booking screen.",
    safetyPillar6Title: "Zero-Tolerance Community Standards",
    safetyPillar6Desc: "PairUpToday is strictly a non-sexual, professional social companionship platform. Any violations lead to permanent banning and forfeiture of platform access.",
    safetyCommunityTitle: "Community Guidelines",
    safetyRule1: "Always meet in well-lit, public spaces like cafés, restaurants, shopping malls, or registered tourist spots.",
    safetyRule2: "Never share private financial information, banking credentials, or personal home addresses.",
    safetyRule3: "Treat every member with courtesy, kindness, and professional dignity.",
    safetyRule4: "Never bypass platform booking or OTP procedures. External off-platform arrangements are strictly prohibited.",
    safetyEmergencyTitle: "Emergency Contacts",
    safetyEmergencyDesc: "If you ever feel unsafe or require immediate escalation during an active meeting, call emergency services immediately:",

    // Auth Gateway Modal
    authGatewayTitle: "PairUpToday Gateway",
    authGatewaySubtitle: "Secure access for Clients and Companion Hosts",
    tabLogin: "Login",
    tabSignIn: "Sign In",
    phoneLabel: "Indian Mobile Number (+91)",
    phonePlaceholder: "Enter 10-digit mobile number",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter strong password",
    otpLabel: "6-Digit OTP",
    otpPlaceholder: "Enter OTP sent to your phone",
    sendOtp: "Send OTP",
    resendOtp: "Resend OTP",
    resendIn: "Resend in",
    verifyAndContinue: "Verify OTP & Continue",
    loginButton: "Sign In to PairUpToday",
    unregisteredMessagePrefix: "Not registered yet? Please ",
    unregisteredMessageLink: "Sign In",
    unregisteredMessageSuffix: " to create your account.",
    invalidCredentialsMessage: "Invalid mobile number or password. Please verify and try again.",
    securityBranding: "PairUp Security Network",
    errorPhoneRequired: "Please enter a valid 10-digit Indian mobile number (+91).",
    errorPhonePasswordRequired: "Please enter both mobile number and password.",
    errorOtpRequired: "Please enter the 6-digit OTP sent to your phone.",

    // Role Selection Modal
    roleSelectionTitle: "Choose Your Workspace",
    roleSelectionSubtitle: "Please select how you wish to enter PairUpToday for this session",
    enterAsClient: "Enter as Client Member",
    enterAsClientDesc: "Discover and book verified companions. 100% Free membership.",
    enterAsCompanion: "Enter as Companion Host",
    enterAsCompanionDesc: "Manage services, receive client bookings, and earn 85% net shares.",
    roleSecurityNotice: "PairUp Verified Network Authorization",

    // KYC Wizard Modal
    kycWizardTitle: "Unified Profile & Identity Verification",
    kycWizardSubtitle: "Submit your details to ensure community safety and platform trust",
    ageGateAgreement: "I confirm that I am 18 years of age or older",
    legalNameLabel: "Official Legal Name (as on Gov ID)",
    legalNamePlaceholder: "Full name matching identity document",
    dobLabel: "Date of Birth",
    dobNotice: "Date of birth will be permanently locked after submission (Must be 18+).",
    idTypeLabel: "Government ID Type",
    idFrontLabel: "Front Identity Document",
    idBackLabel: "Back Identity Document",
    selfieLabel: "Clear Live Selfie",
    bioLabel: "Short Introduction / Bio",
    bioPlaceholder: "Tell clients about your interests, hobbies, and personality...",
    profileNameLabel: "Public Profile Name *",
    profileNamePlaceholder: "Enter public display name (e.g. Alex, Rahul, Sam)",
    profileNameHelp: "This public name protects your privacy. Your official Government ID legal name will remain strictly confidential.",
    profileSectionTitle: "Public Profile Name & Bio",
    profileSectionSubtitle: "Customize your public display name, photo gallery, and introduction. Your official Government ID credentials remain private and locked.",
    profilePrivacyBadge: "Privacy Protected",
    profileSaveBtn: "Save Profile Changes",
    profileSavingBtn: "Saving Changes...",
    profilePhotosSection: "Profile & Gallery Photos (Max 6)",
    profilePhotosHelp: "Upload up to 6 high quality photos. Choose any photo as your primary profile photo.",
    profileUploadBtn: "Upload Photo",
    profileSetMainBtn: "Set Main",
    profileMainBadge: "★ Main Photo",
    profileLockedIdentityTitle: "Verified Legal Identity (Permanently Locked)",
    profileLockedIdentityHelp: "To prevent fraud and maintain safety, legal verification details verified with Government ID cannot be modified.",
    profileLegalNameLocked: "Legal Full Name (Govt ID)",
    profileDobLocked: "Date of Birth & Age",
    profilePhoneLocked: "Registered Mobile",
    profileSuccessMsg: "Profile updated successfully!",
    photosLabel: "Profile Photos (Up to 6)",
    fileChooseText: "Choose File (Photo or PDF)",
    fileAttachedText: "Document Uploaded ✓",
    submitKyc: "Submit KYC Verification",
    kycSubmittedNotice: "KYC submitted successfully. For safety compliance, your session is now closed. Please log in again.",
    kycPendingBanner: "KYC UNDER REVIEW: Our compliance team is verifying your government documents.",
    kycApprovedBanner: "KYC VERIFIED: Your identity has been authenticated.",

    // Client Dashboard
    clientInactiveTitle: "Client Inactive: Wait for KYC Approval",
    clientActiveTitle: "Client Profile Active",
    clientFreeMembershipNotice: "Client Membership is 100% FREE: Never pay subscription fees to browse or book. You only pay the transparent fee for sessions you schedule.",
    clientFreeActiveTag: "Free Active Access (₹0)",
    tabOverview: "Overview",
    tabProfile: "My Profile",
    tabKycStatus: "My KYC Status",
    tabDiscover: "Discover Companions",
    tabServices: "36 Services",
    tabBookings: "My Bookings",
    tabHistory: "Booking History",
    tabChat: "Secure Chat",
    tabNotifications: "Notifications",
    tabPayments: "Payments",
    tabSafety: "Safety & SOS",
    tabSafetyAndHelp: "Help & Safety",
    tabSettings: "Settings",
    welcomeBack: "Welcome Back",
    findPerfectCompanion: "Let's find your perfect companion together...",
    exploreMatches: "Explore Matches",
    totalMatches: "Total Matches",
    thisMonth: "this month",
    upcomingPlans: "View your upcoming plans",
    kycVerified: "KYC Verified",
    accountVerified: "Your account is verified",
    viewProfile: "View Profile",
    bookNow: "Book Now",
    smartFilterAll: "All",
    smartFilterOnline: "Online",
    smartFilterSuggested: "Suggested",
    viewAll: "View All",
    showLess: "Show Less",
    searchAndFilters: "Search & Filters",
    discoverCompanionsPlaceholder: "Discover Companions...",
    loginAs: "Login As",
    asClient: "As a Client",
    asCompanion: "As a Companion",
    goBack: "Back",
    logoutText: "Logout",
    findCompanionsTitle: "Discover Verified Companions",
    searchPlaceholder: "Search by city, name, or interests...",
    filterByService: "Filter by Service",
    filterByCity: "City",
    allServices: "All 36 Services",
    allCities: "All Cities",
    maxBudget: "Max Budget / Hour",
    nearbyCompanions: "Nearby Companions (GPS Enabled)",
    gpsActive: "GPS Location Active",
    companionStatusLive: "LIVE COMPANION",
    verifiedKycBadge: "Verified KYC",
    perHourRate: "/ hour",
    bookCompanion: "Book Companion",
    bookingHistory: "My Bookings",
    upcomingBookings: "Upcoming Bookings",
    pastBookings: "Past History",
    noBookingsYet: "No bookings found yet. Explore companions to schedule your first experience.",
    bookingCodeLabel: "Booking Code",
    startOtpLabel: "Meeting Start OTP",
    completionOtpLabel: "Completion OTP",
    clientOtpInstruction: "Provide this OTP to your companion in person only when you meet / finish.",
    bookingConfirmedStatus: "CONFIRMED",
    bookingCompletedStatus: "COMPLETED",
    selectSlot: "Select Date & Time Slot",
    dateLabel: "Meeting Date",
    timeLabel: "Start Time",
    durationHours: "Duration (Hours)",
    meetingLocationLabel: "Meeting Location (Public Venue)",
    notesLabel: "Special Notes / Preferences",
    totalAmount: "Total Payable",
    payAndConfirm: "Pay & Confirm Booking",
    confirmBookingTitle: "Schedule Companionship Session",
    cancellationNotice: "Late arrivals by companion incur penalties credited to client refund.",

    // Companion Dashboard
    companionActivationTitle: "Companion Host Onboarding & Activation",
    companionLiveBadge: "COMPANION STATUS: LIVE",
    companionInactiveBadge: "COMPANION STATUS: INACTIVE",
    stepServices: "1. Service & Rates",
    stepMembership: "2. Membership",
    stepBank: "3. Bank Verification",
    gateKycTitle: "KYC Identity Review",
    gateMembershipTitle: "Companion Membership",
    gateBankTitle: "Bank Account Verification",
    membershipPlanStarter: "STARTER",
    membershipPlanPro: "PROFESSIONAL",
    membershipPlanPremium: "PREMIUM",
    starterPriceText: "₹449 / 1 month",
    proPriceText: "₹1,099 / 3 months",
    premiumPriceText: "₹5,999 / 1 year",
    starterDurationText: "30 Days Validity",
    proDurationText: "90 Days Validity",
    premiumDurationText: "365 Days Validity",
    purchaseMembershipPlan: "Activate Membership Plan",
    bankAccountLabel: "Bank Account Number",
    bankAccountPlaceholder: "Enter bank account number",
    ifscLabel: "IFSC Code",
    ifscPlaceholder: "e.g. HDFC0001234",
    accountHolderLabel: "Account Holder Name (Matches KYC)",
    accountHolderPlaceholder: "Official name on bank account",
    verifyBank: "Verify Bank Account",
    walletBalance: "Wallet Overview",
    lockedEarnings: "Locked Earnings (48h UTC Hold)",
    availableEarnings: "Available Settlement",
    hourlyRateSettings: "Set Hourly Companion Rate",
    saveRates: "Save Rates",
    meetingArrivedAction: "SLIDE: MEETING ARRIVED",
    startOtpTitle: "Meeting Start Verification",
    enterStartOtp: "Enter 6-Digit Client OTP",
    enterCompletionOtp: "Enter Completion OTP",
    delayMinutesLabel: "Companion Delay (Minutes, if any)",
    verifyOtpButton: "Verify OTP & Start Meeting",
    countdownActive: "Active Session Timer",
    completeBookingAction: "FINISH BOOKING",

    // SOS & Emergency Hub
    sosEmergencyHub: "PairUp Safety & SOS Hub",
    sosEmergencySubtitle: "Instant emergency assistance and immediate escalation protocols",
    emergencyHotline100: "Police Emergency Helpline: 100",
    emergencyHotline112: "National Emergency SOS: 112",
    emergencyHotline100Desc: "Direct connection to local police patrol and emergency response.",
    emergencyHotline112Desc: "All-in-one national emergency support across India.",
    safetyTipTitle: "Active Meeting Safety Tip",
    safetyTipText: "Meetings must take place exclusively in public places. If you ever feel uncomfortable or notice policy violations, end the session and contact authorities or our safety desk.",

    // Footer & Contact With Us
    footerMission: "PairUpToday — Your Time. Your Choice. Your Companion.",
    footerRights: "© 2026 PairUpToday. All rights reserved. Secured by PairUp Security Network.",
    footerPlatformNav: "Platform Navigation",
    footerContactWithUs: "Contact With Us",
    footerFacebookLabel: "Facebook",
    footerInstagramLabel: "Instagram",
    footerEmailLabel: "Support@pairuptoday.com",
    footerEmergencyAssistance: "Emergency Assistance",
    footerPoliceEmergency: "Police Emergency",
    footerNationalSos: "National Emergency SOS",
    footerBuiltWithLove: "Better Connections. Brighter Moments.",
    footerCopyEmail: "Copy Email",
    footerEmailCopied: "Email copied: Support@pairuptoday.com",

    // Common UI Actions
    closeAction: "Close",
    cancelAction: "Cancel",
    confirmAction: "Confirm",
    loadingAction: "Processing...",
    copiedAction: "Copied!",

    // Companion Listing & Profile Details
    companionListSectionTitle: "Verified Companions Across India",
    companionListSectionSubtitle: "Explore verified social companions available in your city for all 36 companionship services.",
    quickViewAction: "View Profile", // Quick View
    bookNowAction: "Book Now",
    availableServicesLabel: "Available Services",
    profileUnavailableForBooking: "This profile is currently unavailable for booking.",
    ageYearsLabel: "yrs",
    ratePerHourLabel: "₹{rate}/hr",
    selectLocationLabel: "Select City / Location",
    allLocationsLabel: "All Locations",
    filterByServiceLabel: "Filter by Service",
    allServicesLabel: "All 36 Services",
    viewDetailsAction: "View Profile",
    additionalPhotosLabel: "Additional Photographs",
    aboutSlogan: "PairUpToday — Your Time. Your Choice. Your Companion.",
    hiwClientStepsDesc: "7 straightforward steps to finding your ideal companion safely.",
    hiwClientTagline: "Your time. Your choice. Your perfect companion.",
    hiwCompanionStepsDesc: "6 comprehensive steps to onboard, activate, and receive 85% net earnings safely.",
    hiwCompanionTagline: "Your time. Your skills. Your earning opportunity.",
    safetyEmergencyHeadline: "In case of any safety concern during an experience",
    policeLabel: "Police: 100",
    sosLabel: "SOS: 112",
    safetyTagline: "PairUpToday — More Than Company. A Better Experience.",

    termsBadge: "Official Platform Policy",
    termsTitle: "Terms of Service – Pairup Today",
    termsLastUpdated: "Last Updated: November 23, 2026",
    termsIntro: "Welcome to Pairup Today (\"we,\" \"our,\" or \"us\"). Pairup Today is a platform that connects clients with verified companions for platonic social interactions, activities, and friendly company (\"Service\"). By registering, booking, or providing services on Pairup Today, you agree to be legally bound by these Terms of Service (\"Terms\").",

    termsSec1Title: "1. Nature of Service & Strict Anti-Escort Policy",
    termsSec1P1Title: "Platonic Companionship Only:",
    termsSec1P1Desc: "Pairup Today is strictly a platform for platonic, friendly, and social companionship (such as dining, attending events, conversations, or sightseeing).",
    termsSec1P2Title: "No Escort or Adult Services:",
    termsSec1P2Desc: "Pairup Today strictly does NOT provide escort, dating, sexual, or adult services of any kind.",
    termsSec1P3Title: "Zero Tolerance & Legal Action:",
    termsSec1P3Desc: "Any solicitation, promotion, or engagement in sexual favors, human trafficking, fraud, or any illegal activity is strictly forbidden. Any user or companion found violating this rule will face immediate permanent account termination and strict legal action under the applicable laws of India (including reporting to law enforcement authorities).",

    termsSec2Title: "2. Eligibility, Voluntary Participation & Verification",
    termsSec2P1Title: "Voluntary Registration & Free Will:",
    termsSec2P1Desc: "Both clients and companions confirm that they are registering, using our platform, and offering or booking services entirely of their own free will and voluntary choice. We have not forced, coerced, misled, or lured any individual through false promises or inducements to join or use this Service.",
    termsSec2P2Title: "Age Requirement:",
    termsSec2P2Desc: "Both clients and companions must be at least 18 years old to use Pairup Today.",
    termsSec2P3Title: "Mandatory Verification:",
    termsSec2P3Desc: "Users must provide accurate personal details and valid government-issued ID proof when requested. Fake profiles will be permanently banned.",

    termsSec3Title: "3. Bookings, Payments & Platform Fees (15% Commission)",
    termsSec3P1Title: "Client Payments:",
    termsSec3P1Desc: "Clients must pay the full booking amount upfront through the Pairup Today platform to confirm a session.",
    termsSec3P2Title: "Companion Payouts & 15% Platform Fee:",
    termsSec3P2Desc: "We deduct a 15% platform service fee from the total booking amount earned by the companion. The remaining 85% will be credited to the companion’s registered payout account upon successful completion of the booking.",
    termsSec3P3Title: "No Off-Platform Transactions:",
    termsSec3P3Desc: "All bookings and payments must occur strictly within our app. Bypassing the platform to pay or accept cash or direct transfers is a breach of these Terms and will result in account suspension.",
    termsSec3P4Title: "Activity Expenses:",
    termsSec3P4Desc: "Unless mutually agreed otherwise, clients are responsible for their own expenses (food, tickets, travel) during in-person meetups.",

    termsSec4Title: "4. Refund & Cancellation Policy",
    termsSec4Intro: "We understand that plans can change unexpectedly. Below are the terms governing booking cancellations and refunds on Pairup Today:",
    termsSec4ClientTitle: "Client Cancellation Rules:",
    termsSec4ClientDesc: "You may cancel a confirmed booking before the scheduled start time based on the following refund slabs:",
    termsSec4Slab1: "More than 12 hours before scheduled time: 100% full refund of the booking amount.",
    termsSec4Slab2: "3 to 12 hours before scheduled time: 50% refund of the booking amount.",
    termsSec4Slab3: "Less than 3 hours before scheduled time: No refund (booking amount is forfeited).",
    termsSec4NoShowClientTitle: "Client No-Show:",
    termsSec4NoShowClientDesc: "If a client fails to arrive at the designated booking location at the scheduled time without prior cancellation (and the Start OTP is not verified), no refund will be issued, and the amount will be forfeited to compensate the companion. Repeated no-shows may lead to account suspension.",
    termsSec4NoShowCompTitle: "Companion No-Show Penalty & Full Refund:",
    termsSec4NoShowCompDesc: "If the companion fails to arrive at the designated booking location at the scheduled time without reasonable justification:",
    termsSec4NoShowCompItem1: "The client will immediately receive a 100% full refund of the booking amount.",
    termsSec4NoShowCompItem2: "The companion will be subject to monetary penalties (deducted from wallet/future payouts) and/or temporary or permanent account suspension.",
    termsSec4EarlyEndTitle: "Early Departure or Dissatisfaction:",
    termsSec4EarlyEndDesc: "If a session ends earlier than the booked duration upon mutual agreement or due to client preference, no partial refund will be provided. If ended due to misconduct or rule violation, the incident will be reviewed by support before determining refund eligibility.",
    termsSec4TechErrorsTitle: "Technical or Platform Errors:",
    termsSec4TechErrorsDesc: "If an amount is debited but the booking is not confirmed due to network or gateway failure, the full amount will be automatically refunded within 48 hours.",
    termsSec4TimelinesTitle: "Refund Processing Timelines:",
    termsSec4TimelinesDesc: "Approved refunds are initiated immediately and credited back to the original payment source:",
    termsSec4TimelineUpi: "UPI: 1–5 business days",
    termsSec4TimelineNb: "Net Banking: 3–5 business days",
    termsSec4TimelineCards: "Credit / Debit Cards: 5–7 business days",
    termsSec4NonRefundTitle: "Non-Refundable Items:",
    termsSec4NonRefundDesc: "One-time profile verification fees or premium membership charges (if applicable) are non-refundable once the verification process has begun.",
    termsSec4SupportTitle: "Contact for Refund Support:",
    termsSec4SupportDesc: "For any cancellation or refund queries, contact our support team at Support@pairuptoday.com.",

    termsSec5Title: "5. Safety & Code of Conduct",
    termsSec5P1Title: "Public Venues Only:",
    termsSec5P1Desc: "All in-person meetups must take place strictly in safe, public locations (e.g., cafes, restaurants, malls, parks, public events). Meetups in private homes, hotel rooms, or isolated areas are strictly prohibited.",
    termsSec5P2Title: "Mutual Respect:",
    termsSec5P2Desc: "Both parties must maintain respectful behavior. Harassment, abusive language, intoxication, or unwanted physical contact will lead to immediate session termination and a permanent ban.",
    termsSec5P3Title: "Emergency Exit:",
    termsSec5P3Desc: "A companion may immediately end a session if the client violates the platonic policy or behaves inappropriately, without forfeiting their payout (subject to our investigation).",

    termsSec6Title: "6. Data Privacy & Information Security",
    termsSec6P1Title: "Strict Confidentiality of Personal Data:",
    termsSec6P1Desc: "All sensitive personal and financial information provided by clients and companions—including Government-issued ID proofs, phone numbers, email addresses, and bank account details—is kept strictly private and encrypted under our security protocols.",
    termsSec6P2Title: "No Unauthorized Disclosure:",
    termsSec6P2Desc: "We do not sell, rent, or publicly display your private contact or financial details to other users or unauthorized third parties. Information is used strictly for identity verification, secure payment processing, and legal compliance under Indian law when required by law enforcement authorities.",

    termsSec7Title: "7. Limitation of Liability",
    termsSec7P1Title: "Independent Companions:",
    termsSec7P1Desc: "Companions are independent individuals, not employees of Pairup Today. We act solely as a technology facilitator.",
    termsSec7P2Title: "Personal Responsibility:",
    termsSec7P2Desc: "Users are solely responsible for their personal safety and interactions during meetups. Pairup Today is not liable for any personal injury, loss, damage, or disputes arising from user interactions.",

    termsSec8Title: "8. Governing Law & Jurisdiction",
    termsSec8Desc: "These Terms are governed by and construed in accordance with the laws of India. Any disputes, legal claims, or violations arising out of the use of Pairup Today shall be subject to the exclusive jurisdiction of the competent courts in India.",

    // Cancellation & Refund Workflow
    cancelBookingBtn: "Cancel Booking",
    cancelBookingModalTitle: "Cancel Booking & Refund Request",
    cancelBookingWarning: "Please review the cancellation policy before confirming. Once cancelled, your session slot will be released.",
    selectReasonLabel: "Select Cancellation Reason",
    reasonChangeOfPlans: "Change of plans",
    reasonScheduleConflict: "Scheduling / time conflict",
    reasonEmergency: "Personal or medical emergency",
    reasonBookedByMistake: "Booked by mistake",
    reasonOther: "Other",
    customReasonPlaceholder: "Please describe your cancellation reason (optional)...",
    timeRemainingLabel: "Time Remaining Before Session",
    applicableRefundSlab: "Applicable Refund Policy",
    refundSlab100: "100% Full Refund (> 12 hours before scheduled start)",
    refundSlab50: "50% Partial Refund (3 to 12 hours before scheduled start)",
    refundSlab0: "0% No Refund (< 3 hours before scheduled start)",
    originalPaidAmount: "Original Paid Amount",
    refundableAmount: "Calculated Refundable Amount",
    noRefundNotice: "According to our platform policy, cancellations within 3 hours of scheduled time are non-refundable. No bank account details are needed.",
    confirmZeroRefundBtn: "Confirm & Cancel Booking (No Refund)",
    savedBankTitle: "Verified Bank Account for Refund Payout",
    savedBankVerifiedBadge: "Verified via APITXT",
    beneficiaryNameLabel: "Beneficiary Name",
    accountNumberLabel: "Bank Account Number",
    ifscCodeLabel: "IFSC Code",
    changeBankBtn: "Change Bank Account",
    confirmCancellationBtn: "Confirm & Submit Cancellation",
    newBankFormTitle: "Enter Bank Details for Refund",
    nameMatchNote: "Beneficiary name must strictly match your verified Government ID name.",
    verifyAndCancelBtn: "Verify Bank via APITXT & Cancel Booking",
    nameMismatchError: "Bank beneficiary name must match your verified Government ID name.",
    cancellationSuccessTitle: "Booking Cancelled Successfully",
    refundProcessingNotice: "Your refund of ₹{amount} has been submitted and will be credited to your verified bank account within 1–5 business days.",
    closeBtn: "Close"
  },

  bn: {
    // Navigation
    navPairUpToday: "পেয়ারআপটুডে",
    navAbout: "আমাদের সম্পর্কে",
    navHowItWorks: "কীভাবে কাজ করে",
    navSafetyTrust: "নিরাপত্তা ও বিশ্বাস",
    navTerms: "শর্তাবলী (Terms)",
    navLanguage: "ভাষা",
    navSignIn: "সাইন ইন",
    navLogin: "লগইন",
    navDashboard: "ড্যাশবোর্ড",
    navLogout: "লগআউট",
    navSwitchToClient: "গ্রাহক মোডে যান",
    navSwitchToCompanion: "কম্প্যানিয়ন মোডে যান",
    navClientBadge: "ক্লায়েন্ট",
    navCompanionBadge: "কম্প্যানিয়ন",
    
    // Hero
    heroKicker: "ভারতজুড়ে যাচাইকৃত সামাজিক সাহচর্য সেবা",
    heroFreeBadge: "গ্রাহকদের জন্য সম্পূর্ণ বিনামূল্যে",
    heroHeadline: "আপনার পছন্দের সঙ্গী খুঁজুন,",
    heroHeadlineHighlight: "যেকোনো সময়, যেকোনো স্থানে।",
    heroSubheadline: "শান্ত ক্যাফেতে আড্ডা, শহরে কেনাকাটা, সাংস্কৃতিক স্থান ভ্রমণ বা বন্ধুত্বপূর্ণ কথোপকথনের জন্য পেয়ারআপটুডে আপনাকে বিশ্বস্ত মানুষের সাথে নিরাপদভাবে যুক্ত করে।",
    heroCta: "YOUR TIME. YOUR CHOICE. YOUR EARNINGS. →",
    heroSupportingText: "কম্প্যানিয়ন হিসেবে পেয়ারআপটুডে-তে যোগ দিন এবং নিজের সুবিধামতো উপার্জন করুন।",
    heroExploreButton: "আপনার শহরের যাচাইকৃত সঙ্গী দেখুন",
    heroTrustKycTitle: "১০০% যাচাইকৃত কেওয়াইসি",
    heroTrustKycDesc: "সরকারি আইডি ও লাইভ সেলফি",
    heroTrustFreeTitle: "বিনামূল্যে ক্লায়েন্ট প্রবেশ",
    heroTrustFreeDesc: "কোনো সাবস্ক্রিপশন ফি নেই",
    heroTrustOtpTitle: "স্টার্ট ও ফিনিশ ওটিপি",
    heroTrustOtpDesc: "সরাসরি সাক্ষাতের নিরাপত্তা",
    heroTrustSosTitle: "ভারত ১০০ ও ১১২ এসওএস",
    heroTrustSosDesc: "জরুরি সহায়তা কেন্দ্র",

    // Services Catalog
    servicesSectionKicker: "বিশেষ সেবা সমূহ",
    servicesSectionTitle: "৩৬টি অনন্য সাহচর্য সেবা",
    servicesSectionDesc: "সামাজিক, লাইফস্টাইল, ভ্রমণ, স্বাস্থ্য, সংস্কৃতি এবং পরিচর্যা বিষয়ক আমাদের যাচাইকৃত সেবা থেকে বেছে নিন।",
    catAll: "সকল ৩৬টি সার্ভিস",
    catSocial: "সামাজিক",
    catLifestyle: "লাইফস্টাইল",
    catTravel: "ভ্রমণ ও ট্যুর",
    catWellness: "ফিটনেস ও আউটডোর",
    catCulture: "সংস্কৃতি ও শিল্পকলা",
    catCare: "যত্ন ও সহায়তা",
    bookServiceAction: "বুকিং করুন",
    serviceHourlyRatePrefix: "শুরু মাত্র ₹৪৯৯/ঘণ্টা থেকে",

    // About Page
    aboutBadge: "আমাদের কমিউনিটি সম্পর্কে",
    aboutTitle: "পেয়ারআপটুডে সম্পর্কে",
    aboutTagline: "মানুষকে কাছাকাছি আনা, অর্থপূর্ণ অভিজ্ঞতা তৈরি করা।",
    aboutP1: "পেয়ারআপটুডে একটি আধুনিক সাহচর্য প্ল্যাটফর্ম যা মানুষকে একত্রিত করতে এবং দৈনন্দিন অভিজ্ঞতাকে আরও আনন্দদায়ক, আরামদায়ক এবং অর্থপূর্ণ করতে তৈরি করা হয়েছে।",
    aboutP2: "ক্যাফেতে সময় কাটানো, নতুন শহর আবিষ্কার, অনুষ্ঠানে যোগদান, ভ্রমণ, কেনাকাটা কিংবা আন্তরিক আলোচনার জন্য পেয়ারআপটুডে আপনার পছন্দমতো সঙ্গী খুঁজে পেতে সাহায্য করে।",
    aboutP3: "যারা সাহচর্য সেবা প্রদান করতে চান, নিজেদের আগ্রহ ও দক্ষতা শেয়ার করতে চান এবং নিজেদের সময় দিয়ে উপার্জন করতে চান, তাদের জন্যও আমরা নিরাপদ সুযোগ তৈরি করি।",
    aboutMissionTitle: "আমাদের লক্ষ্য",
    aboutMissionText: "আমাদের লক্ষ্য হলো সাহচর্যকে সহজলভ্য করা, যেখানে মানুষ নিরাপদে একে অপরের সাথে যুক্ত হতে পারে এবং অর্থপূর্ণ সামাজিক সম্পর্ক গড়ে তুলতে পারে।",
    aboutOfferTitle: "আমরা কী অফার করি",
    aboutOffer1Title: "ব্যক্তিগত সাহচর্য",
    aboutOffer1Desc: "কথা বলা, রেস্তোরাঁয় খাওয়া, ক্যাফেতে আড্ডা, শপিং এবং সামাজিক অনুষ্ঠানের জন্য সঙ্গী।",
    aboutOffer2Title: "শহর ও ভ্রমণ সঙ্গী",
    aboutOffer2Desc: "দর্শনীয় স্থান পরিদর্শন, শহরের নতুন জায়গা ঘোরা এবং দেশ-বিদেশে ভ্রমণের জন্য সঙ্গী।",
    aboutOffer3Title: "অনুষ্ঠান ও কার্যক্রম",
    aboutOffer3Desc: "বিয়েবাড়ি, কনসার্ট, খেলার স্টেডিয়াম, মেলা ও ফিটনেস কার্যক্রমে সঙ্গ দেওয়ার সেবা।",
    aboutOffer4Title: "যত্ন ও সার্বক্ষণিক সহায়তা",
    aboutOffer4Desc: "বয়োজ্যেষ্ঠদের সাহচর্য, হাসপাতালে যাওয়ার সময় পাশে থাকা এবং দৈনন্দিন বাজার-কাজের সঙ্গী।",
    aboutValuesTitle: "আমাদের মূল মূল্যবোধ",
    aboutVal1Title: "নিরাপত্তা ও বিশ্বাস",
    aboutVal1Desc: "সম্পূর্ণ কেওয়াইসি, ওটিপি-যাচাইকৃত সাক্ষাৎ এবং জিরো-টলারেন্স নিরাপত্তা নীতি।",
    aboutVal2Title: "স্বাধীনতা ও নমনীয়তা",
    aboutVal2Desc: "স্বচ্ছ বুকিং, নিজস্ব সময়সূচি এবং সঙ্গীদের স্বাধীন মূল্য নির্ধারণের সুযোগ।",
    aboutVal3Title: "সম্মান ও মর্যাদা",
    aboutVal3Desc: "একটি নিরাপদ ও মর্যাদাপূর্ণ পরিবেশ যেখানে প্রত্যেকে পারস্পরিক শ্রদ্ধার সাথে যোগাযোগ করেন।",
    aboutVal4Title: "স্বচ্ছ উপার্জন ও সেটেলমেন্ট",
    aboutVal4Desc: "সঙ্গীদের জন্য ৮৫% নেট শেয়ার, ৪৮ ঘণ্টার ইউটিসি এসক্রো লক এবং স্পষ্ট হিসাব।",
    aboutCtaTitle: "পেয়ারআপটুডে অভিজ্ঞতার জন্য প্রস্তুত?",
    aboutCtaDesc: "ভারতজুড়ে হাজার হাজার ক্লায়েন্ট ও কম্প্যানিয়নের নিরাপদ প্ল্যাটফর্মে যোগ দিন।",
    aboutExploreBtn: "সঙ্গীদের তালিকা দেখুন",
    aboutJoinBtn: "কম্প্যানিয়ন হিসেবে যোগ দিন",

    // How It Works Page
    hiwBadge: "ধাপে ধাপে নির্দেশিকা",
    hiwTitle: "পেয়ারআপটুডে যেভাবে কাজ করে",
    hiwSubtitle: "গ্রাহক এবং সঙ্গী উভয়ের জন্যই তৈরি সহজ ও অত্যন্ত সুরক্ষিত পদ্ধতি।",
    hiwTabClient: "গ্রাহকদের জন্য",
    hiwTabCompanion: "সঙ্গীদের জন্য",
    hiwClientStepsTitle: "গ্রাহকদের যাত্রা (সহজ ৭টি ধাপ)",
    hiwStep1ClientTitle: "অ্যাকাউন্ট তৈরি করুন",
    hiwStep1ClientDesc: "আপনার মোবাইল নম্বর এবং পাসওয়ার্ড দিয়ে নিবন্ধন করুন এবং ৬-সংখ্যার ওটিপি যাচাই করুন।",
    hiwStep2ClientTitle: "প্রোফাইল ও কেওয়াইসি সম্পন্ন করুন",
    hiwStep2ClientDesc: "সরকারি পরিচয়পত্র এবং লাইভ সেলফি জমা দিয়ে অ্যাকাউন্ট সক্রিয় করার আবেদন করুন।",
    hiwStep3ClientTitle: "সঙ্গী খুঁজুন",
    hiwStep3ClientDesc: "অবস্থান, আগ্রহের বিষয়, পছন্দের সেবা এবং প্রতি ঘণ্টার বাজেট অনুযায়ী সঙ্গী ফিল্টার করুন।",
    hiwStep4ClientTitle: "পছন্দের সঙ্গী নির্বাচন করুন",
    hiwStep4ClientDesc: "সঙ্গীর সম্পূর্ণ প্রোফাইল, ছবি, পরিচয় এবং নির্ধারিত সেবার মূল্য পর্যালোচনা করুন।",
    hiwStep5ClientTitle: "বুকিং নিশ্চিত করুন",
    hiwStep5ClientDesc: "তারিখ, সময় ও সময়সীমা নির্বাচন করে পেয়ারআপ সিকিউর ভল্টের মাধ্যমে স্বচ্ছ পেমেন্ট করুন।",
    hiwStep6ClientTitle: "সাক্ষাৎ করুন ও সময় কাটান",
    hiwStep6ClientDesc: "নির্ধারিত সর্বজনীন স্থানে সাক্ষাৎ করুন এবং সেশন শুরু করতে আপনার স্টার্ট ওটিপি দিন।",
    hiwStep7ClientTitle: "বুকিং সমাপ্ত করুন",
    hiwStep7ClientDesc: "সেশন শেষে কম্প্যানিয়নকে সমাপ্তি ওটিপি প্রদান করে সাক্ষাৎ সফলভাবে শেষ করুন।",
    hiwCompanionStepsTitle: "কম্প্যানিয়নদের যাত্রা (সহজ ৬টি ধাপ)",
    hiwStep1CompTitle: "কম্প্যানিয়ন নিবন্ধন",
    hiwStep1CompDesc: "মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে সাইন ইন করুন এবং ওটিপি কোড যাচাই করুন।",
    hiwStep2CompTitle: "বাধ্যতামূলক কেওয়াইসি পূরণ",
    hiwStep2CompDesc: "অ্যাডমিন নিরীক্ষার জন্য আপনার বৈধ সরকারি পরিচয়পত্র এবং স্পষ্ট সেলফি আপলোড করুন।",
    hiwStep3CompTitle: "সেবা ও মূল্য নির্ধারণ",
    hiwStep3CompDesc: "অনুমোদিত ৩৬টি সেবার মধ্যে কোনগুলো প্রদান করতে চান এবং প্রতি ঘণ্টার রেট ঠিক করুন।",
    hiwStep4CompTitle: "মেম্বারশিপ সক্রিয় করুন",
    hiwStep4CompDesc: "বুকিং গ্রহণ সক্রিয় করতে মেম্বারশিপ প্ল্যান (স্টার্টার ₹৪৪৯, প্রো ₹১,০৯৯, প্রিমিয়াম ₹৫,৯৯৯) বেছে নিন।",
    hiwStep5CompTitle: "ব্যাংক অ্যাকাউন্ট যাচাই",
    hiwStep5CompDesc: "আপনার অ্যাকাউন্টে সরাসরি অর্থ পেতে ব্যাংক অ্যাকাউন্ট ও আইএফএসসি কোড যাচাই করুন।",
    hiwStep6CompTitle: "লাইভ হন ও উপার্জন করুন",
    hiwStep6CompDesc: "৩টি শর্ত পূরণ হলেই আপনার প্রোফাইল লাইভ হবে। বুকিং গ্রহণ করুন ও ৮৫% শেয়ার পান।",
    hiwSafetyTitle: "নিরাপত্তায় আমাদের অঙ্গীকার",
    hiwSafetyText: "পেয়ারআপটুডে শুধুমাত্র পেশাদার সাহচর্য সেবা। যেকোনো অসদাচরণ, হয়রানি বা অনৈতিক কার্যকলাপের ক্ষেত্রে জিরো-টলারেন্স নীতি বজায় রাখা হয়। সমস্ত সাক্ষাৎ পাবলিক স্থানে ওটিপি সুরক্ষায় অনুষ্ঠিত হয়।",
    hiwClientCta: "গ্রাহক হিসেবে নিবন্ধন করুন (ফ্রি)",
    hiwCompanionCta: "কম্প্যানিয়ন হোস্ট হন",

    // Safety & Trust Page
    safetyBadge: "নিরাপত্তা ও সুরক্ষা প্রোটোকল",
    safetyTitle: "পেয়ারআপটুডে-তে নিরাপত্তা ও বিশ্বাস",
    safetySubtitle: "আমরা পারস্পরিক শ্রদ্ধা, পরিচয় যাচাইকরণ, অ্যাকাউন্টের সুরক্ষা এবং জরুরি সহায়তা নিশ্চিত করি।",
    safetyPillar1Title: "পরিচয় যাচাইকরণ ও অ্যাডমিন অনুমোদন",
    safetyPillar1Desc: "প্রতিটি ক্লায়েন্ট ও কম্প্যানিয়নের সরকারি আইডি (আধার, প্যান, ভোটার বা পাসপোর্ট) ও লাইভ সেলফি কেওয়াইসি নিরীক্ষা করা হয়। অনুমোদন না পাওয়া পর্যন্ত প্রোফাইল নিষ্ক্রিয় থাকে।",
    safetyPillar2Title: "দ্বৈত ওটিপি-ভিত্তিক সাক্ষাতের সুরক্ষা",
    safetyPillar2Desc: "৬-সংখ্যার গোপন ওটিপি দিয়ে অ্যাকাউন্ট ও সাক্ষাৎ সুরক্ষিত। গ্রাহকের স্টার্ট ওটিপি ছাড়া সেশন শুরু হয় না এবং কমপ্লিশন ওটিপি ছাড়া শেষ হয় না।",
    safetyPillar3Title: "নিরাপদ অনলাইন এসক্রো পেমেন্ট",
    safetyPillar3Desc: "সমস্ত পেমেন্ট পেয়ারআপ সিকিউর ভল্টের মাধ্যমে সংরক্ষিত থাকে। সাক্ষাৎ শেষের পর ৪৮ ঘণ্টার ইউটিসি এসক্রো লক রাখা হয় যাতে যেকোনো সমস্যা সমাধান করা যায়।",
    safetyPillar4Title: "অ্যাপের ভেতর সুরক্ষিত চ্যাট",
    safetyPillar4Desc: "ব্যক্তিগত ফোন নম্বর বা সোশ্যাল মিডিয়া হ্যান্ডেল শেয়ার না করেই অ্যাপের মধ্যে সঙ্গীর সাথে যোগাযোগ করুন।",
    safetyPillar5Title: "২৪/৭ জরুরি হেল্পলাইন ও এসওএস",
    safetyPillar5Desc: "সরাসরি ভারতের সরকারি জরুরি হেল্পলাইন — পুলিশ ১০০ এবং জাতীয় জরুরি ১১২ নম্বরে যোগাযোগের সুবিধা প্রতিটি স্ক্রিনে উপলব্ধ।",
    safetyPillar6Title: "জিরো-টলারেন্স কমিউনিটি নীতিমালা",
    safetyPillar6Desc: "পেয়ারআপটুডে কোনো যৌন বা অনৈতিক কার্যক্রম সমর্থন করে না। নিয়ম লঙ্ঘন করলে আজীবন বহিষ্কার করা হয়।",
    safetyCommunityTitle: "কমিউনিটি নির্দেশিকা",
    safetyRule1: "সর্বদা উন্মুক্ত ও আলো ঝলমলে স্থানে (যেমন ক্যাফে, রেস্তোরাঁ, শপিং মল বা পর্যটন কেন্দ্রে) সাক্ষাৎ করুন।",
    safetyRule2: "ব্যক্তিগত ব্যাংকিং তথ্য, ওটিপি বা বাড়ির সঠিক ঠিকানা অন্য কারো সাথে শেয়ার করবেন না।",
    safetyRule3: "প্রত্যেক সদস্যের সাথে সম্মানজনক, বিনম্র ও মর্যাদাপূর্ণ আচরণ করুন।",
    safetyRule4: "প্ল্যাটফর্মের বুকিং বা ওটিপি প্রক্রিয়া এড়িয়ে অফ-প্ল্যাটফর্ম কোনো লেনদেন করবেন না।",
    safetyEmergencyTitle: "জরুরি যোগাযোগ",
    safetyEmergencyDesc: "সাক্ষাৎকালে কোনো প্রকার অস্বস্তিকর বা অনিরাপদ পরিস্থিতি দেখা দিলে অবিলম্বে জরুরি নম্বরে কল করুন:",

    // Auth Gateway Modal
    authGatewayTitle: "পেয়ারআপটুডে প্রবেশদ্বার",
    authGatewaySubtitle: "গ্রাহক এবং কম্প্যানিয়নদের জন্য সুরক্ষিত প্রবেশপথ",
    tabLogin: "লগইন",
    tabSignIn: "সাইন ইন",
    phoneLabel: "ভারতীয় মোবাইল নম্বর (+91)",
    phonePlaceholder: "১০ ডিজিটের মোবাইল নম্বর লিখুন",
    passwordLabel: "পাসওয়ার্ড",
    passwordPlaceholder: "শক্তিশালী পাসওয়ার্ড দিন",
    otpLabel: "৬-সংখ্যার ওটিপি",
    otpPlaceholder: "মোবাইলে আসা ওটিপি লিখুন",
    sendOtp: "ওটিপি পাঠান",
    resendOtp: "পুনরায় ওটিপি পাঠান",
    resendIn: "পুনরায় পাঠানো যাবে",
    verifyAndContinue: "ওটিপি যাচাই করে এগিয়ে যান",
    loginButton: "পেয়ারআপটুডে-তে প্রবেশ করুন",
    unregisteredMessagePrefix: "এখনো অ্যাকাউন্ট নেই? অনুগ্রহ করে ",
    unregisteredMessageLink: "সাইন ইন",
    unregisteredMessageSuffix: " করে নতুন অ্যাকাউন্ট খুলুন।",
    invalidCredentialsMessage: "ভুল মোবাইল নম্বর বা পাসওয়ার্ড। অনুগ্রহ করে পরীক্ষা করে পুনরায় চেষ্টা করুন।",
    securityBranding: "PairUp Security Network",
    errorPhoneRequired: "অনুগ্রহ করে সঠিক ১০-সংখ্যার ভারতীয় মোবাইল নম্বর (+91) দিন।",
    errorPhonePasswordRequired: "মোবাইল নম্বর এবং পাসওয়ার্ড উভয়ই আবশ্যক।",
    errorOtpRequired: "আপনার ফোনে পাঠানো ৬-সংখ্যার ওটিপি লিখুন।",

    // Role Selection Modal
    roleSelectionTitle: "আপনার কর্মক্ষেত্র নির্বাচন করুন",
    roleSelectionSubtitle: "এই সেশনে কীভাবে প্রবেশ করতে চান নির্বাচন করুন",
    enterAsClient: "গ্রাহক সদস্য হিসেবে প্রবেশ করুন",
    enterAsClientDesc: "যাচাইকৃত সঙ্গী খুঁজুন ও বুকিং করুন। ১০০% বিনামূল্যে মেম্বারশিপ।",
    enterAsCompanion: "কম্প্যানিয়ন হোস্ট হিসেবে প্রবেশ করুন",
    enterAsCompanionDesc: "সেবা পরিচালনা করুন, বুকিং গ্রহণ করুন এবং ৮৫% নেট শেয়ার উপার্জন করুন।",
    roleSecurityNotice: "পেয়ারআপ ভেরিফাইড নেটওয়ার্ক অনুমোদন",

    // KYC Wizard Modal
    kycWizardTitle: "একীভূত প্রোফাইল ও কেওয়াইসি যাচাইকরণ",
    kycWizardSubtitle: "কমিউনিটির নিরাপত্তা ও বিশ্বাস নিশ্চিত করতে বিবরণ জমা দিন",
    ageGateAgreement: "আমি নিশ্চিত করছি যে আমার বয়স ১৮ বছর বা তার বেশি",
    legalNameLabel: "অফিসিয়াল বৈধ নাম (সরকারি আইডি অনুযায়ী)",
    legalNamePlaceholder: "আইডি কার্ডের সাথে সম্পূর্ণ নাম মিলিয়ে লিখুন",
    dobLabel: "জন্ম তারিখ",
    dobNotice: "কেওয়াইসি জমা দেওয়ার পর জন্ম তারিখ পরিবর্তন করা যাবে না (১৮+ হওয়া বাধ্যতামূলক)।",
    idTypeLabel: "সরকারি আইডির ধরণ",
    idFrontLabel: "আইডি কার্ডের সামনের ছবি",
    idBackLabel: "আইডি কার্ডের পেছনের ছবি",
    selfieLabel: "স্পষ্ট লাইভ সেলফি",
    bioLabel: "সংক্ষিপ্ত পরিচয়",
    bioPlaceholder: "আপনার শখ, পছন্দ এবং ব্যক্তিত্ব সম্পর্কে ক্লায়েন্টদের জানান...",
    profileNameLabel: "প্রোফাইল প্রদর্শন নাম *",
    profileNamePlaceholder: "পাবলিক নাম লিখুন (যেমনঃ রাহুল, প্রিয়া, সম্রাট)",
    profileNameHelp: "এই নামটি অন্যান্যদের কাছে প্রদর্শিত হবে। আপনার সরকারি আইডি-র মূল নাম ১০০% গোপন থাকবে।",
    profileSectionTitle: "পাবলিক প্রোফাইল নাম ও পরিচয়",
    profileSectionSubtitle: "আপনার প্রদর্শন নাম, ছবি গ্যালারি এবং বায়ো পরিচালনা করুন। সরকারি পরিচয়পত্র সম্পূর্ণ গোপন ও সুরক্ষিত থাকে।",
    profilePrivacyBadge: "গোপনীয়তা সুরক্ষিত",
    profileSaveBtn: "প্রোফাইল সেভ করুন",
    profileSavingBtn: "সেভ হচ্ছে...",
    profilePhotosSection: "প্রোফাইল ও গ্যালারি ফটো (সর্বোচ্চ ৬)",
    profilePhotosHelp: "সর্বোচ্চ ৬টি ছবি আপলোড করতে পারবেন। যেকোনো ছবিকে মূল প্রোফাইল ছবি হিসেবে নির্বাচন করুন।",
    profileUploadBtn: "ছবি আপলোড করুন",
    profileSetMainBtn: "মূল ছবি করুন",
    profileMainBadge: "★ মূল ছবি",
    profileLockedIdentityTitle: "যাচাইকৃত সরকারি পরিচয় (স্থায়ীভাবে লক করা)",
    profileLockedIdentityHelp: "প্ল্যাটফর্মের নিরাপত্তা রক্ষার্থে সরকারি পরিচয়পত্র অনুযায়ী নাম ও জন্মতারিখ পরিবর্তন করা যাবে না।",
    profileLegalNameLocked: "অফিসিয়াল বৈধ নাম (সরকারি আইডি)",
    profileDobLocked: "জন্ম তারিখ ও বয়স",
    profilePhoneLocked: "নিবন্ধিত ফোন নম্বর",
    profileSuccessMsg: "প্রোফাইল সফলভাবে আপডেট হয়েছে!",
    photosLabel: "প্রোফাইল ছবি (সর্বোচ্চ ৬টি)",
    fileChooseText: "ফাইল বা ছবি নির্বাচন করুন",
    fileAttachedText: "ডকুমেন্ট আপলোড সম্পন্ন ✓",
    submitKyc: "কেওয়াইসি জমা দিন",
    kycSubmittedNotice: "কেওয়াইসি সফলভাবে জমা হয়েছে। নিয়মানুযায়ী আপনার সেশন বন্ধ করা হয়েছে। অনুগ্রহ করে আবার লগইন করুন।",
    kycPendingBanner: "কেওয়াইসি প্রক্রিয়াধীন: আমাদের নিরীক্ষা দল আপনার নথি যাচাই করছে।",
    kycApprovedBanner: "কেওয়াইসি অনুমোদিত: আপনার পরিচয় সফলভাবে প্রমাণিত হয়েছে।",

    // Client Dashboard
    clientInactiveTitle: "ক্লায়েন্ট প্রোফাইল নিষ্ক্রিয়: কেওয়াইসি অনুমোদনের অপেক্ষায়",
    clientActiveTitle: "ক্লায়েন্ট প্রোফাইল সক্রিয়",
    clientFreeMembershipNotice: "গ্রাহকদের জন্য ১০০% বিনামূল্যে: ব্রাউজ বা বুকিং করার জন্য কোনো ফি দিতে হয় না। কেবল নির্দিষ্ট সেশনের স্বচ্ছ খরচ প্রদেয়।",
    clientFreeActiveTag: "বিনামূল্যে সক্রিয় অ্যাক্সেস (₹০)",
    tabOverview: "ওভারভিউ",
    tabProfile: "আমার প্রোফাইল",
    tabKycStatus: "কেওয়াইসি স্ট্যাটাস",
    tabDiscover: "সঙ্গী খুঁজুন",
    tabServices: "৩৬টি সার্ভিস",
    tabBookings: "আমার বুকিং",
    tabHistory: "বুকিং হিস্ট্রি",
    tabChat: "সুরক্ষিত চ্যাট",
    tabNotifications: "বিজ্ঞপ্তি",
    tabPayments: "পেমেন্ট",
    tabSafety: "নিরাপত্তা ও এসওএস",
    tabSafetyAndHelp: "সাহায্য ও সুরক্ষা",
    tabSettings: "সেটিংস",
    welcomeBack: "স্বাগতম",
    findPerfectCompanion: "আসুন আপনার জন্য উপযুক্ত সঙ্গী খুঁজে নিই...",
    exploreMatches: "ম্যাচ খুঁজুন",
    totalMatches: "মোট ম্যাচ",
    thisMonth: "এই মাসে",
    upcomingPlans: "আপনার আসন্ন পরিকল্পনা দেখুন",
    kycVerified: "কেওয়াইসি যাচাইকৃত",
    accountVerified: "আপনার অ্যাকাউন্ট যাচাই সম্পন্ন",
    viewProfile: "প্রোফাইল দেখুন",
    bookNow: "বুকিং করুন",
    smartFilterAll: "সকল",
    smartFilterOnline: "অনলাইন",
    smartFilterSuggested: "পরামর্শিত",
    viewAll: "সবগুলো দেখুন",
    showLess: "কম দেখুন",
    searchAndFilters: "অনুসন্ধান ও ফিল্টার",
    discoverCompanionsPlaceholder: "সঙ্গী খুঁজুন...",
    loginAs: "কী হিসেবে লগইন করবেন",
    asClient: "গ্রাহক হিসেবে",
    asCompanion: "কম্প্যানিয়ন হিসেবে",
    goBack: "ফিরে যান",
    logoutText: "লগআউট",
    findCompanionsTitle: "যাচাইকৃত সঙ্গী খুঁজুন",
    searchPlaceholder: "শহর, নাম বা পছন্দের বিষয় দিয়ে খুঁজুন...",
    filterByService: "সার্ভিস অনুযায়ী ফিল্টার",
    filterByCity: "শহর",
    allServices: "সকল ৩৬টি সার্ভিস",
    allCities: "সকল শহর",
    maxBudget: "সর্বোচ্চ বাজেট / ঘণ্টা",
    nearbyCompanions: "নিকটবর্তী সঙ্গী (জিপিএস সক্রিয়)",
    gpsActive: "জিপিএস অবস্থান সক্রিয়",
    companionStatusLive: "লাইভ কম্প্যানিয়ন",
    verifiedKycBadge: "যাচাইকৃত কেওয়াইসি",
    perHourRate: "/ ঘণ্টা",
    bookCompanion: "বুকিং করুন",
    bookingHistory: "আমার বুকিং তালিকা",
    upcomingBookings: "আসন্ন বুকিং",
    pastBookings: "পূর্ববর্তী বুকিং",
    noBookingsYet: "এখনো কোনো বুকিং নেই। আপনার প্রথম অভিজ্ঞতার জন্য সঙ্গী নির্বাচন করুন।",
    bookingCodeLabel: "বুকিং কোড",
    startOtpLabel: "মিটিং শুরু ওটিপি",
    completionOtpLabel: "মিটিং সমাপ্তি ওটিপি",
    clientOtpInstruction: "এই ওটিপি কোডটি সাক্ষাতের সময় কেবল সামনাসামনি কম্প্যানিয়নকে প্রদান করুন।",
    bookingConfirmedStatus: "নিশ্চিত",
    bookingCompletedStatus: "সম্পন্ন",
    selectSlot: "তারিখ ও সময় নির্ধারণ করুন",
    dateLabel: "সাক্ষাতের তারিখ",
    timeLabel: "শুরুর সময়",
    durationHours: "সময়সীমা (ঘণ্টা)",
    meetingLocationLabel: "সাক্ষাতের স্থান (পাবলিক প্লেস)",
    notesLabel: "বিশেষ অনুরোধ বা মন্তব্য",
    totalAmount: "মোট প্রদেয় অর্থ",
    payAndConfirm: "পেমেন্ট করে বুকিং নিশ্চিত করুন",
    confirmBookingTitle: "সাহচর্য সেশন সময়সূচি",
    cancellationNotice: "কম্প্যানিয়ন দেরিতে পৌঁছালে দেরির মিনিট অনুযায়ী জরিমানার টাকা ফেরত দেওয়া হয়।",

    // Companion Dashboard
    companionActivationTitle: "কম্প্যানিয়ন অনবোর্ডিং ও অ্যাক্টিভেশন",
    companionLiveBadge: "কম্প্যানিয়ন স্ট্যাটাস: লাইভ",
    companionInactiveBadge: "কম্প্যানিয়ন স্ট্যাটাস: নিষ্ক্রিয়",
    stepServices: "১. সার্ভিস ও রেট",
    stepMembership: "২. মেম্বারশিপ",
    stepBank: "৩. ব্যাংক ভেরিফিকেশন",
    gateKycTitle: "কেওয়াইসি পরিচয় নিরীক্ষা",
    gateMembershipTitle: "কম্প্যানিয়ন মেম্বারশিপ",
    gateBankTitle: "ব্যাংক অ্যাকাউন্ট যাচাই",
    membershipPlanStarter: "STARTER",
    membershipPlanPro: "PROFESSIONAL",
    membershipPlanPremium: "PREMIUM",
    starterPriceText: "₹৪৪৯ / ১ মাস",
    proPriceText: "₹১,০৯৯ / ৩ মাস",
    premiumPriceText: "₹৫,৯৯৯ / ১ বছর",
    starterDurationText: "৩০ দিন মেয়াদ",
    proDurationText: "৯০ দিন মেয়াদ",
    premiumDurationText: "৩৬৫ দিন মেয়াদ",
    purchaseMembershipPlan: "মেম্বারশিপ প্ল্যান কিনুন",
    bankAccountLabel: "ব্যাংক অ্যাকাউন্ট নম্বর",
    bankAccountPlaceholder: "অ্যাকাউন্ট নম্বর লিখুন",
    ifscLabel: "আইএফএসসি কোড",
    ifscPlaceholder: "যেমন: HDFC0001234",
    accountHolderLabel: "হোল্ডারের নাম (কেওয়াইসির সাথে মিল থাকতে হবে)",
    accountHolderPlaceholder: "ব্যাংক অ্যাকাউন্টে থাকা সঠিক নাম",
    verifyBank: "ব্যাংক অ্যাকাউন্ট যাচাই করুন",
    walletBalance: "ওয়ালেট ওভারভিউ",
    lockedEarnings: "লক করা আয় (৪৮ ঘণ্টা ইউটিসি হোল্ড)",
    availableEarnings: "উপলব্ধ সেটেলমেন্ট",
    hourlyRateSettings: "প্রতি ঘণ্টার রেট নির্ধারণ করুন",
    saveRates: "সংরক্ষণ করুন",
    meetingArrivedAction: "স্লাইড: মিটিং স্থানে পৌঁছেছি",
    startOtpTitle: "মিটিং শুরু ওটিপি যাচাই",
    enterStartOtp: "গ্রাহকের ৬-সংখ্যার ওটিপি দিন",
    enterCompletionOtp: "সমাপ্তির ওটিপি লিখুন",
    delayMinutesLabel: "দেরি হলে বিলম্বের মিনিট সংখ্যা",
    verifyOtpButton: "ওটিপি যাচাই করে সেশন শুরু করুন",
    countdownActive: "সক্রিয় সেশন টাইমার",
    completeBookingAction: "বুকিং সম্পন্ন করুন",

    // SOS & Emergency Hub
    sosEmergencyHub: "পেয়ারআপ সেফটি ও এসওএস হাব",
    sosEmergencySubtitle: "তাত্ক্ষণিক জরুরি সহায়তা এবং দ্রুত সুরক্ষা ব্যবস্থা",
    emergencyHotline100: "পুলিশ হেল্পলাইন: ১০০",
    emergencyHotline112: "জাতীয় জরুরি এসওএস: ১১২",
    emergencyHotline100Desc: "স্থানীয় পুলিশ প্যাট্রোল এবং তাৎক্ষণিক প্রতিক্রিয়ার সরাসরি সংযোগ।",
    emergencyHotline112Desc: "সমগ্র ভারতে সমন্বিত জরুরি সহায়তা সেবা।",
    safetyTipTitle: "নিরাপত্তা পরামর্শ",
    safetyTipText: "সাক্ষাৎ সর্বদা সর্বজনীন উন্মুক্ত স্থানে হওয়া আবশ্যক। অস্বস্তি বা নীতিমালা লঙ্ঘন অনুভব করলে সাথে সাথে সেশন সমাপ্ত করুন।",

    // Footer & Contact With Us
    footerMission: "PairUpToday — Your Time. Your Choice. Your Companion.",
    footerRights: "© ২০২৬ পেয়ারআপটুডে। সর্বস্বত্ব সংরক্ষিত। PairUp Security Network দ্বারা সুরক্ষিত।",
    footerPlatformNav: "প্ল্যাটফর্ম নেভিগেশন",
    footerContactWithUs: "যোগাযোগ করুন",
    footerFacebookLabel: "ফেসবুক",
    footerInstagramLabel: "ইনস্টাগ্রাম",
    footerEmailLabel: "Support@pairuptoday.com",
    footerEmergencyAssistance: "জরুরি সহায়তা",
    footerPoliceEmergency: "পুলিশ হেল্পলাইন",
    footerNationalSos: "জাতীয় জরুরি এসওএস",
    footerBuiltWithLove: "উন্নত সংযোগ। উজ্জ্বল মুহূর্ত।",
    footerCopyEmail: "ইমেল কপি করুন",
    footerEmailCopied: "ইমেল কপি করা হয়েছে: Support@pairuptoday.com",

    // Common UI Actions
    closeAction: "বন্ধ করুন",
    cancelAction: "বাতিল করুন",
    confirmAction: "নিশ্চিত করুন",
    loadingAction: "অপেক্ষা করুন...",
    copiedAction: "কপি সম্পন্ন!",

    // Companion Listing & Profile Details
    companionListSectionTitle: "ভারতজুড়ে যাচাইকৃত কম্প্যানিয়ন",
    companionListSectionSubtitle: "৩৬টি সাহচর্য সেবার জন্য আপনার শহরের যাচাইকৃত সঙ্গী অন্বেষণ করুন।",
    quickViewAction: "প্রোফাইল দেখুন",
    bookNowAction: "বুকিং করুন",
    availableServicesLabel: "উপলব্ধ সেবাসমূহ",
    profileUnavailableForBooking: "এই প্রোফাইলটি বর্তমানে বুকিংয়ের জন্য উপলব্ধ নয়।",
    ageYearsLabel: "বছর",
    ratePerHourLabel: "₹{rate}/ঘণ্টা",
    selectLocationLabel: "শহর / অবস্থান নির্বাচন করুন",
    allLocationsLabel: "সকল অবস্থান",
    filterByServiceLabel: "সার্ভিস অনুযায়ী ফিল্টার",
    allServicesLabel: "সকল ৩৬টি সার্ভিস",
    viewDetailsAction: "প্রোফাইল দেখুন",
    additionalPhotosLabel: "অতিরিক্ত আলোকচিত্র",
    aboutSlogan: "PairUpToday — আপনার সময়। আপনার পছন্দ। আপনার সঙ্গী।",
    hiwClientStepsDesc: "নিরাপদে আপনার আদর্শ সঙ্গী খুঁজে নেওয়ার ৭টি সহজ ধাপ।",
    hiwClientTagline: "আপনার সময়। আপনার পছন্দ। আপনার নিখুঁত সঙ্গী।",
    hiwCompanionStepsDesc: "নিরাপদে যুক্ত হওয়া, সক্রিয় হওয়া এবং ৮৫% নেট উপার্জন পাওয়ার ৬টি সম্পূর্ণ ধাপ।",
    hiwCompanionTagline: "আপনার সময়। আপনার দক্ষতা। আপনার আয়ের সুযোগ।",
    safetyEmergencyHeadline: "একটি অভিজ্ঞতার সময় যেকোনো নিরাপত্তা উদ্বেগের ক্ষেত্রে",
    policeLabel: "পুলিশ: ১০০",
    sosLabel: "জরুরি সাহায্য (SOS): ১১২",
    safetyTagline: "PairUpToday — শুধুই সঙ্গ নয়। একটি উৎকৃষ্ট অভিজ্ঞতা।",

    termsBadge: "অফিসিয়াল প্ল্যাটফর্ম পলিসি",
    termsTitle: "শর্তাবলী ও নীতিমালা – Pairup Today",
    termsLastUpdated: "সর্বশেষ আপডেট: ২৩ নভেম্বর, ২০২৬",
    termsIntro: "Pairup Today-তে স্বাগতম (\"আমরা\", \"আমাদের\" বা \"আমাদের প্ল্যাটফর্ম\")। Pairup Today এমন একটি প্ল্যাটফর্ম যা নিরীহ সামাজিক মেলামেশা, বন্ধুত্বপূর্ণ কার্যকলাপ ও সাহচর্যের জন্য ক্লায়েন্টদের যাচাইকৃত সঙ্গীদের সাথে যুক্ত করে (\"পরিষেবা\")। Pairup Today-তে নিবন্ধন, বুকিং বা পরিষেবা প্রদান করার মাধ্যমে আপনি এই পরিষেবার শর্তাবলী (\"শর্তাবলী\") দ্বারা আইনত আবদ্ধ হতে সম্মত হন।",

    termsSec1Title: "১. পরিষেবার ধরন ও কঠোর এসকর্ট-বিরোধী নীতি",
    termsSec1P1Title: "শুধুমাত্র নিষ্পাপ ও বন্ধুত্বপূর্ণ সঙ্গ (Platonic Companionship):",
    termsSec1P1Desc: "Pairup Today কঠোরভাবে শুধুমাত্র নির্দোষ, বন্ধুত্বপূর্ণ এবং সামাজিক সাহচর্যের (যেমন খাবার খাওয়া, কোনো অনুষ্ঠানে যোগ দেওয়া, কথাবার্তা বা দর্শনীয় স্থান ভ্রমণ) জন্য একটি প্ল্যাটফর্ম।",
    termsSec1P2Title: "কোনো এসকর্ট বা অ্যাডাল্ট পরিষেবা নয়:",
    termsSec1P2Desc: "Pairup Today কোনো ধরনের এসকর্ট, ডেটিং, যৌন বা প্রাপ্তবয়স্কদের পরিষেবা কঠোরভাবে প্রদান করে না।",
    termsSec1P3Title: "শূন্য সহনশীলতা ও কঠোর আইনি ব্যবস্থা:",
    termsSec1P3Desc: "যৌন সুবিধা চাওয়া বা প্রচার করা, মানব পাচার, প্রতারণা বা যেকোনো বেআইনি কার্যকলাপ সম্পূর্ণরূপে নিষিদ্ধ। এই নিয়ম লঙ্ঘনকারী যেকোনো ব্যবহারকারী বা সঙ্গীর অ্যাকাউন্ট অবিলম্বে স্থায়ীভাবে বাতিল করা হবে এবং ভারতের প্রযোজ্য আইনের অধীনে কঠোর আইনি ব্যবস্থা (আইন প্রয়োগকারী সংস্থার কাছে রিপোর্ট করা সহ) নেওয়া হবে।",

    termsSec2Title: "২. যোগ্যতা, স্বেচ্ছায় অংশগ্রহণ ও যাচাইকরণ",
    termsSec2P1Title: "স্বেচ্ছায় নিবন্ধন ও স্বাধীন ইচ্ছা:",
    termsSec2P1Desc: "ক্লায়েন্ট এবং সঙ্গী উভয়ই নিশ্চিত করেন যে তারা সম্পূর্ণ নিজেদের স্বাধীন ইচ্ছা ও পছন্দের ভিত্তিতে আমাদের প্ল্যাটফর্মে নিবন্ধন, বুকিং বা পরিষেবা প্রদান করছেন। আমরা কাউকে কোনো মিথ্যা প্রতিশ্রুতি বা প্রলোভন দেখিয়ে যোগদান করতে বাধ্য করিনি।",
    termsSec2P2Title: "বয়সের প্রয়োজনীয়তা:",
    termsSec2P2Desc: "Pairup Today ব্যবহার করার জন্য ক্লায়েন্ট এবং সঙ্গী উভয়েরই বয়স কমপক্ষে ১৮ বছর হতে হবে।",
    termsSec2P3Title: "বাধ্যতামূলক যাচাইকরণ:",
    termsSec2P3Desc: "অনুরোধ করা হলে ব্যবহারকারীদের সঠিক ব্যক্তিগত তথ্য এবং বৈধ সরকারি পরিচয়পত্র (ID Proof) প্রদান করতে হবে। ভুয়ো প্রোফাইল স্থায়ীভাবে নিষিদ্ধ করা হবে।",

    termsSec3Title: "৩. বুকিং, পেমেন্ট ও প্ল্যাটফর্ম ফি (১৫% কমিশন)",
    termsSec3P1Title: "ক্লায়েন্ট পেমেন্ট:",
    termsSec3P1Desc: "একটি সেশন নিশ্চিত করতে ক্লায়েন্টদের অবশ্যই Pairup Today প্ল্যাটফর্মের মাধ্যমে অগ্রিম পুরো বুকিংয়ের অর্থ প্রদান করতে হবে।",
    termsSec3P2Title: "সঙ্গীর পারিশ্রমিক ও ১৫% প্ল্যাটফর্ম ফি:",
    termsSec3P2Desc: "সঙ্গীর মোট উপার্জিত বুকিং অর্থ থেকে আমরা ১৫% প্ল্যাটফর্ম সার্ভিস ফি কর্তন করি। বুকিং সফলভাবে সম্পন্ন হওয়ার পর অবশিষ্ট ৮৫% সঙ্গীর নিবন্ধিত পেআউট অ্যাকাউন্টে জমা হবে।",
    termsSec3P3Title: "প্ল্যাটফর্মের বাইরে কোনো লেনদেন নয়:",
    termsSec3P3Desc: "সকল বুকিং এবং পেমেন্ট কঠোরভাবে আমাদের অ্যাপের মাধ্যমে হতে হবে। প্ল্যাটফর্মকে এড়িয়ে নগদ টাকা বা সরাসরি অর্থ আদান-প্রদান করা এই শর্তাবলীর লঙ্ঘন এবং এর ফলে অ্যাকাউন্ট স্থগিত করা হবে।",
    termsSec3P4Title: "কার্যকলাপের খরচ:",
    termsSec3P4Desc: "পারস্পরিক সম্মতি ছাড়া, সরাসরি সাক্ষাতের সময় ক্লায়েন্ট তাদের নিজস্ব খরচ (খাবার, টিকিট, ভ্রমণ) বহনের জন্য দায়ী থাকবেন।",

    termsSec4Title: "৪. রিফান্ড ও বাতিলকরণ নীতি (Refund & Cancellation Policy)",
    termsSec4Intro: "আমরা বুঝি যে অপ্রত্যাশিত কারণে পরিকল্পনা পরিবর্তন হতে পারে। Pairup Today-তে বুকিং বাতিল এবং রিফান্ডের নিয়মাবলী নিচে দেওয়া হলো:",
    termsSec4ClientTitle: "ক্লায়েন্ট বাতিলকরণ নিয়মাবলী:",
    termsSec4ClientDesc: "নির্ধারিত সময়ের আগে একটি নিশ্চিত বুকিং বাতিল করলে নিম্নলিখিত স্ল্যাব অনুযায়ী রিফান্ড প্রদান করা হবে:",
    termsSec4Slab1: "নির্ধারিত সময়ের ১২ ঘণ্টার বেশি পূর্বে বাতিল করলে: বুকিংয়ের ১০০% সম্পূর্ণ অর্থ ফেরত।",
    termsSec4Slab2: "নির্ধারিত সময়ের ৩ থেকে ১২ ঘণ্টা পূর্বে বাতিল করলে: বুকিংয়ের ৫০% অর্থ ফেরত।",
    termsSec4Slab3: "নির্ধারিত সময়ের ৩ ঘণ্টার কম সময়ে বাতিল করলে: কোনো অর্থ ফেরত দেওয়া হবে না (বুকিংয়ের অর্থ বাজেয়াপ্ত হবে)।",
    termsSec4NoShowClientTitle: "ক্লায়েন্ট অনুপস্থিতি (No-Show):",
    termsSec4NoShowClientDesc: "যদি কোনো ক্লায়েন্ট পূর্ববর্তী বাতিলকরণ ছাড়াই নির্ধারিত সময়ে নির্দিষ্ট স্থানে উপস্থিত হতে ব্যর্থ হন (এবং স্টার্ট ওটিপি যাচাই না হয়), তবে কোনো রিফান্ড দেওয়া হবে না এবং সঙ্গীর ক্ষতিপূরণ হিসেবে অর্থ বাজেয়াপ্ত হবে। বারবার অনুপস্থিতির ফলে অ্যাকাউন্ট স্থগিত হতে পারে।",
    termsSec4NoShowCompTitle: "সঙ্গীর অনুপস্থিতির জরিমানা ও ১০০% রিফান্ড:",
    termsSec4NoShowCompDesc: "যদি কোনো সঙ্গী যুক্তিসঙ্গত কারণ ছাড়া নির্ধারিত সময়ে নির্দিষ্ট বুকিং স্থানে পৌঁছাতে ব্যর্থ হন:",
    termsSec4NoShowCompItem1: "১. ক্লায়েন্ট অবিলম্বে বুকিংয়ের সম্পূর্ণ ১০০% রিফান্ড ফেরত পাবেন।",
    termsSec4NoShowCompItem2: "২. সঙ্গীর বিরুদ্ধে আর্থিক জরিমানা (ওয়ালেট বা ভবিষ্যৎ পেআউট থেকে কর্তন) এবং/অথবা অ্যাকাউন্ট সাময়িক বা স্থায়ীভাবে স্থগিতের ব্যবস্থা নেওয়া হবে।",
    termsSec4EarlyEndTitle: "সময়ের পূর্বে প্রস্থান বা অসন্তুষ্টি:",
    termsSec4EarlyEndDesc: "পারস্পরিক সম্মতি বা ক্লায়েন্টের ইচ্ছায় নির্ধারিত সময়ের আগে সেশন সমাপ্ত হলে কোনো আংশিক রিফান্ড প্রযোজ্য হবে না। তবে কোনো অসদাচরণ বা নিয়ম লঙ্ঘনের কারণে সেশন বন্ধ হলে রিফান্ডের যোগ্যতা নির্ধারণে সাপোর্ট টিম বিষয়টি তদন্ত করবে।",
    termsSec4TechErrorsTitle: "প্রযুক্তিগত বা প্ল্যাটফর্ম ত্রুটি:",
    termsSec4TechErrorsDesc: "নেটওয়ার্ক বা গেটওয়ে ব্যর্থতার কারণে অর্থ কেটে নেওয়া হলেও বুকিং নিশ্চিত না হলে, ৪৮ ঘণ্টার মধ্যে পুরো অর্থ স্বয়ংক্রিয়ভাবে ফেরত দেওয়া হবে।",
    termsSec4TimelinesTitle: "রিফান্ড প্রক্রিয়ার সময়সীমা:",
    termsSec4TimelinesDesc: "অনুমোদিত রিফান্ড অবিলম্বে শুরু করা হয় এবং মূল পেমেন্ট মাধ্যমে জমা হয়:",
    termsSec4TimelineUpi: "ইউপিআই (UPI): ১–৫ কার্যদিবস",
    termsSec4TimelineNb: "নেট ব্যাংকিং (Net Banking): ৩–৫ কার্যদিবস",
    termsSec4TimelineCards: "ক্রেডিট / ডেবিট কার্ড: ৫–৭ কার্যদিবস",
    termsSec4NonRefundTitle: "নন-রিফান্ডেবল আইটেম:",
    termsSec4NonRefundDesc: "ওয়ান-টাইম প্রোফাইল ভেরিফিকেশন ফি বা প্রিমিয়াম মেম্বারশিপ ফি (প্রযোজ্য ক্ষেত্রে) ভেরিফিকেশন প্রক্রিয়া শুরু হওয়ার পর অ-ফেরতযোগ্য।",
    termsSec4SupportTitle: "রিফান্ড সহায়তার জন্য যোগাযোগ:",
    termsSec4SupportDesc: "যেকোনো বাতিল বা রিফান্ড সংক্রান্ত প্রশ্নের জন্য আমাদের সহায়তা টিমের সাথে Support@pairuptoday.com-এ যোগাযোগ করুন।",

    termsSec5Title: "৫. নিরাপত্তা ও আচরণবিধি (Safety & Code of Conduct)",
    termsSec5P1Title: "শুধুমাত্র সার্বজনীন স্থান:",
    termsSec5P1Desc: "সরাসরি সমস্ত সাক্ষাৎ অবশ্যই নিরাপদ ও সার্বজনীন স্থানে (যেমন ক্যাফে, রেস্তোরাঁ, মল, পার্ক, পাবলিক ইভেন্ট) হতে হবে। ব্যক্তিগত বাড়ি, হোটেল রুম বা নির্জন স্থানে সাক্ষাৎ কঠোরভাবে নিষিদ্ধ।",
    termsSec5P2Title: "পারস্পরিক শ্রদ্ধা:",
    termsSec5P2Desc: "উভয় পক্ষকেই শ্রদ্ধাশীল আচরণ বজায় রাখতে হবে। হয়রানি, আপত্তিকর ভাষা, নেশাগ্রস্ত থাকা বা অনাকাঙ্ক্ষিত শারীরিক স্পর্শের কারণে অবিলম্বে সেশন সমাপ্ত হবে এবং স্থায়ী নিষেধাজ্ঞা জারি করা হবে।",
    termsSec5P3Title: "জরুরি প্রস্থান (Emergency Exit):",
    termsSec5P3Desc: "ক্লায়েন্ট প্ল্যাটোনিক নীতি লঙ্ঘন করলে বা অনুপযুক্ত আচরণ করলে একজন সঙ্গী তাৎক্ষণিকভাবে সেশন শেষ করতে পারবেন এবং এতে তাদের উপার্জিত পারিশ্রমিক বাতিল হবে না (আমাদের তদন্ত সাপেক্ষে)।",

    termsSec6Title: "৬. ডেটা গোপনীয়তা ও তথ্য নিরাপত্তা",
    termsSec6P1Title: "ব্যক্তিগত তথ্যের কঠোর গোপনীয়তা:",
    termsSec6P1Desc: "ক্লায়েন্ট এবং সঙ্গীদের সংবেদনশীল ব্যক্তিগত ও আর্থিক তথ্য—সরকারি আইডি প্রুফ, ফোন নম্বর, ইমেইল এবং ব্যাংক বিবরণী—আমাদের নিরাপত্তা ব্যবস্থার অধীনে কঠোরভাবে গোপন ও এনক্রিপ্ট করা থাকে।",
    termsSec6P2Title: "অননুমোদিত তথ্য প্রকাশ নয়:",
    termsSec6P2Desc: "আমরা অন্য কোনো ব্যবহারকারী বা অননুমোদিত তৃতীয় পক্ষের কাছে আপনার ব্যক্তিগত বা আর্থিক তথ্য বিক্রি, ভাড়া বা প্রকাশ করি না। তথ্য শুধুমাত্র পরিচয় যাচাই, নিরাপদ অর্থ লেনদেন এবং আইন প্রয়োগকারী সংস্থার অনুরোধে ভারতীয় আইনের বাধ্যবাধকতা মেনে চলার জন্য ব্যবহৃত হয়।",

    termsSec7Title: "৭. দায়বদ্ধতার সীমাবদ্ধতা (Limitation of Liability)",
    termsSec7P1Title: "স্বাধীন সঙ্গী (Independent Companions):",
    termsSec7P1Desc: "সঙ্গীরা স্বতন্ত্র ব্যক্তি, Pairup Today-এর কর্মচারী নন। আমরা শুধুমাত্র প্রযুক্তিগত সুবিধা প্রদানকারী প্ল্যাটফর্ম হিসেবে কাজ করি।",
    termsSec7P2Title: "ব্যক্তিগত দায়িত্ব:",
    termsSec7P2Desc: "সাক্ষাতের সময় ব্যবহারকারীরা তাদের ব্যক্তিগত নিরাপত্তা এবং মিথস্ক্রিয়ার জন্য সম্পূর্ণরূপে দায়ী। ব্যবহারকারীদের ব্যক্তিগত সম্পর্কের ফলে উদ্ভূত কোনো আঘাত, ক্ষতি বা বিরোধের জন্য Pairup Today দায়ী থাকবে না।",

    termsSec8Title: "৮. প্রযোজ্য আইন ও বিচারিক এখতিয়ার",
    termsSec8Desc: "এই শর্তাবলী ভারতের আইন অনুসারে পরিচালিত ও ব্যাখ্যা করা হবে। Pairup Today ব্যবহারের ফলে উদ্ভূত যেকোনো বিরোধ বা আইনি দাবি ভারতের উপযুক্ত আদালতের একচ্ছত্র এখতিয়ারাধীন হবে।",

    // Cancellation & Refund Workflow
    cancelBookingBtn: "বুকিং বাতিল করুন",
    cancelBookingModalTitle: "বুকিং বাতিলকরণ ও রিফান্ডের আবেদন",
    cancelBookingWarning: "নিশ্চিত করার পূর্বে বাতিলকরণ নীতিমালা দেখে নিন। একবার বাতিল সম্পন্ন হলে আপনার স্লটটি উন্মুক্ত হয়ে যাবে।",
    selectReasonLabel: "বাতিল করার কারণ নির্বাচন করুন",
    reasonChangeOfPlans: "পরিকল্পনা পরিবর্তন",
    reasonScheduleConflict: "সময়সূচী / সময়ের দ্বন্দ্ব",
    reasonEmergency: "ব্যক্তিগত বা চিকিৎসা সংক্রান্ত জরুরি অবস্থা",
    reasonBookedByMistake: "ভুলবশত বুক করা হয়েছে",
    reasonOther: "অন্যান্য",
    customReasonPlaceholder: "বাতিল করার কারণ সংক্ষেপে লিখুন (ঐচ্ছিক)...",
    timeRemainingLabel: "সেশনের পূর্বে অবশিষ্ট সময়",
    applicableRefundSlab: "প্রযোজ্য রিফান্ড নীতি",
    refundSlab100: "১০০% সম্পূর্ণ ফেরত (শুরুর ১২ ঘণ্টার বেশি পূর্বে)",
    refundSlab50: "৫০% আংশিক ফেরত (শুরুর ৩ থেকে ১২ ঘণ্টা পূর্বে)",
    refundSlab0: "০% কোনো ফেরত নয় (শুরুর ৩ ঘণ্টার কম সময়ে)",
    originalPaidAmount: "মূল প্রদত্ত অর্থ",
    refundableAmount: "হিসাবকৃত ফেরতযোগ্য অর্থ",
    noRefundNotice: "আমাদের নীতিমালা অনুযায়ী, নির্ধারিত সময়ের ৩ ঘণ্টার মধ্যে বাতিল করলে কোনো অর্থ ফেরতযোগ্য নয়। কোনো ব্যাংক তথ্যের প্রয়োজন নেই।",
    confirmZeroRefundBtn: "নিশ্চিত ও বাতিল করুন (কোনো রিফান্ড ছাড়াই)",
    savedBankTitle: "রিফান্ড জমার জন্য যাচাইকৃত ব্যাংক অ্যাকাউন্ট",
    savedBankVerifiedBadge: "APITXT দ্বারা যাচাইকৃত",
    beneficiaryNameLabel: "গ্রাহকের নাম (বেনিফিশিয়ারি)",
    accountNumberLabel: "ব্যাংক অ্যাকাউন্ট নম্বর",
    ifscCodeLabel: "আইএফএসসি কোড (IFSC)",
    changeBankBtn: "অন্য ব্যাংক অ্যাকাউন্ট দিন",
    confirmCancellationBtn: "নিশ্চিত ও বাতিল সম্পন্ন করুন",
    newBankFormTitle: "রিফান্ডের জন্য ব্যাংকের বিবরণ দিন",
    nameMatchNote: "বেনিফিশিয়ারির নাম অবশ্যই আপনার যাচাইকৃত সরকারি পরিচয়পত্রের নামের সাথে মিলতে হবে।",
    verifyAndCancelBtn: "APITXT দিয়ে ব্যাংক যাচাই করুন ও বাতিল করুন",
    nameMismatchError: "ব্যাংক বেনিফিশিয়ারির নাম অবশ্যই আপনার যাচাইকৃত সরকারি পরিচয়পত্রের নামের সাথে মিলতে হবে।",
    cancellationSuccessTitle: "বুকিং সফলভাবে বাতিল করা হয়েছে",
    refundProcessingNotice: "আপনার ₹{amount} রিফান্ড প্রক্রিয়া শুরু হয়েছে এবং ১–৫ কার্যদিবসের মধ্যে আপনার যাচাইকৃত অ্যাকাউন্টে জমা হবে।",
    closeBtn: "বন্ধ করুন"
  },

  hi: {
    // Navigation
    navPairUpToday: "पेयरअपटुडे",
    navAbout: "हमारे बारे में",
    navHowItWorks: "यह कैसे काम करता है",
    navSafetyTrust: "सुरक्षा एवं विश्वास",
    navTerms: "नियम एवं शर्तें",
    navLanguage: "भाषा",
    navSignIn: "साइन इन",
    navLogin: "लॉगिन",
    navDashboard: "डैशबोर्ड",
    navLogout: "लॉग आउट",
    navSwitchToClient: "क्लाइंट मोड में बदलें",
    navSwitchToCompanion: "कंपैनियन मोड में बदलें",
    navClientBadge: "क्लाइंट",
    navCompanionBadge: "कंपैनियन",
    
    // Hero
    heroKicker: "भारतभर में सत्यापित सामाजिक साहचर्य सेवा",
    heroFreeBadge: "क्लाइंट के लिए 100% मुफ़्त",
    heroHeadline: "अपना मनपसंद साथी खोजें,",
    heroHeadlineHighlight: "कभी भी, कहीं भी।",
    heroSubheadline: "कैफ़े में बातचीत, शहर में खरीदारी, सांस्कृतिक स्थलों का भ्रमण या आत्मीय चर्चा के लिए पेयरअपटुडे आपको सत्यापित व्यक्तियों से सुरक्षित रूप से जोड़ता है।",
    heroCta: "YOUR TIME. YOUR CHOICE. YOUR EARNINGS. →",
    heroSupportingText: "साथी के रूप में पेयरअपटुडे से जुड़ें और अपनी शर्तों पर कमाई करें।",
    heroExploreButton: "अपने शहर के सत्यापित साथी देखें",
    heroTrustKycTitle: "100% सत्यापित केवाईसी",
    heroTrustKycDesc: "सरकारी पहचान पत्र व लाइव सेल्फ़ी",
    heroTrustFreeTitle: "निःशुल्क क्लाइंट प्रवेश",
    heroTrustFreeDesc: "कोई सदस्यता शुल्क नहीं",
    heroTrustOtpTitle: "स्टार्ट व फ़िनिश ओटीपी",
    heroTrustOtpDesc: "प्रत्यक्ष मुलाक़ात की सुरक्षा",
    heroTrustSosTitle: "भारत 100 व 112 एसओएस",
    heroTrustSosDesc: "आपातकालीन सहायता केंद्र",

    // Services Catalog
    servicesSectionKicker: "विशिष्ट सेवाएँ",
    servicesSectionTitle: "36 विशिष्ट साहचर्य सेवाएँ",
    servicesSectionDesc: "सामाजिक, जीवनशैली, यात्रा, स्वास्थ्य, संस्कृति और देखभाल से जुड़ी हमारी सत्यापित सेवाओं में से चुनें।",
    catAll: "सभी 36 सेवाएँ",
    catSocial: "सामाजिक",
    catLifestyle: "जीवनशैली",
    catTravel: "यात्रा व पर्यटन",
    catWellness: "फ़िटनेस व आउटडोर",
    catCulture: "संस्कृति व कला",
    catCare: "देखभाल व सहायता",
    bookServiceAction: "बुकिंग करें",
    serviceHourlyRatePrefix: "शुरुआती दर मात्र ₹499/घंटा",

    // About Page
    aboutBadge: "हमारे समुदाय के बारे में",
    aboutTitle: "पेयरअपटुडे के बारे में",
    aboutTagline: "लोगों को जोड़ना, सार्थक अनुभव रचना।",
    aboutP1: "पेयरअपटुडे एक साहचर्य मंच है जिसे लोगों को साथ लाने और रोज़मर्रा के अनुभवों को अधिक सुखद, आरामदायक और अर्थपूर्ण बनाने के लिए तैयार किया गया है।",
    aboutP2: "चाहे आप कैफ़े जाने के लिए साथी खोज रहे हों, नया शहर घूमना चाहते हों, किसी कार्यक्रम में सम्मिलित होना हो, ख़रीदारी करनी हो या बस एक आत्मीय चर्चा करनी हो, पेयरअपटुडे आपकी प्राथमिकताओं के अनुसार साथी खोजने में मदद करता है।",
    aboutP3: "हम उन व्यक्तियों के लिए भी सुरक्षित अवसर उपलब्ध कराते हैं जो साहचर्य सेवाएँ प्रदान करना चाहते हैं, अपनी रुचियों को साझा करना चाहते हैं और अपने समय से आय अर्जित करना चाहते हैं।",
    aboutMissionTitle: "हमारा लक्ष्य",
    aboutMissionText: "हमारा उद्देश्य साहचर्य को सुलभ और सुरक्षित बनाना है, जहाँ लोग एक-दूसरे से जुड़ सकें और सार्थक सामाजिक संबंध बना सकें।",
    aboutOfferTitle: "हम क्या प्रदान करते हैं",
    aboutOffer1Title: "व्यक्तिगत साहचर्य",
    aboutOffer1Desc: "बातचीत, भोजन, कैफ़े भ्रमण, ख़रीदारी, फ़िल्में और सामाजिक समारोहों के लिए साथी।",
    aboutOffer2Title: "नगर एवं पर्यटन साथी",
    aboutOffer2Desc: "दर्शनीय स्थलों, ऐतिहासिक धरोहरों, छुट्टियों और यात्राओं के लिए विश्वसनीय साथी।",
    aboutOffer3Title: "समारोह एवं गतिविधियाँ",
    aboutOffer3Desc: "विवाह, संगीत समारोह, खेल स्टेडियम, प्रदर्शनियों और फ़िटनेस गतिविधियों में संगति।",
    aboutOffer4Title: "देखभाल एवं दैनिक सहयोग",
    aboutOffer4Desc: "वरिष्ठ नागरिकों की संगति, चिकित्सालय यात्रा और रोज़मर्रा के कार्यों में सहयोग।",
    aboutValuesTitle: "हमारे मूल मूल्य",
    aboutVal1Title: "सुरक्षा एवं विश्वास",
    aboutVal1Desc: "संपूर्ण केवाईसी, ओटीपी-सत्यापित मुलाक़ातें और शून्य-सहनशीलता सुरक्षा नीतियां।",
    aboutVal2Title: "स्वतंत्रता एवं लचीलापन",
    aboutVal2Desc: "पारदर्शी बुकिंग, लचीले समय और साथियों द्वारा स्वतंत्र दर निर्धारण।",
    aboutVal3Title: "सम्मान एवं मर्यादा",
    aboutVal3Desc: "एक गरिमापूर्ण वातावरण जहाँ प्रत्येक सदस्य एक-दूसरे का सम्मान करता है।",
    aboutVal4Title: "पारदर्शी आय व भुगतान",
    aboutVal4Desc: "साथियों को 85% शुद्ध शेयर, 48 घंटे का यूटीसी एस्क्रो लॉक और निष्पक्ष लेखांकन।",
    aboutCtaTitle: "पेयरअपटुडे का अनुभव लेने के लिए तैयार हैं?",
    aboutCtaDesc: "भारतभर में हज़ारों क्लाइंट्स और कंपैनियंस के सुरक्षित समुदाय से जुड़ें।",
    aboutExploreBtn: "साथियों की सूची देखें",
    aboutJoinBtn: "साथी के रूप में जुड़ें",

    // How It Works Page
    hiwBadge: "चरणबद्ध मार्गदर्शिका",
    hiwTitle: "पेयरअपटुडे कैसे काम करता है",
    hiwSubtitle: "क्लाइंट और साथी दोनों के लिए बनाई गई सहज और अत्यंत सुरक्षित प्रणाली।",
    hiwTabClient: "क्लाइंट के लिए",
    hiwTabCompanion: "साथी के लिए",
    hiwClientStepsTitle: "क्लाइंट की यात्रा (7 सरल चरण)",
    hiwStep1ClientTitle: "खाता बनाएँ",
    hiwStep1ClientDesc: "अपने मोबाइल नंबर और पासवर्ड से पंजीकरण करें और 6-अंकों का ओटीपी सत्यापित करें।",
    hiwStep2ClientTitle: "प्रोफ़ाइल व केवाईसी पूर्ण करें",
    hiwStep2ClientDesc: "सरकारी पहचान पत्र और लाइव सेल्फ़ी जमा करके खाता सक्रियण का अनुरोध करें।",
    hiwStep3ClientTitle: "साथी खोजें",
    hiwStep3ClientDesc: "स्थान, रुचियों, पसंदीदा सेवाओं और प्रति घंटे के बजट के अनुसार फ़िल्टर करें।",
    hiwStep4ClientTitle: "पसंदीदा साथी चुनें",
    hiwStep4ClientDesc: "साथी की प्रोफ़ाइल, चित्र, परिचय और निर्धारित सेवा दरों का अवलोकन करें।",
    hiwStep5ClientTitle: "बुकिंग पक्की करें",
    hiwStep5ClientDesc: "दिनांक, समय और अवधि चुनकर पेयरअप सिक्योर वॉल्ट के माध्यम से भुगतान करें।",
    hiwStep6ClientTitle: "मिलें और आनंद लें",
    hiwStep6ClientDesc: "निर्धारित सार्वजनिक स्थान पर मिलें और सत्र प्रारंभ करने हेतु स्टार्ट ओटीपी साझा करें।",
    hiwStep7ClientTitle: "बुकिंग समाप्त करें",
    hiwStep7ClientDesc: "सत्र के समापन पर साथी को समाप्ति ओटीपी प्रदान करके सत्र सुरक्षित रूप से समाप्त करें।",
    hiwCompanionStepsTitle: "साथी की यात्रा (6 सरल चरण)",
    hiwStep1CompTitle: "साथी पंजीकरण",
    hiwStep1CompDesc: "मोबाइल नंबर व पासवर्ड से साइन इन करें और 6-अंकों का ओटीपी कोड सत्यापित करें।",
    hiwStep2CompTitle: "अनिवार्य केवाईसी पूर्ण करें",
    hiwStep2CompDesc: "व्यवस्थापक सत्यापन हेतु अपना सरकारी पहचान पत्र व स्पष्ट लाइव सेल्फ़ी अपलोड करें।",
    hiwStep3CompTitle: "सेवाएँ व दरें चुनें",
    hiwStep3CompDesc: "स्वीकृत 36 सेवाओं में से चुनें कि आप कौन-सी सेवाएँ देना चाहते हैं और दरें तय करें।",
    hiwStep4CompTitle: "सदस्यता सक्रिय करें",
    hiwStep4CompDesc: "बुकिंग पाने हेतु सदस्यता योजना (स्टार्टर ₹449, प्रो ₹1,099, प्रीमियम ₹5,999) चुनें।",
    hiwStep5CompTitle: "बैंक खाता सत्यापन",
    hiwStep5CompDesc: "सीधे भुगतान प्राप्त करने हेतु बैंक खाता संख्या और आईएफएससी कोड सत्यापित करें।",
    hiwStep6CompTitle: "लाइव हों और कमाएँ",
    hiwStep6CompDesc: "तीनों शर्तें पूरी होते ही प्रोफ़ाइल लाइव होगी। बुकिंग प्राप्त करें और 85% शेयर कमाएँ।",
    hiwSafetyTitle: "सुरक्षा के प्रति हमारा संकल्प",
    hiwSafetyText: "पेयरअपटुडे पूर्णतः पेशेवर साहचर्य मंच है। किसी भी दुर्व्यवहार या अनुचित गतिविधि के लिए शून्य-सहनशीलता नीति लागू है। सभी मुलाक़ातें सार्वजनिक स्थानों पर ओटीपी सुरक्षा में होती हैं।",
    hiwClientCta: "क्लाइंट पंजीकरण करें (मुफ़्त)",
    hiwCompanionCta: "साथी होस्ट बनें",

    // Safety & Trust Page
    safetyBadge: "सुरक्षा एवं विश्वास प्रोटोकॉल",
    safetyTitle: "पेयरअपटुडे में सुरक्षा एवं विश्वास",
    safetySubtitle: "हम पारस्परिक सम्मान, पहचान सत्यापन, खाता सुरक्षा और त्वरित आपातकालीन सहायता सुनिश्चित करते हैं।",
    safetyPillar1Title: "पहचान सत्यापन एवं व्यवस्थापक अनुमोदन",
    safetyPillar1Desc: "प्रत्येक क्लाइंट व साथी का सरकारी पहचान पत्र (आधार, पैन, वोटर या पासपोर्ट) और सेल्फ़ी ऑडिट किया जाता है। अनुमोदन तक प्रोफ़ाइल निष्क्रिय रहती है।",
    safetyPillar2Title: "दोहरे ओटीपी-आधारित मुलाक़ात की सुरक्षा",
    safetyPillar2Desc: "6-अंकों के सुरक्षित ओटीपी से मुलाक़ात संरक्षित रहती है। क्लाइंट के स्टार्ट ओटीपी के बिना सत्र शुरू नहीं हो सकता और समाप्ति ओटीपी के बिना ख़त्म नहीं हो सकता।",
    safetyPillar3Title: "सुरक्षित ऑनलाइन एस्क्रो भुगतान",
    safetyPillar3Desc: "सभी भुगतान पेयरअप सिक्योर वॉल्ट में सुरक्षित रहते हैं। मुलाक़ात पूरी होने के बाद 48 घंटे का यूटीसी एस्क्रो लॉक रहता है ताकि किसी भी शिकायत का समाधान हो सके।",
    safetyPillar4Title: "ऐप के भीतर सुरक्षित चैट",
    safetyPillar4Desc: "व्यक्तिगत फ़ोन नंबर या सोशल मीडिया साझा किए बिना ऐप के अंदर ही साथी से सुरक्षित बातचीत करें।",
    safetyPillar5Title: "24/7 आपातकालीन सहायता व एसओएस",
    safetyPillar5Desc: "भारत की आधिकारिक आपातकालीन हेल्पलाइन — पुलिस 100 और राष्ट्रीय आपातकालीन 112 से सीधे जुड़ने की सुविधा प्रत्येक स्क्रीन पर उपलब्ध है।",
    safetyPillar6Title: "शून्य-सहनशीलता सामुदायिक मानक",
    safetyPillar6Desc: "पेयरअपटुडे किसी भी प्रकार की अनुचित गतिविधि का समर्थन नहीं करता। नियमों का उल्लंघन करने पर आजीवन प्रतिबंध लगाया जाता है।",
    safetyCommunityTitle: "सामुदायिक दिशा-निर्देश",
    safetyRule1: "सदैव खुले व प्रकाशमान सार्वजनिक स्थानों (जैसे कैफ़े, रेस्तरां, मॉल या पर्यटन स्थल) पर ही मिलें।",
    safetyRule2: "व्यक्तिगत वित्तीय जानकारी, ओटीपी या घर का पता कभी किसी के साथ साझा न करें।",
    safetyRule3: "प्रत्येक सदस्य के साथ शिष्टता, विनम्रता और गरिमापूर्ण व्यवहार करें।",
    safetyRule4: "प्लेटफ़ॉर्म की बुकिंग या ओटीपी प्रक्रिया को छोड़कर बाहर कोई निजी लेन-देन न करें।",
    safetyEmergencyTitle: "आपातकालीन संपर्क",
    safetyEmergencyDesc: "मुलाक़ात के दौरान यदि आपको असहजता या ख़तरा महसूस हो तो तुरंत आपातकालीन सेवाओं से संपर्क करें:",

    // Auth Gateway Modal
    authGatewayTitle: "पेयरअपटुडे गेटवे",
    authGatewaySubtitle: "क्लाइंट और कंपैनियन दोनों के लिए सुरक्षित प्रवेश",
    tabLogin: "लॉगिन",
    tabSignIn: "साइन इन",
    phoneLabel: "भारतीय मोबाइल नंबर (+91)",
    phonePlaceholder: "10 अंकों का मोबाइल नंबर दर्ज करें",
    passwordLabel: "पासवर्ड",
    passwordPlaceholder: "सुरक्षित पासवर्ड दर्ज करें",
    otpLabel: "6-अंकों का ओटीपी",
    otpPlaceholder: "फ़ोन पर भेजा गया ओटीपी दर्ज करें",
    sendOtp: "ओटीपी भेजें",
    resendOtp: "ओटीपी पुनः भेजें",
    resendIn: "पुनः भेजने का समय",
    verifyAndContinue: "ओटीपी सत्यापित कर आगे बढ़ें",
    loginButton: "पेयरअपटुडे में प्रवेश करें",
    unregisteredMessagePrefix: "अभी तक खाता नहीं है? कृपया नया खाता बनाने के लिए ",
    unregisteredMessageLink: "साइन इन",
    unregisteredMessageSuffix: " करें।",
    invalidCredentialsMessage: "अमान्य मोबाइल नंबर या पासवर्ड। कृपया जाँच कर पुनः प्रयास करें।",
    securityBranding: "PairUp Security Network",
    errorPhoneRequired: "कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर (+91) दर्ज करें।",
    errorPhonePasswordRequired: "मोबाइल नंबर और पासवर्ड दोनों आवश्यक हैं।",
    errorOtpRequired: "कृपया आपके फ़ोन पर भेजा गया 6-अंकों का ओटीपी दर्ज करें।",

    // Role Selection Modal
    roleSelectionTitle: "अपनी भूमिका चुनें",
    roleSelectionSubtitle: "कृपया चुनें कि आप इस सत्र में कैसे प्रवेश करना चाहते हैं",
    enterAsClient: "क्लाइंट सदस्य के रूप में प्रवेश करें",
    enterAsClientDesc: "सत्यापित साथी खोजें और बुक करें। 100% निःशुल्क सदस्यता।",
    enterAsCompanion: "साथी होस्ट के रूप में प्रवेश करें",
    enterAsCompanionDesc: "सेवाएँ प्रबंधित करें, बुकिंग प्राप्त करें और 85% शुद्ध शेयर कमाएँ।",
    roleSecurityNotice: "पेयरअप सत्यापित नेटवर्क प्राधिकरण",

    // KYC Wizard Modal
    kycWizardTitle: "एकीकृत प्रोफ़ाइल एवं पहचान सत्यापन (KYC)",
    kycWizardSubtitle: "समुदाय की सुरक्षा और विश्वास सुनिश्चित करने के लिए विवरण दर्ज करें",
    ageGateAgreement: "मैं पुष्टि करता हूँ कि मेरी आयु 18 वर्ष या उससे अधिक है",
    legalNameLabel: "आधिकारिक कानूनी नाम (सरकारी पहचान पत्र अनुसार)",
    legalNamePlaceholder: "पहचान पत्र अनुसार पूरा नाम",
    dobLabel: "जन्म तिथि",
    dobNotice: "केवाईसी जमा होने के बाद जन्म तिथि में बदलाव नहीं किया जा सकता (18+ अनिवार्य)।",
    idTypeLabel: "सरकारी पहचान पत्र का प्रकार",
    idFrontLabel: "पहचान पत्र का अगला भाग",
    idBackLabel: "पहचान पत्र का पिछला भाग",
    selfieLabel: "स्पष्ट लाइव सेल्फ़ी",
    bioLabel: "संक्षिप्त परिचय / बायो",
    bioPlaceholder: "क्लाइंट्स को अपनी रुचियों, हॉबी और व्यक्तित्व के बारे में बताएँ...",
    profileNameLabel: "सार्वजनिक प्रोफ़ाइल नाम *",
    profileNamePlaceholder: "प्रदर्शित नाम दर्ज करें (जैसे राहुल, प्रिया, अमन)",
    profileNameHelp: "यह सार्वजनिक नाम अन्य उपयोगकर्ताओं को दिखेगा। आपका आधिकारिक सरकारी पहचान नाम पूरी तरह गोपनीय रहेगा।",
    profileSectionTitle: "सार्वजनिक प्रोफ़ाइल नाम एवं परिचय",
    profileSectionSubtitle: "अपना प्रदर्शित नाम, फ़ोटो गैलरी और बायो प्रबंधित करें। आपकी आधिकारिक सरकारी पहचान विवरण गोपनीय और सुरक्षित रहेंगे।",
    profilePrivacyBadge: "गोपनीयता सुरक्षित",
    profileSaveBtn: "प्रोफ़ाइल सुरक्षित करें",
    profileSavingBtn: "सुरक्षित हो रहा है...",
    profilePhotosSection: "प्रोफ़ाइल एवं गैलरी फ़ोटो (अधिकतम 6)",
    profilePhotosHelp: "अधिकतम 6 फ़ोटो अपलोड करें। किसी भी फ़ोटो को मुख्य प्रोफ़ाइल फ़ोटो के रूप में चुनें।",
    profileUploadBtn: "फ़ोटो अपलोड करें",
    profileSetMainBtn: "मुख्य बनाएं",
    profileMainBadge: "★ मुख्य फ़ोटो",
    profileLockedIdentityTitle: "सत्यापित कानूनी पहचान (स्थायी रूप से लॉक)",
    profileLockedIdentityHelp: "सुरक्षा कारणों से सरकारी पहचान पत्र से सत्यापित कानूनी विवरण बदले नहीं जा सकते।",
    profileLegalNameLocked: "आधिकारिक कानूनी नाम (सरकारी पहचान पत्र)",
    profileDobLocked: "जन्म तिथि एवं आयु",
    profilePhoneLocked: "पंजीकृत मोबाइल नंबर",
    profileSuccessMsg: "प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई!",
    photosLabel: "प्रोफ़ाइल फ़ोटो (अधिकतम 6)",
    fileChooseText: "फ़ाइल या फ़ोटो चुनें",
    fileAttachedText: "दस्तावेज़ अपलोड पूर्ण ✓",
    submitKyc: "केवाईसी सत्यापन जमा करें",
    kycSubmittedNotice: "केवाईसी सफलतापूर्वक जमा हुआ। सुरक्षा नियमों के अनुसार आपका सत्र समाप्त किया गया है। कृपया पुनः लॉगिन करें।",
    kycPendingBanner: "केवाईसी समीक्षाधीन: हमारी टीम आपके दस्तावेज़ों की जाँच कर रही है।",
    kycApprovedBanner: "केवाईसी स्वीकृत: आपकी पहचान सफलतापूर्वक प्रमाणित हो चुकी है।",

    // Client Dashboard
    clientInactiveTitle: "क्लाइंट निष्क्रिय: केवाईसी अनुमोदन की प्रतीक्षा करें",
    clientActiveTitle: "क्लाइंट प्रोफ़ाइल सक्रिय",
    clientFreeMembershipNotice: "क्लाइंट सदस्यता 100% मुफ़्त है: खोजने या बुक करने के लिए कोई शुल्क नहीं। आप केवल तय सत्रों का पारदर्शी भुगतान करते हैं।",
    clientFreeActiveTag: "निःशुल्क सक्रिय पहुंच (₹0)",
    tabOverview: "विवरण",
    tabProfile: "मेरी प्रोफ़ाइल",
    tabKycStatus: "केवाईसी स्थिति",
    tabDiscover: "साथी खोजें",
    tabServices: "36 सेवाएँ",
    tabBookings: "मेरी बुकिंग्स",
    tabHistory: "बुकिंग इतिहास",
    tabChat: "सुरक्षित चैट",
    tabNotifications: "सूचनाएं",
    tabPayments: "भुगतान",
    tabSafety: "सुरक्षा एवं एसओएस",
    tabSafetyAndHelp: "सहायता और सुरक्षा",
    tabSettings: "सेटिंग्स",
    welcomeBack: "वापसी पर स्वागत है",
    findPerfectCompanion: "आइए मिलकर आपके लिए सही साथी खोजें...",
    exploreMatches: "मैच देखें",
    totalMatches: "कुल मैच",
    thisMonth: "इस महीने",
    upcomingPlans: "अपनी आगामी योजनाएं देखें",
    kycVerified: "केवाईसी सत्यापित",
    accountVerified: "आपका खाता सत्यापित है",
    viewProfile: "प्रोफ़ाइल देखें",
    bookNow: "अभी बुक करें",
    smartFilterAll: "सभी",
    smartFilterOnline: "ऑनलाइन",
    smartFilterSuggested: "सुझाया गया",
    viewAll: "सभी देखें",
    showLess: "कम दिखाएं",
    searchAndFilters: "खोज और फ़िल्टर",
    discoverCompanionsPlaceholder: "साथी खोजें...",
    loginAs: "लॉगिन करें",
    asClient: "क्लाइंट के रूप में",
    asCompanion: "साथी के रूप में",
    goBack: "वापस जाएं",
    logoutText: "लॉगआउट",
    findCompanionsTitle: "सत्यापित साथी खोजें",
    searchPlaceholder: "शहर, नाम या रुचि से खोजें...",
    filterByService: "सेवा अनुसार फ़िल्टर करें",
    filterByCity: "शहर",
    allServices: "सभी 36 सेवाएँ",
    allCities: "सभी शहर",
    maxBudget: "अधिकतम बजट / घंटा",
    nearbyCompanions: "आसपास के साथी (जीपीएस आधारित)",
    gpsActive: "जीपीएस सक्रिय",
    companionStatusLive: "लाइव साथी",
    verifiedKycBadge: "सत्यापित केवाईसी",
    perHourRate: "/ घंटा",
    bookCompanion: "साथी बुक करें",
    bookingHistory: "मेरी बुकिंग्स",
    upcomingBookings: "आगामी बुकिंग्स",
    pastBookings: "पिछला इतिहास",
    noBookingsYet: "अभी कोई बुकिंग नहीं मिली। अपनी पहली बुकिंग के लिए साथी खोजें।",
    bookingCodeLabel: "बुकिंग कोड",
    startOtpLabel: "मीटिंग प्रारंभ ओटीपी",
    completionOtpLabel: "समाप्ति ओटीपी",
    clientOtpInstruction: "यह ओटीपी मुलाक़ात के समय केवल सामने उपस्थित साथी को प्रदान करें।",
    bookingConfirmedStatus: "पुष्ट",
    bookingCompletedStatus: "पूर्ण",
    selectSlot: "दिनांक एवं समय स्लॉट चुनें",
    dateLabel: "मुलाक़ात की तारीख़",
    timeLabel: "शुरुआती समय",
    durationHours: "अवधि (घंटे)",
    meetingLocationLabel: "मुलाक़ात का स्थान (सार्वजनिक स्थल)",
    notesLabel: "विशेष निर्देश या प्राथमिकताएं",
    totalAmount: "कुल देय राशि",
    payAndConfirm: "भुगतान कर बुकिंग पक्की करें",
    confirmBookingTitle: "साहचर्य सत्र निर्धारित करें",
    cancellationNotice: "साथी के देर से आने पर प्रति मिनट के हिसाब से क्लाइंट को हर्जाना दिया जाता है।",

    // Companion Dashboard
    companionActivationTitle: "कंपैनियन ऑनबोर्डिंग एवं सक्रियण",
    companionLiveBadge: "कंपैनियन स्थिति: लाइव",
    companionInactiveBadge: "कंपैनियन स्थिति: निष्क्रिय",
    stepServices: "1. सेवाएँ एवं दरें",
    stepMembership: "2. सदस्यता योजना",
    stepBank: "3. बैंक सत्यापन",
    gateKycTitle: "केवाईसी पहचान समीक्षा",
    gateMembershipTitle: "कंपैनियन सदस्यता",
    gateBankTitle: "बैंक खाता सत्यापन",
    membershipPlanStarter: "STARTER",
    membershipPlanPro: "PROFESSIONAL",
    membershipPlanPremium: "PREMIUM",
    starterPriceText: "₹449 / 1 महीना",
    proPriceText: "₹1,099 / 3 महीने",
    premiumPriceText: "₹5,999 / 1 वर्ष",
    starterDurationText: "30 दिन की वैधता",
    proDurationText: "90 दिन की वैधता",
    premiumDurationText: "365 दिन की वैधता",
    purchaseMembershipPlan: "सदस्यता योजना सक्रिय करें",
    bankAccountLabel: "बैंक खाता संख्या",
    bankAccountPlaceholder: "खाता संख्या दर्ज करें",
    ifscLabel: "आईएफएससी कोड",
    ifscPlaceholder: "उदा. HDFC0001234",
    accountHolderLabel: "खाताधारक का नाम (केवाईसी के समान)",
    accountHolderPlaceholder: "बैंक खाते में दर्ज आधिकारिक नाम",
    verifyBank: "बैंक खाता सत्यापित करें",
    walletBalance: "वॉलेट विवरण",
    lockedEarnings: "सुरक्षित रोक राशि (48 घंटे UTC)",
    availableEarnings: "उपलब्ध निकासी राशि",
    hourlyRateSettings: "प्रति घंटे की दर निर्धारित करें",
    saveRates: "दरें सुरक्षित करें",
    meetingArrivedAction: "स्लाइड: मीटिंग स्थल पर पहुंचे",
    startOtpTitle: "मीटिंग प्रारंभ ओटीपी सत्यापन",
    enterStartOtp: "क्लाइंट का 6-अंकों का ओटीपी दर्ज करें",
    enterCompletionOtp: "समाप्ति ओटीपी दर्ज करें",
    delayMinutesLabel: "साथी का विलंब (यदि कोई मिनट हो)",
    verifyOtpButton: "ओटीपी सत्यापित कर सत्र शुरू करें",
    countdownActive: "सक्रिय सत्र टाइमर",
    completeBookingAction: "बुकिंग पूर्ण करें",

    // SOS & Emergency Hub
    sosEmergencyHub: "पेयरअप सुरक्षा एवं एसओएस हब",
    sosEmergencySubtitle: "त्वरित आपातकालीन सहायता और सुरक्षा प्रोटोकॉल",
    emergencyHotline100: "पुलिस आपातकालीन: 100",
    emergencyHotline112: "राष्ट्रीय आपातकालीन हेल्पलाइन: 112",
    emergencyHotline100Desc: "स्थानीय पुलिस गश्ती दल से सीधा संपर्क।",
    emergencyHotline112Desc: "समग्र भारत में 24 घंटे आपातकालीन सहायता।",
    safetyTipTitle: "सुरक्षा सलाह",
    safetyTipText: "मुलाक़ातें अनिवार्यतः सार्वजनिक स्थानों पर ही होनी चाहिए। यदि आपको कोई असहजता या नियम उल्लंघन दिखे, तो सत्र समाप्त करें।",

    // Footer & Contact With Us
    footerMission: "PairUpToday — Your Time. Your Choice. Your Companion.",
    footerRights: "© 2026 पेयरअपटुडे। सर्वाधिकार सुरक्षित। PairUp Security Network द्वारा संरक्षित।",
    footerPlatformNav: "प्लेटफ़ॉर्म नेविगेशन",
    footerContactWithUs: "हमसे संपर्क करें",
    footerFacebookLabel: "फ़ेसबुक",
    footerInstagramLabel: "इंस्टाग्राम",
    footerEmailLabel: "Support@pairuptoday.com",
    footerEmergencyAssistance: "आपातकालीन सहायता",
    footerPoliceEmergency: "पुलिस आपातकालीन",
    footerNationalSos: "राष्ट्रीय आपातकालीन एसओएस",
    footerBuiltWithLove: "बेहतर जुड़ाव। उज्जवल पल।",
    footerCopyEmail: "ईमेल कॉपी करें",
    footerEmailCopied: "ईमेल कॉपी किया गया: Support@pairuptoday.com",

    // Common UI Actions
    closeAction: "बंद करें",
    cancelAction: "रद्द करें",
    confirmAction: "पुष्टि करें",
    loadingAction: "प्रतीक्षा करें...",
    copiedAction: "कॉपी पूर्ण!",

    // Companion Listing & Profile Details
    companionListSectionTitle: "भारतभर में सत्यापित साथी",
    companionListSectionSubtitle: "सभी 36 साहचर्य सेवाओं के लिए अपने शहर में उपलब्ध सत्यापित साथियों की सूची देखें।",
    quickViewAction: "प्रोफ़ाइल देखें",
    bookNowAction: "अभी बुक करें",
    availableServicesLabel: "उपलब्ध सेवाएँ",
    profileUnavailableForBooking: "यह प्रोफ़ाइल वर्तमान में बुकिंग के लिए उपलब्ध नहीं है।",
    ageYearsLabel: "वर्ष",
    ratePerHourLabel: "₹{rate}/घंटा",
    selectLocationLabel: "शहर / स्थान चुनें",
    allLocationsLabel: "सभी स्थान",
    filterByServiceLabel: "सेवा अनुसार फ़िल्टर करें",
    allServicesLabel: "सभी 36 सेवाएँ",
    viewDetailsAction: "प्रोफ़ाइल देखें",
    additionalPhotosLabel: "अतिरिक्त छायाचित्र",
    aboutSlogan: "PairUpToday — आपका समय। आपकी पसंद। आपका साथी।",
    hiwClientStepsDesc: "सुरक्षित रूप से अपना आदर्श साथी खोजने के लिए ७ आसान चरण।",
    hiwClientTagline: "आपका समय। आपकी पसंद। आपका आदर्श साथी।",
    hiwCompanionStepsDesc: "सुरक्षित रूप से ऑनबोर्ड, सक्रिय होने और ८५% शुद्ध कमाई प्राप्त करने के ६ विस्तृत चरण।",
    hiwCompanionTagline: "आपका समय। आपका कौशल। आपकी कमाई का अवसर।",
    safetyEmergencyHeadline: "अनुभव के दौरान किसी भी सुरक्षा चिंता के मामले में",
    policeLabel: "पुलिस: १००",
    sosLabel: "आपातकालीन सहायता (SOS): ११२",
    safetyTagline: "PairUpToday — केवल साथ नहीं। एक बेहतर अनुभव।",

    termsBadge: "आधिकारिक प्लेटफ़ॉर्म नीति",
    termsTitle: "सेवा की शर्तें – Pairup Today",
    termsLastUpdated: "अंतिम अपडेट: २३ नवंबर, २०२६",
    termsIntro: "Pairup Today (\"हम\", \"हमारा\" या \"हमारा प्लेटफ़ॉर्म\") में आपका स्वागत है। Pairup Today एक ऐसा प्लेटफ़ॉर्म है जो ग्राहकों को सामाजिक मेलजोल, गतिविधियों और दोस्ताना संगति (\"सेवा\") के लिए सत्यापित साथियों से जोड़ता है। Pairup Today पर पंजीकरण, बुकिंग या सेवा प्रदान करके, आप सेवा की इन शर्तों (\"शर्तें\") से कानूनी रूप से बंधे होने के लिए सहमत होते हैं।",

    termsSec1Title: "१. सेवा की प्रकृति एवं सख्त एस्कॉर्ट-विरोधी नीति",
    termsSec1P1Title: "केवल दोस्ताना व सामाजिक संगति (Platonic Companionship):",
    termsSec1P1Desc: "Pairup Today पूरी तरह से केवल निष्कपट, दोस्ताना और सामाजिक साहचर्य (जैसे भोजन करना, कार्यक्रमों में भाग लेना, बातचीत या दर्शनीय स्थलों की यात्रा) के लिए एक मंच है।",
    termsSec1P2Title: "कोई एस्कॉर्ट या वयस्क सेवाएं नहीं:",
    termsSec1P2Desc: "Pairup Today किसी भी प्रकार की एस्कॉर्ट, डेटिंग, यौन या वयस्क सेवाएं सख्त रूप से प्रदान नहीं करता है।",
    termsSec1P3Title: "शून्य सहनशीलता एवं कानूनी कार्रवाई:",
    termsSec1P3Desc: "यौन अनुग्रह की मांग, मानव तस्करी, धोखाधड़ी या किसी भी गैरकानूनी गतिविधि में शामिल होना पूरी तरह से प्रतिबंधित है। इस नियम का उल्लंघन करने वाले किसी भी उपयोगकर्ता या साथी का खाता तुरंत स्थायी रूप से बंद कर दिया जाएगा और भारत के लागू कानूनों के तहत सख्त कानूनी कार्रवाई की जाएगी।",

    termsSec2Title: "२. पात्रता, स्वैच्छिक भागीदारी एवं सत्यापन",
    termsSec2P1Title: "स्वैच्छिक पंजीकरण और स्वतंत्र इच्छा:",
    termsSec2P1Desc: "ग्राहक और साथी दोनों पुष्टि करते हैं कि वे पूरी तरह से अपनी स्वतंत्र इच्छा और पसंद से पंजीकरण कर रहे हैं और सेवाओं की पेशकश या बुकिंग कर रहे हैं। हमने किसी को भी शामिल होने के लिए मजबूर या गुमराह नहीं किया है।",
    termsSec2P2Title: "आयु आवश्यकता:",
    termsSec2P2Desc: "Pairup Today का उपयोग करने के लिए ग्राहक और साथी दोनों की आयु कम से कम १८ वर्ष होनी चाहिए।",
    termsSec2P3Title: "अनिवार्य सत्यापन:",
    termsSec2P3Desc: "अनुरोध किए जाने पर उपयोगकर्ताओं को सटीक व्यक्तिगत विवरण और वैध सरकारी पहचान पत्र (ID Proof) प्रस्तुत करना होगा। नकली प्रोफाइल को स्थायी रूप से प्रतिबंधित कर दिया जाएगा।",

    termsSec3Title: "३. बुकिंग, भुगतान एवं प्लेटफ़ॉर्म शुल्क (१५% कमीशन)",
    termsSec3P1Title: "ग्राहक भुगतान:",
    termsSec3P1Desc: "सत्र की पुष्टि के लिए ग्राहकों को Pairup Today प्लेटफ़ॉर्म के माध्यम से पूरी बुकिंग राशि का अग्रिम भुगतान करना होगा।",
    termsSec3P2Title: "साथी का भुगतान और १५% प्लेटफ़ॉर्म शुल्क:",
    termsSec3P2Desc: "हम साथी द्वारा अर्जित कुल बुकिंग राशि में से १५% प्लेटफ़ॉर्म सेवा शुल्क काटते हैं। बुकिंग सफलतापूर्वक पूरी होने पर शेष ८५% साथी के पंजीकृत भुगतान खाते में जमा कर दिया जाएगा।",
    termsSec3P3Title: "प्लेटफ़ॉर्म से बाहर कोई लेन-देन नहीं:",
    termsSec3P3Desc: "सभी बुकिंग और भुगतान हमारे ऐप के भीतर ही होने चाहिए। प्लेटफ़ॉर्म को बायपास करके नकद या सीधे पैसे का लेन-देन इन शर्तों का उल्लंघन है और इसके परिणामस्वरूप खाता निलंबित कर दिया जाएगा।",
    termsSec3P4Title: "गतिविधि के खर्च:",
    termsSec3P4Desc: "जब तक परस्पर सहमति न हो, व्यक्तिगत मुलाकात के दौरान ग्राहक अपने स्वयं के खर्चों (भोजन, टिकट, यात्रा) के लिए जिम्मेदार होंगे।",

    termsSec4Title: "४. रिफंड एवं रद्दीकरण नीति (Refund & Cancellation Policy)",
    termsSec4Intro: "हम समझते हैं कि योजनाएं अप्रत्याशित रूप से बदल सकती हैं। Pairup Today पर बुकिंग रद्दीकरण और रिफंड को नियंत्रित करने वाले नियम नीचे दिए गए हैं:",
    termsSec4ClientTitle: "ग्राहक रद्दीकरण नियम:",
    termsSec4ClientDesc: "आप निर्धारित समय से पहले निम्नलिखित रिफंड स्लैब के आधार पर अपनी बुकिंग रद्द कर सकते हैं:",
    termsSec4Slab1: "निर्धारित समय से १२ घंटे से अधिक पहले: १००% पूरा रिफंड वापस।",
    termsSec4Slab2: "निर्धारित समय से ३ से १२ घंटे पहले: बुकिंग राशि का ५०% रिफंड।",
    termsSec4Slab3: "निर्धारित समय से ३ घंटे से कम पहले: कोई रिफंड नहीं (बुकिंग राशि जब्त होगी)।",
    termsSec4NoShowClientTitle: "ग्राहक अनुपस्थिति (No-Show):",
    termsSec4NoShowClientDesc: "यदि कोई ग्राहक बिना पूर्व सूचना के निर्धारित समय पर नियत स्थान पर पहुंचने में विफल रहता है (और स्टार्ट ओटीपी सत्यापित नहीं होता है), तो कोई रिफंड नहीं दिया जाएगा और साथी को मुआवजा देने के लिए राशि जब्त कर ली जाएगी। बार-बार अनुपस्थिति से खाता निलंबित हो सकता है।",
    termsSec4NoShowCompTitle: "साथी की अनुपस्थिति पर जुर्माना एवं १००% रिफंड:",
    termsSec4NoShowCompDesc: "यदि साथी बिना किसी उचित कारण के निर्धारित समय पर बुकिंग स्थान पर पहुंचने में विफल रहता है:",
    termsSec4NoShowCompItem1: "१. ग्राहक को तुरंत बुकिंग राशि का १००% पूरा रिफंड मिलेगा।",
    termsSec4NoShowCompItem2: "२. साथी पर वित्तीय जुर्माना (वॉलेट या भविष्य के भुगतान से कटौती) और/या खाता निलंबन की कार्रवाई की जाएगी।",
    termsSec4EarlyEndTitle: "समय से पहले समाप्ति या असंतोष:",
    termsSec4EarlyEndDesc: "यदि कोई सत्र आपसी सहमति से या ग्राहक की प्राथमिकता के कारण निर्धारित अवधि से पहले समाप्त होता है, तो कोई आंशिक रिफंड नहीं दिया जाएगा। यदि किसी दुर्व्यवहार या नियम उल्लंघन के कारण सत्र समाप्त होता है, तो रिफंड पात्रता तय करने से पहले सहायता टीम द्वारा जांच की जाएगी।",
    termsSec4TechErrorsTitle: "तकनीकी या प्लेटफ़ॉर्म त्रुटियां:",
    termsSec4TechErrorsDesc: "यदि बैंक खाते से राशि कट जाती है लेकिन नेटवर्क विफलता के कारण बुकिंग की पुष्टि नहीं होती है, तो पूरी राशि ४८ घंटों के भीतर स्वचालित रूप से वापस कर दी जाएगी।",
    termsSec4TimelinesTitle: "रिफंड प्रक्रिया की समयसीमा:",
    termsSec4TimelinesDesc: "स्वीकृत रिफंड तुरंत शुरू किए जाते हैं और मूल भुगतान माध्यम में वापस जमा किए जाते हैं:",
    termsSec4TimelineUpi: "यूपीआई (UPI): १–५ कार्य दिवस",
    termsSec4TimelineNb: "नेट बैंकिंग (Net Banking): ३–५ कार्य दिवस",
    termsSec4TimelineCards: "क्रेडिट / डेबिट कार्ड: ५–७ कार्य दिवस",
    termsSec4NonRefundTitle: "गैर-वापसी योग्य वस्तुएं:",
    termsSec4NonRefundDesc: "सत्यापन प्रक्रिया शुरू होने के बाद एकमुश्त प्रोफ़ाइल सत्यापन शुल्क या प्रीमियम सदस्यता शुल्क गैर-वापसी योग्य हैं।",
    termsSec4SupportTitle: "रिफंड सहायता के लिए संपर्क:",
    termsSec4SupportDesc: "किसी भी रद्दीकरण या रिफंड प्रश्न के लिए, हमारी सहायता टीम से Support@pairuptoday.com पर संपर्क करें।",

    termsSec5Title: "५. सुरक्षा एवं आचार संहिता (Safety & Code of Conduct)",
    termsSec5P1Title: "केवल सार्वजनिक स्थान:",
    termsSec5P1Desc: "सभी व्यक्तिगत मुलाकातें सुरक्षित और सार्वजनिक स्थानों (जैसे कैफे, रेस्तरां, मॉल, पार्क, सार्वजनिक कार्यक्रम) पर ही होनी चाहिए। निजी घरों, होटल के कमरों या सुनसान क्षेत्रों में मिलना सख्त वर्जित है।",
    termsSec5P2Title: "आपसी सम्मान:",
    termsSec5P2Desc: "दोनों पक्षों को सम्मानजनक व्यवहार बनाए रखना चाहिए। उत्पीड़न, अभद्र भाषा, नशा या अवांछित शारीरिक संपर्क के कारण सत्र तुरंत समाप्त हो जाएगा और स्थायी प्रतिबंध लगाया जाएगा।",
    termsSec5P3Title: "आपातकालीन निकास (Emergency Exit):",
    termsSec5P3Desc: "यदि ग्राहक प्लेटोनिक नीति का उल्लंघन करता है या अनुचित व्यवहार करता है, तो साथी तुरंत सत्र समाप्त कर सकता है और उसका भुगतान जब्त नहीं होगा (जांच के अधीन)।",

    termsSec6Title: "६. डेटा गोपनीयता एवं सूचना सुरक्षा",
    termsSec6P1Title: "व्यक्तिगत डेटा की सख्त गोपनीयता:",
    termsSec6P1Desc: "ग्राहकों और साथियों द्वारा प्रदान की गई सभी संवेदनशील व्यक्तिगत और वित्तीय जानकारी—सरकारी आईडी प्रमाण, फोन नंबर, ईमेल और बैंक विवरण—हमारे सुरक्षा प्रोटोकॉल के तहत गोपनीय और एन्क्रिप्टेड रखी जाती है।",
    termsSec6P2Title: "कोई अनधिकृत प्रकटीकरण नहीं:",
    termsSec6P2Desc: "हम अन्य उपयोगकर्ताओं या अनधिकृत तीसरे पक्षों को आपका व्यक्तिगत विवरण नहीं बेचते या प्रदर्शित नहीं करते हैं। जानकारी का उपयोग केवल पहचान सत्यापन, सुरक्षित भुगतान और कानून प्रवर्तन आवश्यकताओं के लिए किया जाता है।",

    termsSec7Title: "७. देयता की सीमा (Limitation of Liability)",
    termsSec7P1Title: "स्वतंत्र साथी (Independent Companions):",
    termsSec7P1Desc: "साथी स्वतंत्र व्यक्ति हैं, Pairup Today के कर्मचारी नहीं। हम केवल एक प्रौद्योगिकी सुविधा प्रदाता के रूप में कार्य करते हैं।",
    termsSec7P2Title: "व्यक्तिगत जिम्मेदारी:",
    termsSec7P2Desc: "मुलाकात के दौरान उपयोगकर्ता अपनी व्यक्तिगत सुरक्षा और बातचीत के लिए पूरी तरह जिम्मेदार हैं। उपयोगकर्ताओं के बीच बातचीत से उत्पन्न किसी भी चोट, हानि या विवाद के लिए Pairup Today उत्तरदायी नहीं है।",

    termsSec8Title: "८. शासी कानून एवं क्षेत्राधिकार",
    termsSec8Desc: "ये शर्तें भारत के कानूनों के अनुसार शासित और परिभाषित की जाएंगी। Pairup Today के उपयोग से उत्पन्न होने वाला कोई भी विवाद भारत की सक्षम अदालतों के अनन्य क्षेत्राधिकार के अधीन होगा।",

    // Cancellation & Refund Workflow
    cancelBookingBtn: "बुकिंग रद्द करें",
    cancelBookingModalTitle: "बुकिंग रद्दीकरण एवं रिफ़ंड अनुरोध",
    cancelBookingWarning: "कृपया पुष्टि करने से पहले रद्दीकरण नीति की समीक्षा करें। एक बार रद्द होने पर आपका स्लॉट रिलीज़ हो जाएगा।",
    selectReasonLabel: "रद्दीकरण का कारण चुनें",
    reasonChangeOfPlans: "योजना में बदलाव",
    reasonScheduleConflict: "समय / शेड्यूल का टकराव",
    reasonEmergency: "व्यक्तिगत या चिकित्सीय आपातकाल",
    reasonBookedByMistake: "गलती से बुक हो गया",
    reasonOther: "अन्य",
    customReasonPlaceholder: "कृपया रद्दीकरण का कारण संक्षेप में लिखें (वैकल्पिक)...",
    timeRemainingLabel: "सत्र से पहले शेष समय",
    applicableRefundSlab: "लागू रिफ़ंड नीति",
    refundSlab100: "100% पूरा रिफ़ंड (शुरू होने से 12 घंटे से अधिक पहले)",
    refundSlab50: "50% आंशिक रिफ़ंड (शुरू होने से 3 से 12 घंटे पहले)",
    refundSlab0: "0% कोई रिफ़ंड नहीं (शुरू होने से 3 घंटे से कम पहले)",
    originalPaidAmount: "मूल भुगतान राशि",
    refundableAmount: "परिकलित वापसी योग्य राशि",
    noRefundNotice: "हमारी प्लेटफ़ॉर्म नीति के अनुसार, निर्धारित समय के 3 घंटे के भीतर रद्दीकरण गैर-वापसी योग्य है। बैंक विवरण की आवश्यकता नहीं है।",
    confirmZeroRefundBtn: "पुष्टि करें और रद्द करें (बिना रिफ़ंड)",
    savedBankTitle: "रिफ़ंड भुगतान के लिए सत्यापित बैंक खाता",
    savedBankVerifiedBadge: "APITXT द्वारा सत्यापित",
    beneficiaryNameLabel: "लाभार्थी का नाम",
    accountNumberLabel: "बैंक खाता संख्या",
    ifscCodeLabel: "आईएफएससी कोड (IFSC)",
    changeBankBtn: "दूसरा बैंक खाता चुनें",
    confirmCancellationBtn: "रद्दीकरण की पुष्टि करें और जमा करें",
    newBankFormTitle: "रिफ़ंड के लिए बैंक विवरण दर्ज करें",
    nameMatchNote: "लाभार्थी का नाम आपके सत्यापित सरकारी पहचान पत्र के नाम से मेल खाना चाहिए।",
    verifyAndCancelBtn: "APITXT द्वारा बैंक सत्यापित करें और रद्द करें",
    nameMismatchError: "बैंक लाभार्थी का नाम आपके सत्यापित सरकारी पहचान पत्र के नाम से मेल खाना चाहिए।",
    cancellationSuccessTitle: "बुकिंग सफलतापूर्वक रद्द कर दी गई",
    refundProcessingNotice: "आपका ₹{amount} का रिफ़ंड शुरू कर दिया गया है और 1–5 कार्य दिवसों में आपके बैंक खाते में जमा होगा।",
    closeBtn: "बंद करें"
  }
};
