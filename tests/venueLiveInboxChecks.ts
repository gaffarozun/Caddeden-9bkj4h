import { occupancyShare, validateEducation, isActiveStudent } from '../services/educationService';
import { getOpenStatus } from '../services/businessStatus';
import { Business } from '../services/types';
function assert(value:boolean,message:string){if(!value)throw new Error(message);}
export function runVenueLiveInboxChecks(){
 assert(occupancyShare(3,10)===30,'Demographic ratios use all participants.');
 assert(occupancyShare(0,0)===null,'Empty venue has no fabricated demographic ratio.');
 assert(occupancyShare(20,10)===100,'Shares cannot exceed 100.');
 assert(occupancyShare(NaN,10)===null,'Invalid shares fail safely.');
 assert(isActiveStudent('bachelor') && !isActiveStudent('graduate'),'Graduates are not active students.');
 assert(validateEducation('bachelor','')!==null,'Current students must enter their school.');
 assert(validateEducation('bachelor','Örnek Üniversitesi')===null,'School is accepted.');
 assert(validateEducation('graduate','')===null,'Graduates do not need a current school.');
 const b={isOpen:false,statusMode:'manual',hours:'09:00 - 23:00'} as Business;
 assert(!getOpenStatus(b,new Date('2026-10-25T12:00:00Z')).open,'Manual closed state blocks ordering.');
 const overnight={...b,statusMode:'auto',openTime:'22:00',closeTime:'02:00',openDays:[6]} as Business;
 assert(getOpenStatus(overnight,new Date('2026-10-24T22:00:00Z')).open,'Sunday 01:00 Istanbul belongs to Saturday overnight hours.');
 assert(!getOpenStatus(overnight,new Date('2026-10-24T23:00:00Z')).open,'02:00 closing boundary is closed.');
 return 'passed: ratios, education validation and Istanbul opening boundaries';
}
