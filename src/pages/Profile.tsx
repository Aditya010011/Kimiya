import React from 'react';
import UserProfile from '@/components/auth/UserProfile';
import DashboardHeader from '@/components/layout/DashboardHeader';

const Profile: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <DashboardHeader
        title="Profile Settings"
        subtitle="Manage your account settings and preferences"
        showNewWorkflowButton={false}
      />

      <div className="p-6 max-w-7xl mx-auto">
        <UserProfile />
      </div>
    </div>
  );
};

export default Profile;
