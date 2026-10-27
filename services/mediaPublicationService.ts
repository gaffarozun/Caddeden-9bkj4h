export function broadcastDay(timestamp=Date.now()):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
 const part=(type:string)=>parts.find(value=>value.type===type)?.value??'';
 return `${part('year')}-${part('month')}-${part('day')}`;
}
// Existing date-based packages include the displayed end day in Turkey.
export function mediaExpiresAt(endDate?:string|null):number|undefined {
 if(!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate))return undefined;
 const date=Date.parse(`${endDate}T00:00:00+03:00`)+86400000;
 return Number.isFinite(date)?date:undefined;
}
