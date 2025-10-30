'use client';

import { useState, useCallback } from 'react';
import { sanitizeForDisplay, sanitizeEmail, sanitizeUsername } from './sanitize';

export function useSanitizedInput(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);
  const [sanitizedValue, setSanitizedValue] = useState(sanitizeForDisplay(initialValue));

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setSanitizedValue(sanitizeForDisplay(newValue));
  }, []);

  return {
    value,
    sanitizedValue,
    setValue: handleChange,
  };
}

export function useSanitizedEmail(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    try {
      sanitizeEmail(newValue);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email');
    }
  }, []);

  return {
    value,
    error,
    setValue: handleChange,
    isValid: !error && value.length > 0,
  };
}

export function useSanitizedUsername(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    try {
      sanitizeUsername(newValue);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username');
    }
  }, []);

  return {
    value,
    error,
    setValue: handleChange,
    isValid: !error && value.length >= 3,
  };
} 