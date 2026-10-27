import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { loadBusinessAppearance, pickAppearanceImage, renameMenuGroup, saveBusinessAppearance, saveMenuCover } from '@/services/businessAppearanceService';
export function useBusinessAppearance(id: string) {
  const { authUser } = useAuth();
  const [mapsUrl, setMapsUrl] = useState(''); const [tags, setTags] = useState(''); const [menuCover, setMenuCover] = useState(''); const [groupCovers, setGroupCovers] = useState<Record<string, string>>({}); const [groups, setGroups] = useState<string[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const loadGroups = useCallback(async () => { const appearance = await loadBusinessAppearance(id); setGroups(appearance.groups); setGroupCovers(appearance.groupCovers); setNames(Object.fromEntries(appearance.groups.map(group => [group, group]))); }, [id]);
  useEffect(() => {
    let active = true;
    loadBusinessAppearance(id).then(data => { if (active) { setMapsUrl(data.mapsUrl); setTags(data.tags.join(', ')); setMenuCover(data.menuCover); setGroupCovers(data.groupCovers); setGroups(data.groups); setNames(Object.fromEntries(data.groups.map(group => [group, group]))); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Ayarlar yüklenemedi.'); });
    return () => { active = false; };
  }, [id, authUser?.id]);
  const run = useCallback(async (key: string, action: () => Promise<void>) => { setBusy(key); setError(''); setNotice(''); try { await action(); setNotice('Değişiklik kaydedildi. Yönetici onayı gerekmez.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Kaydedilemedi.'); } finally { setBusy(''); } }, []);
  const save = useCallback(() => run('settings', () => saveBusinessAppearance(id, mapsUrl, tags)), [run, id, mapsUrl, tags]);
  const upload = useCallback((group?: string) => run(group ?? 'cover', async () => {
    const url = await pickAppearanceImage(id); if (!url) return;
    if (group) { const next = { ...groupCovers, [group]: url }; await saveMenuCover(id, null, next); setGroupCovers(next); }
    else { await saveMenuCover(id, url); setMenuCover(url); }
  }), [run, id, groupCovers]);
  const remove = useCallback((group?: string) => run(group ?? 'cover', async () => {
    if (group) { const next = { ...groupCovers }; delete next[group]; await saveMenuCover(id, null, next); setGroupCovers(next); }
    else { await saveMenuCover(id, null); setMenuCover(''); }
  }), [run, id, groupCovers]);
  const rename = useCallback((group: string) => run(group, async () => {
    const name = names[group]?.trim(); if (!name || name === group) return;
    await renameMenuGroup(id, group, name);
    if (groupCovers[group]) { const next = { ...groupCovers, [name]: groupCovers[group] }; delete next[group]; await saveMenuCover(id, null, next); }
    await loadGroups();
  }), [run, id, names, groupCovers, loadGroups]);
  return { mapsUrl, setMapsUrl, tags, setTags, menuCover, groupCovers, groups, names, setName: (group: string, name: string) => setNames(previous => ({ ...previous, [group]: name })), busy, error, notice, save, upload, remove, rename, loadGroups };
}
