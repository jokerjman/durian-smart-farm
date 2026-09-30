# Durian Smart Farm

เว็บแอปบริหารสวนทุเรียนแบบ mobile-first สำหรับจัดการสวน แปลง ต้นทุเรียน ฤดูผลิต งานในสวน ปัจจัยการผลิต บัญชี ผลผลิต และผู้ใช้งาน

## Production

- Website: https://durian-smart-farm.jokerjman.workers.dev
- Hosting: Cloudflare Workers
- Database: Cloudflare D1
- Authentication: ชื่อผู้ใช้และรหัสผ่านภายในระบบ ผู้ใช้ถูกสร้างโดย Admin เท่านั้น
- Repository: Private GitHub repository

ระบบไม่พึ่งบัญชี ChatGPT และไม่ใช้อีเมลเป็นข้อมูลเข้าสู่ระบบ

## Current milestone

Production Upgrade P0 เสร็จแล้ว:

- สำรองซอร์สโค้ดและฐานข้อมูลก่อนปรับปรุง
- รักษาบัญชี Admin และข้อมูลสวนจริง
- ถอดข้อมูลตัวอย่างออกจากหน้าที่ใช้งาน
- Dashboard อ่านชื่อสวนและตัวเลขจากฐานข้อมูลจริง
- แสดงสถานะว่างเมื่อยังไม่มีแปลง ต้น งาน ฤดู หรือรายการบัญชี
- เชื่อม Cloudflare Workers และ D1
- เชื่อม GitHub สำหรับเก็บประวัติโค้ด

เฟสถัดไปคือ P1: ตั้งค่าเว็บไซต์และข้อมูลพื้นฐานของสวน

## Data hierarchy

```text
User
└── Farm
    └── Plot
        └── Tree
```

งาน บัญชี การเคลื่อนไหวคลัง และผลผลิตจะเชื่อมกับ Farm และ Production Season ตามขอบเขตของแต่ละรายการ

## Main technology

- Next.js-compatible application powered by Vinext/Vite
- React and TypeScript
- Cloudflare Workers
- Cloudflare D1 / SQLite
- Drizzle schema and SQL migrations

## Local development

ต้องใช้ Node.js รุ่นที่รองรับโดยโครงการ จากโฟลเดอร์โครงการ:

```sh
npm install
npm run dev
```

ตรวจ TypeScript และสร้างรุ่น production:

```sh
npx tsc --noEmit
npm run build
```

## Database migrations

โครงสร้างหลักอยู่ที่ `db/schema.ts` และ migration อยู่ใน `drizzle/`

ก่อนใช้ migration กับ production ต้องสำรองฐานข้อมูล ตรวจไฟล์ SQL และใช้ฐานข้อมูลที่ระบุใน `wrangler.jsonc` เท่านั้น ห้าม replay migration ที่ถูกใช้แล้ว

## Security notes

- ห้าม commit `.env*`, `.dev.vars`, token, รหัสผ่าน หรือไฟล์สำรองฐานข้อมูล
- รหัสผ่านถูกจัดเก็บแบบ salted PBKDF2-SHA256
- Session ใช้คุกกี้ HttpOnly, Secure และ SameSite
- Admin มีสิทธิ์เต็ม ส่วนผู้ใช้ทั่วไปใช้สิทธิ์รายฟังก์ชัน
- การแก้สิทธิ์และรายการสำคัญต้องบันทึก Audit Log

## Backups

ไฟล์สำรองฐานข้อมูลและซอร์สโค้ดไม่เก็บใน Repository นี้ และเก็บแยกไว้ในเครื่องของเจ้าของโครงการ

## Roadmap

1. P1 — ตั้งค่าเว็บไซต์และข้อมูลพื้นฐาน
2. P2 — สวน แปลง และทะเบียนต้น
3. P3 — วงจรฤดูการผลิต
4. P4 — งาน ปฏิทิน สูตรพ่น และค่าแรง
5. P5 — ทะเบียนสินค้า คลัง การซื้อ และบัญชี
6. P6 — ผลผลิต การขาย และ Traceability
7. P7 — สวนอัจฉริยะและการเฝ้าระวัง
8. P8 — รายงาน ต้นทุน และ GAP
9. P9 — ผู้ใช้ ความปลอดภัย PWA และเปิดใช้งานจริง
