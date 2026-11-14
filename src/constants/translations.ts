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
  tabBookings: string;
  tabChat: string;
  tabSafety: string;
  tabSettings: string;
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
    servicesSectionTitle: "24 Distinctive Companionship Services",
    servicesSectionDesc: "Choose from our verified companionship offerings across social, lifestyle, travel, wellness, culture and care.",
    catAll: "All 24 Services",
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
    hiwStep3CompDesc: "Choose which of the 24 approved services you wish to offer and configure hourly rates.",
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
    tabBookings: "My Bookings",
    tabChat: "Secure Chat",
    tabSafety: "Safety & SOS",
    tabSettings: "Settings",
    findCompanionsTitle: "Discover Verified Companions",
    searchPlaceholder: "Search by city, name, or interests...",
    filterByService: "Filter by Service",
    filterByCity: "City",
    allServices: "All 24 Services",
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
    footerEmailLabel: "pairuptoday@gmail.com",
    footerEmergencyAssistance: "Emergency Assistance",
    footerPoliceEmergency: "Police Emergency",
    footerNationalSos: "National Emergency SOS",
    footerBuiltWithLove: "Better Connections. Brighter Moments.",
    footerCopyEmail: "Copy Email",
    footerEmailCopied: "Email copied: pairuptoday@gmail.com",

    // Common UI Actions
    closeAction: "Close",
    cancelAction: "Cancel",
    confirmAction: "Confirm",
    loadingAction: "Processing...",
    copiedAction: "Copied!",

    // Companion Listing & Profile Details
    companionListSectionTitle: "Verified Companions Across India",
    companionListSectionSubtitle: "Explore verified social companions available in your city for all 24 companionship services.",
    quickViewAction: "Quick View",
    bookNowAction: "Book Now",
    availableServicesLabel: "Available Services",
    profileUnavailableForBooking: "This profile is currently unavailable for booking.",
    ageYearsLabel: "yrs",
    ratePerHourLabel: "₹{rate}/hr",
    selectLocationLabel: "Select City / Location",
    allLocationsLabel: "All Locations",
    filterByServiceLabel: "Filter by Service",
    allServicesLabel: "All 24 Services",
    viewDetailsAction: "View Profile",
    additionalPhotosLabel: "Additional Photographs"
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
    servicesSectionTitle: "২৪টি অনন্য সাহচর্য সেবা",
    servicesSectionDesc: "সামাজিক, লাইফস্টাইল, ভ্রমণ, স্বাস্থ্য, সংস্কৃতি এবং পরিচর্যা বিষয়ক আমাদের যাচাইকৃত সেবা থেকে বেছে নিন।",
    catAll: "সকল ২৪টি সার্ভিস",
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
    hiwStep3CompDesc: "অনুমোদিত ২৪টি সেবার মধ্যে কোনগুলো প্রদান করতে চান এবং প্রতি ঘণ্টার রেট ঠিক করুন।",
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
    tabBookings: "আমার বুকিং",
    tabChat: "সুরক্ষিত চ্যাট",
    tabSafety: "নিরাপত্তা ও এসওএস",
    tabSettings: "সেটিংস",
    findCompanionsTitle: "যাচাইকৃত সঙ্গী খুঁজুন",
    searchPlaceholder: "শহর, নাম বা পছন্দের বিষয় দিয়ে খুঁজুন...",
    filterByService: "সার্ভিস অনুযায়ী ফিল্টার",
    filterByCity: "শহর",
    allServices: "সকল ২৪টি সার্ভিস",
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
    footerEmailLabel: "pairuptoday@gmail.com",
    footerEmergencyAssistance: "জরুরি সহায়তা",
    footerPoliceEmergency: "পুলিশ হেল্পলাইন",
    footerNationalSos: "জাতীয় জরুরি এসওএস",
    footerBuiltWithLove: "উন্নত সংযোগ। উজ্জ্বল মুহূর্ত।",
    footerCopyEmail: "ইমেল কপি করুন",
    footerEmailCopied: "ইমেল কপি করা হয়েছে: pairuptoday@gmail.com",

    // Common UI Actions
    closeAction: "বন্ধ করুন",
    cancelAction: "বাতিল করুন",
    confirmAction: "নিশ্চিত করুন",
    loadingAction: "অপেক্ষা করুন...",
    copiedAction: "কপি সম্পন্ন!",

    // Companion Listing & Profile Details
    companionListSectionTitle: "ভারতজুড়ে যাচাইকৃত কম্প্যানিয়ন",
    companionListSectionSubtitle: "২৪টি সাহচর্য সেবার জন্য আপনার শহরের যাচাইকৃত সঙ্গী অন্বেষণ করুন।",
    quickViewAction: "কুইক ভিউ",
    bookNowAction: "বুকিং করুন",
    availableServicesLabel: "উপলব্ধ সেবাসমূহ",
    profileUnavailableForBooking: "এই প্রোফাইলটি বর্তমানে বুকিংয়ের জন্য উপলব্ধ নয়।",
    ageYearsLabel: "বছর",
    ratePerHourLabel: "₹{rate}/ঘণ্টা",
    selectLocationLabel: "শহর / অবস্থান নির্বাচন করুন",
    allLocationsLabel: "সকল অবস্থান",
    filterByServiceLabel: "সার্ভিস অনুযায়ী ফিল্টার",
    allServicesLabel: "সকল ২৪টি সার্ভিস",
    viewDetailsAction: "প্রোফাইল দেখুন",
    additionalPhotosLabel: "অতিরিক্ত আলোকচিত্র"
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
    servicesSectionTitle: "24 विशिष्ट साहचर्य सेवाएँ",
    servicesSectionDesc: "सामाजिक, जीवनशैली, यात्रा, स्वास्थ्य, संस्कृति और देखभाल से जुड़ी हमारी सत्यापित सेवाओं में से चुनें।",
    catAll: "सभी 24 सेवाएँ",
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
    hiwStep3CompDesc: "स्वीकृत 24 सेवाओं में से चुनें कि आप कौन-सी सेवाएँ देना चाहते हैं और दरें तय करें।",
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
    tabBookings: "मेरी बुकिंग्स",
    tabChat: "सुरक्षित चैट",
    tabSafety: "सुरक्षा एवं एसओएस",
    tabSettings: "सेटिंग्स",
    findCompanionsTitle: "सत्यापित साथी खोजें",
    searchPlaceholder: "शहर, नाम या रुचि से खोजें...",
    filterByService: "सेवा अनुसार फ़िल्टर करें",
    filterByCity: "शहर",
    allServices: "सभी 24 सेवाएँ",
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
    footerEmailLabel: "pairuptoday@gmail.com",
    footerEmergencyAssistance: "आपातकालीन सहायता",
    footerPoliceEmergency: "पुलिस आपातकालीन",
    footerNationalSos: "राष्ट्रीय आपातकालीन एसओएस",
    footerBuiltWithLove: "बेहतर जुड़ाव। उज्जवल पल।",
    footerCopyEmail: "ईमेल कॉपी करें",
    footerEmailCopied: "ईमेल कॉपी किया गया: pairuptoday@gmail.com",

    // Common UI Actions
    closeAction: "बंद करें",
    cancelAction: "रद्द करें",
    confirmAction: "पुष्टि करें",
    loadingAction: "प्रतीक्षा करें...",
    copiedAction: "कॉपी पूर्ण!",

    // Companion Listing & Profile Details
    companionListSectionTitle: "भारतभर में सत्यापित साथी",
    companionListSectionSubtitle: "सभी 24 साहचर्य सेवाओं के लिए अपने शहर में उपलब्ध सत्यापित साथियों की सूची देखें।",
    quickViewAction: "क्विक व्यू",
    bookNowAction: "अभी बुक करें",
    availableServicesLabel: "उपलब्ध सेवाएँ",
    profileUnavailableForBooking: "यह प्रोफ़ाइल वर्तमान में बुकिंग के लिए उपलब्ध नहीं है।",
    ageYearsLabel: "वर्ष",
    ratePerHourLabel: "₹{rate}/घंटा",
    selectLocationLabel: "शहर / स्थान चुनें",
    allLocationsLabel: "सभी स्थान",
    filterByServiceLabel: "सेवा अनुसार फ़िल्टर करें",
    allServicesLabel: "सभी 24 सेवाएँ",
    viewDetailsAction: "प्रोफ़ाइल देखें",
    additionalPhotosLabel: "अतिरिक्त छायाचित्र"
  }
};
