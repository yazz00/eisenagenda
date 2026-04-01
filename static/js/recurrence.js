// ===== PAGE RÉCURRENCE =====

const MOIS_NOMS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const ZONES_LABELS = {
    urgent_important: { label: '🔴 Urgent + Important', classe: 'zone-urgent-important' },
    important:        { label: '🔵 Important',          classe: 'zone-important' },
    urgent:           { label: '🟡 Urgent',             classe: 'zone-urgent' },
    neutre:           { label: '⚫ Neutre',             classe: 'zone-neutre' },
    en_cours:         { label: '⏳ En cours',           classe: 'zone-en-cours' },
    fait:             { label: '✅ Fait',               classe: 'zone-fait' },
};

// État
let tachesParType = {
    Quotidien:    [...tachesQuotidien],
    Hebdomadaire: [...tachesHebdo],
    Mensuel:      [...tachesMensuel],
};
let datesSelectionnees = new Set();
let dateMiniCal = new Date();

// ============================================================
// INITIALISATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Afficher les champs récurrence dans le modal
    document.getElementById('groupe-recurrence').style.display = 'block';

    rendreListeRecurrence('Quotidien',    'liste-quotidien');
    rendreListeRecurrence('Hebdomadaire', 'liste-hebdo');
    rendreListeRecurrence('Mensuel',      'liste-mensuel');
    rendreMiniCal();

    // Gestionnaires pour les sélecteurs de jours (modal)
    document.querySelectorAll('.jour-picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('selectionne');
            if (typeof mettreAJourChampsDates === 'function') mettreAJourChampsDates();
        });
    });
    document.querySelectorAll('.jour-mois-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('selectionne'));
    });
});

// ============================================================
// LISTES DE TÂCHES
// ============================================================

function rendreListeRecurrence(type, idConteneur) {
    const conteneur = document.getElementById(idConteneur);
    const taches = tachesParType[type];

    if (taches.length === 0) {
        conteneur.innerHTML = '<p class="recurrence-vide">Aucune tâche. Clique sur "+ Ajouter" pour en créer une.</p>';
        return;
    }

    conteneur.innerHTML = '';
    taches.forEach(t => conteneur.appendChild(creerCarteRecurrence(t)));
}

function creerCarteRecurrence(tache) {
    const zone = ZONES_LABELS[tache.zone] || { label: tache.zone, classe: '' };
    const carte = document.createElement('div');
    carte.className = 'recurrence-carte';
    carte.dataset.id = tache.id;

    const prochaine = tache.date_echeance
        ? formaterDate(tache.date_echeance)
        : '—';

    carte.innerHTML = `
        <div class="recurrence-carte-gauche">
            <div class="recurrence-carte-titre">${echapper(tache.titre)}</div>
            <div class="recurrence-carte-meta">
                <span class="zone-chip ${zone.classe}">${zone.label}</span>
                ${tache.date_echeance ? `<span class="recurrence-carte-date">📅 ${prochaine}</span>` : ''}
                ${tache.duree_estimee ? `<span>⏱ ${tache.duree_estimee} min</span>` : ''}
            </div>
        </div>
        <div class="recurrence-carte-droite">
            <label class="auto-regen-label" title="Recréer automatiquement quand marquée Fait">
                <input type="checkbox" class="auto-regen-cb" data-id="${tache.id}"
                    ${tache.auto_regenerer ? 'checked' : ''}
                    onchange="toggleAutoRegen(${tache.id}, this.checked)">
                🔄 Auto
            </label>
            <button class="btn btn-secondaire btn-sm" onclick="ouvrirModal(${JSON.stringify(tache).replace(/"/g, '&quot;')})">✏</button>
            <button class="btn btn-danger btn-sm" onclick="supprimerTache(${tache.id})">🗑</button>
        </div>
    `;
    return carte;
}

// ============================================================
// AFFICHAGE CONDITIONNEL DES CHAMPS DATES
// ============================================================

