"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import "./p5.css";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileImage,
  Leaf,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  TriangleAlert,
  X,
} from "lucide-react";
type Product = {
  id: string;
  sku: string;
  name: string;
  kind: string;
  brand: string | null;
  commonName: string | null;
  formulation: string | null;
  registrationNo: string | null;
  packageSize: number | null;
  packageUnit: string | null;
  packageCountUnit: string | null;
  defaultRatePer200l: number | null;
  rateUnit: string | null;
  defaultCropStage: string | null;
  defaultTargetIssue: string | null;
  phiDays: number | null;
  unit: string;
  minimumStock: number;
  stock: number;
  lotCount: number;
  nearestExpiry: string | null;
  lastUnitPrice: number | null;
};
type Purchase = {
  id: string;
  supplier: string;
  invoiceNo: string | null;
  purchasedOn: string;
  totalAmount: number;
  transactionId: string;
  receiptKey: string | null;
  lineCount: number;
};
type Movement = {
  id: string;
  movementType: string;
  quantity: number;
  occurredAt: number;
  note: string | null;
  productName: string;
  lotNo: string | null;
  workTitle: string | null;
};
type Transaction = {
  id: string;
  type: string;
  title: string;
  amount: number;
  occurredOn: string;
  receiptKey: string | null;
  categoryName: string;
  plotName: string | null;
  seasonName: string | null;
  source: string;
};
type Line = {
  productId: string;
  sku: string;
  name: string;
  kind: string;
  brand: string;
  commonName: string;
  formulation: string;
  registrationNo: string;
  packageQty: number;
  packageSize: number;
  packageUnit: string;
  packageCountUnit: string;
  unitPrice: number;
  discount: number;
  lotNo: string;
  expiresOn: string;
  ratePer200l: number;
  rateUnit: string;
  minimumStock: number;
  cropStage: string;
  targetIssue: string;
  phiDays: number;
};
const PRODUCT_KINDS = [
    "ปุ๋ยเม็ด",
    "ปุ๋ยเกล็ด/ใบ",
    "สารกำจัดแมลง",
    "สารกำจัดเชื้อรา",
    "ฮอร์โมน/สารเสริม",
    "ธาตุอาหารรอง/เสริม",
    "สารจับใบ",
    "วัสดุสิ้นเปลือง",
    "อื่นๆ",
  ],
  PACKAGE_COUNT_UNITS = ["ถุง", "กระสอบ", "ขวด", "แกลลอน", "ซอง", "ลัง", "กล่อง", "ชิ้น"],
  QUANTITY_UNITS = ["กก.", "กรัม", "ลิตร", "มล.", "ชิ้น"],
  CROP_STAGES = [
    "ไม่ระบุ",
    "ฟื้นฟูต้นหลังเก็บเกี่ยว",
    "แตกใบอ่อน",
    "ทำสาร/สะสมอาหาร",
    "เริ่มออกดอก",
    "ดอกบาน",
    "ติดผล",
    "ระยะผลอ่อน",
    "ขยายผล",
    "ทำหวานก่อนตัด",
  ],
  TARGET_ISSUES = [
    "ไม่ระบุ",
    "บำรุงต้นและใบ",
    "สะสมอาหาร/สร้างตาดอก",
    "บำรุงดอกและการติดผล",
    "บำรุงและขยายผล",
    "ป้องกันเพลี้ยไก่แจ้",
    "ป้องกันหนอนเจาะผล",
    "ป้องกันไรแดง",
    "ป้องกันโรครากเน่าโคนเน่า",
    "รักษาโรคราใบติด",
    "ฟื้นฟูต้นหลังเก็บเกี่ยว",
    "อื่นๆ",
  ],
  PHI_OPTIONS = ["0|ไม่กำหนด/ไม่ใช่สารเคมี", "1|1 วัน", "3|3 วัน", "7|7 วัน", "14|14 วัน", "21|21 วัน", "30|30 วัน"];
