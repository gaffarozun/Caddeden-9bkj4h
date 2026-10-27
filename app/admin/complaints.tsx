import { Redirect } from 'expo-router';
// Preserve the existing complaint route while using the reasoned, server-verified moderation UI.
export default function AdminComplaints() {
  return <Redirect href={{ pathname: '/admin/feedback', params: { kind: 'complaint' } }} />;
}
