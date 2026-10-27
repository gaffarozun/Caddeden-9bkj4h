import { Linking } from 'react-native';
import { getSupabaseClient } from '@/template';
import { adminApi } from './adminService';
import { withRequestTimeout } from './requestTimeoutService';
export function validComplaintEmail(email: string) { return email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export async function getComplaintEmail(): Promise<string> {
 const {data,error}=await withRequestTimeout(getSupabaseClient().rpc('public_complaint_email'),'Şikâyet adresi yüklenemedi.');
 if(error) throw new Error(error.message);
 return typeof data==='string' && validComplaintEmail(data) ? data : '';
}
export async function saveComplaintEmail(email: string) {
 const value=email.trim().toLowerCase();
 if(!validComplaintEmail(value)) throw new Error('Geçerli bir e-posta adresi girin.');
 const result=await adminApi.setComplaintEmail(value);
 if(result.error) throw new Error(result.error);
 return value;
}
export function complaintMailUrl(email: string,subject: string,message: string,accountEmail='',context='') {
 return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Caddeden · ${subject.trim()}`)}&body=${encodeURIComponent(`${message.trim()}\n\n${context ? `Konu bağlantısı: ${context}\n` : ''}${accountEmail ? `Hesap e-postası: ${accountEmail}\n` : ''}Caddeden uygulamasından hazırlanmıştır.`)}`;
}
export async function openComplaintEmail(email: string,subject: string,message: string,accountEmail: string,context: string) {
 if(!validComplaintEmail(email)) throw new Error('Yönetici henüz şikâyet e-posta adresini belirlememiş.');
 if(subject.trim().length<3 || message.trim().length<10) throw new Error('En az 3 karakterlik konu ve 10 karakterlik açıklama yazın.');
 try { await Linking.openURL(complaintMailUrl(email,subject,message,accountEmail,context)); }
 catch { throw new Error(`E-posta uygulaması açılamadı. Mesajınızı ${email} adresine e-posta uygulamanızdan gönderebilirsiniz.`); }
}
