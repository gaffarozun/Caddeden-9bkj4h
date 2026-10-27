import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const ownerEmail = 'caddeden.app@gmail.com';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST gerekli.' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  let deletionUser: string | null = null;
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Geçerli oturum gerekli.' }, 401);
    const caller = auth.user;
    const { data: profile, error: profileError } = await admin.from('user_profiles').select('id,role,email,status').eq('id', caller.id).single();
    if (profileError || !profile) return json({ error: 'Hesap doğrulanamadı.' }, 403);
    const body = await req.json();
    const isAdmin = profile.role === 'admin' && profile.status === 'active' && String(caller.email).toLowerCase() === ownerEmail;
    if (body.action === 'evidence_url') {
      if (!isAdmin) return json({ error: 'Kanıtlar yalnızca yöneticiye açıktır.' }, 403);
      const { data: complaint, error } = await admin.from('complaints').select('evidence_path').eq('id', body.id).single();
      if (error || !complaint?.evidence_path) return json({ error: 'Kanıt bulunamadı.' }, 404);
      const { data: link, error: linkError } = await admin.storage.from('feedback-evidence').createSignedUrl(complaint.evidence_path, 60);
      if (linkError) throw new Error('Kanıt bağlantısı oluşturulamadı.');
      return json({ url: link.signedUrl });
    }
    if (body.action === 'deletion_list') {
      if (!isAdmin) return json({ error: 'Yönetici yetkisi gerekli.' }, 403);
      const { data, error } = await admin.from('account_deletion_requests').select('user_id,status,created_at,completed_at,error_code').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ requests: data });
    }
    if (!['delete_account', 'resume_deletion'].includes(body.action)) return json({ error: 'Bilinmeyen işlem.' }, 400);
    const target = body.action === 'resume_deletion' ? String(body.user_id ?? '') : caller.id;
    if (body.action === 'resume_deletion') {
      if (!isAdmin) return json({ error: 'Yönetici yetkisi gerekli.' }, 403);
      const { data: job, error } = await admin.from('account_deletion_requests').select('status').eq('user_id', target).single();
      if (error || !job || job.status === 'completed') return json({ error: 'Devam ettirilebilir silme isteği bulunamadı.' }, 400);
    } else {
      if (profile.role === 'admin' || String(caller.email).toLowerCase() === ownerEmail) return json({ error: 'Yönetici hesabı bu akışta silinemez.' }, 403);
      if (body.confirmation !== 'HESABIMI SİL' || typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 200) return json({ error: 'Şifre ve açık silme onayı gerekli.' }, 400);
      // A short-lived password verification client does not alter the existing mobile session.
      const verifier = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: proof, error: proofError } = await verifier.auth.signInWithPassword({ email: caller.email ?? '', password: body.password });
      if (proofError || proof.user?.id !== caller.id) return json({ error: 'Şifre doğrulanamadı.' }, 403);
      await verifier.auth.signOut();
    }
    const { data: targetProfile, error: targetError } = await admin.from('user_profiles').select('role,email').eq('id', target).single();
    if (targetError || !targetProfile || targetProfile.role === 'admin' || targetProfile.email.toLowerCase() === ownerEmail) return json({ error: 'Bu hesap silinemez.' }, 403);
    const { error: jobError } = await admin.rpc('feedback_begin_account_deletion', { p_user: target, p_resume: body.action === 'resume_deletion' });
    if (jobError) return json({ error: jobError.message }, 409);
    deletionUser = target;
    console.log('feedback-api account cleanup started');
    // Purge the user's private evidence files before clearing their DB paths.
    for (;;) {
      const { data: files, error } = await admin.storage.from('feedback-evidence').list(target, { limit: 100 });
      if (error) throw new Error('Kanıt dosyaları temizlenemedi.');
      if (!files?.length) break;
      const { error: removeError } = await admin.storage.from('feedback-evidence').remove(files.map(f => `${target}/${f.name}`));
      if (removeError) throw new Error('Kanıt dosyaları temizlenemedi.');
    }
    const { error: cleanupError } = await admin.rpc('feedback_delete_account_data', { p_user: target });
    if (cleanupError) throw new Error('İlişkili kayıtlar temizlenemedi.');
    // Never hard-delete: auth soft deletion preserves user_profiles FK cascades and transaction rows.
    const { error: deleteError } = await admin.auth.admin.deleteUser(target, true);
    if (deleteError) throw new Error('Kimlik hesabının silinmesi tamamlanamadı.');
    // Auth metadata-sync triggers may rewrite the profile; reapply the same idempotent cleanup.
    const { error: finalError } = await admin.rpc('feedback_delete_account_data', { p_user: target });
    if (finalError) throw new Error('Son kişisel veri temizliği tamamlanamadı.');
    const { error: completeError } = await admin.from('account_deletion_requests').update({ status: 'completed', completed_at: new Date().toISOString(), error_code: null }).eq('user_id', target);
    if (completeError) throw completeError;
    if (body.action === 'resume_deletion') {
      const { error: logError } = await admin.from('admin_logs').insert({ admin_id: caller.id, action: 'resume_account_deletion', detail: { request: target } });
      if (logError) console.error('feedback-api deletion audit insert failed');
    }
    return json({ ok: true });
  } catch (error) {
    console.error('feedback-api operation failed', error instanceof Error ? error.message : 'unknown');
    if (deletionUser) {
      await admin.from('account_deletion_requests').update({ status: 'failed', error_code: 'cleanup_incomplete' }).eq('user_id', deletionUser);
    }
    return json({ error: deletionUser ? 'Silme tamamen tamamlanamadı; kayıtlar korunuyor. Yönetici, silme isteğini güvenli biçimde devam ettirebilir.' : 'İşlem tamamlanamadı. Tekrar deneyin.' }, 500);
  }
});
