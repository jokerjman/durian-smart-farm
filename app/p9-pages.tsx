"use client";
import "./p9.css";
import { useEffect, useState } from "react";
import {
  Check,
  Download,
  FileClock,
  KeyRound,
  Leaf,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: number | boolean;
  mustChangePassword: number | boolean;
  lastLoginAt: number | null;
  plotScopeId: string | null;
  plotScopeName: string | null;
};
type Plot = { id: string; name: string };
type Permission = { userId: string; permissionKey: string };
type UserData = {
  currentUserId: string;
  users: User[];
  permissions: Permission[];
  permissionKeys: string[];
  plots: Plot[];
};
type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  detailJson: string | null;
  createdAt: number;
  actorName: string;
  username: string | null;
};
const empty: UserData = {
  currentUserId: "",
  users: [],
  permissions: [],
  permissionKeys: [],
  plots: [],
};
const permissionLabels: Record<string, string> = {
  "dashboard.view": "ดู Dashboard และฤดูผลิต",
  "farms.manage": "จัดการสวน แปลง และการตั้งค่า",
  "trees.manage": "จัดการทะเบียนต้นทุเรียน",
  "work.view": "ดูงานและปฏิทิน",
  "work.manage": "สร้าง มอบหมาย และปิดงาน",
  "spray_formula.manage": "จัดการสูตรพ่นและการใช้ปัจจัย",
  "inventory.view": "ดูคลังปัจจัยการผลิต",
  "inventory.manage": "จัดการสินค้า การซื้อ และสต๊อก",
  "finance.view": "ดูบัญชีรายรับ–รายจ่าย",
  "finance.manage": "บันทึกและแก้ไขบัญชี",
  "harvest.manage": "จัดการผลผลิต การขาย และ QR",
  "reports.view": "ดูรายงานและประเมิน GAP",
  "smartfarm.manage": "จัดการสวนอัจฉริยะและการเฝ้าระวัง",
  "users.manage": "จัดการผู้ใช้และสิทธิ์",
  "audit.view": "ดูประวัติ Audit Log",
};
const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init),
    body = await response.json();
  if (!response.ok) throw new Error(body.error || "ดำเนินการไม่สำเร็จ");
  return body;
};
const dateTime = (value: number | null) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value * 1000))
    : "ยังไม่เคยเข้าสู่ระบบ";