function mettreAJourChampsDates() {
    const recurrence  = document.getElementById('tache-recurrence').value;
    const autoRegen   = document.getElementById('tache-auto-regenerer').checked;
    const groupeDateFin      = document.getElementById('groupe-date-fin');
    const groupeJoursSemaine = document.getElementById('groupe-jours-semaine');
    const groupeJoursMois    = document.getElementById('groupe-jours-mois');

    // Récurrence classique = type ≠ "Une fois" ET pas d'auto-régénération
    const recurrenceClassique = recurrence !== 'Une fois' && !autoRegen;

    // Date de fin : visible en mode classique
    groupeDateFin.style.display = recurrenceClassique ? 'block' : 'none';

    // Sélecteur de jours de la semaine : Hebdomadaire classique uniquement
    groupeJoursSemaine.style.display =
        (recurrence === 'Hebdomadaire' && recurrenceClassique) ? 'block' : 'none';

    // Sélecteur de jours du mois : Mensuel classique uniquement
    groupeJoursMois.style.display =
        (recurrence === 'Mensuel' && recurrenceClassique) ? 'block' : 'none';

    // Ajuster le submit selon le mode
    if (!recurrenceClassique) {
        document.getElementById('form-tache').onsubmit = sauvegarderTache;
    } else if (recurrence === 'Hebdomadaire') {
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceHebdo;
    } else if (recurrence === 'Mensuel') {
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceMensuel;
    } else {
        // Quotidien classique
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceClassique;
    }
}

// ============================================================
// OUVRIR MODAL AVEC RÉCURRENCE PRÉ-SÉLECTIONNÉE
// ============================================================

function ouvrirModalRecurrence(typeRecurrence) {
    ouvrirModal(null, null, null);
    setTimeout(() => {
        // Masquer le sélecteur de type (déjà connu via la section)
        document.getElementById('groupe-type-recurrence').style.display = 'none';
        document.getElementById('tache-recurrence').value = typeRecurrence;
        document.getElementById('tache-auto-regenerer').checked = false;
        mettreAJourChampsDates();
    }, 10);
}

// ============================================================
// TOGGLE AUTO-RÉGÉNÉRATION
// ============================================================

async function toggleAutoRegen(id, actif) {
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auto_regenerer: actif }),
        });
        // Mettre à jour en mémoire
        for (const type of ['Quotidien', 'Hebdomadaire', 'Mensuel']) {
            const t = tachesParType[type].find(t => t.id === id);
            if (t) t.auto_regenerer = actif;
        }
    } catch {
        alert('Erreur lors de la mise à jour.');
    }
}

// ============================================================
// SUPPRIMER (→ corbeille)
// ============================================================

async function supprimerTache(id) {
    if (!confirm('Envoyer cette tâche à la corbeille ?')) return;
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: 'corbeille' }),
        });
        // Retirer de toutes les listes
        for (const type of ['Quotidien', 'Hebdomadaire', 'Mensuel']) {
            tachesParType[type] = tachesParType[type].filter(t => t.id !== id);
        }
        rendreListeRecurrence('Quotidien',    'liste-quotidien');
        rendreListeRecurrence('Hebdomadaire', 'liste-hebdo');
        rendreListeRecurrence('Mensuel',      'liste-mensuel');
    } catch {
        alert('Erreur lors de la suppression.');
    }
}

// ============================================================
// CALLBACK APRÈS SAUVEGARDE TÂCHE
// ============================================================

function apresModificationTache(tache, estModification) {
    const type = tache.recurrence;
    if (!['Quotidien', 'Hebdomadaire', 'Mensuel'].includes(type)) return;

    if (estModification) {
        // Retirer l'ancienne version de toutes les listes
        for (const t of ['Quotidien', 'Hebdomadaire', 'Mensuel']) {
            tachesParType[t] = tachesParType[t].filter(t => t.id !== tache.id);
        }
    }
    if (!tachesParType[type]) tachesParType[type] = [];
    tachesParType[type].push(tache);

    rendreListeRecurrence('Quotidien',    'liste-quotidien');
    rendreListeRecurrence('Hebdomadaire', 'liste-hebdo');
    rendreListeRecurrence('Mensuel',      'liste-mensuel');
}

// ============================================================
// MINI-CALENDRIER (section Autres)
// ============================================================

function naviguerMiniCal(direction) {
    dateMiniCal.setMonth(dateMiniCal.getMonth() + direction);
    rendreMiniCal();
}

