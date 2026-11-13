import type { D1Database } from "@cloudflare/workers-types";

type Env = {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_VERIFY_SERVICE_SID?: string;
};
type Role = "client" | "driver";
type User = { id: string; full_name: string; phone: string; role: Role };
type Driver = { user_id: string; vehicle_type: string | null; license_plate: string | null; approved: number; is_available: number; latitude: number | null; longitude: number | null; location_updated_at: number | null };
type Pending = { phone: string; full_name: string; role: Role; vehicle_type: string | null; license_plate: string | null; expires_at: number };
type Ride = { id: string; client_id: string; driver_id: string | null; pickup_address: string; destination_address: string; status: string; price: number; category: string; created_at: string; updated_at: number; pickup_lat: number; pickup_lng: number; destination_lat: number; destination_lng: number };
type Payload = Record<string, unknown>;

const BASE = "https://verify.twilio.com/v2/Services/";
const ACTIVE = ["pending", "accepted", "arrived", "onboard"];
const CATEGORIES: Record<string, number> = { Standard: 300, Confort: 450, VIP: 650, Groupe: 800 };
const json = (body: unknown, status = 200, extra?: HeadersInit) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
const failure = (error: string, status = 400) => json({ ok: false, error }, status);
const normalizePhone = (v: unknown) => typeof v === "string" ? v.replace(/[\s().-]/g, "") : "";
const validPhone = (v: string) => /^\+2217\d{8}$/.test(v);
const validCoords = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 14.45 && lat <= 15.25 && lng >= -17.65 && lng <= -16.7;
const clean = (v: unknown, limit: number) => typeof v === "string" ? v.trim().slice(0, limit + 1) : "";
const distanceKm = (a: number, b: number, c: number, d: number) => {
  const rad = Math.PI / 180, dl = (c - a) * rad, dg = (d - b) * rad;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dg / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};
