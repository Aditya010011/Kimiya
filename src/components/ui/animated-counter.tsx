import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 500,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);

    // Rapid number changes for scrolling effect
    const steps = 20;
    const stepDuration = duration / steps;
    const increment = (value - displayValue) / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        setIsAnimating(false);
        clearInterval(interval);
      } else {
        setDisplayValue(prev => prev + increment);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, duration, displayValue]);

  return (
    <span className={`inline-block ${isAnimating ? 'animating' : ''} ${className}`}>
      {Math.round(displayValue).toLocaleString()}
    </span>
  );
};

interface AnimatedPriceProps {
  value: number;
  currency?: string;
  duration?: number;
  className?: string;
}

export const AnimatedPrice: React.FC<AnimatedPriceProps> = ({
  value,
  currency = '$',
  duration = 600,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);

    // Rapid scrolling effect - many small steps
    const steps = 30; // More steps = smoother scrolling
    const stepDuration = duration / steps;
    const startValue = displayValue;
    const difference = value - startValue;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;

      if (currentStep >= steps) {
        setDisplayValue(value);
        setIsAnimating(false);
        clearInterval(interval);
      } else {
        // Ease-out effect: fast at start, slow at end
        const progress = currentStep / steps;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const newValue = startValue + (difference * easeOut);
        setDisplayValue(newValue);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, duration, displayValue]);

  const formatPrice = (val: number): string => {
    if (val === -1) return 'Custom';

    // Format with 2 decimal places
    const formatted = val.toFixed(2);
    const [dollars, cents] = formatted.split('.');

    // Add commas to dollars
    const dollarsWithCommas = parseInt(dollars).toLocaleString();

    return `${currency}${dollarsWithCommas}.${cents}`;
  };

  return (
    <span className={`inline-block tabular-nums ${isAnimating ? 'animating' : ''} ${className}`}>
      {formatPrice(displayValue)}
    </span>
  );
};

