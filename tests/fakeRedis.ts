import { vi } from 'vitest';

/** Mini Redis en mémoire (API REST d'Upstash : POST d'une commande en JSON). */
export function installFakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();
  const real = globalThis.fetch;

  globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const [cmd, key, ...args] = JSON.parse(String(init?.body)) as string[];
    const hash = () => hashes.get(key) ?? hashes.set(key, new Map()).get(key)!;
    const set = () => sets.get(key) ?? sets.set(key, new Set()).get(key)!;
    let result: unknown = 'OK';
    switch (cmd) {
      case 'GET': result = strings.get(key) ?? null; break;
      case 'SET': strings.set(key, args[0]); break;
      case 'HSET': hash().set(args[0], args[1]); result = 1; break;
      case 'HGET': result = hashes.get(key)?.get(args[0]) ?? null; break;
      case 'HDEL': result = hashes.get(key)?.delete(args[0]) ? 1 : 0; break;
      case 'HGETALL': result = [...(hashes.get(key) ?? [])].flat(); break;
      case 'SADD': set().add(args[0]); result = 1; break;
      case 'SREM': sets.get(key)?.delete(args[0]); result = 1; break;
      case 'SMEMBERS': result = [...(sets.get(key) ?? [])]; break;
      default: throw new Error(`commande non gérée : ${cmd}`);
    }
    return Response.json({ result });
  }) as typeof fetch;

  return {
    strings,
    hashes,
    sets,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}
