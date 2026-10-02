import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  id,
  now,
  permitPermission,
  requireSession,
} from "@/lib/authz";

const clean = (value: unknown, max = 300) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

export async function GET(request: Request) {
  try {
    const s = await requireSession();
    permitPermission(s, "reports.view");
    const seasonId = clean(
      new URL(request.url).searchParams.get("seasonId"),
      80,
    );
    if (
      seasonId &&
      !(await env
        .DB!.prepare("SELECT 1 FROM seasons WHERE id=? AND farm_id=?")
        .bind(seasonId, s.farmId)
        .first())
    )
      return Response.json({ error: "ไม่พบฤดูผลิต" }, { status: 404 });
    const transactionFilter = seasonId ? " AND t.season_id=?" : "";
    const harvestFilter = seasonId ? " AND h.season_id=?" : "";
    const bind = <T extends D1PreparedStatement>(statement: T) =>
      seasonId ? statement.bind(s.farmId, seasonId) : statement.bind(s.farmId);
    const [
      seasons,
      summary,
      categories,
      plots,
      months,
      harvest,
      sales,
      farm,
      assessments,
    ] = await Promise.all([
      env
        .DB!.prepare(
          "SELECT id,name,status,start_date AS startDate,end_date AS endDate,target_kg AS targetKg,budget,actual_kg AS actualKg FROM seasons WHERE farm_id=? ORDER BY start_date DESC",
        )
        .bind(s.farmId)
        .all(),
      bind(
        env.DB!.prepare(
          `SELECT COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) AS expense,COUNT(*) AS transactionCount,COALESCE(SUM(CASE WHEN t.type='expense' AND t.plot_id IS NULL THEN t.amount ELSE 0 END),0) AS unallocatedExpense FROM transactions t WHERE t.farm_id=?${transactionFilter}`,
        ),
      ).first(),
      bind(
        env.DB!.prepare(
          `SELECT c.name,t.type,COALESCE(SUM(t.amount),0) AS amount,COUNT(*) AS itemCount FROM transactions t JOIN finance_categories c ON c.id=t.category_id WHERE t.farm_id=?${transactionFilter} GROUP BY c.name,t.type ORDER BY amount DESC`,
        ),
      ).all(),
      bind(
        env.DB!.prepare(
          `SELECT COALESCE(p.id,'') AS plotId,COALESCE(p.name,'ยังไม่ระบุแปลง') AS plotName,COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) AS expense FROM transactions t LEFT JOIN plots p ON p.id=t.plot_id WHERE t.farm_id=?${transactionFilter} GROUP BY p.id,p.name ORDER BY expense DESC`,
        ),
      ).all(),
      bind(
        env.DB!.prepare(
          `SELECT substr(t.occurred_on,1,7) AS month,COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) AS expense FROM transactions t WHERE t.farm_id=?${transactionFilter} GROUP BY substr(t.occurred_on,1,7) ORDER BY month`,
        ),
      ).all(),
      bind(
        env.DB!.prepare(
          `SELECT COALESCE(SUM(h.total_weight_kg),0) AS harvestedKg,COALESCE(SUM(h.fruit_count),0) AS fruitCount,COUNT(*) AS batchCount FROM harvest_batches h WHERE h.farm_id=?${harvestFilter}`,
        ),
      ).first(),
      bind(
        env.DB!.prepare(
          `SELECT COALESCE(SUM(ps.weight_kg),0) AS soldKg,COALESCE(SUM(ps.total_amount),0) AS salesAmount,CASE WHEN COALESCE(SUM(ps.weight_kg),0)>0 THEN SUM(ps.total_amount)/SUM(ps.weight_kg) ELSE 0 END AS averagePrice FROM produce_sales ps JOIN harvest_batches h ON h.id=ps.batch_id WHERE h.farm_id=? AND ps.status!='cancelled'${harvestFilter}`,
        ),
      ).first(),
      env
        .DB!.prepare(
          `SELECT f.id,f.name,COALESCE(f.area_rai,0) AS areaRai,(SELECT COUNT(*) FROM plots p WHERE p.farm_id=f.id) AS plotCount,(SELECT COUNT(*) FROM trees t JOIN plots p ON p.id=t.plot_id WHERE p.farm_id=f.id AND t.status!='ตาย/โค่น') AS treeCount FROM farms f WHERE f.id=?`,
        )
        .bind(s.farmId)
        .first(),
      seasonId
        ? env
            .DB!.prepare(
              `SELECT g.id,g.season_id AS seasonId,g.item_key AS itemKey,g.status,g.note,g.evidence_key AS evidenceKey,g.reviewed_at AS reviewedAt,u.name AS reviewerName FROM gap_assessments g JOIN users u ON u.id=g.reviewed_by WHERE g.farm_id=? AND g.season_id=? ORDER BY g.item_key`,
            )
            .bind(s.farmId, seasonId)
            .all()
        : env
            .DB!.prepare(
              `SELECT g.id,g.season_id AS seasonId,g.item_key AS itemKey,g.status,g.note,g.evidence_key AS evidenceKey,g.reviewed_at AS reviewedAt,u.name AS reviewerName FROM gap_assessments g JOIN users u ON u.id=g.reviewed_by WHERE g.farm_id=? AND g.season_id IS NULL ORDER BY g.item_key`,
            )
            .bind(s.farmId)
            .all(),
    ]);
    return Response.json({
      selectedSeasonId: seasonId,
      seasons: seasons.results || [],
      summary: summary || {
        income: 0,
        expense: 0,
        transactionCount: 0,
        unallocatedExpense: 0,
      },
      categories: categories.results || [],
      plots: plots.results || [],
      months: months.results || [],
      harvest: harvest || { harvestedKg: 0, fruitCount: 0, batchCount: 0 },
      sales: sales || { soldKg: 0, salesAmount: 0, averagePrice: 0 },
      farm,
      assessments: assessments.results || [],
    });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "โหลดรายงานไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await requireSession();
    permitPermission(s, "reports.view");
    const body = (await request.json()) as Record<string, unknown>;
    const seasonId = clean(body.seasonId, 80) || null,
      itemKey = clean(body.itemKey, 80),
      status = clean(body.status, 30),
      note = clean(body.note, 1500) || null,
      evidenceKey = clean(body.evidenceKey, 500_000) || null,
      ts = now();
    if (!itemKey || !["pending", "pass", "action", "na"].includes(status))
      return Response.json(
        { error: "ข้อมูลประเมิน GAP ไม่ถูกต้อง" },
        { status: 400 },
      );
    if (
      seasonId &&
      !(await env
        .DB!.prepare("SELECT 1 FROM seasons WHERE id=? AND farm_id=?")
        .bind(seasonId, s.farmId)
        .first())
    )
      return Response.json({ error: "ไม่พบฤดูผลิต" }, { status: 404 });
    if (
      evidenceKey &&
      (!/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(
        evidenceKey,
      ) ||
        evidenceKey.length > 470_000)
    )
      return Response.json(
        { error: "หลักฐานต้องเป็น JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 350 KB" },
        { status: 400 },
      );
    const existing = seasonId
      ? await env
          .DB!.prepare(
            "SELECT id FROM gap_assessments WHERE farm_id=? AND season_id=? AND item_key=?",
          )
          .bind(s.farmId, seasonId, itemKey)
          .first<{ id: string }>()
      : await env
          .DB!.prepare(
            "SELECT id FROM gap_assessments WHERE farm_id=? AND season_id IS NULL AND item_key=?",
          )
          .bind(s.farmId, itemKey)
          .first<{ id: string }>();
    const assessmentId = existing?.id || id("gap");
    if (existing)
      await env
        .DB!.prepare(
          "UPDATE gap_assessments SET status=?,note=?,evidence_key=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND farm_id=?",
        )
        .bind(
          status,
          note,
          evidenceKey,
          s.userId,
          ts,
          ts,
          assessmentId,
          s.farmId,
        )
        .run();
    else
      await env
        .DB!.prepare(
          "INSERT INTO gap_assessments (id,farm_id,season_id,item_key,status,note,evidence_key,reviewed_by,reviewed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          assessmentId,
          s.farmId,
          seasonId,
          itemKey,
          status,
          note,
          evidenceKey,
          s.userId,
          ts,
          ts,
          ts,
        )
        .run();
    await audit(
      s,
      existing ? "update" : "create",
      "gap_assessment",
      assessmentId,
      { seasonId, itemKey, status, hasEvidence: !!evidenceKey },
    );
    return Response.json({ id: assessmentId, saved: true });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json(
          { error: "บันทึกผลประเมิน GAP ไม่สำเร็จ" },
          { status: 500 },
        );
  }
}
