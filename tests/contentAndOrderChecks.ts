import { arrangeAdminContent } from '../services/adminContentService';
import { broadcastDay,mediaExpiresAt } from '../services/mediaPublicationService';
import { creativePath } from '../supabase/functions/_shared/mediaCleanup';
function assert(value:boolean,message:string){if(!value)throw new Error(message);}
export function runContentAndOrderChecks(){
 const rows=[{id:'unpaid',payment_status:'unpaid',created_at:'2026-10-23T12:00:00Z'},{id:'paid',payment_status:'paid',created_at:'2026-10-22T12:00:00Z'},{id:'legacy',created_at:'2026-10-21T12:00:00Z'}];
 const before=JSON.stringify(rows);
 assert(arrangeAdminContent(rows,'all','paid_first')[0].id==='paid','Paid content must sort first.');
 assert(arrangeAdminContent(rows,'all','unpaid_first')[0].id==='unpaid','Unpaid content must sort first.');
 assert(arrangeAdminContent(rows,'unpaid','newest').length===2,'Unverified legacy rows count as unpaid.');
 assert(arrangeAdminContent(rows,'paid','newest').length===1,'Paid filter must be exact.');
 assert(JSON.stringify(rows)===before,'Sorting must not mutate content records.');
 assert(broadcastDay(Date.parse('2026-10-23T22:00:00Z'))==='2026-10-24','Turkey broadcast day must not use UTC midnight.');
 assert(mediaExpiresAt('2026-10-23')===Date.parse('2026-10-23T21:00:00Z'),'Expiry includes the end day in Turkey.');
 assert(mediaExpiresAt(null)===undefined,'Unscheduled legacy content has no fabricated expiry.');
 const backend='https://example.backend.onspace.ai';const path='business-1/content/photo.jpg';
 assert(creativePath(`${backend}/storage/v1/object/public/business-media/${path}`,'business-1',backend)===path,'Dedicated creative path must be accepted.');
 assert(creativePath(`${backend}/storage/v1/object/public/business-media/business-1/logo.jpg`,'business-1',backend)===null,'Business logo must never be removed.');
 assert(creativePath(`${backend}/storage/v1/object/public/business-media/business-2/content/photo.jpg`,'business-1',backend)===null,'Other businesses must be protected.');
 assert(creativePath(`https://other.example/storage/v1/object/public/business-media/${path}`,'business-1',backend)===null,'External images must never be deleted.');
 assert(creativePath(`${backend}/storage/v1/object/public/business-media/business-1/content/../logo.jpg`,'business-1',backend)===null,'Traversal paths must be rejected.');
 return 'passed: payment filtering, stable sort, broadcast expiry and creative path safety';
}
