import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  id,
  now,
  permitPermission,
  requireSession,
} from "@/lib/authz";
const clean = (v: unknown, n = 180) =>
    String(v ?? "")
      .trim()
      .slice(0, n),
  num = (v: unknown) => Math.max(0, Number(v) || 0);

export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "harvest.manage");
    const batches = await env
      .DB!.prepare(
        `SELECT h.id,h.plot_id AS plotId,h.season_id AS seasonId,h.lot_code AS lotCode,h.variety,h.harvested_on AS harvestedOn,h.total_weight_kg AS totalWeightKg,h.fruit_count AS fruitCount,h.status,h.trace_key AS traceKey,p.name AS plotName,se.name AS seasonName,COALESCE((SELECT SUM(g.weight_kg) FROM harvest_grades g WHERE g.batch_id=h.id),0) AS gradedWeightKg,COALESCE((SELECT SUM(ps.weight_kg) FROM produce_sales ps WHERE ps.batch_id=h.id AND ps.status!='cancelled'),0) AS soldWeightKg,COALESCE((SELECT SUM(ps.total_amount) FROM produce_sales ps WHERE ps.batch_id=h.id AND ps.status!='cancelled'),0) AS salesAmount,(SELECT COUNT(*) FROM harvest_batch_trees bt WHERE bt.batch_id=h.id) AS treeCount FROM harvest_batches h LEFT JOIN plots p ON p.id=h.plot_id LEFT JOIN seasons se ON se.id=h.season_id WHERE h.farm_id=? ORDER BY h.harvested_on DESC,h.created_at DESC`,
      )
      .bind(s.farmId)
      .all();
    const grades = await env
      .DB!.prepare(
        `SELECT g.id,g.batch_id AS batchId,g.grade,g.weight_kg AS weightKg,g.fruit_count AS fruitCount,g.note FROM harvest_grades g JOIN harvest_batches h ON h.id=g.batch_id WHERE h.farm_id=? ORDER BY g.created_at`,
      )
      .bind(s.farmId)
      .all();
    const sales = await env
      .DB!.prepare(
        `SELECT ps.id,ps.batch_id AS batchId,ps.buyer_name AS buyerName,ps.weight_kg AS weightKg,ps.price_per_kg AS pricePerKg,ps.total_amount AS totalAmount,ps.delivery_on AS deliveryOn,ps.status,ps.transaction_id AS transactionId,h.lot_code AS lotCode FROM produce_sales ps JOIN harvest_batches h ON h.id=ps.batch_id WHERE h.farm_id=? ORDER BY COALESCE(ps.delivery_on,'' ) DESC,ps.created_at DESC`,
      )
      .bind(s.farmId)
      .all();
    const plots = await env
      .DB!.prepare("SELECT id,name FROM plots WHERE farm_id=? ORDER BY name")
      .bind(s.farmId)
      .all();
    const seasons = await env
      .DB!.prepare(
        "SELECT id,name,status FROM seasons WHERE farm_id=? ORDER BY start_date DESC",
      )
      .bind(s.farmId)
      .all();
    const trees = await env
      .DB!.prepare(
        `SELECT t.id,t.durian_id AS durianId,t.variety,p.id AS plotId,p.name AS plotName FROM trees t JOIN plots p ON p.id=t.plot_id WHERE p.farm_id=? AND t.status!='ตาย/โค่น' ORDER BY p.name,t.durian_id`,
      )
      .bind(s.farmId)
      .all();
    return Response.json({
      batches: batches.results || [],
      grades: grades.results || [],
      sales: sales.results || [],
      plots: plots.results || [],
      seasons: seasons.results || [],
      trees: trees.results || [],
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "โหลดข้อมูลผลผลิตไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const s = await requireSession();
    permitPermission(s, "harvest.manage");
    const b = (await req.json()) as Record<string, any>,
      action = clean(b.action, 30),
      ts = now();
    if (action === "create") {
      const variety = clean(b.variety, 100),
        weight = num(b.totalWeightKg ?? b.weight),
        fruitCount = Math.floor(num(b.fruitCount)),
        harvestedOn =
          clean(b.harvestedOn, 10) || new Date().toISOString().slice(0, 10),
        plotId = clean(b.plotId, 80) || null;
      if (!variety || weight <= 0)
        return Response.json(
          { error: "กรุณาระบุพันธุ์และน้ำหนักผลผลิต" },
          { status: 400 },
        );
      if (
        plotId &&
        !(await env
          .DB!.prepare("SELECT 1 FROM plots WHERE id=? AND farm_id=?")
          .bind(plotId, s.farmId)
          .first())
      )
        return Response.json({ error: "ไม่พบแปลงในสวนนี้" }, { status: 400 });
      let seasonId = clean(b.seasonId, 80) || null;
      if (
        seasonId &&
        !(await env
          .DB!.prepare("SELECT 1 FROM seasons WHERE id=? AND farm_id=?")
          .bind(seasonId, s.farmId)
          .first())
      )
        return Response.json({ error: "ไม่พบฤดูผลิต" }, { status: 400 });
      if (!seasonId)
        seasonId =
          (
            await env
              .DB!.prepare(
                "SELECT id FROM seasons WHERE farm_id=? AND status IN ('current','active','in_progress') ORDER BY start_date DESC LIMIT 1",
              )
              .bind(s.farmId)
              .first<{ id: string }>()
          )?.id || null;
      const treeIds = Array.isArray(b.treeIds)
        ? [
            ...new Set(
              b.treeIds.map((x: unknown) => clean(x, 80)).filter(Boolean),
            ),
          ].slice(0, 500)
        : [];
      for (const treeId of treeIds)
        if (
          !(await env
            .DB!.prepare(
              "SELECT 1 FROM trees t JOIN plots p ON p.id=t.plot_id WHERE t.id=? AND p.farm_id=? AND (? IS NULL OR p.id=?)",
            )
            .bind(treeId, s.farmId, plotId, plotId)
            .first())
        )
          return Response.json(
            { error: "มีต้นทุเรียนที่ไม่อยู่ในแปลงที่เลือก" },
            { status: 400 },
          );
      const batchId = id("harvest"),
        date = harvestedOn.replaceAll("-", "").slice(2),
        lotCode = `LOT-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        traceKey = crypto.randomUUID().replaceAll("-", "");
      const statements: D1PreparedStatement[] = [
        env
          .DB!.prepare(
            "INSERT INTO harvest_batches (id,farm_id,plot_id,season_id,lot_code,variety,harvested_on,total_weight_kg,fruit_count,status,trace_key,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            batchId,
            s.farmId,
            plotId,
            seasonId,
            lotCode,
            variety,
            harvestedOn,
            weight,
            fruitCount,
            "awaiting_grade",
            traceKey,
            s.userId,
            ts,
            ts,
          ),
        ...treeIds.map((treeId) =>
          env
            .DB!.prepare(
              "INSERT INTO harvest_batch_trees (id,batch_id,tree_id,weight_kg,fruit_count) VALUES (?,?,?,?,?)",
            )
            .bind(id("batch_tree"), batchId, treeId, null, null),
        ),
      ];
      await env.DB!.batch(statements);
      await audit(s, "create", "harvest_batch", batchId, {
        lotCode,
        plotId,
        seasonId,
        variety,
        weight,
        fruitCount,
        treeCount: treeIds.length,
      });
      return Response.json({ id: batchId, lotCode, traceKey }, { status: 201 });
    }
    if (action === "grade") {
      const batchId = clean(b.batchId, 80),
        items = Array.isArray(b.grades)
          ? b.grades
              .map((x: any) => ({
                grade: clean(x.grade, 50),
                weightKg: num(x.weightKg),
                fruitCount: Math.floor(num(x.fruitCount)),
                note: clean(x.note, 300),
              }))
              .filter((x: any) => x.grade && x.weightKg > 0)
              .slice(0, 20)
          : [];
      const batch = await env
        .DB!.prepare(
          "SELECT id,total_weight_kg AS totalWeightKg FROM harvest_batches WHERE id=? AND farm_id=?",
        )
        .bind(batchId, s.farmId)
        .first<{ id: string; totalWeightKg: number }>();
      if (!batch)
        return Response.json({ error: "ไม่พบรุ่นผลผลิต" }, { status: 404 });
      if (!items.length)
        return Response.json(
          { error: "กรุณาระบุผลการคัดเกรด" },
          { status: 400 },
        );
      const total = items.reduce((n: any, x: any) => n + x.weightKg, 0);
      if (
        new Set(items.map((x: any) => x.grade.toLowerCase())).size !==
        items.length
      )
        return Response.json({ error: "ชื่อเกรดซ้ำกัน" }, { status: 409 });
      if (total > Number(batch.totalWeightKg) + 0.001)
        return Response.json(
          { error: "น้ำหนักคัดเกรดรวมมากกว่าน้ำหนักรุ่นผลผลิต" },
          { status: 409 },
        );
      const soldWeight = Number(
        (
          await env
            .DB!.prepare(
              "SELECT COALESCE(SUM(weight_kg),0) AS weight FROM produce_sales WHERE batch_id=? AND status!='cancelled'",
            )
            .bind(batchId)
            .first<{ weight: number }>()
        )?.weight || 0,
      );
      if (total + 0.001 < soldWeight)
        return Response.json(
          { error: "น้ำหนักคัดเกรดรวมน้อยกว่าน้ำหนักที่ขายไปแล้ว" },
          { status: 409 },
        );
      const old = (
        await env
          .DB!.prepare("SELECT id FROM harvest_grades WHERE batch_id=?")
          .bind(batchId)
          .all<{ id: string }>()
      ).results;
      const statements: D1PreparedStatement[] = [
        ...old.map((x) =>
          env.DB!.prepare("DELETE FROM harvest_grades WHERE id=?").bind(x.id),
        ),
        ...items.map((x: any) =>
          env
            .DB!.prepare(
              "INSERT INTO harvest_grades (id,batch_id,grade,weight_kg,fruit_count,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
            )
            .bind(
              id("grade"),
              batchId,
              x.grade,
              x.weightKg,
              x.fruitCount || null,
              x.note || null,
              ts,
              ts,
            ),
        ),
        env
          .DB!.prepare(
            "UPDATE harvest_batches SET status=?,updated_at=? WHERE id=?",
          )
          .bind(
            total + 0.001 >= Number(batch.totalWeightKg)
              ? "ready_for_sale"
              : "graded",
            ts,
            batchId,
          ),
      ];
      await env.DB!.batch(statements);
      await audit(s, "grade", "harvest_batch", batchId, {
        total,
        grades: items,
      });
      return Response.json({ ok: true });
    }
    if (action === "sale") {
      const batchId = clean(b.batchId, 80),
        buyerName = clean(b.buyerName, 160),
        weightKg = num(b.weightKg),
        pricePerKg = num(b.pricePerKg),
        deliveryOn =
          clean(b.deliveryOn, 10) || new Date().toISOString().slice(0, 10);
      if (!buyerName || weightKg <= 0 || pricePerKg <= 0)
        return Response.json(
          { error: "กรุณาระบุผู้ซื้อ น้ำหนัก และราคาต่อกิโลกรัม" },
          { status: 400 },
        );
      const batch = await env
        .DB!.prepare(
          "SELECT id,lot_code AS lotCode,total_weight_kg AS totalWeightKg,plot_id AS plotId,season_id AS seasonId,COALESCE((SELECT SUM(weight_kg) FROM harvest_grades WHERE batch_id=harvest_batches.id),0) AS gradedWeightKg FROM harvest_batches WHERE id=? AND farm_id=?",
        )
        .bind(batchId, s.farmId)
        .first<{
          id: string;
          lotCode: string;
          totalWeightKg: number;
          plotId: string | null;
          seasonId: string | null;
          gradedWeightKg: number;
        }>();
      if (!batch)
        return Response.json({ error: "ไม่พบรุ่นผลผลิต" }, { status: 404 });
      const sold = Number(
        (
          await env
            .DB!.prepare(
              "SELECT COALESCE(SUM(weight_kg),0) AS weight FROM produce_sales WHERE batch_id=? AND status!='cancelled'",
            )
            .bind(batchId)
            .first<{ weight: number }>()
        )?.weight || 0,
      );
      if (Number(batch.gradedWeightKg) <= 0)
        return Response.json(
          { error: "กรุณาบันทึกการคัดเกรดก่อนขายผลผลิต" },
          { status: 409 },
        );
      if (sold + weightKg > Number(batch.gradedWeightKg) + 0.001)
        return Response.json(
          {
            error: `น้ำหนักขายเกินยอดคัดเกรดคงเหลือ (เหลือ ${(Number(batch.gradedWeightKg) - sold).toLocaleString("th-TH")} กก.)`,
          },
          { status: 409 },
        );
      const saleId = id("sale"),
        transactionId = id("txn"),
        categoryId = `produce_sales_${s.farmId}`,
        totalAmount = weightKg * pricePerKg,
        nextSold = sold + weightKg;
      await env.DB!.batch([
        env
          .DB!.prepare(
            "INSERT OR IGNORE INTO finance_categories (id,farm_id,type,name,is_system) VALUES (?,?,?,?,?)",
          )
          .bind(categoryId, s.farmId, "income", "ขายผลผลิต", 1),
        env
          .DB!.prepare(
            "INSERT INTO transactions (id,farm_id,plot_id,season_id,category_id,work_item_id,type,title,amount,occurred_on,receipt_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            transactionId,
            s.farmId,
            batch.plotId,
            batch.seasonId,
            categoryId,
            null,
            "income",
            `ขายทุเรียน ${batch.lotCode} · ${buyerName}`,
            totalAmount,
            deliveryOn,
            null,
            ts,
            ts,
          ),
        env
          .DB!.prepare(
            "INSERT INTO produce_sales (id,batch_id,buyer_name,weight_kg,price_per_kg,total_amount,delivery_on,status,transaction_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            saleId,
            batchId,
            buyerName,
            weightKg,
            pricePerKg,
            totalAmount,
            deliveryOn,
            "completed",
            transactionId,
            ts,
            ts,
          ),
        env
          .DB!.prepare(
            "UPDATE harvest_batches SET status=?,updated_at=? WHERE id=?",
          )
          .bind(
            nextSold + 0.001 >= Number(batch.gradedWeightKg)
              ? "sold_out"
              : "partially_sold",
            ts,
            batchId,
          ),
      ]);
      await audit(s, "create", "produce_sale", saleId, {
        batchId,
        buyerName,
        weightKg,
        pricePerKg,
        totalAmount,
        transactionId,
      });
      return Response.json(
        { id: saleId, transactionId, totalAmount },
        { status: 201 },
      );
    }
    return Response.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          { error: "บันทึกข้อมูลผลผลิตไม่สำเร็จ" },
          { status: 500 },
        );
  }
}
