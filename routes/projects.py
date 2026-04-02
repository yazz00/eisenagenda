from flask import Blueprint, request, jsonify
from datetime import datetime
from models.task import db, Task
from models.project import Project

projects_bp = Blueprint('projects', __name__, url_prefix='/api')


# ============================================================
# UTILITAIRES
# ============================================================

def construire_arbre(taches):
    """Construit l'arborescence à partir d'une liste plate de tâches."""
    par_id = {}
    for t in taches:
        d = t.to_dict()
        d['sous_taches'] = []
        par_id[t.id] = d

    racines = []
    for noeud in par_id.values():
        pid = noeud['parent_id']
        if pid and pid in par_id:
            par_id[pid]['sous_taches'].append(noeud)
        else:
            racines.append(noeud)

    # Trier les racines et sous-tâches par date d'échéance
    def trier_noeuds(noeuds):
        noeuds.sort(key=lambda n: n['date_echeance'] or '9999-99-99')
        for n in noeuds:
            trier_noeuds(n['sous_taches'])

    trier_noeuds(racines)
    return racines


def valider_projet(donnees, creation=True):
    """Valide les données d'un projet."""
    erreurs = []
    if creation and not donnees.get('nom', '').strip():
        erreurs.append("Le nom du projet est obligatoire.")
    elif donnees.get('nom') is not None and len(donnees.get('nom', '').strip()) == 0:
        erreurs.append("Le nom ne peut pas être vide.")
    couleur = donnees.get('couleur')
    if couleur and (len(couleur) != 7 or not couleur.startswith('#')):
        erreurs.append("La couleur doit être au format hexadécimal (#RRGGBB).")
    return erreurs


# ============================================================
# LISTE DES PROJETS
# ============================================================

@projects_bp.route('/projects', methods=['GET'])
def lister_projets():
    """Retourne tous les projets avec statistiques."""
    projets = Project.query.order_by(Project.date_creation.desc()).all()
    resultat = []
    for p in projets:
        d = p.to_dict()
        taches_actives = Task.query.filter_by(projet_id=p.id) \
            .filter(Task.zone != 'corbeille').all()
        d['nb_taches'] = len(taches_actives)
        d['nb_faites'] = sum(1 for t in taches_actives if t.zone == 'fait')
        resultat.append(d)
    return jsonify(resultat), 200


# ============================================================
# CRÉER UN PROJET
# ============================================================

@projects_bp.route('/projects', methods=['POST'])
def creer_projet():
    donnees = request.get_json()
    if not donnees:
        return jsonify({'erreur': 'Corps JSON manquant.'}), 400

    erreurs = valider_projet(donnees)
    if erreurs:
        return jsonify({'erreurs': erreurs}), 422

    p = Project(
        nom=donnees['nom'].strip(),
        description=donnees.get('description', '').strip() or None,
        couleur=donnees.get('couleur', '#3b82f6'),
        icone=donnees.get('icone', '📁'),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


# ============================================================
# DÉTAIL D'UN PROJET
# ============================================================

@projects_bp.route('/projects/<int:projet_id>', methods=['GET'])
def obtenir_projet(projet_id):
    p = Project.query.get_or_404(projet_id)
    d = p.to_dict()
    taches_actives = Task.query.filter_by(projet_id=projet_id) \
        .filter(Task.zone != 'corbeille').all()
    d['nb_taches'] = len(taches_actives)
    d['nb_faites'] = sum(1 for t in taches_actives if t.zone == 'fait')
    return jsonify(d), 200


# ============================================================
# MODIFIER UN PROJET
# ============================================================

@projects_bp.route('/projects/<int:projet_id>', methods=['PUT'])
def modifier_projet(projet_id):
    p = Project.query.get_or_404(projet_id)
    donnees = request.get_json()
    if not donnees:
        return jsonify({'erreur': 'Corps JSON manquant.'}), 400

    erreurs = valider_projet(donnees, creation=False)
    if erreurs:
        return jsonify({'erreurs': erreurs}), 422

    if 'nom' in donnees:
        p.nom = donnees['nom'].strip()
    if 'description' in donnees:
        p.description = donnees.get('description', '').strip() or None
    if 'couleur' in donnees:
        p.couleur = donnees['couleur']
    if 'icone' in donnees:
        p.icone = donnees['icone']

    p.date_modification = datetime.utcnow()
    db.session.commit()
    return jsonify(p.to_dict()), 200


# ============================================================
# SUPPRIMER UN PROJET
# ============================================================

@projects_bp.route('/projects/<int:projet_id>', methods=['DELETE'])
def supprimer_projet(projet_id):
    p = Project.query.get_or_404(projet_id)
    # Les tâches associées gardent leurs données, projet_id → NULL
    Task.query.filter_by(projet_id=projet_id).update({'projet_id': None})
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Projet supprimé.'}), 200


# ============================================================
# ARBRE COMPLET D'UN PROJET
# ============================================================

@projects_bp.route('/projects/<int:projet_id>/tree', methods=['GET'])
def arbre_projet(projet_id):
    p = Project.query.get_or_404(projet_id)
    taches = Task.query.filter_by(projet_id=projet_id) \
        .filter(Task.zone != 'corbeille').all()
    arbre = construire_arbre(taches)
    return jsonify({
        'projet': p.to_dict(),
        'taches': arbre,
    }), 200


# ============================================================
# DÉPLACER UNE TÂCHE (changer parent_id / projet_id)
# ============================================================

@projects_bp.route('/tasks/<int:tache_id>/deplacer', methods=['PUT'])
def deplacer_tache(tache_id):
    tache = Task.query.get_or_404(tache_id)
    donnees = request.get_json()

    nouveau_parent_id = donnees.get('parent_id')
    nouveau_projet_id = donnees.get('projet_id')

    # Vérifier qu'on ne crée pas de cycle (le nouveau parent ne doit pas
    # être un descendant de la tâche déplacée)
    if nouveau_parent_id:
        courant_id = nouveau_parent_id
        visites = set()
        while courant_id:
            if courant_id == tache_id:
                return jsonify({'erreur': 'Cycle détecté dans l\'arborescence.'}), 422
            if courant_id in visites:
                break
            visites.add(courant_id)
            ancetre = Task.query.get(courant_id)
            courant_id = ancetre.parent_id if ancetre else None

    tache.parent_id = nouveau_parent_id
    if nouveau_projet_id is not None:
        tache.projet_id = nouveau_projet_id
    tache.date_modification = datetime.utcnow()
    db.session.commit()
    return jsonify(tache.to_dict()), 200
