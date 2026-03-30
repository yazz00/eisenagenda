from flask import Blueprint, request, jsonify
from datetime import datetime, date
from models.task import db, Task, ZONES_VALIDES, CATEGORIES_VALIDES, RECURRENCES_VALIDES

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api')


def valider_donnees_tache(donnees, creation=True):
    """Valide les données reçues pour créer ou modifier une tâche."""
    erreurs = []

    # Titre obligatoire lors de la création
    if creation and not donnees.get('titre'):
        erreurs.append("Le titre est obligatoire.")
    elif donnees.get('titre') is not None and len(donnees.get('titre', '').strip()) == 0:
        erreurs.append("Le titre ne peut pas être vide.")

    # Validation de la zone
    zone = donnees.get('zone')
    if zone is not None and zone not in ZONES_VALIDES:
        erreurs.append(f"Zone invalide. Valeurs acceptées : {', '.join(ZONES_VALIDES)}")

    # Validation de la catégorie
    categorie = donnees.get('categorie')
    if categorie is not None and categorie not in CATEGORIES_VALIDES:
        erreurs.append(f"Catégorie invalide. Valeurs acceptées : {', '.join(CATEGORIES_VALIDES)}")

    # Validation de la récurrence
    recurrence = donnees.get('recurrence')
    if recurrence is not None and recurrence not in RECURRENCES_VALIDES:
        erreurs.append(f"Récurrence invalide. Valeurs acceptées : {', '.join(RECURRENCES_VALIDES)}")

    # Validation de la date d'échéance
    date_echeance = donnees.get('date_echeance')
    if date_echeance is not None and date_echeance != '':
        try:
            datetime.strptime(date_echeance, '%Y-%m-%d')
        except ValueError:
            erreurs.append("Format de date invalide. Utilisez le format AAAA-MM-JJ.")

    # Validation de la durée estimée
    duree = donnees.get('duree_estimee')
    if duree is not None and duree != '':
        try:
            duree_int = int(duree)
            if duree_int < 0:
                erreurs.append("La durée estimée doit être un nombre positif.")
        except (ValueError, TypeError):
            erreurs.append("La durée estimée doit être un nombre entier en minutes.")

    return erreurs


@tasks_bp.route('/tasks', methods=['GET'])
def lister_taches():
    """Retourne toutes les tâches (hors corbeille par défaut)."""
    zone = request.args.get('zone')

    if zone:
        if zone not in ZONES_VALIDES:
            return jsonify({'erreur': 'Zone invalide.'}), 400
        taches = Task.query.filter_by(zone=zone).all()
    else:
        # Exclure la corbeille par défaut
        taches = Task.query.filter(Task.zone != 'corbeille').all()

    return jsonify([t.to_dict() for t in taches]), 200


@tasks_bp.route('/tasks/<int:tache_id>', methods=['GET'])
def obtenir_tache(tache_id):
    """Retourne une tâche par son identifiant."""
    tache = db.get_or_404(Task, tache_id)
    return jsonify(tache.to_dict()), 200


@tasks_bp.route('/tasks', methods=['POST'])
def creer_tache():
    """Crée une nouvelle tâche."""
    donnees = request.get_json()
    if not donnees:
        return jsonify({'erreur': 'Corps de la requête JSON manquant.'}), 400

    erreurs = valider_donnees_tache(donnees, creation=True)
    if erreurs:
        return jsonify({'erreurs': erreurs}), 422

    # Conversion de la date d'échéance
    date_echeance = None
    if donnees.get('date_echeance'):
        date_echeance = datetime.strptime(donnees['date_echeance'], '%Y-%m-%d').date()

    # Conversion de la durée
    duree_estimee = None
    if donnees.get('duree_estimee') not in (None, ''):
        duree_estimee = int(donnees['duree_estimee'])

    nouvelle_tache = Task(
        titre=donnees['titre'].strip(),
        description=donnees.get('description', '').strip() or None,
        date_echeance=date_echeance,
        duree_estimee=duree_estimee,
        categorie=donnees.get('categorie', 'Autre'),
        recurrence=donnees.get('recurrence', 'Une fois'),
        zone=donnees.get('zone', 'urgent_important'),
    )

    db.session.add(nouvelle_tache)
    db.session.commit()

    return jsonify(nouvelle_tache.to_dict()), 201


@tasks_bp.route('/tasks/<int:tache_id>', methods=['PUT'])
def modifier_tache(tache_id):
    """Modifie une tâche existante."""
    tache = db.get_or_404(Task, tache_id)
    donnees = request.get_json()
    if not donnees:
        return jsonify({'erreur': 'Corps de la requête JSON manquant.'}), 400

    erreurs = valider_donnees_tache(donnees, creation=False)
    if erreurs:
        return jsonify({'erreurs': erreurs}), 422

    # Mise à jour des champs si présents dans la requête
    if 'titre' in donnees:
        tache.titre = donnees['titre'].strip()

    if 'description' in donnees:
        tache.description = donnees['description'].strip() or None

    if 'date_echeance' in donnees:
        if donnees['date_echeance']:
            tache.date_echeance = datetime.strptime(donnees['date_echeance'], '%Y-%m-%d').date()
        else:
            tache.date_echeance = None

    if 'duree_estimee' in donnees:
        if donnees['duree_estimee'] not in (None, ''):
            tache.duree_estimee = int(donnees['duree_estimee'])
        else:
            tache.duree_estimee = None

    if 'categorie' in donnees:
        tache.categorie = donnees['categorie']

    if 'recurrence' in donnees:
        tache.recurrence = donnees['recurrence']

    # Gestion du changement de zone (sauvegarder la zone précédente si passage en corbeille)
    if 'zone' in donnees:
        nouvelle_zone = donnees['zone']
        if nouvelle_zone == 'corbeille' and tache.zone != 'corbeille':
            tache.zone_precedente = tache.zone
        tache.zone = nouvelle_zone

    tache.date_modification = datetime.utcnow()
    db.session.commit()

    return jsonify(tache.to_dict()), 200


@tasks_bp.route('/tasks/<int:tache_id>', methods=['DELETE'])
def supprimer_tache(tache_id):
    """Supprime définitivement une tâche (seulement si elle est en corbeille)."""
    tache = db.get_or_404(Task, tache_id)

    if tache.zone != 'corbeille':
        return jsonify({'erreur': 'Seules les tâches en corbeille peuvent être supprimées définitivement.'}), 403

    db.session.delete(tache)
    db.session.commit()

    return jsonify({'message': 'Tâche supprimée définitivement.'}), 200


@tasks_bp.route('/tasks/<int:tache_id>/restaurer', methods=['POST'])
def restaurer_tache(tache_id):
    """Restaure une tâche depuis la corbeille vers sa zone d'origine."""
    tache = db.get_or_404(Task, tache_id)

    if tache.zone != 'corbeille':
        return jsonify({'erreur': 'Cette tâche n\'est pas dans la corbeille.'}), 400

    # Retour dans la zone précédente ou dans urgent_important par défaut
    tache.zone = tache.zone_precedente if tache.zone_precedente else 'urgent_important'
    tache.zone_precedente = None
    tache.date_modification = datetime.utcnow()
    db.session.commit()

    return jsonify(tache.to_dict()), 200


@tasks_bp.route('/taches/vider-corbeille', methods=['POST'])
def vider_corbeille():
    """Supprime définitivement toutes les tâches dans la corbeille."""
    nombre = Task.query.filter_by(zone='corbeille').delete()
    db.session.commit()

    return jsonify({'message': f'{nombre} tâche(s) supprimée(s) définitivement.'}), 200
