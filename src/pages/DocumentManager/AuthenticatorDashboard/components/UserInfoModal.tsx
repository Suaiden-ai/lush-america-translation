import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { XCircle, Phone } from 'lucide-react';
import { UserProfile } from '../types/authenticator.types';

interface UserInfoModalProps {
  isOpen: boolean;
  userId: string | null;
  onClose: () => void;
}

export function UserInfoModal({ isOpen, userId, onClose }: UserInfoModalProps) {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      handleViewUser(userId);
    } else if (!isOpen) {
      setSelectedUser(null);
      setUserError(null);
    }
  }, [isOpen, userId]);

  async function handleViewUser(userId: string) {
    setUserLoading(true);
    setUserError(null);
    setSelectedUser(null);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 w-full max-w-md sm:min-w-[400px] relative animate-fade-in">
        <button
          className="absolute top-2 sm:top-4 right-2 sm:right-4 text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={onClose}
          aria-label="Close modal"
        >
          <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <h3 className="text-xl font-bold mb-6 text-gray-900">User Information</h3>
        {userLoading && <p className="text-tfe-blue-700 text-lg">Loading...</p>}
        {userError && <p className="text-tfe-red-500 text-lg">{userError}</p>}
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-medium text-gray-700">Name:</span>
              <span className="text-gray-900">{selectedUser.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-medium text-gray-700">Email:</span>
              <span className="text-gray-900">{selectedUser.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-medium text-gray-700 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone:
              </span>
              <span className="text-gray-900">{selectedUser.phone || 'Not provided'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-medium text-gray-700">Role:</span>
              <span className="text-gray-900">{selectedUser.role}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-medium text-gray-700">ID:</span>
              <span className="text-gray-900 font-mono text-sm">{selectedUser.id}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
