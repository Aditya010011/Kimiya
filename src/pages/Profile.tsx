import React from 'react';
import UserProfile from '@/components/auth/UserProfile';

const Profile: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <UserProfile />
      </div>
    </div>
  );
};

export default Profile;
