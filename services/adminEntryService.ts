// UI visibility never grants a role. The database remains the authority for permissions.
export const designatedAdminEmail = 'caddeden.app@gmail.com';
export interface AdminEntryAccount {
  email: string;
  role: string;
  status: string;
}
export function isDesignatedAdmin(account: AdminEntryAccount | null | undefined): boolean {
  return !!account && account.role === 'admin' && account.status === 'active'
    && account.email.trim().toLowerCase() === designatedAdminEmail;
}
export function canShowAdminEntry(account: AdminEntryAccount | null | undefined, businessPage: boolean): boolean {
  return businessPage && isDesignatedAdmin(account);
}
