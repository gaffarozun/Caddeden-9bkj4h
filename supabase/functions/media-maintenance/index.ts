import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { expireCreativeMedia } from '../_shared/mediaCleanup.ts';
// Public, bounded, idempotent maintenance: no user identity, paths, dates or ids are accepted.
// All expiry decisions are server-side. Only counts are returned, never private data.
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
 const json = (body: unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
 if (req.method !== 'POST') return json({error:'POST gerekli.'},405);
 try {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  return json(await expireCreativeMedia(admin,url));
 } catch(reason) {
  console.error('media-maintenance failed',reason instanceof Error ? reason.message : 'Unknown error');
  return json({error:'Görsel temizliği tamamlanamadı; sonraki çalışmada yeniden denenecek.'},500);
 }
});
