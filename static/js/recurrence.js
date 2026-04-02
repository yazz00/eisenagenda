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
    Autres:       [...tachesAutres],
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
    rendreListeRecurrence('Autres',       'liste-autres');
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
// GROUPEMENT DES TÂCHES
// ============================================================

/**
 * Regroupe un tableau de tâches par titre (insensible à la casse).
 * Retourne un tableau de groupes, chaque groupe ayant une liste d'instances.
 */
function grouperTaches(taches) {
    const map = new Map();
    taches.forEach(t => {
        const cle = t.titre.trim().toLowerCase();
        if (!map.has(cle)) {
            map.set(cle, {
                titre:        t.titre,
                zone:         t.zone,
                categorie:    t.categorie,
                description:  t.description,
                duree_estimee: t.duree_estimee,
                heure_debut:  t.heure_debut,
                auto_regenerer: t.auto_regenerer,
                recurrence:   t.recurrence,
                instances:    [],
            });
        }
        map.get(cle).instances.push(t);
    });

    // Trier les instances de chaque groupe par date
    map.forEach(groupe => {
        groupe.instances.sort((a, b) =>
            (a.date_echeance || '').localeCompare(b.date_echeance || '')
        );
    });

    // Trier les groupes : d'abord ceux avec une prochaine date à venir
    const aujourd_hui = formaterDateISO(new Date());
    return [...map.values()].sort((a, b) => {
        const prochA = a.instances.find(i => i.date_echeance >= aujourd_hui)?.date_echeance || '';
        const prochB = b.instances.find(i => i.date_echeance >= aujourd_hui)?.date_echeance || '';
        return prochA.localeCompare(prochB);
    });
}

// ============================================================
// LISTES DE TÂCHES (groupées)
// ============================================================

function rendreListeRecurrence(type, idConteneur) {
    const conteneur = document.getElementById(idConteneur);
    const taches = tachesParType[type];

    if (taches.length === 0) {
        conteneur.innerHTML = '<p class="recurrence-vide">Aucune tâche. Clique sur "+ Ajouter" pour en créer une.</p>';
        return;
    }

    const groupes = grouperTaches(taches);
    conteneur.innerHTML = '';
    groupes.forEach(g => conteneur.appendChild(creerCarteGroupe(g)));
}

