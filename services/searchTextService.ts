// Shared literal matching for Turkish search; no regex or SQL wildcard interpolation.
export function normalizeSearchText(value: string): string {
  return value.trim().replace(/[ÇĞİÖŞÜçğıöşü]/g, character => {
    const from = 'ÇĞİÖŞÜçğıöşü';
    return 'CGIOSUcgiosu'[from.indexOf(character)];
  }).toLowerCase().replace(/\s+/g, ' ');
}
export function searchNameMatches(name: string, query: string): boolean {
  const text = normalizeSearchText(name);
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  return tokens.every(token => text.includes(token));
}
