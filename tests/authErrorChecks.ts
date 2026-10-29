import { describeAuthError, isNetworkError, messageForDiagnosis } from '../services/authErrors';

function assert(value: boolean, message: string) {
  if (!value) throw new Error(message);
}
export function runAuthErrorChecks() {
  assert(isNetworkError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), 'Fetch failure is a network error.');
  assert(isNetworkError(new TypeError('Failed to fetch')), 'TypeError fetch failure is a network error.');
  assert(!isNetworkError({ message: 'Invalid login credentials', status: 400 }), 'Wrong password is not a network error.');
  assert(describeAuthError({ message: 'Invalid login credentials', code: 'invalid_credentials' }, 't').includes('hatalı'), 'Credentials error is explained.');
  assert(describeAuthError({ message: 'x', code: 'over_email_send_rate_limit', status: 429 }, 't').includes('e-posta'), 'Rate limit is explained.');
  assert(describeAuthError({ message: 'Error sending confirmation email', status: 500 }, 't').includes('SMTP'), 'SMTP failure is explained.');
  assert(describeAuthError({ message: 'Invalid API key', status: 401 }, 't').includes('anon'), 'Bad anon key is explained.');
  assert(describeAuthError({ message: 'Error sending magic link email', code: 'unexpected_failure', status: 500 }, 't').includes('500 unexpected_failure'), 'Magic link send failure shows SMTP guidance and an error code.');
  assert(describeAuthError({ message: '', code: 'unexpected_failure', status: 500 }, 't').includes('SMTP'), 'Bare 500 unexpected_failure is treated as an e-mail delivery problem.');
  assert(!describeAuthError({ message: 'Error sending magic link email' }, 't').includes('internet'), 'Email failure is never reported as an internet problem.');
  assert(describeAuthError({ message: 'Email address not authorized', code: 'email_address_not_authorized', status: 400 }, 't').includes('SMTP'), 'Built-in SMTP restriction is explained.');
  assert(messageForDiagnosis('host_unreachable').includes('EXPO_PUBLIC_SUPABASE_URL'), 'Unreachable host points at the URL setting.');
  assert(messageForDiagnosis('offline').includes('internete'), 'Offline is reported only when the device is offline.');
  return 'passed: auth errors are classified (credentials, rate limit, SMTP, API key, network)';
}
