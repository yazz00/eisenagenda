// ===== PAGE PROJETS — Arbre des tâches =====

const ZONES_LABELS = {
    urgent_important: { label: '🔴 Urgent + Important', classe: 'zone-urgent-important', couleur: '#ef4444' },
    important:        { label: '🔵 Important',          classe: 'zone-important',         couleur: '#3b82f6' },
    urgent:           { label: '🟡 Urgent',             classe: 'zone-urgent',            couleur: '#f59e0b' },
    neutre:           { label: '⚫ Neutre',             classe: 'zone-neutre',            couleur: '#6b7280' },
    en_cours:         { label: '⏳ En cours',           classe: 'zone-en-cours',          couleur: '#f97316' },
    fait:             { label: '✅ Fait',               classe: 'zone-fait',              couleur: '#22c55e' },
};

// ===== ÉTAT GLOBAL =====
let projets = [...projetsInitiaux];
let projetActifId = null;
let arbreActuel = null; // JSON arbre chargé

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', () => {
    // Afficher les champs récurrence dans le modal (comme sur la page Récurrence)
    document.getElementById('groupe-recurrence').style.display = 'block';

    // Gestionnaires pour les sélecteurs de jours (modal partagé depuis base.html)
    document.querySelectorAll('.jour-picker-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('selectionne'));
    });
    document.querySelectorAll('.jour-mois-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('selectionne'));
    });

    rendreListeProjets();
    // Sélectionner le premier projet automatiquement si disponible
    if (projets.length > 0) {
        selectionnerProjet(projets[0].id);
    }
});

// ============================================================
// GESTION DES CHAMPS RÉCURRENCE DANS LE MODAL
// (identique à la page Récurrence, avec projet_id/parent_id injectés)
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

    // Auto-regen : visible pour Quotidien et Hebdomadaire
    groupeAutoRegen.style.display =
        (recurrence === 'Quotidien' || recurrence === 'Hebdomadaire') ? 'block' : 'none';

    // Récurrence classique = type ≠ "Une fois", ≠ "Autres" ET pas d'auto-régénération
    const recurrenceClassique = recurrence !== 'Une fois' && recurrence !== 'Autres' && !autoRegen;

    // Date de fin : visible en mode classique
    groupeDateFin.style.display = recurrenceClassique ? 'block' : 'none';

    // Sélecteur de jours de la semaine : pour TOUT mode Hebdomadaire
    groupeJoursSemaine.style.display = recurrence === 'Hebdomadaire' ? 'block' : 'none';

    // Sélecteur de jours du mois : Mensuel classique uniquement
    groupeJoursMois.style.display =
        (recurrence === 'Mensuel' && recurrenceClassique) ? 'block' : 'none';

    // Mini-calendrier modal : visible uniquement pour "Autres"
    const groupeMiniCal = document.getElementById('groupe-mini-cal-modal');
    if (groupeMiniCal) {
        groupeMiniCal.style.display = recurrence === 'Autres' ? 'block' : 'none';
        if (recurrence === 'Autres') rendreMiniCalModal();
    }

    // Ajuster le submit selon le mode
    if (recurrence === 'Autres') {
        document.getElementById('form-tache').onsubmit = sauvegarderLotProjet;
    } else if (recurrence === 'Hebdomadaire') {
        document.getElementById('form-tache').onsubmit =
            autoRegen ? sauvegarderHebdoAutoRegenProjet : sauvegarderRecurrenceHebdoProjet;
    } else if (recurrence === 'Mensuel' && recurrenceClassique) {
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceMensuelProjet;
    } else if (recurrence === 'Quotidien' && recurrenceClassique) {
        document.getElementById('form-tache').onsubmit = sauvegarderRecurrenceClassiqueProjet;
    } else {
        // Quotidien auto-regen, Une fois, Mensuel auto-regen → une seule tâche
        document.getElementById('form-tache').onsubmit = sauvegarderTache;
    }
}

// ============================================================
// FONCTIONS DE CALCUL DES DATES (dupliquées depuis recurrence.js)
// ============================================================

