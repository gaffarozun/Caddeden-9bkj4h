import { useCallback,useEffect,useRef,useState } from 'react';
import { useAlert } from '@/template';
import { adminApi } from '@/services/adminService';
export function useRejectedAdRemoval(onRemoved:()=>Promise<void>){
 const {showAlert}=useAlert();const [busy,setBusy]=useState('');const lock=useRef(false);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const remove=useCallback((id:string)=>{
  showAlert('Reddedilmiş reklamı sil','Reklam ve başka yerde kullanılmayan reklam fotoğrafı kalıcı olarak kaldırılır. Ödeme geçmişi korunur; otomatik iade yapılmaz.',[
   {text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:()=>{void (async()=>{
    if(lock.current)return;lock.current=true;setBusy(id);
    try{const result=await adminApi.deleteRejectedMedia(id,'ad');if(result.error)throw new Error(result.error);if(alive.current)await onRemoved();}
    catch(reason){if(alive.current)showAlert('Silinemedi',reason instanceof Error?reason.message:'Tekrar deneyin.');}
    finally{lock.current=false;if(alive.current)setBusy('');}
   })();}},
  ]);
 },[onRemoved,showAlert]);
 return{remove,busy};
}
