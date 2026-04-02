// ===== MATRICE EISENHOWER — Drag & Drop et gestion des tâches =====

// Stockage local des tâches
let taches = [];
let tacheEnDrag = null;

// Zones affichées dans la matrice (4 quadrants uniquement)
const ZONES_MATRICE = ['urgent_important', 'important', 'urgent', 'neutre'];

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', function () {
    taches = tachesInitiales || [];
    afficherToutesTaches();
});

// ===== AFFICHAGE =====

function afficherToutesTaches() {
    ZONES_MATRICE.forEach(zone => {
        const conteneur = document.getElementById(`zone-${zone}`);
        if (conteneur) conteneur.innerHTML = '';
    });

    taches.forEach(tache => {
        if (ZONES_MATRICE.includes(tache.zone)) {
            placerTacheDansZone(tache);
        }
    });
}

function placerTacheDansZone(tache) {
    const conteneur = document.getElementById(`zone-${tache.zone}`);
    if (!conteneur) return;
    conteneur.appendChild(creerCarteTache(tache));
}

function creerCarteTache(tache) {
    const carte = document.createElement('div');
    carte.className = 'carte-tache';
    carte.id = `carte-${tache.id}`;
    carte.draggable = true;
    carte.dataset.id = tache.id;
    carte.title = tache.titre + (tache.description ? '\n' + tache.description : '');

    carte.addEventListener('dragstart', debuterDrag);
    carte.addEventListener('dragend', finirDrag);

    // Petit point de couleur catégorie
    const classesDot = {
        'Travail': 'cat-dot-travail',
        'Personnel': 'cat-dot-personnel',
        'Santé': 'cat-dot-sante',
        'Autre': 'cat-dot-autre',
    };
    const classeDot = classesDot[tache.categorie] || 'cat-dot-autre';

    // Date d'échéance (format court : jj/mm ou ⚠ Xj)
    let htmlDate = '';
    if (tache.date_echeance) {
        const dateEch = new Date(tache.date_echeance + 'T00:00:00');
        const aujourdhui = new Date();
        aujourdhui.setHours(0, 0, 0, 0);
        const joursRetard = Math.round((aujourdhui - dateEch) / 86400000);
        if (joursRetard > 0) {
            htmlDate = `<span class="carte-tache-date en-retard" title="En retard de ${joursRetard} jour(s)">⚠ ${joursRetard}j</span>`;
        } else {
            const dateFormatee = dateEch.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            htmlDate = `<span class="carte-tache-date">📅 ${dateFormatee}</span>`;
        }
    }

    // Durée (format court : 30m ou 1h30)
    let htmlDuree = '';
    if (tache.duree_estimee) {
        htmlDuree = `<span class="carte-tache-duree">⏱ ${formaterDuree(tache.duree_estimee)}</span>`;
    }

    carte.innerHTML = `
        <span class="carte-cat-dot ${classeDot}"></span>
        <span class="carte-tache-titre">${echapper(tache.titre)}</span>
        <div class="carte-tache-meta">
            ${htmlDate}
            ${htmlDuree}
        </div>
        <div class="carte-tache-actions">
            <button class="btn-action btn-fait-rapide" title="Marquer comme fait"
                    onclick="marquerFaitMatrice(${tache.id}); event.stopPropagation();">✅</button>
            <button class="btn-action btn-modifier" title="Modifier"
                    onclick="ouvrirModification(${tache.id}); event.stopPropagation();">✏</button>
            <button class="btn-action btn-corbeille" title="Corbeille"
                    onclick="deplacerCorbeille(${tache.id}); event.stopPropagation();">🗑</button>
        </div>
    `;

    return carte;
}

// ===== DRAG & DROP =====

function debuterDrag(event) {
    tacheEnDrag = this.dataset.id;
    this.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tacheEnDrag);
}

