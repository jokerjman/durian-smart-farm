export async function POST() {
  return Response.json(
    {
      error:
        "ระบบไม่ใช้คำเชิญทางอีเมล กรุณาให้ Admin สร้างชื่อผู้ใช้และรหัสผ่าน",
    },
    { status: 410 },
  );
}