function rendreMiniCal() {
    const annee = dateMiniCal.getFullYear();
    const mois  = dateMiniCal.getMonth();
    document.getElementById('mini-cal-titre').textContent = `${MOIS_NOMS[mois]} ${annee}`;

    const premierJour = new Date(annee, mois, 1);
    let debutSemaine = premierJour.getDay() - 1;
    if (debutSemaine < 0) debutSemaine = 6;
    const dernierJour = new Date(annee, mois + 1, 0).getDate();
    const aujourd_hui = formaterDateISO(new Date());

    const grille = document.getElementById('mini-cal-jours');
    grille.innerHTML = '';

    // Jours vides avant le 1er
    for (let i = 0; i < debutSemaine; i++) {
        const vide = document.createElement('div');
        vide.className = 'mini-cal-jour mini-cal-vide';
        grille.appendChild(vide);
    }

    // Jours du mois
    for (let j = 1; j <= dernierJour; j++) {
        const dateISO = `${annee}-${String(mois + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
        const cellule = document.createElement('div');
        cellule.className = 'mini-cal-jour'
            + (dateISO === aujourd_hui ? ' mini-cal-aujourd-hui' : '')
            + (datesSelectionnees.has(dateISO) ? ' mini-cal-selectionne' : '');
        cellule.textContent = j;
        cellule.addEventListener('click', () => toggleDate(dateISO, cellule));
        grille.appendChild(cellule);
    }
}

function toggleDate(dateISO, cellule) {
    if (datesSelectionnees.has(dateISO)) {
        datesSelectionnees.delete(dateISO);
        cellule.classList.remove('mini-cal-selectionne');
    } else {
        datesSelectionnees.add(dateISO);
        cellule.classList.add('mini-cal-selectionne');
    }
    mettreAJourDatesAffichees();
}

function mettreAJourDatesAffichees() {
    const liste = document.getElementById('autres-dates-liste');
    const btn   = document.getElementById('btn-creer-lot');

    if (datesSelectionnees.size === 0) {
        liste.innerHTML = '<span style="color:var(--texte-secondaire);font-size:0.85rem;">Aucune date sélectionnée</span>';
        btn.disabled = true;
        return;
    }

    const dates = [...datesSelectionnees].sort();
    liste.innerHTML = dates.map(d =>
        `<span class="autres-date-chip">${formaterDate(d)}
            <button onclick="retirerDate('${d}')" title="Retirer">×</button>
        </span>`
    ).join('');
    btn.disabled = false;
}

function retirerDate(dateISO) {
    datesSelectionnees.delete(dateISO);
    mettreAJourDatesAffichees();
    rendreMiniCal(); // Pour décocher visuellement
}

// ============================================================
// SAUVEGARDE RÉCURRENCE CLASSIQUE (sans auto-régénération)
// ============================================================

async function sauvegarderRecurrenceClassique(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const dateDebut  = document.getElementById('tache-date').value;
    const dateFin    = document.getElementById('tache-date-fin').value;
    const recurrence = document.getElementById('tache-recurrence').value;

    if (!dateDebut) {
        erreurs.textContent = 'La date d\'échéance (début) est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }
    if (!dateFin) {
        erreurs.textContent = 'La date de fin est obligatoire pour une récurrence classique.';
        erreurs.style.display = 'block';
        return;
    }
    if (dateFin < dateDebut) {
        erreurs.textContent = 'La date de fin doit être après la date de début.';
        erreurs.style.display = 'block';
        return;
    }

    const dates = calculerDatesRecurrence(dateDebut, dateFin, recurrence);
    if (dates.length === 0) {
        erreurs.textContent = 'Aucune occurrence trouvée entre ces deux dates.';
        erreurs.style.display = 'block';
        return;
    }

    const donnees = {
        titre:        document.getElementById('tache-titre').value.trim(),
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: document.getElementById('tache-duree').value
            ? parseInt(document.getElementById('tache-duree').value) : null,
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        recurrence:   recurrence,
        dates,
    };

    if (!donnees.titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }

    try {
        const rep = await fetch('/api/tasks/lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });
        const res = await rep.json();
        if (!rep.ok) {
            const msgs = res.erreurs || [res.erreur || 'Erreur'];
            erreurs.innerHTML = msgs.join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        // res est un tableau de tâches créées
        fermerModal();
        // Ajouter chaque tâche créée dans la liste correspondante
        res.forEach(t => apresModificationTache(t, false));
        alert(`✅ ${res.length} tâche(s) créée(s) dans le planning.`);
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// SAUVEGARDE RÉCURRENCE HEBDOMADAIRE CLASSIQUE
// ============================================================

async function sauvegarderRecurrenceHebdo(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    // Récupérer les jours sélectionnés (indices 0=Lun … 6=Dim)
    const joursSelectionnes = new Set(
        [...document.querySelectorAll('.jour-picker-btn.selectionne')]
            .map(btn => parseInt(btn.dataset.index))
    );

    if (joursSelectionnes.size === 0) {
        erreurs.textContent = 'Sélectionne au moins un jour de la semaine.';
        erreurs.style.display = 'block';
        return;
    }

    const dateDebut = document.getElementById('tache-date').value;
    const dateFin   = document.getElementById('tache-date-fin').value;

    if (!dateDebut || !dateFin) {
        erreurs.textContent = 'Les dates de début et de fin sont obligatoires.';
        erreurs.style.display = 'block';
        return;
    }
    if (dateFin < dateDebut) {
        erreurs.textContent = 'La date de fin doit être après la date de début.';
        erreurs.style.display = 'block';
        return;
    }

    const dates = calculerDatesHebdo(dateDebut, dateFin, joursSelectionnes);
    if (dates.length === 0) {
        erreurs.textContent = 'Aucune occurrence trouvée pour les jours sélectionnés.';
        erreurs.style.display = 'block';
        return;
    }

    const donnees = {
        titre:        document.getElementById('tache-titre').value.trim(),
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: document.getElementById('tache-duree').value
            ? parseInt(document.getElementById('tache-duree').value) : null,
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        recurrence:   'Hebdomadaire',
        dates,
    };

    if (!donnees.titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }

    try {
        const rep = await fetch('/api/tasks/lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });
        const res = await rep.json();
        if (!rep.ok) {
            const msgs = res.erreurs || [res.erreur || 'Erreur'];
            erreurs.innerHTML = msgs.join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        // Effacer la sélection
        document.querySelectorAll('.jour-picker-btn.selectionne')
            .forEach(b => b.classList.remove('selectionne'));
        fermerModal();
        res.forEach(t => apresModificationTache(t, false));
        alert(`✅ ${res.length} tâche(s) créée(s) dans le planning.`);
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// SAUVEGARDE RÉCURRENCE MENSUELLE CLASSIQUE
// ============================================================

async function sauvegarderRecurrenceMensuel(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    // Récupérer les jours du mois sélectionnés (1–31)
    const joursSelectionnes = new Set(
        [...document.querySelectorAll('.jour-mois-btn.selectionne')]
            .map(btn => parseInt(btn.dataset.jour))
    );

    if (joursSelectionnes.size === 0) {
        erreurs.textContent = 'Sélectionne au moins un jour du mois.';
        erreurs.style.display = 'block';
        return;
    }

    const dateDebut = document.getElementById('tache-date').value;
    const dateFin   = document.getElementById('tache-date-fin').value;

    if (!dateDebut || !dateFin) {
        erreurs.textContent = 'Les dates de début et de fin sont obligatoires.';
        erreurs.style.display = 'block';
        return;
    }
    if (dateFin < dateDebut) {
        erreurs.textContent = 'La date de fin doit être après la date de début.';
        erreurs.style.display = 'block';
        return;
    }

    const dates = calculerDatesMensuel(dateDebut, dateFin, joursSelectionnes);
    if (dates.length === 0) {
        erreurs.textContent = 'Aucune occurrence trouvée pour les jours sélectionnés.';
        erreurs.style.display = 'block';
        return;
    }

    const donnees = {
        titre:        document.getElementById('tache-titre').value.trim(),
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: document.getElementById('tache-duree').value
            ? parseInt(document.getElementById('tache-duree').value) : null,
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        recurrence:   'Mensuel',
        dates,
    };

    if (!donnees.titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }

    try {
        const rep = await fetch('/api/tasks/lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });
        const res = await rep.json();
        if (!rep.ok) {
            const msgs = res.erreurs || [res.erreur || 'Erreur'];
            erreurs.innerHTML = msgs.join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        // Effacer la sélection
        document.querySelectorAll('.jour-mois-btn.selectionne')
            .forEach(b => b.classList.remove('selectionne'));
        fermerModal();
        res.forEach(t => apresModificationTache(t, false));
        alert(`✅ ${res.length} tâche(s) créée(s) dans le planning.`);
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// CALCUL DES DATES D'OCCURRENCE
// ============================================================

function calculerDatesRecurrence(dateDebut, dateFin, recurrence) {
    const dates = [];
    const fin = new Date(dateFin + 'T00:00:00');
    let courant = new Date(dateDebut + 'T00:00:00');

    // Limite de sécurité (max 365 occurrences)
    let limite = 365;
    while (courant <= fin && limite-- > 0) {
        dates.push(formaterDateISO(courant));
        if (recurrence === 'Quotidien') {
            courant.setDate(courant.getDate() + 1);
        } else if (recurrence === 'Hebdomadaire') {
            courant.setDate(courant.getDate() + 7);
        } else if (recurrence === 'Mensuel') {
            courant.setMonth(courant.getMonth() + 1);
        } else {
            break;
        }
    }
    return dates;
}

/**
 * Calcule toutes les dates entre dateDebut et dateFin dont le jour de semaine
 * (0=Lun … 6=Dim) est dans joursSelectionnes (Set d'indices).
 */
function calculerDatesHebdo(dateDebut, dateFin, joursSelectionnes) {
    const dates = [];
    const fin = new Date(dateFin + 'T00:00:00');
    let courant = new Date(dateDebut + 'T00:00:00');
    let limite = 366 * 2; // sécurité

    while (courant <= fin && limite-- > 0) {
        const jourSemaine = (courant.getDay() + 6) % 7; // 0=Lun … 6=Dim
        if (joursSelectionnes.has(jourSemaine)) {
            dates.push(formaterDateISO(courant));
        }
        courant.setDate(courant.getDate() + 1);
    }
    return dates;
}

/**
 * Calcule toutes les dates entre dateDebut et dateFin dont le numéro du jour
 * du mois est dans joursSelectionnes (Set de nombres 1–31).
 */
function calculerDatesMensuel(dateDebut, dateFin, joursSelectionnes) {
    const dates = [];
    const fin = new Date(dateFin + 'T00:00:00');
    let courant = new Date(dateDebut + 'T00:00:00');
    let limite = 366 * 5; // sécurité

    while (courant <= fin && limite-- > 0) {
        if (joursSelectionnes.has(courant.getDate())) {
            dates.push(formaterDateISO(courant));
        }
        courant.setDate(courant.getDate() + 1);
    }
    return dates;
}

// ============================================================
// CRÉATION EN LOT (section Autres)
// ============================================================

function ouvrirModalLot() {
    // Ouvre le modal normal, mais on interceptera la sauvegarde
    ouvrirModal(null, null, null);
    setTimeout(() => {
        // Masquer le sélecteur de type (non pertinent pour les dates libres)
        document.getElementById('groupe-type-recurrence').style.display = 'none';
        document.getElementById('tache-recurrence').value = 'Une fois';
        document.getElementById('tache-auto-regenerer').checked = false;
        // Remplacer le submit par notre logique lot
        document.getElementById('form-tache').onsubmit = sauvegarderLot;
    }, 10);
}

async function sauvegarderLot(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const donnees = {
        titre:        document.getElementById('tache-titre').value.trim(),
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: document.getElementById('tache-duree').value
            ? parseInt(document.getElementById('tache-duree').value) : null,
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        dates:        [...datesSelectionnees].sort(),
    };

    try {
        const rep = await fetch('/api/tasks/lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });
        const res = await rep.json();
        if (!rep.ok) {
            const msgs = res.erreurs || [res.erreur || 'Erreur'];
            erreurs.innerHTML = msgs.join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        // Réinitialiser
        datesSelectionnees.clear();
        mettreAJourDatesAffichees();
        rendreMiniCal();
        fermerModal(); // ouvrirModal() remet onsubmit = sauvegarderTache automatiquement
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// UTILITAIRES
// ============================================================

function formaterDateISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formaterDate(iso) {
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
}

function echapper(texte) {
    if (!texte) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(texte));
    return d.innerHTML;
}
