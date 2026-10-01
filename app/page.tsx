"use client";
import {useEffect,useState} from "react";
import {AlertTriangle,Check,Eye,EyeOff,KeyRound,Leaf,ShieldCheck} from "lucide-react";
import LiveApp from "./live-app";

type AppSession={userId:string;username:string;name:string;farmId:string;role:string;permissions:string[];mustChangePassword:boolean};

function AuthFrame({children}:{children:React.ReactNode}){return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><i><Leaf/></i><span><b>น้องทุเรียน</b><small>Durian Smart Farm</small></span></div>{children}<footer><ShieldCheck/> ข้อมูลได้รับการป้องกันด้วยบัญชีภายในสวน</footer></section></main>}

function LoginScreen({done}:{done:(session:AppSession)=>void}){
 const [username,setUsername]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password})}),data=await r.json();if(!r.ok)throw new Error(data.error||"เข้าสู่ระบบไม่สำเร็จ");const status=await fetch("/api/auth/status",{cache:"no-store"}).then(x=>x.json());done(status.session)}catch(e){setError((e as Error).message);setBusy(false)}};
 return <AuthFrame><small className="auth-kicker">เข้าสู่ระบบ</small><h1>จัดการสวนของคุณ</h1><p className="auth-copy">ใช้ชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลระบบสร้างให้</p><form className="auth-form" onSubmit={submit}><label>ชื่อผู้ใช้<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="ชื่อผู้ใช้"/></label><label>รหัสผ่าน<div className="password-field"><input type={show?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="รหัสผ่าน"/><button type="button" onClick={()=>setShow(!show)} aria-label="แสดงหรือซ่อนรหัสผ่าน">{show?<EyeOff/>:<Eye/>}</button></div></label>{error&&<p className="auth-error"><AlertTriangle/>{error}</p>}<button className="primary auth-submit" disabled={busy||!username||!password}><KeyRound/>{busy?"กำลังตรวจสอบ...":"เข้าสู่ระบบ"}</button></form><p className="auth-help">ลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</p></AuthFrame>
}

function SetupScreen({done}:{done:(session:AppSession)=>void}){
 const [username,setUsername]=useState("admin"),[name,setName]=useState("ผู้ดูแลระบบ"),[farmName,setFarmName]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[recovery,setRecovery]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!farmName.trim()){setError("กรุณาระบุชื่อสวนจริง");return}if(password!==confirm){setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");return}setBusy(true);setError("");try{const r=await fetch("/api/auth/setup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password,name,farmName})}),data=await r.json();if(!r.ok)throw new Error(data.error||"ตั้งค่าไม่สำเร็จ");setRecovery(data.recoveryCode)}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const finish=async()=>{const data=await fetch("/api/auth/status",{cache:"no-store"}).then(r=>r.json());done(data.session)};
 if(recovery)return <AuthFrame><small className="auth-kicker">ตั้งค่าสำเร็จ</small><h1>บันทึก Recovery Code</h1><p className="auth-copy">ใช้กู้บัญชี Admin หากลืมรหัสผ่าน รหัสนี้จะแสดงเพียงครั้งเดียว</p><div className="recovery-code">{recovery}</div><button className="primary auth-submit" onClick={finish}><Check/> ฉันบันทึกรหัสแล้ว</button></AuthFrame>;
 return <AuthFrame><small className="auth-kicker">ตั้งค่าครั้งแรก</small><h1>สร้างบัญชีผู้ดูแลระบบ</h1><p className="auth-copy">บัญชีนี้จัดการผู้ใช้ สิทธิ์ และข้อมูลหลังบ้านได้ทั้งหมด</p><form className="auth-form" onSubmit={submit}><div className="formrow"><label>ชื่อผู้ใช้<input value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label><label>ชื่อที่แสดง<input value={name} onChange={e=>setName(e.target.value)}/></label></div><label>ชื่อสวนจริง<input required value={farmName} onChange={e=>setFarmName(e.target.value)} placeholder="กรอกชื่อสวนของคุณ"/></label><label>รหัสผ่าน<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="อย่างน้อย 10 ตัว มีตัวอักษรและตัวเลข"/></label><label>ยืนยันรหัสผ่าน<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p className="auth-error"><AlertTriangle/>{error}</p>}<button className="primary auth-submit" disabled={busy||!username||!farmName.trim()||!password||!confirm}><ShieldCheck/>{busy?"กำลังสร้างระบบ...":"สร้างบัญชี Admin"}</button></form></AuthFrame>
}

export default function App(){
 const [session,setSession]=useState<AppSession|null>(null),[authReady,setAuthReady]=useState(false),[setupRequired,setSetupRequired]=useState(false),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/auth/status",{cache:"no-store"}).then(r=>r.json()).then(data=>{setSetupRequired(!!data.setupRequired);setSession(data.session||null)}).catch(()=>setError("ไม่สามารถเชื่อมระบบผู้ใช้ได้")).finally(()=>setAuthReady(true))},[]);
 if(!authReady)return <div className="auth-loading"><Leaf/><b>กำลังเปิด Durian Smart Farm</b></div>;
 if(error)return <AuthFrame><p className="auth-error"><AlertTriangle/>{error}</p></AuthFrame>;
 if(setupRequired)return <SetupScreen done={value=>{setSession(value);setSetupRequired(false)}}/>;
 if(!session)return <LoginScreen done={setSession}/>;
 return <LiveApp session={session}/>;
}
