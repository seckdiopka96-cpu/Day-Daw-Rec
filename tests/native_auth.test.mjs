// Contract tests run against the actual Cloudflare Worker with in-memory D1
// and Twilio HTTP stubs. They never send real SMS or modify production data.
import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.ts";

class MemoryD1 {
  constructor() {
    this.users = new Map();
    this.drivers = new Map();
    this.sessions = new Map();
    this.pending = new Map();
    this.limits = new Map();
  }
  prepare(sql) {
    const db=this;
    return {
      bind(...params) {
        const q=sql.replace(/\s+/g," ").trim();
        return {
          async first() {
            const [p,n]=params;
            if(q.startsWith("SELECT id,role,full_name FROM users WHERE phone="))
              return db.users.get(p) || null;
            if(q.startsWith("SELECT id,role FROM users WHERE phone=")) {
              const user=db.users.get(p);
              return user ? {id:user.id,role:user.role} : null;
            }
            if(q.startsWith("SELECT count,window_started_at FROM ddr_sms_limits"))
              return db.limits.get(p) || null;
            if(q.startsWith("SELECT * FROM ddr_phone_pending"))
              return db.pending.get(p)?.expires_at > n ? db.pending.get(p) : null;
            if(q.startsWith("SELECT vehicle_type,license_plate FROM drivers"))
              return db.drivers.get(p) || null;
            if(q.startsWith("SELECT approved,is_available,vehicle_type,license_plate FROM drivers"))
              return db.drivers.get(p) || null;
            if(q.startsWith("SELECT full_name FROM users WHERE id="))
              return [...db.users.values()].find(u=>u.id===p) || null;
            if(q.startsWith("SELECT u.id,u.full_name,u.phone,u.role FROM ddr_sessions")) {
              const sess=db.sessions.get(p);
              if(!sess || sess.expires_at<=n) return null;
              return [...db.users.values()].find(u=>u.id===sess.user_id)||null;
            }
            if(q.startsWith("SELECT user_id,vehicle_type,license_plate,approved,is_available,latitude,longitude,location_updated_at FROM drivers"))
              return db.drivers.get(p) || null;
            throw new Error("Unexpected D1 first: "+q);
          },
          async run() {
            if(q.startsWith("INSERT INTO ddr_sms_limits")) {
              const [hash,now,start]=params;
              const old=db.limits.get(hash);
              const item=old && old.window_started_at>start
                ? {count:old.count+1,window_started_at:old.window_started_at}
                : {count:1,window_started_at:now};
              db.limits.set(hash,item);
              return {meta:{changes:1}};
            }
            if(q.startsWith("INSERT INTO ddr_phone_pending")) {
              const [phone,full_name,role,vehicle_type,license_plate,expires_at]=params;
              db.pending.set(phone,{phone,full_name,role,vehicle_type,license_plate,expires_at});
              return {meta:{changes:1}};
            }
            if(q.startsWith("INSERT INTO users(")) {
              const [id,full_name,phone,role]=params;
              db.users.set(phone,{id,full_name,phone,role});
              return {meta:{changes:1}};
            }
            if(q.startsWith("INSERT OR IGNORE INTO drivers(")) {
              const [user_id,vehicle_type,license_plate]=params;
              if(!db.drivers.has(user_id)) db.drivers.set(user_id,{
                user_id,vehicle_type,license_plate,approved:0,is_available:0,
                latitude:null,longitude:null,location_updated_at:null
              });
              return {meta:{changes:1}};
            }
            if(q.startsWith("INSERT INTO ddr_sessions(")) {
              const [token_hash,user_id,expires_at]=params;
              db.sessions.set(token_hash,{user_id,expires_at});
              return {meta:{changes:1}};
            }
            if(q.startsWith("DELETE FROM ddr_phone_pending")) {
              db.pending.delete(params[0]);
              return {meta:{changes:1}};
            }
            if(q.startsWith("DELETE FROM ddr_sessions")) {
              db.sessions.delete(params[0]);
              return {meta:{changes:1}};
            }
            throw new Error("Unexpected D1 run: "+q);
          }
        };
      }
    };
  }
  async batch(statements) { for(const item of statements) await item.run(); }
}

const root="https://day-daw-rec-api.seckdiopka96.workers.dev";
const db=new MemoryD1();
const env={
  DB:db,
  TWILIO_ACCOUNT_SID:"test-account",
  TWILIO_AUTH_TOKEN:"test-secret",
  TWILIO_VERIFY_SERVICE_SID:"test-service",
  ASSETS:{async fetch(){return new Response("asset")}}
};
const oldFetch=globalThis.fetch;
globalThis.fetch=async url=>{
  if(typeof url!=="string" || !url.startsWith("https://verify.twilio.com/"))
    throw new Error("Unexpected network call");
  return Response.json({status:url.includes("VerificationCheck")?"approved":"pending"});
};
test.after(()=>{globalThis.fetch=oldFetch;});

