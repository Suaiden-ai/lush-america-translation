import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getResetPasswordUrl } from '../utils/urlUtils';
import { Logger } from '../lib/loggingHelpers';
import { ActionTypes } from '../types/actionTypes';

export interface CustomUser extends SupabaseUser {
  role: 'user' | 'authenticator' | 'admin' | 'finance' | 'affiliate';
  phone?: string;
}

interface AuthContextType {
  user: CustomUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name: string, phone: string, referralCode?: string, role?: 'user' | 'authenticator') => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Busca ou cria perfil na tabela profiles
  const fetchOrCreateProfile = async (userId: string, email: string, name: string, role: 'user' | 'authenticator' | 'admin' | 'finance' | 'affiliate' = 'user', phone?: string, referralCode?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] Erro ao buscar perfil:', error);
        return null;
      }
      if (data) {
        let updates: any = {};
        if (!data.role || data.role === '') {
          updates.role = role;
        }
        if (!data.name || data.name !== name) {
          updates.name = name;
        }
        if (phone && (!data.phone || data.phone !== phone)) {
          updates.phone = phone;
        }
        if (referralCode && (!data.referred_by_code || data.referred_by_code !== referralCode)) {
          updates.referred_by_code = referralCode;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', userId);
          return { ...data, ...updates };
        }
        return data;
      } else {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ id: userId, email, name, role, phone, referred_by_code: referralCode || null })
          .select()
          .single();
        if (createError) {
          console.error('[Auth] Erro ao criar perfil:', createError);
          return null;
        }
        return newProfile;
      }
    } catch (err) {
      console.error('[Auth] Erro inesperado ao buscar/criar perfil:', err);
      return null;
    }
  };

  // Centraliza a lógica de buscar/criar perfil e atualizar contexto
  const fetchAndSetUser = async (session: Session | null) => {
    if (session?.user) {
      const userObj = session.user;
      try {
        // Primeiro buscar o perfil existente para obter o role correto
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userObj.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('[Auth] Erro ao buscar perfil existente:', profileError);
        }
        
        // Se o perfil existe, usar o role dele. Se não, criar com role 'user'
        const defaultRole = existingProfile?.role || 'user';
        const profile = await fetchOrCreateProfile(userObj.id, userObj.email ?? '', userObj.user_metadata?.name ?? '', defaultRole, userObj.user_metadata?.phone);
        const role = profile?.role || 'user';
        const customUser: CustomUser = { ...userObj, role, phone: profile?.phone };
        setUser(customUser);
        setSession(session);
        setSessionExpired(false);
      } catch (err) {
        console.error('[AuthProvider] Erro ao processar perfil:', err);
        setUser(null);
        setSession(session);
        setSessionExpired(true);
      }
    } else {
      setUser(null);
      setSession(null);
      if (session === null) {
        setSessionExpired(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchAndSetUser(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        fetchAndSetUser(session);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Log de falha no login
        await Logger.log(
          ActionTypes.USER_LOGIN,
          `Failed login attempt for ${email}`,
          {
            metadata: {
              email,
              error_type: error.name,
              error_message: error.message,
              timestamp: new Date().toISOString()
            }
          }
        );
        throw error;
      }
      
      // Log de sucesso no login
      if (data.user) {
        await Logger.log(
          ActionTypes.USER_LOGIN,
          `User logged in successfully`,
          {
            metadata: {
              email,
              user_id: data.user.id,
              timestamp: new Date().toISOString()
            }
          }
        );
      }
      
      // O listener de onAuthStateChange vai processar o usuário
      return data;
    } catch (error) {
      // Re-throw para não quebrar o fluxo existente
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    
    // Log de logout antes de fazer signOut
    if (user) {
      await Logger.log(
        ActionTypes.USER_LOGOUT,
        `User logged out`,
        {
          metadata: {
            user_id: user.id,
            email: user.email,
            timestamp: new Date().toISOString()
          }
        }
      );
    }
    
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  const signUp = async (email: string, password: string, name: string, phone: string, referralCode?: string, role: 'user' | 'authenticator' | 'admin' | 'finance' = 'user') => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role, phone } }
      });
      
      if (error) {
        // Log de falha no registro
        await Logger.log(
          ActionTypes.USER_REGISTER,
          `Failed registration attempt for ${email}`,
          {
            metadata: {
              email,
              name,
              role,
              error_type: error.name,
              error_message: error.message,
              timestamp: new Date().toISOString()
            }
          }
        );
        throw error;
      }
      
      // Cria perfil imediatamente após registro
      if (data.user) {
        await fetchOrCreateProfile(data.user.id, email, name, role, phone, referralCode);
        
        // Log de sucesso no registro
        await Logger.log(
          ActionTypes.USER_REGISTER,
          `New user registered: ${name}`,
          {
            metadata: {
              email,
              name,
              role,
              user_id: data.user.id,
              has_referral: !!referralCode,
              timestamp: new Date().toISOString()
            }
          }
        );
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const resetUrl = getResetPasswordUrl();
    console.log('[resetPassword] Usando URL de reset:', resetUrl);
    
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl
      });
      
      if (error) {
        // Log de falha no reset de senha
        await Logger.log(
          'password_reset_request_failed',
          `Failed password reset request for ${email}`,
          {
            metadata: {
              email,
              error_type: error.name,
              error_message: error.message,
              timestamp: new Date().toISOString()
            }
          }
        );
        throw error;
      }
      
      // Log de solicitação de reset bem-sucedida
      await Logger.log(
        'password_reset_request',
        `Password reset requested for ${email}`,
        {
          metadata: {
            email,
            reset_url: resetUrl,
            timestamp: new Date().toISOString()
          }
        }
      );
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut, signUp, resetPassword }}>
      {/* Mensagem de sessão expirada removida */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 