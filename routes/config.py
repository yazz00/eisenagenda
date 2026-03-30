import re
from flask import Blueprint, request, jsonify
from models.task import db
from models.config_journee import ConfigJournee

config_bp = Blueprint('config', __name__, url_prefix='/api')

HEURE_REGEX = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')


def obtenir_ou_creer_config():
    """Retourne la config par défaut, la crée si elle n'existe pas."""
    config = ConfigJournee.query.get(1)
    if not config:
        config = ConfigJournee(id=1)
        db.session.add(config)
        db.session.commit()
    return config


def valider_heure(valeur, champ):
    """Valide le format HH:MM d'une heure."""
    if valeur and not HEURE_REGEX.match(str(valeur)):
        return f"{champ} doit être au format HH:MM (ex: 07:30)."
    return None


@config_bp.route('/config/journee', methods=['GET'])
def obtenir_config_journee():
    """Retourne la configuration par défaut de la journée."""
    config = obtenir_ou_creer_config()
    return jsonify(config.to_dict()), 200


@config_bp.route('/config/journee', methods=['PUT'])
def modifier_config_journee():
    """Met à jour la configuration par défaut de la journée."""
    donnees = request.get_json()
    if not donnees:
        return jsonify({'erreur': 'Corps de la requête JSON manquant.'}), 400

    erreurs = []

    # Validation des heures
    for champ in ['heure_reveil', 'heure_dejeuner', 'heure_diner']:
        erreur = valider_heure(donnees.get(champ), champ)
        if erreur:
            erreurs.append(erreur)

    # Validation des durées
    for champ in ['duree_routine_matin', 'duree_dejeuner', 'duree_diner']:
        valeur = donnees.get(champ)
        if valeur is not None:
            try:
                if int(valeur) < 0:
                    erreurs.append(f"{champ} doit être positif.")
            except (ValueError, TypeError):
                erreurs.append(f"{champ} doit être un entier en minutes.")

    if erreurs:
        return jsonify({'erreurs': erreurs}), 422

    config = obtenir_ou_creer_config()

    if 'heure_reveil' in donnees:
        config.heure_reveil = donnees['heure_reveil']
    if 'duree_routine_matin' in donnees:
        config.duree_routine_matin = int(donnees['duree_routine_matin'])
    if 'heure_dejeuner' in donnees:
        config.heure_dejeuner = donnees['heure_dejeuner']
    if 'duree_dejeuner' in donnees:
        config.duree_dejeuner = int(donnees['duree_dejeuner'])
    if 'heure_diner' in donnees:
        config.heure_diner = donnees['heure_diner']
    if 'duree_diner' in donnees:
        config.duree_diner = int(donnees['duree_diner'])

    db.session.commit()
    return jsonify(config.to_dict()), 200
