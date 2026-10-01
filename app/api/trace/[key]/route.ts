import { env } from "cloudflare:workers";
const clean = (v: unknown, n = 100) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params,
      traceKey = clean(key);
    if (!traceKey)
      return Response.json({ error: "ไม่พบรหัสตรวจสอบ" }, { status: 404 });
    const batch = await env
      .DB!.prepare(
        `SELECT h.id,h.lot_code AS lotCode,h.variety,h.harvested_on AS harvestedOn,h.total_weight_kg AS totalWeightKg,h.fruit_count AS fruitCount,h.status,f.name AS farmName,f.address AS farmAddress,p.name AS plotName,se.name AS seasonName,(SELECT COUNT(*) FROM harvest_batch_trees bt WHERE bt.batch_id=h.id) AS treeCount FROM harvest_batches h JOIN farms f ON f.id=h.farm_id LEFT JOIN plots p ON p.id=h.plot_id LEFT JOIN seasons se ON se.id=h.season_id WHERE h.trace_key=?`,
      )
      .bind(traceKey)
      .first<any>();
    if (!batch)
      return Response.json({ error: "ไม่พบข้อมูลรุ่นผลผลิต" }, { status: 404 });
    const grades = await env
      .DB!.prepare(
        "SELECT grade,weight_kg AS weightKg,fruit_count AS fruitCount,note FROM harvest_grades WHERE batch_id=? ORDER BY created_at",
      )
      .bind(batch.id)
      .all();
    const trees = await env
      .DB!.prepare(
        `SELECT t.durian_id AS durianId,t.variety FROM harvest_batch_trees bt JOIN trees t ON t.id=bt.tree_id WHERE bt.batch_id=? ORDER BY t.durian_id LIMIT 100`,
      )
      .bind(batch.id)
      .all();
    const practices = await env
      .DB!.prepare(
        `SELECT w.title,w.work_type AS workType,w.completed_at AS completedAt,GROUP_CONCAT(DISTINCT m.product_name) AS products FROM work_items w LEFT JOIN work_material_plans m ON m.work_item_id=w.id WHERE w.farm_id=(SELECT farm_id FROM harvest_batches WHERE id=?) AND w.status='done' AND w.completed_at IS NOT NULL AND w.completed_at<=strftime('%s',(SELECT harvested_on||' 23:59:59' FROM harvest_batches WHERE id=?)) AND ((SELECT plot_id FROM harvest_batches WHERE id=?) IS NULL OR w.plot_id=(SELECT plot_id FROM harvest_batches WHERE id=?)) GROUP BY w.id ORDER BY w.completed_at DESC LIMIT 20`,
      )
      .bind(batch.id, batch.id, batch.id, batch.id)
      .all();
    return Response.json(
      {
        batch,
        grades: grades.results || [],
        trees: trees.results || [],
        practices: practices.results || [],
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return Response.json(
      { error: "โหลดข้อมูลตรวจสอบย้อนกลับไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
