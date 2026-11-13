import { useCallback, useEffect, useRef, useState } from "react";

type Role = "client" | "driver";
type User = { id:string; full_name:string; phone:string; role:Role };
type Driver = { approved:boolean; is_available:boolean; vehicle_type:string|null; license_plate:string|null; has_recent_position:boolean };
type Profile = { ok:true; user:User; driver:Driver|null };
type Ride = { id:string; client_id:string; driver_id:string|null; pickup_address:string; destination_address:string; status:string; price:number; category:string; created_at:string };
type Place = { name:string; lat:number; lng:number };
const DESTINATIONS:Place[] = [
  {name:"Dakar Plateau",lat:14.6694,lng:-17.4317},
  {name:"Almadies",lat:14.7380,lng:-17.5170},
  {name:"Ouakam",lat:14.7246,lng:-17.4905},
  {name:"Yoff",lat:14.7578,lng:-17.4753},
  {name:"Mermoz",lat:14.7022,lng:-17.4641},
  {name:"Médina",lat:14.6886,lng:-17.4472},
  {name:"Parcelles Assainies",lat:14.7522,lng:-17.4486},
  {name:"Pikine",lat:14.7521,lng:-17.3935},
  {name:"Guédiawaye",lat:14.7716,lng:-17.4020},
  {name:"Rufisque",lat:14.7138,lng:-17.2733}
];
const CATEGORIES = ["Standard","Confort","VIP","Groupe"];
const STATUS:Record<string,string> = {
  pending:"Proposition envoyée au chauffeur",
  accepted:"Chauffeur en route",
  arrived:"Chauffeur arrivé au départ",
  onboard:"Trajet en cours",
  finished:"Course terminée",
  declined:"Proposition refusée",
  cancelled:"Course annulée"
};
async function call<T>(url:string, data?:Record<string,unknown>):Promise<T>{
  const response=await fetch(url,{
    method:data?"POST":"GET",
    credentials:"same-origin",
    headers:data?{"Content-Type":"application/json"}:{},
    ...(data?{body:JSON.stringify(data)}:{cache:"no-store" as RequestCache})
  });
  const reply=await response.json() as T & {error?:string};
  if(!response.ok)throw new Error(reply.error||"Service temporairement indisponible.");
  return reply;
}
const money=(n:number)=>Number(n||0).toLocaleString("fr-FR")+" FCFA";
function Logo(){
  return <div className="brand"><span className="brand-icon">🚕</span><div><strong>DAY DAW <em>REC</em></strong><small>AMOUL ARRÊT · DAKAR</small></div></div>;
}
export default function App(){
  const [me,setMe]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [role,setRole]=useState<Role>("client");
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("+221");
  const [vehicle,setVehicle]=useState("Voiture");
  const [plate,setPlate]=useState("");
  const [step,setStep]=useState<"register"|"code">("register");
  const [code,setCode]=useState("");
  const [rides,setRides]=useState<Ride[]>([]);
  const [position,setPosition]=useState<{lat:number;lng:number;accuracy:number}|null>(null);
  const [dest,setDest]=useState(DESTINATIONS[0].name);
  const [category,setCategory]=useState(CATEGORIES[0]);
  const [tab,setTab]=useState<"home"|"rides"|"account">("home");
  const watch=useRef<number|null>(null);
  const lastSent=useRef(0);
  const refresh=useCallback(async()=>{
    try{
      const list=await call<{ok:true;rides:Ride[]}>("/api/rides");
      setRides(list.rides);
      const profile=await call<Profile>("/api/me");
      setMe(profile);
    }catch{/* Garde les données affichées en cas de déconnexion réseau. */}
  },[]);
  useEffect(()=>{
    call<Profile>("/api/me").then(async profile=>{
      setMe(profile);
      await refresh();
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[refresh]);
  useEffect(()=>{
    if(!me)return;
    const id=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh()},6000);
    return ()=>window.clearInterval(id);
  },[me?.user.id,refresh]);
  useEffect(()=>()=>{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current)},[]);
  const attempt=async(fn:()=>Promise<void>)=>{
    setBusy(true);setError("");setMessage("");
    try{await fn()}catch(e){setError(e instanceof Error?e.message:"Action impossible.")}
    finally{setBusy(false)}
  };
  const start=()=>attempt(async()=>{
    await call("/api/auth/start",{
      full_name:name.trim(),phone:phone.replace(/\s/g,""),role,
      ...(role==="driver"?{vehicle_type:vehicle,license_plate:plate.trim()}: {})
    });
    setStep("code");setMessage("Code envoyé par SMS. Saisis-le pour confirmer ton numéro.");
  });
  const confirm=()=>attempt(async()=>{
    await call("/api/auth/confirm",{phone:phone.replace(/\s/g,""),code});
    const profile=await call<Profile>("/api/me");
    setMe(profile);await refresh();setStep("register");setCode("");
    setMessage(profile.user.role==="driver"?"Compte créé. Validation des documents requise avant de recevoir des courses.":"Téléphone confirmé. Compte créé.");
  });
  const logout=()=>attempt(async()=>{
    await call("/api/auth/logout",{confirm:true});
    if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null}
    setMe(null);setRides([]);setPosition(null);setTab("home");setMessage("Déconnecté.");
  });
  const sendPosition=async(lat:number,lng:number)=>{
    if(Date.now()-lastSent.current<12000)return;
    lastSent.current=Date.now();
    try{await call("/api/driver/location",{lat,lng})}
    catch(e){setError(e instanceof Error?e.message:"GPS non envoyé.")}
  };
  const startDriverGps=()=>{
    setError("");setMessage("");
    if(!navigator.geolocation){setError("Ce navigateur ne prend pas en charge le GPS.");return}
    if(watch.current!==null){setMessage("La position GPS est déjà activée.");return}
    watch.current=navigator.geolocation.watchPosition(
      pos=>{
        const p={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
        setPosition(p);void sendPosition(p.lat,p.lng);
      },
      ()=>setError("Autorise la localisation dans Safari pour recevoir des courses."),
      {enableHighAccuracy:true,maximumAge:5000,timeout:20000}
    );
  };
  const captureClientGps=()=>{
    setError("");
    if(!navigator.geolocation){setError("La géolocalisation n'est pas disponible.");return}
    navigator.geolocation.getCurrentPosition(
      pos=>{setPosition({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy});setMessage("Point de départ GPS enregistré.");},
      ()=>setError("Autorise l'accès à ta position dans Safari."),
      {enableHighAccuracy:true,maximumAge:5000,timeout:20000}
    );
  };
  const availability=(online:boolean)=>attempt(async()=>{
    await call("/api/driver/availability",{online});
    const p=await call<Profile>("/api/me");setMe(p);
    setMessage(online?"Vous êtes disponible pour les courses.":"Vous êtes hors ligne.");
  });
  const requestRide=()=>attempt(async()=>{
    if(!position)throw new Error("Indique d'abord ton point de départ GPS.");
    const destination=DESTINATIONS.find(x=>x.name===dest)!;
    const result=await call<{ok:true;price_estimate:number}>("/api/rides",{
      pickup_address:"Ma position GPS",pickup_lat:position.lat,pickup_lng:position.lng,
      destination_address:destination.name,destination_lat:destination.lat,destination_lng:destination.lng,category
    });
    await refresh();setTab("rides");
    setMessage("Demande envoyée. Tarif indicatif : "+money(result.price_estimate)+".");
  });
  const rideAction=(id:string,action:string)=>attempt(async()=>{
    await call("/api/rides/"+id+"/"+action,{confirm:true});
    await refresh();
    setMessage("Statut de la course mis à jour.");
  });
  const active=rides.some(x=>["pending","accepted","arrived","onboard"].includes(x.status));
  const current=rides.find(x=>["pending","accepted","arrived","onboard"].includes(x.status));
  return <div className="app-shell">
    <div className="app-phone">
      <header className="topbar"><Logo/><span className="prelaunch">PRÉLANCEMENT</span></header>
      {loading?<main className="page"><p>Chargement de DAY DAW REC…</p></main>:!me?
      <main className="page">
        <div className="intro-art"><span>🚕</span><h1>Votre trajet, sans arrêt.</h1><p>Clients et chauffeurs à Dakar, sans code d'invitation.</p></div>
        <div className="role-tabs"><button className={role==="client"?"selected":""} onClick={()=>setRole("client")} disabled={step==="code"}>👤 Client</button><button className={role==="driver"?"selected":""} onClick={()=>setRole("driver")} disabled={step==="code"}>🚖 Chauffeur</button></div>
        {step==="register"?<form onSubmit={e=>{e.preventDefault();void start()}} className="form-stack">
          <label>Nom complet<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Prénom et nom" autoComplete="name"/></label>
          <label>Numéro sénégalais<input required type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+221 77 000 00 00" autoComplete="tel"/></label>
          {role==="driver"&&<><label>Type de véhicule<select value={vehicle} onChange={e=>setVehicle(e.target.value)}><option>Voiture</option><option>Moto</option><option>Minibus</option></select></label><label>Immatriculation<input required value={plate} onChange={e=>setPlate(e.target.value)} placeholder="Plaque du véhicule"/></label><p className="small-note">Le compte chauffeur restera inactif jusqu'à la vérification des documents par l'équipe.</p></>}
          <button className="primary-btn" disabled={busy} type="submit">{busy?"Envoi du SMS…":"Recevoir mon code SMS"}</button>
        </form>:<form onSubmit={e=>{e.preventDefault();void confirm()}} className="form-stack">
          <p>Code envoyé au <strong>{phone}</strong></p>
          <label>Code de confirmation<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="123456"/></label>
          <button className="primary-btn" type="submit" disabled={busy}>{busy?"Vérification…":"Confirmer mon numéro"}</button>
          <button type="button" className="text-btn" onClick={()=>setStep("register")}>Modifier mon numéro</button>
        </form>}
        <p className="small-note">Service en préparation · Les SMS nécessitent l'activation du prestataire de vérification.</p>
      </main>:
      <>
        <main className="page">
          <div className="welcome"><small>{me.user.role==="client"?"ESPACE PASSAGER":"ESPACE CHAUFFEUR"}</small><h1>Bonjour, {me.user.full_name.split(" ")[0]} 👋</h1></div>
          {tab==="home"&&me.user.role==="client"&&<>
            {current?<RideCard ride={current} role="client" busy={busy} onAction={rideAction}/>:<>
              <section className="panel"><h2>Où allons-nous ?</h2><p>Une course sera proposée automatiquement au chauffeur validé le plus proche (dans un rayon de 8 km).</p>
                <button type="button" className="location-btn" onClick={captureClientGps}>📍 {position?"Départ GPS trouvé · ±"+Math.round(position.accuracy)+" m":"Utiliser ma position GPS"}</button>
                <label className="field-label">Destination<select value={dest} onChange={e=>setDest(e.target.value)}>{DESTINATIONS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
                <label className="field-label">Véhicule<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
                <p className="small-note">Le tarif sera estimé à partir de la distance à vol d'oiseau : ce n'est pas encore un devis réel.</p>
                <button type="button" className="primary-btn" disabled={busy||!position||active} onClick={()=>void requestRide()}>{busy?"Recherche…":"Rechercher un chauffeur"}</button>
              </section>
            </>}
          </>}
          {tab==="home"&&me.user.role==="driver"&&<>
            {!me.driver?.approved?<section className="panel"><h2>🛡️ Vérification nécessaire</h2><p>Ton inscription est enregistrée, mais les documents du chauffeur et du véhicule doivent être examinés avant l'activation.</p><p className="small-note">Les documents ne peuvent pas encore être transmis depuis cette version.</p></section>:
            <section className="panel"><h2>Disponibilité</h2><p>{me.driver.is_available?"🟢 Tu es en ligne":"⚪ Tu es hors ligne"}</p>
              <button className="location-btn" onClick={startDriverGps}>📍 {position?"GPS actif · ±"+Math.round(position.accuracy)+" m":"Activer ma position GPS"}</button>
              <button type="button" className="primary-btn" disabled={busy||(!position&&!me.driver.is_available)} onClick={()=>void availability(!me.driver!.is_available)}>{me.driver.is_available?"Passer hors ligne":"Me rendre disponible"}</button>
              <p className="small-note">Laisse cette page ouverte pour actualiser ta position. Aucune course n'est attribuée sans position récente.</p>
            </section>}
            {current&&<RideCard ride={current} role="driver" busy={busy} onAction={rideAction}/>}
          </>}
          {tab==="rides"&&<><h2>{me.user.role==="client"?"Mes trajets":"Mes courses"}</h2>{rides.length?rides.map(ride=><RideCard key={ride.id} ride={ride} role={me.user.role} busy={busy} onAction={rideAction}/>):<section className="panel"><p>Aucune course pour l'instant.</p></section>}</>}
          {tab==="account"&&<section className="panel"><h2>Mon compte</h2><p><strong>{me.user.full_name}</strong></p><p>{me.user.phone} · {me.user.role==="client"?"Client":"Chauffeur"}</p>{me.driver&&<><p>Véhicule : {me.driver.vehicle_type} · {me.driver.license_plate}</p><p>{me.driver.approved?"✅ Chauffeur validé":"⏳ Validation des documents en attente"}</p></>}<button className="text-btn" onClick={()=>void logout()} disabled={busy}>Se déconnecter</button></section>}
        </main>
        <nav className="bottom-nav"><button className={tab==="home"?"current":""} onClick={()=>setTab("home")}>⌂<span>Accueil</span></button><button className={tab==="rides"?"current":""} onClick={()=>setTab("rides")}>🚕<span>Courses</span></button><button className={tab==="account"?"current":""} onClick={()=>setTab("account")}>👤<span>Profil</span></button></nav>
      </>}
      {(error||message)&&<div role={error?"alert":"status"} className={"flash "+(error?"flash-error":"")}><span>{error||message}</span><button aria-label="Fermer" onClick={()=>{setError("");setMessage("")}}>×</button></div>}
    </div>
    <footer className="site-footer">DAY DAW REC · Amoul Arrêt · Dakar, Sénégal <small>Préversion technique · Pas encore ouverte aux courses commerciales.</small></footer>
  </div>;
}
function RideCard({ride,role,busy,onAction}:{ride:Ride;role:Role;busy:boolean;onAction:(id:string,action:string)=>void}){
  let actions:string[]=[];
  if(role==="driver"){
    if(ride.status==="pending")actions=["decline","accept"];
    if(ride.status==="accepted")actions=["arrived"];
    if(ride.status==="arrived")actions=["start"];
    if(ride.status==="onboard")actions=["finish"];
  }else if(ride.status==="pending")actions=["cancel"];
  const labels:Record<string,string>={decline:"Refuser",accept:"Accepter",arrived:"Je suis arrivé",start:"Démarrer la course",finish:"Terminer la course",cancel:"Annuler"};
  return <article className="ride-card">
    <span className="ride-status">{STATUS[ride.status]||ride.status}</span>
    <div className="ride-route"><strong>📍 {ride.pickup_address}</strong><span>↓</span><strong>🏁 {ride.destination_address}</strong></div>
    <div className="ride-price"><span>{ride.category||"Standard"} · Prix indicatif</span><b>{money(ride.price)}</b></div>
    <p className="small-note">Créée le {ride.created_at||"—"}</p>
    <div className="ride-actions">{actions.map(action=><button key={action} type="button" className={action==="decline"||action==="cancel"?"secondary-btn":"primary-btn"} disabled={busy} onClick={()=>onAction(ride.id,action)}>{labels[action]}</button>)}</div>
  </article>;
}
