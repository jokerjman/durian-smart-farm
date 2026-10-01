import {env} from "cloudflare:workers";
import {assertSameOrigin,audit,id,now,requireSession} from "@/lib/authz";

const stages=["พักต้น","ฟื้นฟูต้น","แตกใบอ่อน","สะสมอาหาร","ทำดอก","ดอกบาน","ติดผล","ขยายผล","ก่อนเก็บเกี่ยว","เก็บเกี่ยว"];
const clean=(value:unknown,max=300)=>String(value??"").trim().slice(0,max);
const canView=(s:{role:string;permissions:string[]})=>s.role==="admin"||s.permissions.includes("*")||s.permissions.includes("dashboard.view")||s.permissions.includes("farms.manage");
const canManage=(s:{role:string;permissions:string[]})=>s.role==="admin"||s.permissions.includes("*")||s.permissions.includes("season.manage")||s.permissions.includes("farms.manage");
async function hasFarm(userId:string,farmId:string){return env.DB!.prepare("SELECT 1 AS ok FROM farm_members WHERE user_id=? AND farm_id=? AND status='active'").bind(userId,farmId).first()}

export async function GET(){
 try{
  const s=await requireSession();if(!canView(s))throw new Response("ไม่มีสิทธิ์ดำเนินการ",{status:403});
  const rows=await env.DB!.prepare(`SELECT se.id,se.farm_id AS farmId,f.name AS farmName,se.name,se.start_date AS startDate,se.end_date AS endDate,se.status,se.target_kg AS targetKg,se.budget,se.actual_kg AS actualKg,se.summary,se.closed_at AS closedAt,
   (SELECT name FROM season_stages WHERE season_id=se.id AND status='active' ORDER BY sequence LIMIT 1) AS currentStage,
   (SELECT COUNT(*) FROM work_items WHERE season_id=se.id) AS workCount,
   (SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) FROM transactions WHERE season_id=se.id) AS expense,
   (SELECT COALESCE(SUM(total_weight_kg),0) FROM harvest_batches WHERE season_id=se.id) AS harvestKg
   FROM seasons se JOIN farms f ON f.id=se.farm_id JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active'
   ORDER BY CASE WHEN se.status IN ('current','active','in_progress') THEN 0 ELSE 1 END,se.start_date DESC`).bind(s.userId).all();
  const seasons=rows.results||[];const active=seasons.find((x:any)=>["current","active","in_progress"].includes(x.status))||null;
  let activeStages:unknown[]=[];if(active)activeStages=(await env.DB!.prepare("SELECT id,name,sequence,status,started_on AS startedOn,completed_on AS completedOn,note FROM season_stages WHERE season_id=? ORDER BY sequence").bind((active as any).id).all()).results||[];
  return Response.json({seasons,active,activeStages,stageTemplates:stages});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดข้อมูลฤดูผลิตไม่สำเร็จ"},{status:500})}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();if(!canManage(s))throw new Response("ไม่มีสิทธิ์ดำเนินการ",{status:403});const b=await req.json() as Record<string,unknown>,action=clean(b.action,20);
  if(action==="create"){
   const farmId=clean(b.farmId,80),name=clean(b.name,100),startDate=clean(b.startDate,10),endDate=clean(b.endDate,10);
   if(!farmId||!name||!startDate)return Response.json({error:"กรุณาระบุสวน ชื่อฤดู และวันเริ่มต้น"},{status:400});
   if(!await hasFarm(s.userId,farmId))return Response.json({error:"ไม่มีสิทธิ์ในสวนนี้"},{status:403});
   if(await env.DB!.prepare("SELECT id FROM seasons WHERE farm_id=? AND status IN ('current','active','in_progress')").bind(farmId).first())return Response.json({error:"สวนนี้มีฤดูที่กำลังดำเนินการอยู่ กรุณาปิดฤดูเดิมก่อน"},{status:409});
   if(endDate&&endDate<startDate)return Response.json({error:"วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"},{status:400});
   const seasonId=id("season"),ts=now(),statements=[env.DB!.prepare("INSERT INTO seasons (id,farm_id,name,start_date,end_date,status,target_kg,budget,actual_kg,summary,closed_at,closed_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(seasonId,farmId,name,startDate,endDate||null,"current",Number(b.targetKg)||null,Number(b.budget)||null,null,null,null,null,ts,ts)];
   stages.forEach((stage,index)=>statements.push(env.DB!.prepare("INSERT INTO season_stages (id,season_id,name,sequence,status,started_on,completed_on,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id("season_stage"),seasonId,stage,index+1,index===0?"active":"planned",index===0?startDate:null,null,null,ts,ts)));
   await env.DB!.batch(statements);await audit(s,"create","season",seasonId,{farmId,name,startDate,endDate});return Response.json({id:seasonId},{status:201});
  }
  const seasonId=clean(b.seasonId,80);const season=await env.DB!.prepare("SELECT se.id,se.farm_id AS farmId,se.status FROM seasons se JOIN farm_members fm ON fm.farm_id=se.farm_id AND fm.user_id=? AND fm.status='active' WHERE se.id=?").bind(s.userId,seasonId).first<{id:string;farmId:string;status:string}>();
  if(!season)return Response.json({error:"ไม่พบฤดูผลิต"},{status:404});if(!["current","active","in_progress"].includes(season.status))return Response.json({error:"ฤดูนี้ถูกปิดแล้วและเก็บเป็นประวัติ"},{status:409});
  if(action==="advance"){
   const current=await env.DB!.prepare("SELECT id,sequence,name FROM season_stages WHERE season_id=? AND status='active' ORDER BY sequence LIMIT 1").bind(seasonId).first<{id:string;sequence:number;name:string}>();
   if(!current)return Response.json({error:"ไม่พบระยะปัจจุบัน"},{status:409});const next=await env.DB!.prepare("SELECT id,name FROM season_stages WHERE season_id=? AND sequence=?").bind(seasonId,current.sequence+1).first<{id:string;name:string}>();const today=clean(b.date,10)||new Date().toISOString().slice(0,10),ts=now();
   const statements=[env.DB!.prepare("UPDATE season_stages SET status='completed',completed_on=?,note=COALESCE(?,note),updated_at=? WHERE id=?").bind(today,clean(b.note,300)||null,ts,current.id)];if(next)statements.push(env.DB!.prepare("UPDATE season_stages SET status='active',started_on=?,updated_at=? WHERE id=?").bind(today,ts,next.id));await env.DB!.batch(statements);await audit(s,"advance_stage","season",seasonId,{from:current.name,to:next?.name||null,date:today});return Response.json({ok:true,nextStage:next?.name||null});
  }
  if(action==="close"){
   const today=clean(b.endDate,10)||new Date().toISOString().slice(0,10),ts=now();await env.DB!.batch([env.DB!.prepare("UPDATE seasons SET status='closed',end_date=?,actual_kg=?,summary=?,closed_at=?,closed_by=?,updated_at=? WHERE id=?").bind(today,Number(b.actualKg)||null,clean(b.summary,1000)||null,ts,s.userId,ts,seasonId),env.DB!.prepare("UPDATE season_stages SET status=CASE WHEN status='active' THEN 'completed' ELSE status END,completed_on=CASE WHEN status='active' THEN ? ELSE completed_on END,updated_at=? WHERE season_id=?").bind(today,ts,seasonId)]);await audit(s,"close","season",seasonId,{endDate:today,actualKg:Number(b.actualKg)||null});return Response.json({ok:true});
  }
  return Response.json({error:"คำสั่งไม่ถูกต้อง"},{status:400});
 }catch(e){return e instanceof Response?e:Response.json({error:"บันทึกฤดูผลิตไม่สำเร็จ"},{status:500})}
}
