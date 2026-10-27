import React, { memo } from 'react';
import { useOrderRatings } from '@/hooks/useOrderRatings';
import { OrderMessageBubble } from './OrderMessageBubble';
import { OrderRatingBubble } from './OrderRatingBubble';

interface OrderNotificationsProps { hidden?: boolean }
export const OrderNotifications = memo(function OrderNotifications({ hidden = false }: OrderNotificationsProps) {
  const rating = useOrderRatings();
  const ratingVisible = !!rating.current || !!rating.notice;
  return <>
    <OrderMessageBubble hidden={hidden || ratingVisible} />
    <OrderRatingBubble hidden={hidden} />
  </>;
});
