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
    """Redirection vers la vue d'ensemble (matrice + dashboard fusionnés)."""
    from flask import redirect
    return redirect('/dashboard')


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
    """Page Tableau de bord — Focus, Retards, Backlog."""
    aujourd_hui = date.today()

    # ── Tâche focus : zone la plus prioritaire, retards d'abord ──
    # Les tâches SANS date ne deviennent jamais le focus (elles restent dans le backlog)
    zones_priorite = ['urgent_important', 'important', 'urgent', 'neutre']
    tache_focus = None

    # 1) Retards (date dépassée) par ordre de priorité de zone
    for zone in zones_priorite:
        t = Task.query.filter(
            Task.zone == zone,
            Task.date_echeance.isnot(None),
            Task.date_echeance <= aujourd_hui
        ).order_by(Task.date_echeance.asc()).first()
        if t:
            tache_focus = t
            break

    # 2) Sinon : tâches avec date à venir (prochaine échéance)
    if not tache_focus:
        for zone in zones_priorite:
            t = Task.query.filter(
                Task.zone == zone,
                Task.date_echeance.isnot(None),
                Task.date_echeance > aujourd_hui
            ).order_by(Task.date_echeance.asc()).first()
            if t:
                tache_focus = t
                break

    # ── Retards : date passée, pas fait ni corbeille ──
    retards = Task.query.filter(
        Task.zone.notin_(['fait', 'corbeille']),
        Task.date_echeance.isnot(None),
        Task.date_echeance < aujourd_hui
    ).order_by(Task.date_echeance.asc()).all()

    # Exclure la tâche focus des retards (déjà mise en avant)
    if tache_focus:
        retards = [t for t in retards if t.id != tache_focus.id]

    # ── Backlog : sans date d'échéance, pas fait ni corbeille ──
    backlog = Task.query.filter(
        Task.zone.notin_(['fait', 'corbeille']),
        Task.date_echeance.is_(None)
    ).order_by(Task.date_creation.asc()).all()

    if tache_focus:
        backlog = [t for t in backlog if t.id != tache_focus.id]

    # Projets pour enrichir l'affichage
    projets = {p.id: p for p in Project.query.all()}

    # Toutes les tâches actives pour la matrice Eisenhower
    toutes_taches = Task.query.filter(Task.zone.notin_(['corbeille'])).all()
    taches_json = json.dumps([t.to_dict() for t in toutes_taches], ensure_ascii=False)

    return render_template(
        'dashboard.html',
        tache_focus=tache_focus,
        retards=retards,
        backlog=backlog,
        projets=projets,
        taches_json=taches_json,
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
