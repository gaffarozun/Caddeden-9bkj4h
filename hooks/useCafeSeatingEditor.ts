import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CafeTable, cafeCapacity, cafeGridColumns, cafeGridRows, makeCafeTable, saveCafeSeating } from '@/services/cafeSeatingService';
import { useCafeRoom } from './useCafeRoom';
import { useAuth } from './useAuth';
export function useCafeSeatingEditor(businessId: string) {
 const m = useCafeRoom(businessId, true); const { authUser } = useAuth();
 const [tables, setTables] = useState<CafeTable[]>([]); const [enabled, setEnabled] = useState(false); const [selected, setSelected] = useState('');
 const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [dirty, setDirty] = useState(false);
 const initialized = useRef(false); const generation = useRef(0); const lock = useRef(false);
 useEffect(() => { initialized.current = false; generation.current++; lock.current = false; setBusy(false); setTables([]); setSelected(''); setEnabled(false); setError(''); setNotice(''); setDirty(false); return () => { generation.current++; }; }, [businessId, authUser?.id]);
 useEffect(() => { if (m.room && !initialized.current) { setTables(m.room.tables ?? []); setEnabled(!!m.room.occupancy_enabled); initialized.current = true; } }, [m.room]);
 const table = tables.find(item => item.id === selected) ?? null;
 const changeEnabled = useCallback((value: boolean) => { setEnabled(value); setDirty(true); setNotice(''); }, []);
 const add = useCallback(() => { const next = makeCafeTable(tables); if (!next) { setError('En fazla 60 masa eklenebilir.'); return; } setTables(previous => [...previous, next]); setSelected(next.id); setDirty(true); setNotice(''); }, [tables]);
 const update = useCallback((patch: Partial<Pick<CafeTable, 'label' | 'seats'>>) => { setTables(previous => previous.map(item => item.id === selected ? { ...item, ...patch } : item)); setDirty(true); setNotice(''); }, [selected]);
 const move = useCallback((dx: number, dy: number) => {
  if (!table) return; const x = table.grid_x + dx; const y = table.grid_y + dy;
  if (x < 0 || x >= cafeGridColumns || y < 0 || y >= cafeGridRows) { setError('Masa planın sınırına ulaştı.'); return; }
  if (tables.some(item => item.id !== table.id && item.grid_x === x && item.grid_y === y)) { setError('Bu konumda başka masa var.'); return; }
  setTables(previous => previous.map(item => item.id === table.id ? { ...item, grid_x: x, grid_y: y } : item)); setDirty(true); setError(''); setNotice('');
 }, [table, tables]);
 const remove = useCallback(() => { setTables(previous => previous.filter(item => item.id !== selected)); setSelected(''); setDirty(true); setNotice(''); }, [selected]);
 const save = useCallback(async () => {
  if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice(''); const version = generation.current;
  try {
   if (!m.room) throw new Error('Masa ayarları henüz yüklenmedi. Bağlantınızı kontrol edip yeniden deneyin.');
   if (enabled && tables.length === 0) throw new Error('Gösterimi açmadan önce Masa ekle ile en az bir masa oluşturun.');
   await saveCafeSeating(businessId, enabled, tables); if (version === generation.current) { setDirty(false); setNotice('Masa planı ve gösterim tercihi kaydedildi.'); m.presence.invalidateRoom(); } }
  catch (reason) { if (version === generation.current) setError(reason instanceof Error ? reason.message : 'Masa planı kaydedilemedi.'); }
  finally { if (version === generation.current) { setBusy(false); lock.current = false; } }
 }, [businessId, enabled, tables, m.room, m.presence.invalidateRoom]);
 const capacity = useMemo(() => cafeCapacity(tables), [tables]);
 return { tables, enabled, selected, select: setSelected, table, busy, error: error || m.error, notice, dirty, ready: !!m.room, capacity, changeEnabled, add, update, move, remove, save };
}
