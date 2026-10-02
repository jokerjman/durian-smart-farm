"use client";
import "./p8.css";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  ClipboardCheck,
  Download,
  FileCheck2,
  Leaf,
  Pencil,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";

type Season = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  targetKg: number | null;
  budget: number | null;
  actualKg: number | null;
};
type Category = {
  name: string;
  type: string;
  amount: number;
  itemCount: number;
};
type PlotCost = {
  plotId: string;
  plotName: string;
  income: number;
  expense: number;
};
type Month = { month: string; income: number; expense: number };
type Assessment = {
  id: string;
  seasonId: string | null;
  itemKey: string;
  status: string;
  note: string | null;
  evidenceKey: string | null;
  reviewedAt: number;
  reviewerName: string;
};
type ReportData = {
  selectedSeasonId: string;
  seasons: Season[];
  summary: {
    income: number;
    expense: number;
    transactionCount: number;
    unallocatedExpense: number;
  };
  categories: Category[];
  plots: PlotCost[];
  months: Month[];
  harvest: { harvestedKg: number; fruitCount: number; batchCount: number };
  sales: { soldKg: number; salesAmount: number; averagePrice: number };
  farm: {
    id: string;
    name: string;
    areaRai: number;
    plotCount: number;
    treeCount: number;
  } | null;
  assessments: Assessment[];
};
const empty: ReportData = {
  selectedSeasonId: "",
  seasons: [],
  summary: {
    income: 0,
    expense: 0,
    transactionCount: 0,
    unallocatedExpense: 0,
  },
  categories: [],
  plots: [],
  months: [],
  harvest: { harvestedKg: 0, fruitCount: 0, batchCount: 0 },
  sales: { soldKg: 0, salesAmount: 0, averagePrice: 0 },
  farm: null,
  assessments: [],
};
const gapItems = [
  {
    key: "water_source",
    group: "แหล่งน้ำ",
    title: "แหล่งน้ำเหมาะสมและไม่มีความเสี่ยงปนเปื้อน",
    hint: "ระบุแหล่งน้ำ ผลตรวจ หรือมาตรการป้องกัน",
  },
  {
    key: "growing_area",
    group: "พื้นที่ปลูก",
    title: "พื้นที่ปลูกไม่มีความเสี่ยงจากวัตถุอันตราย",
    hint: "ตรวจประวัติพื้นที่และพื้นที่ข้างเคียง",
  },
  {
    key: "pesticide_use",
    group: "วัตถุอันตราย",
    title: "ใช้สารเคมีที่ขึ้นทะเบียนและตามฉลาก",
    hint: "ตรวจเลขทะเบียน อัตราใช้ และระยะปลอดภัย",
  },
  {
    key: "chemical_storage",
    group: "วัตถุอันตราย",
    title: "สถานที่เก็บสารเคมีปลอดภัยและเป็นสัดส่วน",
    hint: "ตรวจป้าย ห้องเก็บ และอุปกรณ์ป้องกัน",
  },
  {
    key: "production_plan",
    group: "การผลิต",
    title: "มีแผนการผลิตและการดูแลตามระยะ",
    hint: "อ้างอิงฤดูผลิต งาน และปฏิทินสวน",
  },
  {
    key: "worker_safety",
    group: "บุคลากร",
    title: "ผู้ปฏิบัติงานมีความรู้และอุปกรณ์ป้องกัน",
    hint: "บันทึกการอบรมและ PPE",
  },
  {
    key: "harvest_quality",
    group: "เก็บเกี่ยว",
    title: "เก็บเกี่ยวในระยะเหมาะสมและป้องกันการปนเปื้อน",
    hint: "ตรวจอุปกรณ์ ภาชนะ และวิธีขนย้าย",
  },
  {
    key: "postharvest",
    group: "หลังเก็บเกี่ยว",
    title: "คัดแยก เก็บรักษา และขนส่งอย่างถูกสุขลักษณะ",
    hint: "บันทึกการคัดเกรดและพื้นที่พักผลผลิต",
  },
  {
    key: "traceability",
    group: "ย้อนกลับ",
    title: "ผลผลิตตรวจสอบย้อนกลับถึงสวน แปลง และรุ่นได้",
    hint: "ใช้ Lot, QR และ Durian ID",
  },
  {
    key: "records",
    group: "บันทึกข้อมูล",
    title: "มีบันทึกงาน ปัจจัยการผลิต และบัญชีครบถ้วน",
    hint: "ตรวจความครบถ้วนและเก็บหลักฐานตามฤดู",
  },
];
const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init),
    body = await response.json();
  if (!response.ok) throw new Error(body.error || "ดำเนินการไม่สำเร็จ");
  return body;
};
const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const number = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: digits });

