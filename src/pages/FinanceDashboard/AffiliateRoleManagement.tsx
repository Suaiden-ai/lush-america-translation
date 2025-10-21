import React, { useState, useEffect } from 'react';
import { Users, User, Search, Filter, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export function AffiliateRoleManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Buscar usuários (apenas affiliate e user)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['affiliate', 'user'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Atualizar role do usuário (apenas entre affiliate e user)
  const updateUserRole = async (userId: string, newRole: string) => {
    if (!['affiliate', 'user'].includes(newRole)) {
      alert('Finance can only switch between affiliate and user roles');
      return;
    }

    try {
      setUpdatingUser(userId);
      
      // Usar função RPC para atualizar role de forma segura
      const { data, error } = await supabase
        .rpc('finance_update_role', {
          p_user_id: userId,
          p_new_role: newRole
        });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(`Failed to update role: ${error.message}`);
      }

      // Verificar se a operação foi bem-sucedida
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update user role');
      }

      // Atualizar estado local
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, role: newRole, updated_at: new Date().toISOString() } : user
      ));

      console.log(`User ${userId} role updated to ${newRole}`);
    } catch (err: any) {
      console.error('Error updating user role:', err);
      alert(`Error updating user role: ${err.message || 'Unknown error'}`);
    } finally {
      setUpdatingUser(null);
    }
  };

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Estatísticas
  const totalUsers = users.length;
  const affiliateUsers = users.filter(user => user.role === 'affiliate').length;
  const regularUsers = users.filter(user => user.role === 'user').length;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'affiliate':
        return <DollarSign className="w-4 h-4 text-orange-600" />;
      case 'user':
        return <User className="w-4 h-4 text-gray-600" />;
      default:
        return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'affiliate':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'user':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src="/logo.png"
                    alt="Lush America Translations"
                    className="w-8 h-8 flex-shrink-0 object-contain"
                  />
                  <h3 className="text-xl font-bold">Lush America Translations</h3>
                </div>
              </div>
              <p className="text-gray-600 mt-4">Loading users...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 overflow-hidden">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Gerenciar Afiliados</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm">Alterar roles entre afiliado e usuário</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6 max-w-full overflow-x-auto">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-2.5 sm:p-4 border border-gray-100 min-w-[140px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-xs text-gray-600 font-medium truncate">Total Users</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">{totalUsers}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-tfe-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-blue-950" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-xs text-gray-600 font-medium truncate">Affiliates</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">{affiliateUsers}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-orange-900" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-xs text-gray-600 font-medium truncate">Regular Users</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">{regularUsers}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 w-full overflow-hidden">
          {/* Header */}
          <div className="px-2 sm:px-4 lg:px-6 py-2 sm:py-4 border-b border-gray-200 overflow-x-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">Users & Affiliates</h3>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1 sm:w-56 lg:w-64">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 sm:pl-8 pr-2 py-1 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-xs w-full"
                  />
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs w-full sm:w-auto"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                  {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-xs w-full sm:w-40 lg:w-48"
                    aria-label="Filter by role"
                  >
                    <option value="all">All Roles</option>
                    <option value="affiliate">Affiliate</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="px-2 sm:px-4 lg:px-6 py-1.5 sm:py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-[11px] sm:text-xs text-gray-500">
              Showing {filteredUsers.length} of {users.length} users
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="w-1/4 py-2 pl-3 pr-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        User
                      </th>
                      <th scope="col" className="w-1/3 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Email
                      </th>
                      <th scope="col" className="w-1/4 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Current Role
                      </th>
                      <th scope="col" className="w-1/6 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Joined
                      </th>
                      <th scope="col" className="w-1/6 pl-2 pr-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-2 pl-3 pr-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-gray-700">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-2">
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{user.name}</div>
                              <div className="text-xs text-gray-500 font-mono truncate">ID: {user.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span className="text-sm text-gray-900 truncate block max-w-xs" title={user.email}>
                            {user.email}
                          </span>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1 capitalize truncate">{user.role}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="pl-2 pr-3 py-2 whitespace-nowrap text-right">
                          <select
                            value={user.role}
                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                            disabled={updatingUser === user.id}
                            className="text-xs border border-gray-300 rounded px-2 py-1 w-28"
                            aria-label="Update user role"
                          >
                            <option value="user">User</option>
                            <option value="affiliate">Affiliate</option>
                          </select>
                          {updatingUser === user.id && (
                            <span className="ml-2 text-xs text-gray-500">Updating...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden border-t border-gray-200">
            <div className="divide-y divide-gray-200 overflow-x-auto">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-2 sm:p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2 min-w-[300px]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={user.name}>
                            {user.name}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-500 truncate" title={user.email}>
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3 gap-y-1 sm:gap-y-2 text-[11px] sm:text-xs text-gray-600 max-w-full">
                        <div>
                          <span className="font-medium">Role:</span>
                          <span className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${getRoleColor(user.role)}`}>
                            {getRoleIcon(user.role)}
                            <span className="ml-0.5 capitalize truncate">{user.role}</span>
                          </span>
                        </div>
                        <div className="truncate">
                          <span className="font-medium">Joined:</span> {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        disabled={updatingUser === user.id}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                        aria-label="Update user role"
                      >
                        <option value="user">User</option>
                        <option value="affiliate">Affiliate</option>
                      </select>
                      {updatingUser === user.id && (
                        <span className="text-xs text-gray-500">Updating...</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {filteredUsers.length === 0 && users.length > 0 && (
            <div className="px-2 sm:px-4 lg:px-6 py-4 sm:py-6 text-center text-gray-500">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gray-300" />
              <p className="text-sm sm:text-base font-medium">No users found</p>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Try adjusting your search or filters.</p>
            </div>
          )}

          {users.length === 0 && (
            <div className="px-2 sm:px-4 lg:px-6 py-4 sm:py-6 text-center text-gray-500">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gray-300" />
              <p className="text-sm sm:text-base font-medium">No users in the system yet.</p>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Users will appear here once they register.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
