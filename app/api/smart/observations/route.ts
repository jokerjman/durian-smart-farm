import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  audit,
  id,
  now,
  permitPermission,
  requireSession,
} from "@/lib/authz";

const clean = (value: unknown, max = 240) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const deviceDefaults: Record<string, { unit: string; label: string }> = {
  soil_moisture: { unit: "%", label: "ความชื้นดิน" },
  temperature: { unit: "°C", label: "อุณหภูมิ" },
  humidity: { unit: "%RH", label: "ความชื้นอากาศ" },
  rainfall: { unit: "มม.", label: "ปริมาณฝน" },
  water_level: { unit: "ซม.", label: "ระดับน้ำ" },
  ph: { unit: "pH", label: "ความเป็นกรด-ด่าง" },
  other: { unit: "หน่วย", label: "ค่าตรวจวัด" },
};
function threshold(type: string, value: number) {
  if (type === "soil_moisture" && value < 30)
    return {
      severity: "warning",
      title: "ความชื้นดินต่ำ",
      action: "ตรวจระบบน้ำและสภาพดินก่อนให้น้ำเพิ่ม",
    };
  if (type === "soil_moisture" && value > 85)
    return {
      severity: "warning",
      title: "ความชื้นดินสูง",
      action: "ตรวจการระบายน้ำและลดการให้น้ำชั่วคราว",
    };
  if (type === "temperature" && value > 38)
    return {
      severity: "urgent",
      title: "อุณหภูมิสูงผิดปกติ",
      action: "ตรวจต้นและระบบน้ำในพื้นที่ทันที",
    };
  if (type === "humidity" && value > 90)
    return {
      severity: "warning",
      title: "ความชื้นอากาศสูง",
      action: "เฝ้าระวังโรคเชื้อราและตรวจทรงพุ่ม",
    };
  if (type === "humidity" && value < 40)
    return {
      severity: "warning",
      title: "ความชื้นอากาศต่ำ",
      action: "ตรวจภาวะขาดน้ำของต้นและระบบให้น้ำ",
    };
  return null;
}
async function validPlot(plotId: string, farmId: string) {
  return !!(await env
    .DB!.prepare("SELECT 1 FROM plots WHERE id=? AND farm_id=?")
    .bind(plotId, farmId)
    .first());
}