function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function cookieValue(request: Request) {
  return /(?:^|;\s*)ddr_session=([a-f0-9]{64})(?:;|$)/i.exec(request.headers.get("Cookie") || "")?.[1] || "";
}
async function loggedIn(request: Request, db: D1Database): Promise<User | null> {
  const session = cookieValue(request);
  if (!session) return null;
  const hash = await digest(session);
  return await db.prepare("SELECT u.id,u.full_name,u.phone,u.role FROM ddr_sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?")
    .bind(hash, Date.now()).first<User>();
}
async function bodyJson(request: Request): Promise<Payload | null> {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return null;
  if (Number(request.headers.get("content-length") || 0) > 4096) return null;
  const text = await request.text();
  if (text.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Payload : null;
  } catch { return null; }
}
async function sms(env: Env, endpoint: string, params: Record<string, string>): Promise<{ status?: string } | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) return null;
  const url = BASE + encodeURIComponent(env.TWILIO_VERIFY_SERVICE_SID) + "/" + endpoint;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(env.TWILIO_ACCOUNT_SID + ":" + env.TWILIO_AUTH_TOKEN),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params).toString()
  });
  if (!response.ok) return null;
  return await response.json() as { status?: string };
}
async function throttle(db: D1Database, key: string, maximum: number): Promise<boolean> {
  const hashed = await digest(key), start = Date.now() - 3600000;
  const old = await db.prepare("SELECT count,window_started_at FROM ddr_sms_limits WHERE key_hash=?").bind(hashed).first<{count:number;window_started_at:number}>();
  if (old && old.window_started_at > start && old.count >= maximum) return false;
  const now = Date.now();
  await db.prepare("INSERT INTO ddr_sms_limits(key_hash,count,window_started_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=CASE WHEN window_started_at<? THEN 1 ELSE count+1 END,window_started_at=CASE WHEN window_started_at<? THEN ? ELSE window_started_at END")
    .bind(hashed, now, start, start, now).run();
  return true;
}
async function startRegistration(request: Request, env: Env, data: Payload) {
  if (!env.TWILIO_VERIFY_SERVICE_SID || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN)
    return failure("L'envoi de SMS n'est pas encore activé par l'administrateur.", 503);
  const phone = normalizePhone(data.phone), fullName = clean(data.full_name, 80);
  const role = data.role === "client" || data.role === "driver" ? data.role : null;
  const vehicle = role === "driver" ? clean(data.vehicle_type, 40) : "";
  const plate = role === "driver" ? clean(data.license_plate, 30).toUpperCase() : "";
  if (!role || !validPhone(phone) || fullName.length < 2 || fullName.length > 80 ||
    (role === "driver" && (vehicle.length < 3 || plate.length < 3 || plate.length > 30)))
    return failure("Vérifie ton nom, ton numéro sénégalais et les informations du véhicule.");
  const existing = await env.DB.prepare("SELECT role FROM users WHERE phone=?").bind(phone).first<{role:Role}>();
  if (existing && existing.role !== role) return failure("Ce numéro est déjà utilisé pour un autre type de compte.", 409);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!await throttle(env.DB, "phone:" + phone, 4) || !await throttle(env.DB, "ip:" + ip, 25))
    return failure("Trop de demandes. Réessaie plus tard.", 429);
  const now = Date.now();
  await env.DB.prepare("INSERT INTO ddr_phone_pending(phone,full_name,role,vehicle_type,license_plate,expires_at) VALUES(?,?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET full_name=excluded.full_name,role=excluded.role,vehicle_type=excluded.vehicle_type,license_plate=excluded.license_plate,expires_at=excluded.expires_at")
    .bind(phone, fullName, role, vehicle || null, plate || null, now + 600000).run();
  const verification = await sms(env, "Verifications", { To: phone, Channel: "sms" });
  if (!verification || verification.status !== "pending")
    return failure("Le SMS n'a pas pu être envoyé. Vérifie le service SMS.", 502);
  return json({ ok: true, step: "sms_code_sent" });
}
async function confirmRegistration(env: Env, data: Payload) {
  const phone = normalizePhone(data.phone), code = clean(data.code, 12);
  if (!validPhone(phone) || !/^\d{4,10}$/.test(code)) return failure("Code ou numéro invalide.");
  const pending = await env.DB.prepare("SELECT * FROM ddr_phone_pending WHERE phone=? AND expires_at>?")
    .bind(phone, Date.now()).first<Pending>();
  if (!pending) return failure("Demande expirée. Recommence l'inscription.", 410);
  const result = await sms(env, "VerificationCheck", { To: phone, Code: code });
  if (!result || result.status !== "approved") return failure("Le code SMS est incorrect ou a expiré.", 401);
  const userId = crypto.randomUUID(), raw = token(), hash = await digest(raw);
  const old = await env.DB.prepare("SELECT id,role FROM users WHERE phone=?").bind(phone).first<{id:string;role:Role}>();
  if (old && old.role !== pending.role) return failure("Type de compte incompatible.", 409);
  const id = old?.id || userId;
  const queries = [];
  if (!old) queries.push(env.DB.prepare("INSERT INTO users(id,full_name,phone,role) VALUES(?,?,?,?)").bind(id,pending.full_name,phone,pending.role));
  if (pending.role === "driver") queries.push(env.DB.prepare("INSERT OR IGNORE INTO drivers(user_id,vehicle_type,license_plate,is_available,approved) VALUES(?,?,?,0,0)")
    .bind(id,pending.vehicle_type,pending.license_plate));
  queries.push(env.DB.prepare("INSERT INTO ddr_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(hash,id,Date.now()+2592000000));
  queries.push(env.DB.prepare("DELETE FROM ddr_phone_pending WHERE phone=?").bind(phone));
  await env.DB.batch(queries);
  return json({ ok:true, role:pending.role, pending_driver_review:pending.role==="driver" },
    200, { "Set-Cookie":"ddr_session="+raw+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000" });
}
async function me(request: Request, env: Env) {
  const user = await loggedIn(request, env.DB);
  if (!user) return failure("Session expirée.", 401);
  const driver = user.role === "driver"
    ? await env.DB.prepare("SELECT user_id,vehicle_type,license_plate,approved,is_available,latitude,longitude,location_updated_at FROM drivers WHERE user_id=?").bind(user.id).first<Driver>()
    : null;
  return json({ok:true,user:{id:user.id,full_name:user.full_name,phone:user.phone,role:user.role},driver:driver?{
    approved:driver.approved===1,is_available:driver.is_available===1,vehicle_type:driver.vehicle_type,
    license_plate:driver.license_plate,has_recent_position:!!driver.location_updated_at&&driver.location_updated_at>Date.now()-90000
  }:null});
}
async function driverPosition(request: Request, env: Env, data: Payload) {
  const user = await loggedIn(request,env.DB);
  if (!user || user.role !== "driver") return failure("Accès chauffeur requis.",401);
  const lat = Number(data.lat), lng = Number(data.lng);
  if (!validCoords(lat,lng)) return failure("La position doit être située dans la zone de Dakar.");
  const result = await env.DB.prepare("UPDATE drivers SET latitude=?,longitude=?,location_updated_at=? WHERE user_id=? AND approved=1")
    .bind(lat,lng,Date.now(),user.id).run();
  if (!result.meta.changes) return failure("Le chauffeur doit être validé avant d'activer le GPS.",403);
  return json({ok:true,position_updated:true});
}
async function driverAvailability(request: Request, env: Env, data: Payload) {
  const user = await loggedIn(request,env.DB);
  if (!user || user.role !== "driver") return failure("Accès chauffeur requis.",401);
  if (typeof data.online !== "boolean") return failure("Statut invalide.");
  if (data.online) {
    const result = await env.DB.prepare("UPDATE drivers SET is_available=1 WHERE user_id=? AND approved=1 AND location_updated_at>?")
      .bind(user.id,Date.now()-90000).run();
    if (!result.meta.changes) return failure("Validation du chauffeur et position GPS récente nécessaires.",403);
  } else {
    const active = await env.DB.prepare("SELECT id FROM rides WHERE driver_id=? AND status IN ('pending','accepted','arrived','onboard') LIMIT 1").bind(user.id).first();
    if (active) return failure("Termine ou refuse la course en cours avant de passer hors ligne.",409);
    await env.DB.prepare("UPDATE drivers SET is_available=0 WHERE user_id=?").bind(user.id).run();
  }
  return json({ok:true,is_available:data.online});
}
async function listRides(request: Request,env:Env) {
  const user = await loggedIn(request,env.DB);
  if (!user) return failure("Session expirée.",401);
  const key = user.role==="client"?"client_id":"driver_id";
  const rows = await env.DB.prepare("SELECT id,client_id,driver_id,pickup_address,destination_address,status,price,category,created_at,updated_at,pickup_lat,pickup_lng,destination_lat,destination_lng FROM rides WHERE "+key+"=? ORDER BY created_at DESC LIMIT 30")
    .bind(user.id).all<Ride>();
  return json({ok:true,rides:rows.results});
}
async function requestRide(request: Request,env:Env,data:Payload) {
  const user = await loggedIn(request,env.DB);
  if (!user || user.role!=="client") return failure("Compte client requis.",401);
  const start = clean(data.pickup_address,150), end = clean(data.destination_address,150);
  const a = Number(data.pickup_lat), b=Number(data.pickup_lng), c=Number(data.destination_lat),d=Number(data.destination_lng);
  const category = clean(data.category,30);
  if (start.length<3||end.length<3||!validCoords(a,b)||!validCoords(c,d)||!Object.hasOwn(CATEGORIES,category))return failure("Vérifie le départ, la destination et la catégorie.");
  const km=distanceKm(a,b,c,d);
  if (km<0.2||km>55)return failure("Ce trajet est hors de la zone actuellement couverte.");
  const existing=await env.DB.prepare("SELECT id FROM rides WHERE client_id=? AND status IN ('pending','accepted','arrived','onboard') LIMIT 1").bind(user.id).first();
  if (existing)return failure("Tu as déjà une course active.",409);
  const rows=await env.DB.prepare("SELECT user_id,latitude,longitude FROM drivers WHERE approved=1 AND is_available=1 AND location_updated_at>? AND latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 200")
    .bind(Date.now()-90000).all<{user_id:string;latitude:number;longitude:number}>();
  const nearest=rows.results.map(driver=>({...driver,km:distanceKm(a,b,driver.latitude,driver.longitude)}))
    .filter(driver=>driver.km<=8).sort((x,y)=>x.km-y.km);
  if (!nearest.length)return failure("Aucun chauffeur disponible à proximité pour le moment.",409);
  const price=Math.ceil((1000+km*CATEGORIES[category])/100)*100;
  for(const driver of nearest){
    try{
      const id=crypto.randomUUID(),now=Date.now();
      await env.DB.prepare("INSERT INTO rides(id,client_id,driver_id,pickup_address,destination_address,status,price,category,created_at,updated_at,pickup_lat,pickup_lng,destination_lat,destination_lng) VALUES(?,?,?,?,?,'pending',?,?,CURRENT_TIMESTAMP,?,?,?,?,?)")
        .bind(id,user.id,driver.user_id,start,end,price,category,now,a,b,c,d).run();
      return json({ok:true,ride_id:id,price_estimate:price,disclaimer:"Tarif indicatif, non contractuel."},201);
    }catch{
      const other=await env.DB.prepare("SELECT id FROM rides WHERE client_id=? AND status IN ('pending','accepted','arrived','onboard') LIMIT 1").bind(user.id).first();
      if(other)return failure("Tu as déjà une course active.",409);
    }
  }
  return failure("Les chauffeurs disponibles viennent d'être réservés. Réessaie.",409);
}
async function changeRide(request:Request,env:Env,id:string,action:string) {
  const user=await loggedIn(request,env.DB);
  if(!user)return failure("Session expirée.",401);
  const rules:Record<string,{role:Role;from:string;to:string}>={
    accept:{role:"driver",from:"pending",to:"accepted"},
    arrived:{role:"driver",from:"accepted",to:"arrived"},
    start:{role:"driver",from:"arrived",to:"onboard"},
    finish:{role:"driver",from:"onboard",to:"finished"},
    decline:{role:"driver",from:"pending",to:"declined"},
    cancel:{role:"client",from:"pending",to:"cancelled"}
  };
  const rule=rules[action];
  if(!rule)return failure("Action inconnue.",404);
  if(user.role!==rule.role)return failure("Action non autorisée.",403);
  const key=user.role==="client"?"client_id":"driver_id";
  if(user.role==="driver"){
    const driver=await env.DB.prepare("SELECT approved,is_available FROM drivers WHERE user_id=?").bind(user.id).first<{approved:number;is_available:number}>();
    if(!driver?.approved||!driver.is_available)return failure("Chauffeur non autorisé ou hors ligne.",403);
  }
  const result=await env.DB.prepare("UPDATE rides SET status=?,updated_at=? WHERE id=? AND "+key+"=? AND status=?")
    .bind(rule.to,Date.now(),id,user.id,rule.from).run();
  if(!result.meta.changes)return failure("Cette course n'est plus dans l'état attendu.",409);
  return json({ok:true,status:rule.to});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      if (pathname === "/api/health" && request.method === "GET")
        return json({ok:true,service:"DAY DAW REC",mode:"prelaunch"});
      if (pathname.startsWith("/api/")) {
        if (!env.DB) return failure("D1 non connecté.",503);
        if (request.method === "POST") {
          const origin=request.headers.get("Origin");
          if (origin && origin!==url.origin) return failure("Origine non autorisée.",403);
          const data=await bodyJson(request);
          if(!data)return failure("Corps JSON invalide ou absent.");
          if(pathname==="/api/auth/start")return await startRegistration(request,env,data);
          if(pathname==="/api/auth/confirm")return await confirmRegistration(env,data);
          if(pathname==="/api/auth/logout"){
            const raw=cookieValue(request);
            if(raw)await env.DB.prepare("DELETE FROM ddr_sessions WHERE token_hash=?").bind(await digest(raw)).run();
            return json({ok:true},200,{"Set-Cookie":"ddr_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
          }
          if(pathname==="/api/driver/location")return await driverPosition(request,env,data);
          if(pathname==="/api/driver/availability")return await driverAvailability(request,env,data);
          if(pathname==="/api/rides")return await requestRide(request,env,data);
          const match=/^\/api\/rides\/([a-f0-9-]{36})\/(accept|arrived|start|finish|decline|cancel)$/i.exec(pathname);
          if(match)return await changeRide(request,env,match[1],match[2]);
        }
        if (request.method==="GET" && pathname==="/api/me")return await me(request,env);
        if (request.method==="GET" && pathname==="/api/rides")return await listRides(request,env);
        return failure("Route introuvable.",404);
      }
      if(request.method!=="GET" && request.method!=="HEAD")return failure("Méthode non autorisée.",405);
      const response=await env.ASSETS.fetch(request);
      const headers=new Headers(response.headers);
      headers.set("X-Content-Type-Options","nosniff");
      headers.set("Referrer-Policy","strict-origin-when-cross-origin");
      headers.set("Permissions-Policy","camera=(),microphone=(),geolocation=(self)");
      headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    } catch (error) {
      console.error("DAY DAW REC server error",error);
      return failure("Erreur serveur. Réessaie.",500);
    }
  }
};
