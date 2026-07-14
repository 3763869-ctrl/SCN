export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  upstashRedisRestToken:
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "",
  upstashRedisRestUrl:
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "",
};

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