function creerCarteGroupe(groupe) {
    const ids = groupe.instances.map(t => t.id);
    const zone = ZONES_LABELS[groupe.zone] || { label: groupe.zone, classe: '' };
    const aujourd_hui = formaterDateISO(new Date());
    const nb = groupe.instances.length;

    // Prochaine occurrence à venir (>= aujourd'hui)
    const prochaine = groupe.instances.find(i => i.date_echeance >= aujourd_hui);
    // Plage de dates
    const dateMin = groupe.instances[0]?.date_echeance;
    const dateMax = groupe.instances[nb - 1]?.date_echeance;
    const plageDates = (dateMin && dateMax && dateMin !== dateMax)
        ? `${formaterDate(dateMin)} → ${formaterDate(dateMax)}`
        : dateMin ? formaterDate(dateMin) : '—';

    const carte = document.createElement('div');
    carte.className = 'recurrence-groupe';

    // ---- En-tête du groupe ----
    const entete = document.createElement('div');
    entete.className = 'recurrence-groupe-entete';
    entete.innerHTML = `
        <div class="recurrence-groupe-gauche">
            <div class="recurrence-groupe-titre">${echapper(groupe.titre)}</div>
            <div class="recurrence-groupe-meta">
                <span class="zone-chip ${zone.classe}">${zone.label}</span>
                <span class="rg-info">📦 ${nb} occurrence${nb > 1 ? 's' : ''}</span>
                <span class="rg-info">📅 ${plageDates}</span>
                ${prochaine ? `<span class="rg-info rg-prochaine">⏭ Prochaine : ${formaterDate(prochaine.date_echeance)}</span>` : ''}
                ${groupe.duree_estimee ? `<span class="rg-info">⏱ ${formaterDuree(groupe.duree_estimee)}</span>` : ''}
            </div>
        </div>
        <div class="recurrence-groupe-actions">
            <label class="auto-regen-label" title="Recréer automatiquement quand marquée Fait">
                <input type="checkbox" class="auto-regen-groupe-cb"
                    ${groupe.auto_regenerer ? 'checked' : ''}>
                🔄 Auto
            </label>
            <button class="btn btn-secondaire btn-sm btn-modifier-groupe" title="Modifier toutes les occurrences">✏ Modifier tout</button>
            <button class="btn btn-danger btn-sm btn-supprimer-groupe" title="Supprimer toutes les occurrences">🗑 Supprimer tout</button>
            <button class="btn btn-outline btn-sm btn-toggle-details" title="Voir les occurrences">▼ Détails</button>
        </div>
    `;

    // ---- Panneau détails (instances individuelles) ----
    const details = document.createElement('div');
    details.className = 'recurrence-groupe-details';
    details.style.display = 'none';

    groupe.instances.forEach(t => {
        const ligne = document.createElement('div');
        ligne.className = 'recurrence-instance';
        ligne.dataset.id = t.id;
        ligne.innerHTML = `
            <span class="recurrence-instance-date">${t.date_echeance ? formaterDate(t.date_echeance) : '—'}</span>
            ${t.heure_debut ? `<span class="recurrence-instance-heure">🕐 ${t.heure_debut}</span>` : ''}
            ${t.zone !== groupe.zone ? `<span class="zone-chip ${(ZONES_LABELS[t.zone] || {}).classe || ''}" style="font-size:0.75rem;">${(ZONES_LABELS[t.zone] || {label:t.zone}).label}</span>` : ''}
            <div class="recurrence-instance-actions">
                <button class="btn btn-secondaire btn-xs" title="Modifier">✏</button>
                <button class="btn btn-danger btn-xs" title="Supprimer">🗑</button>
            </div>
        `;
        // Boutons de la ligne individuelle
        ligne.querySelector('.btn-secondaire').addEventListener('click', () => ouvrirModal(t));
        ligne.querySelector('.btn-danger').addEventListener('click', () => supprimerTache(t.id));
        details.appendChild(ligne);
    });

    carte.appendChild(entete);
    carte.appendChild(details);

    // ---- Événements de la carte ----

    // Toggle auto-regen pour tout le groupe
    entete.querySelector('.auto-regen-groupe-cb').addEventListener('change', async function() {
        await toggleAutoRegenGroupe(ids, this.checked, groupe);
    });

    // Modifier tout le groupe
    entete.querySelector('.btn-modifier-groupe').addEventListener('click', () => {
        ouvrirModalModifierGroupe(groupe, ids);
    });

    // Supprimer tout le groupe
    entete.querySelector('.btn-supprimer-groupe').addEventListener('click', () => {
        supprimerGroupe(ids);
    });

    // Expand/collapse détails
    const btnDetails = entete.querySelector('.btn-toggle-details');
    btnDetails.addEventListener('click', () => {
        const ouvert = details.style.display !== 'none';
        details.style.display = ouvert ? 'none' : 'block';
        btnDetails.textContent = ouvert ? '▼ Détails' : '▲ Masquer';
    });

    return carte;
}

// ============================================================
// AFFICHAGE CONDITIONNEL DES CHAMPS DATES
// ============================================================

function mettreAJourChampsDates() {
    const recurrence  = document.getElementById('tache-recurrence').value;
    const autoRegen   = document.getElementById('tache-auto-regenerer').checked;
    const groupeAutoRegen    = document.getElementById('groupe-auto-regenerer');
    const groupeDateFin      = document.getElementById('groupe-date-fin');
    const groupeJoursSemaine = document.getElementById('groupe-jours-semaine');
    const groupeJoursMois    = document.getElementById('groupe-jours-mois');

    // Libellé du champ date selon le type
    const labelDate = document.querySelector('label[for="tache-date"]');
    if (labelDate) labelDate.textContent = recurrence !== 'Une fois' ? 'Date de début' : "Date d'échéance";

    // Auto-régénération : visible pour Quotidien et Hebdomadaire uniquement
    const autoRegenVisible = recurrence === 'Quotidien' || recurrence === 'Hebdomadaire';
    groupeAutoRegen.style.display = autoRegenVisible ? 'block' : 'none';

    // Récurrence classique = type ≠ "Une fois", ≠ "Autres" ET pas d'auto-régénération
    const recurrenceClassique = recurrence !== 'Une fois' && recurrence !== 'Autres' && !autoRegen;

    // Date de fin : visible en mode classique (pas d'auto-regen)
    groupeDateFin.style.display = recurrenceClassique ? 'block' : 'none';

    // Sélecteur de jours de la semaine : pour TOUT mode Hebdomadaire
    groupeJoursSemaine.style.display = recurrence === 'Hebdomadaire' ? 'block' : 'none';

    // Sélecteur de jours du mois : Mensuel classique uniquement
    groupeJoursMois.style.display =
        (recurrence === 'Mensuel' && recurrenceClassique) ? 'block' : 'none';

    // Ajuster le submit selon le mode
    if (recurrence === 'Autres') {
        document.getElementById('form-tache').onsubmit = sauvegarderLotAutresRecurrence;
    } else if (recurrence === 'Hebdomadaire') {
        // Auto-regen ou classique : toujours passer par le handler Hebdo
        document.getElementById('form-tache').onsubmit =
            autoRegen ? sauvegarderHebdoAutoRegen : sauvegarderRecurrenceHebdo;
    } else if (recurrence === 'Mensuel' && recurrenceClassique) {
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceMensuel;
    } else if (recurrence === 'Quotidien' && recurrenceClassique) {
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceClassique;
    } else {
        // Quotidien auto-regen, Une fois, ou Mensuel auto-regen
        document.getElementById('form-tache').onsubmit = sauvegarderTache;
    }
}

