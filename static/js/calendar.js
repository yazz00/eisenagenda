// ===== CALENDRIER UNIFIÉ — Jour / 3 Jours / Semaine / Mois =====

// Noms français
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_LONGS  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS_NOMS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Bornes par défaut de la timeline
const TL_HEURE_DEBUT   = 5;
const TL_HEURE_FIN     = 24;
const TL_MIN_DEBUT     = TL_HEURE_DEBUT * 60;
const TL_PX_MIN_JOUR   = 0.7;
const TL_PX_MIN_SEM    = 0.7;

/**
 * Calcule la plage horaire optimale selon les tâches planifiées.
 * N'ajuste les bornes que si une tâche dépasse les valeurs par défaut.
 */
function calculerPlageHoraire(tachesAvecHeure) {
    let heureMin = TL_HEURE_DEBUT;
    let heureMax = TL_HEURE_FIN;

    tachesAvecHeure.forEach(t => {
        const minDebut = t._debutAffiche !== undefined ? t._debutAffiche : (t.heure_debut ? heureVersMinutes(t.heure_debut) : null);
        if (minDebut === null) return;
        const duree  = t._dureeAffichee !== undefined ? t._dureeAffichee : (t.duree_estimee || 30);
        const minFin = minDebut + duree;
        const hDebut = Math.floor(minDebut / 60);
        const hFin   = Math.ceil(minFin   / 60);

        if (hDebut < heureMin) heureMin = Math.max(0,  hDebut - 1);
        if (hFin   > heureMax) heureMax = Math.min(25, hFin   + 1);
    });

    return { debut: heureMin, fin: heureMax };
}

// État global
let taches = [...tachesInitiales];
let vueActuelle = 'jour';
let dateActuelle = new Date();

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', () => {
    changerVue('jour');
});

// ===== NAVIGATION =====

function naviguer(direction) {
    if (vueActuelle === 'jour') {
        dateActuelle.setDate(dateActuelle.getDate() + direction);
    } else if (vueActuelle === '3jours') {
        dateActuelle.setDate(dateActuelle.getDate() + direction * 3);
    } else if (vueActuelle === 'semaine') {
        dateActuelle.setDate(dateActuelle.getDate() + direction * 7);
    } else {
        dateActuelle.setMonth(dateActuelle.getMonth() + direction);
    }
    rendreCalerendrier();
}

function allerAujourdhui() {
    dateActuelle = new Date();
    rendreCalerendrier();
}

function changerVue(nouvelle) {
    vueActuelle = nouvelle;
    ['jour', '3jours', 'semaine', 'mois'].forEach(v => {
        const btn = document.getElementById(`btn-vue-${v}`);
        if (btn) btn.classList.toggle('actif', v === nouvelle);
    });
    // Bouton config visible sauf en vue mois
    document.getElementById('btn-config-journee').style.display =
        nouvelle === 'mois' ? 'none' : '';
    rendreCalerendrier();
}

function rendreCalerendrier() {
    if      (vueActuelle === 'jour')    rendreJour();
    else if (vueActuelle === '3jours')  rendreTroisJours();
    else if (vueActuelle === 'semaine') rendreSemaine();
    else                                rendreMois();
}

// ============================================================
// VUE JOUR
// ============================================================

function rendreJour() {
    const dateISO = formaterDateISO(dateActuelle);
    const aujourd_hui = formaterDateISO(new Date());
    const estAujourd_hui = dateISO === aujourd_hui;

    const label = `${JOURS_LONGS[(dateActuelle.getDay() + 6) % 7]} ${dateActuelle.getDate()} ${MOIS_NOMS[dateActuelle.getMonth()]} ${dateActuelle.getFullYear()}`;
    document.getElementById('titre-periode').textContent = estAujourd_hui ? `☀ Aujourd'hui — ${label}` : label;

    const tachesJour = taches.filter(t => t.date_echeance === dateISO);
    const planifiees = tachesPlanifieesAvecDebordement(dateISO);
    const nonPlanif  = tachesJour.filter(t => !t.heure_debut);

    const conteneur = document.getElementById('calendrier-conteneur');
    conteneur.innerHTML = '';
    conteneur.className = 'today-layout';

    conteneur.appendChild(creerPanneauNonPlanifiees(nonPlanif, dateISO));

    const plage = calculerPlageHoraire(planifiees);
    const tlConteneur = document.createElement('div');
    tlConteneur.className = 'today-timeline-conteneur';
    tlConteneur.appendChild(
        construireTimeline(TL_PX_MIN_JOUR, planifiees, estAujourd_hui, dateISO, plage.debut, plage.fin)
    );
    conteneur.appendChild(tlConteneur);
}

