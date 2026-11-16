# DAY DAW REC — application mobile native iOS & Android

Ce dossier contient **une véritable application React Native**, séparée du site web et du Worker Cloudflare. Elle affiche une carte Apple Maps sur iOS et Google Maps sur Android avec `react-native-maps`.

## Fonctionnalités natives déjà codées
- Carte interactive plein écran centrée sur Dakar et permettant de zoomer et déplacer la carte.
- Permission GPS native iPhone/Android et point de départ calculé par la localisation réelle ou placé manuellement sur la carte.
- Choix d'une destination parmi les quartiers de Dakar.
- Calcul d'**itinéraires routiers de test** (polyligne sur les vraies routes, distance et durée) via le **serveur public de démonstration OSRM** ; connexion Internet requise.
- Interface native mobile avec panneau de réservation et bascule Client/Chauffeur.
- Aucune position transmise au serveur pendant la préversion.

**Important :** Ce n'est PAS encore une app de transport commerciale. L'inscription et la connexion natives sont reliées dans le code au backend Cloudflare D1 via Twilio Verify (SMS réel, si les secrets Twilio sont configurés et l'API déployée). Les courses réellement enregistrées, les paiements et le suivi restent désactivés. Ne pas afficher de chauffeurs fictifs comme s'ils étaient réellement disponibles.

## Lancer sur iPhone/Android pour développer

Depuis `mobile/` avec Node.js et une machine pouvant lancer Expo :

```sh
npm install
npx expo start --tunnel
```

Projet aligné sur **Expo SDK 54**, compatible avec la version Expo Go actuellement distribuée dans l'App Store iPhone. Le code ne fonctionne pas simplement en ouvrant l'adresse du Worker dans Safari.

Le bouton `Voir l'itinéraire réel` contacte le serveur de démonstration OSRM. **Ne pas utiliser son API publique pour un service commercial** : avant le lancement, héberger OSRM ou souscrire à un fournisseur de routage et prévoir les limites et coûts.

## Tester depuis un iPhone sans ordinateur (GitHub Codespaces)

1. Depuis GitHub, ouvrir le dépôt `seckdiopka96-cpu/Day-Daw-Rec`.
2. Dans **Code → Codespaces**, sélectionner **Create codespace on main**.
3. Le fichier `.devcontainer/devcontainer.json` installe automatiquement les dépendances du dossier `mobile/` et `@expo/ngrok`.
4. Dans le terminal Codespaces, saisir `cd mobile && npx expo login` et se connecter **avec le même compte Expo** que dans Expo Go, sans publier ses identifiants dans GitHub.
5. Démarrer `npx expo start --tunnel` et ouvrir l'URL Expo produite dans Expo Go.

Codespaces dispose d'un quota gratuit mensuel pour les comptes personnels GitHub, mais il n'est pas illimité ; arrêter le Codespace après les tests. Un serveur Expo actif est indispensable à Expo Go : associer seulement le dépôt GitHub au projet Expo ne publie pas automatiquement une application exécutable.

Projet Expo : propriétaire `diao-tech`, slug `day-daw-rec`, identifiant `a42e0e3b-b7c9-45f7-b9e9-241dec96b474`.

## Validation
```sh
npm install
npm run check
npx expo export --platform ios
```

## Publication
Une application téléchargeable devra être construite et signée séparément pour iPhone et Android (par exemple via Expo EAS Build ou un environnement de développement natif). La publication sur l'App Store/Play Store a des exigences et frais indépendants de Cloudflare.

Le projet conserve le backend `https://day-daw-rec-api.seckdiopka96.workers.dev`, et contient désormais un client d'authentification natif (SMS OTP, session Bearer sauvegardée avec Expo SecureStore). **La réussite des SMS réels dépend de la configuration Twilio et du déploiement de l'API.** Aucune course commerciale n'est encore connectée.

## Connexion Client native

- Deux options : créer un compte (nom et numéro +221) ou se connecter (numéro existant).
- Les SMS passent par Twilio Verify côté Worker ; aucune clé Twilio n'est intégrée à l'app.
- Vérification OTP avec session opaque longue de 256 bits, stockée dans Expo SecureStore (Keychain/Keystore), puis reprise au prochain lancement ; déconnexion révoque la session sur D1.
- Les comptes « client » ne peuvent pas se connecter dans l'application Chauffeur et inversement.
- Le Worker doit être déployé avec les variables `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` comme **secrets Cloudflare**. Ne jamais mettre les identifiants dans GitHub.
- L'app demande la localisation seulement après authentification et le consentement GPS.
- Essais de bout en bout avec de vrais numéros sénégalais indispensables avant la mise en ligne.
