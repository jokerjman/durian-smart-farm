"use client";
import "./p6.css";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  Leaf,
  PackageCheck,
  Plus,
  QrCode,
  Scale,
  ShoppingBag,
  Tag,
  Trees,
  X,
} from "lucide-react";
type Batch = {
  id: string;
  plotId: string | null;
  seasonId: string | null;
  lotCode: string;
  variety: string;
  harvestedOn: string;
  totalWeightKg: number;
  fruitCount: number;
  status: string;
  traceKey: string;
  plotName: string | null;
  seasonName: string | null;
  gradedWeightKg: number;
  soldWeightKg: number;
  salesAmount: number;
  treeCount: number;
};
type Grade = {
  id: string;
  batchId: string;
  grade: string;
  weightKg: number;
  fruitCount: number | null;
  note: string | null;
};
type Sale = {
  id: string;
  batchId: string;
  buyerName: string;
  weightKg: number;
  pricePerKg: number;
  totalAmount: number;
  deliveryOn: string;
  status: string;
  transactionId: string;
  lotCode: string;
};
type Plot = { id: string; name: string };
type Season = { id: string; name: string; status: string };
type Tree = {
  id: string;
  durianId: string;
  variety: string;
  plotId: string;
  plotName: string;
};
const api = async (url: string, init?: RequestInit) => {
    const r = await fetch(url, init),
      x = await r.json();
    if (!r.ok) throw new Error(x.error || "ดำเนินการไม่สำเร็จ");
    return x;
  },
  money = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(n);
