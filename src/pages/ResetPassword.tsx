import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { Logger } from '../lib/loggingHelpers';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Verificar se há uma sessão de recuperação de senha
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };
    
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    // Validações adicionais de senha
    if (password.length > 128) {
      setError('Password is too long. Please use a password with 6-128 characters.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please make sure both passwords are identical.');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    console.log('[ResetPassword] Updating password...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        // Log de falha no reset de senha
        if (user) {
          await Logger.log(
            'password_reset_completed_failed',
            `Failed to complete password reset`,
            {
              metadata: {
                user_id: user.id,
                email: user.email,
                error_type: error.name,
                error_message: error.message,
                timestamp: new Date().toISOString()
              }
            }
          );
        }
        throw error;
      }
      
      console.log('[ResetPassword] Password updated successfully');
      
      // Log de sucesso no reset de senha
      if (user) {
        await Logger.log(
          'password_reset_completed',
          `Password reset completed successfully`,
          {
            metadata: {
              user_id: user.id,
              email: user.email,
              timestamp: new Date().toISOString()
            }
          }
        );
      }
      
      setSuccess(true);
      
      // Fazer logout após 3 segundos e redirecionar para login
      setTimeout(() => {
        supabase.auth.signOut();
        navigate('/login');
      }, 3000);
      
    } catch (err: any) {
      console.log('[ResetPassword] Error updating password:', err);
      
      // Tratar diferentes tipos de erro com mensagens específicas
      let errorMessage = 'Failed to update password. Please try again.';
      
      if (err?.message) {
        if (err.message.includes('Password should be at least')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else if (err.message.includes('Invalid password')) {
          errorMessage = 'Please enter a valid password.';
        } else if (err.message.includes('Too many requests')) {
          errorMessage = 'Too many password update attempts. Please wait a few minutes before trying again.';
        } else if (err.message.includes('User not found') || err.message.includes('Session expired')) {
          errorMessage = 'Your reset link has expired or is invalid. Please request a new password reset.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-green-600 to-green-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Password Updated!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your password has been successfully updated
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                You will be redirected to the login page in a few seconds...
              </p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tfe-blue-600"></div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
                          <button 
                onClick={() => {
                  supabase.auth.signOut();
                  navigate('/login');
                }}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-tfe-blue-600 bg-tfe-blue-50 border border-tfe-blue-200 rounded-lg hover:bg-tfe-blue-100 hover:border-tfe-blue-300 hover:text-tfe-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-tfe-blue-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Go to login now
              </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-red-600 rounded-full flex items-center justify-center shadow-lg">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-lg relative block w-full pl-10 pr-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-tfe-blue-500 focus:border-tfe-blue-500 sm:text-sm transition-colors"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Password must be at least 6 characters long
              </div>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className={`appearance-none rounded-lg relative block w-full pl-10 pr-10 py-3 border ${
                    confirmPassword && password !== confirmPassword 
                      ? 'border-tfe-red-300 focus:ring-red-500 focus:border-tfe-red-500' 
                      : confirmPassword && password === confirmPassword 
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-tfe-blue-500 focus:border-tfe-blue-500'
                  } placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm transition-colors`}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {confirmPassword && (
                <div className={`mt-2 text-xs flex items-center ${
                  password === confirmPassword ? 'text-green-600' : 'text-tfe-red-600'
                }`}>
                  {password === confirmPassword ? (
                    <>
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Passwords match
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Passwords do not match
                    </>
                  )}
                </div>
              )}
            </div>
            
            {error && (
              <div className="bg-tfe-red-50 border border-tfe-red-200 rounded-lg p-4">
                <p className="text-sm text-tfe-red-600 flex items-center">
                  <span className="mr-2">❌</span> {error}
                </p>
              </div>
            )}
            
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tfe-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating password...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
        
        <div className="text-center">
          <button 
            onClick={() => navigate('/login')}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 