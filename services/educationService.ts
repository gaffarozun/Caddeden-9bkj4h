export const educationOptions = [
 { id: 'secondary', label: 'Lise' }, { id: 'associate', label: 'Ön lisans' }, { id: 'bachelor', label: 'Lisans' },
 { id: 'master', label: 'Yüksek lisans' }, { id: 'doctorate', label: 'Doktora' }, { id: 'graduate', label: 'Mezun' }, { id: 'none', label: 'Okumuyorum' },
];
export type EducationStatus = 'secondary' | 'associate' | 'bachelor' | 'master' | 'doctorate' | 'graduate' | 'none';
export function isActiveStudent(status: string | null | undefined): boolean { return ['secondary','associate','bachelor','master','doctorate'].includes(status ?? ''); }
export function educationLabel(status: string | null | undefined): string { return educationOptions.find(item => item.id === status)?.label ?? 'Eğitim belirtilmemiş'; }
export function validateEducation(status: string, school: string): string | null {
 if (status && !educationOptions.some(item => item.id === status)) return 'Eğitim durumu geçersiz.';
 if (school.trim().length > 120) return 'Okul adı en fazla 120 karakter olmalı.';
 if (isActiveStudent(status) && !school.trim()) return 'Aktif olarak okuduğunuz okulu girin.';
 return null;
}
export function occupancyShare(count: number, total: number): number | null {
 return Number.isFinite(count) && Number.isFinite(total) && total > 0 ? Math.round(Math.min(total,Math.max(0,count)) / total * 100) : null;
}
