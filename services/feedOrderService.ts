// Viewer-local ordering only; never changes publication, pricing or permissions.
export interface FeedIdentity { id: string }
export function shuffleFeed<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let position = result.length - 1; position > 0; position -= 1) {
    const sample = random();
    const target = Number.isFinite(sample) ? Math.min(position, Math.max(0, Math.floor(sample * (position + 1)))) : 0;
    [result[position], result[target]] = [result[target], result[position]];
  }
  return result;
}
// Keep the viewer's random order during polling. Refresh content/remove expired rows;
// insert new rows at random positions rather than always showing newest/sponsored first.
export function reconcileFeedOrder<T extends FeedIdentity>(previous: readonly T[], incoming: readonly T[], random: () => number = Math.random): T[] {
  const latest = new Map(incoming.map(item => [item.id, item]));
  const result: T[] = [];
  for (const item of previous) {
    const updated = latest.get(item.id);
    if (updated) { result.push(updated); latest.delete(item.id); }
  }
  for (const item of shuffleFeed(Array.from(latest.values()), random)) {
    const sample = random();
    const target = Number.isFinite(sample) ? Math.min(result.length, Math.max(0, Math.floor(sample * (result.length + 1)))) : 0;
    result.splice(target, 0, item);
  }
  return result;
}
