# DAY DAW REC — application mobile native iOS & Android

Ce dossier contient **une véritable application React Native**, séparée du site web et du Worker Cloudflare. Elle affiche une carte Apple Maps sur iOS et Google Maps sur Android avec `react-native-maps`.

## Fonctionnalités natives déjà codées
- Carte interactive plein écran centrée sur Dakar et permettant de zoomer et déplacer la carte.
- Permission GPS native iPhone/Android et point de départ calculé par la localisation réelle ou placé manuellement sur la carte.
- Choix d'une destination parmi les quartiers de Dakar.
- Calcul d'**itinéraires routiers de test** (polyligne sur les vraies routes, distance et durée) via le **serveur public de démonstration OSRM** ; connexion Internet requise.
- Interface native mobile avec panneau de réservation et bascule Client/Chauffeur.
- Aucune position transmise au serveur pendant la préversion.

**Important :** Ce n'est PAS encore une app de transport commerciale. Les courses réellement enregistrées, les vrais chauffeurs, les paiements, le suivi et l'inscription sécurisée seront connectés au backend Cloudflare D1 après avoir terminé et testé les flux. Ne pas afficher de chauffeurs fictifs comme s'ils étaient réellement disponibles.

## Lancer sur iPhone/Android pour développer

Depuis `mobile/` avec Node.js et une machine pouvant lancer Expo :

```sh
npm install
npx expo start
```

Ouvrir avec **Expo Go compatible SDK 57**, ou utiliser un développement build selon les versions iOS. Le code ne fonctionne pas simplement en ouvrant l'adresse du Worker dans Safari.

Le bouton `Voir l'itinéraire réel` contacte le serveur de démonstration OSRM. **Ne pas utiliser son API publique pour un service commercial** : avant le lancement, héberger OSRM ou souscrire à un fournisseur de routage et prévoir les limites et coûts.

## Validation
```sh
npm install
npm run check
npx expo export --platform ios
```

## Publication
Une application téléchargeable devra être construite et signée séparément pour iPhone et Android (par exemple via Expo EAS Build ou un environnement de développement natif). La publication sur l'App Store/Play Store a des exigences et frais indépendants de Cloudflare.

Le projet conserve le backend `https://day-daw-rec-api.seckdiopka96.workers.dev`, mais **aucune authentification mobile ni course commerciale n'est encore connectée**.
