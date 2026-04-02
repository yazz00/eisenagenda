from flask import Flask
from config import Config
from models.task import db
from routes.tasks import tasks_bp
from routes.pages import pages_bp
from routes.config import config_bp
from routes.projects import projects_bp


def migrer_schema(app):
    """Ajoute les nouvelles colonnes à la base existante (migration manuelle SQLite)."""
    with app.app_context():
        from sqlalchemy import text
        migrations = [
            "ALTER TABLE tasks ADD COLUMN heure_debut VARCHAR(5)",
            "ALTER TABLE tasks ADD COLUMN auto_regenerer BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE config_journee ADD COLUMN gouter_actif BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE config_journee ADD COLUMN heure_gouter VARCHAR(5) NOT NULL DEFAULT '16:30'",
            "ALTER TABLE config_journee ADD COLUMN duree_gouter INTEGER NOT NULL DEFAULT 30",
            "ALTER TABLE tasks ADD COLUMN projet_id INTEGER REFERENCES projects(id)",
            "ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id)",
        ]
        for migration in migrations:
            try:
                db.session.execute(text(migration))
                db.session.commit()
            except Exception:
                db.session.rollback()
                pass  # colonne déjà existante


def create_app():
    """Fabrique d'application Flask."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialiser la base de données
    db.init_app(app)

    # Enregistrer les blueprints
    app.register_blueprint(tasks_bp)
    app.register_blueprint(pages_bp)
    app.register_blueprint(config_bp)
    app.register_blueprint(projects_bp)

    # Créer les tables si elles n'existent pas
    with app.app_context():
        # Import des modèles pour que SQLAlchemy les connaisse
        from models.config_journee import ConfigJournee
        from models.project import Project
        db.create_all()

    # Appliquer les migrations de schéma
    migrer_schema(app)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
