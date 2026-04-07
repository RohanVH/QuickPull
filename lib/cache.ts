type CacheRecord<T> = {
  value: T;
  expiresAt: number;
};

class MemoryCache {
  private records = new Map<string, CacheRecord<unknown>>();

  get<T>(key: string) {
    const entry = this.records.get(key) as CacheRecord<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.records.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlSeconds: number) {
    this.records.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }
}

export const cache = new MemoryCache();
