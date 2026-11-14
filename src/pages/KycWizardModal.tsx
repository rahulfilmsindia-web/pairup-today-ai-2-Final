import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GovernmentIdType } from '../types';
import { ShieldCheck, Upload, AlertCircle, Camera, Check, UserCheck, Lock, X, FileText, RefreshCw, User, Heart } from 'lucide-react';

export const KycWizardModal: React.FC = () => {
  const { showKycWizard, closeKycWizard, submitKyc, user, activeRole, selectActiveRole } = useAuth();
  const { t } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<'CLIENT' | 'COMPANION'>(() => {
    if (activeRole === 'COMPANION' || user?.activeRole === 'COMPANION') return 'COMPANION';
    return 'CLIENT';
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [dob, setDob] = useState('');
  const [idType, setIdType] = useState<GovernmentIdType>('AADHAAR');
  const [idFrontUrl, setIdFrontUrl] = useState<string>('');
  const [idBackUrl, setIdBackUrl] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('Delhi NCR');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (activeRole) {
      setSelectedRole(activeRole);
    } else if (user?.activeRole) {
      setSelectedRole(user.activeRole);
    }
  }, [activeRole, user?.activeRole]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported in this browser.');
        return;
      }
      stopCameraStream();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Direct camera access error:', err);
      setCameraError('Unable to open front camera directly. Please check browser permissions or use file upload.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSelfieUrl(dataUrl);
        stopCameraStream();
      }
    } catch (err) {
      console.error('Failed to capture snapshot from video:', err);
      setCameraError('Failed to capture selfie. Please try again.');
    }
  };

  // Dynamic max date of birth for strict 18+ enforcement
  const maxDobDate = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setErrorMsg('Choose a JPEG, PNG or WebP image no larger than 5 MB.');
        e.target.value = '';
        return;
      }
      setErrorMsg(null);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setter(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!showKycWizard) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!ageConfirmed) {
      setErrorMsg('You must confirm that you are at least 18 years of age.');
      return;
    }

    if (!dob) {
      setErrorMsg('Date of birth is required.');
      return;
    }

    // Verify 18+
    const birthDate = new Date(`${dob}T00:00:00.000Z`);
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    if (
      today.getUTCMonth() < birthDate.getUTCMonth() ||
      (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())
    ) age -= 1;

    if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() > Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) || age < 18) {
      setErrorMsg('Platform safety requires all participants to be at least 18 years of age.');
      return;
    }

    if (!legalName.trim()) {
      setErrorMsg('Please enter your legal name as on government identity card.');
      return;
    }

    if (!idFrontUrl || !selfieUrl || (idType !== 'PAN' && !idBackUrl)) {
      setErrorMsg('Upload the required front, back (except PAN), and selfie images before submitting.');
      return;
    }

    setLoading(true);
    // Ensure active role is synchronized before KYC submission if user is DUAL
    if (user?.role === 'DUAL' && user.activeRole !== selectedRole) {
      await selectActiveRole(selectedRole);
    }
    const result = await submitKyc({
      legalName,
      dob,
      idType,
      idFrontUrl,
      idBackUrl: idType === 'PAN' ? null : idBackUrl,
      selfieUrl,
      userType: selectedRole,
      bio,
      city,
      photos: photos.slice(0, 6)
    });
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Submission failed. Please check your details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-xl my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header with dismiss button */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                {t.kycWizardTitle}
              </h2>
              <p className="text-xs text-slate-400">
                {t.kycWizardSubtitle}
              </p>
            </div>
          </div>

          <button
            onClick={closeKycWizard}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning Notice */}
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <p>
            <strong>Mandatory Safety Policy:</strong> For platform compliance, date of birth is permanently locked upon submission. Following submission, your current active session will be revoked and you will be returned to the login screen to re-authenticate with your phone and password.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role Choice for Verification */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Select Verification Role *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('CLIENT')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  selectedRole === 'CLIENT'
                    ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-pink-500 text-pink-300 shadow-md shadow-pink-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Client Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('COMPANION')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  selectedRole === 'COMPANION'
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Heart className="w-4 h-4" />
                <span>Companion Profile</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {selectedRole === 'COMPANION' 
                ? 'Applying to offer companionship services on PairUpToday.'
                : 'Applying to browse and book companionship services.'}
            </p>
          </div>

          {/* Age 18+ Gate */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-700 bg-slate-900"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-200">
                {t.ageGateAgreement}
              </span>
            </label>
          </div>

          {/* Legal Name & DOB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.legalNameLabel} *
              </label>
              <input
                type="text"
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                placeholder="Full name as printed on Gov ID"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.dobLabel} (Permanent Lock) *
              </label>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                max={maxDobDate}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Operating City / Region
            </label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-400"
            >
              <option value="Delhi NCR">Delhi NCR</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Kolkata">Kolkata</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Chennai">Chennai</option>
              <option value="Pune">Pune</option>
              <option value="Jaipur">Jaipur</option>
              <option value="Ahmedabad">Ahmedabad</option>
            </select>
          </div>

          {/* Government ID Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {t.idTypeLabel} *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['AADHAAR', 'PAN', 'VOTER_ID', 'PASSPORT'] as GovernmentIdType[]).map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setIdType(type)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors border ${
                    idType === type
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* ID Documents Front & Back */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Front ID Document</span>
                <span className="text-[10px] text-emerald-400">Encrypted</span>
              </div>
              
              <div className="h-28 rounded-lg overflow-hidden relative border border-slate-700 bg-slate-900 flex items-center justify-center">
                {idFrontUrl ? (
                  <img src={idFrontUrl} alt="Front ID" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-3">
                    <FileText className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400">No document attached</span>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="sr-only">Choose Front ID</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => handleFileUpload(e, setIdFrontUrl)}
                  className="block w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 cursor-pointer"
                />
              </label>
            </div>

            {idType !== 'PAN' && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Back ID Document</span>
                  <span className="text-[10px] text-emerald-400">Encrypted</span>
                </div>
                
                <div className="h-28 rounded-lg overflow-hidden relative border border-slate-700 bg-slate-900 flex items-center justify-center">
                  {idBackUrl ? (
                    <img src={idBackUrl} alt="Back ID" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-3">
                      <FileText className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-400">No document attached</span>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="sr-only">Choose Back ID</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => handleFileUpload(e, setIdBackUrl)}
                    className="block w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Live Selfie with Front Camera Feed */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-2 ring-emerald-500 bg-slate-900 flex items-center justify-center">
                {selfieUrl ? (
                  <img src={selfieUrl} alt="Selfie" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-7 h-7 text-slate-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Live Facial Verification Selfie</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Matches with identity photo to prevent impersonation and fraud.
                </p>
              </div>
            </div>

            {/* Direct Front Camera Video Container */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden bg-black border border-emerald-500/50 aspect-video max-w-sm mx-auto flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Selfie</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {!isCameraActive && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Open Front Camera</span>
                </button>
              )}

              {selfieUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setSelfieUrl('');
                    startCamera();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              )}

              <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload From File</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={e => {
                    stopCameraStream();
                    handleFileUpload(e, setSelfieUrl);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t.bioLabel}
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell others about your interests, conversation style, and background..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Submitting KYC...' : t.submitKyc}
          </button>

          <p className="text-[11px] text-center text-slate-400">
            Protected by PairUp Security Network. No documents are stored in public browser storage.
          </p>
        </form>

      </div>
    </div>
  );
};