function calculerDatesRecurrenceProjet(dateDebut, dateFin, recurrence) {
    const dates = [];
    const fin = new Date(dateFin + 'T00:00:00');
    let courant = new Date(dateDebut + 'T00:00:00');
    let limite = 365;
    while (courant <= fin && limite-- > 0) {
        dates.push(formaterDateISO(courant));
        if (recurrence === 'Quotidien')       courant.setDate(courant.getDate() + 1);
        else if (recurrence === 'Hebdomadaire') courant.setDate(courant.getDate() + 7);
        else if (recurrence === 'Mensuel')    courant.setMonth(courant.getMonth() + 1);
        else break;
    }
    return dates;
}

function calculerDatesHebdoProjet(dateDebut, dateFin, joursSelectionnes) {
    const dates = [];
    const fin = new Date(dateFin + 'T00:00:00');
    let courant = new Date(dateDebut + 'T00:00:00');
    let limite = 366 * 2;
    while (courant <= fin && limite-- > 0) {
        const jourSemaine = (courant.getDay() + 6) % 7;
        if (joursSelectionnes.has(jourSemaine)) dates.push(formaterDateISO(courant));
        courant.setDate(courant.getDate() + 1);
    }
    return dates;
}

function calculerDatesMensuelProjet(dateDebut, dateFin, joursSelectionnes) {
    const dates = [];
    const fin = new Date(dateFin + 'T00:00:00');
    let courant = new Date(dateDebut + 'T00:00:00');
    let limite = 366 * 5;
    while (courant <= fin && limite-- > 0) {
        if (joursSelectionnes.has(courant.getDate())) dates.push(formaterDateISO(courant));
        courant.setDate(courant.getDate() + 1);
    }
    return dates;
}

// ============================================================
// UTILITAIRE : collecte les champs communs du modal + projet
// ============================================================

function _collecterDonneesProjet() {
    return {
        titre:        document.getElementById('tache-titre').value.trim(),
        description:  document.getElementById('tache-description').value.trim() || null,
        duree_estimee: lireDureeMinutes(),
        categorie:    document.getElementById('tache-categorie').value,
        zone:         document.getElementById('tache-zone').value,
        heure_debut:  document.getElementById('tache-heure-debut').value || null,
        projet_id:    document.getElementById('tache-projet-id').value
            ? parseInt(document.getElementById('tache-projet-id').value) : null,
        parent_id:    document.getElementById('tache-parent-id').value
            ? parseInt(document.getElementById('tache-parent-id').value) : null,
    };
}

// ============================================================
// SAUVEGARDE RÉCURRENCE QUOTIDIENNE CLASSIQUE (lot)
// ============================================================

async function sauvegarderRecurrenceClassiqueProjet(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const dateDebut  = document.getElementById('tache-date').value;
    const dateFin    = document.getElementById('tache-date-fin').value;

    if (!dateDebut || !dateFin) {
        erreurs.textContent = 'Les dates de début et de fin sont obligatoires.';
        erreurs.style.display = 'block'; return;
    }
    if (dateFin < dateDebut) {
        erreurs.textContent = 'La date de fin doit être après la date de début.';
        erreurs.style.display = 'block'; return;
    }

    const donnees = { ..._collecterDonneesProjet(), recurrence: 'Quotidien',
        dates: calculerDatesRecurrenceProjet(dateDebut, dateFin, 'Quotidien') };
    if (!donnees.titre) { erreurs.textContent = 'Le titre est obligatoire.'; erreurs.style.display = 'block'; return; }
    if (donnees.dates.length === 0) { erreurs.textContent = 'Aucune occurrence trouvée.'; erreurs.style.display = 'block'; return; }

    await _sauvegarderLotProjet(donnees, erreurs);
}

// ============================================================
// SAUVEGARDE RÉCURRENCE HEBDOMADAIRE CLASSIQUE (lot, jours sélectionnés)
// ============================================================

