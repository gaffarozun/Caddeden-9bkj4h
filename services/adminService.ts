// Powered by OnSpace.AI
// Thin client for the server-verified admin-api edge function.
// All privilege checks happen server-side; this only forwards actions.
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface ApiResult<T = any> {
  data: T | null;
  error: string | null;
}

async function call<T = any>(action: string, params: Record<string, unknown> = {}): Promise<ApiResult<T>> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('admin-api', {
    body: { action, ...params },
  });

  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const status = error.context?.status ?? 500;
        const text = await error.context?.text();
        let parsed = text;
        try {
          parsed = JSON.parse(text ?? '{}')?.error ?? text;
        } catch {
          // keep raw text
        }
        message = `[${status}] ${parsed || error.message}`;
      } catch {
        message = error.message;
      }
    }
    return { data: null, error: message };
  }
  return { data: data as T, error: null };
}

export const adminApi = {
  bootstrap: (code: string) => call('bootstrap', { code }),
  adminClaimStatus: () => call('admin_claim_status'),
  claimAdmin: () => call('claim_admin'),
  overview: () => call('overview'),
  listUniversityMessages: (status: 'pending' | 'approved' | 'rejected' | 'withdrawn') => call('list_university_messages', { status }),
  moderateUniversityMessage: (id: string, status: 'approved' | 'rejected', expectedStatus: 'pending' | 'approved' | 'rejected', reason = '') =>
    call('moderate_university_message', { id, status, expectedStatus, reason }),

  listBusinesses: (status?: string) => call('list_businesses', { status }),
  updateBusinessStatus: (businessId: string, approval_status: string, rejection_reason?: string) =>
    call('update_business_status', { businessId, approval_status, rejection_reason }),
  setBusinessPublished: (businessId: string, is_published: boolean) =>
    call('set_business_published', { businessId, is_published }),
  setBusinessFeatured: (businessId: string, featured: boolean) =>
    call('set_business_featured', { businessId, featured }),

  setComplaintEmail: (email: string) => call('set_complaint_email', { email }),
  deleteRejectedMedia: (id: string, section: 'content' | 'campaign' | 'ad') => call('delete_rejected_media', { id, section }),
  listAds: (status?: string) => call('list_ads', { status }),
  updateAd: (adId: string, patch: Record<string, unknown>) => call('update_ad', { adId, ...patch }),

  listContent: (status?: string, kind?: string) => call('list_content', { status, kind }),
  updateContentStatus: (contentId: string, status: string, rejection_reason?: string) =>
    call('update_content_status', { contentId, status, rejection_reason }),

  listCampaigns: (status?: string) => call('list_campaigns', { status }),
  updateCampaignStatus: (campaignId: string, status: string, rejection_reason?: string, expectedStatus?: string, expectedPayment?: string) =>
    call('update_campaign_status', { campaignId, status, rejection_reason, expectedStatus, expectedPayment }),
  setContentPaid: (contentId: string, payment_status: string) =>
    call('set_content_paid', { contentId, payment_status }),
  setCampaignPaid: (campaignId: string, payment_status: string, expectedStatus?: string, expectedPayment?: string) =>
    call('set_campaign_paid', { campaignId, payment_status, expectedStatus, expectedPayment }),

  listNotificationRequests: (status?: string) => call('list_notification_requests', { status }),
  updateNotificationRequest: (id: string, status: string, rejection_reason?: string) =>
    call('update_notification_request', { id, status, rejection_reason }),
  setNotificationRequestPaid: (id: string, payment_status: string) =>
    call('set_notification_request_paid', { id, payment_status }),

  listAdPackages: () => call('list_ad_packages'),
  upsertAdPackage: (pkg: Record<string, unknown>) => call('upsert_ad_package', { package: pkg }),

  sendNotification: (p: { title: string; message: string; target: string; target_category?: string | null; type?: string }) =>
    call('send_notification', p),
  listNotifications: () => call('list_notifications'),

  listAdminAlerts: () => call('list_admin_alerts'),
  markAlertRead: (alertId?: string) => call('mark_alert_read', { alertId }),

  listUsers: () => call('list_users'),
  setBusinessAccountApproval: (userId: string, status: 'pending' | 'approved') =>
    call('set_business_account_approval', { userId, status }),
  setAccountType: (userId: string, role: 'user' | 'business', expectedRole: string) => call('set_account_type', { userId, role, expectedRole }),
  restrictUser: (userId: string, status: string, restricted_until?: string | null) =>
    call('restrict_user', { userId, status, restricted_until }),

  listComplaints: () => call('list_complaints'),
  updateComplaint: (complaintId: string, status: string) => call('update_complaint', { complaintId, status }),

  orderReport: (params: { p_start: string | null; p_end: string | null; p_business: string | null; p_status: string; p_sort: string; p_view: string; p_page: number }) => call('order_report', params),
  revenue: () => call('revenue'),
  listLogs: () => call('list_logs'),
};
