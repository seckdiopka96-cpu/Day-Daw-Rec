import * as SecureStore from "expo-secure-store";

// Cloudflare Workers + D1 remains owner-controlled. No Firebase or plaintext
// credentials, and no session token is written into logs or AsyncStorage.
const API_ORIGIN = "https://day-daw-rec-api.seckdiopka96.workers.dev";
const SESSION_KEY = "ddr-chauffeur-session-v1";
export type Role = "client" | "driver";
export type UserProfile = { id:string; full_name:string; phone:string; role:Role };
export type DriverProfile = {
  approved:boolean; is_available:boolean; vehicle_type:string|null;
  license_plate:string|null; has_recent_position?:boolean;
};
export type Profile = { user:UserProfile; driver:DriverProfile|null };
export type Intent = "signup" | "login";
export type StartInput = {
  role:Role; intent:Intent; phone:string; full_name?:string;
  vehicle_type?:string; license_plate?:string;
};
type Reply = {ok:boolean;error?:string;[key:string]:unknown};
type ConfirmReply = Reply & {role?:Role;session_token?:string;profile?:Profile};

export class ApiError extends Error {
  constructor(message:string,public readonly status:number) { super(message); }
}

export function senegalPhone(value:string):string {
  const digits=value.replace(/\D/g,"");
  const local=digits.startsWith("221") ? digits.slice(3) : digits;
  if (!/^7\d{8}$/.test(local)) throw new Error("Entre un numéro sénégalais à 9 chiffres commençant par 7.");
  return "+221"+local;
}

async function api<T extends Reply>(
  path:string, body?:Record<string,unknown>, session?:string,
):Promise<T> {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try {
    const res=await fetch(API_ORIGIN+path,{
      method:body===undefined?"GET":"POST",
      headers:{
        Accept:"application/json",
        ...(body===undefined?{}:{"Content-Type":"application/json"}),
        ...(session?{Authorization:"Bearer "+session}:{})
      },
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
      signal:controller.signal,
    });
    let reply:Reply;
    try { reply=await res.json() as Reply; }
    catch { throw new ApiError("Le serveur a envoyé une réponse invalide.",res.status); }
    if (!res.ok || reply.ok!==true) throw new ApiError(
      typeof reply.error==="string" ? reply.error : "Impossible de terminer cette opération.",res.status
    );
    return reply as T;
  } catch(error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name==="AbortError")
      throw new Error("Connexion trop lente. Vérifie Internet et réessaie.");
    throw new Error("Connexion au serveur impossible. Vérifie Internet.");
  } finally {clearTimeout(timeout);}
}

export async function startCode(data:StartInput):Promise<string> {
  const phone=senegalPhone(data.phone);
  await api("/api/auth/start",{...data,phone});
  return phone;
}

export async function confirmCode(
  phone:string,code:string,role:Role,
):Promise<Profile> {
  if (!/^\d{4,10}$/.test(code)) throw new Error("Saisis le code SMS reçu.");
  const response=await api<ConfirmReply>("/api/auth/confirm",{
    native:true,role,phone:senegalPhone(phone),code,
  });
  if(response.role!==role || !response.session_token ||
    !/^[a-f0-9]{64}$/.test(response.session_token) ||
    !response.profile || response.profile.user.role!==role)
    throw new Error("Session invalide. Recommence la vérification.");
  // Saving is mandatory: never claim the user is signed in if secure storage fails.
  try {
    await SecureStore.setItemAsync(SESSION_KEY,response.session_token);
  } catch {
    // Revoke the just-created session if possible; never leak token.
    try { await api("/api/auth/logout",{},response.session_token); } catch {}
    throw new Error("Stockage sécurisé indisponible sur ce téléphone.");
  }
  return response.profile;
}

export async function restoreProfile(role:Role):Promise<Profile|null> {
  const saved=await SecureStore.getItemAsync(SESSION_KEY);
  if (!saved) return null;
  if(!/^[a-f0-9]{64}$/.test(saved)) {
    await SecureStore.deleteItemAsync(SESSION_KEY); return null;
  }
  try {
    const profile=await api<Reply & Profile>("/api/me",undefined,saved);
    if(profile.user.role!==role) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    return {user:profile.user,driver:profile.driver};
  } catch(error) {
    if(error instanceof ApiError && (error.status===401 || error.status===403)) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    throw error; // Network failures must NOT erase a valid session.
  }
}

export async function logOut():Promise<void> {
  const saved=await SecureStore.getItemAsync(SESSION_KEY);
  if (saved) await api("/api/auth/logout",{},saved);
  // Clear locally only after the server has revoked the session.
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
