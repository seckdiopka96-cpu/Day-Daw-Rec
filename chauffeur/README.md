# DAY DAW REC Chauffeur — application native distincte

Cette application React Native/Expo (iOS + Android) est **indépendante du binaire Client** :
- Client : `mobile/` — ID Android/iOS `com.diaotech.daydawrec`.
- Chauffeur : `chauffeur/` — ID Android/iOS `com.diaotech.daydawrec.chauffeur`.
- Les deux rejoindront le même backend propriétaire Cloudflare Workers + D1.

## Ce qui fonctionne aujourd'hui
- Carte routière native centrée sur Dakar (Apple Maps sur iOS / Google Maps sur Android via react-native-maps).
- Demande explicite de permission GPS, localisation réelle en premier plan et recentrage si l'appareil est dans la région de Dakar.
- Tableau de bord chauffeur sobre, état hors ligne, raccourcis courses/documents/revenus/profil.
- Chiffres à zéro, **aucun faux chauffeur, aucun revenu inventé**. Aucun GPS n'est envoyé au serveur.

## Non opérationnel pour l'instant
- Connexion chauffeur par OTP, validation des documents, statut en ligne, attribution de trajets, navigation, paiements et suivi en arrière-plan.
- Le bouton « Activer les courses » explique les conditions manquantes : il ne connecte pas le chauffeur au serveur tant que l'authentification et la validation ne sont pas terminées.
- Pas de demande de permission GPS en arrière-plan ; cette permission sera à justifier séparément avant le lancement.

## Développement et tests
Depuis un ordinateur ou un GitHub Codespace, dans `chauffeur/` :
```bash
npm install
npm run check
npx expo start --tunnel
```
Pour préparer un APK de test, utiliser Expo EAS Build après avoir créé le **projet Expo Chauffeur distinct** (ne pas réutiliser le projectId Expo de l'application Client).

Cette préversion ne doit pas être proposée au public comme service de VTC actif. Avant exploitation au Sénégal : vérification légale et réglementaire, validation des chauffeurs/assurances, contrôle de sécurité et test avec de vrais appareils.
