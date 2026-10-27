import { useCallback,useEffect,useRef,useState } from 'react';
import { getComplaintEmail,openComplaintEmail,saveComplaintEmail } from '@/services/complaintEmailService';
import { useAuth } from './useAuth';
export function useComplaintEmail(adminMode=false,context='') {
 const {authUser}=useAuth();
 const [email,setEmail]=useState(''); const [subject,setSubject]=useState(''); const [message,setMessage]=useState('');
 const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 const alive=useRef(true); const lock=useRef(false);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try { const value=await getComplaintEmail();if(alive.current)setEmail(value); }
  catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:'Adres yüklenemedi.');}
  finally{if(alive.current)setLoading(false);}
 },[]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[load]);
 const submit=useCallback(async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
  try {
   if(adminMode){const saved=await saveComplaintEmail(email);if(alive.current){setEmail(saved);setNotice('Şikâyet e-posta adresi kaydedildi.');}}
   else{await openComplaintEmail(email,subject,message,authUser?.email??'',context);if(alive.current)setNotice('Taslak e-posta uygulamanızda açıldı. Göndermek için e-posta uygulamasındaki Gönder düğmesine basın.');}
  }catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:'İşlem tamamlanamadı.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 },[adminMode,email,subject,message,authUser?.email,context]);
 return{email,setEmail,subject,setSubject,message,setMessage,loading,busy,error,notice,submit,retry:load};
}
