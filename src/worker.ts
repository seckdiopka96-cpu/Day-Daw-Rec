import type { D1Database } from "@cloudflare/workers-types";

type Env = {DB:D1Database;ASSETS:{fetch(request:Request):Promise<Response>}};
type Role = "client" | "driver";
type Member = { id:string;room_id:string;role:Role;online:number };
type Room = { id:string;invite:string };
type Ride = { id:string;room_id:string;origin:string;destination:string;category:string;fare:number;status:string;driver_id:string|null;created_at:number;updated_at:number };
type Input = Record<string,unknown>;

const PLACES = ["Dakar-Plateau","Almadies","Ouakam","Yoff","Mermoz","Point E","Médina","Parcelles Assainies","Pikine","Guédiawaye"] as const;
const FARES:Record<string,number>={Standard:2500,Confort:3500,VIP:5000,Groupe:6500};
const AUTH=/^Bearer ([a-f0-9]{64})$/i;
const ABC="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const error=(message:string,status=400)=>json({ok:false,error:message},status);
function makeSecret(){
 const a=new Uint8Array(32);crypto.getRandomValues(a);
 return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
}
function makeInvite(){
 const a=new Uint8Array(12);crypto.getRandomValues(a);
 return Array.from(a,b=>ABC[b%ABC.length]).join("");
}
async function digest(value:string){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
function getDb(env:Env):D1Database|null{return env.DB??null}
async function auth(db:D1Database,request:Request):Promise<Member|null>{
 const match=AUTH.exec(request.headers.get("authorization")||"");
 if(!match)return null;
 return (await db.prepare("SELECT id,room_id,role,online FROM ddr_members WHERE token_hash=?").bind(await digest(match[1].toLowerCase())).first<Member>())??null;
}
async function snapshot(db:D1Database,user:Member){
 const room=await db.prepare("SELECT id,invite FROM ddr_rooms WHERE id=?").bind(user.room_id).first<Room>();
 const members=await db.prepare("SELECT role,online FROM ddr_members WHERE room_id=?").bind(user.room_id).all<{role:Role;online:number}>();
 const rides=await db.prepare("SELECT id,room_id,origin,destination,category,fare,status,driver_id,created_at,updated_at FROM ddr_rides WHERE room_id=? ORDER BY created_at DESC LIMIT 12").bind(user.room_id).all<Ride>();
 return {ok:true,role:user.role,roomCode:room?.invite||"",driverJoined:members.results.some(m=>m.role==="driver"),clientJoined:members.results.some(m=>m.role==="client"),driverOnline:members.results.some(m=>m.role==="driver"&&m.online===1),rides:rides.results,latest:rides.results[0]||null};
}
async function routeGet(request:Request,env:Env){
 const db=getDb(env);if(!db)return error("Base de données indisponible.",503);
 const user=await auth(db,request);if(!user)return error("Session non reconnue.",401);
 return json(await snapshot(db,user));
}
async function routePost(request:Request,env:Env){
 const db=getDb(env);if(!db)return error("Base de données indisponible.",503);
 if(Number(request.headers.get("content-length")||0)>4096)return error("Demande trop volumineuse.",413);
 const raw=await request.text();if(raw.length>4096)return error("Demande trop volumineuse.",413);
 let body:Input;try{body=JSON.parse(raw) as Input}catch{return error("Données invalides.")}
 const action=body?.action;
 if(action==="create"||action==="join"){
  const role:Role|null=body.role==="client"||body.role==="driver"?body.role:null;
  if(!role)return error("Choisis Client ou Chauffeur.");
  const secret=makeSecret(),hash=await digest(secret),now=Date.now(),memberId=crypto.randomUUID();
  if(action==="create"){
   const roomId=crypto.randomUUID(),invite=makeInvite();
   try{
    await db.batch([
     db.prepare("INSERT INTO ddr_rooms(id,invite,created_at) VALUES(?,?,?)").bind(roomId,invite,now),
     db.prepare("INSERT INTO ddr_members(id,room_id,role,token_hash,online,joined_at) VALUES(?,?,?,?,?,?)").bind(memberId,roomId,role,hash,role==="driver"?1:0,now)
    ]);
    return json({ok:true,token:secret,role,roomCode:invite});
   }catch{return error("Création impossible. Réessaie.",503)}
  }
  const code=String(body.code||"").toUpperCase().replace(/[\s-]/g,"");
  if(!/^[A-HJ-NP-Z2-9]{12}$/.test(code))return error("Code d'invitation invalide.");
  const room=await db.prepare("SELECT id FROM ddr_rooms WHERE invite=?").bind(code).first<{id:string}>();
  if(!room)return error("Espace introuvable.",404);
  try{
   await db.prepare("INSERT INTO ddr_members(id,room_id,role,token_hash,online,joined_at) VALUES(?,?,?,?,?,?)").bind(memberId,room.id,role,hash,role==="driver"?1:0,now).run();
   return json({ok:true,token:secret,role,roomCode:code});
  }catch{return error("Ce rôle est déjà occupé dans cet espace.",409)}
 }
 const user=await auth(db,request);if(!user)return error("Reconnecte ton espace.",401);
 const roomId=user.room_id,now=Date.now();
 if(action==="online"){
  if(user.role!=="driver")return error("Action réservée au chauffeur.",403);
  const online=body.online===true?1:0;
  if(!online){
   const active=await db.prepare("SELECT id FROM ddr_rides WHERE room_id=? AND status IN ('pending','accepted','arrived','onboard') LIMIT 1").bind(roomId).first();
   if(active)return error("Termine ou refuse d'abord la course active.",409);
  }
  await db.prepare("UPDATE ddr_members SET online=? WHERE id=?").bind(online,user.id).run();
  return json(await snapshot(db,user));
 }
 if(action==="request"){
  if(user.role!=="client")return error("Action réservée au client.",403);
  const origin=String(body.origin||""),destination=String(body.destination||""),category=String(body.category||"");
  if(!PLACES.includes(origin as typeof PLACES[number])||!PLACES.includes(destination as typeof PLACES[number])||origin===destination||!Object.hasOwn(FARES,category))return error("Sélectionne un trajet valide.");
  const driver=await db.prepare("SELECT id FROM ddr_members WHERE room_id=? AND role='driver' AND online=1").bind(roomId).first();
  if(!driver)return error("Le chauffeur doit rejoindre cet espace et se mettre en ligne.",409);
  try{
   await db.prepare("INSERT INTO ddr_rides(id,room_id,client_id,driver_id,origin,destination,category,fare,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'pending',?,?)")
    .bind(crypto.randomUUID(),roomId,user.id,null,origin,destination,category,FARES[category],now,now).run();
   return json(await snapshot(db,user));
  }catch{return error("Une course est déjà en cours dans cet espace.",409)}
 }
 if(["accept","arrived","start","finish","decline","cancel"].includes(String(action))){
  const rideId=String(body.rideId||"");
  if(!/^[a-f0-9-]{36}$/i.test(rideId))return error("Course invalide.");
  const ride=await db.prepare("SELECT id,room_id,origin,destination,category,fare,status,driver_id,created_at,updated_at FROM ddr_rides WHERE id=? AND room_id=?").bind(rideId,roomId).first<Ride>();
  if(!ride)return error("Course introuvable.",404);
  const rules:Record<string,{role:Role;from:string;to:string}>={
   accept:{role:"driver",from:"pending",to:"accepted"},
   arrived:{role:"driver",from:"accepted",to:"arrived"},
   start:{role:"driver",from:"arrived",to:"onboard"},
   finish:{role:"driver",from:"onboard",to:"finished"},
   decline:{role:"driver",from:"pending",to:"declined"},
   cancel:{role:"client",from:"pending",to:"cancelled"}
  };
  const rule=rules[String(action)];
  if(user.role!==rule.role)return error("Cette action ne t'est pas autorisée.",403);
  if(ride.status!==rule.from)return error("Le statut de cette course a déjà changé.",409);
  if(action==="accept"){
   const online=await db.prepare("SELECT online FROM ddr_members WHERE id=? AND room_id=?").bind(user.id,roomId).first<{online:number}>();
   if(!online?.online)return error("Mets-toi en ligne avant d'accepter.",409);
  }
  const change=await db.prepare("UPDATE ddr_rides SET status=?,driver_id=CASE WHEN ?='accepted' THEN ? ELSE driver_id END,updated_at=? WHERE id=? AND room_id=? AND status=? AND (?='client' OR driver_id=? OR driver_id IS NULL)")
    .bind(rule.to,rule.to,user.id,now,rideId,roomId,rule.from,user.role,user.id).run();
  if(!change.meta.changes)return error("Action déjà prise en compte.",409);
  return json(await snapshot(db,user));
 }
 return error("Action inconnue.",404);
}

export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  try {
   const pathname=new URL(request.url).pathname;
   if(pathname==="/api/health")return json({ok:true,service:"DAY DAW REC",mode:"test"});
   if(pathname==="/api/rides"){
    if(request.method==="GET")return await routeGet(request,env);
    if(request.method==="POST")return await routePost(request,env);
    return error("Méthode non autorisée.",405);
   }
   if(request.method!=="GET"&&request.method!=="HEAD")return error("Méthode non autorisée.",405);
   const response=await env.ASSETS.fetch(request);
   const headers=new Headers(response.headers);
   headers.set("X-Content-Type-Options","nosniff");
   headers.set("Referrer-Policy","strict-origin-when-cross-origin");
   headers.set("Permissions-Policy","camera=(),microphone=(),geolocation=()");
   headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }catch(e){console.error("DAY DAW REC error",e);return error("Erreur serveur.",500)}
 }
};
