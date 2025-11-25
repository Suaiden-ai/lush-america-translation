import React, { useState, useEffect } from 'react';
import { User, Lock, Mail, UserPlus, Link } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { clearUtmParams, getStoredUtmParams } from '../utils/utmTracker';

export function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [searchParams] = useSearchParams();
  const [isReferralCodeFromUrl, setIsReferralCodeFromUrl] = useState(false);

  // Check for referral code in URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode }));
      setIsReferralCodeFromUrl(true);
    }
  }, [searchParams]);

  // Handle countdown and redirect after successful registration
  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (success && countdown === 0) {
      navigate('/login');
    }
  }, [success, countdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpar erros anteriores
    setErrors({});
    
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('auth.firstNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t('auth.phoneRequired');
    } else if (!/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = t('auth.invalidPhone');
    }

    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordsDoNotMatch');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      console.log('[Register] Tentando registrar:', formData.email);
      
      // Chamar signUp sem depender do loading do contexto
      const utmParams = getStoredUtmParams();
      const sanitizedReferral = formData.referralCode.trim() || undefined;
      const result = await signUp(
        formData.email,
        formData.password,
        formData.name,
        formData.phone,
        {
          referralCode: sanitizedReferral,
          utm: utmParams ?? undefined,
        }
      );
      
      console.log('[Register] Registro bem-sucedido:', result);
      
      // Definir sucesso imediatamente
      setSuccess(true);
      setCountdown(5);
      if (utmParams) {
        clearUtmParams();
      }
      
    } catch (err: any) {
      console.error('[Register] Erro no registro:', err);
      
      // Tratar diferentes tipos de erro
      let errorMessage = t('auth.registrationFailed');
      
      if (err?.message) {
        if (err.message.includes('already registered')) {
          errorMessage = t('auth.emailAlreadyRegistered');
        } else if (err.message.includes('password')) {
          errorMessage = t('auth.passwordTooShort');
        } else if (err.message.includes('email')) {
          errorMessage = t('auth.invalidEmail');
        } else {
          errorMessage = err.message;
        }
      }
      
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Account Created Successfully! 🎉
            </h2>
            <div className="mt-6 bg-white rounded-xl p-6 shadow-lg border border-green-100">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-tfe-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-tfe-blue-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                Check Your Email
              </h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                We've sent a verification link to <strong>{formData.email}</strong>
              </p>
                              <div className="bg-tfe-blue-50 rounded-lg p-4 border border-tfe-blue-200">
                <p className="text-sm text-tfe-blue-800 text-center font-medium">
                  📧 A verification link has been sent to your email
                </p>
                <p className="text-xs text-tfe-blue-700 text-center mt-1">
                  Please check your inbox and click the verification link to activate your account
                </p>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-sm text-gray-600">
                Redirecting to login page in {countdown} seconds...
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-tfe-blue-600 to-tfe-blue-700 hover:from-tfe-blue-700 hover:to-tfe-blue-800 transition-all duration-200 shadow-md"
              >
                Go to Login Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tfe-blue-50 to-tfe-red-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-tfe-blue-600 to-tfe-red-600 rounded-full flex items-center justify-center shadow-lg">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create Your Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join us for professional translation services
          </p>
          <p className="mt-2 text-center text-sm text-gray-600 mb-4">
            Already have an account?
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-tfe-blue-600 to-tfe-blue-700 border border-transparent rounded-lg hover:from-tfe-blue-700 hover:to-tfe-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tfe-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border ${
                    errors.name ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                  } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors`}
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              {errors.name && <p className="mt-2 text-sm text-tfe-red-600 flex items-center">
                <span className="mr-1">⚠️</span> {errors.name}
              </p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border ${
                    errors.email ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                  } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors`}
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {errors.email && <p className="mt-2 text-sm text-tfe-red-600 flex items-center">
                <span className="mr-1">⚠️</span> {errors.email}
              </p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border ${
                    errors.phone ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                  } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors`}
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              {errors.phone && <p className="mt-2 text-sm text-tfe-red-600 flex items-center">
                <span className="mr-1">⚠️</span> {errors.phone}
              </p>}
            </div>

                    <div>
                      <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('auth.referralCode')}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Link className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="referralCode"
                          name="referralCode"
                          type="text"
                          className={`appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border ${
                            errors.referralCode ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                          } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors ${
                            isReferralCodeFromUrl ? 'bg-gray-100 cursor-not-allowed' : ''
                          }`}
                          placeholder={t('auth.referralCodePlaceholder')}
                          value={formData.referralCode}
                          onChange={handleChange}
                          readOnly={isReferralCodeFromUrl}
                        />
                      </div>
                      {isReferralCodeFromUrl && (
                        <p className="mt-1 text-xs text-tfe-blue-600">
                          {t('auth.referralCodeDetected')}
                        </p>
                      )}
                      {errors.referralCode && <p className="mt-2 text-sm text-tfe-red-600 flex items-center">
                        <span className="mr-1">⚠️</span> {errors.referralCode}
                      </p>}
                    </div>
          </div>

          {errors.general && (
            <div className="bg-tfe-red-50 border border-tfe-red-200 rounded-lg p-4">
              <p className="text-sm text-tfe-red-600 flex items-center">
                <span className="mr-2">❌</span> {errors.general}
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border ${
                    errors.password ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                  } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors`}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              {errors.password && <p className="mt-2 text-sm text-tfe-red-600 flex items-center">
                <span className="mr-1">⚠️</span> {errors.password}
              </p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border ${
                    errors.confirmPassword ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                  } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors`}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-tfe-red-600 flex items-center">
                  <span className="mr-1">⚠️</span> {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tfe-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                <div className="flex items-center">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Account
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}