async function sauvegarderLotAutresRecurrence(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const titre = document.getElementById('tache-titre').value.trim();
    if (!titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }
    if (datesModalSelectionnees.size === 0) {
        erreurs.textContent = 'Sélectionne au moins une date dans le calendrier.';
        erreurs.style.display = 'block';
        return;
    }

    const donnees = {
        titre,
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: lireDureeMinutes(),
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        recurrence:   'Une fois',
        dates:        [...datesModalSelectionnees].sort(),
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
        res.forEach(t => apresModificationTache(t, false));
        fermerModal();
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
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
        // mettreAJourChampsDates affichera groupe-auto-regenerer si Quotidien/Hebdo
        mettreAJourChampsDates();
    }, 10);
}

// ============================================================
// TOGGLE AUTO-RÉGÉNÉRATION (groupe)
// ============================================================

async function toggleAutoRegenGroupe(ids, actif, groupe) {
    try {
        await fetch('/api/tasks/lot-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, champs: { auto_regenerer: actif } }),
        });
        // Mettre à jour en mémoire
        for (const type of ['Quotidien', 'Hebdomadaire', 'Mensuel', 'Autres']) {
            tachesParType[type].forEach(t => {
                if (ids.includes(t.id)) t.auto_regenerer = actif;
            });
        }
        groupe.auto_regenerer = actif;
    } catch {
        alert('Erreur lors de la mise à jour.');
    }
}

// ============================================================
// SUPPRIMER UNE INSTANCE (→ corbeille)
// ============================================================

async function supprimerTache(id) {
    if (!confirm('Envoyer cette occurrence à la corbeille ?')) return;
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: 'corbeille' }),
        });
        for (const type of ['Quotidien', 'Hebdomadaire', 'Mensuel', 'Autres']) {
            tachesParType[type] = tachesParType[type].filter(t => t.id !== id);
        }
        rendreListesRecurrence();
    } catch {
        alert('Erreur lors de la suppression.');
    }
}

// ============================================================
// SUPPRIMER TOUT LE GROUPE (→ corbeille)
// ============================================================

async function supprimerGroupe(ids) {
    const nb = ids.length;
    if (!confirm(`Envoyer les ${nb} occurrence${nb > 1 ? 's' : ''} de cette tâche à la corbeille ?`)) return;
    try {
        // On met toutes les instances en zone "corbeille" via lot-update
        await fetch('/api/tasks/lot-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, champs: { zone: 'corbeille' } }),
        });
        for (const type of ['Quotidien', 'Hebdomadaire', 'Mensuel', 'Autres']) {
            tachesParType[type] = tachesParType[type].filter(t => !ids.includes(t.id));
        }
        rendreListesRecurrence();
    } catch {
        alert('Erreur lors de la suppression.');
    }
}

// ============================================================
// MODIFIER TOUT LE GROUPE
// ============================================================

function ouvrirModalModifierGroupe(groupe, ids) {
    // Ouvrir le modal vide (pas de tâche individuelle)
    ouvrirModal(null, null, null);
    setTimeout(() => {
        // Pré-remplir les champs partagés du groupe
        document.getElementById('tache-titre').value        = groupe.titre;
        document.getElementById('tache-description').value  = groupe.description || '';
        remplirDuree(groupe.duree_estimee);
        document.getElementById('tache-categorie').value    = groupe.categorie || 'Autre';
        document.getElementById('tache-zone').value         = groupe.zone || 'urgent_important';
        document.getElementById('tache-heure-debut').value  = groupe.heure_debut || '';

        // Titre du modal
        document.getElementById('modal-titre').textContent =
            `✏ Modifier — ${groupe.titre} (${ids.length} occurrence${ids.length > 1 ? 's' : ''})`;

        // Masquer les champs non pertinents pour une édition groupée
        document.getElementById('tache-date').closest('.form-groupe').style.display = 'none';
        document.getElementById('groupe-recurrence').style.display = 'none';

        // Remplacer le submit
        document.getElementById('form-tache').onsubmit = (e) => sauvegarderModificationGroupe(e, ids, groupe.recurrence);
    }, 10);
}

