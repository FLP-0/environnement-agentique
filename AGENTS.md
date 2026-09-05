# Consignes du projet

Ce dépôt construit un contrôleur agentique personnel. Le premier jalon fonctionne en démonstration ; il ne modifie aucun dépôt et ne publie aucune PR automatiquement.

- TypeScript strict, Node.js 24 LTS, PostgreSQL 18. Conserver package-lock.json et les versions exactes des dépendances.
- Lire README.md et docs/architecture.md avant de modifier le circuit des tâches.
- Appliquer les migrations avec un nouveau fichier SQL ; ne pas réécrire une migration déjà déployée.
- Toute transition de tâche et son événement doivent être atomiques. Les résultats d'un worker expiré ou annulé doivent être refusés.
- Ne jamais journaliser les clés API, tokens HTTP, mots de passe, URL de connexion ou contenu complet des requêtes.
- Le contrôleur et les exécuteurs de code doivent avoir des accès distincts. Ne pas monter le socket Docker de l'hôte dans un exécuteur.
- Ne pas activer une exécution réelle dans la file de démonstration. Le diagnostic Codex est une commande manuelle séparée et payante.
- Exécuter npm run check ; pour les changements de file, API ou SQL, exécuter aussi npm run test:integration avec TEST_DATABASE_URL vers une base de test.
- Documenter les fonctionnalités prêtes, les limites et les vérifications réellement effectuées.
