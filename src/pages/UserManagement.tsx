import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  UserCheck,
  UserX,
  Trash2,
  Activity,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AdminService, formatUserDisplayName, formatUserInitials, formatRelativeTime } from '@/services/adminService';
import type { AdminUser } from '@/services/adminService';

interface UserManagementStats {
  total_count: number;
  active_count: number;
  admin_count: number;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<UserManagementStats>({
    total_count: 0,
    active_count: 0,
    admin_count: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'admin'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

  // Create AdminService instance
  const adminService = new AdminService();
  const location = useLocation();

  const loadUsers = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await adminService.getAllUsers();

      if (response.success && response.data) {
        setUsers(response.data.users);
        setStats({
          total_count: response.data.total_count,
          active_count: response.data.active_count,
          admin_count: response.data.admin_count
        });
      } else {
        setError(response.error || 'Failed to load users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await adminService.updateUserStatus(userId, !currentStatus);

      if (response.success) {
        toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        await loadUsers(true); // Silent reload to get updated data
      } else {
        toast.error(response.error || 'Failed to update user status');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleDeleteUser = (user: AdminUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await adminService.deleteUser(userToDelete.id);

      if (response.success) {
        toast.success(`User ${userToDelete.email} deleted permanently`);
        await loadUsers(true); // Silent reload to get updated data
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } else {
        toast.error(response.error || 'Failed to delete user');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleViewUserDetails = (userId: number) => {
    navigate(`/admin/users/${userId}/analytics`);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatUserDisplayName(user).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  useEffect(() => {
    loadUsers(false); // Initial load with loading indicator
  }, []);

  // Refresh data when the window/tab becomes visible again (silent refresh)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadUsers(true); // Silent refresh
      }
    };

    const handleFocus = () => {
      loadUsers(true); // Silent refresh
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Refresh data when navigating to this page (silent refresh)
  useEffect(() => {
    if (location.pathname === '/admin/users') {
      loadUsers(true); // Silent refresh
    }
  }, [location.pathname]);

  // Real-time polling for user status updates
  useEffect(() => {
    const POLLING_INTERVAL = 30000; // Poll every 30 seconds

    const pollForUpdates = async () => {
      try {
        await loadUsers(true); // Silent refresh
        setLastUpdated(new Date());
      } catch (error) {
        console.warn('Polling update failed:', error);
      }
    };

    // Start polling when component mounts
    const intervalId = setInterval(pollForUpdates, POLLING_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Enhanced visibility change handler for better real-time updates
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // When page becomes visible, immediately refresh data
        loadUsers(true);
        setLastUpdated(new Date());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserOnlineStatus = (user: AdminUser) => {
    // User is online if they have active sessions
    if (user.activity_metrics.active_sessions > 0) {
      return { isOnline: true, status: 'Online', color: 'bg-green-500' };
    }

    // Check if user was recently active (within last 5 minutes)
    if (user.activity_metrics.last_activity) {
      const lastActivity = new Date(user.activity_metrics.last_activity);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (lastActivity > fiveMinutesAgo) {
        return { isOnline: false, status: 'Recently active', color: 'bg-yellow-500' };
      }
    }

    return { isOnline: false, status: 'Offline', color: 'bg-gray-400' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Dashboard Header */}
        <DashboardHeader
          title="User Management"
          subtitle="Manage user accounts, roles, and activity"
          showNewWorkflowButton={false}
        />

        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading users...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <DashboardHeader
        title="User Management"
        subtitle="Manage user accounts, roles, and activity"
        showNewWorkflowButton={false}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Page Header with Live Status and Refresh */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                  <p className="text-xs text-gray-500">
                    Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 30s
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live
              </div>
              <Button
                onClick={() => navigate('/admin/workflows')}
                variant="outline"
                className="flex items-center gap-2"
              >
                View All Workflows
              </Button>
              <Button onClick={() => loadUsers(false)} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_count}</div>
              <p className="text-xs text-muted-foreground">
                Registered accounts
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active_count}</div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrators</CardTitle>
              <Settings className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.admin_count}</div>
              <p className="text-xs text-muted-foreground">
                Admin accounts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as 'all' | 'user' | 'admin')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Users ({filteredUsers.length})
            </CardTitle>
            <CardDescription>
              Manage user accounts and view activity metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-600 text-white text-sm">
                                {formatUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            {/* Online/Offline indicator dot */}
                            {(() => {
                              const status = getUserOnlineStatus(user);
                              return (
                                <div
                                  className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.color}`}
                                  title={`${status.status}${user.activity_metrics.active_sessions > 0 ? ` (${user.activity_metrics.active_sessions} active sessions)` : ''}`}
                                />
                              );
                            })()}
                          </div>
                          <div>
                            <div className="font-medium">
                              {formatUserDisplayName(user)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'destructive'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-medium">Login:</span>{' '}
                            {user.activity_metrics.last_login
                              ? formatRelativeTime(user.activity_metrics.last_login)
                              : 'Never'
                            }
                          </div>
                          {user.activity_metrics.last_activity && (
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">Activity:</span>{' '}
                              {formatRelativeTime(user.activity_metrics.last_activity)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-1">
                            <Settings className="h-3 w-3" />
                            {user.activity_metrics.workflow_count} workflows
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {user.activity_metrics.total_logins} logins
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewUserDetails(user.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleStatusToggle(user.id, user.is_active)}
                              className={user.is_active ? 'text-red-600' : 'text-green-600'}
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No users found matching your criteria</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Delete User Permanently</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold">{userToDelete?.email}</span>?
                {' '}This action cannot be undone and will remove all user data including workflows, sessions, and call logs.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setUserToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteUser}
              >
                Delete Permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default UserManagement;
