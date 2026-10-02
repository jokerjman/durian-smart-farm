import { env } from "cloudflare:workers";
import { requireSession } from "@/lib/authz";

export async function GET(request: Request) {
  try {
    const s = await requireSession();
    if (
      s.role !== "admin" &&
      !s.permissions.includes("*") &&
      !s.permissions.includes("audit.view") &&
      !s.permissions.includes("users.manage")
    )
      throw new Response("ไม่มีสิทธิ์ดำเนินการ", { status: 403 });
    const query =
      new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
    const rows = query
      ? await env
          .DB!.prepare(
            `SELECT a.id,a.action,a.entity_type AS entityType,a.entity_id AS entityId,a.detail_json AS detailJson,a.created_at AS createdAt,u.name AS actorName,la.username FROM audit_logs a JOIN users u ON u.id=a.actor_id LEFT JOIN local_accounts la ON la.user_id=u.id WHERE a.farm_id=? AND (u.name LIKE ? OR la.username LIKE ? OR a.action LIKE ? OR a.entity_type LIKE ?) ORDER BY a.created_at DESC LIMIT 300`,
          )
          .bind(
            s.farmId,
            `%${query}%`,
            `%${query}%`,
            `%${query}%`,
            `%${query}%`,
          )
          .all()
      : await env
          .DB!.prepare(
            `SELECT a.id,a.action,a.entity_type AS entityType,a.entity_id AS entityId,a.detail_json AS detailJson,a.created_at AS createdAt,u.name AS actorName,la.username FROM audit_logs a JOIN users u ON u.id=a.actor_id LEFT JOIN local_accounts la ON la.user_id=u.id WHERE a.farm_id=? ORDER BY a.created_at DESC LIMIT 300`,
          )
          .bind(s.farmId)
          .all();
    return Response.json({ logs: rows.results || [] });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "โหลด Audit Log ไม่สำเร็จ" }, { status: 500 });
  }
}
