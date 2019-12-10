interface CacheKeyData {
  audience: string;
  scope: string;
}

interface DecodedToken {
  claims: IdToken;
  user: any;
}

interface CacheEntry {
  id_token: string;
  access_token: string;
  expires_in: number;
  decodedToken: DecodedToken;
  audience: string;
  scope: string;
}

interface CachedTokens {
  [key: string]: CacheEntry;
}

export interface ICache {
  save(entry: CacheEntry): void;
  get(key: CacheKeyData): CacheEntry;
  clear(): void;
}

const createKey = (e: CacheKeyData) => `${e.audience}::${e.scope}`;

const getExpirationTimeoutInMilliseconds = (expiresIn: number, exp: number) => {
  const expTime =
    (new Date(exp * 1000).getTime() - new Date().getTime()) / 1000;
  return Math.min(expiresIn, expTime) * 1000 * 0.8;
};

export class LocalStorageCache implements ICache {
  public save(entry: CacheEntry): void {
    const cacheKey = `@@auth0@@${createKey(entry)}`;
    const expiresInTime = Math.floor(Date.now() / 1000) + entry.expires_in;

    const expirySeconds =
      Math.min(expiresInTime, entry.decodedToken.claims.exp) - 60; // take off a small leeway

    const payload = {
      body: entry,
      expiresAt: expirySeconds
    };

    const timeout = getExpirationTimeoutInMilliseconds(
      entry.expires_in,
      entry.decodedToken.claims.exp
    );

    setTimeout(() => {
      window.localStorage.removeItem(cacheKey);
    }, timeout);

    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  }

  public get(key: CacheKeyData): CacheEntry {
    const cacheKey = `@@auth0@@${createKey(key)}`;
    const json = window.localStorage.getItem(cacheKey);
    let payload;

    if (!json) return;

    payload = JSON.parse(json);

    if (!payload) return;

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.expiresAt < nowSeconds) {
      window.localStorage.removeItem(cacheKey);
      return;
    }

    return payload.body;
  }

  public clear() {
    const keysToDelete = [];

    for (var i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i).startsWith('@@auth0@@')) {
        keysToDelete.push(localStorage.key(i));
      }
    }

    for (var key of keysToDelete) {
      localStorage.removeItem(key);
    }
  }
}

export class InMemoryCache implements ICache {
  cache: CachedTokens = {};

  public save(entry: CacheEntry) {
    const key = createKey(entry);
    this.cache[key] = entry;

    const timeout = getExpirationTimeoutInMilliseconds(
      entry.expires_in,
      entry.decodedToken.claims.exp
    );

    setTimeout(() => {
      delete this.cache[key];
    }, timeout);
  }

  public get(key: CacheKeyData) {
    return this.cache[createKey(key)];
  }

  public clear() {
    this.cache = {};
  }
}
