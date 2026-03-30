import os


class Config:
    # Clé secrète pour les sessions Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'eisenagenda-dev-key')

    # Base de données SQLite dans le volume Docker /data
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:////data/eisenagenda.db'
    )

    # Désactiver les notifications de modification SQLAlchemy
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Mode debug (désactivé par défaut en production)
    DEBUG = os.environ.get('DEBUG', 'False') == 'True'
