import { canShowAdminEntry, isDesignatedAdmin } from '../services/adminEntryService';

function assert(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
export function runAdminEntryChecks() {
  const admin = { email: 'admin@example.com', role: 'admin', status: 'active' };
  assert(isDesignatedAdmin(admin), 'Active admin role (from the database) is recognized; no client e-mail comparison.');
  assert(canShowAdminEntry(admin, true) && canShowAdminEntry(admin, false), 'Admin entry is visible on business and customer profiles.');
  assert(!canShowAdminEntry(null, true), 'Guests never see administrator entry.');
  assert(!canShowAdminEntry(undefined, false), 'Missing sessions fail closed.');
  for (const role of ['user', 'business', '', 'owner']) {
    assert(!canShowAdminEntry({ ...admin, role }, true), 'A non-admin role never sees the entry, whatever the e-mail.');
    assert(!canShowAdminEntry({ email: 'caddeden.app@gmail.com', role, status: 'active' }, false), 'E-mail alone never grants administrator entry.');
  }
  for (const status of ['restricted', 'banned', 'deleted', '']) {
    assert(!canShowAdminEntry({ ...admin, status }, true), 'An inactive administrator never sees the entry.');
  }
  return 'passed: admin entry depends only on active admin role';
}
