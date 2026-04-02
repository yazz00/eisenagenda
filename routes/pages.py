import json
from datetime import datetime, date, timedelta
from flask import Blueprint, render_template
from models.task import db, Task
from models.config_journee import ConfigJournee
from models.project import Project

pages_bp = Blueprint('pages', __name__)


@pages_bp.route('/')
def page_accueil():
    """Redirection page d'accueil → Planning du jour."""
    from flask import redirect
    return redirect('/calendar')


@pages_bp.route('/matrix')
def page_matrice():
    """Page Matrice Eisenhower."""
    taches = Task.query.filter(Task.zone != 'corbeille').all()
    taches_json = json.dumps([t.to_dict() for t in taches], ensure_ascii=False)
    return render_template('matrix.html', taches_json=taches_json)


@pages_bp.route('/calendar')
def page_calendrier():
    """Page Calendrier — vues Jour, Semaine, Mois."""
    taches = Task.query.filter(Task.zone != 'corbeille').all()
    taches_json = json.dumps([t.to_dict() for t in taches], ensure_ascii=False)

    config = ConfigJournee.query.get(1)
    if not config:
        config = ConfigJournee(id=1)
        db.session.add(config)
        db.session.commit()
    config_json = json.dumps(config.to_dict(), ensure_ascii=False)

    return render_template('calendar.html', taches_json=taches_json, config_json=config_json)


@pages_bp.route('/dashboard')
def page_tableau_de_bord():
    """Page Tableau de bord avec statistiques."""
    aujourd_hui = date.today()
    dans_3_jours = aujourd_hui + timedelta(days=3)

    # Tâches urgentes d'aujourd'hui
    urgentes_auj = Task.query.filter(
        Task.zone == 'urgent_important',
        Task.date_echeance == aujourd_hui
    ).all()

    # Tâches en cours
    en_cours = Task.query.filter_by(zone='en_cours').all()

    # Tâches à venir dans les 3 prochains jours (non corbeille, non fait)
    a_venir = Task.query.filter(
        Task.zone.notin_(['corbeille', 'fait']),
        Task.date_echeance > aujourd_hui,
        Task.date_echeance <= dans_3_jours
    ).order_by(Task.date_echeance).all()

    # Temps total estimé pour aujourd'hui (tâches urgentes + en cours)
    taches_auj = Task.query.filter(
        Task.zone.notin_(['corbeille', 'fait']),
        Task.date_echeance == aujourd_hui
    ).all()
    temps_total = sum(t.duree_estimee for t in taches_auj if t.duree_estimee)

    # Statistiques de la semaine (7 derniers jours)
    il_y_a_7_jours = datetime.utcnow().replace(hour=0, minute=0, second=0) - timedelta(days=7)
    taches_completees_semaine = Task.query.filter(
        Task.zone == 'fait',
        Task.date_modification >= il_y_a_7_jours
    ).count()
    taches_creees_semaine = Task.query.filter(
        Task.date_creation >= il_y_a_7_jours
    ).count()

    # Répartition par catégorie (toutes tâches actives)
    categories = ['Travail', 'Personnel', 'Santé', 'Autre']
    repartition_categories = {}
    total_actives = Task.query.filter(Task.zone != 'corbeille').count()
    for cat in categories:
        nb = Task.query.filter(Task.categorie == cat, Task.zone != 'corbeille').count()
        repartition_categories[cat] = {
            'nombre': nb,
            'pourcentage': round((nb / total_actives * 100) if total_actives > 0 else 0)
        }

    # Répartition par zone (toutes tâches actives)
    zones = {
        'urgent_important': '🔴 Urgent + Important',
        'important': '🔵 Important',
        'urgent': '🟡 Urgent',
        'neutre': '⚫ Neutre',
        'en_cours': '⏳ En cours',
        'fait': '✅ Fait',
    }
    repartition_zones = {}
    for zone_key, zone_label in zones.items():
        nb = Task.query.filter_by(zone=zone_key).count()
        repartition_zones[zone_key] = {
            'label': zone_label,
            'nombre': nb,
            'pourcentage': round((nb / total_actives * 100) if total_actives > 0 else 0)
        }

    # Tâche la plus urgente (date la plus proche, zone urgent_important)
    tache_urgente = Task.query.filter(
        Task.zone == 'urgent_important',
        Task.date_echeance.isnot(None)
    ).order_by(Task.date_echeance).first()

    # Progression du jour (tâches faites / total avec date aujourd'hui)
    total_auj = Task.query.filter(Task.date_echeance == aujourd_hui).count()
    faites_auj = Task.query.filter(
        Task.zone == 'fait',
        Task.date_echeance == aujourd_hui
    ).count()
    progression_jour = round((faites_auj / total_auj * 100) if total_auj > 0 else 0)

    return render_template(
        'dashboard.html',
        urgentes_auj=urgentes_auj,
        en_cours=en_cours,
        a_venir=a_venir,
        temps_total=temps_total,
        taches_completees_semaine=taches_completees_semaine,
        taches_creees_semaine=taches_creees_semaine,
        repartition_categories=repartition_categories,
        repartition_zones=repartition_zones,
        tache_urgente=tache_urgente,
        progression_jour=progression_jour,
        total_actives=total_actives,
        aujourd_hui=aujourd_hui,
    )