export function ReportsPage() {
  const [data, setData] = useState<ReportData>(empty),
    [seasonId, setSeasonId] = useState(""),
    [tab, setTab] = useState<"analysis" | "gap">("analysis"),
    [editing, setEditing] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const load = (selected = seasonId) => {
    setLoading(true);
    request(
      `/api/reports${selected ? `?seasonId=${encodeURIComponent(selected)}` : ""}`,
    )
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    request("/api/reports")
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);
  const changeSeason = (value: string) => {
    setSeasonId(value);
    load(value);
  };
  const profit = Number(data.summary.income) - Number(data.summary.expense),
    costPerKg =
      data.harvest.harvestedKg > 0
        ? data.summary.expense / data.harvest.harvestedKg
        : 0,
    margin = data.summary.income > 0 ? (profit / data.summary.income) * 100 : 0;
  const gap = useMemo(
    () =>
      gapItems.map((item) => ({
        ...item,
        assessment: data.assessments.find((x) => x.itemKey === item.key),
      })),
    [data.assessments],
  );
  const passed = gap.filter((x) => x.assessment?.status === "pass").length,
    applicable = gap.filter((x) => x.assessment?.status !== "na").length,
    score = applicable ? Math.round((passed / applicable) * 100) : 0;
  const exportCsv = () => {
    const rows = [
      ["หมวด", "ประเภท", "จำนวนเงิน", "จำนวนรายการ"],
      ...data.categories.map((x) => [
        x.name,
        x.type === "income" ? "รายรับ" : "รายจ่าย",
        String(x.amount),
        String(x.itemCount),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `durian-report-${seasonId || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังคำนวณรายงานจากข้อมูลจริง...
      </div>
    );
  return (
    <>
      <div className="head p8-head">
        <div>
          <small>PRODUCTION UPGRADE P8</small>
          <h1>รายงานต้นทุน ผลประกอบการ และ GAP</h1>
          <p>คำนวณจากบัญชี ผลผลิต การขาย แปลง และฤดูผลิตที่บันทึกจริง</p>
        </div>
        <div className="p8-actions">
          <button onClick={exportCsv}>
            <Download /> CSV
          </button>
          <button onClick={() => window.print()}>
            <Printer /> พิมพ์/PDF
          </button>
        </div>
      </div>
      <div className="p8-filter">
        <label>
          ขอบเขตรายงาน
          <select
            value={seasonId}
            onChange={(e) => changeSeason(e.target.value)}
          >
            <option value="">ทุกฤดูและรายการที่ยังไม่ผูกฤดู</option>
            {data.seasons.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.status}
              </option>
            ))}
          </select>
        </label>
        <span>
          {data.farm?.name || "สวนปัจจุบัน"} · {data.summary.transactionCount}{" "}
          รายการบัญชี
        </span>
      </div>
      {message && <p className="p8-message">{message}</p>}
      <div className="p8-tabs">
        <button
          className={tab === "analysis" ? "active" : ""}
          onClick={() => setTab("analysis")}
        >
          <BarChart3 /> ต้นทุนและผลประกอบการ
        </button>
        <button
          className={tab === "gap" ? "active" : ""}
          onClick={() => setTab("gap")}
        >
          <ClipboardCheck /> ประเมิน GAP <b>{score}%</b>
        </button>
      </div>
      {tab === "analysis" ? (
        <Analysis
          data={data}
          profit={profit}
          margin={margin}
          costPerKg={costPerKg}
        />
      ) : (
        <GapView
          items={gap}
          score={score}
          passed={passed}
          seasonSelected={!!seasonId}
          edit={setEditing}
        />
      )}
      {editing && (
        <GapModal
          item={gap.find((x) => x.key === editing)!}
          seasonId={seasonId}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            setMessage("บันทึกผลประเมิน GAP แล้ว");
            load();
          }}
        />
      )}
    </>
  );
}

function Analysis({
  data,
  profit,
  margin,
  costPerKg,
}: {
  data: ReportData;
  profit: number;
  margin: number;
  costPerKg: number;
}) {
  const expenses = data.categories.filter((x) => x.type === "expense"),
    maxCategory = Math.max(...expenses.map((x) => Number(x.amount)), 1),
    maxMonth = Math.max(
      ...data.months.flatMap((x) => [Number(x.income), Number(x.expense)]),
      1,
    );
  return (
    <>
      <div className="p8-stats">
        <Stat
          icon={<TrendingUp />}
          label="รายรับ"
          value={money(data.summary.income)}
          tone="income"
        />
        <Stat
          icon={<TrendingDown />}
          label="รายจ่าย/ต้นทุน"
          value={money(data.summary.expense)}
          tone="expense"
        />
        <Stat
          icon={<WalletCards />}
          label="กำไรสุทธิ"
          value={money(profit)}
          tone={profit < 0 ? "expense" : "income"}
        />
        <Stat
          icon={<Scale />}
          label="ต้นทุนต่อ กก."
          value={data.harvest.harvestedKg ? money(costPerKg) : "ยังไม่มีผลผลิต"}
        />
      </div>
      {data.summary.unallocatedExpense > 0 && (
        <div className="p8-warning">
          <AlertCircle />
          <div>
            <b>
              มีต้นทุนที่ยังไม่ระบุแปลง {money(data.summary.unallocatedExpense)}
            </b>
            <span>
              ยอดนี้รวมในต้นทุนสวนแล้ว แต่ยังใช้เปรียบเทียบรายแปลงไม่ได้
            </span>
          </div>
        </div>
      )}
      <div className="p8-grid">
        <section className="p8-panel">
          <Title
            title="ผลประกอบการ"
            detail="รายรับหักค่าใช้จ่ายตามขอบเขตที่เลือก"
          />
          <div className="profit-box">
            <span>
              กำไรสุทธิ
              <strong className={profit < 0 ? "negative" : ""}>
                {money(profit)}
              </strong>
            </span>
            <span>
              อัตรากำไร
              <strong className={margin < 0 ? "negative" : ""}>
                {number(margin, 1)}%
              </strong>
            </span>
            <span>
              ผลผลิตรวม
              <strong>{number(data.harvest.harvestedKg, 1)} กก.</strong>
            </span>
            <span>
              ราคาขายเฉลี่ย<strong>{money(data.sales.averagePrice)}/กก.</strong>
            </span>
          </div>
          <p className="p8-source">
            <FileCheck2 /> ใช้รายการบัญชีจริง {data.summary.transactionCount}{" "}
            รายการ · ผลผลิต {data.harvest.batchCount} รุ่น · ขาย{" "}
            {number(data.sales.soldKg, 1)} กก.
          </p>
        </section>
        <section className="p8-panel">
          <Title
            title="แนวโน้มรายเดือน"
            detail="รายรับและรายจ่ายจากวันที่ลงบัญชี"
          />
          {data.months.length ? (
            <div className="month-chart">
              {data.months.map((x) => (
                <div key={x.month}>
                  <span>{x.month}</span>
                  <i>
                    <b
                      className="income"
                      style={{
                        height: `${Math.max(2, (Number(x.income) / maxMonth) * 90)}px`,
                      }}
                      title={money(x.income)}
                    />
                    <b
                      className="expense"
                      style={{
                        height: `${Math.max(2, (Number(x.expense) / maxMonth) * 90)}px`,
                      }}
                      title={money(x.expense)}
                    />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <MiniEmpty text="ยังไม่มีรายการบัญชีสำหรับสร้างกราฟ" />
          )}
        </section>
      </div>
      <div className="p8-grid lower">
        <section className="p8-panel">
          <Title title="ต้นทุนตามหมวด" detail="เรียงจากต้นทุนสูงสุด" />
          {expenses.length ? (
            <div className="cost-bars">
              {expenses.map((x) => (
                <div key={x.name}>
                  <p>
                    <span>
                      {x.name}
                      <small>{x.itemCount} รายการ</small>
                    </span>
                    <b>{money(x.amount)}</b>
                  </p>
                  <i>
                    <b
                      style={{
                        width: `${(Number(x.amount) / maxCategory) * 100}%`,
                      }}
                    />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <MiniEmpty text="ยังไม่มีรายจ่าย" />
          )}
        </section>
        <section className="p8-panel">
          <Title title="เปรียบเทียบรายแปลง" detail="เฉพาะบัญชีที่ระบุแปลง" />
          {data.plots.length ? (
            <div className="plot-report">
              {data.plots.map((x) => (
                <article key={x.plotId || "none"}>
                  <span>
                    <b>{x.plotName}</b>
                    <small>
                      กำไร {money(Number(x.income) - Number(x.expense))}
                    </small>
                  </span>
                  <span>
                    รายรับ <strong className="green">{money(x.income)}</strong>
                  </span>
                  <span>
                    ต้นทุน <strong>{money(x.expense)}</strong>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <MiniEmpty text="ยังไม่มีข้อมูลรายแปลง" />
          )}
        </section>
      </div>
    </>
  );
}

function GapView({
  items,
  score,
  passed,
  seasonSelected,
  edit,
}: {
  items: Array<(typeof gapItems)[number] & { assessment?: Assessment }>;
  score: number;
  passed: number;
  seasonSelected: boolean;
  edit: (key: string) => void;
}) {
  return (
    <>
      <div className="gap-hero">
        <div>
          <ClipboardCheck />
          <span>
            <small>ความพร้อมตามแบบประเมิน</small>
            <strong>{score}%</strong>
            <p>
              ผ่าน {passed} จาก{" "}
              {items.filter((x) => x.assessment?.status !== "na").length}{" "}
              หัวข้อที่เกี่ยวข้อง
            </p>
          </span>
        </div>
        <p>
          {seasonSelected
            ? "ผลประเมินนี้ถูกเก็บแยกกับฤดูผลิตที่เลือก"
            : "กำลังประเมินระดับสวน กรุณาเลือกฤดูผลิตหากต้องการเก็บหลักฐานแยกตามฤดู"}
        </p>
      </div>
      <section className="p8-panel gap-panel">
        <Title
          title="รายการตรวจประเมิน GAP"
          detail="แบบประเมินภายในเพื่อเตรียมความพร้อม ไม่ใช่ใบรับรองจากหน่วยตรวจ"
        />
        <div className="gap-list">
          {items.map((item) => {
            const status = item.assessment?.status || "pending";
            return (
              <article key={item.key}>
                <i className={status}>
                  {status === "pass" ? (
                    <Check />
                  ) : status === "action" ? (
                    <AlertCircle />
                  ) : status === "na" ? (
                    <X />
                  ) : (
                    <span />
                  )}
                </i>
                <div>
                  <small>{item.group}</small>
                  <b>{item.title}</b>
                  <span>{item.assessment?.note || item.hint}</span>
                  {item.assessment && (
                    <em>
                      ตรวจโดย {item.assessment.reviewerName} ·{" "}
                      {new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                      }).format(new Date(item.assessment.reviewedAt * 1000))}
                      {item.assessment.evidenceKey ? " · มีหลักฐาน" : ""}
                    </em>
                  )}
                </div>
                <strong className={status}>{statusName(status)}</strong>
                <button onClick={() => edit(item.key)}>
                  <Pencil /> ประเมิน
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function GapModal({
  item,
  seasonId,
  close,
  saved,
}: {
  item: (typeof gapItems)[number] & { assessment?: Assessment };
  seasonId: string;
  close: () => void;
  saved: () => void;
}) {
  const [status, setStatus] = useState(item.assessment?.status || "pending"),
    [note, setNote] = useState(item.assessment?.note || ""),
    [evidenceKey, setEvidence] = useState(item.assessment?.evidenceKey || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const file = (value?: File) => {
    if (!value) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        value.type,
      ) ||
      value.size > 350 * 1024
    )
      return setError(
        "หลักฐานต้องเป็น JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 350 KB",
      );
    const reader = new FileReader();
    reader.onload = () => setEvidence(String(reader.result));
    reader.readAsDataURL(value);
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request("/api/reports", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seasonId,
          itemKey: item.key,
          status,
          note,
          evidenceKey,
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
    <div className="backdrop">
      <div className="modal p8-modal">
        <button className="close" onClick={close}>
          <X />
        </button>
        <small>ประเมิน GAP · {item.group}</small>
        <h2>{item.title}</h2>
        <p className="gap-hint">{item.hint}</p>
        <label>
          ผลการประเมิน
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">ยังไม่ประเมิน</option>
            <option value="pass">ผ่าน/พร้อม</option>
            <option value="action">ต้องแก้ไข</option>
            <option value="na">ไม่เกี่ยวข้อง</option>
          </select>
        </label>
        <label>
          หมายเหตุและสิ่งที่ต้องดำเนินการ
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="gap-upload">
          <FileCheck2 />
          <span>
            <b>{evidenceKey ? "แนบหลักฐานแล้ว" : "แนบหลักฐาน"}</b>
            <small>JPG, PNG, WebP หรือ PDF ไม่เกิน 350 KB</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => file(e.target.files?.[0])}
          />
        </label>
        {error && <p className="p8-error">{error}</p>}
        <div className="p8-modal-actions">
          <button onClick={close}>ยกเลิก</button>
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? "กำลังบันทึก..." : "บันทึกผลประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  tone = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className={tone}>
      {icon}
      <span>
        {label}
        <b>{value}</b>
      </span>
    </article>
  );
}
function Title({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="p8-title">
      <b>{title}</b>
      <span>{detail}</span>
    </div>
  );
}
function MiniEmpty({ text }: { text: string }) {
  return (
    <div className="p8-empty">
      <Leaf /> {text}
    </div>
  );
}
function statusName(status: string) {
  return (
    (
      {
        pending: "ยังไม่ประเมิน",
        pass: "ผ่าน",
        action: "ต้องแก้ไข",
        na: "ไม่เกี่ยวข้อง",
      } as Record<string, string>
    )[status] || status
  );
}
