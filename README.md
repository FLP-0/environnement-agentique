# Environnement agentique

Un contrôleur personnel pour faire avancer des tâches de développement sur un serveur, même lorsque l'ordinateur est éteint.

**Version 0.1 : fondations et démonstration persistante.** Cette version gère des tâches dans PostgreSQL et vérifie leur traitement avec un worker de démonstration. Elle ne développe pas encore de code et ne publie pas de pull requests automatiquement. Le diagnostic Codex est une commande manuelle séparée.

## Démarrer la démonstration

Prérequis : Git, Node.js 24 LTS, Docker Engine et Docker Compose. Aucune clé OpenAI ni connexion GitHub n'est nécessaire pour cette démonstration.

```sh
git clone https://github.com/FLP-0/environnement-agentique.git
cd environnement-agentique
# Si vous évaluez une PR, sélectionner sa branche avant de continuer.
npm run setup
docker compose up --build -d --wait
npm run demo
```

`setup` crée `.env` avec deux secrets aléatoires et des droits restreints ; il conserve un fichier existant. Docker démarre PostgreSQL, applique les migrations, puis lance l'API et le worker. Le script `demo` crée une tâche et affiche son résultat simulé. Il ne consomme aucun token.

L'API est liée à **127.0.0.1:3000**. Pour un accès distant, ajouter un accès privé tel que Tailscale. Le tableau de bord graphique sera développé dans un jalon suivant.

```sh
curl http://127.0.0.1:3000/readyz
docker compose ps
docker compose logs --tail=50 api worker
docker compose stop
docker compose start
```

Les données survivent à l'arrêt des services et à `docker compose down`. L'option `--volumes` supprime la base : elle est réservée au nettoyage d'un environnement de test jetable.

## Fonctionnalités présentes

- Création idempotente, consultation paginée et annulation des tâches.
- Réservation atomique par un seul worker et priorité de 0 à 100.
- Jetons de réservation privés : un worker annulé ou expiré ne peut pas enregistrer de résultat.
- Historique des transitions conservé dans PostgreSQL.
- Blocage explicite d'une tâche dont la réservation a expiré, pour éviter une répétition non contrôlée.
- Configuration Docker et migrations versionnées, contrôles de santé, limites de ressources.
- Tests unitaires, tests d'intégration PostgreSQL et contrôle Docker dans GitHub Actions.

Les limites et garanties sont détaillées dans [l'architecture](docs/architecture.md). L'activation d'une exécution réelle, la gestion des dépenses, l'intégration GitHub et les sauvegardes automatisées figurent dans la [feuille de route](docs/roadmap.md).

## API

Toutes les routes `/v1` exigent `Authorization: Bearer <API_TOKEN>`. Le token reste dans `.env` ; ne pas le copier dans une issue ou un log.

| Méthode | Route | Fonction |
|---|---|---|
| GET | `/healthz` | Santé du processus, sans authentification |
| GET | `/readyz` | Disponibilité de la base et du schéma, sans authentification |
| POST | `/v1/tasks` | Créer une tâche, avec l'en-tête `Idempotency-Key` |
| GET | `/v1/tasks?limit=20&offset=0` | Consulter les tâches, 100 au maximum par page |
| GET | `/v1/tasks/:id` | Consulter une tâche |
| GET | `/v1/tasks/:id/events?after=0` | Consulter 100 événements au maximum ; `after` est l'identifiant du dernier événement reçu |
| POST | `/v1/tasks/:id/cancel` | Annuler une tâche prête, active ou bloquée |

Corps d'une création :

```json
{
  "title": "Vérifier le premier circuit",
  "objective": "Tester la file persistante en mode démonstration.",
  "priority": 0
}
```

Une même clé et un même contenu renvoient la même tâche. Réutiliser la clé avec un autre contenu renvoie HTTP 409. Le mode est fixé à `demo` ; aucun champ ne permet d'envoyer une commande shell à l'API.

## Développer et vérifier

```sh
npm ci
npm run check
```

Cette commande vérifie les types, les tests unitaires et la compilation. Les tests d'intégration exigent une base PostgreSQL dédiée accessible via `TEST_DATABASE_URL` :

```sh
# Définir TEST_DATABASE_URL vers une base PostgreSQL de test.
npm run test:integration
```

Les tests créent un schéma unique, puis le suppriment. Ils ne tronquent pas les tables de l'application. Ils couvrent notamment les créations concurrentes, la réservation concurrente, l'annulation et les résultats tardifs.

Pour exécuter les services hors Docker, définir `DATABASE_URL` et `API_TOKEN`, puis appliquer les migrations et compiler :

```sh
npm run migrate
npm run build
npm start
# Dans un second terminal, avec DATABASE_URL :
npm run worker
```

Seuls `setup` et `demo` lisent `.env` directement. Les autres commandes attendent des variables d'environnement ; le fichier d'exemple Compose ne publie pas le port de PostgreSQL sur l'hôte.

## Diagnostic manuel Codex — optionnel et payant

Le SDK `@openai/codex-sdk` est une dépendance de développement (version exacte, fixée dans le lockfile) : il est absent de l'image Docker, et le script de diagnostic n'est pas compilé dans `dist/`. Le diagnostic de lecture se lance donc hors conteneur, après `npm ci`. Il n'est relié ni à l'API ni au worker.

Configurer `OPENAI_API_KEY` et `CODEX_MODEL` dans l'environnement de cette commande, puis :

```sh
npm run codex:diagnostic -- /chemin/vers/un/depot-fiable
```

Le diagnostic demande une analyse courte, utilise une sandbox en lecture seule, désactive la recherche web et limite la durée à deux minutes. Il utilise un répertoire Codex temporaire supprimé à la fin ; son identifiant de session est informatif et n'est pas conservé pour une reprise.

Cette commande est destinée à un dépôt de confiance dans un environnement dédié. Une sandbox en lecture seule n'isole pas à elle seule les secrets d'un exécuteur. L'isolation et l'accès intermédiaire à l'API pour des tâches non surveillées restent à implémenter. Aucun plafond monétaire n'est encore appliqué au diagnostic, et aucun appel réel n'est effectué par les tests ou la CI.

Références : [SDK Codex](https://learn.chatgpt.com/docs/codex-sdk), [authentification et automatisation](https://learn.chatgpt.com/docs/non-interactive-mode).

## Suite du projet

Suivre le [plan d'installation](docs/installation-plan.md), puis la [feuille de route](docs/roadmap.md). Le prochain jalon consiste à valider ce socle sur un VPS et à construire un exécuteur Codex isolé pour une première tâche réelle.
