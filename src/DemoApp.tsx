import { useState } from "react";

type DemoRole = "client" | "driver";
type DemoStatus = "pending" | "accepted" | "arrived" | "onboard" | "finished" | "cancelled" | "declined";
type DemoRide = {
  id: number;
  from: string;
  to: string;
  category: string;
  price: number;
  status: DemoStatus;
};
const PLACES = ["Almadies", "Ouakam", "Yoff", "Mermoz", "Médina", "Pikine", "Guédiawaye", "Rufisque"];
const PRICES: Record<string, number> = { Standard: 2500, Confort: 3500, VIP: 5000, Groupe: 6000 };
const LABELS: Record<DemoStatus, string> = {
  pending: "En attente du chauffeur",
  accepted: "Chauffeur en route",
  arrived: "Chauffeur arrivé",
  onboard: "Course en cours",
  finished: "Course terminée",
  cancelled: "Course annulée",
  declined: "Course refusée"
};
const format = (amount: number) => amount.toLocaleString("fr-FR") + " FCFA";

export default function DemoApp({ onExit }: { onExit: () => void }) {
  const [role, setRole] = useState<DemoRole>("client");
  const [destination, setDestination] = useState(PLACES[0]);
  const [category, setCategory] = useState("Standard");
  const [online, setOnline] = useState(true);
  const [ride, setRide] = useState<DemoRide | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"home" | "rides" | "account">("home");

  const update = (status: DemoStatus) => {
    if (!ride) return;
    setRide({ ...ride, status });
    setNotice(LABELS[status] + " (simulation).");
  };
  const isActive = ride && ["pending", "accepted", "arrived", "onboard"].includes(ride.status);
  const createRide = () => {
    if (isActive) return;
    setRide({ id: Date.now(), from: "Dakar Plateau (départ fictif)", to: destination, category, price: PRICES[category], status: "pending" });
    setNotice("Course fictive créée. Passe dans l'espace Chauffeur pour l'accepter.");
    setTab("rides");
  };
  return <div className="app-shell">
    <div className="app-phone">
      <header className="topbar"><div className="brand"><span className="brand-icon">🚕</span><div><strong>DAY DAW <em>REC</em></strong><small>AMOUL ARRÊT · DAKAR</small></div></div><span className="prelaunch">DÉMO GRATUITE</span></header>
      <main className="page">
        <section className="demo-banner" aria-label="Mode démonstration">
          <strong>🧪 Mode démonstration</strong>
          <p>Tout est fictif : aucun SMS, paiement, compte ou vraie course. Aucune donnée n'est envoyée au serveur.</p>
          <button className="text-btn" onClick={onExit}>← Quitter la démo</button>
        </section>
        <div className="role-tabs" aria-label="Voir l'interface">
          <button className={role === "client" ? "selected" : ""} onClick={() => { setRole("client"); setNotice(""); setTab("home"); }}>👤 Client</button>
          <button className={role === "driver" ? "selected" : ""} onClick={() => { setRole("driver"); setNotice(""); setTab("home"); }}>🚖 Chauffeur</button>
        </div>
        {notice && <p className="demo-notice" role="status">{notice}</p>}
        <div className="welcome"><small>{role === "client" ? "ESPACE PASSAGER · SIMULATION" : "ESPACE CHAUFFEUR · SIMULATION"}</small><h1>Bonjour 👋</h1></div>
        {tab === "home" && role === "client" && <section className="panel">
          <h2>Où allons-nous ?</h2>
          <p>Découvre comment réserver un trajet à Dakar.</p>
          <div className="demo-location">📍 Dakar Plateau — départ fictif</div>
          <label className="field-label">Destination
            <select value={destination} onChange={e => setDestination(e.target.value)}>{PLACES.map(x => <option key={x}>{x}</option>)}</select>
          </label>
          <label className="field-label">Véhicule
            <select value={category} onChange={e => setCategory(e.target.value)}>{Object.keys(PRICES).map(x => <option key={x}>{x}</option>)}</select>
          </label>
          <p>Tarif fictif : <strong>{format(PRICES[category])}</strong></p>
          <button className="primary-btn" disabled={!!isActive} onClick={createRide}>{isActive ? "Course en cours" : "Simuler une réservation"}</button>
        </section>}
        {tab === "home" && role === "driver" && <section className="panel">
          <h2>Disponibilité du chauffeur</h2>
          <p>{online ? "🟢 En ligne (simulation)" : "⚪ Hors ligne (simulation)"}</p>
          <button className="primary-btn" onClick={() => setOnline(!online)}>{online ? "Passer hors ligne" : "Me rendre disponible"}</button>
          <p className="small-note">Aucun GPS n'est transmis. Tous les chauffeurs sont fictifs dans cette démo.</p>
          {ride?.status === "pending" && <button className="location-btn" onClick={() => setTab("rides")}>🚕 Une demande fictive est disponible — Voir</button>}
        </section>}
        {tab === "rides" && <section className="panel">
          <h2>{role === "client" ? "Mon trajet" : "Course proposée"}</h2>
          {!ride ? <p>Aucune course simulée. Réserve un trajet depuis l'onglet Accueil en mode Client.</p> :
            <>
              <span className="ride-status">{LABELS[ride.status]}</span>
              <div className="ride-route"><strong>📍 {ride.from}</strong><span>↓</span><strong>🏁 {ride.to}</strong></div>
              <div className="ride-price"><span>{ride.category} · Tarif fictif</span><b>{format(ride.price)}</b></div>
              <div className="ride-actions">
                {role === "client" && ride.status === "pending" && <button className="secondary-btn" onClick={() => update("cancelled")}>Annuler</button>}
                {role === "driver" && ride.status === "pending" && online && <><button className="secondary-btn" onClick={() => update("declined")}>Refuser</button><button className="primary-btn" onClick={() => update("accepted")}>Accepter</button></>}
                {role === "driver" && ride.status === "accepted" && <button className="primary-btn" onClick={() => update("arrived")}>Je suis arrivé</button>}
                {role === "driver" && ride.status === "arrived" && <button className="primary-btn" onClick={() => update("onboard")}>Démarrer la course</button>}
                {role === "driver" && ride.status === "onboard" && <button className="primary-btn" onClick={() => update("finished")}>Terminer la course</button>}
              </div>
              {["finished", "cancelled", "declined"].includes(ride.status) && <button className="location-btn" onClick={() => { setRide(null); setTab("home"); setRole("client"); setNotice("Tu peux simuler une nouvelle course."); }}>Créer une autre course fictive</button>}
              {ride.status === "pending" && role === "client" && <p className="small-note">Passe dans l'espace Chauffeur pour accepter cette demande fictive.</p>}
            </>}
        </section>}
        {tab === "account" && <section className="panel"><h2>Profil de démonstration</h2><p>👤 {role === "client" ? "Client fictif" : "Chauffeur fictif"}</p><p>Aucun numéro de téléphone ni aucune pièce d'identité requis.</p><button className="text-btn" onClick={onExit}>Quitter le mode démonstration</button></section>}
      </main>
      <nav className="bottom-nav"><button className={tab === "home" ? "current" : ""} onClick={() => setTab("home")}>⌂<span>Accueil</span></button><button className={tab === "rides" ? "current" : ""} onClick={() => setTab("rides")}>🚕<span>Courses</span></button><button className={tab === "account" ? "current" : ""} onClick={() => setTab("account")}>👤<span>Profil</span></button></nav>
    </div>
    <footer className="site-footer">DAY DAW REC · Démonstration locale, sans réservation réelle</footer>
  </div>;
}