async function sauvegarderRecurrenceHebdoProjet(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const joursSelectionnes = new Set(
        [...document.querySelectorAll('.jour-picker-btn.selectionne')]
            .map(btn => parseInt(btn.dataset.index))
    );
    if (joursSelectionnes.size === 0) {
        erreurs.textContent = 'Sélectionne au moins un jour de la semaine.';
        erreurs.style.display = 'block'; return;
    }

    const dateDebut = document.getElementById('tache-date').value;
    const dateFin   = document.getElementById('tache-date-fin').value;
    if (!dateDebut || !dateFin) {
        erreurs.textContent = 'Les dates de début et de fin sont obligatoires.';
        erreurs.style.display = 'block'; return;
    }

    const dates = calculerDatesHebdoProjet(dateDebut, dateFin, joursSelectionnes);
    if (dates.length === 0) { erreurs.textContent = 'Aucune occurrence trouvée.'; erreurs.style.display = 'block'; return; }

    const donnees = { ..._collecterDonneesProjet(), recurrence: 'Hebdomadaire', dates };
    if (!donnees.titre) { erreurs.textContent = 'Le titre est obligatoire.'; erreurs.style.display = 'block'; return; }

    document.querySelectorAll('.jour-picker-btn.selectionne').forEach(b => b.classList.remove('selectionne'));
    await _sauvegarderLotProjet(donnees, erreurs);
}

// ============================================================
// SAUVEGARDE RÉCURRENCE MENSUELLE CLASSIQUE (lot, jours du mois)
// ============================================================

async function sauvegarderRecurrenceMensuelProjet(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const joursSelectionnes = new Set(
        [...document.querySelectorAll('.jour-mois-btn.selectionne')]
            .map(btn => parseInt(btn.dataset.jour))
    );
    if (joursSelectionnes.size === 0) {
        erreurs.textContent = 'Sélectionne au moins un jour du mois.';
        erreurs.style.display = 'block'; return;
    }

    const dateDebut = document.getElementById('tache-date').value;
    const dateFin   = document.getElementById('tache-date-fin').value;
    if (!dateDebut || !dateFin) {
        erreurs.textContent = 'Les dates de début et de fin sont obligatoires.';
        erreurs.style.display = 'block'; return;
    }

    const dates = calculerDatesMensuelProjet(dateDebut, dateFin, joursSelectionnes);
    if (dates.length === 0) { erreurs.textContent = 'Aucune occurrence trouvée.'; erreurs.style.display = 'block'; return; }

    const donnees = { ..._collecterDonneesProjet(), recurrence: 'Mensuel', dates };
    if (!donnees.titre) { erreurs.textContent = 'Le titre est obligatoire.'; erreurs.style.display = 'block'; return; }

    document.querySelectorAll('.jour-mois-btn.selectionne').forEach(b => b.classList.remove('selectionne'));
    await _sauvegarderLotProjet(donnees, erreurs);
}

// ============================================================
// SAUVEGARDE HEBDOMADAIRE AVEC AUTO-RÉGÉNÉRATION (multi-jours)
// ============================================================

async function sauvegarderHebdoAutoRegenProjet(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-erreurs');
    erreurs.style.display = 'none';

    const joursSelectionnes = [...document.querySelectorAll('.jour-picker-btn.selectionne')]
        .map(btn => parseInt(btn.dataset.index));

    const dateDebut = document.getElementById('tache-date').value;
    if (!dateDebut) {
        erreurs.textContent = 'La date d\'échéance (premier jour) est obligatoire.';
        erreurs.style.display = 'block'; return;
    }

    const donnees = { ..._collecterDonneesProjet(), recurrence: 'Hebdomadaire', auto_regenerer: true };
    if (!donnees.titre) { erreurs.textContent = 'Le titre est obligatoire.'; erreurs.style.display = 'block'; return; }

    // Aucun jour sélectionné → une seule tâche à la date choisie
    if (joursSelectionnes.length === 0) {
        try {
            const rep = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...donnees, date_echeance: dateDebut }),
            });
            const res = await rep.json();
            if (!rep.ok) { erreurs.innerHTML = (res.erreurs || [res.erreur || 'Erreur']).join('<br>'); erreurs.style.display = 'block'; return; }
            fermerModal();
            apresModificationTache(res, false);
        } catch { erreurs.textContent = 'Erreur de connexion.'; erreurs.style.display = 'block'; }
        return;
    }

    // Calculer la première occurrence de chaque jour sélectionné à partir de dateDebut
    const debut = new Date(dateDebut + 'T00:00:00');
    const jourDebutSemaine = (debut.getDay() + 6) % 7;
    const dates = joursSelectionnes.map(jourCible => {
        const decalage = (jourCible - jourDebutSemaine + 7) % 7;
        const d = new Date(debut);
        d.setDate(d.getDate() + decalage);
        return formaterDateISO(d);
    });

    document.querySelectorAll('.jour-picker-btn.selectionne').forEach(b => b.classList.remove('selectionne'));
    await _sauvegarderLotProjet({ ...donnees, dates }, erreurs);
}

