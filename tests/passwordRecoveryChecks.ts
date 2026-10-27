// Pure validation/parsing checks; never send emails, establish sessions or change passwords.
import { hasRecoveryCallback, parseRecoveryUrl, validateNewPassword, validateRecoveryFields } from '../services/passwordRecoveryService';
import { passwordRecoveryConfig } from '../constants/passwordRecovery';
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
export function runPasswordRecoveryChecks(): string {
  const native = parseRecoveryUrl('onspaceapp://password-reset#type=recovery&access_token=test-access&refresh_token=test-refresh');
  assert(native.type === 'recovery' && native.access_token === 'test-access' && native.refresh_token === 'test-refresh', 'Native recovery fragments must be parsed.');
  const pkce = parseRecoveryUrl('https://example.test/password-reset?code=example%2Bcode');
  assert(pkce.code === 'example+code', 'PKCE query code must be decoded without URLSearchParams.');
  const hash = parseRecoveryUrl('onspaceapp://password-reset?token_hash=example&type=recovery');
  assert(hash.token_hash === 'example' && hash.type === 'recovery', 'Recovery token-hash links must be supported.');
  const expired = parseRecoveryUrl('onspaceapp://password-reset?code=example#error_code=otp_expired');
  assert(expired.error_code === 'otp_expired', 'Callback errors must be retained even when a code is present.');
  assert(hasRecoveryCallback(expired), 'Expired links must show an error rather than silently display the email form.');
  assert(parseRecoveryUrl('onspaceapp://password-reset?code=%E0%A4%A').error === 'invalid_callback', 'Malformed percent encoding must not crash the app.');
  assert(!hasRecoveryCallback(parseRecoveryUrl('onspaceapp://password-reset')), 'Opening the form without a callback must not establish a session.');
  assert(validateRecoveryFields('test@example.com', '1'.repeat(passwordRecoveryConfig.otpLength)) === null, 'Configured-length OTP must pass.');
  assert(validateRecoveryFields('test@example.com', '1'.repeat(passwordRecoveryConfig.otpLength + 1)) !== null, 'Wrong OTP length must be rejected.');
  assert(validateRecoveryFields('invalid') !== null, 'Invalid email must be rejected.');
  assert(validateNewPassword('12345', '12345') !== null, 'Passwords below six characters must be rejected.');
  assert(validateNewPassword('valid-password', 'different') !== null, 'Mismatching passwords must be rejected.');
  assert(validateNewPassword('valid-password', 'valid-password') === null, 'Matching valid passwords must pass.');
  return 'passed: recovery callback parsing, error retention, malformed URLs, email, OTP length and new-password validation';
}