async function request(path,body,token,origin,cookie) {
  const headers={};
  if(body!==undefined)headers["Content-Type"]="application/json";
  if(token!==undefined)headers.Authorization="Bearer "+token;
  if(origin)headers.Origin=origin;
  if(cookie)headers.Cookie=cookie;
  const req=new Request(root+path,{
    method:body===undefined?"GET":"POST",headers,
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const res=await worker.fetch(req,env);
  return {status:res.status,body:await res.json(),cookie:res.headers.get("Set-Cookie")};
}

test("native client SMS signup, bearer restoration, cookie precedence and logout",async()=>{
  const phone="+221771234567";
  let r=await request("/api/auth/start",{
    intent:"signup",role:"client",phone,full_name:"Client Exemple"
  });
  assert.equal(r.status,200);
  assert.equal(r.body.step,"sms_code_sent");

  r=await request("/api/auth/confirm",{native:true,role:"client",phone,code:"123456"});
  assert.equal(r.status,200);
  assert.match(r.body.session_token,/^[a-f0-9]{64}$/);
  assert.equal(r.body.profile.user.full_name,"Client Exemple");
  assert.equal(r.body.profile.user.role,"client");
  assert.match(r.cookie,/HttpOnly/);
  const token=r.body.session_token;

  r=await request("/api/me",undefined,token);
  assert.equal(r.status,200);
  assert.equal(r.body.user.phone,phone);
  const cookie="ddr_session="+token;
  r=await request("/api/me",undefined,"invalid","",cookie);
  assert.equal(r.status,401,"invalid bearer header must not fall back to cookies");
  r=await request("/api/me",undefined,undefined,"",cookie);
  assert.equal(r.status,200,"existing web cookie sessions still work");

  r=await request("/api/auth/logout",{},token);
  assert.equal(r.status,200);
  r=await request("/api/me",undefined,token);
  assert.equal(r.status,401,"revoked token must not log in");
});

test("driver review stays required, native account role cannot be confused",async()=>{
  const phone="+221781234567";
  let r=await request("/api/auth/start",{
    intent:"signup",role:"driver",phone,full_name:"Chauffeur Exemple",
    vehicle_type:"Toyota Corolla",license_plate:"DK 1234 AB"
  });
  assert.equal(r.status,200);
  r=await request("/api/auth/confirm",{native:true,role:"client",phone,code:"123456"});
  assert.equal(r.status,403,"client binary must not authenticate driver role");
  r=await request("/api/auth/confirm",{native:true,role:"driver",phone,code:"123456"});
  assert.equal(r.status,200);
  assert.equal(r.body.profile.driver.approved,false);
  assert.equal(r.body.pending_driver_review,true);
  assert.match(r.body.session_token,/^[a-f0-9]{64}$/);

  r=await request("/api/auth/start",{intent:"login",role:"driver",phone});
  assert.equal(r.status,200,"existing driver should log in without entering registration docs");
  r=await request("/api/auth/confirm",{native:true,role:"driver",phone,code:"123456"});
  assert.equal(r.status,200);
  assert.equal(r.body.profile.user.full_name,"Chauffeur Exemple");
});

test("browser confirmation returns cookie but not native bearer token",async()=>{
  const phone="+221761234567";
  await request("/api/auth/start",{role:"client",phone,full_name:"Compte Web"});
  const r=await request("/api/auth/confirm",{phone,code:"123456"});
  assert.equal(r.status,200);
  assert.equal(r.body.session_token,undefined);
  assert.equal(r.body.profile,undefined);
  assert.match(r.cookie,/HttpOnly/);
});

test("missing Twilio config refuses enrollment, cross-site writes forbidden",async()=>{
  const previous=env.TWILIO_ACCOUNT_SID;
  env.TWILIO_ACCOUNT_SID=undefined;
  let r=await request("/api/auth/start",{
    intent:"signup",role:"client",phone:"+221701234567",full_name:"Essai"
  });
  assert.equal(r.status,503);
  env.TWILIO_ACCOUNT_SID=previous;
  r=await request("/api/auth/start",{
    intent:"signup",role:"client",phone:"+221701234567",full_name:"Essai"
  },undefined,"https://evil.example");
  assert.equal(r.status,403);
});
