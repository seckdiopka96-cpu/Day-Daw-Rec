import {useCallback,useEffect,useRef,useState,type ReactNode} from "react";

export default DayDawRec;

type Role="client"|"driver";
type Status="pending"|"accepted"|"arrived"|"onboard"|"finished"|"declined"|"cancelled";
type Ride={id:string;origin:string;destination:string;category:string;fare:number;status:Status;created_at:number;updated_at:number;driver_id:string|null};
type Snapshot={ok:true;role:Role;roomCode:string;clientJoined:boolean;driverJoined:boolean;driverOnline:boolean;rides:Ride[];latest:Ride|null};
type Reply=Snapshot | {ok:boolean;error?:string;token?:string;role?:Role;roomCode?:string};
const PLACES=["Dakar-Plateau","Almadies","Ouakam","Yoff","Mermoz","Point E","Médina","Parcelles Assainies","Pikine","Guédiawaye"];
const CARS=[{name:"Standard",icon:"🚘",places:"4 places",desc:"Simple et économique",price:2500},{name:"Confort",icon:"🚙",places:"4 places",desc:"Plus de confort",price:3500},{name:"VIP",icon:"🚖",places:"4 places",desc:"Voyage premium",price:5000},{name:"Groupe",icon:"🚐",places:"6 à 7 places",desc:"Pour les groupes",price:6500}];
const STATUS:Record<Status,string>={pending:"En attente d'un chauffeur",accepted:"Chauffeur en route",arrived:"Chauffeur arrivé",onboard:"Trajet en cours",finished:"Trajet terminé",declined:"Course refusée",cancelled:"Course annulée"};
const active=(ride:Ride|null|undefined)=>Boolean(ride&&["pending","accepted","arrived","onboard"].includes(ride.status));
const money=(n:number)=>n.toLocaleString("fr-FR")+" FCFA";