// ============================================================
// VUE 3 JOURS
// ============================================================

function rendreTroisJours() {
    rendreVueMultiJours(new Date(dateActuelle), 3);
}

// ============================================================
// VUE SEMAINE
// ============================================================

function rendreSemaine() {
    const jourSemaine = dateActuelle.getDay();
    const decalage = jourSemaine === 0 ? -6 : 1 - jourSemaine;
    const lundi = new Date(dateActuelle);
    lundi.setDate(dateActuelle.getDate() + decalage);
    rendreVueMultiJours(lundi, 7);
}

// ============================================================
// VUE MULTI-JOURS PARTAGÉE (3 jours + Semaine)
// ============================================================

function rendreVueMultiJours(premierJour, nbJours) {
    const dernierJour = new Date(premierJour);
    dernierJour.setDate(premierJour.getDate() + nbJours - 1);
    const today = formaterDateISO(new Date());

    // Titre de la période
    const deb = `${premierJour.getDate()} ${MOIS_NOMS[premierJour.getMonth()].substring(0, 3)}.`;
    const fin = `${dernierJour.getDate()} ${MOIS_NOMS[dernierJour.getMonth()].substring(0, 3)}. ${dernierJour.getFullYear()}`;
    document.getElementById('titre-periode').textContent = `${deb} – ${fin}`;

    // Collecter les infos par jour
    const joursInfos = [];
    for (let i = 0; i < nbJours; i++) {
        const d = new Date(premierJour);
        d.setDate(premierJour.getDate() + i);
        const iso = formaterDateISO(d);
        const tachesJour = taches.filter(t => t.date_echeance === iso);
        joursInfos.push({
            date: d,
            iso,
            label: `${JOURS_COURTS[(d.getDay() + 6) % 7]} ${d.getDate()}`,
            planifiees: tachesPlanifieesAvecDebordement(iso),
            nonPlanif:  tachesJour.filter(t => !t.heure_debut),
        });
    }

    // Plage horaire sur toute la période
    const tousesPlanifiees = joursInfos.flatMap(j => j.planifiees);
    const plage = calculerPlageHoraire(tousesPlanifiees);
    const heureDebut    = plage.debut;
    const heureFin      = plage.fin;
    const minDebut      = heureDebut * 60;
    const hauteurTotale = (heureFin - heureDebut) * 60 * TL_PX_MIN_SEM;

    const conteneur = document.getElementById('calendrier-conteneur');
    conteneur.innerHTML = '';
    conteneur.className = 'today-layout';

    // ── Panneau non planifiées (gauche) ──
    conteneur.appendChild(creerPanneauNonPlanifieesMulti(joursInfos));

    // ── Timeline (droite) ──
    const scroll = document.createElement('div');
    scroll.className = 'semaine-tl-scroll';

    const wrapper = document.createElement('div');
    wrapper.className = 'semaine-tl-wrapper';

    // Colonne des heures avec spacer pour s'aligner sous l'entête
    const colonneHeures = document.createElement('div');
    colonneHeures.className = 'semaine-tl-heures';

    // Spacer : même hauteur que semaine-tl-entete
    const spacer = document.createElement('div');
    spacer.className = 'semaine-tl-entete semaine-tl-heures-spacer';
    colonneHeures.appendChild(spacer);

    // Container pour les labels d'heures (position relative, hauteur fixe)
    const labelsContainer = document.createElement('div');
    labelsContainer.style.cssText = `position: relative; height: ${hauteurTotale}px; overflow: hidden;`;

    for (let h = heureDebut; h < heureFin; h++) {
        const label = document.createElement('div');
        label.className = 'semaine-tl-heure-label';
        label.style.top = ((h - heureDebut) * 60 * TL_PX_MIN_SEM) + 'px';
        label.textContent = `${String(h % 24).padStart(2, '0')}:00`;
        labelsContainer.appendChild(label);
    }
    colonneHeures.appendChild(labelsContainer);
    wrapper.appendChild(colonneHeures);

    // Colonnes de jours
    joursInfos.forEach(({ date, iso, label, planifiees, nonPlanif }) => {
        const estAujourd_hui = iso === today;

        const colonne = document.createElement('div');
        colonne.className = 'semaine-tl-colonne';

        // En-tête cliquable → vue jour
        const entete = document.createElement('div');
        entete.className = 'semaine-tl-entete' + (estAujourd_hui ? ' aujourd-hui' : '');
        entete.textContent = label;
        entete.addEventListener('click', () => {
            dateActuelle = new Date(date);
            changerVue('jour');
        });
        colonne.appendChild(entete);

        // Zone timeline
        const zone = document.createElement('div');
        zone.className = 'semaine-tl-zone';
        zone.style.height = hauteurTotale + 'px';

        // Lignes d'heures (h < heureFin pour éviter le dépassement)
        for (let h = heureDebut; h < heureFin; h++) {
            const ligne = document.createElement('div');
            ligne.className = 'semaine-tl-ligne-heure';
            ligne.style.top = ((h - heureDebut) * 60 * TL_PX_MIN_SEM) + 'px';
            zone.appendChild(ligne);
        }

        // Blocs de pauses
        creerBlocsPauses(zone, TL_PX_MIN_SEM, true, minDebut, heureFin);

        // Tâches planifiées
        planifiees.forEach(t => zone.appendChild(creerBlocTache(t, TL_PX_MIN_SEM, minDebut)));

        // Clic sur créneau libre → créer tâche
        zone.addEventListener('click', e => {
            if (e.target !== zone) return;
            const rect = zone.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const minutes = minDebut + Math.round(y / TL_PX_MIN_SEM / 15) * 15;
            ouvrirModal(null, null, minutesVersHeure(minutes));
            setTimeout(() => { document.getElementById('tache-date').value = iso; }, 50);
        });

        // Indicateur "maintenant"
        if (estAujourd_hui) {
            const maint = new Date();
            const minMaint = maint.getHours() * 60 + maint.getMinutes();
            if (minMaint >= minDebut && minMaint <= heureFin * 60) {
                const ind = document.createElement('div');
                ind.className = 'timeline-maintenant';
                ind.style.top = ((minMaint - minDebut) * TL_PX_MIN_SEM) + 'px';
                zone.appendChild(ind);
            }
        }

        colonne.appendChild(zone);
        wrapper.appendChild(colonne);
    });

    scroll.appendChild(wrapper);
    conteneur.appendChild(scroll);
}

