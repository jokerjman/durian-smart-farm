"use client";
import "./p4.css";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Leaf,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

type Task = {
  id: string;
  farmId: string;
  plotId: string | null;
  seasonId: string | null;
  title: string;
  description: string | null;
  workType: string;
  priority: string;
  status: string;
  scheduledAt: number;
  completedAt: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  plotName: string | null;
  seasonName: string | null;
  tankLiters: number | null;
  tankCount: number | null;
  actualTankCount: number | null;
};
type Plot = { id: string; name: string; farmId: string; farmName: string };
type Member = { id: string; name: string };
type Season = { id: string; farmId: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  kind: string;
  brand: string | null;
  commonName: string | null;
  defaultRatePer200l: number | null;
  rateUnit: string | null;
  unit: string;
  stock: number;
};
type Material = {
  stockProductId?: string;
  productName: string;
  productKind: string;
  brand: string;
  commonName: string;
  ratePer200l: number;
  rateUnit: string;
};
type Worker = {
  id: string;
  name: string;
  payType: string;
  defaultRate: number;
  active: boolean;
};
type Entry = {
  id: string;
  workerName: string;
  workTitle: string | null;
  workDate: string;
  payType: string;
  quantity: number;
  rate: number;
  amount: number;
  transactionId: string;
};
const request = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init),
    x = await r.json();
  if (!r.ok) throw new Error(x.error || "ดำเนินการไม่สำเร็จ");
  return x;
};
const dateKey = (ts: number) =>
    new Date((ts + 7 * 3600) * 1000).toISOString().slice(0, 10),
  money = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(n);

