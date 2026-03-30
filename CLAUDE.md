# EisenAgenda — Contexte pour Claude Code

## Qui suis-je ?
Je suis Mathias (yazz00), développeur débutant apprenant Python/Flask/Docker.
Je travaille sur ZimaOS (Linux), un NAS personnel sur mon réseau local.
J'utilise Claude Code via SSH depuis Claude Desktop sur Windows.

---

## Le projet — EisenAgenda
Un agenda personnel basé sur la matrice d'Eisenhower.
Usage strictement personnel (un seul utilisateur, pas de login).

### Les 6 zones de l'interface
- 🔴 Urgent + Important
- 🔵 Important + Pas urgent
- 🟡 Urgent + Pas important
- ⚫ Pas urgent + Pas important
- ⏳ En cours
- ✅ Fait

### Navigation — Plusieurs pages séparées
- /           → Page Matrice Eisenhower (page principale)
- /calendar   → Calendrier (vue mensuelle + hebdomadaire)
- /dashboard  → Tableau de bord + statistiques
- /trash      → Corbeille des tâches supprimées

---

## Stack technique
- **Backend** : Python 3.11 + Flask
- **Base de données** : SQLite via SQLAlchemy
- **Frontend** : HTML + CSS + JavaScript vanilla
- **Container** : Docker
- **Hébergement** : ZimaOS à l'adresse 192.168.1.70
- **Port** : 5000

---

## Contraintes importantes ZimaOS
⚠️ Le dossier /DATA est en LECTURE SEULE sur ZimaOS.
⚠️ Le HOME réel est /DATA/Documents (pas /DATA).
⚠️ Docker doit être lancé avec : DOCKER_CONFIG=~/Documents/docker-config docker ...

## Commandes Docker sur ZimaOS
```bash
# Builder
DOCKER_CONFIG=~/Documents/docker-config docker build --tag eisenagenda .

# Lancer
DOCKER_CONFIG=~/Documents/docker-config docker run -d -p 5000:5000 --name eisenagenda eisenagenda

# Stopper et supprimer
DOCKER_CONFIG=~/Documents/docker-config docker stop eisenagenda
DOCKER_CONFIG=~/Documents/docker-config docker rm eisenagenda

# Logs
DOCKER_CONFIG=~/Documents/docker-config docker logs eisenagenda
```

---

## Structure du projet
```
eisenagenda/
├── app.py                  → point d'entrée Flask
├── config.py               → configuration
├── requirements.txt        → dépendances Python
├── Dockerfile              → configuration Docker
├── CLAUDE.md               → ce fichier
├── models/
│   └── task.py             → modèle Task (SQLAlchemy)
├── routes/
│   ├── tasks.py            → API CRUD des tâches
│   └── pages.py            → routes des pages
├── templates/
│   ├── base.html           → template de base (navbar)
│   ├── matrix.html         → matrice Eisenhower
│   ├── calendar.html       → calendrier
│   ├── dashboard.html      → tableau de bord
│   └── trash.html          → corbeille
└── static/
    ├── css/
    │   └── style.css
    └── js/
        ├── matrix.js       → drag & drop
        └── calendar.js
```

---

## Modèle de données — Tâche
```python
class Task:
    id              # int, auto
    titre           # string, obligatoire
    description     # text, optionnel
    date_echeance   # date, optionnel
    duree_estimee   # int (minutes), optionnel
    categorie       # enum: Travail / Personnel / Santé / Autre
    recurrence      # enum: Une fois / Quotidien / Hebdomadaire / Mensuel
    zone            # enum: urgent_important / important / urgent /
                    #       neutre / en_cours / fait / corbeille
    date_creation   # datetime, auto
    date_modification # datetime, auto
```

---

## Conventions de code
- Commentaires et noms de variables en **français**
- Code Python en snake_case
- Une fonction = une responsabilité
- Toujours valider les données côté serveur
- Messages d'erreur clairs et en français

---

## Plan de développement
- ✅ Étape 1 — Structure + base de données + API CRUD
- 🔜 Étape 2 — Page Matrice Eisenhower + drag & drop
- 🔜 Étape 3 — Page Calendrier
- 🔜 Étape 4 — Page Tableau de bord
- 🔜 Étape 5 — Page Corbeille
- 🔜 Étape 6 — Améliorations futures (notifications, mobile...)

---

## Décisions de conception
- Sauvegarde **manuelle** pour l'instant (bouton), automatique plus tard
- Tâches supprimées → corbeille (pas de suppression définitive immédiate)
- Pas de système de login (usage solo)
- Design moderne et coloré, responsive (PC + tablette)
