import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import type { CustomUser } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import LanguageSelector from './LanguageSelector';
import { CompactReferralCode } from './CompactReferralCode';
import { supabase } from '../lib/supabase';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  page: string;
}

interface SidebarProps {
  navItems: NavItem[];
  user: CustomUser | null;
  onLogout: () => void;
  showLogo?: boolean; // Nova prop para controlar se o logo deve ser exibido
}

export function Sidebar({ navItems, user, onLogout, showLogo = true }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [referralCode, setReferralCode] = useState<string>('');

  // Buscar referral_code da tabela affiliates
  useEffect(() => {
    const fetchReferralCode = async () => {
      if (user?.role === 'affiliate' && user?.id) {
        try {
          const { data, error } = await supabase
            .from('affiliates')
            .select('referral_code')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error('Error fetching referral code:', error);
          } else if (data) {
            setReferralCode(data.referral_code);
          }
        } catch (err) {
          console.error('Error fetching referral code:', err);
        }
      }
    };

    fetchReferralCode();
  }, [user?.id, user?.role]);

  const handleNavigation = (page: string) => {
    if (page.startsWith('/')) {
      navigate(page);
    } else {
      navigate(`/${page}`);
    }
  };

  const isActivePage = (page: string) => {
    if (page.startsWith('/')) {
      return location.pathname === page;
    }
    return location.pathname === `/${page}`;
  };

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 h-screen overflow-y-auto">
      <div className="p-6">
        <div className="mb-6">
          {/* Logo - apenas se showLogo for true */}
          {showLogo && (
            <div className="flex justify-center mb-4">
              <button
                onClick={() => navigate('/')}
                className="focus:outline-none group"
                aria-label="Go to Home"
              >
                <div className="text-center">
                  <div className="flex items-center gap-2 mb-4">
                    <img 
                      src="/logo.png" 
                      alt="Lush America Translations" 
                      className="w-10 h-10 flex-shrink-0 object-contain"
                    />
                    <h3 className="text-xl font-bold">
                      <span className="text-tfe-blue-950">LUSH</span>
                      <span className="text-tfe-red-950"> AMERICA</span>
                    </h3>
                  </div>
                </div>
              </button>
            </div>
          )}
          
          {user && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{user.user_metadata?.name || 'Usuário'}</p>
              <p className="text-xs text-gray-600">{user.email || ''}</p>
              <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                user.role === 'admin'
                  ? 'bg-tfe-red-100 text-tfe-red-800'
                  : user.role === 'authenticator'
                  ? 'bg-green-100 text-green-800'
                  : user.role === 'finance'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-tfe-blue-100 text-tfe-blue-800'
              }`}>
                {user.role === 'admin'
                  ? 'Administrator'
                  : user.role === 'authenticator'
                  ? 'Authenticator'
                  : user.role === 'finance'
                  ? 'Finance'
                  : 'User'}
              </span>
            </div>
          )}
        </div>
        
        <nav className="space-y-2">
          {/* Renderizar itens de navegação dinâmicos */}
          {navItems && navItems.length > 0 && navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePage(item.page);
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.page)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-tfe-blue-50 text-tfe-blue-950 border border-tfe-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-tfe-blue-600' : 'text-gray-400'}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}



          {/* Código de Referência - apenas para afiliados */}
          {user?.role === 'affiliate' && referralCode && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="px-3 py-2">
                <CompactReferralCode referralCode={referralCode} />
              </div>
            </div>
          )}

          {/* Seletor de idioma */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="px-3 py-2">
              <LanguageSelector />
            </div>
          </div>

          {/* Seção de logout */}
          {user && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={onLogout}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors text-tfe-red-600 hover:bg-tfe-red-50 hover:text-tfe-red-700"
              >
                <LogOut className="w-5 h-5 text-tfe-red-500" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}