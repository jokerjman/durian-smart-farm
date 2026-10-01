import {env} from "cloudflare:workers";
import {requireSession} from "@/lib/authz";

type FarmRow={id:string;name:string;address:string|null;areaRai:number|null;plotCount:number;treeCount:number};
type TaskRow={id:string;title:string;status:string;scheduledAt:number|null};

export async function GET(){
 try{
  const s=await requireSession();
  const farmRows=await env.DB!.prepare(`
   SELECT f.id,f.name,f.address,f.area_rai AS areaRai,
    COUNT(DISTINCT p.id) AS plotCount,COUNT(DISTINCT t.id) AS treeCount
   FROM farms f
   JOIN farm_members fm ON fm.farm_id=f.id AND fm.user_id=? AND fm.status='active'
   LEFT JOIN plots p ON p.farm_id=f.id
   LEFT JOIN trees t ON t.plot_id=p.id
   GROUP BY f.id,f.name,f.address,f.area_rai
   ORDER BY f.created_at ASC
  `).bind(s.userId).all<FarmRow>();
  const farms=(farmRows.results||[]).map(x=>({...x,plotCount:Number(x.plotCount||0),treeCount:Number(x.treeCount||0)}));
  const selected=farms.find(x=>x.id===s.farmId)||farms[0];
  if(!selected)return Response.json({farms:[],summary:{treeCount:0,openTaskCount:0,income:0,expense:0,productCount:0},season:null,tasks:[]});
  const farmId=selected.id;
  const season=await env.DB!.prepare("SELECT id,name,start_date AS startDate,end_date AS endDate,status,target_kg AS targetKg,budget FROM seasons WHERE farm_id=? AND status IN ('active','current','in_progress') ORDER BY start_date DESC LIMIT 1").bind(farmId).first();
  const taskCount=await env.DB!.prepare("SELECT COUNT(*) AS count FROM work_items WHERE farm_id=? AND status NOT IN ('done','cancelled')").bind(farmId).first<{count:number}>();
  const tasks=await env.DB!.prepare("SELECT id,title,status,scheduled_at AS scheduledAt FROM work_items WHERE farm_id=? AND status NOT IN ('done','cancelled') ORDER BY scheduled_at ASC LIMIT 5").bind(farmId).all<TaskRow>();
  const month=new Date().toISOString().slice(0,7);
  const money=await env.DB!.prepare("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense FROM transactions WHERE farm_id=? AND substr(occurred_on,1,7)=?").bind(farmId,month).first<{income:number;expense:number}>();
  const productCount=await env.DB!.prepare("SELECT COUNT(*) AS count FROM products WHERE farm_id=? AND active=1").bind(farmId).first<{count:number}>();
  const branding=await env.DB!.prepare("SELECT site_name AS siteName,mascot_name AS mascotName FROM farm_settings WHERE farm_id=? LIMIT 1").bind(farmId).first<{siteName:string;mascotName:string}>();
  return Response.json({farms,selectedFarmId:farmId,branding:branding||{siteName:"Durian Smart Farm",mascotName:"น้องทุเรียน"},season,summary:{treeCount:selected.treeCount,openTaskCount:Number(taskCount?.count||0),income:Number(money?.income||0),expense:Number(money?.expense||0),productCount:Number(productCount?.count||0)},tasks:tasks.results||[]});
 }catch(e){return e instanceof Response?e:Response.json({error:"โหลดข้อมูลภาพรวมไม่สำเร็จ"},{status:500})}
}
