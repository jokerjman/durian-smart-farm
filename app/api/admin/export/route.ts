import { env } from "cloudflare:workers";
import { audit, permitPermission, requireSession } from "@/lib/authz";

export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "users.manage");
    const query = async (sql: string) =>
      (await env.DB!.prepare(sql).bind(s.farmId).all()).results || [];
    const [
      farm,
      settings,
      members,
      permissions,
      plots,
      seasons,
      stages,
      trees,
      treeEvents,
      workItems,
      workMaterials,
      categories,
      transactions,
      workers,
      labor,
      products,
      lots,
      movements,
      purchases,
      purchaseLines,
      devices,
      readings,
      observations,
      alerts,
      harvests,
      harvestTrees,
      grades,
      sales,
      gap,
      auditLogs,
    ] = await Promise.all([
      query("SELECT * FROM farms WHERE id=?"),
      query("SELECT * FROM farm_settings WHERE farm_id=?"),
      query(
        `SELECT u.id,u.name,la.username,la.is_active AS is_active,la.last_login_at AS last_login_at,fm.role,fm.plot_scope_id FROM farm_members fm JOIN users u ON u.id=fm.user_id LEFT JOIN local_accounts la ON la.user_id=u.id WHERE fm.farm_id=?`,
      ),
      query(
        "SELECT user_id,permission_key,allowed FROM user_permissions WHERE farm_id=?",
      ),
      query("SELECT * FROM plots WHERE farm_id=?"),
      query("SELECT * FROM seasons WHERE farm_id=?"),
      query(
        "SELECT ss.* FROM season_stages ss JOIN seasons s ON s.id=ss.season_id WHERE s.farm_id=?",
      ),
      query(
        "SELECT t.* FROM trees t JOIN plots p ON p.id=t.plot_id WHERE p.farm_id=?",
      ),
      query(
        "SELECT te.* FROM tree_events te JOIN trees t ON t.id=te.tree_id JOIN plots p ON p.id=t.plot_id WHERE p.farm_id=?",
      ),
      query("SELECT * FROM work_items WHERE farm_id=?"),
      query(
        "SELECT wm.* FROM work_material_plans wm JOIN work_items w ON w.id=wm.work_item_id WHERE w.farm_id=?",
      ),
      query(
        "SELECT * FROM finance_categories WHERE farm_id=? OR farm_id IS NULL",
      ),
      query("SELECT * FROM transactions WHERE farm_id=?"),
      query("SELECT * FROM workers WHERE farm_id=?"),
      query(
        "SELECT l.* FROM labor_entries l JOIN workers w ON w.id=l.worker_id WHERE w.farm_id=?",
      ),
      query("SELECT * FROM products WHERE farm_id=?"),
      query(
        "SELECT sl.* FROM stock_lots sl JOIN products p ON p.id=sl.product_id WHERE p.farm_id=?",
      ),
      query(
        "SELECT sm.* FROM stock_movements sm JOIN stock_lots sl ON sl.id=sm.lot_id JOIN products p ON p.id=sl.product_id WHERE p.farm_id=?",
      ),
      query("SELECT * FROM purchase_receipts WHERE farm_id=?"),
      query(
        "SELECT pl.* FROM purchase_lines pl JOIN purchase_receipts pr ON pr.id=pl.purchase_id WHERE pr.farm_id=?",
      ),
      query("SELECT * FROM sensor_devices WHERE farm_id=?"),
      query(
        "SELECT sr.* FROM sensor_readings sr JOIN sensor_devices sd ON sd.id=sr.device_id WHERE sd.farm_id=?",
      ),
      query("SELECT * FROM plant_health_observations WHERE farm_id=?"),
      query("SELECT * FROM smart_alerts WHERE farm_id=?"),
      query("SELECT * FROM harvest_batches WHERE farm_id=?"),
      query(
        "SELECT ht.* FROM harvest_batch_trees ht JOIN harvest_batches h ON h.id=ht.batch_id WHERE h.farm_id=?",
      ),
      query(
        "SELECT hg.* FROM harvest_grades hg JOIN harvest_batches h ON h.id=hg.batch_id WHERE h.farm_id=?",
      ),
      query(
        "SELECT ps.* FROM produce_sales ps JOIN harvest_batches h ON h.id=ps.batch_id WHERE h.farm_id=?",
      ),
      query("SELECT * FROM gap_assessments WHERE farm_id=?"),
      query(
        "SELECT * FROM audit_logs WHERE farm_id=? ORDER BY created_at DESC",
      ),
    ]);
    const exportedAt = new Date().toISOString();
    const payload = {
      format: "durian-smart-farm-backup",
      version: 1,
      exportedAt,
      farm,
      settings,
      members,
      permissions,
      plots,
      seasons,
      stages,
      trees,
      treeEvents,
      workItems,
      workMaterials,
      categories,
      transactions,
      workers,
      labor,
      products,
      lots,
      movements,
      purchases,
      purchaseLines,
      devices,
      readings,
      observations,
      alerts,
      harvests,
      harvestTrees,
      grades,
      sales,
      gap,
      auditLogs,
    };
    await audit(s, "export", "farm_backup", s.farmId, { exportedAt });
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="durian-smart-farm-backup-${exportedAt.slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "ส่งออกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
