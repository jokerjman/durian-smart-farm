"use client";
import "./p7.css";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardPlus,
  Droplets,
  Gauge,
  Leaf,
  Plus,
  Radio,
  Thermometer,
  Trees,
  Wifi,
  X,
} from "lucide-react";

type Plot = { id: string; name: string };
type Tree = { id: string; durianId: string; plotId: string; plotName: string };
type Device = {
  id: string;
  plotId: string | null;
  name: string;
  deviceType: string;
  unit: string;
  status: string;
  lastSeenAt: number | null;
  latestValue: number | null;
  latestAt: number | null;
  plotName: string | null;
};
type Reading = {
  id: string;
  deviceId: string;
  value: number;
  recordedAt: number;
};
type Observation = {
  id: string;
  plotId: string | null;
  treeId: string | null;
  observationType: string;
  severity: string;
  symptom: string;
  note: string | null;
  photoKey: string | null;
  status: string;
  observedAt: number;
  plotName: string | null;
  durianId: string | null;
  observerName: string;
};
type SmartAlert = {
  id: string;
  plotId: string | null;
  alertType: string;
  severity: string;
  title: string;
  detail: string | null;
  recommendedAction: string | null;
  status: string;
  triggeredAt: number;
  resolvedAt: number | null;
  plotName: string | null;
};
type SmartData = {
  serverNow: number;
  plots: Plot[];
  trees: Tree[];
  devices: Device[];
  readings: Reading[];
  observations: Observation[];
  alerts: SmartAlert[];
};
type ModalKind = "observation" | "device" | "reading";
const empty: SmartData = {
  serverNow: 0,
  plots: [],
  trees: [],
  devices: [],
  readings: [],
  observations: [],
  alerts: [],
};
const api = async (init?: RequestInit) => {
  const response = await fetch("/api/smart/observations", init),
    body = await response.json();
  if (!response.ok) throw new Error(body.error || "ดำเนินการไม่สำเร็จ");
  return body;
};
const labels: Record<string, string> = {
  soil_moisture: "ความชื้นดิน",
  temperature: "อุณหภูมิ",
  humidity: "ความชื้นอากาศ",
  rainfall: "ปริมาณฝน",
  water_level: "ระดับน้ำ",
  ph: "pH",
  other: "ค่าตรวจวัดอื่น",
  disease: "โรค",
  pest: "แมลง/ศัตรูพืช",
  nutrition: "ธาตุอาหาร",
  water: "น้ำ",
  general: "ทั่วไป",
};
const dateTime = (time: number | null) =>
  time
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(time * 1000))
    : "ยังไม่มีค่า";

