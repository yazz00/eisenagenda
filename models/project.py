from models.task import db
from datetime import datetime


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    couleur = db.Column(db.String(7), nullable=False, default='#3b82f6')  # hex CSS
    icone = db.Column(db.String(10), nullable=True)  # emoji
    date_creation = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    date_modification = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relation vers les tâches
    taches = db.relationship('Task', backref='projet', lazy='dynamic',
                              foreign_keys='Task.projet_id')

    def to_dict(self, avec_stats=False):
        """Convertit le projet en dictionnaire JSON."""
        d = {
            'id': self.id,
            'nom': self.nom,
            'description': self.description,
            'couleur': self.couleur,
            'icone': self.icone,
            'date_creation': self.date_creation.isoformat() if self.date_creation else None,
            'date_modification': self.date_modification.isoformat() if self.date_modification else None,
        }
        if avec_stats:
            taches_actives = self.taches.filter_by_clause = None  # calculé côté route
        return d
