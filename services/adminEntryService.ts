// UI visibility never grants a role. The database is the only authority:
// `user_profiles.role = 'admin'` can only be set for the single verified designated
// account (trigger protect_admin_role + unique index), and every admin API
// re-checks it on the server. The client therefore compares no e-mail address.
export interface AdminEntryAccount {
  email: string;
  role: string;
  status: string;
}
export function isDesignatedAdmin(account: AdminEntryAccount | null | undefined): boolean {
  return !!account && account.role === 'admin' && account.status === 'active';
}
// The entry is shown on every profile page for an active admin; non-admins never see it.
export function canShowAdminEntry(account: AdminEntryAccount | null | undefined, _businessPage?: boolean): boolean {
  return isDesignatedAdmin(account);
}
