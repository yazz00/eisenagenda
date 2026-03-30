from models.task import db


class ConfigJournee(db.Model):
    """Configuration par défaut de la journée (une seule ligne, id=1)."""
    __tablename__ = 'config_journee'

    id = db.Column(db.Integer, primary_key=True)

    # Réveil et routine matinale
    heure_reveil = db.Column(db.String(5), nullable=False, default='07:00')
    duree_routine_matin = db.Column(db.Integer, nullable=False, default=60)  # minutes

    # Déjeuner
    heure_dejeuner = db.Column(db.String(5), nullable=False, default='12:30')
    duree_dejeuner = db.Column(db.Integer, nullable=False, default=60)  # minutes

    # Dîner
    heure_diner = db.Column(db.String(5), nullable=False, default='19:30')
    duree_diner = db.Column(db.Integer, nullable=False, default=45)  # minutes

    def to_dict(self):
        """Convertit la config en dictionnaire sérialisable JSON."""
        return {
            'heure_reveil': self.heure_reveil,
            'duree_routine_matin': self.duree_routine_matin,
            'heure_dejeuner': self.heure_dejeuner,
            'duree_dejeuner': self.duree_dejeuner,
            'heure_diner': self.heure_diner,
            'duree_diner': self.duree_diner,
        }