export async function GET() {
  try {
    const s = await requireSession();
    permitPermission(s, "smartfarm.manage");
    const [plots, trees, observations, devices, alerts, readings] =
      await Promise.all([
        env
          .DB!.prepare(
            "SELECT id,name FROM plots WHERE farm_id=? ORDER BY name",
          )
          .bind(s.farmId)
          .all(),
        env
          .DB!.prepare(
            `SELECT t.id,t.durian_id AS durianId,p.id AS plotId,p.name AS plotName FROM trees t JOIN plots p ON p.id=t.plot_id WHERE p.farm_id=? AND t.status!='ตาย/โค่น' ORDER BY p.name,t.durian_id`,
          )
          .bind(s.farmId)
          .all(),
        env
          .DB!.prepare(
            `SELECT o.id,o.plot_id AS plotId,o.tree_id AS treeId,o.observation_type AS observationType,o.severity,o.symptom,o.note,o.photo_key AS photoKey,o.status,o.observed_at AS observedAt,p.name AS plotName,t.durian_id AS durianId,u.name AS observerName FROM plant_health_observations o LEFT JOIN plots p ON p.id=o.plot_id LEFT JOIN trees t ON t.id=o.tree_id LEFT JOIN users u ON u.id=o.observed_by WHERE o.farm_id=? ORDER BY o.observed_at DESC LIMIT 200`,
          )
          .bind(s.farmId)
          .all(),
        env
          .DB!.prepare(
            `SELECT d.id,d.plot_id AS plotId,d.name,d.device_type AS deviceType,d.unit,d.status,d.last_seen_at AS lastSeenAt,p.name AS plotName,(SELECT r.value FROM sensor_readings r WHERE r.device_id=d.id ORDER BY r.recorded_at DESC LIMIT 1) AS latestValue,(SELECT r.recorded_at FROM sensor_readings r WHERE r.device_id=d.id ORDER BY r.recorded_at DESC LIMIT 1) AS latestAt FROM sensor_devices d LEFT JOIN plots p ON p.id=d.plot_id WHERE d.farm_id=? ORDER BY d.created_at DESC`,
          )
          .bind(s.farmId)
          .all(),
        env
          .DB!.prepare(
            `SELECT a.id,a.plot_id AS plotId,a.alert_type AS alertType,a.severity,a.title,a.detail,a.recommended_action AS recommendedAction,a.status,a.triggered_at AS triggeredAt,a.resolved_at AS resolvedAt,p.name AS plotName FROM smart_alerts a LEFT JOIN plots p ON p.id=a.plot_id WHERE a.farm_id=? ORDER BY CASE WHEN a.status='open' THEN 0 ELSE 1 END,a.triggered_at DESC LIMIT 200`,
          )
          .bind(s.farmId)
          .all(),
        env
          .DB!.prepare(
            `SELECT r.id,r.device_id AS deviceId,r.value,r.recorded_at AS recordedAt FROM sensor_readings r JOIN sensor_devices d ON d.id=r.device_id WHERE d.farm_id=? ORDER BY r.recorded_at DESC LIMIT 500`,
          )
          .bind(s.farmId)
          .all(),
      ]);
    return Response.json({
      serverNow: now(),
      plots: plots.results || [],
      trees: trees.results || [],
      observations: observations.results || [],
      devices: devices.results || [],
      alerts: alerts.results || [],
      readings: readings.results || [],
    });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json(
          { error: "โหลดข้อมูลเฝ้าระวังไม่สำเร็จ" },
          { status: 500 },
        );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await requireSession();
    permitPermission(s, "smartfarm.manage");
    const body = (await request.json()) as Record<string, unknown>;
    const action = clean(body.action, 30),
      ts = now();
    if (action === "observation") {
      const symptom = clean(body.symptom, 240),
        plotId = clean(body.plotId, 80) || null,
        treeId = clean(body.treeId, 80) || null;
      const severity = ["watch", "warning", "urgent"].includes(
        clean(body.severity, 20),
      )
        ? clean(body.severity, 20)
        : "watch";
      const observationType = [
        "disease",
        "pest",
        "nutrition",
        "water",
        "general",
      ].includes(clean(body.observationType, 30))
        ? clean(body.observationType, 30)
        : "general";
      const photoKey = clean(body.photoKey, 500_000) || null;
      if (!symptom)
        return Response.json({ error: "กรุณาระบุอาการที่พบ" }, { status: 400 });
      if (
        photoKey &&
        (!/^data:image\/(jpeg|png|webp);base64,/.test(photoKey) ||
          photoKey.length > 470_000)
      )
        return Response.json(
          { error: "รูปต้องเป็นไฟล์ภาพและมีขนาดไม่เกิน 350 KB" },
          { status: 400 },
        );
      if (plotId && !(await validPlot(plotId, s.farmId)))
        return Response.json({ error: "ไม่พบแปลงในสวนนี้" }, { status: 400 });
      if (treeId) {
        const tree = await env
          .DB!.prepare(
            "SELECT p.id AS plotId FROM trees t JOIN plots p ON p.id=t.plot_id WHERE t.id=? AND p.farm_id=?",
          )
          .bind(treeId, s.farmId)
          .first<{ plotId: string }>();
        if (!tree || (plotId && tree.plotId !== plotId))
          return Response.json(
            { error: "ไม่พบต้นทุเรียนในแปลงที่เลือก" },
            { status: 400 },
          );
      }
      const observationId = id("obs");
      const statements: D1PreparedStatement[] = [
        env
          .DB!.prepare(
            "INSERT INTO plant_health_observations (id,farm_id,plot_id,tree_id,observation_type,severity,symptom,note,photo_key,status,observed_by,observed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            observationId,
            s.farmId,
            plotId,
            treeId,
            observationType,
            severity,
            symptom,
            clean(body.note, 1000) || null,
            photoKey,
            "open",
            s.userId,
            ts,
            ts,
            ts,
          ),
      ];
      if (severity !== "watch")
        statements.push(
          env
            .DB!.prepare(
              "INSERT INTO smart_alerts (id,farm_id,plot_id,alert_type,severity,title,detail,recommended_action,status,triggered_at,resolved_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              id("alert"),
              s.farmId,
              plotId,
              `health:${observationType}`,
              severity,
              "พบอาการที่ต้องติดตาม",
              symptom,
              "ตรวจสอบพื้นที่และมอบหมายผู้รับผิดชอบโดยเร็ว",
              "open",
              ts,
              null,
              ts,
              ts,
            ),
        );
      await env.DB!.batch(statements);
      await audit(s, "create", "plant_health_observation", observationId, {
        plotId,
        treeId,
        observationType,
        severity,
      });
      return Response.json({ id: observationId }, { status: 201 });
    }
    if (action === "device") {
      const name = clean(body.name, 120),
        plotId = clean(body.plotId, 80) || null;
      const deviceType = deviceDefaults[clean(body.deviceType, 30)]
        ? clean(body.deviceType, 30)
        : "other";
      const unit = clean(body.unit, 30) || deviceDefaults[deviceType].unit;
      if (!name)
        return Response.json(
          { error: "กรุณาระบุชื่ออุปกรณ์" },
          { status: 400 },
        );
      if (plotId && !(await validPlot(plotId, s.farmId)))
        return Response.json({ error: "ไม่พบแปลงในสวนนี้" }, { status: 400 });
      const deviceId = id("sensor");
      await env
        .DB!.prepare(
          "INSERT INTO sensor_devices (id,farm_id,plot_id,name,device_type,unit,status,last_seen_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          deviceId,
          s.farmId,
          plotId,
          name,
          deviceType,
          unit,
          "registered",
          null,
          ts,
          ts,
        )
        .run();
      await audit(s, "create", "sensor_device", deviceId, {
        plotId,
        deviceType,
        unit,
      });
      return Response.json({ id: deviceId }, { status: 201 });
    }
    if (action === "reading") {
      const deviceId = clean(body.deviceId, 80),
        value = Number(body.value);
      const recordedAt = Math.min(
        ts + 300,
        Math.max(1, Number(body.recordedAt) || ts),
      );
      if (!Number.isFinite(value))
        return Response.json({ error: "กรุณาระบุค่าตรวจวัด" }, { status: 400 });
      const device = await env
        .DB!.prepare(
          "SELECT id,plot_id AS plotId,name,device_type AS deviceType,unit FROM sensor_devices WHERE id=? AND farm_id=?",
        )
        .bind(deviceId, s.farmId)
        .first<{
          id: string;
          plotId: string | null;
          name: string;
          deviceType: string;
          unit: string;
        }>();
      if (!device)
        return Response.json(
          { error: "ไม่พบอุปกรณ์ในสวนนี้" },
          { status: 404 },
        );
      const readingId = id("reading");
      const statements: D1PreparedStatement[] = [
        env
          .DB!.prepare(
            "INSERT INTO sensor_readings (id,device_id,value,recorded_at) VALUES (?,?,?,?)",
          )
          .bind(readingId, deviceId, value, recordedAt),
        env
          .DB!.prepare(
            "UPDATE sensor_devices SET status='active',last_seen_at=?,updated_at=? WHERE id=? AND farm_id=?",
          )
          .bind(recordedAt, ts, deviceId, s.farmId),
      ];
      const hit = threshold(device.deviceType, value);
      if (hit) {
        const existing = await env
          .DB!.prepare(
            "SELECT 1 FROM smart_alerts WHERE farm_id=? AND alert_type=? AND status='open' AND ((? IS NULL AND plot_id IS NULL) OR plot_id=?) LIMIT 1",
          )
          .bind(
            s.farmId,
            `sensor:${device.deviceType}`,
            device.plotId,
            device.plotId,
          )
          .first();
        if (!existing)
          statements.push(
            env
              .DB!.prepare(
                "INSERT INTO smart_alerts (id,farm_id,plot_id,alert_type,severity,title,detail,recommended_action,status,triggered_at,resolved_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                id("alert"),
                s.farmId,
                device.plotId,
                `sensor:${device.deviceType}`,
                hit.severity,
                hit.title,
                `${device.name}: ${value} ${device.unit}`,
                hit.action,
                "open",
                recordedAt,
                null,
                ts,
                ts,
              ),
          );
      }
      await env.DB!.batch(statements);
      await audit(s, "create", "sensor_reading", readingId, {
        deviceId,
        value,
        recordedAt,
      });
      return Response.json(
        { id: readingId, alertCreated: !!hit },
        { status: 201 },
      );
    }
    return Response.json(
      { error: "ไม่รู้จักรายการที่ต้องการบันทึก" },
      { status: 400 },
    );
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json(
          { error: "บันทึกข้อมูลเฝ้าระวังไม่สำเร็จ" },
          { status: 500 },
        );
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await requireSession();
    permitPermission(s, "smartfarm.manage");
    const body = (await request.json()) as Record<string, unknown>;
    const kind = clean(body.kind, 30),
      entityId = clean(body.id, 80),
      ts = now();
    if (kind === "observation") {
      const row = await env
        .DB!.prepare(
          "SELECT id FROM plant_health_observations WHERE id=? AND farm_id=?",
        )
        .bind(entityId, s.farmId)
        .first();
      if (!row)
        return Response.json({ error: "ไม่พบรายการตรวจ" }, { status: 404 });
      await env
        .DB!.prepare(
          "UPDATE plant_health_observations SET status='resolved',updated_at=? WHERE id=? AND farm_id=?",
        )
        .bind(ts, entityId, s.farmId)
        .run();
    } else if (kind === "alert") {
      const row = await env
        .DB!.prepare("SELECT id FROM smart_alerts WHERE id=? AND farm_id=?")
        .bind(entityId, s.farmId)
        .first();
      if (!row)
        return Response.json({ error: "ไม่พบการแจ้งเตือน" }, { status: 404 });
      await env
        .DB!.prepare(
          "UPDATE smart_alerts SET status='resolved',resolved_at=?,updated_at=? WHERE id=? AND farm_id=?",
        )
        .bind(ts, ts, entityId, s.farmId)
        .run();
    } else
      return Response.json(
        { error: "ประเภทข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    await audit(s, "resolve", kind, entityId, { status: "resolved" });
    return Response.json({ saved: true });
  } catch (error) {
    return error instanceof Response
      ? error
      : Response.json({ error: "ปิดรายการไม่สำเร็จ" }, { status: 500 });
  }
}
