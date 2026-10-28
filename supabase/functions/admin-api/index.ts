// Powered by OnSpace.AI
// Super Admin API: ALL admin privileges are verified server-side here.
// The client can never grant itself admin rights; role is checked against the DB.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { caddeTvPublicationDates } from '../_shared/caddeTvPublication.ts';
import { queueCreative, processCreativeQueue } from '../_shared/mediaCleanup.ts';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// The one and only email address permitted to hold admin rights. Changing this
// value is the only way to transfer ownership of the admin panel.
const AUTHORIZED_ADMIN_EMAIL = 'caddeden.app@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(url, serviceKey);

    // Identify caller from JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Yetkisiz: oturum bulunamadı.' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: 'Yetkisiz: geçersiz oturum.' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');
    const log = (a: string, d: unknown) =>
      admin.from('admin_logs').insert({ admin_id: caller.id, action: a, detail: d });

    // ---- Bootstrap: assign first admin with one-time secure code ----
    if (action === 'bootstrap') {
      if (String(caller.email ?? '').trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
        return json({ error: 'Bu hesap yönetici olarak yetkilendirilmemiş.' }, 403);
      }
      // Admin rights require a VERIFIED mailbox, never just a matching address string.
      if (!(caller.email_confirmed_at ?? (caller as { confirmed_at?: string }).confirmed_at)) {
        return json({ error: 'Önce e-posta adresini doğrula, sonra tekrar dene.' }, 403);
      }
      const code = String(body.code ?? '').trim();
      const { data: cfg } = await admin
        .from('app_config')
        .select('value')
        .eq('key', 'admin_bootstrap_code')
        .single();
      // Constant-time comparison so the code cannot be guessed through response timing.
      const safeEqual = (a: string, b: string) => {
        const x = new TextEncoder().encode(a);
        const y = new TextEncoder().encode(b);
        let diff = x.length ^ y.length;
        for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
        return diff === 0;
      };
      if (!cfg?.value || !safeEqual(code, String(cfg.value))) {
        return json({ error: 'Geçersiz kurulum kodu.' }, 403);
      }
      const { count: adminCount } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
      const { data: me } = await admin
        .from('user_profiles')
        .select('role')
        .eq('id', caller.id)
        .single();
      if ((adminCount ?? 0) > 0 && me?.role !== 'admin') {
        return json({ error: 'Yönetici hesabı zaten atanmış.' }, 403);
      }
      const { error: upErr } = await admin
        .from('user_profiles')
        .update({ role: 'admin' })
        .eq('id', caller.id);
      if (upErr) return json({ error: upErr.message }, 400);
      // One-time code: consume it so it cannot be replayed.
      await admin.from('app_config').delete().eq('key', 'admin_bootstrap_code');
      await log('bootstrap_admin', { email: caller.email });
      return json({ ok: true, role: 'admin' });
    }

    // ---- Claim admin via a pre-authorized, email-verified address ----
    // The authorized email lives server-side in app_config. A caller becomes
    // admin only when their VERIFIED JWT email matches it. This never touches
    // or disables any existing admin account, and preserves all data.
    if (action === 'admin_claim_status' || action === 'claim_admin') {
      // Authorization is locked server-side to a single owner email.
      const authorizedEmail = AUTHORIZED_ADMIN_EMAIL;
      const callerEmail = String(caller.email ?? '').trim().toLowerCase();
      const emailConfirmed = !!(caller.email_confirmed_at ?? (caller as { confirmed_at?: string }).confirmed_at);
      const { data: meRow } = await admin
        .from('user_profiles')
        .select('role')
        .eq('id', caller.id)
        .single();
      const alreadyAdmin = meRow?.role === 'admin';
      const authorized = !!authorizedEmail && callerEmail === authorizedEmail;
      const maskEmail = (e: string) => {
        const [u, d] = e.split('@');
        return d ? `${u.slice(0, 3)}***@${d}` : null;
      };

      if (action === 'admin_claim_status') {
        return json({
          authorized,
          emailConfirmed,
          alreadyAdmin,
          configured: !!authorizedEmail,
          authorizedHint: authorizedEmail ? maskEmail(authorizedEmail) : null,
        });
      }

      // action === 'claim_admin'
      if (alreadyAdmin) return json({ ok: true, role: 'admin' });
      if (!authorizedEmail) return json({ error: 'Yetkili yönetici e-postası henüz tanımlanmamış.' }, 403);
      if (!authorized) return json({ error: 'Bu e-posta yönetici olarak yetkilendirilmemiş.' }, 403);
      if (!emailConfirmed) return json({ error: 'Önce e-posta adresini doğrula, sonra tekrar dene.' }, 403);
      const { error: upErr } = await admin.from('user_profiles').update({ role: 'admin' }).eq('id', caller.id);
      if (upErr) return json({ error: upErr.message }, 400);
      await log('claim_admin', { email: caller.email });
      return json({ ok: true, role: 'admin' });
    }

    // ---- All other actions require admin role (verified server-side) ----
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role,status')
      .eq('id', caller.id)
      .single();
    if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
      return json({ error: 'Bu işlem için yönetici yetkisi gereklidir.' }, 403);
    }
    // Hard lock: only the single authorized owner account may use admin actions.
    // Any other account that still holds an admin role is revoked on the spot.
    if (String(caller.email ?? '').trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
      await admin.from('user_profiles').update({ role: 'user' }).eq('id', caller.id);
      await log('revoke_unauthorized_admin', { email: caller.email });
      return json({ error: 'Yönetici yetkisi yalnızca yetkili hesaba aittir.' }, 403);
    }

    switch (action) {
      case 'set_complaint_email': {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Geçerli bir e-posta adresi girin.' }, 400);
        const { error } = await admin.from('app_config').upsert({ key: 'complaint_email', value: email, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) return json({ error: error.message }, 400);
        await log('set_complaint_email', { email });
        return json({ ok: true });
      }
      case 'delete_rejected_media': {
        const table = body.section === 'content' ? 'business_posts' : body.section === 'campaign' ? 'campaigns' : body.section === 'ad' ? 'ads' : null;
        if (!table || typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)) return json({ error: 'Geçersiz içerik.' }, 400);
        const { data: row, error: readError } = await admin.from(table).select('id,status,business_id,image_url,price,payment_status').eq('id', body.id).single();
        if (readError || !row) return json({ error: 'İçerik bulunamadı. Listeyi yenileyin.' }, 404);
        if (row.status !== 'rejected') return json({ error: 'Yalnızca reddedilmiş içerikleri silebilirsiniz.' }, 409);
        await queueCreative(admin, row.image_url, row.business_id, url);
        // Conditional delete prevents deleting content approved by a concurrent request.
        const { data: deleted, error } = await admin.from(table).delete().eq('id', row.id).eq('status', 'rejected').select('id');
        if (error) return json({ error: error.message }, 400);
        if (!deleted?.length) return json({ error: 'İçerik durumu değişmiş. Listeyi yenileyin.' }, 409);
        // Payment rows and refund decisions are never removed with a creative.
        await log('delete_rejected_media', { table, id: row.id, business_id: row.business_id, price: row.price, payment_status: row.payment_status, payment_ledger_preserved: true });
        try { await processCreativeQueue(admin, url); }
        catch (reason) { console.error('Rejected media storage cleanup queued for retry', reason instanceof Error ? reason.message : 'Unknown error'); }
        return json({ ok: true });
      }
      case 'list_university_messages': {
        if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(body.status)) return json({ error: 'Geçersiz yazı filtresi.' }, 400);
        let query = admin.from('university_messages')
          .select('id,user_id,text,status,moderation_reason,created_at,published_at,decided_at,withdrawn_at,withdrawn_by,author:user_profiles!university_messages_user_id_fkey(username,email)');
        query = body.status === 'withdrawn' ? query.not('withdrawn_at', 'is', null) : query.eq('status', body.status).is('withdrawn_at', null);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) { console.error('university list failed', error.code); return json({ error: error.message }, 400); }
        return json({ messages: data ?? [] });
      }

      case 'moderate_university_message': {
        const validId = typeof body.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id);
        if (!validId || !['approved', 'rejected'].includes(body.status) || !['pending', 'approved', 'rejected'].includes(body.expectedStatus) || (body.reason != null && typeof body.reason !== 'string')) {
          return json({ error: 'Geçersiz yazı kararı.' }, 400);
        }
        const { data, error } = await admin.rpc('moderate_university_message', {
          p_admin: caller.id, p_id: body.id, p_status: body.status, p_expected: body.expectedStatus, p_reason: body.reason ?? null,
        });
        if (error) {
          console.error('university moderation failed', error.code);
          return json({ error: error.message }, error.code === '42501' ? 403 : error.code === '40001' ? 409 : 400);
        }
        return json(data);
      }

      case 'set_business_account_approval': {
        if (typeof body.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId) || !['pending','approved'].includes(body.status)) {
          return json({ error: 'Geçersiz işletme hesabı onayı.' }, 400);
        }
        const { data, error } = await admin.rpc('admin_set_business_account_approval', {
          p_admin: caller.id, p_user: body.userId, p_status: body.status,
        });
        if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 400);
        return json(data);
      }

      case 'set_account_type': {
        if (!['user','business'].includes(body.role) || !['user','business'].includes(body.expectedRole) || typeof body.userId !== 'string') return json({ error: 'Geçersiz hesap türü.' }, 400);
        const { data, error } = await admin.rpc('admin_set_account_type', { p_admin: caller.id, p_user: body.userId, p_role: body.role, p_expected: body.expectedRole });
        if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 409);
        return json(data);
      }

      case 'overview': {
        const [usersC, bizC, pendBizC, adsActiveC, adsPendC, compOpenC, alertsC, pendContentC, pendCampaignC, pendNotifC, pendUniversityC] =
          await Promise.all([
            admin.from('user_profiles').select('*', { count: 'exact', head: true }),
            admin.from('businesses').select('*', { count: 'exact', head: true }),
            admin.from('businesses').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
            admin.from('ads').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            admin.from('ads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            admin.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open'),
            admin.from('admin_alerts').select('*', { count: 'exact', head: true }).eq('is_read', false),
            admin.from('business_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            admin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            admin.from('notification_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            admin.from('university_messages').select('*', { count: 'exact', head: true }).eq('status', 'pending').is('withdrawn_at', null),
          ]);
        const { data: paid } = await admin.from('payments').select('amount').eq('status', 'paid');
        const revenue = (paid ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
        return json({
          users: usersC.count ?? 0,
          businesses: bizC.count ?? 0,
          pendingBusinesses: pendBizC.count ?? 0,
          activeAds: adsActiveC.count ?? 0,
          pendingAds: adsPendC.count ?? 0,
          openComplaints: compOpenC.count ?? 0,
          unreadAlerts: alertsC.count ?? 0,
          pendingContent: pendContentC.count ?? 0,
          pendingCampaigns: pendCampaignC.count ?? 0,
          pendingNotificationRequests: pendNotifC.count ?? 0,
          pendingUniversityMessages: pendUniversityC.count ?? 0,
          revenue,
        });
      }

      case 'list_businesses': {
        let q = admin.from('businesses').select('*').order('created_at', { ascending: false });
        if (body.status) q = q.eq('approval_status', body.status);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ businesses: data });
      }

      case 'update_business_status': {
        const patch: Record<string, unknown> = { approval_status: body.approval_status };
        if (body.approval_status === 'approved') patch.is_published = true;
        if (body.approval_status === 'rejected') {
          patch.is_published = false;
          patch.rejection_reason = body.rejection_reason ?? null;
        }
        const { error } = await admin.from('businesses').update(patch).eq('id', body.businessId);
        if (error) return json({ error: error.message }, 400);
        await log('update_business_status', { businessId: body.businessId, status: body.approval_status });
        return json({ ok: true });
      }

      case 'set_business_published': {
        const { error } = await admin
          .from('businesses')
          .update({ is_published: !!body.is_published })
          .eq('id', body.businessId);
        if (error) return json({ error: error.message }, 400);
        await log('set_business_published', { businessId: body.businessId, is_published: !!body.is_published });
        return json({ ok: true });
      }

      case 'set_business_featured': {
        const { error } = await admin
          .from('businesses')
          .update({ featured: !!body.featured })
          .eq('id', body.businessId);
        if (error) return json({ error: error.message }, 400);
        await log('set_business_featured', { businessId: body.businessId, featured: !!body.featured });
        return json({ ok: true });
      }

      case 'list_ads': {
        let q = admin
          .from('ads')
          .select('*, businesses(name, category)')
          .order('created_at', { ascending: false });
        if (body.status) q = q.eq('status', body.status);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ ads: data });
      }

      case 'update_ad': {
        const patch: Record<string, unknown> = {};
        for (const k of ['status', 'price', 'payment_status', 'start_date', 'end_date', 'rejection_reason']) {
          if (k in body) patch[k] = body[k];
        }
        const { data: existingAd, error: adReadError } = await admin.from('ads')
          .select('type,package_id,image_url,media_removed_at').eq('id', body.adId).single();
        if (adReadError || !existingAd) return json({ error: adReadError?.message ?? 'Reklam bulunamadı.' }, 400);
        if (patch.status === 'active') {
          if (existingAd.media_removed_at) return json({ error: 'Görselin yayın süresi dolmuş. Yeni bir reklam başvurusu gerekir.' }, 400);
          if (existingAd.type === 'reels_sponsored' && !String(existingAd.image_url ?? '').trim()) return json({ error: 'Cadde TV reklamında görsel yok. İşletme, görselle yeniden başvurmalıdır.' }, 400);
          let days = 30;
          if (existingAd.package_id) {
            const { data: pkg, error: packageError } = await admin.from('ad_packages')
              .select('duration_days').eq('id', existingAd.package_id).single();
            if (packageError || !pkg) return json({ error: packageError?.message ?? 'Reklam paketi bulunamadı.' }, 400);
            days = Number(pkg.duration_days);
          }
          if (!Number.isFinite(days) || days <= 0) return json({ error: 'Cadde TV paketinin yayın süresi pozitif olmalıdır.' }, 400);
          // TV dates come from the server and package, not UTC device dates or a fixed 30 days.
          Object.assign(patch, caddeTvPublicationDates(days));
        }
        const { error } = await admin.from('ads').update(patch).eq('id', body.adId);
        if (error) return json({ error: error.message }, 400);
        // Manual payment tracking only (no real gateway). Record a paid entry once.
        if (body.payment_status === 'paid') {
          const { data: ad } = await admin
            .from('ads')
            .select('business_id, price')
            .eq('id', body.adId)
            .single();
          const { count: existing } = await admin
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('ad_id', body.adId)
            .eq('status', 'paid');
          if (ad && (existing ?? 0) === 0) {
            await admin.from('payments').insert({
              business_id: ad.business_id,
              ad_id: body.adId,
              amount: ad.price,
              status: 'paid',
              method: 'manual',
              note: 'Yönetici manuel kaydı (otomatik tahsilat yok)',
            });
          }
        }
        await log('update_ad', { adId: body.adId, patch });
        return json({ ok: true });
      }

      case 'list_ad_packages': {
        const { data, error } = await admin.from('ad_packages').select('*').order('price');
        if (error) return json({ error: error.message }, 400);
        return json({ packages: data });
      }

      case 'upsert_ad_package': {
        const p = body.package ?? {};
        let upErr;
        if (p.id) {
          const { id, ...rest } = p;
          ({ error: upErr } = await admin.from('ad_packages').update(rest).eq('id', id));
        } else {
          ({ error: upErr } = await admin.from('ad_packages').insert(p));
        }
        if (upErr) return json({ error: upErr.message }, 400);
        await log('upsert_ad_package', { package: p });
        return json({ ok: true });
      }

      case 'send_notification': {
        const { error } = await admin.from('notifications').insert({
          sender_id: caller.id,
          title: body.title,
          body: body.message,
          target: body.target ?? 'all',
          target_category: body.target_category ?? null,
          type: body.type ?? 'announcement',
        });
        if (error) return json({ error: error.message }, 400);
        await log('send_notification', { title: body.title, target: body.target });
        return json({ ok: true });
      }

      case 'list_notifications': {
        const { data, error } = await admin
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 400);
        return json({ notifications: data });
      }

      case 'list_admin_alerts': {
        const { data, error } = await admin
          .from('admin_alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 400);
        return json({ alerts: data });
      }

      case 'mark_alert_read': {
        let q = admin.from('admin_alerts').update({ is_read: true });
        q = body.alertId ? q.eq('id', body.alertId) : q.eq('is_read', false);
        const { error } = await q;
        if (error) return json({ error: error.message }, 400);
        await log('mark_alert_read', { alertId: body.alertId ?? 'all' });
        return json({ ok: true });
      }

      case 'list_users': {
        const { data, error } = await admin
          .from('user_profiles')
          .select('id, username, email, role, status, restricted_until, businesses!businesses_owner_id_fkey(id), account_type_decisions(role,decided_at)')
          .order('role', { ascending: false });
        if (error) return json({ error: error.message }, 400);
        const businessIds = (data ?? []).filter(row => row.role === 'business').map(row => row.id);
        const approvals: Record<string, { status: string; decided_at: string | null }> = {};
        if (businessIds.length > 0) {
          const { data: rows, error: approvalError } = await admin.from('business_account_approvals')
            .select('user_id,status,decided_at').in('user_id', businessIds);
          if (approvalError) return json({ error: approvalError.message }, 400);
          for (const row of rows ?? []) approvals[row.user_id] = { status: row.status, decided_at: row.decided_at };
        }
        return json({ users: (data ?? []).map(row => ({ ...row, business_account_approval: row.role === 'business' ? (approvals[row.id] ?? { status: 'pending', decided_at: null }) : null })) });
      }

      case 'restrict_user': {
        if (body.userId === caller.id) {
          return json({ error: 'Kendi hesabını kısıtlayamazsın.' }, 400);
        }
        const { data: target } = await admin
          .from('user_profiles')
          .select('role')
          .eq('id', body.userId)
          .single();
        if (target?.role === 'admin') {
          return json({ error: 'Yönetici hesabı kısıtlanamaz.' }, 400);
        }
        const { error } = await admin
          .from('user_profiles')
          .update({ status: body.status, restricted_until: body.restricted_until ?? null })
          .eq('id', body.userId);
        if (error) return json({ error: error.message }, 400);
        await log('restrict_user', { userId: body.userId, status: body.status });
        return json({ ok: true });
      }

      case 'list_complaints': {
        const { data, error } = await admin
          .from('complaints')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ complaints: data });
      }

      case 'update_complaint': {
        const { error } = await admin
          .from('complaints')
          .update({ status: body.status })
          .eq('id', body.complaintId);
        if (error) return json({ error: error.message }, 400);
        await log('update_complaint', { complaintId: body.complaintId, status: body.status });
        return json({ ok: true });
      }

      case 'order_report': {
        const dateOk = (value: unknown) => value == null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
        const businessOk = body.p_business == null || (typeof body.p_business === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.p_business));
        if (!dateOk(body.p_start) || !dateOk(body.p_end) || !businessOk
          || !['all','pending','approved','on_the_way','delivered','rejected'].includes(body.p_status)
          || !['newest','oldest','highest','lowest'].includes(body.p_sort)
          || !['orders','daily'].includes(body.p_view)
          || !Number.isInteger(body.p_page) || body.p_page < 0 || body.p_page > 1000000) {
          return json({ error: 'Geçersiz sipariş raporu filtresi.' }, 400);
        }
        const { data, error } = await admin.rpc('admin_order_report', {
          p_admin: caller.id, p_start: body.p_start ?? null, p_end: body.p_end ?? null,
          p_business: body.p_business ?? null, p_status: body.p_status,
          p_sort: body.p_sort, p_view: body.p_view, p_page: body.p_page,
        });
        if (error) {
          console.error('Order report failed', error.code);
          return json({ error: error.message }, error.code === '42501' ? 403 : 400);
        }
        return json(data);
      }

      case 'revenue': {
        const { data: payments, error } = await admin
          .from('payments')
          .select('*, businesses(name)')
          .order('created_at', { ascending: false });
        if (error) return json({ error: error.message }, 400);
        const sum = (st: string) =>
          (payments ?? []).filter((p) => p.status === st).reduce((s, p) => s + Number(p.amount || 0), 0);
        return json({
          payments,
          totals: { paid: sum('paid'), pending: sum('pending'), refunded: sum('refunded') },
        });
      }

      case 'list_logs': {
        const { data, error } = await admin
          .from('admin_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 400);
        return json({ logs: data });
      }

      case 'list_content': {
        let q = admin
          .from('business_posts')
          .select('*, businesses(name, category)')
          .order('created_at', { ascending: false });
        if (body.status) q = q.eq('status', body.status);
        if (body.kind) q = q.eq('kind', body.kind);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ content: data });
      }

      case 'update_content_status': {
        const patch: Record<string, unknown> = { status: body.status };
        patch.rejection_reason = body.status === 'rejected' ? (body.rejection_reason ?? null) : null;
        if (body.status === 'approved') {
          const { data: row, error: contentReadError } = await admin.from('business_posts').select('package_id,kind,image_url,price,payment_status,media_removed_at').eq('id', body.contentId).single();
          if (contentReadError || !row) return json({ error: contentReadError?.message ?? 'İçerik bulunamadı.' }, 400);
          if (row.media_removed_at || !String(row.image_url ?? '').trim()) return json({ error: 'Görsel kaldırılmış. Yeni içerik başvurusu gerekir.' }, 400);
          if (Number(row.price) > 0 && row.payment_status !== 'paid') return json({ error: 'Ücretli içerik için önce ödemeyi doğrulayın.' }, 400);
          let days = 0;
          if (row.package_id) {
            const { data: pkg, error: packageError } = await admin.from('ad_packages').select('duration_days').eq('id', row.package_id).single();
            if (packageError || !pkg) return json({ error: packageError?.message ?? 'İçerik paketi bulunamadı.' }, 400);
            days = Number(pkg.duration_days ?? 0);
          }
          if (row.package_id && (!Number.isFinite(days) || days <= 0)) return json({ error: 'Paketin yayın süresi pozitif olmalıdır.' }, 400);
          Object.assign(patch, caddeTvPublicationDates(days));
        }
        const { error } = await admin.from('business_posts').update(patch).eq('id', body.contentId);
        if (error) return json({ error: error.message }, 400);
        await log('update_content_status', { contentId: body.contentId, status: body.status });
        return json({ ok: true });
      }

      case 'list_campaigns': {
        let q = admin
          .from('campaigns')
          .select('*, businesses(name, category)')
          .order('created_at', { ascending: false });
        if (body.status) q = q.eq('status', body.status);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ campaigns: data });
      }

      case 'update_campaign_status': {
        if (typeof body.campaignId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.campaignId) || !['approved','rejected'].includes(body.status)) return json({ error: 'Geçersiz kampanya kararı.' }, 400);
        const { data, error } = await admin.rpc('admin_campaign_decision', {
          p_admin: caller.id, p_id: body.campaignId, p_action: 'status', p_value: body.status,
          p_reason: typeof body.rejection_reason === 'string' ? body.rejection_reason : null,
          p_expected_status: body.expectedStatus ?? null, p_expected_payment: body.expectedPayment ?? null,
        });
        if (error) { console.error('campaign status failed', error.code); return json({ error: error.message }, error.code === '42501' ? 403 : error.code === '40001' ? 409 : 400); }
        return json(data);
      }

      case 'set_content_paid': {
        const paid = body.payment_status === 'paid';
        if (!['paid','unpaid'].includes(body.payment_status)) return json({ error: 'Geçersiz ödeme durumu.' }, 400);
        const { error } = await admin.from('business_posts').update(paid ? { payment_status: 'paid' } : { payment_status: 'unpaid', status: 'pending' }).eq('id', body.contentId);
        if (error) return json({ error: error.message }, 400);
        if (paid) {
          const ref = `content:${body.contentId}`;
          const { data: row } = await admin.from('business_posts').select('business_id, price').eq('id', body.contentId).single();
          const { count } = await admin.from('payments').select('*', { count: 'exact', head: true }).eq('note', ref);
          if (row && (count ?? 0) === 0) {
            await admin.from('payments').insert({ business_id: row.business_id, amount: row.price, status: 'paid', method: 'manual', note: ref });
          }
        }
        await log('set_content_paid', { contentId: body.contentId, payment_status: body.payment_status });
        return json({ ok: true });
      }

      case 'set_campaign_paid': {
        if (typeof body.campaignId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.campaignId) || !['paid','unpaid'].includes(body.payment_status)) return json({ error: 'Geçersiz kampanya ödemesi.' }, 400);
        const { data, error } = await admin.rpc('admin_campaign_decision', {
          p_admin: caller.id, p_id: body.campaignId, p_action: 'payment', p_value: body.payment_status,
          p_expected_status: body.expectedStatus ?? null, p_expected_payment: body.expectedPayment ?? null,
        });
        if (error) { console.error('campaign payment failed', error.code); return json({ error: error.message }, error.code === '42501' ? 403 : error.code === '40001' ? 409 : 400); }
        return json(data);
      }

      case 'list_notification_requests': {
        let q = admin.from('notification_requests').select('*, businesses(name, category)').order('created_at', { ascending: false });
        if (body.status) q = q.eq('status', body.status);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ requests: data });
      }

      case 'update_notification_request': {
        const patch: Record<string, unknown> = { status: body.status };
        patch.rejection_reason = body.status === 'rejected' ? (body.rejection_reason ?? null) : null;
        const { error } = await admin.from('notification_requests').update(patch).eq('id', body.id);
        if (error) return json({ error: error.message }, 400);
        if (body.status === 'approved') {
          const { data: row } = await admin.from('notification_requests').select('*').eq('id', body.id).single();
          if (row) {
            await admin.from('notifications').insert({
              sender_id: caller.id,
              title: row.title,
              body: row.body,
              target: row.target_category ? 'category' : 'all',
              target_category: row.target_category ?? null,
              type: 'announcement',
            });
          }
        }
        await log('update_notification_request', { id: body.id, status: body.status });
        return json({ ok: true });
      }

      case 'set_notification_request_paid': {
        const paid = body.payment_status === 'paid';
        const { error } = await admin.from('notification_requests').update({ payment_status: body.payment_status }).eq('id', body.id);
        if (error) return json({ error: error.message }, 400);
        if (paid) {
          const ref = `notif:${body.id}`;
          const { data: row } = await admin.from('notification_requests').select('business_id, price').eq('id', body.id).single();
          const { count } = await admin.from('payments').select('*', { count: 'exact', head: true }).eq('note', ref);
          if (row && (count ?? 0) === 0) {
            await admin.from('payments').insert({ business_id: row.business_id, amount: row.price, status: 'paid', method: 'manual', note: ref });
          }
        }
        await log('set_notification_request_paid', { id: body.id, payment_status: body.payment_status });
        return json({ ok: true });
      }

      default:
        return json({ error: 'Bilinmeyen işlem.' }, 400);
    }
  } catch (e) {
    console.error('admin-api error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
