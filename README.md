# DAY DAW REC - Amoul Arrêt 🚕
Projet de transport pour Dakar, Sénégal, contrôlé par Diao-Tech.

**Version de démonstration uniquement.** Un client et un chauffeur peuvent rejoindre le même espace grâce à un code, envoyer une demande fictive, l'accepter et terminer une course. Pas de course réelle, GPS ou paiements.

## Indépendance
- Code sur ce dépôt GitHub, appartenant au propriétaire.
- Aucune dépendance Higgsfield (pas de SDK, compte ou clé).
- Hébergement envisagé : Cloudflare Workers et base de données D1 appartenant au propriétaire.
- Code React et Worker standard, exportable.

## Installation locale
```bash
npm install
npm run build
npm run db:local
npm run dev
```

## Déployer sur ton propre compte Cloudflare
1. Créer une base Cloudflare D1 : `npm run db:create`.
2. Remplacer `REMPLACER_PAR_ID_D1` dans `wrangler.jsonc` par l'identifiant réel.
3. Appliquer les tables : `npm run db:remote`.
4. Publier : `npm run deploy`.

**Non publié actuellement :** le dépôt contient les sources, mais ton Cloudflare doit encore être relié et configuré. Avant de servir le public, prévoir la sécurité, la vérification des chauffeurs, l'authentification et les autorisations nécessaires.
