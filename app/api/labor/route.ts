import {env} from "cloudflare:workers";
import {assertSameOrigin,audit,id,now,requireSession} from "@/lib/authz";

const clean=(value:unknown,max=160)=>String(value??"").trim().slice(0,max);
const may=(s:{role:string;permissions:string[]},key:string)=>s.role==="admin"||s.permissions.includes("*")||s.permissions.includes(key);

export async function GET(){
 try{
  const s=await requireSession();if(!may(s,"work.view")&&!may(s,"work.manage"))throw new Response("ไม่มีสิทธิ์ดำเนินการ",{status:403});
  const workers=await env.DB!.prepare("SELECT id,name,pay_type AS payType,default_rate AS defaultRate,active FROM workers WHERE farm_id=? ORDER BY active DESC,name").bind(s.farmId).all();
  const entries=await env.DB!.prepare(`SELECT l.id,l.worker_id AS workerId,w.name AS workerName,l.work_item_id AS workItemId,wi.title AS workTitle,l.work_date AS workDate,l.pay_type AS payType,l.quantity,l.rate,l.amount,l.transaction_id AS transactionId
   FROM labor_entries l JOIN workers w ON w.id=l.worker_id LEFT JOIN work_items wi ON wi.id=l.work_item_id WHERE w.farm_id=? ORDER BY l.work_date DESC,l.created_at DESC LIMIT 200`).bind(s.farmId).all();
  return Response.json({workers:workers.results||[],entries:entries.results||[]});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดข้อมูลค่าแรงไม่สำเร็จ"},{status:500})}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();if(!may(s,"work.manage"))throw new Response("ไม่มีสิทธิ์จัดการค่าแรง",{status:403});const b=await req.json() as Record<string,unknown>,action=clean(b.action,30),ts=now();
  if(action==="worker"){
   const name=clean(b.name,120);if(!name)return Response.json({error:"กรุณาระบุชื่อคนงาน"},{status:400});const workerId=id("worker"),payType=clean(b.payType,30)||"daily",rate=Math.max(0,Number(b.defaultRate)||0);await env.DB!.prepare("INSERT INTO workers (id,farm_id,name,pay_type,default_rate,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(workerId,s.farmId,name,payType,rate,1,ts,ts).run();await audit(s,"create","worker",workerId,{name,payType,rate});return Response.json({id:workerId},{status:201});
  }
  if(action==="entry"){
   const workerId=clean(b.workerId,80),workItemId=clean(b.workItemId,80)||null,workDate=clean(b.workDate,10)||new Date().toISOString().slice(0,10),payType=clean(b.payType,30)||"daily",quantity=Math.max(0,Number(b.quantity)||0),rate=Math.max(0,Number(b.rate)||0),amount=quantity*rate;
   if(!workerId||quantity<=0||rate<=0)return Response.json({error:"กรุณาระบุคนงาน จำนวน และอัตราค่าแรง"},{status:400});const worker=await env.DB!.prepare("SELECT id,name FROM workers WHERE id=? AND farm_id=? AND active=1").bind(workerId,s.farmId).first<{id:string;name:string}>();if(!worker)return Response.json({error:"ไม่พบคนงาน"},{status:404});
   if(workItemId&&!await env.DB!.prepare("SELECT id FROM work_items WHERE id=? AND farm_id=?").bind(workItemId,s.farmId).first())return Response.json({error:"งานไม่อยู่ในสวนนี้"},{status:400});
   const entryId=id("labor"),transactionId=id("txn"),categoryId=`labor_${s.farmId}`;await env.DB!.batch([
    env.DB!.prepare("INSERT OR IGNORE INTO finance_categories (id,farm_id,type,name,is_system) VALUES (?,?,?,?,?)").bind(categoryId,s.farmId,"expense","ค่าแรง",1),
    env.DB!.prepare("INSERT INTO transactions (id,farm_id,plot_id,season_id,category_id,work_item_id,type,title,amount,occurred_on,receipt_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(transactionId,s.farmId,null,null,categoryId,null,"expense",`ค่าแรง · ${worker.name}`,amount,workDate,null,ts,ts),
    env.DB!.prepare("INSERT INTO labor_entries (id,worker_id,work_item_id,work_date,pay_type,quantity,rate,amount,transaction_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(entryId,workerId,workItemId,workDate,payType,quantity,rate,amount,transactionId,ts,ts)
   ]);await audit(s,"create","labor_entry",entryId,{workerId,workItemId,workDate,payType,quantity,rate,amount,transactionId});return Response.json({id:entryId,transactionId,amount},{status:201});
  }
  return Response.json({error:"คำสั่งไม่ถูกต้อง"},{status:400});
 }catch(e){return e instanceof Response?e:Response.json({error:"บันทึกค่าแรงไม่สำเร็จ"},{status:500})}
}
