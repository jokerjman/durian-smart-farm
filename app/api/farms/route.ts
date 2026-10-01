import {env} from "cloudflare:workers";
import {assertSameOrigin,id,now,permitPermission,requireSession} from "@/lib/authz";

const clean=(value:unknown,max=120)=>String(value??"").trim().slice(0,max);

export async function GET(){
 try{
  const s=await requireSession();permitPermission(s,"farms.manage");
  const rows=await env.DB!.prepare(`SELECT f.id,f.code,f.name,f.address,f.area_rai AS areaRai,
   COUNT(DISTINCT p.id) AS plotCount,COUNT(DISTINCT t.id) AS treeCount
   FROM farms f JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active'
   LEFT JOIN plots p ON p.farm_id=f.id LEFT JOIN trees t ON t.plot_id=p.id
   GROUP BY f.id ORDER BY f.created_at`).bind(s.userId).all();
  return Response.json({farms:rows.results||[]});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดข้อมูลสวนไม่สำเร็จ"},{status:500})}
}

export async function POST(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();permitPermission(s,"farms.manage");
  const b=await req.json() as Record<string,unknown>,name=clean(b.name,100);
  if(!name)return Response.json({error:"กรุณาระบุชื่อสวน"},{status:400});
  const ts=now(),farmId=id("farm"),memberId=id("member"),settingsId=id("farm_settings");
  const pref=await env.DB!.prepare("SELECT farm_code_prefix AS prefix FROM farm_settings WHERE farm_id=?").bind(s.farmId).first<{prefix:string}>();
  const count=await env.DB!.prepare("SELECT COUNT(*) AS count FROM farms WHERE owner_id=?").bind(s.userId).first<{count:number}>();
  const code=clean(b.code,20).toUpperCase()||`${pref?.prefix||"FARM"}-${String(Number(count?.count||0)+1).padStart(2,"0")}`;
  const duplicate=await env.DB!.prepare("SELECT id FROM farms WHERE code=?").bind(code).first();
  if(duplicate)return Response.json({error:"รหัสสวนนี้ถูกใช้แล้ว"},{status:409});
  await env.DB!.batch([
   env.DB!.prepare("INSERT INTO farms (id,owner_id,code,name,address,area_rai,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(farmId,s.userId,code,name,clean(b.address,300)||null,Number(b.areaRai)||null,ts,ts),
   env.DB!.prepare("INSERT INTO farm_members (id,farm_id,user_id,role,plot_scope_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(memberId,farmId,s.userId,"admin",null,"active",ts,ts),
   env.DB!.prepare("INSERT INTO farm_settings (id,farm_id,site_name,mascot_name,owner_name,timezone,date_format,currency,area_unit,weight_unit,volume_unit,default_tank_liters,farm_code_prefix,plot_code_prefix,tree_code_prefix,custom_categories_json,custom_units_json,logo_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(settingsId,farmId,"Durian Smart Farm","น้องทุเรียน",s.name,"Asia/Bangkok","DD/MM/YYYY","THB","ไร่","กก.","ลิตร",200,"FARM","PLOT","DUR","[]","[]",null,ts,ts),
   env.DB!.prepare("INSERT INTO audit_logs (id,farm_id,actor_id,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id("audit"),farmId,s.userId,"create","farm",farmId,JSON.stringify({code,name}),ts)
  ]);
  return Response.json({id:farmId,code,name},{status:201});
 }catch(e){return e instanceof Response?e:Response.json({error:"เพิ่มสวนไม่สำเร็จ"},{status:500})}
}