export function AdminUsersPage() {
  const [data, setData] = useState<UserData>(empty),
    [tab, setTab] = useState<"users" | "audit" | "safety">("users"),
    [modal, setModal] = useState<{
      mode: "create" | "edit";
      user?: User;
    } | null>(null),
    [logs, setLogs] = useState<AuditLog[]>([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const load = () => {
    setLoading(true);
    request("/api/admin/users")
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    request("/api/admin/users")
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);
  const loadAudit = (q = query) =>
    request(`/api/admin/audit${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((x) => setLogs(x.logs || []))
      .catch((e) => setMessage(e.message));
  const openTab = (value: "users" | "audit" | "safety") => {
    setTab(value);
    if (value === "audit") void loadAudit();
  };
  const permissionsFor = (userId: string) =>
    data.permissions
      .filter((x) => x.userId === userId)
      .map((x) => x.permissionKey);
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังโหลดระบบผู้ใช้...
      </div>
    );
  return (
    <>
      <div className="head p9-head">
        <div>
          <small>PRODUCTION UPGRADE P9</small>
          <h1>ผู้ใช้ ความปลอดภัย และสำรองข้อมูล</h1>
          <p>
            Admin สร้างบัญชีภายใน กำหนดสิทธิ์ ตรวจประวัติ และส่งออกข้อมูลได้
          </p>
        </div>
        {tab === "users" && (
          <button
            className="primary"
            onClick={() => setModal({ mode: "create" })}
          >
            <Plus /> เพิ่มผู้ใช้
          </button>
        )}
      </div>
      {message && <p className="p9-message">{message}</p>}
      <div className="p9-tabs">
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => openTab("users")}
        >
          <Users /> ผู้ใช้และสิทธิ์
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => openTab("audit")}
        >
          <FileClock /> Audit Log
        </button>
        <button
          className={tab === "safety" ? "active" : ""}
          onClick={() => openTab("safety")}
        >
          <ShieldCheck /> ความปลอดภัยและสำรองข้อมูล
        </button>
      </div>
      {tab === "users" && (
        <UsersView
          data={data}
          permissionsFor={permissionsFor}
          edit={(user) => setModal({ mode: "edit", user })}
        />
      )}
      {tab === "audit" && (
        <AuditView
          logs={logs}
          query={query}
          setQuery={setQuery}
          search={() => loadAudit()}
        />
      )}
      {tab === "safety" && <SafetyView />}
      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          data={data}
          selected={modal.user ? permissionsFor(modal.user.id) : []}
          close={() => setModal(null)}
          saved={() => {
            setModal(null);
            setMessage(
              modal.mode === "create"
                ? "สร้างผู้ใช้ใหม่แล้ว"
                : "บันทึกผู้ใช้และยกเลิกเซสชันเดิมที่เกี่ยวข้องแล้ว",
            );
            load();
          }}
        />
      )}
    </>
  );
}

function UsersView({
  data,
  permissionsFor,
  edit,
}: {
  data: UserData;
  permissionsFor: (id: string) => string[];
  edit: (user: User) => void;
}) {
  const active = data.users.filter((x) => x.isActive).length;
  return (
    <>
      <div className="p9-summary">
        <article>
          <Users />
          <span>
            บัญชีทั้งหมด<b>{data.users.length} บัญชี</b>
          </span>
        </article>
        <article>
          <ShieldCheck />
          <span>
            กำลังใช้งาน<b>{active} บัญชี</b>
          </span>
        </article>
        <article>
          <LockKeyhole />
          <span>
            บังคับเปลี่ยนรหัสผ่าน
            <b>{data.users.filter((x) => x.mustChangePassword).length} บัญชี</b>
          </span>
        </article>
      </div>
      <div className="p9-user-table">
        <div>
          <b>ผู้ใช้</b>
          <b>แปลงรับผิดชอบ</b>
          <b>สิทธิ์</b>
          <b>เข้าสู่ระบบล่าสุด</b>
          <b>สถานะ</b>
          <b />
        </div>
        {data.users.map((user) => (
          <article key={user.id}>
            <span className="p9-user">
              <i>{user.name.slice(0, 2)}</i>
              <span>
                <b>{user.name}</b>
                <small>
                  @{user.username} · {user.role === "admin" ? "Admin" : "User"}
                </small>
              </span>
            </span>
            <span>{user.plotScopeName || "ไม่ระบุ"}</span>
            <span>
              {user.role === "admin"
                ? "ทุกสิทธิ์"
                : `${permissionsFor(user.id).length} สิทธิ์`}
            </span>
            <span>{dateTime(user.lastLoginAt)}</span>
            <em className={user.isActive ? "active" : "suspended"}>
              {user.isActive
                ? user.mustChangePassword
                  ? "รอเปลี่ยนรหัส"
                  : "ใช้งาน"
                : "ระงับ"}
            </em>
            {user.id === data.currentUserId || user.role === "admin" ? (
              <strong>
                <ShieldCheck /> ป้องกัน
              </strong>
            ) : (
              <button onClick={() => edit(user)}>
                <Pencil /> แก้ไข
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
function AuditView({
  logs,
  query,
  setQuery,
  search,
}: {
  logs: AuditLog[];
  query: string;
  setQuery: (x: string) => void;
  search: () => void;
}) {
  return (
    <>
      <div className="p9-search">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="ค้นหาผู้ใช้ การกระทำ หรือชนิดข้อมูล"
        />
        <button onClick={search}>ค้นหา</button>
      </div>
      <div className="audit-list">
        {logs.length ? (
          logs.map((log) => (
            <article key={log.id}>
              <i>
                <FileClock />
              </i>
              <span>
                <b>
                  {actionName(log.action)} · {entityName(log.entityType)}
                </b>
                <small>
                  {log.actorName} @{log.username || "-"} ·{" "}
                  {dateTime(log.createdAt)}
                </small>
              </span>
              <em>{log.entityId || "ระดับระบบ"}</em>
            </article>
          ))
        ) : (
          <div className="p9-empty">
            <FileClock /> ยังไม่มีประวัติที่ตรงกับการค้นหา
          </div>
        )}
      </div>
    </>
  );
}
function SafetyView() {
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const install = async () => {
    if (!installEvent) return;
    await (installEvent as Event & { prompt: () => Promise<void> }).prompt();
    setInstallEvent(null);
  };
  return (
    <div className="safety-grid">
      <section>
        <i>
          <Download />
        </i>
        <div>
          <b>ส่งออกข้อมูลสวน</b>
          <p>
            ดาวน์โหลดข้อมูลธุรกิจและ Audit Log เป็น JSON โดยไม่รวมรหัสผ่าน
            Session หรือ Recovery Code
          </p>
          <a href="/api/admin/export">
            <Download /> ดาวน์โหลดไฟล์สำรอง
          </a>
        </div>
      </section>
      <section>
        <i>
          <Smartphone />
        </i>
        <div>
          <b>ติดตั้งบนโทรศัพท์</b>
          <p>
            PWA ทำงานแบบหน้าจอแอป โดยไม่เก็บ API
            หรือข้อมูลส่วนตัวไว้ในแคชออฟไลน์
          </p>
          {installEvent ? (
            <button onClick={install}>
              <Smartphone /> ติดตั้งแอป
            </button>
          ) : (
            <span>ใช้เมนูเบราว์เซอร์ “เพิ่มไปยังหน้าจอโฮม”</span>
          )}
        </div>
      </section>
      <section>
        <i>
          <KeyRound />
        </i>
        <div>
          <b>มาตรการบัญชี</b>
          <p>
            ล็อก 15 นาทีเมื่อใส่รหัสผิด 5 ครั้ง, Session 8 ชั่วโมง, คุกกี้
            HttpOnly/SameSite และบังคับเปลี่ยนรหัสผ่านเริ่มต้น
          </p>
          <span>Admin รีเซ็ตรหัสผ่านและระงับบัญชีได้</span>
        </div>
      </section>
      <section>
        <i>
          <ShieldCheck />
        </i>
        <div>
          <b>สิ่งที่ไม่อยู่ในไฟล์สำรอง</b>
          <p>
            รหัสผ่านถูกเก็บแบบ salted PBKDF2 และไม่ถูกส่งออก พร้อมไม่ส่งออก
            token หรือรหัสกู้คืน
          </p>
          <span>ควรเก็บไฟล์สำรองในพื้นที่ปลอดภัย</span>
        </div>
      </section>
    </div>
  );
}

function UserModal({
  mode,
  user,
  data,
  selected,
  close,
  saved,
}: {
  mode: "create" | "edit";
  user?: User;
  data: UserData;
  selected: string[];
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(user?.name || ""),
    [username, setUsername] = useState(user?.username || ""),
    [password, setPassword] = useState(""),
    [plotScopeId, setPlot] = useState(user?.plotScopeId || ""),
    [active, setActive] = useState(user ? !!user.isActive : true),
    [permissions, setPermissions] = useState(selected),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toggle = (key: string) =>
    setPermissions((items) =>
      items.includes(key) ? items.filter((x) => x !== key) : [...items, key],
    );
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/users", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "create"
            ? { name, username, password, plotScopeId, permissions }
            : {
                userId: user?.id,
                name,
                plotScopeId,
                isActive: active,
                permissions,
                resetPassword: password,
              },
        ),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop">
      <div className="modal p9-modal">
        <button className="close" onClick={close}>
          <X />
        </button>
        <small>
          {mode === "create"
            ? "สร้างบัญชีภายในระบบ"
            : `แก้ไข @${user?.username}`}
        </small>
        <h2>{mode === "create" ? "เพิ่มผู้ใช้งาน" : "สิทธิ์และความปลอดภัย"}</h2>
        <div className="p9-form">
          <label>
            ชื่อที่แสดง
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            ชื่อผู้ใช้
            <input
              value={username}
              disabled={mode === "edit"}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="ตัวอักษรอังกฤษ/ตัวเลข"
            />
          </label>
          <label>
            {mode === "create"
              ? "รหัสผ่านเริ่มต้น"
              : "ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"}
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 10 ตัว มีตัวอักษรและตัวเลข"
            />
          </label>
          <label>
            แปลงที่รับผิดชอบ
            <select
              value={plotScopeId}
              onChange={(e) => setPlot(e.target.value)}
            >
              <option value="">ไม่ระบุ/ดูแลหลายแปลง</option>
              {data.plots.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {mode === "edit" && (
          <button
            className={`account-toggle ${active ? "on" : ""}`}
            onClick={() => setActive(!active)}
          >
            <i>{active && <Check />}</i>
            <span>
              <b>{active ? "บัญชีเปิดใช้งาน" : "บัญชีถูกระงับ"}</b>
              <small>เมื่อระงับ ระบบจะออกจากระบบทุกอุปกรณ์</small>
            </span>
          </button>
        )}
        <div className="permission-title">
          <b>สิทธิ์การใช้งาน</b>
          <span>เลือกเฉพาะงานที่ผู้ใช้นี้รับผิดชอบ</span>
        </div>
        <div className="p9-permissions">
          {data.permissionKeys.map((key) => (
            <button
              key={key}
              className={permissions.includes(key) ? "selected" : ""}
              onClick={() => toggle(key)}
            >
              <i>{permissions.includes(key) && <Check />}</i>
              <span>
                <b>{permissionLabels[key] || key}</b>
                <small>{key}</small>
              </span>
            </button>
          ))}
        </div>
        {error && <p className="p9-error">{error}</p>}
        <p className="p9-note">
          <LockKeyhole />{" "}
          {mode === "create" || password
            ? "ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก"
            : "การเปลี่ยนสิทธิ์หรือระงับบัญชีมีผลทันที"}
        </p>
        <div className="p9-modal-actions">
          <button onClick={close}>ยกเลิก</button>
          <button
            className="primary"
            disabled={
              busy || !name || (mode === "create" && (!username || !password))
            }
            onClick={submit}
          >
            {busy ? "กำลังบันทึก..." : "บันทึกผู้ใช้"}
          </button>
        </div>
      </div>
    </div>
  );
}
function actionName(value: string) {
  return (
    (
      {
        create: "สร้าง",
        update: "แก้ไข",
        resolve: "ปิดเหตุ",
        export: "ส่งออก",
        grade: "คัดเกรด",
        complete: "เสร็จงาน",
      } as Record<string, string>
    )[value] || value
  );
}
function entityName(value: string) {
  return (
    (
      {
        local_user: "ผู้ใช้",
        transaction: "บัญชี",
        farm_backup: "ไฟล์สำรอง",
        gap_assessment: "GAP",
        sensor_reading: "ค่าตรวจวัด",
        work_item: "งาน",
        harvest_batch: "ผลผลิต",
      } as Record<string, string>
    )[value] || value
  );
}