function finirDrag() {
    this.classList.remove('dragging');
    document.querySelectorAll('.zone.drag-over').forEach(z => z.classList.remove('drag-over'));
}

async function deposerTache(event, zoneElement) {
    event.preventDefault();
    zoneElement.classList.remove('drag-over');

    const idTache = parseInt(event.dataTransfer.getData('text/plain') || tacheEnDrag);
    const nouvelleZone = zoneElement.dataset.zone;

    if (!idTache || !nouvelleZone) return;

    const tache = taches.find(t => t.id === idTache);
    if (!tache || tache.zone === nouvelleZone) return;

    try {
        const reponse = await fetch(`/api/tasks/${idTache}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: nouvelleZone }),
        });

        if (reponse.ok) {
            const resultat = await reponse.json();

            const index = taches.findIndex(t => t.id === idTache);
            if (index !== -1) taches[index] = resultat;

            const ancienneZoneConteneur = document.getElementById(`zone-${tache.zone}`);
            const carte = document.getElementById(`carte-${idTache}`);
            const nouvelleZoneConteneur = document.getElementById(`zone-${nouvelleZone}`);

            if (carte && nouvelleZoneConteneur) {
                if (ancienneZoneConteneur) ancienneZoneConteneur.removeChild(carte);
                nouvelleZoneConteneur.appendChild(creerCarteTache(resultat));
            }

            if (resultat._nouvelle_occurrence) {
                const nouvelleOcc = resultat._nouvelle_occurrence;
                taches.push(nouvelleOcc);
                placerTacheDansZone(nouvelleOcc);
            }
        } else {
            const erreur = await reponse.json();
            alert(erreur.erreur || 'Erreur lors du déplacement.');
        }
    } catch (err) {
        alert('Erreur de connexion au serveur.');
    }
}

// ===== ACTIONS SUR LES TÂCHES =====

function ouvrirModification(id) {
    const tache = taches.find(t => t.id === id);
    if (tache) ouvrirModal(tache);
}

async function marquerFaitMatrice(id) {
    try {
        const reponse = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: 'fait' }),
        });
        if (reponse.ok) {
            // Supprimer la carte de la matrice
            const carte = document.getElementById(`carte-${id}`);
            if (carte) carte.remove();
            taches = taches.filter(t => t.id !== id);
        }
    } catch (err) {
        alert('Erreur de connexion au serveur.');
    }
}

async function deplacerCorbeille(id) {
    if (!confirm('Déplacer cette tâche dans la corbeille ?')) return;

    try {
        const reponse = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: 'corbeille' }),
        });

        if (reponse.ok) {
            const carte = document.getElementById(`carte-${id}`);
            if (carte) carte.remove();
            taches = taches.filter(t => t.id !== id);
        } else {
            const erreur = await reponse.json();
            alert(erreur.erreur || 'Erreur lors du déplacement vers la corbeille.');
        }
    } catch (err) {
        alert('Erreur de connexion au serveur.');
    }
}

// ===== CALLBACK APRÈS SAUVEGARDE =====
// Défini ici comme fallback ; la page dashboard.html l'override pour recharger la page.

function apresModificationTache(tacheMisAJour, estModification) {
    if (estModification) {
        const index = taches.findIndex(t => t.id === tacheMisAJour.id);
        if (index !== -1) {
            taches[index] = tacheMisAJour;
            const ancienneCarte = document.getElementById(`carte-${tacheMisAJour.id}`);
            if (ancienneCarte) ancienneCarte.remove();
            if (ZONES_MATRICE.includes(tacheMisAJour.zone)) {
                placerTacheDansZone(tacheMisAJour);
            }
        }
    } else {
        taches.push(tacheMisAJour);
        if (ZONES_MATRICE.includes(tacheMisAJour.zone)) {
            placerTacheDansZone(tacheMisAJour);
        }
    }
}

// ===== UTILITAIRES =====

function echapper(texte) {
    if (!texte) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(texte));
    return div.innerHTML;
}
