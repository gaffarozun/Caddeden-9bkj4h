import { useCallback } from 'react';
import { BusinessRegistration, registerBusiness } from '@/services/businessRegistrationService';
export function useBusinessRegistration() {
 const save = useCallback((form: BusinessRegistration) => registerBusiness(form), []);
 return { save };
}
