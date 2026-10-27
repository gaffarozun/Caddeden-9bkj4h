import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { updateMyProfile } from '@/services/authService';
import { isActiveStudent, validateEducation } from '@/services/educationService';
export function useEducationProfile() {
 const {authUser,refreshProfile}=useAuth(); const [status,setStatus]=useState(''); const [school,setSchool]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 useEffect(()=>{setStatus(authUser?.education_status??'');setSchool(authUser?.school_name??'');setError('');setNotice('');},[authUser?.id,authUser?.education_status,authUser?.school_name]);
 const save=useCallback(async()=>{
  if(busy || !authUser)return; const invalid=validateEducation(status,school);if(invalid){setError(invalid);return;}
  setBusy(true);setError('');setNotice('');
  try{const {error:failed}=await updateMyProfile({education_status:status||null,school_name:isActiveStudent(status)?school.trim():null});if(failed)throw new Error(failed);await refreshProfile();setNotice('Eğitim bilgisi kaydedildi.');}
  catch(reason){setError(reason instanceof Error?reason.message:'Kaydedilemedi.');}
  finally{setBusy(false);}
 },[authUser,busy,status,school,refreshProfile]);
 return {status,setStatus,school,setSchool,busy,error,notice,save,active:isActiveStudent(status)};
}