export function WorkCalendarPage({
  refreshOverview,
}: {
  refreshOverview: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]),
    [plots, setPlots] = useState<Plot[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [seasons, setSeasons] = useState<Season[]>([]),
    [materials, setMaterials] = useState<any[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [defaultTank, setDefaultTank] = useState(200),
    [workers, setWorkers] = useState<Worker[]>([]),
    [entries, setEntries] = useState<Entry[]>([]),
    [tab, setTab] = useState<"tasks" | "calendar" | "labor">("tasks"),
    [modal, setModal] = useState<"task" | "spray" | "worker" | "labor" | null>(
      null,
    ),
    [q, setQ] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [month, setMonth] = useState(new Date());
  const load = () => {
    setLoading(true);
    Promise.all([request("/api/tasks"), request("/api/labor")])
      .then(([a, b]) => {
        setTasks(a.tasks || []);
        setPlots(a.plots || []);
        setMembers(a.members || []);
        setSeasons(a.seasons || []);
        setMaterials(a.materials || []);
        setProducts(a.products || []);
        setDefaultTank(a.defaultTankLiters || 200);
        setWorkers(b.workers || []);
        setEntries(b.entries || []);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const visible = useMemo(
    () =>
      tasks.filter((t) =>
        `${t.title} ${t.plotName || ""} ${t.assigneeName || ""}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [tasks, q],
  );
  const updateStatus = async (task: Task, status: string) => {
    setMessage("");
    try {
      await request("/api/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          status,
          actualTankCount: task.tankCount,
        }),
      });
      setMessage(
        status === "done"
          ? "ปิดงานและบันทึกยอดใช้จริงแล้ว"
          : "อัปเดตสถานะงานแล้ว",
      );
      load();
      refreshOverview();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const saved = (text: string) => {
    setModal(null);
    setMessage(text);
    load();
    refreshOverview();
  };
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังโหลดงานและปฏิทิน...
      </div>
    );
  return (
    <>
      <div className="head p4-head">
        <div>
          <small>PRODUCTION UPGRADE P4</small>
          <h1>งาน ปฏิทิน สูตรพ่น และค่าแรง</h1>
          <p>มอบหมายงานตามสวน/แปลง เชื่อมฤดูผลิต และคำนวณต้นทุนจากข้อมูลจริง</p>
        </div>
        <div className="p4-actions">
          <button onClick={() => setModal("task")}>
            <Plus /> Quick Add
          </button>
          <button className="primary" onClick={() => setModal("spray")}>
            <FlaskConical /> มอบหมายงานพ่น
          </button>
        </div>
      </div>
      {message && <p className="p4-message">{message}</p>}
      <div className="p4-tabs">
        <button
          className={tab === "tasks" ? "active" : ""}
          onClick={() => setTab("tasks")}
        >
          รายการงาน
        </button>
        <button
          className={tab === "calendar" ? "active" : ""}
          onClick={() => setTab("calendar")}
        >
          ปฏิทิน
        </button>
        <button
          className={tab === "labor" ? "active" : ""}
          onClick={() => setTab("labor")}
        >
          ค่าแรง
        </button>
      </div>
      {tab === "tasks" && (
        <>
          <div className="p4-filter">
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่องาน แปลง หรือผู้รับผิดชอบ"
            />
          </div>
          <section className="p4-task-list">
            {visible.length ? (
              visible.map((t) => (
                <article key={t.id}>
                  <i className={t.workType === "spray" ? "spray" : ""}>
                    {t.workType === "spray" ? <FlaskConical /> : <Check />}
                  </i>
                  <span>
                    <b>{t.title}</b>
                    <small>
                      {t.plotName || "ทุกพื้นที่"} ·{" "}
                      {t.assigneeName || "ยังไม่มอบหมาย"}
                      {t.seasonName ? ` · ${t.seasonName}` : ""}
                    </small>
                    {t.workType === "spray" && (
                      <em>
                        {t.tankCount || 0} ถัง × {t.tankLiters || 200} ลิตร ·{" "}
                        {materials.filter((m) => m.workItemId === t.id).length}{" "}
                        รายการ
                      </em>
                    )}
                  </span>
                  <time>
                    {new Date(t.scheduledAt * 1000).toLocaleString("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  <strong className={t.status}>
                    {t.status === "done"
                      ? "เสร็จแล้ว"
                      : t.status === "in_progress"
                        ? "กำลังทำ"
                        : "วางแผน"}
                  </strong>
                  <div>
                    {t.status === "planned" && (
                      <button onClick={() => updateStatus(t, "in_progress")}>
                        เริ่มงาน
                      </button>
                    )}
                    {t.status !== "done" && (
                      <button
                        className="done"
                        onClick={() => updateStatus(t, "done")}
                      >
                        เสร็จงาน
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="p4-empty">
                ยังไม่มีงาน กด Quick Add เพื่อเริ่มวางแผน
              </div>
            )}
          </section>
        </>
      )}
      {tab === "calendar" && (
        <CalendarView tasks={tasks} month={month} setMonth={setMonth} />
      )}{" "}
      {tab === "labor" && (
        <LaborView
          workers={workers}
          entries={entries}
          addWorker={() => setModal("worker")}
          addEntry={() => setModal("labor")}
        />
      )}{" "}
      {modal === "task" && (
        <TaskModal
          mode="general"
          products={products}
          plots={plots}
          members={members}
          seasons={seasons}
          defaultTank={defaultTank}
          close={() => setModal(null)}
          saved={() => saved("เพิ่มงานเรียบร้อยแล้ว")}
        />
      )}{" "}
      {modal === "spray" && (
        <TaskModal
          mode="spray"
          products={products}
          plots={plots}
          members={members}
          seasons={seasons}
          defaultTank={defaultTank}
          close={() => setModal(null)}
          saved={() => saved("มอบหมายงานพ่นและบันทึกสูตรเรียบร้อยแล้ว")}
        />
      )}{" "}
      {modal === "worker" && (
        <WorkerModal
          close={() => setModal(null)}
          saved={() => saved("เพิ่มทะเบียนคนงานเรียบร้อยแล้ว")}
        />
      )}{" "}
      {modal === "labor" && (
        <LaborModal
          workers={workers}
          tasks={tasks}
          close={() => setModal(null)}
          saved={() => saved("บันทึกค่าแรงและรายจ่ายเพียงครั้งเดียวแล้ว")}
        />
      )}
    </>
  );
}

function CalendarView({
  tasks,
  month,
  setMonth,
}: {
  tasks: Task[];
  month: Date;
  setMonth: (d: Date) => void;
}) {
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = new Date(year, m, 1).getDay(),
    days = new Date(year, m + 1, 0).getDate(),
    cells = [
      ...Array(first).fill(null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
  const shift = (n: number) => setMonth(new Date(year, m + n, 1));
  return (
    <section className="p4-calendar">
      <div>
        <button onClick={() => shift(-1)}>
          <ChevronLeft />
        </button>
        <h2>
          {month.toLocaleDateString("th-TH", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button onClick={() => shift(1)}>
          <ChevronRight />
        </button>
      </div>
      <div className="p4-week">
        {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((x) => (
          <b key={x}>{x}</b>
        ))}
      </div>
      <div className="p4-days">
        {cells.map((day, i) => {
          const key = day
              ? `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : "",
            items = day
              ? tasks.filter((t) => dateKey(t.scheduledAt) === key)
              : [];
          return (
            <article className={!day ? "blank" : ""} key={i}>
              {day && (
                <>
                  <strong>{day}</strong>
                  {items.slice(0, 3).map((t) => (
                    <span className={t.status} key={t.id}>
                      {t.title}
                    </span>
                  ))}
                  {items.length > 3 && <small>+{items.length - 3} งาน</small>}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LaborView({
  workers,
  entries,
  addWorker,
  addEntry,
}: {
  workers: Worker[];
  entries: Entry[];
  addWorker: () => void;
  addEntry: () => void;
}) {
  const total = entries.reduce((n, x) => n + Number(x.amount), 0);
  return (
    <>
      <div className="p4-labor-summary">
        <article>
          <Users />
          <span>
            คนงานในทะเบียน<b>{workers.filter((x) => x.active).length} คน</b>
          </span>
        </article>
        <article>
          <Clock />
          <span>
            รายการค่าแรง<b>{entries.length} รายการ</b>
          </span>
        </article>
        <article>
          <Check />
          <span>
            ยอดค่าแรงรวม<b>{money(total)}</b>
          </span>
        </article>
        <div>
          <button onClick={addWorker}>
            <Plus /> เพิ่มคนงาน
          </button>
          <button
            className="primary"
            onClick={addEntry}
            disabled={!workers.length}
          >
            <Plus /> บันทึกค่าแรง
          </button>
        </div>
      </div>
      <section className="p4-labor-list">
        <div>
          <b>วันที่</b>
          <b>คนงาน</b>
          <b>งาน</b>
          <b>รูปแบบ</b>
          <b>จำนวน × อัตรา</b>
          <b>รวม</b>
        </div>
        {entries.length ? (
          entries.map((x) => (
            <article key={x.id}>
              <span>{x.workDate}</span>
              <b>{x.workerName}</b>
              <span>{x.workTitle || "ไม่ผูกงาน"}</span>
              <span>
                {x.payType === "daily"
                  ? "รายวัน"
                  : x.payType === "piece"
                    ? "เหมางาน"
                    : "รายชั่วโมง"}
              </span>
              <span>
                {x.quantity} × {money(x.rate)}
              </span>
              <strong>{money(x.amount)}</strong>
            </article>
          ))
        ) : (
          <div className="p4-empty">ยังไม่มีรายการค่าแรง</div>
        )}
      </section>
    </>
  );
}

function TaskModal({
  mode,
  products,
  plots,
  members,
  seasons,
  defaultTank,
  close,
  saved,
}: {
  mode: "general" | "spray";
  products: Product[];
  plots: Plot[];
  members: Member[];
  seasons: Season[];
  defaultTank: number;
  close: () => void;
  saved: () => void;
}) {
  const [plotId, setPlot] = useState(plots[0]?.id || ""),
    [title, setTitle] = useState(mode === "spray" ? "ฉีดพ่น" : ""),
    [description, setDescription] = useState(""),
    [workType, setType] = useState(mode === "spray" ? "spray" : "general"),
    [priority, setPriority] = useState("normal"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [time, setTime] = useState("08:00"),
    [assigneeId, setAssignee] = useState(""),
    [tankLiters, setTankLiters] = useState(defaultTank),
    [tankCount, setTankCount] = useState(1),
    [mix, setMix] = useState<Material[]>([
      {
        productName: "",
        productKind: "ยา/สาร",
        brand: "",
        commonName: "",
        ratePer200l: 0,
        rateUnit: "มล.",
      },
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const plot = plots.find((x) => x.id === plotId),
    season = seasons.find((x) => x.farmId === plot?.farmId);
  const update = (i: number, key: keyof Material, value: string | number) =>
    setMix((x) => x.map((m, j) => (j === i ? { ...m, [key]: value } : m)));
  const chooseProduct = (i: number, productId: string) => {
    const product = products.find((x) => x.id === productId);
    if (!product) return update(i, "stockProductId", "");
    setMix((items) =>
      items.map((item, j) =>
        j === i
          ? {
              ...item,
              stockProductId: product.id,
              productName: product.name,
              productKind: product.kind,
              brand: product.brand || "",
              commonName: product.commonName || "",
              ratePer200l: Number(product.defaultRatePer200l) || 0,
              rateUnit: product.rateUnit || product.unit,
            }
          : item,
      ),
    );
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          farmId: plot?.farmId,
          plotId: plotId || null,
          seasonId: season?.id || null,
          title,
          description,
          workType,
          priority,
          scheduledAt: `${date}T${time}:00+07:00`,
          assigneeId: assigneeId || null,
          tankLiters,
          tankCount,
          materials: mode === "spray" ? mix : [],
        }),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={
        mode === "spray" ? "มอบหมายงานพ่นและกำหนดสูตร" : "Quick Add งานในสวน"
      }
      close={close}
    >
      <div className="p4-form-grid">
        <label>
          ชื่องาน
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          ประเภทงาน
          <select value={workType} onChange={(e) => setType(e.target.value)}>
            <option value="general">งานทั่วไป</option>
            <option value="water">ให้น้ำ</option>
            <option value="fertilize">ใส่ปุ๋ย</option>
            <option value="prune">ตัดแต่ง</option>
            <option value="inspect">ตรวจสวน</option>
            <option value="spray">ฉีดพ่น</option>
          </select>
        </label>
        <label>
          สวน / แปลง
          <select value={plotId} onChange={(e) => setPlot(e.target.value)}>
            <option value="">ทุกพื้นที่ในสวนหลัก</option>
            {plots.map((p) => (
              <option value={p.id} key={p.id}>
                {p.farmName} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ผู้รับผิดชอบ
          <select
            value={assigneeId}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">ยังไม่มอบหมาย</option>
            {members.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          วันที่
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          เวลา
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          ความสำคัญ
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="normal">ปกติ</option>
            <option value="high">เร่งด่วน</option>
            <option value="low">เมื่อสะดวก</option>
          </select>
        </label>
        <label>
          ฤดูผลิต
          <input value={season?.name || "ยังไม่มีฤดูปัจจุบัน"} readOnly />
        </label>
      </div>
      <label>
        รายละเอียด
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {mode === "spray" && (
        <>
          <div className="tank-settings">
            <label>
              ขนาดถัง (ลิตร)
              <input
                type="number"
                min="1"
                value={tankLiters}
                onChange={(e) => setTankLiters(Number(e.target.value))}
              />
            </label>
            <label>
              จำนวนถัง
              <input
                type="number"
                min="1"
                value={tankCount}
                onChange={(e) => setTankCount(Number(e.target.value))}
              />
            </label>
            <strong>น้ำรวม {tankLiters * tankCount} ลิตร</strong>
          </div>
          <div className="mix-head">
            <span>
              <b>สูตรผสมต่อถัง 200 ลิตร</b>
              <small>ระบุยี่ห้อ ชื่อสามัญ และอัตราส่วน</small>
            </span>
            <button
              onClick={() =>
                setMix((x) => [
                  ...x,
                  {
                    productName: "",
                    productKind: "ยา/สาร",
                    brand: "",
                    commonName: "",
                    ratePer200l: 0,
                    rateUnit: "มล.",
                  },
                ])
              }
            >
              <Plus /> เพิ่มรายการ
            </button>
          </div>
          <div className="mix-p4">
            {mix.map((m, i) => (
              <article key={i}>
                <label>
                  เลือกจากคลัง
                  <select
                    value={m.stockProductId || ""}
                    onChange={(e) => chooseProduct(i, e.target.value)}
                  >
                    <option value="">— กรอกเอง —</option>
                    {products.map((product) => (
                      <option value={product.id} key={product.id}>
                        {product.name} · คงเหลือ {product.stock} {product.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ชื่อผลิตภัณฑ์
                  <input
                    value={m.productName}
                    onChange={(e) => update(i, "productName", e.target.value)}
                  />
                </label>
                <label>
                  ประเภท
                  <select
                    value={m.productKind}
                    onChange={(e) => update(i, "productKind", e.target.value)}
                  >
                    <option>ยา/สาร</option>
                    <option>ฮอร์โมน</option>
                    <option>ปุ๋ย</option>
                    <option>ธาตุอาหาร</option>
                    <option>สารจับใบ</option>
                  </select>
                </label>
                <label>
                  ยี่ห้อ
                  <input
                    value={m.brand}
                    onChange={(e) => update(i, "brand", e.target.value)}
                  />
                </label>
                <label>
                  ชื่อสามัญ
                  <input
                    value={m.commonName}
                    onChange={(e) => update(i, "commonName", e.target.value)}
                  />
                </label>
                <label>
                  อัตรา / 200 ลิตร
                  <input
                    type="number"
                    value={m.ratePer200l || ""}
                    onChange={(e) =>
                      update(i, "ratePer200l", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  หน่วย
                  <select
                    value={m.rateUnit}
                    onChange={(e) => update(i, "rateUnit", e.target.value)}
                  >
                    <option>มล.</option>
                    <option>กรัม</option>
                    <option>กก.</option>
                    <option>ลิตร</option>
                  </select>
                </label>
                <strong>
                  ใช้รอบนี้{" "}
                  {(
                    m.ratePer200l *
                    tankCount *
                    (tankLiters / 200)
                  ).toLocaleString("th-TH")}{" "}
                  {m.rateUnit}
                </strong>
                <button
                  onClick={() => setMix((x) => x.filter((_, j) => j !== i))}
                >
                  <X />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {error && <p className="p4-error">{error}</p>}
      <Actions
        close={close}
        save={submit}
        disabled={
          busy ||
          !title ||
          !date ||
          (mode === "spray" &&
            mix.some((x) => !x.productName || x.ratePer200l <= 0))
        }
        busy={busy}
      />
    </Modal>
  );
}

function WorkerModal({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(""),
    [payType, setPayType] = useState("daily"),
    [rate, setRate] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request("/api/labor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "worker",
          name,
          payType,
          defaultRate: Number(rate),
        }),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="เพิ่มทะเบียนคนงาน" close={close}>
      <label>
        ชื่อคนงาน
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      <div className="p4-form-grid">
        <label>
          รูปแบบค่าแรง
          <select value={payType} onChange={(e) => setPayType(e.target.value)}>
            <option value="daily">รายวัน</option>
            <option value="hourly">รายชั่วโมง</option>
            <option value="piece">เหมางาน</option>
          </select>
        </label>
        <label>
          อัตราเริ่มต้น (บาท)
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="p4-error">{error}</p>}
      <Actions
        close={close}
        save={submit}
        disabled={!name || !Number(rate) || busy}
        busy={busy}
      />
    </Modal>
  );
}
function LaborModal({
  workers,
  tasks,
  close,
  saved,
}: {
  workers: Worker[];
  tasks: Task[];
  close: () => void;
  saved: () => void;
}) {
  const [workerId, setWorker] = useState(workers[0]?.id || ""),
    worker = workers.find((x) => x.id === workerId),
    [workItemId, setWork] = useState(""),
    [workDate, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [payType, setPayType] = useState(worker?.payType || "daily"),
    [quantity, setQty] = useState(1),
    [rate, setRate] = useState(worker?.defaultRate || 0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const changeWorker = (value: string) => {
    setWorker(value);
    const w = workers.find((x) => x.id === value);
    if (w) {
      setPayType(w.payType);
      setRate(w.defaultRate);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request("/api/labor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "entry",
          workerId,
          workItemId: workItemId || null,
          workDate,
          payType,
          quantity,
          rate,
        }),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="บันทึกค่าแรง" close={close}>
      <label>
        คนงาน
        <select value={workerId} onChange={(e) => changeWorker(e.target.value)}>
          {workers.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        เชื่อมกับงาน
        <select value={workItemId} onChange={(e) => setWork(e.target.value)}>
          <option value="">ไม่ผูกงาน</option>
          {tasks
            .filter((x) => x.status !== "cancelled")
            .map((x) => (
              <option value={x.id} key={x.id}>
                {x.title}
              </option>
            ))}
        </select>
      </label>
      <div className="p4-form-grid">
        <label>
          วันที่
          <input
            type="date"
            value={workDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          รูปแบบ
          <select value={payType} onChange={(e) => setPayType(e.target.value)}>
            <option value="daily">รายวัน</option>
            <option value="hourly">รายชั่วโมง</option>
            <option value="piece">เหมางาน</option>
          </select>
        </label>
        <label>
          {payType === "daily"
            ? "จำนวนวัน"
            : payType === "hourly"
              ? "จำนวนชั่วโมง"
              : "จำนวนงาน"}
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
        <label>
          อัตรา (บาท)
          <input
            type="number"
            min="0"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="p4-cost">
        <span>รวมค่าแรง</span>
        <b>{money(quantity * rate)}</b>
      </p>
      <p className="p4-note">
        <Check /> เมื่อบันทึก
        ระบบจะสร้างรายการรายจ่ายค่าแรงหนึ่งครั้งและเชื่อมกลับมาที่รายการนี้
      </p>
      {error && <p className="p4-error">{error}</p>}
      <Actions
        close={close}
        save={submit}
        disabled={!workerId || !workDate || quantity <= 0 || rate <= 0 || busy}
        busy={busy}
      />
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="backdrop">
      <div className="modal p4-modal">
        <button className="close" onClick={close}>
          <X />
        </button>
        <small>PRODUCTION UPGRADE P4</small>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Actions({
  close,
  save,
  disabled,
  busy,
}: {
  close: () => void;
  save: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  return (
    <div className="p4-modal-actions">
      <button onClick={close}>ยกเลิก</button>
      <button className="primary" onClick={save} disabled={disabled}>
        <Check />
        {busy ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </div>
  );
}
