import Redis from "ioredis";
import { config } from "./config";

const REDIS_URL = config.redisUrl || "redis://localhost:6379";
const REDIS_PROBE_INTERVAL_MS = 30_000;
const MEMORY_SWEEP_THRESHOLD = 10_000;

let client: Redis | null = null;
let lastProbeAt = 0;
let redisReachable = false;

function createClient(): Redis {
  const redis = new Redis(REDIS_URL, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  // Every command is wrapped by the callers; a dead Redis must never crash the
  // process through an unhandled "error" event.
  redis.on("error", () => {});
  return redis;
}

export function getRedisClient(): Redis {
  if (!client) client = createClient();
  return client;
}

function dropRedisClient(): void {
  client?.disconnect();
  client = null;
  redisReachable = false;
}

async function ensureConnected(redis: Redis): Promise<void> {
  if (redis.status === "ready") return;
  if (redis.status === "connecting" || redis.status === "connect") {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      const onClosed = () => reject(new Error("Redis connection closed before ready"));
      redis.once("ready", onReady);
      redis.once("close", onClosed);
      redis.once("end", onClosed);
    });
    return;
  }
  await redis.connect();
}

export async function isRedisUp(): Promise<boolean> {
  const now = Date.now();
  if (now - lastProbeAt < REDIS_PROBE_INTERVAL_MS) return redisReachable;
  lastProbeAt = now;
  try {
    const redis = getRedisClient();
    await ensureConnected(redis);
    await redis.ping();
    redisReachable = true;
  } catch {
    dropRedisClient();
    redisReachable = false;
  }
  return redisReachable;
}

export function closeRedis(): void {
  dropRedisClient();
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlMs?: number): Promise<number>;
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

class RedisBackedKeyValueStore implements KeyValueStore {
  private readonly memory = new Map<string, MemoryEntry>();
  private nextRedisAttemptAt = 0;

  async get(key: string): Promise<string | null> {
    return this.runOnRedis((redis) => redis.get(key), () => this.memoryGet(key));
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (ttlMs === undefined) {
      await this.runOnRedis(
        async (redis) => {
          await redis.set(key, value);
        },
        () => this.memorySet(key, value),
      );
      return;
    }
    await this.runOnRedis(
      async (redis) => {
        await redis.set(key, value, "PX", ttlMs);
      },
      () => this.memorySet(key, value, ttlMs),
    );
  }

  async del(key: string): Promise<void> {
    await this.runOnRedis(
      async (redis) => {
        await redis.del(key);
      },
      () => {
        this.memory.delete(key);
      },
    );
  }

  async incr(key: string, ttlMs?: number): Promise<number> {
    return this.runOnRedis(
      async (redis) => {
        const count = await redis.incr(key);
        if (count === 1 && ttlMs !== undefined) await redis.pexpire(key, ttlMs);
        return count;
      },
      () => this.memoryIncr(key, ttlMs),
    );
  }

  private async runOnRedis<T>(op: (redis: Redis) => Promise<T>, fallback: () => T): Promise<T> {
    const now = Date.now();
    if (now < this.nextRedisAttemptAt) return fallback();
    try {
      const redis = getRedisClient();
      await ensureConnected(redis);
      return await op(redis);
    } catch {
      this.nextRedisAttemptAt = now + REDIS_PROBE_INTERVAL_MS;
      dropRedisClient();
      console.warn("[redis] Unreachable — falling back to in-memory state for this process");
      return fallback();
    }
  }

  private memoryGet(key: string): string | null {
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private memorySet(key: string, value: string, ttlMs?: number): void {
    this.memory.set(key, { value, expiresAt: ttlMs === undefined ? Infinity : Date.now() + ttlMs });
    this.sweepMemory();
  }

  private memoryIncr(key: string, ttlMs?: number): number {
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt < now) {
      this.memory.set(key, { value: "1", expiresAt: ttlMs === undefined ? Infinity : now + ttlMs });
      this.sweepMemory();
      return 1;
    }
    const count = Number(entry.value) + 1;
    entry.value = String(count);
    return count;
  }

  private sweepMemory(): void {
    if (this.memory.size <= MEMORY_SWEEP_THRESHOLD) return;
    const now = Date.now();
    for (const [key, entry] of this.memory) {
      if (entry.expiresAt < now) this.memory.delete(key);
    }
  }
}

let stateStore: KeyValueStore | null = null;

export function getStateStore(): KeyValueStore {
  if (!stateStore) stateStore = new RedisBackedKeyValueStore();
  return stateStore;
}