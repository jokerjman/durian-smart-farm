"use client";
import "./trace.css";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Check,
  Leaf,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Trees,
} from "lucide-react";
export default function TracePage() {
  const params = useParams<{ key: string }>(),
    key = String(params?.key || "");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!key) return;
    fetch(`/api/trace/${encodeURIComponent(key)}`)
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw new Error(x.error);
        setData(x);
      })
      .catch((e) => setError(e.message));
  }, [key]);
  if (error)
    return (
      <main className="trace-public">
        <section className="trace-error">
          <Leaf />
          <h1>ไม่พบข้อมูลรุ่นผลผลิต</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  if (!data)
    return (
      <main className="trace-public">
        <section className="trace-error">
          <Leaf />
          <h1>กำลังตรวจสอบข้อมูล...</h1>
        </section>
      </main>
    );
  const b = data.batch;
  return (
    <main className="trace-public">
      <header>
        <span>
          <i>
            <Leaf />
          </i>
          <b>
            น้องทุเรียน<small>Durian Smart Farm</small>
          </b>
        </span>
        <em>
          <ShieldCheck /> ข้อมูลจากสวนโดยตรง
        </em>
      </header>
      <section className="trace-hero">
        <div>
          <small>ตรวจสอบย้อนกลับรุ่นผลผลิต</small>
          <h1>{b.lotCode}</h1>
          <p>
            {b.variety} · เก็บเกี่ยว {b.harvestedOn}
          </p>
          <span>
            <Check /> ยืนยันแหล่งผลิตในระบบ
          </span>
        </div>
        <Image
          src="/nong-durian.png"
          alt="น้องทุเรียน"
          width={260}
          height={260}
        />
      </section>
      <div className="trace-facts">
        <article>
          <MapPin />
          <span>
            แหล่งผลิต<b>{b.farmName}</b>
            <small>{b.plotName || "ข้อมูลระดับสวน"}</small>
          </span>
        </article>
        <article>
          <PackageCheck />
          <span>
            ผลผลิตรุ่นนี้
            <b>{Number(b.totalWeightKg).toLocaleString("th-TH")} กก.</b>
            <small>{b.fruitCount || 0} ผล</small>
          </span>
        </article>
        <article>
          <Trees />
          <span>
            ต้นที่เชื่อมโยง<b>{b.treeCount || 0} ต้น</b>
            <small>{b.seasonName || "ไม่ระบุฤดู"}</small>
          </span>
        </article>
      </div>
      <section className="trace-section">
        <h2>ผลการคัดเกรด</h2>
        {data.grades.length ? (
          <div className="trace-grades">
            {data.grades.map((g: any) => (
              <article key={g.grade}>
                <b>{g.grade}</b>
                <strong>
                  {Number(g.weightKg).toLocaleString("th-TH")} กก.
                </strong>
                <small>
                  {g.fruitCount ? `${g.fruitCount} ผล` : g.note || ""}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="trace-empty">อยู่ระหว่างบันทึกผลการคัดเกรด</p>
        )}
      </section>
      <section className="trace-section">
        <h2>ต้นทุเรียนในรุ่น</h2>
        {data.trees.length ? (
          <div className="trace-tree-list">
            {data.trees.map((t: any) => (
              <span key={t.durianId}>
                <Leaf />
                <b>{t.durianId}</b>
                <small>{t.variety}</small>
              </span>
            ))}
          </div>
        ) : (
          <p className="trace-empty">รุ่นนี้บันทึกข้อมูลในระดับแปลง</p>
        )}
      </section>
      <section className="trace-section">
        <h2>ประวัติการดูแลก่อนเก็บเกี่ยว</h2>
        {data.practices.length ? (
          <div className="trace-practices">
            {data.practices.map((x: any, i: number) => (
              <article key={i}>
                <i>
                  <Check />
                </i>
                <span>
                  <b>{x.title}</b>
                  <small>
                    {x.products || "ไม่ใช้ปัจจัยการผลิต"} ·{" "}
                    {new Date(x.completedAt * 1000).toLocaleDateString("th-TH")}
                  </small>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="trace-empty">ยังไม่มีประวัติงานที่เชื่อมกับรุ่นนี้</p>
        )}
      </section>
      <footer>
        <ShieldCheck /> ข้อมูลนี้สร้างจากบันทึกการปฏิบัติงานของ {b.farmName}
      </footer>
    </main>
  );
}
