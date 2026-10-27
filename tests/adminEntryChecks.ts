import { canShowAdminEntry, designatedAdminEmail, isDesignatedAdmin } from '../services/adminEntryService';

function assert(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
export function runAdminEntryChecks() {
  const admin = { email: designatedAdminEmail, role: 'admin', status: 'active' };
  assert(isDesignatedAdmin(admin), 'Designated active administrator is recognized.');
  assert(canShowAdminEntry(admin, true), 'Administrator entry is visible on the business profile.');
  assert(!canShowAdminEntry(admin, false), 'No administrator entry on the customer profile, even for an admin.');
  assert(!canShowAdminEntry(null, true), 'Guests never see administrator entry.');
  assert(!canShowAdminEntry(undefined, false), 'Missing sessions fail closed.');
  for (const role of ['user', 'business']) {
    assert(!canShowAdminEntry({ ...admin, role }, true), 'Email alone never grants administrator entry.');
    assert(!canShowAdminEntry({ email: 'business@example.com', role, status: 'active' }, false), 'Ordinary accounts never see administrator entry.');
  }
  for (const status of ['restricted', 'banned', 'deleted', '']) {
    assert(!canShowAdminEntry({ ...admin, status }, true), 'An inactive administrator never sees the entry.');
  }
  assert(!isDesignatedAdmin({ ...admin, email: 'other-admin@example.com' }), 'Other administrator emails do not expose the entry.');
  assert(!isDesignatedAdmin({ ...admin, email: 'caddeden.app@gmail.com.example.org' }), 'Email must match exactly.');
  assert(isDesignatedAdmin({ ...admin, email: 'CADDEDEN.APP@GMAIL.COM' }), 'Email comparison is case insensitive.');
  return 'passed: active administrator role, exact email and business-only entry visibility';
}
