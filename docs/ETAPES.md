# Étapes et état réel de DAY DAW REC

1. ✅ Dépôt GitHub appartenant au propriétaire.
2. ✅ Worker Cloudflare `day-daw-rec-api` connecté à D1 `day-daw-rec-db`.
3. ✅ GitHub lié au Worker, **builds désactivés** pendant la préparation.
4. ✅ Code source adapté pour comptes client/chauffeur, SMS OTP Twilio, GPS, attribution et cycle de vie des courses.
5. ✅ Migrations `0001_init.sql` et `0002_real_booking.sql` appliquées avec succès à D1 distante le 13 novembre 2026 (GitHub Actions, aucune migration restante).
6. ✅ Mode démonstration gratuit ajouté sur GitHub : client et chauffeur, trajets simulés, sans SMS, sans appel API, sans paiement ni modification D1.\n7. ⏳ Activer Twilio Verify pour les vrais utilisateurs et tester en environnement de préproduction.
8. ⏳ Vérification des chauffeurs et procédure de support.
9. ⏳ Cartographie routière, tarification réelle, paiement, notifications et conformité locale.
10. ⏳ Vérifier les parcours sur deux téléphones avant ouverture au public.

Le code GitHub n'est **pas** encore déployé en production. Le Worker actuellement en ligne reste inchangé jusqu'à réactivation des builds ou déploiement explicite.

Le mode démo ne crée ni compte, ni position GPS serveur, ni course réelle. Il permet de développer et tester gratuitement avant l'achat éventuel d'un service SMS. Il n'est pas encore accessible sur l'URL Cloudflare tant que le code GitHub n'est pas déployé.