// ============================================================
// VUE MOIS
// ============================================================

function rendreMois() {
    const annee = dateActuelle.getFullYear();
    const mois  = dateActuelle.getMonth();
    document.getElementById('titre-periode').textContent = `${MOIS_NOMS[mois]} ${annee}`;

    const premierJour = new Date(annee, mois, 1);
    let debutSemaine = premierJour.getDay() - 1;
    if (debutSemaine < 0) debutSemaine = 6;
    const dernierJour = new Date(annee, mois + 1, 0).getDate();
    const aujourd_hui = new Date(); aujourd_hui.setHours(0, 0, 0, 0);

    const conteneur = document.getElementById('calendrier-conteneur');
    conteneur.innerHTML = '';
    conteneur.className = 'calendrier-grille';

    const entetes = document.createElement('div');
    entetes.className = 'calendrier-entetes';
    JOURS_COURTS.forEach(j => {
        const th = document.createElement('div');
        th.className = 'calendrier-entete';
        th.textContent = j;
        entetes.appendChild(th);
    });
    conteneur.appendChild(entetes);

    const grille = document.createElement('div');
    grille.className = 'calendrier-jours';

    const moisPrec = new Date(annee, mois, 0);
    for (let i = debutSemaine - 1; i >= 0; i--) {
        grille.appendChild(creerCelluleMois(new Date(annee, mois - 1, moisPrec.getDate() - i), true, false));
    }

    for (let j = 1; j <= dernierJour; j++) {
        const d = new Date(annee, mois, j);
        grille.appendChild(creerCelluleMois(d, false, d.getTime() === aujourd_hui.getTime()));
    }

    const reste = grille.children.length % 7;
    if (reste > 0) {
        for (let j = 1; j <= 7 - reste; j++) {
            grille.appendChild(creerCelluleMois(new Date(annee, mois + 1, j), true, false));
        }
    }

    conteneur.appendChild(grille);
}

