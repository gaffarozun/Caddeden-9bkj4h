// Powered by OnSpace.AI
// Caddeden category taxonomy: two main groups + simplified sub categories.
// Legacy sub-category ids (bar, club, berber, guzellik_salonu, ...) are mapped
// onto the current taxonomy via normalizeCategory so older/demo data keeps working.

export type MainCategoryId = 'yeme_icme' | 'guzellik_bakim';

export interface MainCategory {
  id: MainCategoryId;
  label: string;
  short: string;
  icon: string;
  color: string;
}

export interface SubCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  main: MainCategoryId;
  hasMenu?: boolean; // product/service price list
  hasOrder?: boolean; // ordering (restaurants & markets, opt-in)
  hasReservation?: boolean; // table reservation
  hasAppointment?: boolean; // appointment booking
}

export const MAIN_CATEGORIES: MainCategory[] = [
  { id: 'yeme_icme', label: 'Yeme-İçme ve Eğlence', short: 'Yeme-İçme', icon: 'silverware-fork-knife', color: '#FF5436' },
  { id: 'guzellik_bakim', label: 'Güzellik ve Bakım', short: 'Güzellik', icon: 'scissors-cutting', color: '#B5559E' },
];

export const SUB_CATEGORIES: SubCategory[] = [
  { id: 'restoran', label: 'Restoran', icon: 'silverware-fork-knife', color: '#FF5436', main: 'yeme_icme', hasMenu: true, hasOrder: true, hasReservation: true },
  { id: 'kafe', label: 'Kafe', icon: 'coffee', color: '#C9872E', main: 'yeme_icme', hasMenu: true, hasReservation: true },
  { id: 'market', label: 'Market', icon: 'cart-outline', color: '#2E9E6B', main: 'yeme_icme', hasMenu: true, hasOrder: true },
  { id: 'eglence', label: 'Eğlence', icon: 'party-popper', color: '#7A5AF8', main: 'yeme_icme', hasMenu: true, hasReservation: true },
  { id: 'kadin_kuafor', label: 'Kadın Kuaför', icon: 'content-cut', color: '#B5559E', main: 'guzellik_bakim', hasMenu: true, hasAppointment: true },
  { id: 'erkek_kuafor', label: 'Erkek Kuaför', icon: 'content-cut', color: '#3B7CD4', main: 'guzellik_bakim', hasMenu: true, hasAppointment: true },
  { id: 'guzellik', label: 'Güzellik', icon: 'face-woman-shimmer', color: '#D6457E', main: 'guzellik_bakim', hasMenu: true, hasAppointment: true },
];

// Legacy -> current taxonomy. Keeps older businesses and demo data mapped to
// the simplified categories (Eğlence, Güzellik, ...).
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  bar: 'eglence',
  club: 'eglence',
  berber: 'erkek_kuafor',
  guzellik_salonu: 'guzellik',
  protez_tirnak: 'guzellik',
  cilt_bakimi: 'guzellik',
  kas_kirpik: 'guzellik',
  makyaj: 'guzellik',
  agda_epilasyon: 'guzellik',
};

export const normalizeCategory = (id?: string): string =>
  id ? LEGACY_CATEGORY_MAP[id] ?? id : '';

export const getSubCategory = (id?: string): SubCategory | undefined =>
  SUB_CATEGORIES.find((c) => c.id === normalizeCategory(id));

export const getMainCategory = (id?: string): MainCategory | undefined =>
  MAIN_CATEGORIES.find((c) => c.id === id);

export const subCategoriesOf = (main: MainCategoryId): SubCategory[] =>
  SUB_CATEGORIES.filter((c) => c.main === main);

export const categoryLabel = (id?: string): string =>
  getSubCategory(id)?.label ?? id ?? 'Diğer';

export const mainCategoryOf = (subId?: string): MainCategoryId | undefined =>
  getSubCategory(subId)?.main;
