# Consignes de review

Ce fichier guide la review automatique des PR. Les règles générales du dépôt sont dans `AGENTS.md`.

## Format

- Écrire en français.
- Signaler seulement les vrais bugs et ce qui casse une garantie, un test ou la sécurité. Pas de remarques de style, de nommage ou de formatage : `tsc` strict et la CI s'en chargent.
- Un commentaire par problème, sur la ligne concernée, avec le scénario concret qui échoue. Regrouper les occurrences d'un même problème en un seul commentaire.
- Ne pas résumer le diff quand la description de la PR le fait déjà.
- Si rien n'est bloquant, le dire en une ligne.

## Bloquant

1. **Transitions atomiques.** Tout changement de `status` et l'insertion de son événement dans `task_events` se font dans la même `transaction()`. Un `UPDATE` de statut hors transaction, ou sans événement, est bloquant.
2. **Baux.** `heartbeat` et `finish` exigent le bon `lease_token`, `status = 'running'` et `lease_expires_at > clock_timestamp()`. Tout chemin qui laisse un worker expiré ou annulé enregistrer un résultat est bloquant. Une tâche expirée passe en `blocked` et n'est jamais relancée automatiquement.
3. **Données internes.** `lease_token`, `fingerprint` et `idempotency_key` ne sortent jamais de l'API : toute tâche renvoyée passe par `publicTask()`.
4. **Secrets dans les journaux.** Aucun log ni message d'erreur ne contient de clé API, de token Bearer, de mot de passe, de `DATABASE_URL` ou de corps de requête complet. Vérifier aussi les `console.*`.
5. **Authentification.** Toute nouvelle route sous `/v1` reste derrière le hook Bearer, avec une comparaison en temps constant. Seuls `/healthz` et `/readyz` sont publics et ne renvoient qu'un état.
6. **Migrations.** Un fichier existant de `migrations/` n'est jamais modifié : son empreinte est vérifiée au démarrage et la modification bloque le déploiement. Toute évolution passe par un nouveau fichier numéroté.
7. **Mode démo.** La file reste en `mode = 'demo'`. L'API et le worker n'appellent aucun modèle, n'exécutent aucune commande et ne publient rien sur GitHub. `src/codex-diagnostic.ts` reste une commande manuelle : sandbox en lecture seule, sans réseau, avec délai maximal.
8. **Conteneurs.** Pas de socket Docker monté, utilisateur non root, système de fichiers en lecture seule, PostgreSQL sans port publié sur l'hôte, API liée à `127.0.0.1`.
9. **Validation.** Le corps, la query et les en-têtes utilisés sont validés par Zod avec des bornes ; corps et query en `.strict()`.

## À signaler sans bloquer

- Dépendances : versions exactes, sans `^` ni `~`, et `package-lock.json` modifié avec `package.json`.
- Actions GitHub épinglées par SHA de commit.
- Un changement de file, d'API ou de SQL sans test d'intégration couvrant le cas modifié (concurrence, annulation, résultat tardif).
- Une affirmation de `README.md` ou `docs/architecture.md` que la PR rend fausse.

## Ignorer

- `package-lock.json` ligne par ligne, `dist/`, `node_modules/`.
- `docs/roadmap.md` et `docs/installation-plan.md` : ce sont des plans, pas des faits à vérifier.
- La formulation des docs, sauf affirmation fausse.
- Les propositions de refactorisation sans bug associé.