@pages_bp.route('/today')
def page_ma_journee_redirect():
    """Redirige /today vers /calendar (vue fusionnée)."""
    from flask import redirect
    return redirect('/calendar')


@pages_bp.route('/today_legacy')
def page_ma_journee():
    """Page Ma journée — timeline verticale."""
    aujourd_hui = date.today()

    # Tâches du jour avec heure de début (planifiées sur la timeline)
    taches_planifiees = Task.query.filter(
        Task.zone != 'corbeille',
        Task.date_echeance == aujourd_hui,
        Task.heure_debut.isnot(None)
    ).order_by(Task.heure_debut).all()

    # Tâches du jour sans heure (panneau "non planifiées")
    taches_non_planifiees = Task.query.filter(
        Task.zone != 'corbeille',
        Task.date_echeance == aujourd_hui,
        Task.heure_debut.is_(None)
    ).all()

    # Configuration de la journée
    config = ConfigJournee.query.get(1)
    if not config:
        config = ConfigJournee(id=1)
        db.session.add(config)
        db.session.commit()

    taches_planifiees_json = json.dumps(
        [t.to_dict() for t in taches_planifiees], ensure_ascii=False
    )
    taches_non_planifiees_json = json.dumps(
        [t.to_dict() for t in taches_non_planifiees], ensure_ascii=False
    )
    config_json = json.dumps(config.to_dict(), ensure_ascii=False)

    return render_template(
        'today.html',
        taches_planifiees_json=taches_planifiees_json,
        taches_non_planifiees_json=taches_non_planifiees_json,
        config_json=config_json,
        aujourd_hui=aujourd_hui,
    )


@pages_bp.route('/recurrence')
def page_recurrence():
    """Page Récurrence — tâches répétitives."""
    taches_quotidien = Task.query.filter(
        Task.recurrence == 'Quotidien', Task.zone != 'corbeille'
    ).order_by(Task.date_echeance).all()
    taches_hebdo = Task.query.filter(
        Task.recurrence == 'Hebdomadaire', Task.zone != 'corbeille'
    ).order_by(Task.date_echeance).all()
    taches_mensuel = Task.query.filter(
        Task.recurrence == 'Mensuel', Task.zone != 'corbeille'
    ).order_by(Task.date_echeance).all()

    return render_template(
        'recurrence.html',
        taches_quotidien_json=json.dumps([t.to_dict() for t in taches_quotidien], ensure_ascii=False),
        taches_hebdo_json=json.dumps([t.to_dict() for t in taches_hebdo], ensure_ascii=False),
        taches_mensuel_json=json.dumps([t.to_dict() for t in taches_mensuel], ensure_ascii=False),
    )


@pages_bp.route('/projects')
def page_projets():
    """Page Projets — arbre des tâches par projet."""
    projets = Project.query.order_by(Project.date_creation.desc()).all()
    projets_data = []
    for p in projets:
        d = p.to_dict()
        taches_actives = Task.query.filter_by(projet_id=p.id) \
            .filter(Task.zone != 'corbeille').all()
        d['nb_taches'] = len(taches_actives)
        d['nb_faites'] = sum(1 for t in taches_actives if t.zone == 'fait')
        projets_data.append(d)
    return render_template(
        'projects.html',
        projets_json=json.dumps(projets_data, ensure_ascii=False),
    )


@pages_bp.route('/trash')
def page_corbeille():
    """Page Corbeille — tâches supprimées."""
    taches_corbeille = Task.query.filter_by(zone='corbeille').order_by(
        Task.date_modification.desc()
    ).all()
    return render_template('trash.html', taches=taches_corbeille)