const api = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init),
    x = await r.json();
  if (!r.ok) throw new Error(x.error || "ดำเนินการไม่สำเร็จ");
  return x;
};
const money = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 2,
    }).format(n),
  blankLine = (): Line => ({
    productId: "",
    sku: "",
    name: "",
    kind: "สารกำจัดแมลง",
    brand: "",
    commonName: "",
    formulation: "",
    registrationNo: "",
    packageQty: 1,
    packageSize: 1,
    packageUnit: "มล.",
    packageCountUnit: "ขวด",
    unitPrice: 0,
    discount: 0,
    lotNo: "",
    expiresOn: "",
    ratePer200l: 0,
    rateUnit: "มล.",
    minimumStock: 0,
    cropStage: "ไม่ระบุ",
    targetIssue: "ไม่ระบุ",
    phiDays: 0,
  });

export function InventoryPage({
  refreshOverview,
}: {
  refreshOverview: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]),
    [purchases, setPurchases] = useState<Purchase[]>([]),
    [movements, setMovements] = useState<Movement[]>([]),
    [tab, setTab] = useState<"products" | "purchases" | "movements">(
      "products",
    ),
    [modal, setModal] = useState<"product" | "purchase" | "adjust" | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [q, setQ] = useState("");
  const load = () => {
    setLoading(true);
    Promise.all([api("/api/inventory"), api("/api/purchases")])
      .then(([a, b]) => {
        setProducts(a.products || []);
        setMovements(a.movements || []);
        setPurchases(b.purchases || []);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };
  // The initial request synchronizes inventory state with D1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  const saved = (m: string) => {
    setModal(null);
    setMessage(m);
    load();
    refreshOverview();
  };
  const filtered = useMemo(
      () =>
        products.filter((x) =>
          `${x.sku} ${x.name} ${x.brand || ""} ${x.commonName || ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        ),
      [products, q],
    ),
    low = products.filter(
      (x) => Number(x.stock) <= Number(x.minimumStock),
    ).length,
    total = products.reduce((n, x) => n + Number(x.stock), 0);
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังโหลดคลัง...
      </div>
    );
  return (
    <>
      <Head
        title="คลังปัจจัยการผลิต"
        detail="ทะเบียนยาประจำ รับเข้าตาม Lot และตัดสต๊อกอัตโนมัติจากงาน"
      />
      <div className="p5-stats">
        <Stat
          icon={<Package />}
          label="สินค้าใช้งาน"
          value={`${products.length} รายการ`}
        />
        <Stat
          icon={<TriangleAlert />}
          label="ถึงจุดสั่งซื้อ"
          value={`${low} รายการ`}
          warn={low > 0}
        />
        <Stat
          icon={<ShoppingCart />}
          label="ใบซื้อ"
          value={`${purchases.length} ใบ`}
        />
        <Stat
          icon={<Check />}
          label="ยอดคงเหลือรวม"
          value={total.toLocaleString("th-TH")}
        />
      </div>
      {message && <p className="p5-message">{message}</p>}
      <div className="p5-toolbar">
        <div className="p5-tabs">
          <button
            className={tab === "products" ? "active" : ""}
            onClick={() => setTab("products")}
          >
            ทะเบียนสินค้า
          </button>
          <button
            className={tab === "purchases" ? "active" : ""}
            onClick={() => setTab("purchases")}
          >
            ประวัติซื้อ
          </button>
          <button
            className={tab === "movements" ? "active" : ""}
            onClick={() => setTab("movements")}
          >
            ความเคลื่อนไหว
          </button>
        </div>
        <div>
          <button onClick={() => setModal("product")}>
            <Plus /> เพิ่มสินค้า
          </button>
          <button onClick={() => setModal("adjust")}>
            <Package /> ปรับสต๊อก
          </button>
          <button className="primary" onClick={() => setModal("purchase")}>
            <ShoppingCart /> บันทึกการซื้อ
          </button>
        </div>
      </div>
      {tab === "products" && (
        <>
          <div className="p5-search">
            <Search />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหารหัส ชื่อ ยี่ห้อ หรือชื่อสามัญ"
            />
          </div>
          <div className="p5-table products">
            <div>
              <b>สินค้า</b>
              <b>รายละเอียด</b>
              <b>ขนาดบรรจุ</b>
              <b>Lot / หมดอายุ</b>
              <b>คงเหลือ</b>
            </div>
            {filtered.length ? (
              filtered.map((x) => (
                <article key={x.id}>
                  <span>
                    <b>{x.name}</b>
                    <small>
                      {x.sku} · {x.kind}
                    </small>
                  </span>
                  <span>
                    {x.brand || "ไม่ระบุยี่ห้อ"}
                    <small>
                      {x.commonName || "ไม่ระบุชื่อสามัญ"}
                      {x.formulation ? ` · ${x.formulation}` : ""}
                    </small>
                  </span>
                  <span>
                    {x.packageSize || "-"} {x.packageUnit || x.unit}
                    <small>
                      {x.defaultRatePer200l
                        ? `${x.defaultRatePer200l} ${x.rateUnit || x.unit}/200 ลิตร`
                        : "ยังไม่กำหนดอัตรา"}
                    </small>
                  </span>
                  <span>
                    {x.lotCount} Lot
                    <small>
                      {x.nearestExpiry
                        ? `ใกล้สุด ${x.nearestExpiry}`
                        : "ไม่มีวันหมดอายุ"}
                    </small>
                  </span>
                  <strong
                    className={
                      Number(x.stock) <= Number(x.minimumStock) ? "low" : ""
                    }
                  >
                    {Number(x.stock).toLocaleString("th-TH")} {x.unit}
                    <small>ขั้นต่ำ {x.minimumStock || 0}</small>
                  </strong>
                </article>
              ))
            ) : (
              <Empty text="ยังไม่มีสินค้าในทะเบียน" />
            )}
          </div>
        </>
      )}
      {tab === "purchases" && (
        <div className="p5-table purchases">
          <div>
            <b>วันที่</b>
            <b>ผู้ขาย / เลขที่</b>
            <b>สินค้า</b>
            <b>ยอดรวม</b>
            <b>หลักฐาน</b>
          </div>
          {purchases.length ? (
            purchases.map((x) => (
              <article key={x.id}>
                <span>{x.purchasedOn}</span>
                <span>
                  <b>{x.supplier}</b>
                  <small>{x.invoiceNo || "ไม่มีเลขที่เอกสาร"}</small>
                </span>
                <span>{x.lineCount} รายการ</span>
                <strong>{money(x.totalAmount)}</strong>
                <span>
                  {x.receiptKey ? (
                    <a href={x.receiptKey} target="_blank">
                      ดูใบเสร็จ
                    </a>
                  ) : (
                    "—"
                  )}
                </span>
              </article>
            ))
          ) : (
            <Empty text="ยังไม่มีประวัติการซื้อ" />
          )}
        </div>
      )}
      {tab === "movements" && (
        <div className="p5-table movements">
          <div>
            <b>วันเวลา</b>
            <b>สินค้า</b>
            <b>ประเภท</b>
            <b>จำนวน</b>
            <b>ที่มา</b>
          </div>
          {movements.length ? (
            movements.map((x) => (
              <article key={x.id}>
                <span>
                  {new Date(x.occurredAt * 1000).toLocaleString("th-TH")}
                </span>
                <span>
                  <b>{x.productName}</b>
                  <small>{x.lotNo || "ไม่มีเลข Lot"}</small>
                </span>
                <span>{movementName(x.movementType)}</span>
                <strong
                  className={
                    x.movementType.includes("out") ||
                    x.movementType === "work_issue"
                      ? "out"
                      : "in"
                  }
                >
                  {x.movementType.includes("out") ||
                  x.movementType === "work_issue"
                    ? "−"
                    : "+"}
                  {Number(x.quantity).toLocaleString("th-TH")}
                </strong>
                <span>{x.workTitle || x.note || "—"}</span>
              </article>
            ))
          ) : (
            <Empty text="ยังไม่มีความเคลื่อนไหวคลัง" />
          )}
        </div>
      )}
      {modal === "product" && (
        <ProductModal
          close={() => setModal(null)}
          saved={() => saved("เพิ่มสินค้าในทะเบียนแล้ว")}
        />
      )}{" "}
      {modal === "purchase" && (
        <PurchaseModal
          products={products}
          close={() => setModal(null)}
          saved={() =>
            saved("บันทึกใบซื้อ รับเข้าคลัง และสร้างรายจ่ายครั้งเดียวแล้ว")
          }
        />
      )}{" "}
      {modal === "adjust" && (
        <AdjustModal
          products={products}
          close={() => setModal(null)}
          saved={() => saved("ปรับยอดสต๊อกเรียบร้อยแล้ว")}
        />
      )}
    </>
  );
}

export function FinancePage({
  refreshOverview,
}: {
  refreshOverview: () => void;
}) {
  const [rows, setRows] = useState<Transaction[]>([]),
    [meta, setMeta] = useState<any>({ categories: [], plots: [], seasons: [] }),
    [modal, setModal] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const load = () =>
    api("/api/finance")
      .then((x) => {
        setRows(x.transactions || []);
        setMeta(x);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const income = rows
      .filter((x) => x.type === "income")
      .reduce((n, x) => n + Number(x.amount), 0),
    expense = rows
      .filter((x) => x.type === "expense")
      .reduce((n, x) => n + Number(x.amount), 0);
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังโหลดบัญชี...
      </div>
    );
  return (
    <>
      <Head
        title="รายรับ–รายจ่าย"
        detail="รวมรายการซื้อ ค่าแรง และรายการทั่วไปโดยไม่บันทึกต้นทุนซ้ำ"
      />
      <div className="p5-stats finance">
        <Stat icon={<ArrowDown />} label="รายรับรวม" value={money(income)} />
        <Stat
          icon={<ArrowUp />}
          label="รายจ่ายรวม"
          value={money(expense)}
          warn
        />
        <Stat
          icon={<Receipt />}
          label="คงเหลือสุทธิ"
          value={money(income - expense)}
        />
      </div>
      {message && <p className="p5-message">{message}</p>}
      <div className="p5-toolbar">
        <div />
        <button className="primary" onClick={() => setModal(true)}>
          <Plus /> เพิ่มรายรับ/รายจ่าย
        </button>
      </div>
      <div className="p5-table finance-table">
        <div>
          <b>วันที่</b>
          <b>รายการ</b>
          <b>หมวด</b>
          <b>สวน/ฤดู</b>
          <b>จำนวนเงิน</b>
          <b>ที่มา</b>
        </div>
        {rows.length ? (
          rows.map((x) => (
            <article key={x.id}>
              <span>{x.occurredOn}</span>
              <span>
                <b>{x.title}</b>
                {x.receiptKey && (
                  <small>
                    <a href={x.receiptKey} target="_blank">
                      ดูหลักฐาน
                    </a>
                  </small>
                )}
              </span>
              <span>{x.categoryName}</span>
              <span>
                {x.plotName || "ทั้งสวน"}
                <small>{x.seasonName || "ไม่ผูกฤดู"}</small>
              </span>
              <strong className={x.type}>
                {x.type === "income" ? "+" : "−"}
                {money(x.amount)}
              </strong>
              <span>
                {x.source === "purchase"
                  ? "ใบซื้อ/คลัง"
                  : x.source === "labor"
                    ? "ค่าแรง"
                    : "บันทึกทั่วไป"}
              </span>
            </article>
          ))
        ) : (
          <Empty text="ยังไม่มีรายการบัญชี" />
        )}
      </div>
      {modal && (
        <TransactionModal
          meta={meta}
          close={() => setModal(false)}
          saved={() => {
            setModal(false);
            setMessage("บันทึกรายการบัญชีแล้ว");
            load();
            refreshOverview();
          }}
        />
      )}
    </>
  );
}

function ProductModal({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [f, setF] = useState({ ...blankLine(), unit: "มล." }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "product", ...f }),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="เพิ่มสินค้าเข้าทะเบียน" close={close}>
      <p className="p5-hint">
        บันทึกครั้งเดียว แล้วเลือกซื้อซ้ำหรือเลือกใช้ในสูตรพ่นได้ทันที
      </p>
      <div className="p5-form">
        <Field
          label="รหัสสินค้า"
          value={f.sku}
          set={(v) => set("sku", v.toUpperCase())}
        />
        <Field label="ชื่อสินค้า" value={f.name} set={(v) => set("name", v)} />
        <Select
          label="หมวดหมู่สินค้า"
          value={f.kind}
          set={(v) => set("kind", v)}
          options={PRODUCT_KINDS}
        />
        <Field label="ชื่อทางการค้า/ยี่ห้อ" value={f.brand} set={(v) => set("brand", v)} />
        <Field
          label="ชื่อสามัญ/สารสำคัญ"
          value={f.commonName}
          set={(v) => set("commonName", v)}
        />
        <Field
          label="สูตรเคมี/% ความเข้มข้น"
          value={f.formulation}
          set={(v) => set("formulation", v)}
        />
        <Field
          label="เลขทะเบียน"
          value={f.registrationNo}
          set={(v) => set("registrationNo", v)}
        />
        <Field
          label="ขนาดบรรจุ"
          type="number"
          value={f.packageSize}
          set={(v) => set("packageSize", Number(v))}
        />
        <Select
          label="หน่วยบรรจุภัณฑ์"
          value={f.packageCountUnit}
          set={(v) => set("packageCountUnit", v)}
          options={PACKAGE_COUNT_UNITS}
        />
        <Select
          label="หน่วยปริมาณ/สต๊อก"
          value={f.packageUnit}
          set={(v) => {
            set("packageUnit", v);
            set("unit", v);
          }}
          options={QUANTITY_UNITS}
        />
        <Field
          label="อัตราปกติ / 200 ลิตร"
          type="number"
          value={f.ratePer200l}
          set={(v) => set("ratePer200l", Number(v))}
        />
        <Field
          label="หน่วยอัตรา"
          value={f.rateUnit}
          set={(v) => set("rateUnit", v)}
        />
        <Field
          label="จุดสั่งซื้อขั้นต่ำ"
          type="number"
          value={f.minimumStock}
          set={(v) => set("minimumStock", Number(v))}
        />
        <Select
          label="ระยะการเจริญเติบโตที่ใช้บ่อย"
          value={f.cropStage}
          set={(v) => set("cropStage", v)}
          options={CROP_STAGES}
        />
        <Select
          label="เป้าหมายการใช้งานที่ใช้บ่อย"
          value={f.targetIssue}
          set={(v) => set("targetIssue", v)}
          options={TARGET_ISSUES}
        />
        <Select
          label="ระยะปลอดภัยก่อนเก็บเกี่ยว (PHI)"
          value={String(f.phiDays)}
          set={(v) => set("phiDays", Number(v))}
          options={PHI_OPTIONS}
        />
      </div>
      {error && <ErrorText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={!f.sku || !f.name || !f.packageUnit}
      />
    </Modal>
  );
}

function PurchaseModal({
  products,
  close,
  saved,
}: {
  products: Product[];
  close: () => void;
  saved: () => void;
}) {
  const [supplier, setSupplier] = useState(""),
    [invoiceNo, setInvoice] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [discount, setDiscount] = useState(0),
    [receiptKey, setReceipt] = useState(""),
    [lines, setLines] = useState<Line[]>([blankLine()]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (i: number, k: keyof Line, v: any) =>
    setLines((x) => x.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const pick = (i: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (!p) {
      update(i, "productId", "");
      return;
    }
    setLines((x) =>
      x.map((r, j) =>
        j === i
          ? {
              ...r,
              productId: p.id,
              sku: p.sku,
              name: p.name,
              kind: p.kind,
              brand: p.brand || "",
              commonName: p.commonName || "",
              formulation: p.formulation || "",
              registrationNo: p.registrationNo || "",
              packageSize: Number(p.packageSize) || 1,
              packageUnit: p.packageUnit || p.unit,
              packageCountUnit: p.packageCountUnit || "ขวด",
              unitPrice: Number(p.lastUnitPrice) || 0,
              ratePer200l: Number(p.defaultRatePer200l) || 0,
              rateUnit: p.rateUnit || p.unit,
              cropStage: p.defaultCropStage || "ไม่ระบุ",
              targetIssue: p.defaultTargetIssue || "ไม่ระบุ",
              phiDays: Number(p.phiDays) || 0,
            }
          : r,
      ),
    );
  };
  const subtotal = lines.reduce((n, x) => n + x.packageQty * x.unitPrice, 0),
    lineDiscount = lines.reduce(
      (n, x) => n + Math.min(x.packageQty * x.unitPrice, x.discount),
      0,
    ),
    netBeforeBillDiscount = subtotal - lineDiscount;
  const file = (f?: File) => {
    if (!f) return;
    if (f.size > 350000) {
      setError("ใบเสร็จต้องไม่เกิน 350 KB");
      return;
    }
    const r = new FileReader();
    r.onload = () => setReceipt(String(r.result));
    r.readAsDataURL(f);
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplier,
          invoiceNo,
          purchasedOn: date,
          discount,
          receiptKey,
          lines,
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
    <Modal title="บันทึกการซื้อและรับเข้าคลัง" close={close} wide>
      <div className="p5-form header">
        <Field label="ร้านค้า/ผู้ขาย" value={supplier} set={setSupplier} />
        <Field
          label="เลขที่ใบเสร็จ/ใบกำกับ"
          value={invoiceNo}
          set={setInvoice}
        />
        <Field label="วันที่ซื้อ" type="date" value={date} set={setDate} />
      </div>
      <div className="purchase-help">
        <Check /> เลือกสินค้าที่ซื้อประจำ ระบบเติมหมวด ยี่ห้อ สูตร ขนาดบรรจุ
        และข้อมูล GAP ให้เอง
      </div>
      {lines.map((x, i) => (
        <section className="p5-line" key={i}>
          <div>
            <b>รายการที่ {i + 1}</b>
            {lines.length > 1 && (
              <button
                onClick={() => setLines((a) => a.filter((_, j) => j !== i))}
              >
                <X /> ลบ
              </button>
            )}
          </div>
          <label className="recurring">
            เลือกจากรายการซื้อประจำ
            <select
              value={x.productId}
              onChange={(e) => pick(i, e.target.value)}
            >
              <option value="">— สินค้าใหม่ / กรอกเอง —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.brand || p.commonName || p.sku} · คงเหลือ{" "}
                  {p.stock} {p.unit}
                </option>
              ))}
            </select>
          </label>
          <div className="p5-line-grid">
            <div className="p5-line-section">
              <b>รายละเอียดสินค้า</b>
              <span>ระบุให้ตรงกับฉลาก เพื่อป้องกันการซื้อหรือรับสินค้าผิดกลุ่ม</span>
            </div>
            <Field
              label="รหัส"
              value={x.sku}
              set={(v) => update(i, "sku", v.toUpperCase())}
            />
            <Field
              label="ชื่อสินค้า"
              value={x.name}
              set={(v) => update(i, "name", v)}
            />
            <Select
              label="หมวดหมู่สินค้า"
              value={x.kind}
              set={(v) => update(i, "kind", v)}
              options={PRODUCT_KINDS}
            />
            <Field
              label="ชื่อทางการค้า/ยี่ห้อ"
              value={x.brand}
              set={(v) => update(i, "brand", v)}
            />
            <Field
              label="ชื่อสามัญ/สารสำคัญ"
              value={x.commonName}
              set={(v) => update(i, "commonName", v)}
            />
            <Field
              label="สูตรเคมี/% ความเข้มข้น"
              value={x.formulation}
              set={(v) => update(i, "formulation", v)}
            />
            <Field
              label="เลขทะเบียน"
              value={x.registrationNo}
              set={(v) => update(i, "registrationNo", v)}
            />
            <Field
              label={"จำนวนที่สั่ง (" + x.packageCountUnit + ")"}
              type="number"
              value={x.packageQty}
              set={(v) => update(i, "packageQty", Number(v))}
            />
            <Select
              label="หน่วยนับ"
              value={x.packageCountUnit}
              set={(v) => update(i, "packageCountUnit", v)}
              options={PACKAGE_COUNT_UNITS}
            />
            <Field
              label="ขนาดต่อหน่วย"
              type="number"
              value={x.packageSize}
              set={(v) => update(i, "packageSize", Number(v))}
            />
            <Select
              label="หน่วยปริมาณ"
              value={x.packageUnit}
              set={(v) => update(i, "packageUnit", v)}
              options={QUANTITY_UNITS}
            />
            <Field
              label={"ราคาต่อ" + x.packageCountUnit}
              type="number"
              value={x.unitPrice}
              set={(v) => update(i, "unitPrice", Number(v))}
            />
            <Field
              label="ส่วนลดรายการนี้"
              type="number"
              value={x.discount}
              set={(v) => update(i, "discount", Number(v))}
            />
            <Field
              label="เลข Lot"
              value={x.lotNo}
              set={(v) => update(i, "lotNo", v)}
            />
            <Field
              label="วันหมดอายุ"
              type="date"
              value={x.expiresOn}
              set={(v) => update(i, "expiresOn", v)}
            />
            <Field
              label="อัตราใช้ต่อถัง 200 ลิตร"
              type="number"
              value={x.ratePer200l}
              set={(v) => update(i, "ratePer200l", Number(v))}
            />
            <Select
              label="หน่วยอัตราใช้"
              value={x.rateUnit}
              set={(v) => update(i, "rateUnit", v)}
              options={QUANTITY_UNITS}
            />
            <div className="p5-line-section agronomy">
              <b>ข้อมูลกำกับสำหรับสวนทุเรียนและ GAP</b>
              <span>ช่วยวางแผนการใช้สารและตรวจระยะปลอดภัยก่อนเก็บเกี่ยว</span>
            </div>
            <Select
              label="ระยะการเจริญเติบโต"
              value={x.cropStage}
              set={(v) => update(i, "cropStage", v)}
              options={CROP_STAGES}
            />
            <Select
              label="เป้าหมายการใช้งาน"
              value={x.targetIssue}
              set={(v) => update(i, "targetIssue", v)}
              options={TARGET_ISSUES}
            />
            <Select
              label="ระยะปลอดภัยก่อนเก็บเกี่ยว (PHI)"
              value={String(x.phiDays)}
              set={(v) => update(i, "phiDays", Number(v))}
              options={PHI_OPTIONS}
            />
          </div>
          <p>
            รับเข้า {x.packageQty.toLocaleString("th-TH")} {x.packageCountUnit} ·{" "}
            {(x.packageQty * x.packageSize).toLocaleString("th-TH")} {x.packageUnit}
            <b>{money(Math.max(0, x.packageQty * x.unitPrice - x.discount))}</b>
          </p>
        </section>
      ))}
      <button
        className="p5-add-line"
        onClick={() => setLines((x) => [...x, blankLine()])}
      >
        <Plus /> เพิ่มรายการสินค้า
      </button>
      <div className="p5-purchase-foot">
        <label className="p5-upload">
          <FileImage />
          <span>
            <b>{receiptKey ? "แนบใบเสร็จแล้ว" : "แนบรูปใบเสร็จ/สลิป"}</b>
            <small>JPG/PNG ไม่เกิน 350 KB</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => file(e.target.files?.[0])}
          />
        </label>
        <div>
          <Field
            label="ส่วนลดท้ายบิล"
            type="number"
            value={discount}
            set={(v) => setDiscount(Number(v))}
          />
          <p>
            ยอดสินค้า <b>{money(subtotal)}</b>
          </p>
          {lineDiscount > 0 && (
            <p>
              ส่วนลดรายสินค้า <b>-{money(lineDiscount)}</b>
            </p>
          )}
          <p className="grand">
            สุทธิ{" "}
            <b>{money(Math.max(0, netBeforeBillDiscount - discount))}</b>
          </p>
        </div>
      </div>
      {error && <ErrorText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={
          !supplier ||
          lines.some(
            (x) =>
              !x.name || !x.packageQty || !x.packageSize || x.unitPrice < 0,
          )
        }
      />
    </Modal>
  );
}

function AdjustModal({
  products,
  close,
  saved,
}: {
  products: Product[];
  close: () => void;
  saved: () => void;
}) {
  const [productId, setProduct] = useState(products[0]?.id || ""),
    [mode, setMode] = useState("in"),
    [quantity, setQty] = useState(0),
    [note, setNote] = useState(""),
    [lotNo, setLot] = useState(""),
    [expiresOn, setExpiry] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          productId,
          mode,
          quantity,
          note,
          lotNo,
          expiresOn,
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
    <Modal title="ปรับยอดคลัง" close={close}>
      <label>
        สินค้า
        <select value={productId} onChange={(e) => setProduct(e.target.value)}>
          {products.map((x) => (
            <option value={x.id} key={x.id}>
              {x.name} · คงเหลือ {x.stock} {x.unit}
            </option>
          ))}
        </select>
      </label>
      <div className="p5-form">
        <Select
          label="ประเภท"
          value={mode}
          set={setMode}
          options={["in|รับเข้า", "out|จ่ายออก"]}
        />
        <Field
          label="จำนวน"
          type="number"
          value={quantity}
          set={(v) => setQty(Number(v))}
        />
        {mode === "in" && (
          <>
            <Field label="เลข Lot" value={lotNo} set={setLot} />
            <Field
              label="วันหมดอายุ"
              type="date"
              value={expiresOn}
              set={setExpiry}
            />
          </>
        )}
        <Field label="หมายเหตุ" value={note} set={setNote} />
      </div>
      {error && <ErrorText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={!productId || quantity <= 0}
      />
    </Modal>
  );
}

function TransactionModal({
  meta,
  close,
  saved,
}: {
  meta: any;
  close: () => void;
  saved: () => void;
}) {
  const [type, setType] = useState("expense"),
    [title, setTitle] = useState(""),
    [categoryName, setCategory] = useState(""),
    [amount, setAmount] = useState(0),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [plotId, setPlot] = useState(""),
    [seasonId, setSeason] = useState(""),
    [receiptKey, setReceipt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cats = (meta.categories || []).filter((x: any) => x.type === type);
  const file = (f?: File) => {
    if (!f) return;
    if (f.size > 350000) {
      setError("หลักฐานต้องไม่เกิน 350 KB");
      return;
    }
    const r = new FileReader();
    r.onload = () => setReceipt(String(r.result));
    r.readAsDataURL(f);
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          categoryName,
          amount,
          occurredOn: date,
          plotId: plotId || null,
          seasonId: seasonId || null,
          receiptKey,
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
    <Modal title="เพิ่มรายการบัญชี" close={close}>
      <div className="p5-form">
        <Select
          label="ประเภท"
          value={type}
          set={(v) => {
            setType(v);
            setCategory("");
          }}
          options={["expense|รายจ่าย", "income|รายรับ"]}
        />
        <Field label="ชื่อรายการ" value={title} set={setTitle} />
        <label>
          หมวด
          <input
            list="finance-categories"
            value={categoryName}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="finance-categories">
            {cats.map((x: any) => (
              <option value={x.name} key={x.id} />
            ))}
          </datalist>
        </label>
        <Field
          label="จำนวนเงิน"
          type="number"
          value={amount}
          set={(v) => setAmount(Number(v))}
        />
        <Field label="วันที่" type="date" value={date} set={setDate} />
        <label>
          แปลง
          <select value={plotId} onChange={(e) => setPlot(e.target.value)}>
            <option value="">ทั้งสวน</option>
            {(meta.plots || []).map((x: any) => (
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
            {(meta.seasons || []).map((x: any) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="p5-upload">
        <FileImage />
        <span>
          <b>{receiptKey ? "แนบหลักฐานแล้ว" : "แนบใบเสร็จ/สลิป"}</b>
          <small>JPG/PNG ไม่เกิน 350 KB</small>
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => file(e.target.files?.[0])}
        />
      </label>
      {error && <ErrorText text={error} />}
      <Actions
        close={close}
        save={submit}
        busy={busy}
        disabled={!title || !categoryName || amount <= 0}
      />
    </Modal>
  );
}

function Head({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="head p5-head">
      <div>
        <small>PRODUCTION UPGRADE P5</small>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <article className={warn ? "warn" : ""}>
      {icon}
      <span>
        {label}
        <b>{value}</b>
      </span>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="p5-empty">
      <Package /> {text}
    </div>
  );
}
function movementName(x: string) {
  return (
    (
      {
        purchase_in: "ซื้อเข้า",
        work_issue: "ใช้กับงาน",
        adjust_in: "ปรับรับเข้า",
        adjust_out: "ปรับจ่ายออก",
      } as Record<string, string>
    )[x] || x
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
  set: (x: string) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function Select({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (x: string) => void;
  options: string[];
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        {options.map((x) => {
          const [v, n] = x.split("|");
          return (
            <option value={v} key={x}>
              {n || v}
            </option>
          );
        })}
      </select>
    </label>
  );
}
function ErrorText({ text }: { text: string }) {
  return <p className="p5-error">{text}</p>;
}
function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="backdrop">
      <div className={`modal p5-modal ${wide ? "wide" : ""}`}>
        <button className="close" onClick={close}>
          <X />
        </button>
        <small>PRODUCTION UPGRADE P5</small>
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
    <div className="p5-actions">
      <button onClick={close}>ยกเลิก</button>
      <button className="primary" onClick={save} disabled={busy || disabled}>
        <Check />
        {busy ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </div>
  );
}
