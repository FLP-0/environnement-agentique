**Plan d’installation d’un environnement agentique de développement**

Objectif : traiter un backlog de développement sur un serveur, même lorsque l’ordinateur personnel est éteint, avec résultats vérifiables, état persistant et suivi des coûts. Plan préparé le 5 septembre 2026. Il décrit les travaux à réaliser ; le serveur et les services ne sont pas encore installés.

Hypothèses de départ : un utilisateur, un dépôt GitHub pilote, projets compilables sous Linux, un travail actif à la fois. Pour iOS/macOS, prévoir un exécuteur Mac distant pour compiler et tester les composants Apple. GitLab peut remplacer GitHub, moyennant adaptation du connecteur.

Le setup comprend deux chantiers : installer les composants existants et développer le contrôleur qui les relie. Le SDK Codex ne fournit pas à lui seul le backlog, le tableau de bord, les budgets ou la reprise de toutes les opérations métier.

**1. Préparer les comptes et le dépôt pilote**

- [ ] Choisir le fournisseur du VPS et une région européenne.
- [ ] Préparer un projet OpenAI API dédié et sa facturation. Conserver la clé dans un gestionnaire de secrets ; ne pas l’inscrire dans Git, un prompt ou les logs.
- [ ] Créer un dépôt privé pour le contrôleur et sélectionner un dépôt applicatif pilote.
- [ ] Créer un compte Tailscale pour l’accès privé depuis l’ordinateur et le téléphone.
- [ ] Définir quelques tâches pilotes avec résultat attendu, critères de réussite et commandes de vérification.

Validation : les comptes sont accessibles, les commandes du dépôt pilote fonctionnent déjà dans un environnement propre et les tâches ont des critères vérifiables.

**2. Provisionner le serveur**

- [ ] Créer un VPS Ubuntu 24.04 LTS, x86-64, avec 4 vCPU, 8 Go RAM et environ 80–100 Go SSD. C’est un dimensionnement initial à valider sur les builds réels.
- [ ] Installer les mises à jour et créer un compte administrateur avec une clé SSH.
- [ ] Installer Tailscale sur le serveur et les appareils de consultation. Vérifier le nouvel accès avant de restreindre l’ancien accès SSH.
- [ ] Définir les règles d’accès du réseau privé. Réserver l’administration à tes appareils autorisés.
- [ ] Garder PostgreSQL sur un réseau interne ; exposer le tableau de bord uniquement via l’accès privé.

Validation : connexion depuis un second appareil, redémarrage du VPS puis reconnexion. Le service ne dépend d’aucun tunnel maintenu par ton ordinateur personnel.

