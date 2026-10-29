# Consignes du projet

Ce dépôt construit un contrôleur agentique personnel. Le premier jalon fonctionne en démonstration ; il ne modifie aucun dépôt et ne publie aucune PR automatiquement.

## Où lire

Lire uniquement les fichiers utiles à la tâche. Ne pas parcourir `node_modules/`, `dist/` ni le contenu de `package-lock.json`.

| Besoin | Fichiers |
| --- | --- |
| Vue générale, garanties, limites | `README.md`, `docs/architecture.md` |
| API, authentification, validation | `src/app.ts`, `src/server.ts`, `src/config.ts` |
| File, états, transactions, baux | `src/tasks.ts`, `src/database.ts`, `migrations/` |
| Worker de démonstration | `src/worker.ts`, `src/worker-main.ts` |
| Conteneurs et scripts | `compose.yaml`, `Dockerfile`, `scripts/` |
| Diagnostic Codex manuel | `src/codex-diagnostic.ts` |
| Tests et CI | `tests/`, `.github/workflows/ci.yml` |
| Suite du projet (plans, pas des faits établis) | `docs/roadmap.md`, `docs/installation-plan.md` |

## Règles

- TypeScript strict, Node.js 24 LTS, PostgreSQL 18. Conserver package-lock.json et les versions exactes des dépendances.
- Lire README.md et docs/architecture.md avant de modifier le circuit des tâches.
- Appliquer les migrations avec un nouveau fichier SQL ; ne pas réécrire une migration déjà déployée.
- Toute transition de tâche et son événement doivent être atomiques. Les résultats d'un worker expiré ou annulé doivent être refusés.
- Ne jamais journaliser les clés API, tokens HTTP, mots de passe, URL de connexion ou contenu complet des requêtes.
- Le contrôleur et les exécuteurs de code doivent avoir des accès distincts. Ne pas monter le socket Docker de l'hôte dans un exécuteur.
- Ne pas activer une exécution réelle dans la file de démonstration. Le diagnostic Codex est une commande manuelle séparée et payante.
- Documenter les fonctionnalités prêtes, les limites et les vérifications réellement effectuées.

## Vérifier

- `npm ci`, puis `npm run check` (types, tests unitaires, compilation).
- Pour les changements de file, API ou SQL : aussi `npm run test:integration` avec `TEST_DATABASE_URL` vers une base PostgreSQL de test dédiée.
- Ne pas lancer `npm run codex:diagnostic` : il appelle un modèle payant.
- Si une vérification ne peut pas tourner dans l'environnement (pas de PostgreSQL, pas de Docker), l'écrire dans le résumé au lieu de la déclarer réussie.
