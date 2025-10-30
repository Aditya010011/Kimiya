import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Settings,
  User,
  Users,
  LogOut,
  Loader2,
  Contact,
  CreditCard,
  Receipt,
  Phone,
  Workflow
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { useFlowStore } from '@/stores/flowStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import CreditBalanceWidget from '@/components/credit/CreditBalanceWidget';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  showNewWorkflowButton?: boolean;
  isCreating?: boolean;
  onNewWorkflow?: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title = "Kimiyi Dashboard",
  subtitle = "Manage your voice agent workflows",
  showNewWorkflowButton = true,
  isCreating = false,
  onNewWorkflow
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { createWorkflow } = useFlowStore();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const getUserInitials = (user: any) => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserDisplayName = (user: any) => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.first_name) {
      return user.first_name;
    }
    if (user?.last_name) {
      return user.last_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const handleNewWorkflow = async () => {
    if (onNewWorkflow) {
      onNewWorkflow();
    } else {
      // Default behavior - create a new workflow
      try {
        const workflowName = `New Workflow ${new Date().toLocaleDateString()}`;
        const newWorkflow = await createWorkflow(workflowName, 'A new workflow created from the header');
        if (newWorkflow) {
          navigate('/builder');
        }
      } catch (error) {
        toast.error('Failed to create workflow');
      }
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <img src="/icon.png" alt="Kimiyi Logo" className="h-8 w-8 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {showNewWorkflowButton && (
            <Button
              onClick={handleNewWorkflow}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isCreating ? 'Creating...' : 'New Workflow'}
            </Button>
          )}

          {/* Credit Balance Widget */}
          {user && (
            <div className="cursor-pointer flex-shrink-0" onClick={() => navigate('/credits')}>
              <CreditBalanceWidget
                userId={user.id}
                variant="minimal"
                showUsageProjection={false}
                showAlerts={true}
                className="border-0 shadow-none bg-transparent p-0"
              />
            </div>
          )}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-600 text-white text-sm">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {getUserDisplayName(user)}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/contacts')}>
                <Contact className="mr-2 h-4 w-4" />
                <span>Contacts</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/builder')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Workflow Builder</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/inbound-testing')}>
                <Phone className="mr-2 h-4 w-4" />
                <span>Inbound Testing</span>
              </DropdownMenuItem>
              {user?.role === 'admin' && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Users</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/workflows')}>
                    <Workflow className="mr-2 h-4 w-4" />
                    <span>All Workflows</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/credits')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Credit Management</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/admin/billing')}>
                    <Receipt className="mr-2 h-4 w-4" />
                    <span>Plans & Billing</span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
