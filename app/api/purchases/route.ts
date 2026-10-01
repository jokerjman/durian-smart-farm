import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  id,
  now,
  permitPermission,
  requireSession,
} from "@/lib/authz";
type Line = {
  productId?: string;
  sku?: string;
  name?: string;
  kind?: string;
  brand?: string;
  commonName?: string;
  formulation?: string;
  registrationNo?: string;
  packageQty?: number;
  packageSize?: number;
  packageUnit?: string;
  unitPrice?: number;
  lotNo?: string;
  expiresOn?: string;
  ratePer200l?: number;
  rateUnit?: string;
  minimumStock?: number;
};
const clean = (v: unknown, n = 180) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "inventory.view");
    const purchases = await env
      .DB!.prepare(
        `SELECT r.id,r.supplier,r.invoice_no AS invoiceNo,r.purchased_on AS purchasedOn,r.total_amount AS totalAmount,r.transaction_id AS transactionId,r.receipt_key AS receiptKey,COUNT(l.id) AS lineCount FROM purchase_receipts r LEFT JOIN purchase_lines l ON l.purchase_id=r.id WHERE r.farm_id=? GROUP BY r.id ORDER BY r.purchased_on DESC,r.created_at DESC LIMIT 100`,
      )
      .bind(s.farmId)
      .all();
    return Response.json({ purchases: purchases.results || [] });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          { error: "โหลดประวัติการซื้อไม่สำเร็จ" },
          { status: 500 },
        );
  }
}
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const s = await requireSession();
    permitPermission(s, "inventory.manage");
    const b = (await req.json()) as {
        supplier?: string;
        invoiceNo?: string;
        purchasedOn?: string;
        discount?: number;
        receiptKey?: string;
        lines?: Line[];
      },
      supplier = clean(b.supplier, 160),
      lines = (b.lines || [])
        .filter(
          (x) =>
            clean(x.name) &&
            Number(x.packageQty) > 0 &&
            Number(x.packageSize) > 0 &&
            Number(x.unitPrice) >= 0,
        )
        .slice(0, 40);
    if (!supplier || !lines.length)
      return Response.json(
        { error: "กรุณาระบุผู้ขายและสินค้าอย่างน้อย 1 รายการ" },
        { status: 400 },
      );
    const receiptKey = String(b.receiptKey || "");
    if (receiptKey.length > 500000)
      return Response.json(
        { error: "ไฟล์ใบเสร็จมีขนาดใหญ่เกินไป" },
        { status: 413 },
      );
    const ts = now(),
      purchaseId = id("purchase"),
      transactionId = id("txn"),
      categoryId = `purchase_inputs_${s.farmId}`,
      subtotal = lines.reduce(
        (n, x) => n + Number(x.packageQty) * Number(x.unitPrice),
        0,
      ),
      discount = Math.min(subtotal, Math.max(0, Number(b.discount) || 0)),
      total = subtotal - discount,
      purchasedOn =
        clean(b.purchasedOn, 10) || new Date().toISOString().slice(0, 10),
      season =
        (
          await env
            .DB!.prepare(
              "SELECT id FROM seasons WHERE farm_id=? AND status IN ('current','active','in_progress') ORDER BY start_date DESC LIMIT 1",
            )
            .bind(s.farmId)
            .first<{ id: string }>()
        )?.id || null;
    const statements: D1PreparedStatement[] = [
      env
        .DB!.prepare(
          "INSERT OR IGNORE INTO finance_categories (id,farm_id,type,name,is_system) VALUES (?,?,?,?,?)",
        )
        .bind(categoryId, s.farmId, "expense", "ซื้อปัจจัยการผลิต", 1),
      env
        .DB!.prepare(
          "INSERT INTO transactions (id,farm_id,plot_id,season_id,category_id,work_item_id,type,title,amount,occurred_on,receipt_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          transactionId,
          s.farmId,
          null,
          season,
          categoryId,
          null,
          "expense",
          `ซื้อปัจจัยการผลิต · ${supplier}`,
          total,
          purchasedOn,
          receiptKey || null,
          ts,
          ts,
        ),
      env
        .DB!.prepare(
          "INSERT INTO purchase_receipts (id,farm_id,supplier,invoice_no,purchased_on,subtotal,discount,total_amount,transaction_id,receipt_key,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          purchaseId,
          s.farmId,
          supplier,
          clean(b.invoiceNo, 100) || null,
          purchasedOn,
          subtotal,
          discount,
          total,
          transactionId,
          receiptKey || null,
          s.userId,
          ts,
          ts,
        ),
    ];
    for (let i = 0; i < lines.length; i++) {
      const x = lines[i],
        sku = (clean(x.sku, 60) || `ITEM-${Date.now()}-${i + 1}`).toUpperCase();
      let productId = clean(x.productId, 80);
      if (
        productId &&
        !(await env
          .DB!.prepare("SELECT 1 FROM products WHERE id=? AND farm_id=?")
          .bind(productId, s.farmId)
          .first())
      )
        return Response.json(
          { error: `ไม่พบสินค้าแถวที่ ${i + 1}` },
          { status: 400 },
        );
      if (!productId)
        productId =
          (
            await env
              .DB!.prepare("SELECT id FROM products WHERE farm_id=? AND sku=?")
              .bind(s.farmId, sku)
              .first<{ id: string }>()
          )?.id || id("product");
      const lotId = id("lot"),
        packageQty = Number(x.packageQty),
        packageSize = Number(x.packageSize),
        receivedQty = packageQty * packageSize,
        unitPrice = Number(x.unitPrice),
        unitCost = unitPrice / packageSize;
      statements.push(
        env
          .DB!.prepare(
            "INSERT INTO products (id,farm_id,sku,name,kind,brand,common_name,formulation,registration_no,package_size,package_unit,default_rate_per_200l,rate_unit,unit,minimum_stock,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(farm_id,sku) DO UPDATE SET name=excluded.name,kind=excluded.kind,brand=excluded.brand,common_name=excluded.common_name,formulation=excluded.formulation,registration_no=excluded.registration_no,package_size=excluded.package_size,package_unit=excluded.package_unit,default_rate_per_200l=excluded.default_rate_per_200l,rate_unit=excluded.rate_unit,unit=excluded.unit,minimum_stock=excluded.minimum_stock,updated_at=excluded.updated_at",
          )
          .bind(
            productId,
            s.farmId,
            sku,
            clean(x.name),
            clean(x.kind, 60) || "อื่นๆ",
            clean(x.brand, 120) || null,
            clean(x.commonName) || null,
            clean(x.formulation, 100) || null,
            clean(x.registrationNo, 100) || null,
            packageSize,
            clean(x.packageUnit, 30) || "หน่วย",
            Number(x.ratePer200l) || null,
            clean(x.rateUnit, 30) || null,
            clean(x.packageUnit, 30) || "หน่วย",
            Math.max(0, Number(x.minimumStock) || 0),
            1,
            ts,
            ts,
          ),
        env
          .DB!.prepare(
            "INSERT INTO stock_lots (id,product_id,lot_no,expires_on,unit_cost,received_qty,remaining_qty,supplier,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            lotId,
            productId,
            clean(x.lotNo, 80) || null,
            clean(x.expiresOn, 10) || null,
            unitCost,
            receivedQty,
            receivedQty,
            supplier,
            ts,
            ts,
          ),
        env
          .DB!.prepare(
            "INSERT INTO purchase_lines (id,purchase_id,product_id,lot_id,package_qty,package_size,package_unit,unit_price,line_total) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id("purchase_line"),
            purchaseId,
            productId,
            lotId,
            packageQty,
            packageSize,
            clean(x.packageUnit, 30) || "หน่วย",
            unitPrice,
            packageQty * unitPrice,
          ),
        env
          .DB!.prepare(
            "INSERT INTO stock_movements (id,lot_id,work_item_id,work_material_plan_id,transaction_id,plot_id,season_id,movement_type,quantity,occurred_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id("movement"),
            lotId,
            null,
            null,
            transactionId,
            null,
            season,
            "purchase_in",
            receivedQty,
            ts,
            `รับเข้าจากใบซื้อ ${clean(b.invoiceNo, 100) || purchaseId}`,
          ),
      );
    }
    await env.DB!.batch(statements);
    await audit(s, "create", "purchase_receipt", purchaseId, {
      supplier,
      total,
      lineCount: lines.length,
      transactionId,
    });
    return Response.json(
      { id: purchaseId, transactionId, total, lineCount: lines.length },
      { status: 201 },
    );
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          { error: "บันทึกใบซื้อและรับเข้าคลังไม่สำเร็จ" },
          { status: 500 },
        );
  }
}
