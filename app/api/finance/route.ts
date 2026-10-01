import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  id,
  now,
  permitPermission,
  requireSession,
} from "@/lib/authz";
const clean = (v: unknown, n = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "finance.view");
    const transactions = await env
      .DB!.prepare(
        `SELECT t.id,t.type,t.title,t.amount,t.occurred_on AS occurredOn,t.receipt_key AS receiptKey,c.name AS categoryName,p.name AS plotName,se.name AS seasonName,CASE WHEN pr.id IS NOT NULL THEN 'purchase' WHEN le.id IS NOT NULL THEN 'labor' ELSE 'manual' END AS source FROM transactions t JOIN finance_categories c ON c.id=t.category_id LEFT JOIN plots p ON p.id=t.plot_id LEFT JOIN seasons se ON se.id=t.season_id LEFT JOIN purchase_receipts pr ON pr.transaction_id=t.id LEFT JOIN labor_entries le ON le.transaction_id=t.id WHERE t.farm_id=? ORDER BY t.occurred_on DESC,t.created_at DESC LIMIT 300`,
      )
      .bind(s.farmId)
      .all();
    const categories = await env
      .DB!.prepare(
        "SELECT id,type,name,is_system AS isSystem FROM finance_categories WHERE farm_id=? OR farm_id IS NULL ORDER BY type,name",
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
    return Response.json({
      transactions: transactions.results || [],
      categories: categories.results || [],
      plots: plots.results || [],
      seasons: seasons.results || [],
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "โหลดบัญชีไม่สำเร็จ" }, { status: 500 });
  }
}
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const s = await requireSession();
    permitPermission(s, "finance.manage");
    const b = (await req.json()) as Record<string, unknown>,
      type = b.type === "income" ? "income" : "expense",
      title = clean(b.title),
      amount = Math.max(0, Number(b.amount) || 0),
      occurredOn =
        clean(b.occurredOn, 10) || new Date().toISOString().slice(0, 10),
      categoryName = clean(b.categoryName, 100),
      receiptKey = String(b.receiptKey || "");
    if (!title || !amount || !categoryName)
      return Response.json(
        { error: "กรุณาระบุรายการ หมวด และจำนวนเงิน" },
        { status: 400 },
      );
    if (receiptKey.length > 500000)
      return Response.json(
        { error: "ไฟล์ใบเสร็จมีขนาดใหญ่เกินไป" },
        { status: 413 },
      );
    let category = await env
      .DB!.prepare(
        "SELECT id FROM finance_categories WHERE farm_id=? AND type=? AND name=?",
      )
      .bind(s.farmId, type, categoryName)
      .first<{ id: string }>();
    const categoryId = category?.id || id("category"),
      transactionId = id("txn"),
      ts = now(),
      plotId = clean(b.plotId, 80) || null,
      seasonId = clean(b.seasonId, 80) || null;
    const statements: D1PreparedStatement[] = [];
    if (!category)
      statements.push(
        env
          .DB!.prepare(
            "INSERT INTO finance_categories (id,farm_id,type,name,is_system) VALUES (?,?,?,?,0)",
          )
          .bind(categoryId, s.farmId, type, categoryName),
      );
    statements.push(
      env
        .DB!.prepare(
          "INSERT INTO transactions (id,farm_id,plot_id,season_id,category_id,work_item_id,type,title,amount,occurred_on,receipt_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          transactionId,
          s.farmId,
          plotId,
          seasonId,
          categoryId,
          null,
          type,
          title,
          amount,
          occurredOn,
          receiptKey || null,
          ts,
          ts,
        ),
    );
    await env.DB!.batch(statements);
    await audit(s, "create", "transaction", transactionId, {
      type,
      title,
      amount,
      categoryName,
      plotId,
      seasonId,
    });
    return Response.json({ id: transactionId }, { status: 201 });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "บันทึกรายการบัญชีไม่สำเร็จ" }, { status: 500 });
  }
}