export function HarvestPage({
  refreshOverview,
}: {
  refreshOverview: () => void;
}) {
  const [batches, setBatches] = useState<Batch[]>([]),
    [grades, setGrades] = useState<Grade[]>([]),
    [sales, setSales] = useState<Sale[]>([]),
    [plots, setPlots] = useState<Plot[]>([]),
    [seasons, setSeasons] = useState<Season[]>([]),
    [trees, setTrees] = useState<Tree[]>([]),
    [tab, setTab] = useState<"batches" | "sales">("batches"),
    [modal, setModal] = useState<{
      kind: "create" | "grade" | "sale" | "trace";
      batch?: Batch;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const load = () => {
    setLoading(true);
    api("/api/harvests")
      .then((x) => {
        setBatches(x.batches || []);
        setGrades(x.grades || []);
        setSales(x.sales || []);
        setPlots(x.plots || []);
        setSeasons(x.seasons || []);
        setTrees(x.trees || []);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
  }, []);
  const saved = (text: string) => {
    setModal(null);
    setMessage(text);
    load();
    refreshOverview();
  };
  const total = batches.reduce((n, x) => n + Number(x.totalWeightKg), 0),
    sold = batches.reduce((n, x) => n + Number(x.soldWeightKg), 0),
    revenue = sales
      .filter((x) => x.status !== "cancelled")
      .reduce((n, x) => n + Number(x.totalAmount), 0);
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังโหลดผลผลิต...
      </div>
    );
  return (
    <>
      <div className="head p6-head">
        <div>
          <small>PRODUCTION UPGRADE P6</small>
          <h1>ผลผลิต การขาย และตรวจสอบย้อนกลับ</h1>
          <p>
            เชื่อมรุ่นเก็บเกี่ยวกับสวน แปลง ต้น ฤดู การคัดเกรด รายรับ และ QR
          </p>
        </div>
        <button
          className="primary"
          onClick={() => setModal({ kind: "create" })}
        >
          <Plus /> บันทึกเก็บเกี่ยว
        </button>
      </div>
      <div className="p6-stats">
        <Stat
          icon={<PackageCheck />}
          label="รุ่นผลผลิต"
          value={`${batches.length} รุ่น`}
        />
        <Stat
          icon={<Scale />}
          label="เก็บเกี่ยวรวม"
          value={`${total.toLocaleString("th-TH")} กก.`}
        />
        <Stat
          icon={<ShoppingBag />}
          label="ขายแล้ว"
          value={`${sold.toLocaleString("th-TH")} กก.`}
        />
        <Stat icon={<Tag />} label="รายรับจากการขาย" value={money(revenue)} />
      </div>
      {message && <p className="p6-message">{message}</p>}
      <div className="p6-tabs">
        <button
          className={tab === "batches" ? "active" : ""}
          onClick={() => setTab("batches")}
        >
          รุ่นผลผลิต
        </button>
        <button
          className={tab === "sales" ? "active" : ""}
          onClick={() => setTab("sales")}
        >
          ประวัติการขาย
        </button>
      </div>
      {tab === "batches" ? (
        <div className="p6-list">
          <div>
            <b>รุ่น / แหล่งผลิต</b>
            <b>เก็บเกี่ยว</b>
            <b>คัดเกรด</b>
            <b>ขายแล้ว</b>
            <b>สถานะ</b>
            <b />
          </div>
          {batches.length ? (
            batches.map((b) => (
              <article key={b.id}>
                <span>
                  <b>{b.lotCode}</b>
                  <small>
                    {b.variety} · {b.plotName || "ระดับสวน"} · {b.treeCount} ต้น
                  </small>
                </span>
                <span>
                  {b.harvestedOn}
                  <small>
                    {Number(b.totalWeightKg).toLocaleString("th-TH")} กก. ·{" "}
                    {b.fruitCount} ผล
                  </small>
                </span>
                <span>
                  {Number(b.gradedWeightKg).toLocaleString("th-TH")} กก.
                  <small>
                    {grades
                      .filter((x) => x.batchId === b.id)
                      .map((x) => x.grade)
                      .join(", ") || "ยังไม่คัดเกรด"}
                  </small>
                </span>
                <span>
                  {Number(b.soldWeightKg).toLocaleString("th-TH")} กก.
                  <small>{money(b.salesAmount)}</small>
                </span>
                <em className={b.status}>{statusName(b.status)}</em>
                <div>
                  <button onClick={() => setModal({ kind: "grade", batch: b })}>
                    คัดเกรด
                  </button>
                  <button
                    onClick={() => setModal({ kind: "sale", batch: b })}
                    disabled={b.soldWeightKg >= b.gradedWeightKg}
                  >
                    ขาย
                  </button>
                  <button onClick={() => setModal({ kind: "trace", batch: b })}>
                    <QrCode />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <Empty text="ยังไม่มีรุ่นผลผลิต กดบันทึกเก็บเกี่ยวเพื่อเริ่มต้น" />
          )}
        </div>
      ) : (
        <div className="p6-list sales">
          <div>
            <b>วันที่ส่งมอบ</b>
            <b>รุ่น</b>
            <b>ผู้ซื้อ</b>
            <b>น้ำหนัก × ราคา</b>
            <b>ยอดรวม</b>
            <b>บัญชี</b>
          </div>
          {sales.length ? (
            sales.map((s) => (
              <article key={s.id}>
                <span>{s.deliveryOn}</span>
                <b>{s.lotCode}</b>
                <span>{s.buyerName}</span>
                <span>
                  {s.weightKg} กก. × {money(s.pricePerKg)}
                </span>
                <strong>{money(s.totalAmount)}</strong>
                <em>สร้างรายรับแล้ว</em>
              </article>
            ))
          ) : (
            <Empty text="ยังไม่มีประวัติการขาย" />
          )}
        </div>
      )}
      {modal?.kind === "create" && (
        <CreateModal
          plots={plots}
          seasons={seasons}
          trees={trees}
          close={() => setModal(null)}
          saved={() => saved("บันทึกรุ่นผลผลิตและรหัสตรวจสอบแล้ว")}
        />
      )}{" "}
      {modal?.kind === "grade" && modal.batch && (
        <GradeModal
          batch={modal.batch}
          initial={grades.filter((x) => x.batchId === modal.batch!.id)}
          close={() => setModal(null)}
          saved={() => saved("บันทึกผลการคัดเกรดแล้ว")}
        />
      )}{" "}
      {modal?.kind === "sale" && modal.batch && (
        <SaleModal
          batch={modal.batch}
          close={() => setModal(null)}
          saved={() => saved("บันทึกการขายและสร้างรายรับเพียงครั้งเดียวแล้ว")}
        />
      )}{" "}
      {modal?.kind === "trace" && modal.batch && (
        <TraceModal batch={modal.batch} close={() => setModal(null)} />
      )}
    </>
  );
}
function CreateModal({
  plots,
  seasons,
  trees,
  close,
  saved,
}: {
  plots: Plot[];
  seasons: Season[];
  trees: Tree[];
  close: () => void;
  saved: () => void;
}) {
  const [plotId, setPlot] = useState(plots[0]?.id || ""),
    [seasonId, setSeason] = useState(
      seasons.find((x) =>
        ["current", "active", "in_progress"].includes(x.status),
      )?.id || "",
    ),
    [variety, setVariety] = useState("หมอนทอง"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [weight, setWeight] = useState(0),
    [fruitCount, setCount] = useState(0),
    [treeIds, setTreeIds] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const available = trees.filter((x) => !plotId || x.plotId === plotId);
  useEffect(
    () =>
      setTreeIds((x) => x.filter((id) => available.some((t) => t.id === id))),
    [plotId],
  );
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/harvests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          plotId: plotId || null,
          seasonId: seasonId || null,
          variety,
          harvestedOn: date,
          totalWeightKg: weight,
          fruitCount,
          treeIds,
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
    <Modal title="บันทึกการเก็บเกี่ยว" close={close}>
      <div className="p6-form">
        <label>
          แปลง
          <select value={plotId} onChange={(e) => setPlot(e.target.value)}>
            <option value="">ข้อมูลระดับสวน</option>
            {plots.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ฤดูผลิต
          <select value={seasonId} onChange={(e) => setSeason(e.target.value)}>
            <option value="">ไม่ผูกฤดู</option>
            {seasons.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="พันธุ์" value={variety} set={setVariety} />
        <Field
          label="วันที่เก็บเกี่ยว"
          type="date"
          value={date}
          set={setDate}
        />
        <Field
          label="น้ำหนักรวม (กก.)"
          type="number"
          value={weight}
          set={(v) => setWeight(Number(v))}
        />
        <Field
          label="จำนวนผล"
          type="number"
          value={fruitCount}
          set={(v) => setCount(Number(v))}
        />
      </div>
      <div className="tree-picker">
        <b>เลือกต้นทุเรียนในรุ่นนี้ (ไม่บังคับ)</b>
        <small>ช่วยให้ QR ตรวจสอบย้อนกลับได้ถึง Durian ID</small>
        <div>
          {available.length ? (
            available.map((t) => (
              <button
                className={treeIds.includes(t.id) ? "selected" : ""}
                onClick={() =>
                  setTreeIds((x) =>
                    x.includes(t.id)
                      ? x.filter((id) => id !== t.id)
                      : [...x, t.id],
                  )
                }
                key={t.id}
              >
                <Trees />
                {t.durianId}
              </button>
            ))
          ) : (
            <span>ยังไม่มีต้นในแปลงนี้ สามารถบันทึกระดับแปลงได้</span>
          )}
        </div>
      </div>
      {error && <AlertText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={!variety || !date || weight <= 0}
      />
    </Modal>
  );
}
function GradeModal({
  batch,
  initial,
  close,
  saved,
}: {
  batch: Batch;
  initial: Grade[];
  close: () => void;
  saved: () => void;
}) {
  const [items, setItems] = useState(
      initial.length
        ? initial.map((x) => ({
            grade: x.grade,
            weightKg: x.weightKg,
            fruitCount: x.fruitCount || 0,
            note: x.note || "",
          }))
        : [
            { grade: "เกรด A", weightKg: 0, fruitCount: 0, note: "" },
            { grade: "เกรด B", weightKg: 0, fruitCount: 0, note: "" },
            { grade: "ตกเกรด", weightKg: 0, fruitCount: 0, note: "" },
          ],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (i: number, k: string, v: any) =>
      setItems((x) => x.map((r, j) => (j === i ? { ...r, [k]: v } : r))),
    total = items.reduce((n, x) => n + Number(x.weightKg), 0);
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/harvests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "grade",
          batchId: batch.id,
          grades: items,
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
    <Modal title={`คัดเกรด ${batch.lotCode}`} close={close}>
      <p className="p6-balance">
        น้ำหนักรุ่น <b>{batch.totalWeightKg} กก.</b>
        <span>
          คัดแล้ว {total} กก. · คงเหลือ{" "}
          {(batch.totalWeightKg - total).toLocaleString("th-TH")} กก.
        </span>
      </p>
      {items.map((x, i) => (
        <div className="grade-row" key={i}>
          <Field
            label="ชื่อเกรด"
            value={x.grade}
            set={(v) => set(i, "grade", v)}
          />
          <Field
            label="น้ำหนัก (กก.)"
            type="number"
            value={x.weightKg}
            set={(v) => set(i, "weightKg", Number(v))}
          />
          <Field
            label="จำนวนผล"
            type="number"
            value={x.fruitCount}
            set={(v) => set(i, "fruitCount", Number(v))}
          />
          <Field
            label="หมายเหตุ"
            value={x.note}
            set={(v) => set(i, "note", v)}
          />
        </div>
      ))}
      <button
        className="add-grade"
        onClick={() =>
          setItems((x) => [
            ...x,
            { grade: "", weightKg: 0, fruitCount: 0, note: "" },
          ])
        }
      >
        <Plus /> เพิ่มเกรด
      </button>
      {error && <AlertText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={total <= 0 || total > batch.totalWeightKg}
      />
    </Modal>
  );
}
function SaleModal({
  batch,
  close,
  saved,
}: {
  batch: Batch;
  close: () => void;
  saved: () => void;
}) {
  const remaining = batch.gradedWeightKg - batch.soldWeightKg,
    [buyerName, setBuyer] = useState(""),
    [weightKg, setWeight] = useState(remaining),
    [price, setPrice] = useState(0),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/harvests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "sale",
          batchId: batch.id,
          buyerName,
          weightKg,
          pricePerKg: price,
          deliveryOn: date,
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
    <Modal title={`ขายผลผลิต ${batch.lotCode}`} close={close}>
      <p className="p6-balance">
        พร้อมขายคงเหลือ <b>{remaining.toLocaleString("th-TH")} กก.</b>
      </p>
      <div className="p6-form">
        <Field label="ผู้ซื้อ" value={buyerName} set={setBuyer} />
        <Field label="วันที่ส่งมอบ" type="date" value={date} set={setDate} />
        <Field
          label="น้ำหนักขาย (กก.)"
          type="number"
          value={weightKg}
          set={(v) => setWeight(Number(v))}
        />
        <Field
          label="ราคาต่อกิโลกรัม"
          type="number"
          value={price}
          set={(v) => setPrice(Number(v))}
        />
      </div>
      <p className="sale-total">
        <span>ยอดขายรวม</span>
        <b>{money(weightKg * price)}</b>
      </p>
      <p className="dedupe">
        <Check /> ระบบสร้างรายรับในบัญชีอัตโนมัติหนึ่งครั้ง
      </p>
      {error && <AlertText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={
          !buyerName || weightKg <= 0 || weightKg > remaining || price <= 0
        }
      />
    </Modal>
  );
}
function TraceModal({ batch, close }: { batch: Batch; close: () => void }) {
  const [qr, setQr] = useState(""),
    url =
      typeof location !== "undefined"
        ? `${location.origin}/trace/${batch.traceKey}`
        : "";
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 260, margin: 1 }).then(setQr);
  }, [url]);
  return (
    <Modal title="QR ตรวจสอบย้อนกลับ" close={close}>
      <div className="trace-modal-card">
        {qr && <img src={qr} alt={`QR ${batch.lotCode}`} />}
        <div>
          <QrCode />
          <b>{batch.lotCode}</b>
          <span>
            {batch.variety} · {batch.harvestedOn}
          </span>
          <a href={url} target="_blank">
            เปิดหน้าตรวจสอบ <ExternalLink />
          </a>
        </div>
      </div>
      <p className="p6-trace-note">
        QR นี้เปิดดูแหล่งผลิต รุ่นเก็บเกี่ยว เกรด ต้นทุเรียน
        และประวัติการดูแลที่เกี่ยวข้องได้โดยไม่ต้องเข้าสู่ระบบ
      </p>
    </Modal>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article>
      {icon}
      <span>
        {label}
        <b>{value}</b>
      </span>
    </article>
  );
}
function statusName(x: string) {
  return (
    (
      {
        awaiting_grade: "รอคัดเกรด",
        graded: "คัดบางส่วน",
        ready_for_sale: "พร้อมขาย",
        partially_sold: "ขายบางส่วน",
        sold_out: "ขายหมด",
      } as Record<string, string>
    )[x] || x
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="p6-empty">
      <Leaf /> {text}
    </div>
  );
}
function Field({
  label,
  value,
  set,
  type = "text",
}: {
  label: string;
  value: any;
  set: (v: string) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function AlertText({ text }: { text: string }) {
  return <p className="p6-error">{text}</p>;
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
      <div className="modal p6-modal">
        <button className="close" onClick={close}>
          <X />
        </button>
        <small>PRODUCTION UPGRADE P6</small>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Actions({
  close,
  save,
  busy,
  disabled,
}: {
  close: () => void;
  save: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="p6-modal-actions">
      <button onClick={close}>ยกเลิก</button>
      <button className="primary" onClick={save} disabled={busy || disabled}>
        <Check />
        {busy ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </div>
  );
}
