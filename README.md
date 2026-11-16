# DAY DAW REC — Amoul Arrêt 🚕

## Étape 2 — Authentification mobile (code développé, validation terrain à faire)

- Client et Chauffeur possèdent chacun une inscription et une connexion par téléphone sénégalais +221, vérification SMS Twilio Verify, consultation du vrai profil et déconnexion.
- Le Worker continue de gérer les connexions web par cookie HttpOnly et reconnaît désormais les sessions natives via `Authorization: Bearer`, avec hash SHA-256 dans D1. Aucun identifiant Twilio ne figure dans le code mobile.
- Sessions persistées dans Keychain / Android Keystore via `expo-secure-store` (SDK 54) ; un refus d'écriture sécurisée empêche la connexion de s'afficher comme réussie. La déconnexion supprime la session du serveur avant la copie locale.
- Les nouveaux chauffeurs restent `approved=0` jusqu'à la vérification documentaire réelle. Pas de dispatch ni de paiements ouverts au public.
- Tests techniques : `node --experimental-strip-types --test tests/native_auth.test.mjs` (simule Twilio et D1, sans envoyer de SMS) et workflow `check-mobile.yml`.

**Avant le premier SMS réel :** déployer la version récente du Worker et configurer ses secrets Twilio dans Cloudflare. Vérifier que le compte Twilio peut envoyer des SMS au Sénégal, et que le coût et les conditions d'utilisation sont acceptables. Un test de compilation ne prouve pas que les SMS ont été livrés.

## Applications mobiles natives séparées

**Deux applications indépendantes pour Android et iPhone**, reliées à terme au même backend Cloudflare :

- **Client** — `mobile/`, identifiant `com.diaotech.daydawrec`. Vraie carte de Dakar, GPS, calcul d'itinéraire routier de test ; commandes réelles non activées.
- **Chauffeur** — `chauffeur/`, identifiant `com.diaotech.daydawrec.chauffeur`. Carte native, GPS au premier plan sur demande, tableau de bord, état hors ligne et documents à valider ; courses réelles non activées.

Les deux projets restent sous le contrôle de Diao-Tech, avec des fichiers `app.json` et versions propres. L'application Chauffeur ne doit **pas** réutiliser l'identifiant EAS de Client. Aucun chauffeur n'est approuvé automatiquement et aucune localisation n'est envoyée au backend par ces maquettes mobiles.

**Vérification :** GitHub Actions `.github/workflows/check-mobile.yml` contrôle TypeScript et export iOS pour les deux applications. Pour tester, ouvrir chacun des dossiers dans un environnement Expo séparé. La publication sur les stores nécessite des builds signés.

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

## Démo gratuite
Le bouton « Ouvrir la démonstration » permet de simuler une course en passant de l'espace Client à Chauffeur, puis d'accepter, démarrer et terminer la course. **Tout est fictif** ; les vraies inscriptions restent protégées par la vérification SMS non configurée. Aucun paiement Twilio n'est nécessaire pour explorer l'interface.

## Configuration Cloudflare
- Worker existant : `day-daw-rec-api`
- Base D1 existante : `day-daw-rec-db`, liaison `DB`
- Interface / API déployées ensemble via `src/worker.ts` et assets Vite.
- Déploiements Git automatiques **réactivés dans Cloudflare le 13 novembre 2026** pour publier la préversion. Construction : `npm run build`; publication : `npx wrangler deploy`.

1. ✅ Migrations `0001_init.sql` et `0002_real_booking.sql` appliquées le 13 novembre 2026 sur `day-daw-rec-db`, vérifiées sans migration en attente.
2. Configurer trois secrets de production dans Cloudflare Workers → Settings → Variables and Secrets :
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et `TWILIO_VERIFY_SERVICE_SID`.
   Les clés ne doivent jamais être commitées dans GitHub. Twilio doit permettre les SMS au Sénégal. L'inscription échoue volontairement tant que le service SMS n'est pas configuré.
3. Pour les essais techniques : `npm install && npm run build && npx tsc --noEmit`.
4. Pour le **mode démo gratuit**, les secrets Twilio ne sont pas requis : le simulateur client/chauffeur ne contacte ni l'API ni le GPS et n'enregistre aucune course. Pour l'inscription réelle, les secrets Twilio resteront obligatoires. Le fichier `wrangler.jsonc` vise le Worker existant `day-daw-rec-api`.

## Validation des chauffeurs
Après une véritable vérification des pièces (hors de l'application), un opérateur autorisé peut définir `approved=1` pour un chauffeur depuis l'interface d'administration D1, en utilisant son `user_id`. **Ne pas approuver un chauffeur avant contrôle de son permis, du véhicule et des obligations locales.**

## API
- `GET /api/health`
- `POST /api/auth/start`, `POST /api/auth/confirm`, `POST /api/auth/logout`, `GET /api/me`
- `POST /api/driver/location`, `POST /api/driver/availability`
- `GET /api/rides`, `POST /api/rides`
- `POST /api/rides/:id/{accept,decline,arrived,start,finish,cancel}`

Tous les appels protégés utilisent la session cookie du même domaine. Les SMS requièrent un service externe, mais le reste du projet est exportable : pas de dépendance à un constructeur d'applications propriétaire.
