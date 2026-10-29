import { createMemoryRateLimiter, type MemoryRateLimiter } from "./memory-rate-limit.ts";

/** One in-memory limiter per (route name, max, window). Pure, so it is unit-tested in tests/email-health.test.ts. */
const limiters = new Map<string, MemoryRateLimiter>();

export function limiterFor(name: string, max: number, windowMs: number): MemoryRateLimiter {
  const key = `${name}:${max}:${windowMs}`;
  let l = limiters.get(key);
  if (!l) {
    l = createMemoryRateLimiter({ max, windowMs });
    limiters.set(key, l);
  }
  return l;
}
