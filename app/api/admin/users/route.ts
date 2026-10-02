import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  id,
  now,
  permitPermission,
  requireSession,
} from "@/lib/authz";
import { makePassword, validPassword } from "@/lib/password";

const allowedKeys = [
  "dashboard.view",
  "farms.manage",
  "trees.manage",
  "work.view",
  "work.manage",
  "spray_formula.manage",
  "inventory.view",
  "inventory.manage",
  "finance.view",
  "finance.manage",
  "harvest.manage",
  "reports.view",
  "smartfarm.manage",
  "users.manage",
  "audit.view",
];
const clean = (value: unknown, max = 120) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "users.manage");
    const [users, permissions, plots] = await Promise.all([
      env
        .DB!.prepare(
          `SELECT u.id,u.name,a.username,a.is_active AS isActive,a.must_change_password AS mustChangePassword,a.last_login_at AS lastLoginAt,fm.role,fm.plot_scope_id AS plotScopeId,p.name AS plotScopeName FROM users u JOIN local_accounts a ON a.user_id=u.id JOIN farm_members fm ON fm.user_id=u.id LEFT JOIN plots p ON p.id=fm.plot_scope_id WHERE fm.farm_id=? ORDER BY CASE fm.role WHEN 'admin' THEN 0 ELSE 1 END,u.name`,
        )
        .bind(s.farmId)
        .all(),
      env
        .DB!.prepare(
          "SELECT user_id AS userId,permission_key AS permissionKey FROM user_permissions WHERE farm_id=? AND allowed=1",
        )
        .bind(s.farmId)
        .all(),
      env
        .DB!.prepare("SELECT id,name FROM plots WHERE farm_id=? ORDER BY name")
        .bind(s.farmId)
        .all(),
    ]);
    return Response.json({
      currentUserId: s.userId,
      users: users.results || [],
      permissions: permissions.results || [],
      permissionKeys: allowedKeys,
      plots: plots.results || [],
    });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "โหลดข้อมูลผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await requireSession();
    permitPermission(s, "users.manage");
    const body = (await request.json()) as Record<string, unknown>;
    const username = clean(body.username, 32).toLowerCase(),
      name = clean(body.name, 120),
      password = String(body.password || ""),
      plotScopeId = clean(body.plotScopeId, 80) || null,
      keys = Array.isArray(body.permissions)
        ? [...new Set(body.permissions.map((x) => clean(x, 80)))].filter((x) =>
            allowedKeys.includes(x),
          )
        : [];
    if (!/^[a-z0-9._-]{3,32}$/.test(username))
      return Response.json(
        {
          error:
            "ชื่อผู้ใช้ต้องมี 3–32 ตัว และใช้ a-z, 0-9, จุด ขีด หรือขีดล่าง",
        },
        { status: 400 },
      );
    if (!name)
      return Response.json({ error: "กรุณาระบุชื่อผู้ใช้" }, { status: 400 });
    if (!validPassword(password))
      return Response.json(
        {
          error:
            "รหัสผ่านเริ่มต้นต้องมีอย่างน้อย 10 ตัว พร้อมตัวอักษรและตัวเลข",
        },
        { status: 400 },
      );
    if (plotScopeId && !(await validPlot(plotScopeId, s.farmId)))
      return Response.json({ error: "ไม่พบแปลงที่กำหนด" }, { status: 400 });
    if (
      await env
        .DB!.prepare("SELECT 1 FROM local_accounts WHERE username=?")
        .bind(username)
        .first()
    )
      return Response.json(
        { error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" },
        { status: 409 },
      );
    const ts = now(),
      userId = id("user"),
      passwordData = await makePassword(password);
    await env.DB!.batch([
      env
        .DB!.prepare(
          "INSERT INTO users (id,name,email,created_at,updated_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          userId,
          name,
          `${username}.${crypto.randomUUID()}@local.invalid`,
          ts,
          ts,
        ),
      env
        .DB!.prepare(
          "INSERT INTO local_accounts (id,user_id,username,password_hash,password_salt,password_iterations,must_change_password,is_active,failed_attempts,locked_until,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id("account"),
          userId,
          username,
          passwordData.hash,
          passwordData.salt,
          passwordData.iterations,
          1,
          1,
          0,
          null,
          null,
          ts,
          ts,
        ),
      env
        .DB!.prepare(
          "INSERT INTO farm_members (id,farm_id,user_id,role,plot_scope_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id("member"),
          s.farmId,
          userId,
          "user",
          plotScopeId,
          "active",
          ts,
          ts,
        ),
      ...keys.map((key) =>
        env
          .DB!.prepare(
            "INSERT INTO user_permissions (id,farm_id,user_id,permission_key,allowed,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(id("permission"), s.farmId, userId, key, 1, ts, ts),
      ),
    ]);
    await audit(s, "create", "local_user", userId, {
      username,
      name,
      plotScopeId,
      permissions: keys,
    });
    return Response.json({ id: userId, saved: true }, { status: 201 });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "สร้างผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await requireSession();
    permitPermission(s, "users.manage");
    const body = (await request.json()) as Record<string, unknown>;
    const userId = clean(body.userId, 80),
      name = clean(body.name, 120),
      plotScopeId = clean(body.plotScopeId, 80) || null,
      resetPassword = String(body.resetPassword || ""),
      keys = Array.isArray(body.permissions)
        ? [...new Set(body.permissions.map((x) => clean(x, 80)))].filter((x) =>
            allowedKeys.includes(x),
          )
        : [];
    if (!userId || userId === s.userId)
      return Response.json(
        { error: "ไม่สามารถแก้ไขบัญชี Admin ที่กำลังใช้งาน" },
        { status: 400 },
      );
    const member = await env
      .DB!.prepare(
        "SELECT fm.role FROM farm_members fm WHERE fm.farm_id=? AND fm.user_id=?",
      )
      .bind(s.farmId, userId)
      .first<{ role: string }>();
    if (!member)
      return Response.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    if (member.role === "admin")
      return Response.json(
        { error: "ไม่สามารถแก้ไขบัญชี Admin อื่นจากหน้านี้" },
        { status: 403 },
      );
    if (!name)
      return Response.json({ error: "กรุณาระบุชื่อผู้ใช้" }, { status: 400 });
    if (plotScopeId && !(await validPlot(plotScopeId, s.farmId)))
      return Response.json({ error: "ไม่พบแปลงที่กำหนด" }, { status: 400 });
    if (resetPassword && !validPassword(resetPassword))
      return Response.json(
        { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัว พร้อมตัวอักษรและตัวเลข" },
        { status: 400 },
      );
    const ts = now();
    const existing = await env
      .DB!.prepare(
        "SELECT id FROM user_permissions WHERE farm_id=? AND user_id=?",
      )
      .bind(s.farmId, userId)
      .all<{ id: string }>();
    const statements: D1PreparedStatement[] = [
      ...existing.results.map((x) =>
        env.DB!.prepare("DELETE FROM user_permissions WHERE id=?").bind(x.id),
      ),
      ...keys.map((key) =>
        env
          .DB!.prepare(
            "INSERT INTO user_permissions (id,farm_id,user_id,permission_key,allowed,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(id("permission"), s.farmId, userId, key, 1, ts, ts),
      ),
      env
        .DB!.prepare(
          "UPDATE farm_members SET plot_scope_id=?,status=?,updated_at=? WHERE farm_id=? AND user_id=?",
        )
        .bind(
          plotScopeId,
          body.isActive === false ? "suspended" : "active",
          ts,
          s.farmId,
          userId,
        ),
      env
        .DB!.prepare(
          "UPDATE local_accounts SET is_active=?,updated_at=? WHERE user_id=?",
        )
        .bind(body.isActive === false ? 0 : 1, ts, userId),
      env
        .DB!.prepare("UPDATE users SET name=?,updated_at=? WHERE id=?")
        .bind(name, ts, userId),
    ];
    if (body.isActive === false || resetPassword)
      statements.push(
        env
          .DB!.prepare(
            "UPDATE app_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
          )
          .bind(ts, userId),
      );
    if (resetPassword) {
      const passwordData = await makePassword(resetPassword);
      statements.push(
        env
          .DB!.prepare(
            "UPDATE local_accounts SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=1,failed_attempts=0,locked_until=NULL,updated_at=? WHERE user_id=?",
          )
          .bind(
            passwordData.hash,
            passwordData.salt,
            passwordData.iterations,
            ts,
            userId,
          ),
      );
    }
    await env.DB!.batch(statements);
    await audit(s, "update", "local_user", userId, {
      active: body.isActive !== false,
      plotScopeId,
      permissions: keys,
      passwordReset: !!resetPassword,
    });
    return Response.json({ saved: true });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "แก้ไขผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}

async function validPlot(plotId: string, farmId: string) {
  return !!(await env
    .DB!.prepare("SELECT 1 FROM plots WHERE id=? AND farm_id=?")
    .bind(plotId, farmId)
    .first());
}
