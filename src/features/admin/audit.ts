import { headers } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditEventInput = {
  actorId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function writeAdminAuditEvent({
  actorId,
  eventType,
  entityType,
  entityId = null,
  summary,
  metadata = {},
}: AuditEventInput) {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
    const supabase = await createSupabaseServerClient();

    await supabase.from("admin_audit_events").insert({
      actor_id: actorId,
      entity_id: entityId,
      entity_type: entityType,
      event_type: eventType,
      ip_address:
        forwardedFor ||
        headerStore.get("x-real-ip") ||
        headerStore.get("cf-connecting-ip"),
      metadata,
      summary,
      user_agent: headerStore.get("user-agent"),
    });
  } catch {
    // Audit logging should never block the admin action it records.
  }
}
