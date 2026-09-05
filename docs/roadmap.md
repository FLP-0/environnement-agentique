# Feuille de route

## Jalon 1 — socle exécutable

- [x] Projet TypeScript strict et dépendances verrouillées.
- [x] API authentifiée, validation des entrées et création idempotente.
- [x] PostgreSQL, migrations, file réservée atomiquement et événements.
- [x] Traitement de démonstration, annulation et blocage des baux expirés.
- [x] Docker Compose, génération locale des secrets et script de démonstration.
- [x] Tests unitaires et intégration PostgreSQL ; workflow de contrôle Docker.
- [x] Diagnostic manuel SDK Codex préparé, sans activation automatique.

## Jalon 2 — environnement serveur

- [ ] Provisionner le VPS et installer l'accès privé Tailscale.
- [ ] Déployer une version dont la CI a réussi et verrouiller les images par digest.
- [ ] Configurer les sauvegardes chiffrées hors hôte et tester une restauration.
- [ ] Tester la continuité ordinateur éteint et la reprise après redémarrage du VPS.

## Jalon 3 — une vraie tâche de développement

- [ ] Sélectionner le dépôt pilote et définir les commandes de vérification.
- [ ] Isoler l'exécution du code des secrets du contrôleur, de PostgreSQL et du socket Docker.
- [ ] Ajouter l'accès intermédiaire à l'API, un modèle explicite et des limites par appel/tâche.
- [ ] Ajouter l'exécuteur Codex, le renouvellement du bail, l'arrêt effectif et la sauvegarde de session.
- [ ] Enregistrer l'usage observé et le résultat des vérifications, puis rapprocher les coûts facturés.

## Jalon 4 — GitHub et autonomie

- [ ] Installer une GitHub App sur le dépôt pilote avec les droits nécessaires.
- [ ] Importer les issues autorisées et respecter priorités et dépendances.
- [ ] Créer les espaces de travail, branches et PR de façon idempotente.
- [ ] Vérifier la CI sur le dernier commit publié et distinguer PR prête et tâche fusionnée.
- [ ] Ajouter un tableau de bord, les limites de dépense globales et les notifications utiles.
- [ ] Évaluer vingt tâches réelles avant d'ajouter du parallélisme ou du déploiement automatique.
