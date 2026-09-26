import React, { useState, useEffect } from 'react';
import { 
  Lock, Mail, Phone, MapPin, User, ShieldCheck, 
  ArrowRight, KeyRound, CheckCircle, RefreshCw, AlertCircle, Store, ShoppingBag, ArrowLeftRight 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface AuthViewsProps {
  initialMode?: 'login' | 'register' | 'forgot_password';
  onNavigate: (route: string) => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  initialMode = 'login',
  onNavigate,
}) => {
  const { login, verifyLoginOtp, register, verifyRegistrationOtp, resendOtp } = useAuth();

  // Mode: 'login' | 'verify_login_otp' | 'register' | 'verify_register_otp' | 'forgot_password' | 'reset_password'
  const [viewState, setViewState] = useState<'login' | 'verify_login_otp' | 'register' | 'verify_register_otp' | 'forgot_password' | 'reset_password'>(initialMode);

  // Registration state
  const [accountType, setAccountType] = useState<'customer' | 'seller' | 'both'>('customer');
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [country, setCountry] = useState('Rwanda');
  const [city, setCity] = useState('Kigali');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Handle Registration Submit (Step 1)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!acceptTerms) {
      setErrorMessage('Please accept the Terms and Conditions.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        name,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        country,
        city,
        accountType,
        acceptTerms,
      });

      setTargetEmail(res.email);
      setCooldownSeconds(45);
      setViewState('verify_register_otp');
      setSuccessMessage('Verification code dispatched to your email.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Registration OTP Verify (Step 2)
  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!otpCode || otpCode.length < 6) {
      setErrorMessage('Please enter the full 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyRegistrationOtp(targetEmail || regEmail, otpCode);
      setSuccessMessage('Email Verified Successfully! Welcome to BONFILS STORE.');
      setTimeout(() => {
        onNavigate('/');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login Submit (Step 1)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await login(loginEmail, loginPassword);
      if (res.requireOtp) {
        setTargetEmail(res.email);
        setMaskedEmail(res.maskedEmail);
        setCooldownSeconds(45);
        setViewState('verify_login_otp');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Login OTP Verify (Step 2)
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!otpCode || otpCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyLoginOtp(targetEmail || loginEmail, otpCode);
      setSuccessMessage('Login Successful!');
      setTimeout(() => {
        onNavigate('/');
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async (purpose: 'registration' | 'login' | 'password_reset') => {
    if (cooldownSeconds > 0) return;
    setErrorMessage('');
    setIsLoading(true);
    try {
      const email = targetEmail || regEmail || loginEmail || resetEmail;
      await resendOtp(email, purpose);
      setCooldownSeconds(45);
      setSuccessMessage('A fresh verification code was sent to your email.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Submit (Step 1)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      await api.forgotPassword(resetEmail);
      setTargetEmail(resetEmail);
      setCooldownSeconds(45);
      setViewState('reset_password');
      setSuccessMessage('Password reset verification code dispatched to your email.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to request reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password Submit (Step 2)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.resetPassword({
        email: targetEmail || resetEmail,
        code: otpCode,
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      setSuccessMessage('Password updated successfully! Please log in.');
      setTimeout(() => {
        setViewState('login');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8 shadow-sm">
        
        {/* Brand header */}
        <div className="text-center mb-6">
          <button 
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-2 mb-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] flex items-center justify-center text-white font-extrabold text-base">
              B
            </div>
            <span className="text-xl font-extrabold text-[#222222]">
              BONFILS<span className="text-[#FF6A00]"> STORE</span>
            </span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-[#D92D20] text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-[#22A06B] text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* =========================================
            VIEW 1: REGISTRATION (Requirement 3 & 4)
        ========================================= */}
        {viewState === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#222222]">Create Account</h2>
              <p className="text-xs text-[#666666]">Join BONFILS STORE marketplace & sourcing network</p>
            </div>

            {/* Option Selection: Customer / Seller / Both (Requirement 3) */}
            <div>
              <label className="block text-xs font-bold text-[#222222] mb-2">What do you want to do?</label>
              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer text-xs transition-colors ${accountType === 'customer' ? 'border-[#FF6A00] bg-[#FFF8F2]' : 'border-[#E5E5E5] hover:border-[#CCCCCC]'}`}>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'customer'}
                    onChange={() => setAccountType('customer')}
                    className="mt-0.5 text-[#FF6A00] focus:ring-[#FF6A00]"
                  />
                  <div>
                    <div className="font-bold text-[#222222] flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-[#FF6A00]" />
                      Customer / Buyer
                    </div>
                    <p className="text-[11px] text-[#666666] mt-0.5">I want to buy products from Bonfils Store.</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer text-xs transition-colors ${accountType === 'seller' ? 'border-[#FF6A00] bg-[#FFF8F2]' : 'border-[#E5E5E5] hover:border-[#CCCCCC]'}`}>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'seller'}
                    onChange={() => setAccountType('seller')}
                    className="mt-0.5 text-[#FF6A00] focus:ring-[#FF6A00]"
                  />
                  <div>
                    <div className="font-bold text-[#222222] flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[#FF6A00]" />
                      Seller / Business Owner
                    </div>
                    <p className="text-[11px] text-[#666666] mt-0.5">I want to sell products on Bonfils Store.</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer text-xs transition-colors ${accountType === 'both' ? 'border-[#FF6A00] bg-[#FFF8F2]' : 'border-[#E5E5E5] hover:border-[#CCCCCC]'}`}>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'both'}
                    onChange={() => setAccountType('both')}
                    className="mt-0.5 text-[#FF6A00] focus:ring-[#FF6A00]"
                  />
                  <div>
                    <div className="font-bold text-[#222222] flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#FF6A00]" />
                      Customer + Seller (Dual Mode)
                    </div>
                    <p className="text-[11px] text-[#666666] mt-0.5">I want to buy products and also sell my own products.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Registration Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#444444] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#444444] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#444444] mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+250 788 000 000"
                  className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#444444] mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444444] mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#444444] mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444444] mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1 text-xs text-[#555555] cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 text-[#FF6A00] focus:ring-[#FF6A00] rounded"
                />
                <span className="text-[11px] leading-tight">
                  I accept the Terms and Conditions and understand my email will be verified with a 6-digit OTP code.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>{isLoading ? 'Creating Account...' : 'Continue to Email OTP Verification'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="text-center text-xs text-[#666666] pt-1">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setViewState('login')}
                className="font-bold text-[#FF6A00] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* =========================================
            VIEW 2: REGISTRATION OTP (Requirement 5)
        ========================================= */}
        {viewState === 'verify_register_otp' && (
          <form onSubmit={handleVerifyRegisterOtp} className="space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-[#FFF3E8] text-[#FF6A00] rounded-full flex items-center justify-center mx-auto mb-2">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#222222]">Verify Your Email</h2>
              <p className="text-xs text-[#666666]">
                We sent a 6-digit verification code to: <br />
                <strong className="text-[#222222]">{targetEmail || regEmail}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-center text-[#444444]">
                Enter OTP Code:
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="583214"
                className="w-full py-3 text-center text-2xl font-mono font-bold tracking-widest border-2 border-[#FF6A00] rounded-xl focus:outline-none bg-[#FFF8F2]"
              />
              <div className="text-[11px] text-center text-[#888888]">
                This code expires in 5 minutes · Single-use
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isLoading ? 'Verifying...' : 'VERIFY & COMPLETE REGISTRATION'}
            </button>

            <div className="text-center pt-2 space-y-2">
              <div className="text-xs text-[#666666]">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  disabled={cooldownSeconds > 0 || isLoading}
                  onClick={() => handleResend('registration')}
                  className={`font-semibold cursor-pointer ${
                    cooldownSeconds > 0 ? 'text-[#999999]' : 'text-[#FF6A00] hover:underline'
                  }`}
                >
                  {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewState('register')}
                className="text-xs text-[#888888] hover:text-[#222222] cursor-pointer"
              >
                ← Back to registration form
              </button>
            </div>
          </form>
        )}

        {/* =========================================
            VIEW 3: LOGIN (Requirement 6 & 7)
        ========================================= */}
        {viewState === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#222222]">Welcome Back</h2>
              <p className="text-xs text-[#666666]">Sign in to your account with password + Email OTP</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#444444] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[#444444]">Password</label>
                <button
                  type="button"
                  onClick={() => setViewState('forgot_password')}
                  className="text-[11px] text-[#FF6A00] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>

            {/* Quick pre-fill buttons for test convenience */}
            <div className="p-2.5 bg-[#F9F9F8] rounded-lg border border-[#E5E5E5] text-[11px] space-y-1">
              <span className="text-[#888888] block">Quick test accounts:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('buyer@bonfilsstore.com');
                    setLoginPassword('Buyer@12345');
                  }}
                  className="px-2 py-0.5 bg-white border border-[#E5E5E5] rounded text-[#444444] hover:text-[#FF6A00] cursor-pointer"
                >
                  Buyer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('seller@bonfilsstore.com');
                    setLoginPassword('Seller@12345');
                  }}
                  className="px-2 py-0.5 bg-white border border-[#E5E5E5] rounded text-[#444444] hover:text-[#FF6A00] cursor-pointer"
                >
                  Seller + Buyer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('staff@bonfilsstore.com');
                    setLoginPassword('Staff@12345');
                  }}
                  className="px-2 py-0.5 bg-white border border-[#E5E5E5] rounded text-[#444444] hover:text-[#FF6A00] cursor-pointer"
                >
                  Staff
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isLoading ? 'Verifying Credentials...' : 'LOGIN'}
            </button>

            <div className="text-center text-xs text-[#666666] pt-1">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setViewState('register')}
                className="font-bold text-[#FF6A00] hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* =========================================
            VIEW 4: LOGIN OTP (Requirement 7)
        ========================================= */}
        {viewState === 'verify_login_otp' && (
          <form onSubmit={handleVerifyLoginOtp} className="space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-[#FFF3E8] text-[#FF6A00] rounded-full flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#222222]">Verify Your Login</h2>
              <p className="text-xs text-[#666666]">
                We sent a verification code to:<br />
                <strong className="text-[#222222] font-mono">{maskedEmail || targetEmail}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-center text-[#444444]">
                Enter OTP:
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="_ _ _ _ _ _"
                className="w-full py-3 text-center text-2xl font-mono font-bold tracking-widest border-2 border-[#FF6A00] rounded-xl focus:outline-none bg-[#FFF8F2]"
              />
              <div className="text-[11px] text-center text-[#888888]">
                Expiring in 5 minutes · Single-use
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isLoading ? 'Authenticating...' : 'VERIFY & LOGIN'}
            </button>

            <div className="text-center pt-2 space-y-2">
              <div className="text-xs text-[#666666]">
                Didn't receive the OTP?{' '}
                <button
                  type="button"
                  disabled={cooldownSeconds > 0 || isLoading}
                  onClick={() => handleResend('login')}
                  className={`font-semibold cursor-pointer ${
                    cooldownSeconds > 0 ? 'text-[#999999]' : 'text-[#FF6A00] hover:underline'
                  }`}
                >
                  {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend OTP'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewState('login')}
                className="text-xs text-[#888888] hover:text-[#222222] cursor-pointer"
              >
                ← Back to login
              </button>
            </div>
          </form>
        )}

        {/* =========================================
            VIEW 5: FORGOT PASSWORD (Requirement 8)
        ========================================= */}
        {viewState === 'forgot_password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#222222]">Reset Password</h2>
              <p className="text-xs text-[#666666]">Enter your registered email to receive a password reset code</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#444444] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isLoading ? 'Dispatching OTP...' : 'Send Password Reset Code'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setViewState('login')}
                className="text-xs text-[#888888] hover:text-[#222222] cursor-pointer"
              >
                ← Back to login
              </button>
            </div>
          </form>
        )}

        {/* =========================================
            VIEW 6: RESET PASSWORD WITH OTP (Requirement 8)
        ========================================= */}
        {viewState === 'reset_password' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#222222]">Set New Password</h2>
              <p className="text-xs text-[#666666]">Enter the OTP sent to {targetEmail || resetEmail}</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#444444] mb-1">Reset Verification Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit OTP"
                className="w-full py-2.5 text-center font-mono font-bold text-lg border border-[#FF6A00] rounded-lg focus:outline-none bg-[#FFF8F2]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#444444] mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#444444] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              {isLoading ? 'Updating Password...' : 'Save New Password & Continue'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