function creerCelluleMois(date, autreMois, estAujourd_hui) {
    const dateISO = formaterDateISO(date);
    const cellule = document.createElement('div');
    cellule.className = 'calendrier-jour' +
        (autreMois ? ' autre-mois' : '') +
        (estAujourd_hui ? ' aujourd-hui' : '');

    const num = document.createElement('div');
    num.className = 'jour-numero';
    num.textContent = date.getDate();
    cellule.appendChild(num);

    const divTaches = document.createElement('div');
    divTaches.className = 'jour-taches';
    taches.filter(t => t.date_echeance === dateISO).forEach(t => {
        const chip = document.createElement('div');
        chip.className = `tache-cal zone-${t.zone.replace(/_/g, '-')}`;
        chip.textContent = t.titre;
        chip.addEventListener('click', e => { e.stopPropagation(); ouvrirModal(t); });
        divTaches.appendChild(chip);
    });
    cellule.appendChild(divTaches);

    cellule.addEventListener('click', e => {
        if (!autreMois && (e.target === cellule || e.target === num || e.target === divTaches)) {
            dateActuelle = new Date(date);
            changerVue('jour');
        }
    });

    return cellule;
}

// ============================================================
// CONSTRUCTION TIMELINE (vue Jour)
// ============================================================

function construireTimeline(pxParMin, planifiees, estAujourd_hui, dateISO,
                            heureDebut = TL_HEURE_DEBUT, heureFin = TL_HEURE_FIN) {
    const minDebut = heureDebut * 60;
    const hauteurTotale = (heureFin - heureDebut) * 60 * pxParMin;

    const tl = document.createElement('div');
    tl.className = 'timeline';
    tl.style.height = hauteurTotale + 'px';

    // Marqueurs d'heures (h < heureFin pour éviter le dépassement)
    for (let h = heureDebut; h < heureFin; h++) {
        for (let m = 0; m < 60; m += 30) {
            const minutes = h * 60 + m;
            const top = (minutes - minDebut) * pxParMin;

            const marqueur = document.createElement('div');
            marqueur.className = 'timeline-marqueur' + (m === 0 ? ' timeline-marqueur-heure' : '');
            marqueur.style.top = top + 'px';

            if (m === 0) {
                const label = document.createElement('div');
                label.className = 'timeline-label';
                label.textContent = `${String(h % 24).padStart(2, '0')}:00`;
                marqueur.appendChild(label);
            }
            tl.appendChild(marqueur);
        }
    }

    // Blocs de pauses
    creerBlocsPauses(tl, pxParMin, false, minDebut, heureFin);

    // Zone cliquable
    const zone = document.createElement('div');
    zone.className = 'timeline-zone-clics';
    zone.style.height = hauteurTotale + 'px';
    zone.addEventListener('click', e => {
        const rect = tl.getBoundingClientRect();
        const scrollTop = tl.parentElement.scrollTop || 0;
        const y = e.clientY - rect.top + scrollTop;
        const minutes = minDebut + Math.round(y / pxParMin / 15) * 15;
        ouvrirModal(null, null, minutesVersHeure(minutes));
        setTimeout(() => { document.getElementById('tache-date').value = dateISO; }, 50);
    });
    tl.appendChild(zone);

    // Tâches planifiées
    planifiees.forEach(t => tl.appendChild(creerBlocTache(t, pxParMin, minDebut)));

    // Indicateur "maintenant"
    if (estAujourd_hui) {
        const maint = new Date();
        const min = maint.getHours() * 60 + maint.getMinutes();
        if (min >= minDebut && min <= heureFin * 60) {
            const ind = document.createElement('div');
            ind.className = 'timeline-maintenant';
            ind.style.top = ((min - minDebut) * pxParMin) + 'px';
            tl.appendChild(ind);
            setInterval(() => {
                const m2 = new Date().getHours() * 60 + new Date().getMinutes();
                ind.style.top = ((m2 - minDebut) * pxParMin) + 'px';
            }, 60000);
        }
    }

    return tl;
}