Référence : [installation Tailscale](https://tailscale.com/docs/how-to/quickstart).

**3. Installer le socle d’exécution**

- [ ] Installer Git, puis Docker Engine et le plugin Docker Compose depuis le dépôt APT officiel de Docker.
- [ ] Utiliser Node.js 24 LTS dans les images de l’application et de l’exécuteur. Installer une version locale sur le serveur seulement si le workflow de construction le nécessite.
- [ ] Préparer une image PostgreSQL 18 avec stockage persistant, contrôle de disponibilité et migrations de schéma.
- [ ] Verrouiller les versions des dépendances et des images retenues après validation.
- [ ] Prévoir redémarrage automatique des services, limites de mémoire/CPU, rotation des logs et nettoyage des espaces de travail terminés.

Après installation, vérifier Docker avec `sudo docker run --rm hello-world` et Compose avec `docker compose version`.

Docker peut rendre un port publié accessible malgré certaines règles UFW : déclarer explicitement les interfaces et réseaux autorisés, puis vérifier l’accès depuis l’extérieur. [Installation Docker sur Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Node.js 24 est une branche LTS dans la [liste officielle des versions](https://nodejs.org/en/about/previous-releases).

**4. Préparer les accès GitHub et OpenAI**

- [ ] Créer une GitHub App installée uniquement sur le dépôt pilote.
- [ ] Donner les permissions nécessaires : lecture des métadonnées, lecture/écriture du contenu et des pull requests, lecture/écriture des issues si le contrôleur les met à jour, lecture des checks et des résultats Actions selon les endpoints utilisés.
- [ ] Garder la clé privée de l’application et les jetons de publication côté contrôleur. Demander la permission Workflows seulement si l’agent doit modifier les workflows.
- [ ] Appliquer les règles de branche choisies : pour le pilote, publication des résultats dans une branche et une pull request ; critères de fusion à définir séparément.
- [ ] Prévoir un intermédiaire d’accès à l’API pour que les tests, dépendances et scripts du dépôt ne puissent pas lire la clé OpenAI. Cet intermédiaire conserve la clé et limite les requêtes à la mission concernée.

Validation : le contrôleur peut lire une issue, lire la CI et publier une branche/PR sur le dépôt pilote. Un script exécuté dans l’espace de travail ne peut pas lire les secrets du contrôleur ni accéder au socket Docker de l’hôte.

Références : [permissions GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), [authentification Codex](https://learn.chatgpt.com/docs/auth), [automatisation Codex et séparation des secrets](https://learn.chatgpt.com/docs/non-interactive-mode).

**5. Faire fonctionner une première tâche Codex**

- [ ] Initialiser le projet TypeScript du contrôleur et installer `@openai/codex-sdk`, avec version exacte et fichier de verrouillage.
- [ ] Préparer l’exécuteur avec le runtime Codex, Git et les dépendances nécessaires au dépôt pilote. Vérifier la compatibilité SDK/runtime.
- [ ] Configurer explicitement le modèle, le répertoire de travail, la sandbox et le traitement des opérations non autorisées pendant une exécution sans surveillance.
- [ ] Tester une lecture simple du dépôt, puis une petite modification vérifiable dans un environnement jetable.
- [ ] Enregistrer l’identifiant de session, le commit de départ, les événements, l’usage disponible et les fichiers produits.

Commande de dépendance, à lancer dans le projet TypeScript initialisé :

```sh
npm install --save-exact @openai/codex-sdk
```

Validation : une tâche produit un changement correct et ses vérifications ; une session enregistrée peut être reprise. La reprise d’une session Codex sera complétée à l’étape suivante par la reprise des opérations du contrôleur. [Documentation SDK](https://learn.chatgpt.com/docs/codex-sdk).

**6. Développer le contrôleur et sa file de tâches**

- [ ] Ajouter les données persistantes : projets, tâches, tentatives, sessions, coûts, événements et références des livrables.
- [ ] Prévoir les états : en attente, prête, en cours, en vérification, résultat prêt, bloquée, échouée et annulée. Distinguer une PR prête d’une modification fusionnée.
- [ ] Réserver une tâche atomiquement en PostgreSQL, avec bail renouvelé, pour éviter les exécutions concurrentes accidentelles.
- [ ] À chaque redémarrage, rapprocher la base, les processus encore actifs et les branches/PR existantes avant de relancer une opération.
- [ ] Utiliser un identifiant stable par tâche pour éviter les doublons de branche, de publication et de PR.
- [ ] Ajouter pause, annulation, échéance, nombre maximal de tentatives et détection des répétitions sans progrès.
- [ ] Définir une limite de dépense par tâche et par période. Réserver une marge pour les appels en cours et limiter chaque appel ; une alerte de facturation du fournisseur ne remplace pas ce contrôle.

Validation : interruption volontaire pendant une tâche, puis reprise sans perte des résultats ni deuxième PR. Une tâche déjà terminée ne repart pas au redémarrage. Une limite de durée ou de dépense empêche le démarrage d’un nouvel appel.

**7. Relier le backlog à l’exécution**

- [ ] Utiliser un label dédié, par exemple `agent-ready`, posé sur les issues autorisées.
- [ ] Faire consulter ces issues par le contrôleur toutes les 60 secondes, avec pagination, gestion des quotas et temporisation en cas d’erreur. Cette consultation utilise l’API GitHub, sans appel au modèle.
- [ ] Choisir la prochaine tâche selon la priorité, les dépendances et les capacités du serveur.
- [ ] Préparer une copie de travail isolée à partir d’un commit connu. Avec des worktrees Git, conserver l’accès aux métadonnées nécessaires dans l’environnement autorisé ; un worktree seul n’est pas une sandbox.
- [ ] Exécuter la tâche, puis les commandes de vérification déclarées par le projet.
- [ ] Publier le diff via le contrôleur, créer ou mettre à jour une PR, attendre les vérifications requises sur le dernier commit et enregistrer le résultat.

Validation : une issue marquée prête aboutit à une PR avec description, commit vérifié, résultats de tests, limites éventuelles et coût disponible. Une erreur de test ne devient pas un succès simplement parce que l’agent annonce avoir terminé.

**8. Organiser le contexte et mesurer les tokens**

- [ ] Écrire un fichier `AGENTS.md` court : conventions, commandes et contraintes propres au projet.
- [ ] Versionner les décisions d’architecture et garder les journaux volumineux hors du contexte courant.
- [ ] Charger les fichiers, compétences et connecteurs selon la tâche ; préférer les sorties de commandes ciblées.
- [ ] Exploiter la gestion du contexte et du cache disponible dans le moteur choisi. Ne pas supposer que tous les réglages de l’API sont exposés par le SDK Codex.
- [ ] Enregistrer les tokens d’entrée, de sortie et de cache lorsqu’ils sont disponibles, ainsi que la version du modèle, les tentatives et la durée. Ne pas compter deux fois les tokens de raisonnement inclus dans les sorties.
- [ ] Distinguer coûts estimés et coûts rapprochés de la facturation. Inclure les reprises, la revue et les éventuels outils payants.

Validation : il est possible de comparer plusieurs tâches sur leur coût total et leur réussite. Les économies de contexte sont évaluées en conservant les preuves nécessaires aux vérifications.

**9. Ajouter le tableau de bord et l’exploitation**

- [ ] Développer une interface simple : tâches, progression, coût, liens vers PR, pause et annulation. Protéger les actions et les sessions.
- [ ] Exposer cette interface à tes appareils via Tailscale Serve ; configurer les droits d’accès du réseau privé.
- [ ] Ajouter des notifications uniquement pour résultat disponible, échec ou décision nécessaire, sur le canal que tu choisiras.
- [ ] Prévoir des contrôles de disponibilité, espace disque, file bloquée et consommation.
- [ ] Sauvegarder quotidiennement PostgreSQL et les livrables nécessaires vers un stockage extérieur au VPS, avec chiffrement et rétention définie. Sauvegarder séparément les éléments de configuration et de secrets nécessaires à une restauration.
- [ ] Tester une restauration dans une instance distincte. Tester les mises à jour sur une tâche témoin et conserver un chemin de retour pour l’application et ses migrations.

Validation : les résultats restent consultables depuis le téléphone lorsque l’ordinateur est éteint. Une restauration retrouve les tâches et leurs livrables. [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [sauvegardes PostgreSQL](https://www.postgresql.org/docs/current/backup-dump.html).

**10. Passer du pilote à l’autonomie**

- [ ] Exécuter trois tâches simples avec surveillance et corriger les défauts du contrôleur.
- [ ] Lancer une tâche bornée depuis le serveur, éteindre l’ordinateur et vérifier le résultat depuis un autre appareil.
- [ ] Tester un redémarrage, une erreur réseau, un dépassement de limite et une annulation.
- [ ] Évaluer ensuite une vingtaine de tâches représentatives : bugs, petites fonctionnalités, tests et revues. Comparer aussi le temps passé à intervenir et les défauts découverts après coup.
- [ ] Ajouter un deuxième travail concurrent lorsque les mesures de mémoire et de CPU le permettent. Augmenter les ressources en fonction des builds observés.
- [ ] Ajouter modèles spécialisés, sous-agents ou autorisations de fusion/déploiement seulement quand les résultats et le périmètre de travail le justifient.

Le pilote est terminé lorsque : une issue autorisée produit une PR vérifiée sans intervention, l’exécution continue ordinateur éteint, l’état résiste à un redémarrage, les coûts sont suivis, les limites sont appliquées et les sauvegardes sont restaurables. Cela valide le fonctionnement du système ; la fiabilité sur les tâches complexes reste à mesurer.

**Ordre de réalisation et livrables**

| Jalon | Livrable | Dépendance |
|---|---|---|
| A | VPS accessible et socle installé | Comptes et accès |
| B | Première tâche Codex vérifiée | A + accès API + dépôt pilote |
| C | File persistante et reprise | B + contrôleur développé |
| D | Issue vers PR avec vérification | C + connecteur GitHub |
| E | Tableau de bord, limites, sauvegardes | D |
| F | Pilote autonome validé | E + essais de panne et tâches réelles |

Fichiers à produire pendant l’implémentation : configuration Docker Compose, images du contrôleur et de l’exécuteur, migrations SQL, connecteur GitHub, interface SDK Codex, règles d’exécution et de budget, interface web, scripts de sauvegarde/restauration, procédure de déploiement et de retour à la version précédente. Ce plan ne présuppose pas que ces fichiers existent déjà.
