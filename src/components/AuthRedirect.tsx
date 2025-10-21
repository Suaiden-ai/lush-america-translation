import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastCheckedPath = useRef<string>('');

  useEffect(() => {
    if (loading) {
      return;
    }
    const currentPath = location.pathname;
    
    // Rotas públicas SEMPRE acessíveis
    const publicPaths = ['/', '/login', '/register', '/translations', '/verify'];
    if (publicPaths.some(path => currentPath === path || currentPath.startsWith(path))) {
      // Se já está logado e tenta acessar login/register, redireciona para dashboard correto
      if (user && (currentPath === '/login' || currentPath === '/register')) {
        if (user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (user.role === 'authenticator') {
          navigate('/authenticator', { replace: true });
        } else if (user.role === 'finance') {
          navigate('/finance', { replace: true });
        } else if (user.role === 'affiliate') {
          navigate('/affiliate', { replace: true });
        } else if (user.role === 'user') {
          navigate('/dashboard', { replace: true });
        }
      }
      return;
    }
    // Rotas privadas
    const privatePaths = ['/dashboard', '/upload', '/admin', '/authenticator', '/finance', '/affiliate', '/documents'];
    const isPrivate = privatePaths.some(path => currentPath.startsWith(path));
    if (isPrivate && !user) {
      navigate('/login', { replace: true });
      return;
    }
    // Proteção de rotas por role
    if (user?.role === 'admin' && !currentPath.startsWith('/admin')) {
      if (currentPath !== '/admin') {
        navigate('/admin', { replace: true });
      }
      return;
    }
    if (user?.role === 'authenticator' && !currentPath.startsWith('/authenticator')) {
      if (currentPath !== '/authenticator') {
        navigate('/authenticator', { replace: true });
      }
      return;
    }
    if (user?.role === 'finance' && !currentPath.startsWith('/finance')) {
      if (currentPath !== '/finance') {
        navigate('/finance', { replace: true });
      }
      return;
    }
    if (user?.role === 'affiliate' && !currentPath.startsWith('/affiliate')) {
      if (currentPath !== '/affiliate') {
        navigate('/affiliate', { replace: true });
      }
      return;
    }
    if (user?.role === 'user' && !['/dashboard', '/upload', '/documents'].some(p => currentPath.startsWith(p))) {
      if (currentPath !== '/dashboard') {
        navigate('/dashboard', { replace: true });
      }
      return;
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="md" color="blue" />
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthRedirect; 