// ============================================================
// ENVOI EN LOT (partagé par toutes les fonctions classiques)
// ============================================================

async function _sauvegarderLotProjet(donnees, erreurs) {
    try {
        const rep = await fetch('/api/tasks/lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });
        const res = await rep.json();
        if (!rep.ok) {
            erreurs.innerHTML = (res.erreurs || [res.erreur || 'Erreur']).join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        fermerModal();
        res.forEach(t => apresModificationTache(t, false));
        alert(`✅ ${res.length} tâche(s) créée(s).`);
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// LISTE DES PROJETS (panneau gauche)
// ============================================================

function rendreListeProjets() {
    const liste = document.getElementById('liste-projets');
    liste.innerHTML = '';

    if (projets.length === 0) {
        liste.innerHTML = '<li class="projets-liste-vide">Aucun projet. Crée-en un !</li>';
        return;
    }

    projets.forEach(p => {
        const li = document.createElement('li');
        li.className = 'projet-item' + (p.id === projetActifId ? ' actif' : '');
        li.dataset.id = p.id;

        const progression = p.nb_taches > 0
            ? Math.round((p.nb_faites / p.nb_taches) * 100) : 0;

        li.innerHTML = `
            <div class="projet-item-principal" onclick="selectionnerProjet(${p.id})">
                <span class="projet-item-icone" style="background:${p.couleur}20; border: 1px solid ${p.couleur}40;">
                    ${p.icone || '📁'}
                </span>
                <div class="projet-item-infos">
                    <span class="projet-item-nom">${echapper(p.nom)}</span>
                    <span class="projet-item-stats">${p.nb_faites}/${p.nb_taches} tâches</span>
                </div>
            </div>
            <div class="projet-item-actions">
                <button class="btn-icone" title="Modifier" onclick="ouvrirModalProjet(${p.id})">✏</button>
                <button class="btn-icone btn-icone-danger" title="Supprimer" onclick="supprimerProjet(${p.id})">🗑</button>
            </div>
            ${p.nb_taches > 0 ? `
            <div class="projet-item-barre">
                <div class="projet-barre-fond">
                    <div class="projet-barre-rempli" style="width:${progression}%; background:${p.couleur};"></div>
                </div>
                <span class="projet-barre-pct">${progression}%</span>
            </div>` : ''}
        `;
        liste.appendChild(li);
    });
}

// ============================================================
// SÉLECTIONNER UN PROJET → charger l'arbre
// ============================================================

async function selectionnerProjet(projetId) {
    projetActifId = projetId;

    // Mettre en valeur dans la liste
    document.querySelectorAll('.projet-item').forEach(li => {
        li.classList.toggle('actif', parseInt(li.dataset.id) === projetId);
    });

    document.getElementById('projet-vide').style.display = 'none';
    document.getElementById('projet-contenu').style.display = 'block';
    document.getElementById('arbre-conteneur').innerHTML =
        '<div class="arbre-chargement">Chargement…</div>';

    try {
        const rep = await fetch(`/api/projects/${projetId}/tree`);
        const data = await rep.json();
        arbreActuel = data;
        rendreEnteteProjet(data.projet);
        rendreArbre(data.taches, document.getElementById('arbre-conteneur'), 0, projetId);
    } catch {
        document.getElementById('arbre-conteneur').innerHTML =
            '<p class="arbre-erreur">Impossible de charger le projet.</p>';
    }
}

// ============================================================
// EN-TÊTE DU PROJET (panneau droit)
// ============================================================

function rendreEnteteProjet(projet) {
    const entete = document.getElementById('projet-entete');
    entete.innerHTML = `
        <div class="projet-entete-gauche">
            <span class="projet-entete-icone" style="background:${projet.couleur}20; border:2px solid ${projet.couleur};">
                ${projet.icone || '📁'}
            </span>
            <div>
                <h2 class="projet-entete-nom" style="color:${projet.couleur};">${echapper(projet.nom)}</h2>
                ${projet.description ? `<p class="projet-entete-desc">${echapper(projet.description)}</p>` : ''}
            </div>
        </div>
        <div class="projet-entete-actions">
            <button class="btn btn-secondaire btn-sm" onclick="ouvrirModalProjet(${projet.id})">✏ Modifier</button>
            <button class="btn btn-primaire btn-sm" onclick="ajouterTacheRacine(${projet.id})">+ Ajouter une tâche</button>
        </div>
    `;
}

// ============================================================
// RENDU DE L'ARBRE (récursif)
// ============================================================

function rendreArbre(noeuds, conteneur, profondeur, projetId) {
    conteneur.innerHTML = '';

    if (noeuds.length === 0 && profondeur === 0) {
        conteneur.innerHTML = `
            <div class="arbre-vide">
                <p>Aucune tâche dans ce projet.</p>
                <button class="btn btn-primaire btn-sm" onclick="ajouterTacheRacine(${projetId})">
                    + Ajouter la première tâche
                </button>
            </div>
        `;
        return;
    }

    noeuds.forEach(tache => {
        conteneur.appendChild(creerLigneArbre(tache, profondeur, projetId));
    });
}

function creerLigneArbre(tache, profondeur, projetId) {
    const aEnfants = tache.sous_taches && tache.sous_taches.length > 0;
    const zone = ZONES_LABELS[tache.zone] || { label: tache.zone, classe: '', couleur: '#6b7280' };
    const estFait = tache.zone === 'fait';

    // Wrapper (ligne + enfants)
    const wrapper = document.createElement('div');
    wrapper.className = 'arbre-wrapper';

    // Ligne principale
    const ligne = document.createElement('div');
    ligne.className = 'arbre-ligne' + (estFait ? ' arbre-ligne-fait' : '');
    ligne.dataset.id = tache.id;
    ligne.style.paddingLeft = (profondeur * 28 + 8) + 'px';

    // Indicateur de niveau (trait vertical sur le côté)
    const indicateur = document.createElement('div');
    indicateur.className = 'arbre-indicateur';
    indicateur.style.background = zone.couleur;

    // Chevron pliable
    const chevronZone = document.createElement('span');
    chevronZone.className = 'arbre-chevron-zone';
    if (aEnfants) {
        const chevron = document.createElement('button');
        chevron.className = 'arbre-chevron ouvert';
        chevron.textContent = '▼';
        chevron.type = 'button';
        chevronZone.appendChild(chevron);
    } else {
        chevronZone.innerHTML = '<span class="arbre-feuille">◆</span>';
    }

    // Contenu principal de la ligne
    const contenu = document.createElement('div');
    contenu.className = 'arbre-contenu';

    const titre = document.createElement('span');
    titre.className = 'arbre-titre' + (estFait ? ' arbre-titre-fait' : '');
    titre.textContent = tache.titre;

    const meta = document.createElement('div');
    meta.className = 'arbre-meta';

    const chipZone = document.createElement('span');
    chipZone.className = `zone-chip ${zone.classe}`;
    chipZone.textContent = zone.label;
    meta.appendChild(chipZone);

    if (tache.date_echeance) {
        const dateSpan = document.createElement('span');
        const enRetard = tache.date_echeance < formaterDateISO(new Date()) && !estFait;
        dateSpan.className = 'arbre-date' + (enRetard ? ' arbre-date-retard' : '');
        dateSpan.textContent = '📅 ' + formaterDate(tache.date_echeance);
        meta.appendChild(dateSpan);
    }

    if (tache.duree_estimee) {
        const dureeSpan = document.createElement('span');
        dureeSpan.className = 'arbre-duree';
        dureeSpan.textContent = `⏱ ${formaterDuree(tache.duree_estimee)}`;
        meta.appendChild(dureeSpan);
    }

    contenu.appendChild(titre);
    contenu.appendChild(meta);

    // Actions (visibles au survol)
    const actions = document.createElement('div');
    actions.className = 'arbre-actions';

    const btnSousTache = document.createElement('button');
    btnSousTache.className = 'btn-arbre';
    btnSousTache.title = 'Ajouter une sous-tâche';
    btnSousTache.textContent = '+ Sous-tâche';
    btnSousTache.addEventListener('click', (e) => {
        e.stopPropagation();
        ajouterSousTache(tache.id, projetId);
    });

    const btnModifier = document.createElement('button');
    btnModifier.className = 'btn-arbre';
    btnModifier.title = 'Modifier';
    btnModifier.textContent = '✏';
    btnModifier.addEventListener('click', (e) => {
        e.stopPropagation();
        ouvrirModal(tache);
    });

    const btnSupprimer = document.createElement('button');
    btnSupprimer.className = 'btn-arbre btn-arbre-danger';
    btnSupprimer.title = 'Supprimer';
    btnSupprimer.textContent = '🗑';
    btnSupprimer.addEventListener('click', (e) => {
        e.stopPropagation();
        supprimerTacheDuProjet(tache.id);
    });

    actions.appendChild(btnSousTache);
    actions.appendChild(btnModifier);
    actions.appendChild(btnSupprimer);

    ligne.appendChild(indicateur);
    ligne.appendChild(chevronZone);
    ligne.appendChild(contenu);
    ligne.appendChild(actions);
    wrapper.appendChild(ligne);

    // Zone enfants (pliable)
    if (aEnfants) {
        const enfants = document.createElement('div');
        enfants.className = 'arbre-enfants';

        tache.sous_taches.forEach(st => {
            enfants.appendChild(creerLigneArbre(st, profondeur + 1, projetId));
        });
        wrapper.appendChild(enfants);

        // Gestion du pli/dépli
        const chevron = ligne.querySelector('.arbre-chevron');
        chevron.addEventListener('click', (e) => {
            e.stopPropagation();
            const ouvert = chevron.classList.contains('ouvert');
            enfants.style.display = ouvert ? 'none' : '';
            chevron.textContent = ouvert ? '▶' : '▼';
            chevron.classList.toggle('ouvert', !ouvert);
        });
    }

    return wrapper;
}

// ============================================================
// AJOUTER UNE TÂCHE RACINE (sans parent)
// ============================================================

function ajouterTacheRacine(projetId) {
    ouvrirModal(null, null, null);
    setTimeout(() => {
        document.getElementById('tache-projet-id').value = projetId;
        document.getElementById('tache-parent-id').value = '';
        document.getElementById('modal-titre-label').textContent = '+ Nouvelle tâche du projet';
    }, 10);
}

// ============================================================
// AJOUTER UNE SOUS-TÂCHE
// ============================================================

function ajouterSousTache(parentId, projetId) {
    ouvrirModal(null, null, null);
    setTimeout(() => {
        document.getElementById('tache-projet-id').value = projetId;
        document.getElementById('tache-parent-id').value = parentId;
        document.getElementById('modal-titre-label').textContent = '+ Nouvelle sous-tâche';
    }, 10);
}

// ============================================================
// SUPPRIMER UNE TÂCHE (→ corbeille)
// ============================================================

async function supprimerTacheDuProjet(tacheId) {
    if (!confirm('Envoyer cette tâche (et ses sous-tâches) à la corbeille ?')) return;
    try {
        await fetch(`/api/tasks/${tacheId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: 'corbeille' }),
        });
        // Recharger l'arbre
        await selectionnerProjet(projetActifId);
        await rafraichirStatsProjets();
    } catch {
        alert('Erreur lors de la suppression.');
    }
}

// ============================================================
// CALLBACK APRÈS SAUVEGARDE TÂCHE (depuis base.html)
// ============================================================

function apresModificationTache(tache, estModification) {
    // Recharger l'arbre si la tâche appartient au projet actif
    if (tache.projet_id === projetActifId || projetActifId) {
        selectionnerProjet(projetActifId);
        rafraichirStatsProjets();
    }
}

// ============================================================
// CRUD PROJETS
// ============================================================

function ouvrirModalProjet(projetId = null) {
    const overlay = document.getElementById('modal-projet-overlay');
    const titreMod = document.getElementById('modal-projet-titre');
    const erreurs = document.getElementById('modal-projet-erreurs');
    erreurs.style.display = 'none';
    document.getElementById('form-projet').reset();

    if (projetId) {
        const p = projets.find(p => p.id === projetId);
        if (!p) return;
        titreMod.textContent = '✏ Modifier le projet';
        document.getElementById('projet-id').value = p.id;
        document.getElementById('projet-nom').value = p.nom;
        document.getElementById('projet-description').value = p.description || '';
        document.getElementById('projet-icone').value = p.icone || '📁';
        document.getElementById('projet-couleur').value = p.couleur || '#3b82f6';
    } else {
        titreMod.textContent = 'Nouveau projet';
        document.getElementById('projet-id').value = '';
        document.getElementById('projet-couleur').value = '#3b82f6';
        document.getElementById('projet-icone').value = '📁';
    }

    overlay.classList.add('actif');
}

function fermerModalProjet() {
    document.getElementById('modal-projet-overlay').classList.remove('actif');
}

function fermerModalProjetSiExterieur(e) {
    if (e.target === document.getElementById('modal-projet-overlay')) fermerModalProjet();
}

async function sauvegarderProjet(event) {
    event.preventDefault();
    const erreurs = document.getElementById('modal-projet-erreurs');
    erreurs.style.display = 'none';

    const projetId = document.getElementById('projet-id').value;
    const donnees = {
        nom:         document.getElementById('projet-nom').value.trim(),
        description: document.getElementById('projet-description').value.trim() || null,
        icone:       document.getElementById('projet-icone').value.trim() || '📁',
        couleur:     document.getElementById('projet-couleur').value,
    };

    try {
        const url = projetId ? `/api/projects/${projetId}` : '/api/projects';
        const methode = projetId ? 'PUT' : 'POST';
        const rep = await fetch(url, {
            method: methode,
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
        fermerModalProjet();
        await rafraichirStatsProjets();
        // Si nouveau projet → le sélectionner
        if (!projetId) {
            selectionnerProjet(res.id);
        } else if (projetActifId === parseInt(projetId)) {
            selectionnerProjet(projetActifId);
        }
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

async function supprimerProjet(projetId) {
    const p = projets.find(p => p.id === projetId);
    if (!confirm(`Supprimer le projet "${p?.nom}" ? Les tâches ne seront pas perdues.`)) return;
    try {
        await fetch(`/api/projects/${projetId}`, { method: 'DELETE' });
        projets = projets.filter(p => p.id !== projetId);
        if (projetActifId === projetId) {
            projetActifId = null;
            document.getElementById('projet-vide').style.display = '';
            document.getElementById('projet-contenu').style.display = 'none';
        }
        rendreListeProjets();
    } catch {
        alert('Erreur lors de la suppression.');
    }
}

// ============================================================
// RAFRAÎCHIR LES STATISTIQUES DES PROJETS
// ============================================================

async function rafraichirStatsProjets() {
    try {
        const rep = await fetch('/api/projects');
        projets = await rep.json();
        rendreListeProjets();
    } catch {}
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

// ============================================================
// SAUVEGARDE LOT (récurrence "Autres" — dates spécifiques)
// ============================================================

async function sauvegarderLotProjet(event) {
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
        projet_id:    document.getElementById('tache-projet-id').value
            ? parseInt(document.getElementById('tache-projet-id').value) : null,
        recurrence:   'Une fois',
        dates:        [...datesModalSelectionnees].sort(),
    };

    if (!donnees.titre) {
        erreurs.textContent = 'Le titre est obligatoire.';
        erreurs.style.display = 'block';
        return;
    }
    if (donnees.dates.length === 0) {
        erreurs.textContent = 'Sélectionne au moins une date dans le calendrier.';
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
        fermerModal();
        if (projetActifId) chargerProjet(projetActifId);
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}
