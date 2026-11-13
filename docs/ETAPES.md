# Étapes et état réel de DAY DAW REC

1. ✅ Dépôt GitHub appartenant au propriétaire.
2. ✅ Worker Cloudflare `day-daw-rec-api` connecté à D1 `day-daw-rec-db`.
3. ✅ GitHub lié au Worker, **builds désactivés** pendant la préparation.
4. ✅ Code source adapté pour comptes client/chauffeur, SMS OTP Twilio, GPS, attribution et cycle de vie des courses.
5. ✅ Migration `0002_real_booking.sql` créée sur GitHub (à appliquer sur D1 distante).
6. ⏳ Activer Twilio Verify, appliquer les migrations et tester en environnement de préproduction.
7. ⏳ Vérification des chauffeurs et procédure de support.
8. ⏳ Cartographie routière, tarification réelle, paiement, notifications et conformité locale.
9. ⏳ Vérifier les parcours sur deux téléphones avant ouverture au public.

Le code GitHub n'est **pas** encore déployé en production. Le Worker actuellement en ligne reste inchangé jusqu'à réactivation des builds ou déploiement explicite.
