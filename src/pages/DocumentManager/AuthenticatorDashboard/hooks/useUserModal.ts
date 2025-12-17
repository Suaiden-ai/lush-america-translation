import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { UserProfile } from '../types/authenticator.types';

export function useUserModal() {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  async function viewUser(userId: string) {
    setUserLoading(true);
    setUserError(null);
    setSelectedUser(null);
    setUserModalOpen(true);
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role')
        .eq('id', userId)
        .single();
      if (error || !user) {
        setUserError('Erro ao buscar informações do usuário.');
      } else {
        setSelectedUser(user);
      }
    } catch (err) {
      setUserError('Erro inesperado ao buscar usuário.');
    } finally {
      setUserLoading(false);
    }
  }

  function closeModal() {
    setUserModalOpen(false);
    setSelectedUser(null);
    setUserError(null);
  }

  return {
    selectedUser,
    userModalOpen,
    userLoading,
    userError,
    viewUser,
    closeModal
  };
}
