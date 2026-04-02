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

    carte.addEventListener('dragstart', debuterDrag);
    carte.addEventListener('dragend', finirDrag);

    // Badge catégorie
    const classesBadge = {
        'Travail': 'badge-travail',
        'Personnel': 'badge-personnel',
        'Santé': 'badge-sante',
        'Autre': 'badge-autre',
    };
    const classeBadge = classesBadge[tache.categorie] || 'badge-autre';

    // Date d'échéance
    let htmlDate = '';
    if (tache.date_echeance) {
        const dateEch = new Date(tache.date_echeance + 'T00:00:00');
        const aujourd_hui = new Date();
        aujourd_hui.setHours(0, 0, 0, 0);
        const enRetard = dateEch < aujourd_hui;
        const dateFormatee = dateEch.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        htmlDate = `<span class="carte-tache-date ${enRetard ? 'en-retard' : ''}">
            📅 ${enRetard ? '⚠ ' : ''}${dateFormatee}
        </span>`;
    }

    // Durée estimée
    let htmlDuree = '';
    if (tache.duree_estimee) {
        const heures = Math.floor(tache.duree_estimee / 60);
        const minutes = tache.duree_estimee % 60;
        htmlDuree = `<span class="carte-tache-duree">⏱ ${
            heures > 0 ? `${heures}h${String(minutes).padStart(2, '0')}` : `${minutes} min`
        }</span>`;
    }

    carte.innerHTML = `
        <div class="carte-tache-titre">${echapper(tache.titre)}</div>
        <div class="carte-tache-meta">
            <span class="badge ${classeBadge}">${echapper(tache.categorie)}</span>
            ${htmlDate}
            ${htmlDuree}
        </div>
        <div class="carte-tache-actions">
            <button class="btn-action btn-fait-rapide" title="Marquer comme fait"
                    onclick="marquerFaitMatrice(${tache.id}); event.stopPropagation();">
                ✅
            </button>
            <button class="btn-action btn-modifier"
                    onclick="ouvrirModification(${tache.id}); event.stopPropagation();">
                ✏ Modifier
            </button>
            <button class="btn-action btn-corbeille"
                    onclick="deplacerCorbeille(${tache.id}); event.stopPropagation();">
                🗑
            </button>
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
