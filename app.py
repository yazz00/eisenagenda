from flask import Flask
from config import Config
from models.task import db
from routes.tasks import tasks_bp
from routes.pages import pages_bp


def create_app():
    """Fabrique d'application Flask."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialiser la base de données
    db.init_app(app)

    # Enregistrer les blueprints
    app.register_blueprint(tasks_bp)
    app.register_blueprint(pages_bp)

    # Créer les tables si elles n'existent pas
    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
