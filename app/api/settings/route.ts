import {env} from "cloudflare:workers";
import {assertSameOrigin,audit,id,now,permitPermission,requireSession} from "@/lib/authz";

const defaults={siteName:"Durian Smart Farm",mascotName:"น้องทุเรียน",ownerName:"",timezone:"Asia/Bangkok",dateFormat:"DD/MM/YYYY",currency:"THB",areaUnit:"ไร่",weightUnit:"กก.",volumeUnit:"ลิตร",defaultTankLiters:200,farmCodePrefix:"FARM",plotCodePrefix:"PLOT",treeCodePrefix:"DUR",customCategories:[] as string[],customUnits:[] as string[]};
const clean=(value:unknown,max=120)=>String(value??"").trim().slice(0,max);
const list=(value:unknown)=>Array.isArray(value)?[...new Set(value.map(x=>clean(x,50)).filter(Boolean))].slice(0,30):[];

export async function GET(){
 try{
  const s=await requireSession();permitPermission(s,"farms.manage");
  const farm=await env.DB!.prepare("SELECT id,name,address,area_rai AS areaRai FROM farms WHERE id=? LIMIT 1").bind(s.farmId).first();
  if(!farm)return Response.json({error:"ไม่พบข้อมูลสวน"},{status:404});
  const row=await env.DB!.prepare("SELECT site_name AS siteName,mascot_name AS mascotName,owner_name AS ownerName,timezone,date_format AS dateFormat,currency,area_unit AS areaUnit,weight_unit AS weightUnit,volume_unit AS volumeUnit,default_tank_liters AS defaultTankLiters,farm_code_prefix AS farmCodePrefix,plot_code_prefix AS plotCodePrefix,tree_code_prefix AS treeCodePrefix,custom_categories_json AS customCategoriesJson,custom_units_json AS customUnitsJson,logo_key AS logoKey FROM farm_settings WHERE farm_id=? LIMIT 1").bind(s.farmId).first<Record<string,unknown>>();
  const settings=row?{...defaults,...row,customCategories:JSON.parse(String(row.customCategoriesJson||"[]")),customUnits:JSON.parse(String(row.customUnitsJson||"[]"))}:defaults;
  return Response.json({farm,settings});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดการตั้งค่าไม่สำเร็จ"},{status:500})}
}

export async function PATCH(req:Request){
 try{
  assertSameOrigin(req);const s=await requireSession();permitPermission(s,"farms.manage");
  const b=await req.json() as Record<string,unknown>;
  const farmName=clean(b.farmName,100),siteName=clean(b.siteName,100),mascotName=clean(b.mascotName,60);
  if(!farmName||!siteName||!mascotName)return Response.json({error:"กรุณาระบุชื่อสวน ชื่อเว็บไซต์ และชื่อมาสคอต"},{status:400});
  const tank=Math.min(5000,Math.max(1,Number(b.defaultTankLiters)||200));
  const area=Number(b.areaRai);const ts=now();
  const settings={siteName,mascotName,ownerName:clean(b.ownerName,100),timezone:clean(b.timezone,60)||"Asia/Bangkok",dateFormat:clean(b.dateFormat,20)||"DD/MM/YYYY",currency:clean(b.currency,8)||"THB",areaUnit:clean(b.areaUnit,20)||"ไร่",weightUnit:clean(b.weightUnit,20)||"กก.",volumeUnit:clean(b.volumeUnit,20)||"ลิตร",farmCodePrefix:clean(b.farmCodePrefix,12).toUpperCase()||"FARM",plotCodePrefix:clean(b.plotCodePrefix,12).toUpperCase()||"PLOT",treeCodePrefix:clean(b.treeCodePrefix,12).toUpperCase()||"DUR",customCategories:list(b.customCategories),customUnits:list(b.customUnits)};
  const settingsId=id("farm_settings");
  await env.DB!.batch([
   env.DB!.prepare("UPDATE farms SET name=?,address=?,area_rai=?,updated_at=? WHERE id=?").bind(farmName,clean(b.address,300)||null,Number.isFinite(area)&&area>0?area:null,ts,s.farmId),
   env.DB!.prepare(`INSERT INTO farm_settings (id,farm_id,site_name,mascot_name,owner_name,timezone,date_format,currency,area_unit,weight_unit,volume_unit,default_tank_liters,farm_code_prefix,plot_code_prefix,tree_code_prefix,custom_categories_json,custom_units_json,logo_key,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(farm_id) DO UPDATE SET site_name=excluded.site_name,mascot_name=excluded.mascot_name,owner_name=excluded.owner_name,timezone=excluded.timezone,date_format=excluded.date_format,currency=excluded.currency,area_unit=excluded.area_unit,weight_unit=excluded.weight_unit,volume_unit=excluded.volume_unit,default_tank_liters=excluded.default_tank_liters,farm_code_prefix=excluded.farm_code_prefix,plot_code_prefix=excluded.plot_code_prefix,tree_code_prefix=excluded.tree_code_prefix,custom_categories_json=excluded.custom_categories_json,custom_units_json=excluded.custom_units_json,updated_at=excluded.updated_at`).bind(settingsId,s.farmId,settings.siteName,settings.mascotName,settings.ownerName||null,settings.timezone,settings.dateFormat,settings.currency,settings.areaUnit,settings.weightUnit,settings.volumeUnit,tank,settings.farmCodePrefix,settings.plotCodePrefix,settings.treeCodePrefix,JSON.stringify(settings.customCategories),JSON.stringify(settings.customUnits),null,ts,ts)
  ]);
  await audit(s,"update","farm_settings",s.farmId,{farmName,siteName:settings.siteName,timezone:settings.timezone,units:{area:settings.areaUnit,weight:settings.weightUnit,volume:settings.volumeUnit},defaultTankLiters:tank});
  return Response.json({saved:true});
 }catch(e){return e instanceof Response?e:Response.json({error:"บันทึกการตั้งค่าไม่สำเร็จ"},{status:500})}
}