export function SmartFarmPage() {
  const [data, setData] = useState<SmartData>(empty),
    [tab, setTab] = useState<"overview" | "sensors" | "alerts">("overview"),
    [modal, setModal] = useState<ModalKind | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const load = () => {
    setLoading(true);
    api()
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    api()
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);
  const openObservations = data.observations.filter((x) => x.status === "open"),
    openAlerts = data.alerts.filter((x) => x.status === "open"),
    activeDevices = data.devices.filter(
      (x) => x.lastSeenAt && data.serverNow - x.lastSeenAt < 86400,
    );
  const resolve = async (kind: "observation" | "alert", id: string) => {
    try {
      await api({
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      setMessage("ปิดรายการเรียบร้อย");
      load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  if (loading)
    return (
      <div className="loading-panel">
        <Leaf /> กำลังโหลดข้อมูลเฝ้าระวัง...
      </div>
    );
  return (
    <>
      <div className="head p7-head">
        <div>
          <small>PRODUCTION UPGRADE P7</small>
          <h1>สวนอัจฉริยะและระบบเฝ้าระวัง</h1>
          <p>ติดตามสุขภาพต้น ค่าตรวจวัด และเหตุที่ต้องดำเนินการจากข้อมูลจริง</p>
        </div>
        <div className="p7-actions">
          <button
            onClick={() => setModal("reading")}
            disabled={!data.devices.length}
          >
            <Gauge /> บันทึกค่าแมนนวล
          </button>
          <button className="primary" onClick={() => setModal("observation")}>
            <ClipboardPlus /> แจ้งอาการผิดปกติ
          </button>
        </div>
      </div>
      <div className="p7-stats">
        <Stat
          icon={<AlertTriangle />}
          label="แจ้งเตือนที่เปิดอยู่"
          value={`${openAlerts.length} รายการ`}
          tone={openAlerts.length ? "danger" : "ok"}
        />
        <Stat
          icon={<Trees />}
          label="อาการที่กำลังติดตาม"
          value={`${openObservations.length} รายการ`}
        />
        <Stat
          icon={<Wifi />}
          label="มีค่าภายใน 24 ชม."
          value={`${activeDevices.length}/${data.devices.length} อุปกรณ์`}
        />
        <Stat
          icon={<Radio />}
          label="แปลงที่มีอุปกรณ์"
          value={`${new Set(data.devices.map((x) => x.plotId).filter(Boolean)).size}/${data.plots.length} แปลง`}
        />
      </div>
      {message && <p className="p7-message">{message}</p>}
      <div className="p7-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          สุขภาพสวน
        </button>
        <button
          className={tab === "sensors" ? "active" : ""}
          onClick={() => setTab("sensors")}
        >
          เซนเซอร์และค่าตรวจวัด
        </button>
        <button
          className={tab === "alerts" ? "active" : ""}
          onClick={() => setTab("alerts")}
        >
          ศูนย์แจ้งเตือน {openAlerts.length ? <b>{openAlerts.length}</b> : null}
        </button>
      </div>
      {tab === "overview" && (
        <HealthView
          observations={data.observations}
          resolve={(id) => resolve("observation", id)}
          add={() => setModal("observation")}
        />
      )}
      {tab === "sensors" && (
        <SensorView
          devices={data.devices}
          readings={data.readings}
          serverNow={data.serverNow}
          addDevice={() => setModal("device")}
          addReading={() => setModal("reading")}
        />
      )}
      {tab === "alerts" && (
        <AlertView
          alerts={data.alerts}
          resolve={(id) => resolve("alert", id)}
        />
      )}
      {modal === "observation" && (
        <ObservationModal
          data={data}
          close={() => setModal(null)}
          saved={() => {
            setModal(null);
            setMessage("บันทึกอาการและประเมินการแจ้งเตือนแล้ว");
            load();
          }}
        />
      )}
      {modal === "device" && (
        <DeviceModal
          plots={data.plots}
          close={() => setModal(null)}
          saved={() => {
            setModal(null);
            setMessage("เพิ่มทะเบียนอุปกรณ์แล้ว");
            load();
          }}
        />
      )}
      {modal === "reading" && (
        <ReadingModal
          devices={data.devices}
          close={() => setModal(null)}
          saved={() => {
            setModal(null);
            setMessage("บันทึกค่าตรวจวัดแมนนวลแล้ว");
            load();
          }}
        />
      )}
    </>
  );
}

function HealthView({
  observations,
  resolve,
  add,
}: {
  observations: Observation[];
  resolve: (id: string) => void;
  add: () => void;
}) {
  return (
    <div className="p7-panel">
      <div className="p7-panel-title">
        <div>
          <b>บันทึกสุขภาพต้นและแปลง</b>
          <span>เรียงจากรายการล่าสุด พร้อมภาพและผู้ตรวจ</span>
        </div>
        <button onClick={add}>
          <Plus /> เพิ่มรายการ
        </button>
      </div>
      {observations.length ? (
        <div className="health-observations">
          {observations.map((o) => (
            <article
              key={o.id}
              className={o.status === "resolved" ? "resolved" : ""}
            >
              {o.photoKey ? (
                <Image
                  src={o.photoKey}
                  alt="ภาพอาการที่ตรวจพบ"
                  width={50}
                  height={50}
                  unoptimized
                />
              ) : (
                <i>
                  <Leaf />
                </i>
              )}
              <div>
                <span>
                  <em className={o.severity}>{severityName(o.severity)}</em>{" "}
                  {labels[o.observationType] || o.observationType}
                </span>
                <b>{o.symptom}</b>
                <small>
                  {o.plotName || "ระดับสวน"}
                  {o.durianId ? ` · ${o.durianId}` : ""} ·{" "}
                  {dateTime(o.observedAt)} · {o.observerName}
                </small>
                {o.note && <p>{o.note}</p>}
              </div>
              {o.status === "open" ? (
                <button onClick={() => resolve(o.id)}>
                  <CheckCircle2 /> ตรวจแล้ว/ปิดรายการ
                </button>
              ) : (
                <strong>
                  <CheckCircle2 /> ปิดแล้ว
                </strong>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Leaf />}
          text="ยังไม่มีบันทึกอาการผิดปกติ"
          detail="ใช้บันทึกโรค แมลง ธาตุอาหาร น้ำ หรืออาการทั่วไปที่พบในแปลง"
        />
      )}
    </div>
  );
}
function SensorView({
  devices,
  readings,
  serverNow,
  addDevice,
  addReading,
}: {
  devices: Device[];
  readings: Reading[];
  serverNow: number;
  addDevice: () => void;
  addReading: () => void;
}) {
  return (
    <>
      <div className="sensor-note">
        <Radio />
        <div>
          <b>เริ่มได้โดยไม่ต้องมีอุปกรณ์เชื่อมต่อ</b>
          <span>
            เพิ่มทะเบียนจุดตรวจ แล้วกรอกค่าจากมิเตอร์หรือเซนเซอร์ด้วยตนเอง
            ระบบเก็บประวัติชุดเดียวกับข้อมูลอัตโนมัติในอนาคต
          </span>
        </div>
      </div>
      <div className="p7-panel">
        <div className="p7-panel-title">
          <div>
            <b>อุปกรณ์และจุดตรวจ</b>
            <span>สถานะ “มีค่าล่าสุด” หมายถึงมีการบันทึกภายใน 24 ชั่วโมง</span>
          </div>
          <div>
            <button onClick={addDevice}>
              <Plus /> เพิ่มอุปกรณ์
            </button>
            <button
              className="solid"
              onClick={addReading}
              disabled={!devices.length}
            >
              <Gauge /> บันทึกค่า
            </button>
          </div>
        </div>
        {devices.length ? (
          <div className="sensor-cards">
            {devices.map((d) => {
              const history = readings
                  .filter((x) => x.deviceId === d.id)
                  .slice(0, 6)
                  .reverse(),
                recent = !!d.lastSeenAt && serverNow - d.lastSeenAt < 86400;
              return (
                <article key={d.id}>
                  <header>
                    <DeviceIcon type={d.deviceType} />
                    <span>
                      <b>{d.name}</b>
                      <small>
                        {labels[d.deviceType] || d.deviceType} ·{" "}
                        {d.plotName || "ระดับสวน"}
                      </small>
                    </span>
                    <em className={recent ? "recent" : "manual"}>
                      {recent ? "มีค่าล่าสุด" : "รอบันทึกค่า"}
                    </em>
                  </header>
                  <strong>
                    {d.latestValue == null
                      ? "—"
                      : Number(d.latestValue).toLocaleString("th-TH")}{" "}
                    <small>{d.unit}</small>
                  </strong>
                  <span>ล่าสุด {dateTime(d.latestAt)}</span>
                  <div className="mini-history">
                    {history.length ? (
                      history.map((x) => (
                        <i
                          key={x.id}
                          title={`${x.value} ${d.unit}`}
                          style={{
                            height: `${Math.max(6, Math.min(34, (Math.abs(Number(x.value)) / Math.max(...history.map((h) => Math.abs(Number(h.value))), 1)) * 34))}px`,
                          }}
                        />
                      ))
                    ) : (
                      <small>ยังไม่มีประวัติ</small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={<Wifi />}
            text="ยังไม่มีทะเบียนอุปกรณ์หรือจุดตรวจ"
            detail="เพิ่มจุดตรวจความชื้นดิน อากาศ ฝน ระดับน้ำ pH หรือชนิดอื่น แล้วกรอกค่าแมนนวลได้ทันที"
          />
        )}
      </div>
    </>
  );
}
function AlertView({
  alerts,
  resolve,
}: {
  alerts: SmartAlert[];
  resolve: (id: string) => void;
}) {
  return (
    <div className="p7-panel">
      <div className="p7-panel-title">
        <div>
          <b>เหตุที่ต้องดำเนินการ</b>
          <span>สร้างจากอาการระดับเตือน/เร่งด่วน และค่าตรวจวัดที่ถึงเกณฑ์</span>
        </div>
      </div>
      {alerts.length ? (
        <div className="alert-list">
          {alerts.map((a) => (
            <article key={a.id} className={`${a.severity} ${a.status}`}>
              <i>
                <AlertTriangle />
              </i>
              <div>
                <span>
                  {a.plotName || "ระดับสวน"} · {dateTime(a.triggeredAt)}
                </span>
                <b>{a.title}</b>
                {a.detail && <p>{a.detail}</p>}
                {a.recommendedAction && (
                  <small>แนะนำ: {a.recommendedAction}</small>
                )}
              </div>
              {a.status === "open" ? (
                <button onClick={() => resolve(a.id)}>
                  <CheckCircle2 /> ปิดเหตุ
                </button>
              ) : (
                <strong>ปิดแล้ว</strong>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<CheckCircle2 />}
          text="ไม่มีการแจ้งเตือน"
          detail="เมื่อพบความเสี่ยง ระบบจะแสดงรายการและคำแนะนำเบื้องต้นที่นี่"
        />
      )}
    </div>
  );
}

function ObservationModal({
  data,
  close,
  saved,
}: {
  data: SmartData;
  close: () => void;
  saved: () => void;
}) {
  const [plotId, setPlot] = useState(""),
    [treeId, setTree] = useState(""),
    [observationType, setType] = useState("disease"),
    [severity, setSeverity] = useState("watch"),
    [symptom, setSymptom] = useState(""),
    [note, setNote] = useState(""),
    [photoKey, setPhoto] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const trees = data.trees.filter((x) => !plotId || x.plotId === plotId);
  const file = (f?: File) => {
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > 350 * 1024
    )
      return setError("กรุณาเลือกไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 350 KB");
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(f);
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "observation",
          plotId,
          treeId,
          observationType,
          severity,
          symptom,
          note,
          photoKey,
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
    <Modal title="แจ้งอาการผิดปกติ" close={close}>
      <div className="p7-form">
        <Select
          label="แปลง"
          value={plotId}
          set={(v) => {
            setPlot(v);
            setTree("");
          }}
          options={[
            { value: "", label: "ระดับสวน/ไม่ระบุ" },
            ...data.plots.map((x) => ({ value: x.id, label: x.name })),
          ]}
        />
        <Select
          label="ต้นทุเรียน"
          value={treeId}
          set={setTree}
          options={[
            { value: "", label: "ไม่ระบุต้น" },
            ...trees.map((x) => ({
              value: x.id,
              label: `${x.durianId} · ${x.plotName}`,
            })),
          ]}
        />
        <Select
          label="ประเภท"
          value={observationType}
          set={setType}
          options={["disease", "pest", "nutrition", "water", "general"].map(
            (x) => ({ value: x, label: labels[x] }),
          )}
        />
        <Select
          label="ระดับ"
          value={severity}
          set={setSeverity}
          options={[
            { value: "watch", label: "เฝ้าดู" },
            { value: "warning", label: "ควรตรวจสอบ" },
            { value: "urgent", label: "เร่งด่วน" },
          ]}
        />
        <label className="wide">
          อาการที่พบ
          <input
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder="เช่น ใบมีจุดสีน้ำตาล กิ่งเริ่มเหี่ยว"
          />
        </label>
        <label className="wide">
          รายละเอียดเพิ่มเติม
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <label className="p7-photo">
        <Camera />
        <span>
          <b>{photoKey ? "แนบรูปแล้ว" : "แนบรูปอาการ (ไม่เกิน 350 KB)"}</b>
          <small>ใช้ประกอบการติดตามครั้งถัดไป</small>
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => file(e.target.files?.[0])}
        />
      </label>
      <p className="p7-help">
        <AlertTriangle /> ระดับ “ควรตรวจสอบ” และ “เร่งด่วน”
        จะสร้างรายการในศูนย์แจ้งเตือนโดยอัตโนมัติ
      </p>
      {error && <ErrorText text={error} />}
      <Actions close={close} submit={submit} busy={busy} disabled={!symptom} />
    </Modal>
  );
}
function DeviceModal({
  plots,
  close,
  saved,
}: {
  plots: Plot[];
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(""),
    [plotId, setPlot] = useState(""),
    [deviceType, setType] = useState("soil_moisture"),
    [unit, setUnit] = useState("%"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const defaults: Record<string, string> = {
    soil_moisture: "%",
    temperature: "°C",
    humidity: "%RH",
    rainfall: "มม.",
    water_level: "ซม.",
    ph: "pH",
    other: "หน่วย",
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "device",
          name,
          plotId,
          deviceType,
          unit,
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
    <Modal title="เพิ่มอุปกรณ์หรือจุดตรวจ" close={close}>
      <div className="p7-form">
        <label className="wide">
          ชื่ออุปกรณ์/จุดตรวจ
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น เซนเซอร์ความชื้นแปลง A จุด 1"
          />
        </label>
        <Select
          label="แปลง"
          value={plotId}
          set={setPlot}
          options={[
            { value: "", label: "ระดับสวน" },
            ...plots.map((x) => ({ value: x.id, label: x.name })),
          ]}
        />
        <Select
          label="ชนิด"
          value={deviceType}
          set={(v) => {
            setType(v);
            setUnit(defaults[v]);
          }}
          options={Object.keys(defaults).map((x) => ({
            value: x,
            label: labels[x],
          }))}
        />
        <label>
          หน่วย
          <input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
      </div>
      <p className="p7-help">
        <Radio />{" "}
        ทะเบียนนี้ใช้ได้ทั้งการกรอกค่าแมนนวลและการเชื่อมอุปกรณ์จริงในอนาคต
      </p>
      {error && <ErrorText text={error} />}
      <Actions
        close={close}
        submit={submit}
        busy={busy}
        disabled={!name || !unit}
      />
    </Modal>
  );
}
function ReadingModal({
  devices,
  close,
  saved,
}: {
  devices: Device[];
  close: () => void;
  saved: () => void;
}) {
  const [deviceId, setDevice] = useState(devices[0]?.id || ""),
    [value, setValue] = useState(""),
    [recordedAt, setRecorded] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const device = devices.find((x) => x.id === deviceId);
  const submit = async () => {
    setBusy(true);
    try {
      await api({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reading",
          deviceId,
          value: Number(value),
          recordedAt: Math.floor(new Date(recordedAt).getTime() / 1000),
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
    <Modal title="บันทึกค่าตรวจวัดแมนนวล" close={close}>
      {devices.length ? (
        <div className="p7-form">
          <Select
            label="อุปกรณ์/จุดตรวจ"
            value={deviceId}
            set={setDevice}
            options={devices.map((x) => ({
              value: x.id,
              label: `${x.name} · ${x.plotName || "ระดับสวน"}`,
            }))}
          />
          <label>
            ค่าที่วัดได้
            <div className="value-input">
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <span>{device?.unit}</span>
            </div>
          </label>
          <label className="wide">
            วันและเวลาที่ตรวจ
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecorded(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <p>กรุณาเพิ่มอุปกรณ์หรือจุดตรวจก่อน</p>
      )}
      <p className="p7-help">
        <Gauge /> ค่านี้จะถูกเก็บในประวัติ
        และประเมินเกณฑ์แจ้งเตือนเหมือนข้อมูลจากเซนเซอร์อัตโนมัติ
      </p>
      {error && <ErrorText text={error} />}
      <Actions
        close={close}
        submit={submit}
        busy={busy}
        disabled={!deviceId || value === "" || !recordedAt}
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
      <div className="modal p7-modal">
        <button className="close" onClick={close}>
          <X />
        </button>
        <small>สวนอัจฉริยะ P7</small>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Actions({
  close,
  submit,
  busy,
  disabled,
}: {
  close: () => void;
  submit: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="p7-modal-actions">
      <button onClick={close}>ยกเลิก</button>
      <button className="primary" disabled={busy || disabled} onClick={submit}>
        {busy ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </div>
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
  set: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function ErrorText({ text }: { text: string }) {
  return <p className="p7-error">{text}</p>;
}
function Empty({
  icon,
  text,
  detail,
}: {
  icon: React.ReactNode;
  text: string;
  detail: string;
}) {
  return (
    <div className="p7-empty">
      <i>{icon}</i>
      <b>{text}</b>
      <span>{detail}</span>
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
      <i>{icon}</i>
      <span>
        {label}
        <b>{value}</b>
      </span>
    </article>
  );
}
function severityName(x: string) {
  return (
    (
      { watch: "เฝ้าดู", warning: "ควรตรวจสอบ", urgent: "เร่งด่วน" } as Record<
        string,
        string
      >
    )[x] || x
  );
}
function DeviceIcon({ type }: { type: string }) {
  if (type === "temperature") return <Thermometer />;
  if (["soil_moisture", "humidity", "rainfall", "water_level"].includes(type))
    return <Droplets />;
  if (type === "ph") return <Activity />;
  return <Gauge />;
}
