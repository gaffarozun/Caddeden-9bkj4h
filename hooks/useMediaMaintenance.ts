import { useEffect } from 'react';
import { AppState } from 'react-native';
import { runMediaMaintenance } from '@/services/mediaMaintenanceService';
export function useMediaMaintenance() {
 useEffect(() => {
  let active=true;
  let busy=false;
  const run=async () => {
   if(!active || busy || (AppState.currentState && AppState.currentState!=='active')) return;
   busy=true;
   try { await runMediaMaintenance(); } catch { /* Retry safely at the next foreground cycle. */ } finally { busy=false; }
  };
  void run();
  const timer=setInterval(() => { void run(); },60000);
  const sub=AppState.addEventListener('change',state=> {if(state==='active') void run();});
  return () => { active=false; clearInterval(timer); sub.remove(); };
 },[]);
}
