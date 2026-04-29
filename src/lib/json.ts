export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_key, item) => {
    if (item instanceof Date) {
      return item.toISOString();
    }

    if (typeof item === 'object' && item !== null) {
      if (seen.has(item)) {
        return '[Circular]';
      }
      seen.add(item);
    }

    if (typeof item === 'function') {
      return undefined;
    }

    return item;
  });
}
