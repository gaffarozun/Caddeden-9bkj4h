import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
export async function runMediaMaintenance() {
 const { data,error } = await getSupabaseClient().functions.invoke('media-maintenance',{body:{}});
 if (error) {
  let message=error.message;
  if(error instanceof FunctionsHttpError) { try { message=await error.context.text(); } catch { /* Retain transport error. */ } }
  return { data:null,error:message };
 }
 return {data,error:null};
}
