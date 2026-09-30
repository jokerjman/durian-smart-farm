const enc=new TextEncoder();
// Cloudflare Workers supports PBKDF2 iteration counts up to 100,000.
const ITERATIONS=100000;
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const fromB64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function derive(password:string,salt:Uint8Array,iterations:number){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:salt.buffer as ArrayBuffer,iterations},key,256))}
export async function makePassword(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));return {hash:b64(await derive(password,salt,ITERATIONS)),salt:b64(salt),iterations:ITERATIONS}}
export async function verifyPassword(password:string,hash:string,salt:string,iterations:number){const actual=await derive(password,fromB64(salt),iterations),expected=fromB64(hash);if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];return diff===0}
export async function hashToken(value:string){return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value))))}
export function randomToken(bytes=32){return b64(crypto.getRandomValues(new Uint8Array(bytes))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
export function validPassword(value:string){return value.length>=10&&/[A-Za-z]/.test(value)&&/\d/.test(value)}
