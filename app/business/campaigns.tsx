import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { BusinessCampaignView } from '@/components/feature/BusinessCampaignView';
export default function BusinessCampaignsScreen() {
  return <AccountRouteBoundary><BusinessCampaignView /></AccountRouteBoundary>;
}
