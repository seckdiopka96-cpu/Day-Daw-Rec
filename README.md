# DAY DAW REC — Amoul Arrêt 🚕
Application indépendante de mise en relation clients/chauffeurs pour la région de Dakar, Sénégal. Le code et la base Cloudflare D1 restent sous le contrôle du propriétaire.

## État actuel : pré-lancement, non ouvert aux courses commerciales
Cette branche remplace l'ancienne démonstration fondée sur des codes d'invitation. L'interface comprend maintenant :
- Inscription client/chauffeur par numéro sénégalais (+221 7xxxxxxxx) et SMS OTP réel via Twilio Verify.
- Validation manuelle préalable des chauffeurs et de leurs véhicules (pas d'approbation automatique).
- Autorisation de géolocalisation pour le départ client et la position du chauffeur.
- Attribution d'une demande au chauffeur **validé, disponible et localisé récemment** le plus proche dans un rayon de 8 km.
- Proposition / acceptation / arrivée / début / fin / refus / annulation de course.
- Consultation des courses par compte, avec session sécurisée en cookie HttpOnly.

**Limitations importantes :** aucune revue de documents n'est encore disponible dans l'interface; la validation du chauffeur est donc une opération administrative. La carte n'est pas encore une vraie carte routière, les prix sont indicatifs (distance à vol d'oiseau), il n'y a pas de paiement ni de notifications push. Un refus de course n'entraîne pas encore de réattribution. Le partage de position GPS exige que le chauffeur garde la page ouverte. Le service est destiné à des tests privés jusqu'à la réalisation des contrôles techniques, légaux et opérationnels.

## Configuration Cloudflare
- Worker existant : `day-daw-rec-api`
- Base D1 existante : `day-daw-rec-db`, liaison `DB`
- Interface / API déployées ensemble via `src/worker.ts` et assets Vite.
- Déploiements Git automatiques actuellement **désactivés dans Cloudflare**. Les commits GitHub ne remplacent donc PAS le Worker actif.

1. **Sauvegarder D1**, puis appliquer les migrations du dépôt **une seule fois** via Wrangler :
   `npx wrangler d1 migrations apply DB --remote`
   Le fichier `0001_init.sql` maintient les anciennes tables de test sans les supprimer; `0002_real_booking.sql` ajoute les tables/composants nécessaires à la nouvelle application. Ne pas exécuter `0002` manuellement puis avec Wrangler une seconde fois (ses `ALTER TABLE` ne sont pas répétables).
2. Configurer trois secrets de production dans Cloudflare Workers → Settings → Variables and Secrets :
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et `TWILIO_VERIFY_SERVICE_SID`.
   Les clés ne doivent jamais être commitées dans GitHub. Twilio doit permettre les SMS au Sénégal. L'inscription échoue volontairement tant que le service SMS n'est pas configuré.
3. Pour les essais techniques : `npm install && npm run build && npx tsc --noEmit`.
4. Après migration et configuration des secrets, activer les builds dans Cloudflare : build `npm run build`, déploiement `npx wrangler deploy`. Le fichier `wrangler.jsonc` vise le Worker existant `day-daw-rec-api`.

## Validation des chauffeurs
Après une véritable vérification des pièces (hors de l'application), un opérateur autorisé peut définir `approved=1` pour un chauffeur depuis l'interface d'administration D1, en utilisant son `user_id`. **Ne pas approuver un chauffeur avant contrôle de son permis, du véhicule et des obligations locales.**

## API
- `GET /api/health`
- `POST /api/auth/start`, `POST /api/auth/confirm`, `POST /api/auth/logout`, `GET /api/me`
- `POST /api/driver/location`, `POST /api/driver/availability`
- `GET /api/rides`, `POST /api/rides`
- `POST /api/rides/:id/{accept,decline,arrived,start,finish,cancel}`

Tous les appels protégés utilisent la session cookie du même domaine. Les SMS requièrent un service externe, mais le reste du projet est exportable : pas de dépendance à un constructeur d'applications propriétaire.
