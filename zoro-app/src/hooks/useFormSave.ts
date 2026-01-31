import { useState, useEffect, useCallback } from 'react';

export interface FormInitialData<T = any> {
  answers?: Partial<T>;
  sharedData?: any;
  email?: string;
}

interface UseFormSaveOptions<T> {
  formType: string;
  initialData?: FormInitialData<T>;
  userToken?: string;
  userName?: string;
  getSharedData?: (answers: T) => any;
  expenseBuckets?: any; // For retirement form
}

interface UseFormSaveReturn<T> {
  email: string;
  setEmail: (email: string) => void;
  emailError: string;
  setEmailError: (error: string) => void;
  userToken: string | undefined;
  setUserToken: (token: string | undefined) => void;
  userName: string | undefined;
  saveProgress: (answers: T) => Promise<void>;
  validateEmail: () => boolean;
}

/**
 * Shared hook for form saving logic
 * Handles:
 * - Email initialization from loaded data
 * - Token management
 * - Auto-saving form progress
 * - Email validation
 */
export function useFormSave<T extends Record<string, any>>({
  formType,
  initialData,
  userToken: propUserToken,
  userName: propUserName,
  getSharedData,
  expenseBuckets,
}: UseFormSaveOptions<T>): UseFormSaveReturn<T> {
  const [email, setEmail] = useState(initialData?.email || '');
  const [emailError, setEmailError] = useState('');
  const [userToken, setUserToken] = useState<string | undefined>(propUserToken);
  const [userName, setUserName] = useState<string | undefined>(propUserName);

  // Extract email from initialData if available (from user_data record)
  useEffect(() => {
    if (initialData?.email && !email) {
      setEmail(initialData.email);
    }
  }, [initialData]);

  // Update token if prop changes
  useEffect(() => {
    if (propUserToken) {
      setUserToken(propUserToken);
    }
  }, [propUserToken]);

  // Update userName if prop changes
  useEffect(() => {
    if (propUserName) {
      setUserName(propUserName);
    }
  }, [propUserName]);

  const saveProgress = useCallback(async (answersToSave: T) => {
    try {
      const sharedData = getSharedData ? getSharedData(answersToSave) : {};
      
      const payload: Record<string, any> = {
        token: userToken,
        email: email || undefined,
        name: userName,
        formType,
        formData: answersToSave,
        sharedData,
      };

      // Add expense buckets for retirement form (use current expenseBuckets from hook dependency)
      if (formType === 'retirement' && expenseBuckets) {
        payload.expenseBuckets = expenseBuckets;
      }

      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      if (result.token && result.token !== userToken) {
        setUserToken(result.token);
        // Update URL with token
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('token', result.token);
          if (userName) url.searchParams.set('name', userName);
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [userToken, email, userName, formType, getSharedData, expenseBuckets]);

  const validateEmail = useCallback((): boolean => {
    // Only validate email if no token (new user)
    if (userToken) {
      return true;
    }
    const trimmed = email.trim();
    const ok = /.+@.+\..+/.test(trimmed);
    if (!ok) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  }, [userToken, email]);

  return {
    email,
    setEmail,
    emailError,
    setEmailError,
    userToken,
    setUserToken,
    userName,
    saveProgress,
    validateEmail,
  };
}

