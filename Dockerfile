FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code source
COPY . .

# Créer le répertoire pour la base de données SQLite
RUN mkdir -p /data

EXPOSE 5000

CMD ["python", "app.py"]