function creerBlocsPauses(conteneur, pxParMin, compact,
                          minDebut = TL_MIN_DEBUT, heureFin = TL_HEURE_FIN) {
    const pauses = [
        { label: '🌅 Réveil & routine', heure: configJournee.heure_reveil,  duree: configJournee.duree_routine_matin, classe: 'pause-matin'    },
        { label: '🍽 Déjeuner',         heure: configJournee.heure_dejeuner, duree: configJournee.duree_dejeuner,      classe: 'pause-dejeuner' },
        { label: '🌙 Dîner',            heure: configJournee.heure_diner,    duree: configJournee.duree_diner,         classe: 'pause-diner'    },
    ];
    if (configJournee.gouter_actif) {
        pauses.push({ label: '🍰 Goûter', heure: configJournee.heure_gouter, duree: configJournee.duree_gouter, classe: 'pause-gouter' });
    }

    pauses.forEach(p => {
        if (!p.heure || !p.duree) return;
        const min = heureVersMinutes(p.heure);
        if (min < minDebut || min >= heureFin * 60) return;
        const bloc = document.createElement('div');
        bloc.className = `bloc-pause ${p.classe}`;
        bloc.style.top    = ((min - minDebut) * pxParMin) + 'px';
        bloc.style.height = Math.max(p.duree * pxParMin, 20) + 'px';
        bloc.textContent  = compact ? '' : `${p.label} (${p.duree} min)`;
        bloc.title        = `${p.label} — ${p.heure}, ${p.duree} min`;
        conteneur.appendChild(bloc);
    });
}

function creerBlocTache(tache, pxParMin, minDebut = TL_MIN_DEBUT) {
    const min   = tache._debutAffiche !== undefined ? tache._debutAffiche : heureVersMinutes(tache.heure_debut);
    const duree = tache._dureeAffichee !== undefined ? tache._dureeAffichee : (tache.duree_estimee || 30);
    const hauteur = Math.max(duree * pxParMin, 22);

    const classes = {
        urgent_important: 'zone-bloc-rouge', important: 'zone-bloc-bleu',
        urgent: 'zone-bloc-ambre', neutre: 'zone-bloc-gris', fait: 'zone-bloc-vert',
    };

    const bloc = document.createElement('div');
    const debordeMinuit = !tache._suite && (heureVersMinutes(tache.heure_debut) + (tache.duree_estimee || 30)) > 1440;
    let className = `bloc-tache ${classes[tache.zone] || 'zone-bloc-gris'}`;
    if (tache._suite) className += ' bloc-tache-suite';
    if (debordeMinuit) className += ' bloc-tache-coupe';
    bloc.className = className;
    bloc.style.top    = ((min - minDebut) * pxParMin) + 'px';
    bloc.style.height = hauteur + 'px';

    const debutReel = heureVersMinutes(tache.heure_debut);
    const finReel   = minutesVersHeure(debutReel + (tache.duree_estimee || 30));
    const labelHeure = tache._suite
        ? `00:00 → ${finReel} (suite)`
        : `${tache.heure_debut} → ${minutesVersHeure(min + duree)}${duree < (tache.duree_estimee || 30) ? ' →' : ''}`;

    const htmlDesc = (hauteur >= 54 && tache.description)
        ? `<div class="bloc-tache-desc">${echapper(tache.description)}</div>` : '';
    bloc.innerHTML = hauteur >= 36
        ? `<div class="bloc-tache-titre">${echapper(tache.titre)}</div>
           ${htmlDesc}
           <div class="bloc-tache-meta">${labelHeure}</div>`
        : `<div class="bloc-tache-titre">${echapper(tache.titre)}</div>`;

    bloc.addEventListener('click', e => { e.stopPropagation(); ouvrirModal(tache); });
    return bloc;
}

// ============================================================
// PANNEAU TÂCHES NON PLANIFIÉES
// ============================================================

