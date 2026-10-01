import { env } from "cloudflare:workers";
import { assertSameOrigin, audit, id, now, requireSession } from "@/lib/authz";

const clean = (value: unknown, max = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const may = (s: { role: string; permissions: string[] }, key: string) =>
  s.role === "admin" ||
  s.permissions.includes("*") ||
  s.permissions.includes(key);
const scheduled = (value: unknown) => {
  if (typeof value === "number") return Math.floor(value);
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : now();
};

export async function GET() {
  try {
    const s = await requireSession();
    if (!may(s, "work.view") && !may(s, "work.manage"))
      throw new Response("ไม่มีสิทธิ์ดำเนินการ", { status: 403 });
    const tasks = await env
      .DB!.prepare(
        `SELECT w.id,w.farm_id AS farmId,w.plot_id AS plotId,w.season_id AS seasonId,w.title,w.description,w.work_type AS workType,w.priority,w.status,w.scheduled_at AS scheduledAt,w.completed_at AS completedAt,w.assignee_id AS assigneeId,w.tank_liters AS tankLiters,w.tank_count AS tankCount,w.actual_tank_count AS actualTankCount,p.name AS plotName,u.name AS assigneeName,se.name AS seasonName
   FROM work_items w LEFT JOIN plots p ON p.id=w.plot_id LEFT JOIN users u ON u.id=w.assignee_id LEFT JOIN seasons se ON se.id=w.season_id
   JOIN farm_members access ON access.farm_id=w.farm_id AND access.user_id=? AND access.status='active'
   ORDER BY CASE w.status WHEN 'planned' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,w.scheduled_at DESC`,
      )
      .bind(s.userId)
      .all();
    const taskIds = (tasks.results || []).map((x: any) => x.id);
    let materials: any[] = [];
    if (taskIds.length) {
      const marks = taskIds.map(() => "?").join(",");
      materials =
        (
          await env
            .DB!.prepare(
              `SELECT id,work_item_id AS workItemId,product_name AS productName,product_kind AS productKind,brand,common_name AS commonName,rate_per_200l AS ratePer200l,rate_unit AS rateUnit,tank_count AS tankCount,planned_quantity AS plannedQuantity,actual_quantity AS actualQuantity,stock_product_id AS stockProductId FROM work_material_plans WHERE work_item_id IN (${marks}) ORDER BY created_at`,
            )
            .bind(...taskIds)
            .all()
        ).results || [];
    }
    const plots = await env
      .DB!.prepare(
        "SELECT p.id,p.name,p.farm_id AS farmId,f.name AS farmName FROM plots p JOIN farms f ON f.id=p.farm_id JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active' ORDER BY f.name,p.name",
      )
      .bind(s.userId)
      .all();
    const members = await env
      .DB!.prepare(
        "SELECT DISTINCT u.id,u.name FROM users u JOIN farm_members fm ON fm.user_id=u.id JOIN farm_members access ON access.farm_id=fm.farm_id AND access.user_id=? AND access.status='active' JOIN local_accounts a ON a.user_id=u.id AND a.is_active=1 WHERE fm.status='active' ORDER BY u.name",
      )
      .bind(s.userId)
      .all();
    const seasons = await env
      .DB!.prepare(
        "SELECT se.id,se.farm_id AS farmId,se.name FROM seasons se JOIN farm_members fm ON fm.farm_id=se.farm_id AND fm.user_id=? AND fm.status='active' WHERE se.status IN ('current','active','in_progress')",
      )
      .bind(s.userId)
      .all();
    const settings = await env
      .DB!.prepare(
        "SELECT default_tank_liters AS defaultTankLiters FROM farm_settings WHERE farm_id=?",
      )
      .bind(s.farmId)
      .first();
    const products = await env
      .DB!.prepare(
        `SELECT p.id,p.sku,p.name,p.kind,p.brand,p.common_name AS commonName,p.default_rate_per_200l AS defaultRatePer200l,p.rate_unit AS rateUnit,p.unit,COALESCE(SUM(l.remaining_qty),0) AS stock FROM products p LEFT JOIN stock_lots l ON l.product_id=p.id WHERE p.farm_id=? AND p.active=1 GROUP BY p.id ORDER BY p.name`,
      )
      .bind(s.farmId)
      .all();
    return Response.json({
      tasks: tasks.results || [],
      materials,
      plots: plots.results || [],
      members: members.results || [],
      seasons: seasons.results || [],
      products: products.results || [],
      defaultTankLiters: Number((settings as any)?.defaultTankLiters || 200),
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "โหลดข้อมูลงานไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const s = await requireSession();
    if (!may(s, "work.manage"))
      throw new Response("ไม่มีสิทธิ์สร้างหรือมอบหมายงาน", { status: 403 });
    const b = (await req.json()) as Record<string, any>,
      title = clean(b.title, 160),
      farmId = clean(b.farmId || s.farmId, 80),
      plotId = clean(b.plotId, 80) || null;
    if (!title)
      return Response.json({ error: "กรุณาระบุชื่องาน" }, { status: 400 });
    if (
      !(await env
        .DB!.prepare(
          "SELECT 1 FROM farm_members WHERE farm_id=? AND user_id=? AND status='active'",
        )
        .bind(farmId, s.userId)
        .first())
    )
      return Response.json({ error: "ไม่มีสิทธิ์ในสวนนี้" }, { status: 403 });
    if (
      plotId &&
      !(await env
        .DB!.prepare("SELECT 1 FROM plots WHERE id=? AND farm_id=?")
        .bind(plotId, farmId)
        .first())
    )
      return Response.json(
        { error: "แปลงไม่อยู่ในสวนที่เลือก" },
        { status: 400 },
      );
    const materials = Array.isArray(b.materials)
      ? b.materials
          .filter(
            (x: any) =>
              clean(x.productName || x.name, 120) &&
              Number(x.ratePer200l ?? x.rate) > 0,
          )
          .slice(0, 30)
      : [];
    if (materials.length && !may(s, "spray_formula.manage"))
      throw new Response("ไม่มีสิทธิ์กำหนดสูตรพ่น", { status: 403 });
    const assigneeId = clean(b.assigneeId, 80) || null;
    if (
      assigneeId &&
      !(await env
        .DB!.prepare(
          "SELECT 1 FROM farm_members WHERE farm_id=? AND user_id=? AND status='active'",
        )
        .bind(farmId, assigneeId)
        .first())
    )
      return Response.json(
        { error: "ผู้รับผิดชอบไม่ได้อยู่ในสวนนี้" },
        { status: 400 },
      );
    let seasonId = clean(b.seasonId, 80) || null;
    if (!seasonId)
      seasonId =
        (
          await env
            .DB!.prepare(
              "SELECT id FROM seasons WHERE farm_id=? AND status IN ('current','active','in_progress') ORDER BY start_date DESC LIMIT 1",
            )
            .bind(farmId)
            .first<{ id: string }>()
        )?.id || null;
    const ts = now(),
      taskId = id("work"),
      tankLiters = Math.max(1, Number(b.tankLiters) || 200),
      tankCount = Math.max(0, Number(b.tankCount) || 0),
      workType = clean(b.workType, 50) || "general";
    const statements = [
      env
        .DB!.prepare(
          "INSERT INTO work_items (id,farm_id,plot_id,tree_id,season_id,title,description,work_type,priority,status,scheduled_at,completed_at,assignee_id,created_by,tank_liters,tank_count,actual_tank_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          taskId,
          farmId,
          plotId,
          null,
          seasonId,
          title,
          clean(b.description) || null,
          workType,
          clean(b.priority, 20) || "normal",
          "planned",
          scheduled(b.scheduledAt),
          null,
          assigneeId,
          s.userId,
          materials.length ? tankLiters : null,
          materials.length ? tankCount : null,
          null,
          ts,
          ts,
        ),
    ];
    for (const m of materials) {
      const stockProductId = clean(m.stockProductId, 80) || null;
      if (
        stockProductId &&
        !(await env
          .DB!.prepare(
            "SELECT 1 FROM products WHERE id=? AND farm_id=? AND active=1",
          )
          .bind(stockProductId, farmId)
          .first())
      )
        return Response.json(
          { error: "มีสินค้าในสูตรที่ไม่อยู่ในคลังของสวนนี้" },
          { status: 400 },
        );
      const rate = Number(m.ratePer200l ?? m.rate),
        factor = tankLiters / 200,
        qty = rate * tankCount * factor;
      statements.push(
        env
          .DB!.prepare(
            "INSERT INTO work_material_plans (id,work_item_id,product_name,product_kind,brand,common_name,rate_per_200l,rate_unit,tank_count,planned_quantity,actual_quantity,stock_product_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id("material"),
            taskId,
            clean(m.productName || m.name, 120),
            clean(m.productKind || m.kind, 50) || "อื่นๆ",
            clean(m.brand, 100) || null,
            clean(m.commonName, 120) || null,
            rate,
            clean(m.rateUnit || m.unit, 20) || "มล.",
            tankCount,
            qty,
            null,
            stockProductId,
            ts,
            ts,
          ),
      );
    }
    await env.DB!.batch(statements);
    await audit(s, "create", "work_item", taskId, {
      title,
      plotId,
      seasonId,
      assigneeId,
      workType,
      materialCount: materials.length,
    });
    return Response.json({ id: taskId }, { status: 201 });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "บันทึกงานไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const s = await requireSession();
    const b = (await req.json()) as Record<string, any>,
      taskId = clean(b.id, 80);
    if (!taskId)
      return Response.json({ error: "ไม่พบรหัสงาน" }, { status: 400 });
    const task = await env
      .DB!.prepare(
        "SELECT w.id,w.farm_id AS farmId,w.assignee_id AS assigneeId,w.status,w.tank_count AS tankCount FROM work_items w JOIN farm_members fm ON fm.farm_id=w.farm_id AND fm.user_id=? AND fm.status='active' WHERE w.id=?",
      )
      .bind(s.userId, taskId)
      .first<{
        id: string;
        farmId: string;
        assigneeId: string | null;
        status: string;
        tankCount: number | null;
      }>();
    if (!task) return Response.json({ error: "ไม่พบงาน" }, { status: 404 });
    if (!may(s, "work.manage") && task.assigneeId !== s.userId)
      throw new Response("ไม่มีสิทธิ์แก้ไขงานนี้", { status: 403 });
    const status = ["planned", "in_progress", "done", "cancelled"].includes(
        b.status,
      )
        ? b.status
        : task.status,
      ts = now(),
      actualTanks = Math.max(
        0,
        Number(b.actualTankCount ?? task.tankCount) || 0,
      );
    if (status === "done" && task.status !== "done") {
      const plans = (
        await env
          .DB!.prepare(
            `SELECT m.id,m.stock_product_id AS productId,m.rate_per_200l*?*(COALESCE(w.tank_liters,200)/200) AS quantity,w.plot_id AS plotId,w.season_id AS seasonId FROM work_material_plans m JOIN work_items w ON w.id=m.work_item_id WHERE m.work_item_id=?`,
          )
          .bind(actualTanks, taskId)
          .all<{
            id: string;
            productId: string | null;
            quantity: number;
            plotId: string | null;
            seasonId: string | null;
          }>()
      ).results;
      const statements: D1PreparedStatement[] = [
        env
          .DB!.prepare(
            "UPDATE work_items SET status=?,completed_at=?,actual_tank_count=?,updated_at=? WHERE id=?",
          )
          .bind(status, ts, actualTanks || null, ts, taskId),
        env
          .DB!.prepare(
            "UPDATE work_material_plans SET actual_quantity=rate_per_200l*?*(COALESCE((SELECT tank_liters FROM work_items WHERE id=?),200)/200),updated_at=? WHERE work_item_id=?",
          )
          .bind(actualTanks, taskId, ts, taskId),
      ];
      for (const plan of plans) {
        if (!plan.productId) continue;
        const already = await env
          .DB!.prepare(
            "SELECT 1 FROM stock_movements WHERE work_material_plan_id=? LIMIT 1",
          )
          .bind(plan.id)
          .first();
        if (already) continue;
        const lots = (
            await env
              .DB!.prepare(
                "SELECT id,remaining_qty AS remaining FROM stock_lots WHERE product_id=? AND remaining_qty>0 ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END,expires_on,created_at",
              )
              .bind(plan.productId)
              .all<{ id: string; remaining: number }>()
          ).results,
          available = lots.reduce((n, x) => n + Number(x.remaining), 0);
        if (available + 1e-9 < Number(plan.quantity))
          return Response.json(
            {
              error: `สต๊อกไม่พอสำหรับปิดงาน (ต้องใช้ ${Number(plan.quantity).toLocaleString("th-TH")}, มี ${available.toLocaleString("th-TH")})`,
            },
            { status: 409 },
          );
        let left = Number(plan.quantity);
        for (const lot of lots) {
          if (left <= 1e-9) break;
          const used = Math.min(left, Number(lot.remaining));
          statements.push(
            env
              .DB!.prepare(
                "UPDATE stock_lots SET remaining_qty=remaining_qty-?,updated_at=? WHERE id=?",
              )
              .bind(used, ts, lot.id),
            env
              .DB!.prepare(
                "INSERT INTO stock_movements (id,lot_id,work_item_id,work_material_plan_id,transaction_id,plot_id,season_id,movement_type,quantity,occurred_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                id("movement"),
                lot.id,
                taskId,
                plan.id,
                null,
                plan.plotId,
                plan.seasonId,
                "work_issue",
                used,
                ts,
                "ตัดสต๊อกเมื่อปิดงาน",
              ),
          );
          left -= used;
        }
      }
      await env.DB!.batch(statements);
    } else
      await env
        .DB!.prepare(
          "UPDATE work_items SET status=?,completed_at=CASE WHEN ?='done' THEN COALESCE(completed_at,?) ELSE NULL END,actual_tank_count=?,updated_at=? WHERE id=?",
        )
        .bind(status, status, ts, actualTanks || null, ts, taskId)
        .run();
    await audit(s, "update_status", "work_item", taskId, {
      status,
      actualTankCount: actualTanks,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "อัปเดตงานไม่สำเร็จ" }, { status: 500 });
  }
}
