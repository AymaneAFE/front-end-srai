# CLAUDE.md — Projet Copilote IA d'incidents (AIOps)

> Fichier de contexte persistant à fournir à Claude au début de chaque conversation. Il décrit le projet, les décisions d'architecture, les choix actés et les débats en cours. L'objectif est de ne plus avoir à ré-expliquer le fond à chaque échange.

---

## 1. Contexte et objectif du projet

Je conçois une plateforme **AIOps** (Artificial Intelligence for IT Operations) dont le but est d'assister les équipes SRE/Ops dans la gestion des incidents de production. La promesse fonctionnelle est triple :

1. **Réduire le bruit** des systèmes de supervision en corrélant les alertes brutes en incidents exploitables.
2. **Accélérer la résolution** en proposant automatiquement une hypothèse de root cause et des pistes de solution documentées.
3. **Capitaliser les apprentissages** en générant des post-mortems et en enrichissant une base de connaissance réutilisable pour les incidents futurs.

Le système **propose, il n'exécute pas**. Aucune action corrective automatique (pas de rollback, pas de restart, pas de création de ticket automatique) dans la V1. On reste sur de l'assistance humaine — le SRE garde la main.

---

## 2. Statut du projet

- **Phase actuelle :** conception d'architecture, itération sur le diagramme de composants
- **Livrable immédiat :** architecture validée + POC sur un sous-ensemble
- **Contraintes connues :** besoin d'un système simple à démarrer mais qui scale, et dont chaque brique IA est explicable

---

## 3. Architecture cible (version actuelle)

### 3.1 Vue d'ensemble des tiers

Le flux part des sources de supervision et descend vers la couche IA, avec des boucles de feedback vers la base de connaissance.

1. **Sources d'alertes** → Dynatrace, Centreon (webhooks)
2. **Ingestion et enrichissement** → Redis Streams (broker léger) + service de normalisation avec enrichisseurs par source
3. **Corrélation hybride** → Moteur déterministe (règles + topologie + fenêtres temporelles) avec Redis comme state store, et Agent LLM qualificateur qui n'intervient que sur les cas ambigus
4. **Service Incidents** → persistance des incidents validés uniquement (PostgreSQL + API REST)
5. **Orchestrateur IA** → routage vers les agents spécialisés + gestion du dialogue inter-agents
6. **Agents IA spécialisés** → Investigation (root cause), Solutions (propose), Post-Mortem (synthèse)
7. **Couche MCP partagée** → Dynatrace, ELK, GitLab, Salesforce, accessible aux trois agents
8. **Vector Store (RAG)** → quatre namespaces distincts : `incidents_historiques`, `runbooks`, `post_mortems`, `knowledge_base`
9. **Boucles de feedback** → Feedback humain (SRE) vers Vector Store avec tags de confiance + Observabilité LLM (traces, coûts, hallucinations)

### 3.2 Principes architecturaux qui guident les décisions

- **Ne persister que les incidents validés**, pas les alertes brutes. Les alertes restent dans Redis (buffer transitoire), les incidents vont en PostgreSQL (stockage durable).
- **Déterministe par défaut, IA quand nécessaire.** La corrélation est un problème déterministe bien résolu par des règles et de la topologie. On ne paie le coût d'un LLM que quand le déterministe n'arrive pas à trancher.
- **Agents spécialisés, pas monolithes.** Chaque agent a un prompt, des outils et un contexte spécialisés. Un agent qui fait tout est toujours moins bon que trois agents focalisés.
- **Partage de contexte via l'Orchestrateur, pas via couplage direct.** Les agents ne s'appellent pas entre eux directement ; l'Orchestrateur route les échanges.
- **Vector Store avec tags de confiance.** Chaque entrée porte un statut : `generated` (brut), `reviewed` (relu), `validated` (confirmé correct), `corrected` (corrigé par humain). Les retrievals pondèrent en fonction de ce statut. Sans ça, le système apprend de ses propres hallucinations.

---

## 4. Décisions actées

Ces choix ne sont pas à re-débattre sauf si je soulève explicitement le sujet.

### 4.1 Stack et infrastructure

| Choix | Décision |
|---|---|
| Broker | **Redis Streams** (pas Kafka ni RabbitMQ en V1). Volume attendu < 100 alertes/sec, Redis est déjà utilisé pour le state store de corrélation. Migration possible plus tard si besoin. |
| State store de corrélation | Redis avec TTL |
| Persistance incidents | PostgreSQL |
| Vector Store | À choisir, mais probablement Qdrant ou pgvector pour rester sur la stack PG |
| Orchestration d'agents | À trancher (LangGraph, CrewAI, ou custom) |

### 4.2 Approche de corrélation

- **Hybride, pas multi-agents LLM.** Un moteur déterministe traite ~95% des cas, un LLM qualificateur intervient sur les cas ambigus.
- **Critère de bascule** (à finaliser) : confiance du scoring de corrélation < seuil, ou alertes sans lien topologique connu dans la fenêtre.
- Un SRE peut toujours trancher manuellement sur les cas où même le LLM qualificateur hésite.

### 4.3 Gouvernance