function creerPanneauNonPlanifiees(nonPlanif, dateISO) {
    const panneau = document.createElement('div');
    panneau.className = 'today-panneau';

    const titre = document.createElement('div');
    titre.className = 'panneau-titre';
    titre.textContent = '📋 Non planifiées';
    panneau.appendChild(titre);

    const liste = document.createElement('div');
    liste.className = 'panneau-taches';

    if (nonPlanif.length === 0) {
        liste.innerHTML = '<p style="font-size:0.82rem;color:var(--texte-secondaire);text-align:center;padding:0.75rem 0;">Toutes planifiées !</p>';
    } else {
        nonPlanif.forEach(t => {
            liste.appendChild(creerCartePanneau(t));
        });
    }
    panneau.appendChild(liste);

    const btnAjouter = document.createElement('button');
    btnAjouter.className = 'btn btn-secondaire btn-sm';
    btnAjouter.style.cssText = 'margin-top:0.75rem;width:100%;';
    btnAjouter.textContent = '+ Ajouter une tâche';
    btnAjouter.addEventListener('click', () => {
        ouvrirModal(null, null, null);
        setTimeout(() => { document.getElementById('tache-date').value = dateISO; }, 50);
    });
    panneau.appendChild(btnAjouter);

    return panneau;
}

/**
 * Panneau non planifiées pour les vues multi-jours (semaine, 3 jours).
 * Regroupe les tâches par jour.
 */
function creerPanneauNonPlanifieesMulti(joursInfos) {
    const panneau = document.createElement('div');
    panneau.className = 'today-panneau';

    const titre = document.createElement('div');
    titre.className = 'panneau-titre';
    titre.textContent = '📋 Non planifiées';
    panneau.appendChild(titre);

    const liste = document.createElement('div');
    liste.className = 'panneau-taches';

    let total = 0;
    joursInfos.forEach(({ iso, label, nonPlanif }) => {
        if (nonPlanif.length === 0) return;
        total += nonPlanif.length;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'panneau-jour-label';
        labelDiv.textContent = label;
        liste.appendChild(labelDiv);

        nonPlanif.forEach(t => liste.appendChild(creerCartePanneau(t, iso)));
    });

    if (total === 0) {
        liste.innerHTML = '<p style="font-size:0.82rem;color:var(--texte-secondaire);text-align:center;padding:0.75rem 0;">Toutes planifiées !</p>';
    }

    panneau.appendChild(liste);
    return panneau;
}

/** Crée une carte dans le panneau non-planifiées. */
function creerCartePanneau(t, dateISO) {
    const carte = document.createElement('div');
    carte.className = 'carte-panneau';
    carte.innerHTML = `
        <div class="carte-panneau-point zone-point-${t.zone.replace(/_/g, '-')}"></div>
        <div class="carte-panneau-info">
            <div class="carte-panneau-titre">${echapper(t.titre)}</div>
            ${t.duree_estimee ? `<div class="carte-panneau-duree">⏱ ${formaterDuree(t.duree_estimee)}</div>` : ''}
        </div>
        <button class="btn-action btn-modifier"
                onclick="ouvrirModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">✏</button>
    `;
    return carte;
}

// ============================================================
// CONFIG JOURNÉE
// ============================================================

async function ouvrirConfigJournee() {
    try {
        const rep = await fetch('/api/config/journee');
        const cfg = await rep.json();
        configJournee = cfg;
        document.getElementById('cfg-heure-reveil').value    = cfg.heure_reveil || '07:00';
        document.getElementById('cfg-duree-matin').value     = cfg.duree_routine_matin || 60;
        document.getElementById('cfg-heure-dejeuner').value  = cfg.heure_dejeuner || '12:30';
        document.getElementById('cfg-duree-dejeuner').value  = cfg.duree_dejeuner || 60;
        document.getElementById('cfg-heure-diner').value     = cfg.heure_diner || '19:30';
        document.getElementById('cfg-duree-diner').value     = cfg.duree_diner || 45;
        document.getElementById('cfg-gouter-actif').checked  = cfg.gouter_actif || false;
        document.getElementById('cfg-heure-gouter').value    = cfg.heure_gouter || '16:30';
        document.getElementById('cfg-duree-gouter').value    = cfg.duree_gouter || 30;
        basculerGouter(cfg.gouter_actif || false);
        document.getElementById('modal-config-overlay').classList.add('actif');
    } catch { alert('Erreur de connexion.'); }
}

