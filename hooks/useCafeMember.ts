import { useCallback, useEffect, useState } from 'react';
import { useCafePhoto } from './useCafePhoto';
import { useCafePresence } from './useCafePresence';
import { CafeMember } from '@/services/cafePresenceService';
import { findCafeInstagramRequest, isCafeRequestBlocked, isInstagramHandleValid } from '@/services/cafeSocialService';
import { useCafeSocial } from './useCafeSocial';
export function useCafeMember(member: CafeMember) {
 const social = useCafeSocial(); const presence=useCafePresence(); const [photoOpen,setPhotoOpen]=useState(false);
 const request = findCafeInstagramRequest(member.user_id, social.incoming, social.outgoing);
 const outgoing = social.outgoing.find(item => item.user_id === member.user_id);
 const status = request?.status ?? member.request_status;
 const anonymous = member.anonymous === true || isCafeRequestBlocked(outgoing);
 const hasHandle = social.ready && isInstagramHandleValid(social.handle);
 const incomingPending = !!request && request.status === 'pending' && social.incoming.some(item => item.id === request.id);
 const canOpen = !!presence.visit && !anonymous && hasHandle && request?.status === 'accepted' && request.can_open === true;
 const canSend = !!presence.visit && !anonymous && hasHandle && !!member.has_instagram && status !== 'pending' && status !== 'accepted';
 const send = useCallback(() => canSend ? social.request(member.user_id) : Promise.resolve(false), [canSend, social.request, member.user_id]);
 const open = useCallback(() => canOpen && request ? social.open(request.id) : Promise.resolve(false), [canOpen, request, social.open]);
 const photoUri=useCafePhoto(!anonymous && hasHandle && presence.visit ? member.photo_path : null);
 useEffect(()=>{if(!photoUri || anonymous || !hasHandle || !presence.visit)setPhotoOpen(false);},[photoUri,anonymous,hasHandle,presence.visit?.business_id]);
 const showPhoto=useCallback(()=>{if(photoUri && !anonymous && hasHandle && presence.visit)setPhotoOpen(true);},[photoUri,anonymous,hasHandle,presence.visit]);
 const closePhoto=useCallback(()=>setPhotoOpen(false),[]);
 const revoke=useCallback(()=>request?social.revoke(request.id):Promise.resolve(false),[request,social.revoke]);
 return { photoOpen:photoOpen && !!photoUri && !!presence.visit && !anonymous && hasHandle, photoUri, showPhoto,closePhoto,revoke, social, status, anonymous, hasHandle, incomingPending, canSend, canOpen, blocked: isCafeRequestBlocked(outgoing), send, open };
}
