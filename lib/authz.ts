import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export type Session = { userId:string; email:string; name:string; farmId:string; role:string };
const now=()=>Math.floor(Date.now()/1000);
const id=(prefix:string)=>`${prefix}_${crypto.randomUUID()}`;

export async function requireSession():Promise<Session>{
  const auth=await getChatGPTUser();
  if(!auth) throw new Response("กรุณาเข้าสู่ระบบ",{status:401});
  if(!env.DB) throw new Response("ฐานข้อมูลยังไม่พร้อม",{status:503});
  const db=env.DB, ts=now();
  await db.prepare("INSERT INTO users (id,name,email,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,updated_at=excluded.updated_at").bind(auth.userId,auth.displayName,auth.email,ts,ts).run();
  let member=await db.prepare("SELECT fm.farm_id AS farmId,fm.role AS role FROM farm_members fm WHERE fm.user_id=? AND fm.status='active' LIMIT 1").bind(auth.userId).first<{farmId:string;role:string}>();
  if(!member){
    const farmId=id("farm"),memberId=id("member");
    await db.batch([
      db.prepare("INSERT INTO farms (id,owner_id,name,address,area_rai,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(farmId,auth.userId,"สวนศรีจันทร์","จันทบุรี",24,ts,ts),
      db.prepare("INSERT INTO farm_members (id,farm_id,user_id,role,plot_scope_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(memberId,farmId,auth.userId,"owner",null,"active",ts,ts),
    ]); member={farmId,role:"owner"};
  }
  return {userId:auth.userId,email:auth.email,name:auth.displayName,farmId:member.farmId,role:member.role};
}
export function permit(session:Session,roles:string[]){if(!roles.includes(session.role))throw new Response("ไม่มีสิทธิ์ดำเนินการ",{status:403})}
export async function audit(s:Session,action:string,entityType:string,entityId:string,detail:unknown){if(!env.DB)return;await env.DB.prepare("INSERT INTO audit_logs (id,farm_id,actor_id,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id("audit"),s.farmId,s.userId,action,entityType,entityId,JSON.stringify(detail),now()).run()}
export {id,now};