async function sauvegarderModificationGroupe(event, ids, typeRecurrence) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const titre = document.getElementById('tache-titre').value.trim();
    if (!titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }

    const champs = {
        titre,
        description:   document.getElementById('tache-description').value.trim() || null,
        duree_estimee: lireDureeMinutes(),
        categorie:     document.getElementById('tache-categorie').value,
        zone:          document.getElementById('tache-zone').value,
        heure_debut:   document.getElementById('tache-heure-debut').value || null,
    };

    try {
        const rep = await fetch('/api/tasks/lot-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, champs }),
        });
        const res = await rep.json();
        if (!rep.ok) {
            const msgs = res.erreurs || [res.erreur || 'Erreur'];
            erreurs.innerHTML = msgs.join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        // Restaurer le champ date masqué
        document.getElementById('tache-date').closest('.form-groupe').style.display = '';
        fermerModal();
        // Mettre à jour en mémoire
        res.forEach(t => apresModificationTache(t, true));
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// RAFRAÎCHISSEMENT DE TOUTES LES LISTES
// ============================================================

function rendreListesRecurrence() {
    rendreListeRecurrence('Quotidien',    'liste-quotidien');
    rendreListeRecurrence('Hebdomadaire', 'liste-hebdo');
    rendreListeRecurrence('Mensuel',      'liste-mensuel');
    rendreListeRecurrence('Autres',       'liste-autres');
}

// ============================================================
// CALLBACK APRÈS SAUVEGARDE TÂCHE
// ============================================================

function apresModificationTache(tache, estModification) {
    const type = tache.recurrence === 'Une fois' ? 'Autres' : tache.recurrence;
    if (!['Quotidien', 'Hebdomadaire', 'Mensuel', 'Autres'].includes(type)) return;

    if (estModification) {
        // Retirer l'ancienne version de toutes les listes
        for (const t of ['Quotidien', 'Hebdomadaire', 'Mensuel', 'Autres']) {
            tachesParType[t] = tachesParType[t].filter(i => i.id !== tache.id);
        }
    }
    if (!tachesParType[type]) tachesParType[type] = [];
    tachesParType[type].push(tache);

    rendreListesRecurrence();
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
        duree_estimee: lireDureeMinutes(),
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
// SAUVEGARDE HEBDOMADAIRE AVEC AUTO-RÉGÉNÉRATION (multi-jours)
// ============================================================

async function sauvegarderHebdoAutoRegen(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const joursSelectionnes = [...document.querySelectorAll('.jour-picker-btn.selectionne')]
        .map(btn => parseInt(btn.dataset.index)); // 0=Lun … 6=Dim

    const dateDebut = document.getElementById('tache-date').value;
    if (!dateDebut) {
        erreurs.textContent = 'La date d\'échéance (premier jour) est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }

    const donnees = {
        titre:        document.getElementById('tache-titre').value.trim(),
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: lireDureeMinutes(),
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        recurrence:   'Hebdomadaire',
        auto_regenerer: true,
    };

    if (!donnees.titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }

    // Si aucun jour sélectionné → une seule tâche pour la date donnée
    if (joursSelectionnes.length === 0) {
        try {
            const rep = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...donnees, date_echeance: dateDebut }),
            });
            const res = await rep.json();
            if (!rep.ok) {
                erreurs.innerHTML = (res.erreurs || [res.erreur || 'Erreur']).join('<br>');
                erreurs.style.display = 'block';
                return;
            }
            fermerModal();
            apresModificationTache(res, false);
        } catch {
            erreurs.textContent = 'Erreur de connexion.';
            erreurs.style.display = 'block';
        }
        return;
    }

    // Plusieurs jours : calculer la première occurrence de chaque jour >= dateDebut
    const debut = new Date(dateDebut + 'T00:00:00');
    const jourDebutSemaine = (debut.getDay() + 6) % 7; // 0=Lun

    const dates = joursSelectionnes.map(jourCible => {
        let decalage = (jourCible - jourDebutSemaine + 7) % 7;
        const d = new Date(debut);
        d.setDate(d.getDate() + decalage);
        return formaterDateISO(d);
    });

    try {
        const rep = await fetch('/api/tasks/lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...donnees, dates }),
        });
        const res = await rep.json();
        if (!rep.ok) {
            erreurs.innerHTML = (res.erreurs || [res.erreur || 'Erreur']).join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        document.querySelectorAll('.jour-picker-btn.selectionne')
            .forEach(b => b.classList.remove('selectionne'));
        fermerModal();
        res.forEach(t => apresModificationTache(t, false));
        alert(`✅ ${res.length} tâche(s) créée(s) avec auto-régénération.`);
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
        duree_estimee: lireDureeMinutes(),
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
        duree_estimee: lireDureeMinutes(),
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
        duree_estimee: lireDureeMinutes(),
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
