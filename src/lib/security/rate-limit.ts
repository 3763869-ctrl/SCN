import { headers } from "next/headers";

import { env } from "@/lib/env";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

const memoryStore = new Map<string, { count: number; resetAt: number }>();

export async function getClientIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    forwardedFor ||
    headerStore.get("x-real-ip") ||
    headerStore.get("cf-connecting-ip") ||
    "unknown"
  );
}

function parseUpstashNumber(text: string) {
  try {
    const parsed = JSON.parse(text) as { result?: unknown };
    return Number(parsed.result ?? parsed);
  } catch {
    return Number(text);
  }
}

async function upstashCommand(command: string[]) {
  const response = await fetch(env.upstashRedisRestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.upstashRedisRestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Rate limit store unavailable");
  }

  return parseUpstashNumber(await response.text());
}

async function redisRateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const redisKey = `rm-support:rate-limit:${key}`;
  const count = await upstashCommand(["INCR", redisKey]);

  if (count === 1) {
    await upstashCommand(["EXPIRE", redisKey, String(windowSeconds)]);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(Date.now() + windowSeconds * 1000),
  };
}

function memoryRateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(resetAt),
    };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: new Date(current.resetAt),
  };
}

export async function checkRateLimit(options: RateLimitOptions) {
  if (env.upstashRedisRestUrl && env.upstashRedisRestToken) {
    try {
      return await redisRateLimit(options);
    } catch {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + options.windowSeconds * 1000),
      };
    }
  }

  return memoryRateLimit(options);
}
