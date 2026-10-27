// Bound foreground waits without leaking timers. The original request is still handled on settlement.
export async function withRequestTimeout<T>(request: PromiseLike<T>, message: string, milliseconds = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
