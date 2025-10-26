import React, { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, User, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminService } from '@/services/adminService';
import { toast } from 'sonner';
import { AuthService } from '@/services/authService';

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  creditBalance?: number;
}

interface UserSelectorProps {
  selectedUserId?: number;
  onUserSelect: (user: User | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const UserSelector: React.FC<UserSelectorProps> = ({
  selectedUserId,
  onUserSelect,
  placeholder = "Select a user...",
  className = "",
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Load users from API
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const adminService = new AdminService();
      const response = await adminService.getAllUsers();
      
      if (response.success && response.data) {
        // Transform the response data to match our User interface
        const transformedUsers: User[] = response.data.users.map(user => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          last_login: user.last_login,
          creditBalance: 0 // Will be loaded separately if needed
        }));
        
        setUsers(transformedUsers);
        
        // Load credit balances for each user (in background)
        loadUserCreditBalances(transformedUsers);
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  // Load credit balances for users
  const loadUserCreditBalances = async (userList: User[]) => {
    try {
      // Load credit balances for each user
      const updatedUsers = await Promise.all(
        userList.map(async (user) => {
          try {
            const response = await AuthService.makeAuthenticatedRequest(
              `/api/credits/balance/${user.id}`
            );

            if (response.ok) {
              const data = await response.json();
              return {
                ...user,
                creditBalance: data.success ? (data.data?.currentBalance || 0) : 0
              };
            }
          } catch (error) {
            console.error(`Failed to load credit balance for user ${user.id}:`, error);
          }

          return { ...user, creditBalance: 0 };
        })
      );

      setUsers(updatedUsers);
    } catch (error) {
      console.error('Error loading credit balances:', error);
    }
  };

  useEffect(() => {
    if (open && users.length === 0) {
      loadUsers();
    }
  }, [open]);

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      return (
        user.email.toLowerCase().includes(term) ||
        fullName.toLowerCase().includes(term) ||
        user.id.toString().includes(term)
      );
    });
  }, [users, searchTerm]);

  // Get selected user
  const selectedUser = users.find(user => user.id === selectedUserId);

  // Format user display name
  const formatUserName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) return user.first_name;
    if (user.last_name) return user.last_name;
    return user.email.split('@')[0];
  };

  // Get user initials for avatar
  const getUserInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) return user.first_name[0].toUpperCase();
    if (user.last_name) return user.last_name[0].toUpperCase();
    return user.email[0].toUpperCase();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          {selectedUser ? (
            <div className="flex items-center space-x-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getUserInitials(selectedUser)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{formatUserName(selectedUser)}</span>
                <span className="text-xs text-gray-500">{selectedUser.email}</span>
              </div>
              {selectedUser.creditBalance !== undefined && (
                <Badge variant="secondary" className="ml-auto">
                  <Zap className="h-3 w-3 mr-1" />
                  {selectedUser.creditBalance}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search users..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <CommandEmpty>
                {searchTerm ? "No users found matching your search." : "No users available."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={`${user.id}-${user.email}-${formatUserName(user)}`}
                    onSelect={() => {
                      onUserSelect(user.id === selectedUserId ? null : user);
                      setOpen(false);
                    }}
                    className="flex items-center space-x-3 py-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{formatUserName(user)}</span>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {user.role}
                        </Badge>
                        {!user.is_active && (
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-400">ID: {user.id}</span>
                        {user.creditBalance !== undefined && (
                          <div className="flex items-center space-x-1 text-xs text-gray-600">
                            <Zap className="h-3 w-3" />
                            <span>{user.creditBalance} credits</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedUserId === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default UserSelector;
