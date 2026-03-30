from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# Valeurs autorisées pour les zones Eisenhower
ZONES_VALIDES = [
    'urgent_important',
    'important',
    'urgent',
    'neutre',
    'en_cours',
    'fait',
    'corbeille'
]

# Valeurs autorisées pour les catégories
CATEGORIES_VALIDES = ['Travail', 'Personnel', 'Santé', 'Autre']

# Valeurs autorisées pour la récurrence
RECURRENCES_VALIDES = ['Une fois', 'Quotidien', 'Hebdomadaire', 'Mensuel']


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    titre = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    date_echeance = db.Column(db.Date, nullable=True)
    duree_estimee = db.Column(db.Integer, nullable=True)  # en minutes
    categorie = db.Column(db.String(50), nullable=False, default='Autre')
    recurrence = db.Column(db.String(50), nullable=False, default='Une fois')
    zone = db.Column(db.String(50), nullable=False, default='urgent_important')
    zone_precedente = db.Column(db.String(50), nullable=True)  # pour restaurer depuis la corbeille
    heure_debut = db.Column(db.String(5), nullable=True)  # "HH:MM" — positionnement sur la timeline
    date_creation = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    date_modification = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def to_dict(self):
        """Convertit la tâche en dictionnaire sérialisable JSON."""
        return {
            'id': self.id,
            'titre': self.titre,
            'description': self.description,
            'date_echeance': self.date_echeance.isoformat() if self.date_echeance else None,
            'duree_estimee': self.duree_estimee,
            'categorie': self.categorie,
            'recurrence': self.recurrence,
            'zone': self.zone,
            'zone_precedente': self.zone_precedente,
            'heure_debut': self.heure_debut,
            'date_creation': self.date_creation.isoformat() if self.date_creation else None,
            'date_modification': self.date_modification.isoformat() if self.date_modification else None,
        }
