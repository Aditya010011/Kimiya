import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  {
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    label: 'Contains uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'Contains lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'Contains number',
    test: (password) => /\d/.test(password),
  },
  {
    label: 'Contains special character',
    test: (password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  },
];

const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  if (!password) {
    return { score: 0, label: 'Enter a password', color: 'text-gray-500' };
  }

  const passedRequirements = passwordRequirements.filter(req => req.test(password)).length;
  const score = (passedRequirements / passwordRequirements.length) * 100;

  if (score < 40) {
    return { score, label: 'Weak', color: 'text-red-500' };
  } else if (score < 80) {
    return { score, label: 'Medium', color: 'text-yellow-500' };
  } else {
    return { score, label: 'Strong', color: 'text-green-500' };
  }
};

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className = '',
}) => {
  const strength = getPasswordStrength(password);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength bar and label */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Password strength</span>
          <span className={`text-sm font-medium ${strength.color}`}>
            {strength.label}
          </span>
        </div>
        <Progress 
          value={strength.score} 
          className="h-2"
          // Custom color based on strength
          style={{
            '--progress-background': strength.score < 40 ? '#ef4444' : 
                                   strength.score < 80 ? '#eab308' : '#22c55e'
          } as React.CSSProperties}
        />
      </div>

      {/* Requirements checklist */}
      {password && (
        <div className="space-y-1">
          <p className="text-sm text-gray-600 mb-2">Password requirements:</p>
          {passwordRequirements.map((requirement, index) => {
            const isPassed = requirement.test(password);
            return (
              <div
                key={index}
                className={`flex items-center space-x-2 text-sm ${
                  isPassed ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {isPassed ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-gray-400" />
                )}
                <span>{requirement.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