function Icon({name,size=22}:{name:string;size?:number}){
 const paths:Record<string,ReactNode>={
  car:<><rect x="4" y="8" width="16" height="10" rx="2"/><path d="m6 8 2-4h8l2 4M4 12h16M7 18v2M17 18v2"/><circle cx="7.5" cy="15" r=".8" fill="currentColor" stroke="none"/><circle cx="16.5" cy="15" r=".8" fill="currentColor" stroke="none"/></>,
  home:<><path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-8h6v8"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
  wallet:<><path d="M3 7h18v14H3zM3 7V4h15v3"/><path d="M15 12h6v5h-6a2.5 2.5 0 0 1 0-5Z"/></>,
  user:<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></>,
  pin:<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check:<><path d="m4 12 5 5L20 6"/></>,
  arrow:<><path d="M4 12h16m-7-7 7 7-7 7"/></>,
  back:<><path d="M19 12H5m7-7-7 7 7 7"/></>,
  copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></>,
  shield:<><path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z"/><path d="m8 12 3 3 5-6"/></>
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.car}</svg>;
}
function Brand(){
 return <div className="ddr-brand"><div className="ddr-emblem"><Icon name="car" size={25}/></div><div><strong>DAY DAW <span>REC</span></strong><small>AMOUL ARRÊT</small></div></div>
}
function MapArtwork({origin,destination}:{origin:string;destination:string}){
 return <div className="ddr-map" aria-label="Illustration de carte à Dakar, pas un suivi GPS">
   <svg viewBox="0 0 420 280" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Carte illustrative de Dakar">
    <rect width="420" height="280" fill="#b5dce9"/>
    <path d="M152 -10 440 -10 440 290 302 290Q265 252 215 219Q151 195 128 130Q116 77 152 -10" fill="#e7eddc"/>
    <g fill="none" stroke="#fff" strokeWidth="10"><path d="M125 38Q246 63 437 38"/><path d="M120 104Q263 128 420 110"/><path d="M137 181Q268 177 430 223"/><path d="M228 0Q261 107 350 287"/><path d="M320 -10Q305 87 395 265"/><path d="M168 30Q202 141 252 268"/></g>
    <g fill="none" stroke="#d4bc77" strokeWidth="3"><path d="M132 67Q230 118 355 230"/><path d="M150 197Q265 134 409 161"/></g>
    <path d="M147 100Q216 125 265 169T352 236" fill="none" stroke="#137b54" strokeWidth="6" strokeLinecap="round" strokeDasharray="7 5"/>
    <g fill="#61786b" fontSize="14" fontFamily="Arial,sans-serif" fontWeight="700"><text x="136" y="77">ALMADIES</text><text x="277" y="91">YOFF</text><text x="184" y="157">OUAKAM</text><text x="315" y="195">MERMOZ</text><text x="343" y="261">DAKAR</text></g>
    <circle cx="147" cy="100" r="13" fill="#e35c50" stroke="#fff" strokeWidth="5"/><circle cx="352" cy="236" r="13" fill="#0b8756" stroke="#fff" strokeWidth="5"/>
    <g transform="translate(252,149)"><rect x="-16" y="-10" width="34" height="21" rx="8" fill="#ffce3a" stroke="#fff" strokeWidth="3"/><circle cx="-8" cy="12" r="4" fill="#283f30"/><circle cx="11" cy="12" r="4" fill="#283f30"/></g>
   </svg>
   <div className="ddr-map-chip"><Icon name="pin" size={15}/> Dakar, Sénégal</div>
   <div className="ddr-map-credit">Carte illustrative · GPS à venir</div>
   <div className="ddr-map-bottom">{origin} <span>→</span> {destination}</div>
 </div>
}
function StatusBox({label,status}:{label:string;status:"ready"|"waiting"|"offline"}){
 return <div className={"ddr-status "+status}><span className="ddr-led"/><div><b>{label}</b><small>{status==="ready"?"Connecté":status==="waiting"?"En attente":"Hors ligne"}</small></div></div>
}
function DayDawRec(){
 const [token,setToken]=useState("");
 const [loading,setLoading]=useState(true);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [role,setRole]=useState<Role>("client");
 const [joinMode,setJoinMode]=useState(false);
 const [code,setCode]=useState("");
 const [from,setFrom]=useState(PLACES[0]);
 const [to,setTo]=useState(PLACES[1]);
 const [category,setCategory]=useState(CARS[0].name);
 const [page,setPage]=useState("home");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [newRoomCode,setNewRoomCode]=useState("");
 const [lastUpdated,setLastUpdated]=useState(0);
 const pollRef=useRef(false);
 const req=useCallback(async (method:"GET"|"POST",session:string,body?:Record<string,unknown>)=>{
  const res=await fetch("/api/rides",{method,headers:{...(session?{Authorization:"Bearer "+session}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{cache:"no-store" as RequestCache})});
  const data=await res.json() as Reply;
  if(!res.ok||!data.ok)throw new Error("error" in data&&data.error?data.error:"Service indisponible.");
  return data;
 },[]);
 const refresh=useCallback(async (t:string)=>{
  if(pollRef.current)return;
  pollRef.current=true;
  try{
   const result=await req("GET",t);
   if("rides" in result){setSnapshot(result);setRole(result.role);setLastUpdated(Date.now())}
  }catch(e){
   if(e instanceof Error&&/Session non reconnue/.test(e.message)){
    localStorage.removeItem("ddr-demo-token");setToken("");setSnapshot(null);setError("Session expirée. Recrée ou rejoins un espace.");
   }
  }finally{pollRef.current=false}
 },[req]);
 useEffect(()=>{
  const saved=localStorage.getItem("ddr-demo-token")||"";
  if(saved){setToken(saved);void refresh(saved).finally(()=>setLoading(false))}
  else setLoading(false);
 },[refresh]);
 useEffect(()=>{
  if(!token)return;
  const id=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh(token)},2500);
  const focus=()=>void refresh(token);
  window.addEventListener("focus",focus);
  return()=>{window.clearInterval(id);window.removeEventListener("focus",focus)};
 },[token,refresh]);
 const action=async (operation:string,payload:Record<string,unknown>={})=>{
  setBusy(true);setError("");setNotice("");
  try{
   const reply=await req("POST",token,{action:operation,...payload});
   if("rides" in reply)setSnapshot(reply);
   else if("token" in reply&&reply.token){
    localStorage.setItem("ddr-demo-token",reply.token);
    setToken(reply.token);
    if(reply.role)setRole(reply.role);
    setNewRoomCode(reply.roomCode||"");
    await refresh(reply.token);
   }
   if(operation==="request"){setPage("home");setNotice("Demande transmise au chauffeur.")}
   if(operation==="accept"){setNotice("Course acceptée. Le client voit ton statut.")}
   if(operation==="finish"){setNotice("Course terminée.")}
  }catch(e){setError(e instanceof Error?e.message:"Action impossible.")}
  finally{setBusy(false)}
 };
 const latest=snapshot?.latest||null;
 const onGoing=active(latest);
 const fare=CARS.find(c=>c.name===category)?.price||2500;
 const income=snapshot?.rides.filter(r=>r.status==="finished").reduce((sum,r)=>sum+r.fare,0)||0;
 const done=snapshot?.rides.filter(r=>r.status==="finished").length||0;
 const copy=async()=>{
  const text=snapshot?.roomCode||newRoomCode;
  try{await navigator.clipboard.writeText(text);setNotice("Code copié. Envoie-le à l'autre téléphone.")}
  catch{setNotice("Code : "+text)}
 };
 const share=async()=>{
  const value=snapshot?.roomCode||newRoomCode;
  const text="Rejoins mon espace DAY DAW REC (mode test). Code : "+value+" · "+location.origin;
  if(navigator.share){try{await navigator.share({text,title:"DAY DAW REC"})}catch{}}
  else{try{await navigator.clipboard.writeText(text);setNotice("Invitation copiée.")}catch{setNotice(text)}}
 };
 const leave=()=>{localStorage.removeItem("ddr-demo-token");setToken("");setSnapshot(null);setPage("home");setNotice("");setError("");setNewRoomCode("")};
 const roleLabel=role==="client"?"Client":"Chauffeur";
 const controls=(t:Ride)=>{
  if(role==="driver"){
   if(t.status==="pending")return <div className="ddr-row-action"><button type="button" className="ddr-danger" disabled={busy} onClick={()=>void action("decline",{rideId:t.id})}>Refuser</button><button type="button" className="ddr-action" disabled={busy} onClick={()=>void action("accept",{rideId:t.id})}>Accepter <Icon name="check" size={19}/></button></div>;
   if(t.status==="accepted")return <button type="button" className="ddr-action stretch" disabled={busy} onClick={()=>void action("arrived",{rideId:t.id})}>Je suis arrivé au départ <Icon name="arrow" size={19}/></button>;
   if(t.status==="arrived")return <button type="button" className="ddr-action stretch" disabled={busy} onClick={()=>void action("start",{rideId:t.id})}>Démarrer le trajet <Icon name="arrow" size={19}/></button>;
   if(t.status==="onboard")return <button type="button" className="ddr-action stretch" disabled={busy} onClick={()=>void action("finish",{rideId:t.id})}>Terminer le trajet <Icon name="check" size={19}/></button>;
  }
  if(role==="client"&&t.status==="pending")return <button type="button" className="ddr-cancel" disabled={busy} onClick={()=>void action("cancel",{rideId:t.id})}>Annuler la demande</button>;
  return null;
 };
 function RideCard({ride}:{ride:Ride}){
  return <div className={"ddr-ride-card "+(ride.status==="pending"?"is-pending":"")}>
   <div className="ddr-ride-head"><span className={"ddr-bubble "+ride.status}><span className="ddr-led"/>{STATUS[ride.status]}</span><span className="ddr-date">{new Date(ride.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span></div>
   <div className="ddr-ride-route"><div className="ddr-location"><span className="ddr-pin green"/><div><small>DÉPART</small><strong>{ride.origin}</strong></div></div><span className="ddr-pathline"/><div className="ddr-location"><span className="ddr-pin red"/><div><small>DESTINATION</small><strong>{ride.destination}</strong></div></div></div>
   <div className="ddr-fare"><div><small>{ride.category} · Tarif de démonstration</small><strong>{money(ride.fare)}</strong></div><Icon name="wallet" size={23}/></div>
   {controls(ride)}
  </div>;
 }
 const navigation=role==="client"?[{id:"home",label:"Accueil",icon:"home"},{id:"trips",label:"Trajets",icon:"clock"},{id:"messages",label:"Messages",icon:"car"},{id:"profile",label:"Profil",icon:"user"}]:[{id:"home",label:"Accueil",icon:"home"},{id:"trips",label:"Courses",icon:"clock"},{id:"earnings",label:"Gains",icon:"wallet"},{id:"profile",label:"Profil",icon:"user"}];
 return <div className="ddr-app">
  <div className="ddr-phone">
   <div className="ddr-header"><div className="ddr-headline"><Brand/><span className="ddr-test">MODE TEST</span></div>
    {snapshot?<div className="ddr-role-switch"><span className={role==="client"?"active":""}>👤 Client</span><span className={role==="driver"?"active":""}>🚘 Chauffeur</span></div>:null}
   </div>
   {loading?<div className="ddr-loading">Ouverture de DAY DAW REC…</div>:!snapshot?
    <main className="ddr-scroll ddr-auth-page">
     <MapArtwork origin="Dakar" destination="Dakar"/>
     <section className="ddr-content">
      <span className="ddr-kicker">À DEUX TÉLÉPHONES</span>
      <h1>En route, ensemble.</h1>
      <p className="ddr-descr">Crée un espace de test, puis relie un passager et un chauffeur grâce au même code.</p>
      <div className="ddr-role-pick"><button type="button" className={role==="client"?"chosen":""} onClick={()=>setRole("client")}>👤<strong>Client</strong></button><button type="button" className={role==="driver"?"chosen":""} onClick={()=>setRole("driver")}>🚘<strong>Chauffeur</strong></button></div>
      <div className="ddr-auth-toggle"><button type="button" className={!joinMode?"chosen":""} onClick={()=>setJoinMode(false)}>Créer un espace</button><button type="button" className={joinMode?"chosen":""} onClick={()=>setJoinMode(true)}>Rejoindre</button></div>
      {joinMode?<div className="ddr-inputline"><label htmlFor="ddr-code">CODE À 12 CARACTÈRES</label><input id="ddr-code" placeholder="Code reçu de l'autre téléphone" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,12))} maxLength={12}/></div>:null}
      <button type="button" className="ddr-book-btn" disabled={busy||joinMode&&code.length!==12} onClick={()=>void action(joinMode?"join":"create",{role,code})}>{busy?"Connexion…":joinMode?"Rejoindre comme "+roleLabel:"Créer un espace "+roleLabel}<Icon name="arrow" size={20}/></button>
      <p className="ddr-legal">Trajets et prix fictifs. Pas de courses publiques ni de paiements.</p>
     </section>
    </main>:
    <>
    <main className="ddr-scroll">
     {page==="home"&&role==="client"&&<section className="ddr-main">
      <MapArtwork origin={from} destination={to}/>
      <div className="ddr-content raised">
       <span className="ddr-kicker">BONJOUR 👋</span>
       <h1>{onGoing?"Votre course":"On vous emmène où ?"}</h1>
       {onGoing&&latest?<><p className="ddr-descr">{STATUS[latest.status]}. Consulte le deuxième téléphone pour faire avancer la course.</p><RideCard ride={latest}/></>:
        <><p className="ddr-descr">Commandez une course test et suivez son état en direct.</p>
         <div className="ddr-routebox">
          <div className="ddr-route-input"><span className="ddr-pin green"/><div><label htmlFor="ddr-from">LIEU DE DÉPART</label><select id="ddr-from" value={from} onChange={e=>setFrom(e.target.value)}>{PLACES.map(p=><option key={p}>{p}</option>)}</select></div></div>
          <div className="ddr-route-input"><span className="ddr-pin red"/><div><label htmlFor="ddr-dest">DESTINATION</label><select id="ddr-dest" value={to} onChange={e=>setTo(e.target.value)}>{PLACES.map(p=><option key={p}>{p}</option>)}</select></div></div>
         </div>
         <div className="ddr-car-list">{CARS.map(car=><button type="button" key={car.name} className={"ddr-car-row "+(category===car.name?"chosen":"")} onClick={()=>setCategory(car.name)}><span className="ddr-car-emoji">{car.icon}</span><span className="ddr-car-info"><b>{car.name}</b><small>{car.desc} · {car.places}</small></span><strong>{money(car.price)}</strong></button>)}</div>
         <div className="ddr-price-caption">Tarif fictif fixe, non calculé au kilomètre</div>
         {snapshot.driverJoined?<StatusBox label="Chauffeur du test" status={snapshot.driverOnline?"ready":"offline"}/>:<div className="ddr-await"><Icon name="clock" size={18}/><span>Invite d'abord ton chauffeur avec le code de l'espace.</span></div>}
         <button type="button" className="ddr-book-btn" disabled={busy||!snapshot.driverOnline||from===to} onClick={()=>void action("request",{origin:from,destination:to,category})}>{busy?"Envoi…":"Commander (test)"}<Icon name="arrow" size={20}/></button>
         <p className="ddr-legal">Aucun véhicule réel n'est envoyé.</p>
        </>}
      </div>
     </section>}
     {page==="home"&&role==="driver"&&<section className="ddr-content ddr-driver-home">
      <div className="ddr-hello"><div className="ddr-initial">MD</div><div><span className="ddr-kicker">ESPACE CHAUFFEUR</span><h1>Bonjour, Moussa !</h1></div></div>
      <div className="ddr-online"><div className="ddr-online-left"><span className={"ddr-online-light "+(snapshot.driverOnline?"yes":"")}/><div><b>{snapshot.driverOnline?"Vous êtes en ligne":"Vous êtes hors ligne"}</b><small>{snapshot.driverOnline?"Prêt à recevoir une course":"Les demandes sont désactivées"}</small></div></div><button type="button" className={"ddr-toggle "+(snapshot.driverOnline?"on":"")} aria-label={snapshot.driverOnline?"Passer hors ligne":"Passer en ligne"} aria-pressed={snapshot.driverOnline} disabled={busy||onGoing} onClick={()=>void action("online",{online:!snapshot.driverOnline})}><i/></button></div>
      <div className="ddr-earnings-card"><span>GAINS SIMULÉS</span><strong>{money(income)}</strong><div><b>{done}</b> trajets terminés dans cet espace</div><Icon name="wallet" size={33}/></div>
      <MapArtwork origin="Dakar" destination="Dakar"/>
      {onGoing&&latest?<><div className="ddr-cardtitle">Demande de course</div><RideCard ride={latest}/></>:
       <div className="ddr-empty"><span>🚙</span><h2>{snapshot.driverOnline?"En attente de courses":"Vous êtes hors ligne"}</h2><p>{snapshot.clientJoined?"Le client peut envoyer une demande depuis son téléphone.":"Partage le code pour faire rejoindre un client."}</p></div>}
      <button type="button" className="ddr-invite" onClick={()=>void share()}><Icon name="copy" size={19}/> Partager le code de l'espace</button>
     </section>}
     {page==="trips"&&<section className="ddr-content ddr-inner"><span className="ddr-kicker">HISTORIQUE COMMUN</span><h1>{role==="client"?"Mes trajets":"Mes courses"}</h1><p className="ddr-descr">L'historique des courses de votre espace est partagé en direct.</p>{snapshot.rides.length?snapshot.rides.map(t=><div className="ddr-history" key={t.id}><span className="ddr-history-icon"><Icon name="car" size={23}/></span><div><b>{t.origin} → {t.destination}</b><small>{STATUS[t.status]} · {t.category}</small></div><strong>{money(t.fare)}</strong></div>):<div className="ddr-empty"><span>🗺️</span><h2>Aucune course</h2><p>Vos demandes apparaîtront ici.</p></div>}</section>}
     {page==="earnings"&&role==="driver"&&<section className="ddr-content ddr-inner"><span className="ddr-kicker">TABLEAU DE BORD</span><h1>Mes gains</h1><div className="ddr-earnings-card"><span>TOTAL DES COURSES TERMINÉES</span><strong>{money(income)}</strong><div>Montants fictifs pour cette démonstration.</div></div><div className="ddr-breakdown"><div><b>{done}</b><span>Courses terminées</span></div><div><b>0 FCFA</b><span>Argent réellement gagné</span></div></div></section>}
     {page==="messages"&&role==="client"&&<section className="ddr-content ddr-inner"><h1>Messages</h1><div className="ddr-empty"><span>💬</span><h2>Messagerie bientôt disponible</h2><p>Cette étape relie les courses, pas encore les appels ni les messages.</p></div></section>}
     {page==="profile"&&<section className="ddr-content ddr-inner"><span className="ddr-kicker">COMPTE DE DÉMONSTRATION</span><h1>Mon espace</h1>
      <div className="ddr-profilerole"><div className="ddr-initial">{role==="client"?"CL":"CH"}</div><div><b>Compte {roleLabel}</b><small>Mode test privé · DAY DAW REC</small></div></div>
      <div className="ddr-codepanel"><small>CODE DE CONNEXION À DEUX</small><b>{snapshot.roomCode}</b><div><button onClick={()=>void copy()}><Icon name="copy" size={16}/> Copier</button><button onClick={()=>void share()}>Partager</button></div></div>
      <p className="ddr-descr">Ouvre DAY DAW REC sur un autre téléphone, choisis l'autre rôle, puis rejoins cet espace avec le code.</p>
      <div className="ddr-profilerole"><Icon name="shield" size={24}/><div><b>Essais sans paiement</b><small>Nous ne collectons ni argent ni position GPS.</small></div></div>
      <button type="button" className="ddr-logout" onClick={leave}>Quitter cet appareil</button>
     </section>}
    </main>
    <nav className="ddr-nav" aria-label="Navigation">{navigation.map(n=><button type="button" key={n.id} className={page===n.id?"selected":""} onClick={()=>{setPage(n.id);setError("");setNotice("")}}><Icon name={n.icon} size={24}/><span>{n.label}</span></button>)}</nav>
    </>}
   {snapshot&&<div className="ddr-floating-room"><span>🔗 Code : <b>{snapshot.roomCode}</b></span><button type="button" onClick={()=>void copy()} aria-label="Copier le code"><Icon name="copy" size={16}/></button></div>}
   {(error||notice)&&<div role={error?"alert":"status"} className={"ddr-toast "+(error?"error":"")}><span>{error||notice}</span><button aria-label="Fermer" onClick={()=>{setError("");setNotice("")}}>×</button></div>}
  </div>
  <footer className="ddr-site-footer">DAY DAW REC <span>·</span> Amoul Arrêt <span>·</span> Dakar, Sénégal <small>Prototype privé de courses, tarifs fictifs.</small></footer>
 </div>;
}
