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
    .slice(0, n);
const num = (v: unknown) => Math.max(0, Number(v) || 0);

export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "inventory.view");
    const products = await env
      .DB!.prepare(
        `SELECT p.id,p.sku,p.name,p.kind,p.brand,p.common_name AS commonName,p.formulation,p.registration_no AS registrationNo,p.package_size AS packageSize,p.package_unit AS packageUnit,p.default_rate_per_200l AS defaultRatePer200l,p.rate_unit AS rateUnit,p.unit,p.minimum_stock AS minimumStock,p.active,COALESCE(SUM(l.remaining_qty),0) AS stock,COUNT(CASE WHEN l.remaining_qty>0 THEN 1 END) AS lotCount,MIN(CASE WHEN l.remaining_qty>0 THEN l.expires_on END) AS nearestExpiry,(SELECT pl.unit_price FROM purchase_lines pl JOIN purchase_receipts pr ON pr.id=pl.purchase_id WHERE pl.product_id=p.id ORDER BY pr.purchased_on DESC,pr.created_at DESC LIMIT 1) AS lastUnitPrice FROM products p LEFT JOIN stock_lots l ON l.product_id=p.id WHERE p.farm_id=? GROUP BY p.id ORDER BY p.active DESC,p.name`,
      )
      .bind(s.farmId)
      .all();
    const lots = await env
      .DB!.prepare(
        `SELECT l.id,l.product_id AS productId,p.name AS productName,l.lot_no AS lotNo,l.expires_on AS expiresOn,l.unit_cost AS unitCost,l.received_qty AS receivedQty,l.remaining_qty AS remainingQty,l.supplier FROM stock_lots l JOIN products p ON p.id=l.product_id WHERE p.farm_id=? ORDER BY CASE WHEN l.remaining_qty>0 THEN 0 ELSE 1 END,l.expires_on,l.created_at`,
      )
      .bind(s.farmId)
      .all();
    const movements = await env
      .DB!.prepare(
        `SELECT m.id,m.movement_type AS movementType,m.quantity,m.occurred_at AS occurredAt,m.note,p.name AS productName,l.lot_no AS lotNo,w.title AS workTitle FROM stock_movements m JOIN stock_lots l ON l.id=m.lot_id JOIN products p ON p.id=l.product_id LEFT JOIN work_items w ON w.id=m.work_item_id WHERE p.farm_id=? ORDER BY m.occurred_at DESC LIMIT 200`,
      )
      .bind(s.farmId)
      .all();
    return Response.json({
      products: products.results || [],
      lots: lots.results || [],
      movements: movements.results || [],
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "โหลดข้อมูลคลังไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const s = await requireSession();
    permitPermission(s, "inventory.manage");
    const b = (await req.json()) as Record<string, unknown>,
      action = clean(b.action, 30),
      ts = now();
    if (action === "product") {
      const name = clean(b.name),
        sku = clean(b.sku, 60).toUpperCase(),
        unit = clean(b.unit, 30),
        kind = clean(b.kind, 60) || "อื่นๆ";
      if (!name || !sku || !unit)
        return Response.json(
          { error: "กรุณาระบุรหัส ชื่อสินค้า และหน่วยสต๊อก" },
          { status: 400 },
        );
      const productId = id("product");
      try {
        await env
          .DB!.prepare(
            "INSERT INTO products (id,farm_id,sku,name,kind,brand,common_name,formulation,registration_no,package_size,package_unit,default_rate_per_200l,rate_unit,unit,minimum_stock,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            productId,
            s.farmId,
            sku,
            name,
            kind,
            clean(b.brand, 120) || null,
            clean(b.commonName) || null,
            clean(b.formulation, 100) || null,
            clean(b.registrationNo, 100) || null,
            num(b.packageSize) || null,
            clean(b.packageUnit, 30) || unit,
            num(b.defaultRatePer200l) || null,
            clean(b.rateUnit, 30) || null,
            unit,
            num(b.minimumStock),
            1,
            ts,
            ts,
          )
          .run();
      } catch {
        return Response.json(
          { error: "รหัสสินค้านี้มีอยู่แล้ว" },
          { status: 409 },
        );
      }
      await audit(s, "create", "product", productId, { sku, name, kind });
      return Response.json({ id: productId }, { status: 201 });
    }
    if (action === "adjust") {
      const productId = clean(b.productId, 80),
        mode = b.mode === "out" ? "out" : "in",
        quantity = num(b.quantity),
        note = clean(b.note, 300);
      if (!productId || quantity <= 0)
        return Response.json(
          { error: "กรุณาเลือกสินค้าและระบุจำนวน" },
          { status: 400 },
        );
      const product = await env
        .DB!.prepare(
          "SELECT id FROM products WHERE id=? AND farm_id=? AND active=1",
        )
        .bind(productId, s.farmId)
        .first();
      if (!product)
        return Response.json({ error: "ไม่พบสินค้า" }, { status: 404 });
      if (mode === "in") {
        const lotId = id("lot"),
          movementId = id("movement"),
          lotNo =
            clean(b.lotNo, 80) ||
            `ADJ-${new Date().toISOString().slice(0, 10)}`;
        await env.DB!.batch([
          env
            .DB!.prepare(
              "INSERT INTO stock_lots (id,product_id,lot_no,expires_on,unit_cost,received_qty,remaining_qty,supplier,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              lotId,
              productId,
              lotNo,
              clean(b.expiresOn, 10) || null,
              num(b.unitCost),
              quantity,
              quantity,
              clean(b.supplier, 150) || "ปรับยอด",
              ts,
              ts,
            ),
          env
            .DB!.prepare(
              "INSERT INTO stock_movements (id,lot_id,work_item_id,work_material_plan_id,transaction_id,plot_id,season_id,movement_type,quantity,occurred_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              movementId,
              lotId,
              null,
              null,
              null,
              null,
              null,
              "adjust_in",
              quantity,
              ts,
              note || "ปรับยอดรับเข้า",
            ),
        ]);
        await audit(s, "adjust_in", "stock", productId, { quantity, lotNo });
        return Response.json({ ok: true });
      }
      const lots = (
        await env
          .DB!.prepare(
            "SELECT id,remaining_qty AS remaining FROM stock_lots WHERE product_id=? AND remaining_qty>0 ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END,expires_on,created_at",
          )
          .bind(productId)
          .all<{ id: string; remaining: number }>()
      ).results;
      const available = lots.reduce((n, x) => n + Number(x.remaining), 0);
      if (available < quantity)
        return Response.json(
          { error: `สต๊อกไม่พอ มีอยู่ ${available}` },
          { status: 409 },
        );
      let left = quantity;
      const statements: D1PreparedStatement[] = [];
      for (const lot of lots) {
        if (left <= 0) break;
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
              null,
              null,
              null,
              null,
              null,
              "adjust_out",
              used,
              ts,
              note || "ปรับยอดจ่ายออก",
            ),
        );
        left -= used;
      }
      await env.DB!.batch(statements);
      await audit(s, "adjust_out", "stock", productId, { quantity });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "บันทึกคลังไม่สำเร็จ" }, { status: 500 });
  }
}
