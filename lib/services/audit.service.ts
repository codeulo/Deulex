import { supabaseAdmin } from "@/lib/supabase/admin";

export interface AuditLogParams {
  user_id: string | null;
  event_type: string;
  event_category:
    | "auth"
    | "wallet"
    | "trade"
    | "payment"
    | "bills"
    | "withdrawal"
    | "admin"
    | "fiat_transactions"
    | "security";
  severity: "info" | "warning" | "critical";
  ip_address?: string | null;
  user_agent?: string | null;
  event_data?: Record<string, any>;
  metadata?: Record<string, any>;
}

// export async function logAuditEvent(params: AuditLogParams): Promise<void> {
//   try {
//     await supabaseAdmin.from("audit_logs").insert({
//       user_id: params.user_id,
//       event_type: params.event_type,
//       event_category: params.event_category,
//       severity: params.severity,
//       ip_address: params.ip_address,
//       user_agent: params.user_agent,
//       event_data: params.event_data || {},
//       metadata: params.metadata || {},
//       created_at: new Date().toISOString(),
//     });
//   } catch (error) {
//     // Log to console if database logging fails
//     console.error("Failed to log audit event:", error);
//     console.error("Audit event details:", params);
//   }
// }

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: params.user_id,
      event_type: params.event_type,
      event_category: params.event_category,
      severity: params.severity,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      event_data: params.event_data || {},
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("Audit log insert failed:", error.message);
    }
  } catch (err) {
    console.warn("Audit log failed (catch):", err);
  }
}

export async function getAuditLogs(params: {
  userId?: string;
  eventCategory?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }

  if (params.eventCategory) {
    query = query.eq("event_category", params.eventCategory);
  }

  if (params.severity) {
    query = query.eq("severity", params.severity);
  }

  if (params.startDate) {
    query = query.gte("created_at", params.startDate);
  }

  if (params.endDate) {
    query = query.lte("created_at", params.endDate);
  }

  const limit = params.limit || 100;
  const offset = params.offset || 0;

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return data;
}
