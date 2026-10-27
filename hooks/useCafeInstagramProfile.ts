import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useCafeSocial } from './useCafeSocial';
export function useCafeInstagramProfile() {
 const social = useCafeSocial(); const { authUser } = useAuth();
 const [value, setValue] = useState('');
 useEffect(() => { setValue(social.handle); }, [social.handle, authUser?.id]);
 return { ...social, value, setValue, customer: authUser?.role === 'user', save: () => social.saveHandle(value) };
}
