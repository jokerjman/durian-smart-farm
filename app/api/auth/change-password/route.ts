import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  clearSessionCookie,
  now,
  requireSession,
} from "@/lib/authz";
import { makePassword, validPassword, verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await requireSession();
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!validPassword(body.newPassword || ""))
      return Response.json(
        { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัว พร้อมตัวอักษรและตัวเลข" },
        { status: 400 },
      );
    const account = await env
      .DB!.prepare(
        "SELECT id,password_hash AS hash,password_salt AS salt,password_iterations AS iterations FROM local_accounts WHERE user_id=?",
      )
      .bind(s.userId)
      .first<{ id: string; hash: string; salt: string; iterations: number }>();
    if (
      !account ||
      !(await verifyPassword(
        body.currentPassword || "",
        account.hash,
        account.salt,
        account.iterations,
      ))
    )
      return Response.json(
        { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
        { status: 401 },
      );
    const password = await makePassword(body.newPassword!);
    const ts = now();
    await env.DB!.batch([
      env
        .DB!.prepare(
          "UPDATE local_accounts SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=0,updated_at=? WHERE id=?",
        )
        .bind(
          password.hash,
          password.salt,
          password.iterations,
          ts,
          account.id,
        ),
      env
        .DB!.prepare("UPDATE app_sessions SET revoked_at=? WHERE user_id=?")
        .bind(ts, s.userId),
    ]);
    await audit(s, "change_password", "local_user", s.userId, {});
    return Response.json(
      { saved: true },
      { headers: { "Set-Cookie": clearSessionCookie(request) } },
    );
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "เปลี่ยนรหัสผ่านไม่สำเร็จ" }, { status: 500 });
  }
}
