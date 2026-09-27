import {requireSession} from "@/lib/authz";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(await requireSession())}catch(e){return e instanceof Response?e:Response.json({error:"ไม่สามารถเปิดข้อมูลผู้ใช้ได้"},{status:500})}}
