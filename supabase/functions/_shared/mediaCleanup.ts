// Only dedicated uploaded creative paths may be removed. Never remove business logos/menu/gallery files.
export function creativePath(value: string | null, businessId: string, backendUrl: string): string | null {
 if (!value) return null;
 const prefix = `${backendUrl.replace(/\/$/, '')}/storage/v1/object/public/business-media/`;
 if (!value.startsWith(prefix)) return null;
 try {
  const path = decodeURIComponent(value.slice(prefix.length).split('?')[0]);
  return path.startsWith(`${businessId}/`) && /^[^/]+\/(content|ads|campaigns)\/[^/]+$/.test(path) && !path.includes('..') ? path : null;
 } catch { return null; }
}
// Supabase service-role client is passed in; no caller-supplied table/path/expiry is trusted.
export async function queueCreative(admin: any, imageUrl: string | null, businessId: string, backendUrl: string) {
 const path = creativePath(imageUrl, businessId, backendUrl);
 if (!path) return;
 const { error } = await admin.from('media_cleanup_queue').upsert({ path, business_id: businessId }, { onConflict: 'path', ignoreDuplicates: true });
 if (error) throw new Error(`Temizleme kuyruğu: ${error.message}`);
}
export async function processCreativeQueue(admin: any, backendUrl: string) {
 const { data: jobs, error } = await admin.from('media_cleanup_queue').select('*').is('completed_at', null).order('created_at').limit(30);
 if (error) throw new Error(error.message);
 let removed = 0;
 for (const job of jobs ?? []) {
  // Normalize through the same whitelist, even for stored queue rows.
  const imageUrl = `${backendUrl.replace(/\/$/, '')}/storage/v1/object/public/business-media/${job.path}`;
  if (!job.business_id || creativePath(imageUrl, job.business_id, backendUrl) !== job.path) continue;
  const { data: referenced, error: referenceError } = await admin.rpc('creative_is_referenced', { p_url: imageUrl });
  if (referenceError) throw new Error(referenceError.message);
  // Reference check spans every business, including files reused in a different gallery.
  if (referenced !== false) continue;
  const { error: removalError } = await admin.storage.from('business-media').remove([job.path]);
  const { error: jobError } = await admin.from('media_cleanup_queue').update({ attempts: job.attempts + 1, last_error: removalError?.message ?? null, completed_at: removalError ? null : new Date().toISOString() }).eq('id', job.id);
  if (jobError) throw new Error(jobError.message);
  if (!removalError) removed++;
 }
 return removed;
}
export async function expireCreativeMedia(admin: any, backendUrl: string) {
 const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date());
 const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
 const today = `${get('year')}-${get('month')}-${get('day')}`;
 let cleared = 0;
 for (const table of ['business_posts','ads','campaigns']) {
  const { data: rows, error } = await admin.from(table).select('id,business_id,image_url,end_date').lt('end_date',today).not('image_url','is',null).neq('image_url','').order('end_date').limit(30);
  if (error) throw new Error(error.message);
  for (const row of rows ?? []) {
   // Queue first: a storage failure can be retried after clearing the public URL.
   await queueCreative(admin,row.image_url,row.business_id,backendUrl);
   const { data, error: clearError } = await admin.from(table).update({ image_url: table === 'business_posts' ? '' : null, media_removed_at: new Date().toISOString() }).eq('id',row.id).eq('image_url',row.image_url).eq('end_date',row.end_date).lt('end_date',today).select('id');
   if (clearError) throw new Error(clearError.message);
   if (data?.length) cleared++;
  }
 }
 return { cleared, removed: await processCreativeQueue(admin,backendUrl) };
}