- **Mode assistance uniquement.** Pas d'action automatique en V1.
- Toutes les suggestions des agents passent par une revue humaine avant d'être appliquées.
- Les validations/corrections humaines sont capturées et taguées dans le Vector Store.

### 4.4 Feedback et observabilité

Trois boucles distinctes à ne pas confondre :

1. **Dialogue inter-agents** (court terme, automatique) — via l'Orchestrateur, pour qu'un agent puisse demander une clarification à un autre pendant le traitement d'un même incident.
2. **Feedback humain** (moyen terme, validation) — le SRE annote, corrige, valide les outputs des agents. Ces annotations alimentent le Vector Store avec un tag de confiance.
3. **Observabilité système** (long terme, amélioration) — métriques agrégées sur les agents (taux d'acceptation, latence, coût, détection d'hallucinations). Alimente le tuning des prompts.

---

## 5. Débats encore ouverts

Points sur lesquels je n'ai pas encore tranché. Je suis preneur d'avis argumentés.

- **Multi-agents par source pour la corrélation** : mon encadrant a suggéré un agent spécialisé Dynatrace + un agent spécialisé Centreon qui dialoguent. Mon intuition penche pour garder ça en V2, mais reste à valider par les données (taux de cas ambigus observés en V1).
- **Critère précis de "cas ambigu"** à formaliser pour la bascule déterministe → LLM qualificateur.
- **Stratégie de chunking et d'embeddings** pour chaque namespace du Vector Store.
- **Choix du/des LLM** (modèle open-source local vs API cloud). Implications sécurité importantes car les logs ELK peuvent contenir des PII/secrets.
- **Masking/redaction** des données sensibles avant envoi aux agents.
- **Intégration de la sécurité** globale : authentification des agents sur les MCP, audit trail, secret management.

---

## 6. Anti-patterns et pièges connus

Choses que d'autres assistants IA ont tendance à suggérer mais qui ne correspondent pas à ma logique. Merci de ne pas les re-proposer sans argument nouveau.

- **"Ajoutez Kafka dès le début pour anticiper le scale."** → Non. Le volume ne le justifie pas, et Redis Streams couvre les besoins (broker, replay, consumer groups). On migrera si on franchit réellement un seuil.
- **"Faites corréler les alertes par un LLM."** → Non en première intention. Coût, latence et non-déterminisme rendent l'approche inadaptée au flux principal. Le LLM intervient uniquement en qualification sur les cas ambigus.
- **"Les agents peuvent exécuter des actions correctives."** → Non en V1. Mode assistance uniquement, décision arrêtée.
- **"Un seul agent LLM peut tout faire."** → Non. Investigation, Solutions, Post-Mortem ont des contextes et des prompts différents. Séparation des préoccupations.
- **"Stockez tout dans le Vector Store sans tag de confiance."** → Non. Le Vector Store doit distinguer les contenus générés bruts des contenus validés humainement, sinon le système s'empoisonne avec ses propres hallucinations.
- **"Les MCP Tools ne servent qu'à l'agent Investigation."** → Non. L'Agent Solutions a besoin de GitLab, l'Agent Post-Mortem a besoin de tous les outils pour reconstituer la timeline. MCP est une couche partagée.

---

## 7. Glossaire (termes utilisés dans ce projet)

- **AIOps** — Artificial Intelligence for IT Operations, application de l'IA à la supervision et à la gestion d'incidents.
- **Alerte** — événement brut émis par Dynatrace ou Centreon. Fort volume, fort bruit.
- **Incident** — regroupement d'alertes corrélées représentant un problème unique et actionnable. Faible volume, haute valeur.
- **Root cause** — cause racine identifiée d'un incident.
- **Post-mortem** — document d'analyse rétrospective produit après résolution.
- **Runbook** — procédure opérationnelle documentée.
- **MCP (Model Context Protocol)** — protocole standardisé permettant aux agents LLM d'accéder à des outils/APIs externes.
- **RAG (Retrieval-Augmented Generation)** — technique consistant à enrichir un prompt LLM avec des documents récupérés dynamiquement depuis un Vector Store.
- **SRE (Site Reliability Engineer)** — ingénieur responsable de la fiabilité des systèmes en production. Utilisateur cible du copilote.

---

## 8. Conventions de conversation

Comment je veux que tu travailles avec moi sur ce projet.

- **Langue :** français par défaut, même pour les termes techniques usuels. L'anglais est acceptable pour les termes qui n'ont pas de bon équivalent (RAG, agent, prompt, etc.).
- **Ton :** direct, argumenté, sans flatterie. Challenge-moi quand tu penses que je me trompe, mais argumente.
- **Format :** prose structurée par défaut, avec des listes seulement quand c'est vraiment justifié. Pas de bullet points excessifs.
- **Niveau de détail :** profond par défaut. Je préfère une réponse longue et nuancée à une réponse courte et superficielle. Si je veux du bref, je le dirai.
- **Tradeoffs :** quand tu proposes une solution, explicite systématiquement les alternatives envisagées et pourquoi tu les écartes. Je veux voir ton raisonnement, pas juste la conclusion.
- **Incertitude :** si tu n'es pas sûr, dis-le. Ne fabrique pas de certitudes.

---