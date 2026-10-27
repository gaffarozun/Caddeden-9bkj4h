// Must match OnSpace Cloud > Users > Auth Settings > allowed redirect URLs.
export const passwordRecoveryConfig = {
  nativeRedirect: 'onspaceapp://password-reset',
  minimumPasswordLength: 6,
  otpLength: 4,
  resendSeconds: 60,
};
