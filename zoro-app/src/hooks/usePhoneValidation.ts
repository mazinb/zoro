import { useCallback } from 'react';
import { Country } from '@/types';
import { COUNTRIES } from '@/constants';

export const usePhoneValidation = (countryCode: string) => {
  const validatePhone = useCallback((phone: string): { isValid: boolean; error: string } => {
    const selectedCountry: Country | undefined = COUNTRIES.find(c => c.code === countryCode);
    
    if (!selectedCountry) {
      return { isValid: false, error: 'Invalid country code' };
    }

    const phoneDigits = phone.replace(/\D/g, '');
    
    if (!phone.trim()) {
      return { isValid: false, error: 'Phone number is required' };
    }
    
    if (phoneDigits.length < selectedCountry.minLength || phoneDigits.length > selectedCountry.maxLength) {
      return { 
        isValid: false, 
        error: `Phone number must be ${selectedCountry.minLength} digits for ${selectedCountry.name}` 
      };
    }
    
    return { isValid: true, error: '' };
  }, [countryCode]);

  return { validatePhone };
};

