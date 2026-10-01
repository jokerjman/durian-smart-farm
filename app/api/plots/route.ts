import {env} from "cloudflare:workers";
import {assertSameOrigin,audit,id,now,permitPermission,requireSession} from "@/lib/authz";

const clean=(value:unknown,max=120)=>String(value??"").trim().slice(0,max);
async function canUseFarm(userId:string,farmId:string){return env.DB!.prepare("SELECT 1 AS ok FROM farm_members WHERE user_id=? AND farm_id=? AND status='active'").bind(userId,farmId).first()}

export async function GET(){
 try{
  const s=await requireSession();
  if(s.role!=="admin"&&!s.permissions.includes("farms.manage")&&!s.permissions.includes("trees.manage"))throw new Response("ไม่มีสิทธิ์ดำเนินการ",{status:403});
  const rows=await env.DB!.prepare(`SELECT p.id,p.farm_id AS farmId,p.code,p.name,p.area_rai AS areaRai,p.note,f.name AS farmName,COUNT(t.id) AS treeCount
   FROM plots p JOIN farms f ON f.id=p.farm_id JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active'
   LEFT JOIN trees t ON t.plot_id=p.id GROUP BY p.id ORDER BY f.created_at,p.created_at`).bind(s.userId).all();
  return Response.json({plots:rows.results||[]});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดข้อมูลแปลงไม่สำเร็จ"},{status:500})}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();permitPermission(s,"farms.manage");
  const b=await req.json() as Record<string,unknown>,farmId=clean(b.farmId,80),name=clean(b.name,100);
  if(!farmId||!name)return Response.json({error:"กรุณาระบุสวนและชื่อแปลง"},{status:400});
  if(!await canUseFarm(s.userId,farmId))return Response.json({error:"ไม่มีสิทธิ์ในสวนนี้"},{status:403});
  const pref=await env.DB!.prepare("SELECT plot_code_prefix AS prefix FROM farm_settings WHERE farm_id=?").bind(farmId).first<{prefix:string}>();
  const count=await env.DB!.prepare("SELECT COUNT(*) AS count FROM plots WHERE farm_id=?").bind(farmId).first<{count:number}>();
  const code=clean(b.code,20).toUpperCase()||`${pref?.prefix||"PLOT"}-${String(Number(count?.count||0)+1).padStart(2,"0")}`;
  if(await env.DB!.prepare("SELECT id FROM plots WHERE farm_id=? AND code=?").bind(farmId,code).first())return Response.json({error:"รหัสแปลงนี้ถูกใช้แล้ว"},{status:409});
  const plotId=id("plot"),ts=now();
  await env.DB!.prepare("INSERT INTO plots (id,farm_id,code,name,area_rai,geo_json,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(plotId,farmId,code,name,Number(b.areaRai)||null,null,clean(b.note,500)||null,ts,ts).run();
  await audit(s,"create","plot",plotId,{farmId,code,name});
  return Response.json({id:plotId,code,name},{status:201});
 }catch(e){return e instanceof Response?e:Response.json({error:"เพิ่มแปลงไม่สำเร็จ"},{status:500})}
}
