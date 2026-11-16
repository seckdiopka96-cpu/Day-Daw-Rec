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
- La connexion par OTP est désormais intégrée au code, mais sa disponibilité réelle dépend de Twilio Verify et du déploiement Worker. Validation des documents, statut en ligne, attribution de trajets, navigation, paiements et suivi en arrière-plan restent indisponibles.
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

## Inscription / connexion sécurisées

- Inscription chauffeur : nom, téléphone sénégalais (+221), modèle de voiture, immatriculation et OTP via Twilio.
- Connexion chauffeur existant : téléphone et OTP, sans ressaisir les informations du véhicule.
- Le serveur conserve le statut **non validé** après création ; seuls les opérateurs autorisés pourront valider le chauffeur après contrôle des pièces.
- La session native est enregistrée avec Expo SecureStore et peut être révoquée par déconnexion ; pas de clés Twilio dans l'application.
- Configuration requise dans Cloudflare Workers (secrets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`) et déploiement API avant les tests avec SMS réels.
