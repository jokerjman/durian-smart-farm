import {env} from "cloudflare:workers";
import {assertSameOrigin,audit,id,now,permitPermission,requireSession} from "@/lib/authz";

const clean=(value:unknown,max=160)=>String(value??"").trim().slice(0,max);
async function plotAccess(userId:string,plotId:string){return env.DB!.prepare("SELECT p.id,p.farm_id AS farmId,p.code FROM plots p JOIN farm_members fm ON fm.farm_id=p.farm_id AND fm.user_id=? AND fm.status='active' WHERE p.id=?").bind(userId,plotId).first<{id:string;farmId:string;code:string|null}>()}

export async function GET(req:Request){
 try{
  const s=await requireSession();permitPermission(s,"trees.manage");const treeId=new URL(req.url).searchParams.get("id");
  if(treeId){
   const tree=await env.DB!.prepare(`SELECT t.id,t.durian_id AS durianId,t.variety,t.planted_at AS plantedAt,t.status,t.production_stage AS productionStage,t.qr_key AS qrKey,t.photo_key AS photoKey,t.note,p.id AS plotId,p.name AS plotName,f.id AS farmId,f.name AS farmName
    FROM trees t JOIN plots p ON p.id=t.plot_id JOIN farms f ON f.id=p.farm_id JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active' WHERE t.id=?`).bind(s.userId,treeId).first();
   if(!tree)return Response.json({error:"ไม่พบต้นทุเรียน"},{status:404});
   const events=await env.DB!.prepare("SELECT id,event_type AS eventType,note,photo_key AS photoKey,event_at AS eventAt FROM tree_events WHERE tree_id=? ORDER BY event_at DESC").bind(treeId).all();
   return Response.json({tree,events:events.results||[]});
  }
  const rows=await env.DB!.prepare(`SELECT t.id,t.durian_id AS durianId,t.variety,t.planted_at AS plantedAt,t.status,t.production_stage AS productionStage,t.qr_key AS qrKey,t.photo_key AS photoKey,p.id AS plotId,p.name AS plotName,p.code AS plotCode,f.id AS farmId,f.name AS farmName
   FROM trees t JOIN plots p ON p.id=t.plot_id JOIN farms f ON f.id=p.farm_id JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active' ORDER BY t.created_at DESC`).bind(s.userId).all();
  return Response.json({trees:rows.results||[]});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดทะเบียนต้นไม่สำเร็จ"},{status:500})}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();permitPermission(s,"trees.manage");const b=await req.json() as Record<string,unknown>;
  if(b.action==="event"){
   const treeId=clean(b.treeId,80),eventType=clean(b.eventType,50)||"บันทึกทั่วไป";
   const tree=await env.DB!.prepare("SELECT t.id FROM trees t JOIN plots p ON p.id=t.plot_id JOIN farm_members fm ON fm.farm_id=p.farm_id AND fm.user_id=? AND fm.status='active' WHERE t.id=?").bind(s.userId,treeId).first();
   if(!tree)return Response.json({error:"ไม่พบต้นทุเรียน"},{status:404});
   const eventId=id("tree_event"),eventAt=Number(b.eventAt)||now();
   await env.DB!.prepare("INSERT INTO tree_events (id,tree_id,event_type,note,photo_key,event_at) VALUES (?,?,?,?,?,?)").bind(eventId,treeId,eventType,clean(b.note,500)||null,clean(b.photoKey,300)||null,eventAt).run();
   await audit(s,"create","tree_event",eventId,{treeId,eventType});return Response.json({id:eventId},{status:201});
  }
  const plotId=clean(b.plotId,80),variety=clean(b.variety,80);if(!plotId||!variety)return Response.json({error:"กรุณาระบุแปลงและพันธุ์ทุเรียน"},{status:400});
  const plot=await plotAccess(s.userId,plotId);if(!plot)return Response.json({error:"ไม่มีสิทธิ์ในแปลงนี้"},{status:403});
  const pref=await env.DB!.prepare("SELECT tree_code_prefix AS prefix FROM farm_settings WHERE farm_id=?").bind(plot.farmId).first<{prefix:string}>();
  const count=await env.DB!.prepare("SELECT COUNT(*) AS count FROM trees t JOIN plots p ON p.id=t.plot_id WHERE p.farm_id=?").bind(plot.farmId).first<{count:number}>();
  const durianId=clean(b.durianId,40).toUpperCase()||`${pref?.prefix||"DUR"}-${String(Number(count?.count||0)+1).padStart(4,"0")}`;
  if(!/^[A-Z0-9-]+$/.test(durianId))return Response.json({error:"Durian ID ใช้ได้เฉพาะ A-Z, 0-9 และขีดกลาง"},{status:400});
  if(await env.DB!.prepare("SELECT id FROM trees WHERE durian_id=?").bind(durianId).first())return Response.json({error:"Durian ID นี้ถูกใช้แล้ว"},{status:409});
  const treeId=id("tree"),qrKey=crypto.randomUUID(),ts=now(),status=clean(b.status,40)||"ปกติ",stage=clean(b.productionStage,60)||"พักต้น";
  await env.DB!.batch([
   env.DB!.prepare("INSERT INTO trees (id,durian_id,plot_id,variety,planted_at,status,production_stage,qr_key,photo_key,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(treeId,durianId,plotId,variety,clean(b.plantedAt,10)||null,status,stage,qrKey,clean(b.photoKey,300)||null,clean(b.note,500)||null,ts,ts),
   env.DB!.prepare("INSERT INTO tree_events (id,tree_id,event_type,note,photo_key,event_at) VALUES (?,?,?,?,?,?)").bind(id("tree_event"),treeId,"ขึ้นทะเบียน","เพิ่มต้นทุเรียนเข้าสู่ระบบ",clean(b.photoKey,300)||null,ts)
  ]);
  await audit(s,"create","tree",treeId,{durianId,plotId,variety});return Response.json({id:treeId,durianId,qrKey},{status:201});
 }catch(e){return e instanceof Response?e:Response.json({error:"บันทึกข้อมูลต้นไม่สำเร็จ"},{status:500})}
}

export async function PATCH(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();permitPermission(s,"trees.manage");const b=await req.json() as Record<string,unknown>,treeId=clean(b.id,80);
  const tree=await env.DB!.prepare("SELECT t.id FROM trees t JOIN plots p ON p.id=t.plot_id JOIN farm_members fm ON fm.farm_id=p.farm_id AND fm.user_id=? AND fm.status='active' WHERE t.id=?").bind(s.userId,treeId).first();
  if(!tree)return Response.json({error:"ไม่พบต้นทุเรียน"},{status:404});
  await env.DB!.prepare("UPDATE trees SET status=?,production_stage=?,note=?,photo_key=?,updated_at=? WHERE id=?").bind(clean(b.status,40)||"ปกติ",clean(b.productionStage,60)||"พักต้น",clean(b.note,500)||null,clean(b.photoKey,300)||null,now(),treeId).run();
  await audit(s,"update","tree",treeId,{status:b.status,productionStage:b.productionStage});return Response.json({ok:true});
 }catch(e){return e instanceof Response?e:Response.json({error:"แก้ไขข้อมูลต้นไม่สำเร็จ"},{status:500})}
}
