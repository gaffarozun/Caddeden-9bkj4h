import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const ownerEmail = 'caddeden.app@gmail.com';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST gerekli.' }, 405);
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Puan vermek için giriş yapın.' }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Oturum doğrulanamadı. Yeniden giriş yapın.' }, 401);
    const caller = auth.user;
    if (!caller.email_confirmed_at) return json({ error: 'Önce e-posta adresinizi doğrulayın.' }, 403);
    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== 'string') return json({ error: 'Geçersiz istek.' }, 400);
    if (body.action === 'set_experiences_enabled') {
      const { data: profile, error } = await admin.from('user_profiles').select('role,status').eq('id', caller.id).single();
      if (error || profile?.role !== 'admin' || profile.status !== 'active' || String(caller.email).trim().toLowerCase() !== ownerEmail) return json({ error: 'Yönetici yetkisi gerekli.' }, 403);
      if (typeof body.enabled !== 'boolean') return json({ error: 'Geçerli açık/kapalı durumu gerekli.' }, 400);
      const { error: toggleError } = await admin.rpc('set_experience_feature', { p_actor: caller.id, p_enabled: body.enabled });
      if (toggleError) { console.error('rating-api experience toggle failed', toggleError.code); return json({ error: 'Özellik durumu kaydedilemedi.' }, 500); }
      return json({ ok: true });
    }
    if (body.action !== 'rate' && body.action !== 'rate_order') return json({ error: 'Bilinmeyen işlem.' }, 400);
    const { data: ratingProfile, error: ratingProfileError } = await admin.from('user_profiles').select('role,status,restricted_until').eq('id', caller.id).single();
    if (ratingProfileError || ratingProfile?.role !== 'user' || ratingProfile.status !== 'active' || (ratingProfile.restricted_until && new Date(ratingProfile.restricted_until).getTime() > Date.now())) return json({ error: 'Puanlama yalnızca aktif müşteri hesaplarına açıktır.' }, 403);
    const rating = body.rating;
    if (body.action === 'rate_order') {
      if (typeof body.order_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.order_id) || typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2)) return json({ error: 'Teslim edilmiş sipariş ve 0,5–5 arası yarım yıldız puanı gerekli.' }, 400);
      // The verified JWT supplies the actor; SQL resolves the business from the owned delivered order.
      const { error: orderRatingError } = await admin.rpc('submit_order_business_rating', { p_user: caller.id, p_order: body.order_id, p_rating: rating });
      if (orderRatingError) {
        console.error('rating-api order rating write failed', orderRatingError.code);
        const status = orderRatingError.code === '42501' ? 403 : orderRatingError.code === 'P0001' ? 429 : orderRatingError.code === '22023' ? 400 : 500;
        return json({ error: status === 500 ? 'Değerlendirme kaydedilemedi. Tekrar deneyin.' : orderRatingError.message }, status);
      }
      return json({ ok: true });
    }
    if (typeof body.business_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.business_id) || typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2)) return json({ error: 'İşletme ve 0,5–5 arası yarım yıldız puanı gerekli.' }, 400);
    // Never accept a user_id or admin decision from the request. The JWT identifies the actor.
    const { error } = await admin.rpc('submit_business_star', { p_user: caller.id, p_business_id: body.business_id, p_rating: rating });
    if (error) {
      console.error('rating-api rating write failed', error.code);
      const status = error.code === '42501' ? 403 : error.code === 'P0001' ? 429 : error.code === '22023' ? 400 : 500;
      return json({ error: status === 500 ? 'Puan kaydedilemedi. Tekrar deneyin.' : error.message }, status);
    }
    return json({ ok: true });
  } catch (reason) {
    console.error('rating-api unexpected failure', reason instanceof Error ? reason.name : 'unknown');
    return json({ error: 'İşlem tamamlanamadı. Tekrar deneyin.' }, 500);
  }
});