function basculerGouter(actif) {
    document.getElementById('cfg-gouter-details').style.display = actif ? '' : 'none';
}

function fermerConfigJournee() {
    document.getElementById('modal-config-overlay').classList.remove('actif');
}

function fermerConfigSiExterieur(e) {
    if (e.target === document.getElementById('modal-config-overlay')) fermerConfigJournee();
}

async function sauvegarderConfig(e) {
    e.preventDefault();
    const erreurs = document.getElementById('config-erreurs');
    erreurs.style.display = 'none';

    const donnees = {
        heure_reveil:         document.getElementById('cfg-heure-reveil').value,
        duree_routine_matin:  parseInt(document.getElementById('cfg-duree-matin').value)    || 0,
        heure_dejeuner:       document.getElementById('cfg-heure-dejeuner').value,
        duree_dejeuner:       parseInt(document.getElementById('cfg-duree-dejeuner').value) || 0,
        heure_diner:          document.getElementById('cfg-heure-diner').value,
        duree_diner:          parseInt(document.getElementById('cfg-duree-diner').value)    || 0,
        gouter_actif:         document.getElementById('cfg-gouter-actif').checked,
        heure_gouter:         document.getElementById('cfg-heure-gouter').value,
        duree_gouter:         parseInt(document.getElementById('cfg-duree-gouter').value)   || 0,
    };

    try {
        const rep = await fetch('/api/config/journee', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });
        const res = await rep.json();
        if (!rep.ok) {
            erreurs.innerHTML = (res.erreurs || [res.erreur || 'Erreur']).join('<br>');
            erreurs.style.display = 'block';
            return;
        }
        configJournee = res;
        fermerConfigJournee();
        rendreCalerendrier();
    } catch {
        erreurs.textContent = 'Erreur de connexion.';
        erreurs.style.display = 'block';
    }
}

// ============================================================
// CALLBACK APRÈS SAUVEGARDE TÂCHE (depuis base.html)
// ============================================================

function apresModificationTache(tacheMisAJour, estModification) {
    if (estModification) {
        const idx = taches.findIndex(t => t.id === tacheMisAJour.id);
        if (idx !== -1) taches[idx] = tacheMisAJour;
        else taches.push(tacheMisAJour);
    } else {
        taches.push(tacheMisAJour);
    }
    rendreCalerendrier();
}

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Retourne les tâches planifiées pour un jour ISO donné,
 * en incluant les tâches du jour précédent qui débordent sur minuit.
 * Chaque tâche peut avoir un _offsetMin (décalage depuis minuit pour les débordements).
 */
function tachesPlanifieesAvecDebordement(isoJour) {
    const resultat = [];

    // Tâches du jour lui-même
    taches.filter(t => t.date_echeance === isoJour && t.heure_debut).forEach(t => {
        const debut = heureVersMinutes(t.heure_debut);
        const fin   = debut + (t.duree_estimee || 30);
        if (fin > 1440) {
            // Tronqué à minuit
            resultat.push({ ...t, _dureeAffichee: 1440 - debut, _suite: false });
        } else {
            resultat.push({ ...t, _dureeAffichee: t.duree_estimee || 30, _suite: false });
        }
    });

    // Tâches du jour PRÉCÉDENT qui débordent sur ce jour
    const datePrecedente = new Date(isoJour + 'T00:00:00');
    datePrecedente.setDate(datePrecedente.getDate() - 1);
    const isoPrecedent = formaterDateISO(datePrecedente);
    taches.filter(t => t.date_echeance === isoPrecedent && t.heure_debut).forEach(t => {
        const debut = heureVersMinutes(t.heure_debut);
        const fin   = debut + (t.duree_estimee || 30);
        if (fin > 1440) {
            // La partie qui déborde sur ce jour (de 0 à fin - 1440)
            resultat.push({ ...t, _debutAffiche: 0, _dureeAffichee: fin - 1440, _suite: true });
        }
    });

    return resultat;
}

function heureVersMinutes(heure) {
    const [h, m] = heure.split(':').map(Number);
    return h * 60 + m;
}

function minutesVersHeure(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formaterDateISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function echapper(texte) {
    if (!texte) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(texte));
    return d.innerHTML;
}
