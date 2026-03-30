// ===== CALENDRIER UNIFIÉ — Jour / Semaine / Mois =====

// Noms français
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_LONGS  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS_NOMS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Constantes timeline
const TL_HEURE_DEBUT   = 5;           // 5h00
const TL_HEURE_FIN     = 24;          // 00h00 (minuit)
const TL_MIN_DEBUT     = TL_HEURE_DEBUT * 60;
const TL_PX_MIN_JOUR   = 3;           // vue jour : 3px/min → 1h = 180px
const TL_PX_MIN_SEM    = 1.5;         // vue semaine : 1.5px/min → 1h = 90px

// État global
let taches = [...tachesInitiales];
let vueActuelle = 'mois';
let dateActuelle = new Date();

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', () => {
    rendreCalerendrier();
});

// ===== NAVIGATION =====

function naviguer(direction) {
    if (vueActuelle === 'jour') {
        dateActuelle.setDate(dateActuelle.getDate() + direction);
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
    ['jour', 'semaine', 'mois'].forEach(v => {
        document.getElementById(`btn-vue-${v}`).classList.toggle('actif', v === nouvelle);
    });
    // Bouton config visible uniquement en jour/semaine
    document.getElementById('btn-config-journee').style.display =
        nouvelle === 'mois' ? 'none' : '';
    // Champ heure dans le modal : visible en jour/semaine
    document.getElementById('groupe-heure-debut').style.display =
        nouvelle === 'mois' ? 'none' : 'block';
    rendreCalerendrier();
}

function rendreCalerendrier() {
    if (vueActuelle === 'jour')    rendreJour();
    else if (vueActuelle === 'semaine') rendreSemaine();
    else rendreMois();
}

// ============================================================
// VUE JOUR
// ============================================================

function rendreJour() {
    const dateISO = formaterDateISO(dateActuelle);
    const aujourd_hui = formaterDateISO(new Date());
    const estAujourd_hui = dateISO === aujourd_hui;

    // Titre
    const label = `${JOURS_LONGS[(dateActuelle.getDay() + 6) % 7]} ${dateActuelle.getDate()} ${MOIS_NOMS[dateActuelle.getMonth()]} ${dateActuelle.getFullYear()}`;
    document.getElementById('titre-periode').textContent = estAujourd_hui ? `☀ Aujourd'hui — ${label}` : label;

    // Tâches du jour
    const tachesJour = taches.filter(t => t.date_echeance === dateISO);
    const planifiees  = tachesJour.filter(t => t.heure_debut);
    const nonPlanif   = tachesJour.filter(t => !t.heure_debut);

    const conteneur = document.getElementById('calendrier-conteneur');
    conteneur.innerHTML = '';
    conteneur.className = 'today-layout';

    // Panneau gauche
    const panneau = creerPanneauNonPlanifiees(nonPlanif, dateISO);
    conteneur.appendChild(panneau);

    // Timeline
    const tlConteneur = document.createElement('div');
    tlConteneur.className = 'today-timeline-conteneur';
    const tl = construireTimeline(TL_PX_MIN_JOUR, planifiees, estAujourd_hui, dateISO);
    tlConteneur.appendChild(tl);
    conteneur.appendChild(tlConteneur);
}

// ============================================================
// VUE SEMAINE
// ============================================================

function rendreSemaine() {
    // Trouver le lundi
    const jourSemaine = dateActuelle.getDay();
    const decalage = jourSemaine === 0 ? -6 : 1 - jourSemaine;
    const lundi = new Date(dateActuelle);
    lundi.setDate(dateActuelle.getDate() + decalage);
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);

    const today = formaterDateISO(new Date());

    // Titre
    const deb = `${lundi.getDate()} ${MOIS_NOMS[lundi.getMonth()].substring(0, 3)}.`;
    const fin = `${dimanche.getDate()} ${MOIS_NOMS[dimanche.getMonth()].substring(0, 3)}. ${dimanche.getFullYear()}`;
    document.getElementById('titre-periode').textContent = `${deb} – ${fin}`;

    const conteneur = document.getElementById('calendrier-conteneur');
    conteneur.innerHTML = '';
    conteneur.className = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'semaine-tl-wrapper';

    // Colonne des heures (fixe à gauche)
    const colonneHeures = document.createElement('div');
    colonneHeures.className = 'semaine-tl-heures';
    const hauteurTotale = (TL_HEURE_FIN - TL_HEURE_DEBUT) * 60 * TL_PX_MIN_SEM;

    for (let h = TL_HEURE_DEBUT; h <= TL_HEURE_FIN; h++) {
        const label = document.createElement('div');
        label.className = 'semaine-tl-heure-label';
        label.style.top = ((h - TL_HEURE_DEBUT) * 60 * TL_PX_MIN_SEM) + 'px';
        label.textContent = `${String(h % 24).padStart(2, '0')}:00`;
        colonneHeures.appendChild(label);
    }
    colonneHeures.style.height = hauteurTotale + 'px';
    wrapper.appendChild(colonneHeures);

    // 7 colonnes de jours
    for (let i = 0; i < 7; i++) {
        const date = new Date(lundi);
        date.setDate(lundi.getDate() + i);
        const dateISO = formaterDateISO(date);
        const estAujourd_hui = dateISO === today;

        const colonne = document.createElement('div');
        colonne.className = 'semaine-tl-colonne';

        // En-tête du jour (cliquable → vue jour)
        const entete = document.createElement('div');
        entete.className = 'semaine-tl-entete' + (estAujourd_hui ? ' aujourd-hui' : '');
        entete.textContent = `${JOURS_COURTS[i]} ${date.getDate()}`;
        entete.addEventListener('click', () => {
            dateActuelle = new Date(date);
            changerVue('jour');
        });
        colonne.appendChild(entete);

        // Tâches non planifiées du jour (chips en haut)
        const nonPlanif = taches.filter(t => t.date_echeance === dateISO && !t.heure_debut);
        if (nonPlanif.length > 0) {
            const chipsDiv = document.createElement('div');
            chipsDiv.className = 'semaine-tl-chips';
            nonPlanif.forEach(t => {
                const chip = document.createElement('div');
                chip.className = `tache-cal zone-${t.zone.replace(/_/g, '-')}`;
                chip.textContent = t.titre;
                chip.addEventListener('click', () => ouvrirModal(t));
                chipsDiv.appendChild(chip);
            });
            colonne.appendChild(chipsDiv);
        }

        // Zone timeline de la colonne
        const zone = document.createElement('div');
        zone.className = 'semaine-tl-zone';
        zone.style.height = hauteurTotale + 'px';

        // Lignes d'heures
        for (let h = TL_HEURE_DEBUT; h <= TL_HEURE_FIN; h++) {
            const ligne = document.createElement('div');
            ligne.className = 'semaine-tl-ligne-heure';
            ligne.style.top = ((h - TL_HEURE_DEBUT) * 60 * TL_PX_MIN_SEM) + 'px';
            zone.appendChild(ligne);
        }

        // Blocs de pauses
        creerBlocsPauses(zone, TL_PX_MIN_SEM, true);

        // Tâches planifiées
        const planifiees = taches.filter(t => t.date_echeance === dateISO && t.heure_debut);
        planifiees.forEach(t => {
            const bloc = creerBlocTache(t, TL_PX_MIN_SEM);
            zone.appendChild(bloc);
        });

        // Clic sur créneau libre → créer tâche
        zone.addEventListener('click', e => {
            if (e.target !== zone) return;
            const rect = zone.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const minutes = TL_MIN_DEBUT + Math.round(y / TL_PX_MIN_SEM / 15) * 15;
            ouvrirModal(null, null, minutesVersHeure(minutes));
            setTimeout(() => { document.getElementById('tache-date').value = dateISO; }, 50);
        });

        // Indicateur maintenant
        if (estAujourd_hui) {
            const maint = new Date();
            const minMaint = maint.getHours() * 60 + maint.getMinutes();
            if (minMaint >= TL_MIN_DEBUT && minMaint <= TL_HEURE_FIN * 60) {
                const ind = document.createElement('div');
                ind.className = 'timeline-maintenant';
                ind.style.top = ((minMaint - TL_MIN_DEBUT) * TL_PX_MIN_SEM) + 'px';
                zone.appendChild(ind);
            }
        }

        colonne.appendChild(zone);
        wrapper.appendChild(colonne);
    }

    const scroll = document.createElement('div');
    scroll.className = 'semaine-tl-scroll';
    scroll.appendChild(wrapper);
    conteneur.appendChild(scroll);

    // Scroll automatique vers 7h au chargement
    setTimeout(() => {
        scroll.scrollTop = (7 * 60 - TL_MIN_DEBUT) * TL_PX_MIN_SEM - 50;
    }, 50);
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

    // En-têtes
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

    // Jours mois précédent
    const moisPrec = new Date(annee, mois, 0);
    for (let i = debutSemaine - 1; i >= 0; i--) {
        grille.appendChild(creerCelluleMois(new Date(annee, mois - 1, moisPrec.getDate() - i), true, false));
    }

    // Jours du mois
    for (let j = 1; j <= dernierJour; j++) {
        const d = new Date(annee, mois, j);
        grille.appendChild(creerCelluleMois(d, false, d.getTime() === aujourd_hui.getTime()));
    }

    // Compléter
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
            ouvrirModal(null, null);
            setTimeout(() => { document.getElementById('tache-date').value = dateISO; }, 50);
        }
    });

    return cellule;
}

// ============================================================
// CONSTRUCTION TIMELINE (partagée Jour + Semaine)
// ============================================================

function construireTimeline(pxParMin, planifiees, estAujourd_hui, dateISO) {
    const hauteurTotale = (TL_HEURE_FIN - TL_HEURE_DEBUT) * 60 * pxParMin;

    const tl = document.createElement('div');
    tl.className = 'timeline';
    tl.style.height = hauteurTotale + 'px';

    // Marqueurs d'heures
    for (let h = TL_HEURE_DEBUT; h <= TL_HEURE_FIN; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === TL_HEURE_FIN && m > 0) break;
            const minutes = h * 60 + m;
            const top = (minutes - TL_MIN_DEBUT) * pxParMin;

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
    creerBlocsPauses(tl, pxParMin, false);

    // Zone cliquable
    const zone = document.createElement('div');
    zone.className = 'timeline-zone-clics';
    zone.style.height = hauteurTotale + 'px';
    zone.addEventListener('click', e => {
        const rect = tl.getBoundingClientRect();
        const scrollTop = tl.parentElement.scrollTop || 0;
        const y = e.clientY - rect.top + scrollTop;
        const minutes = TL_MIN_DEBUT + Math.round(y / pxParMin / 15) * 15;
        ouvrirModal(null, null, minutesVersHeure(minutes));
        setTimeout(() => { document.getElementById('tache-date').value = dateISO; }, 50);
    });
    tl.appendChild(zone);

    // Tâches planifiées
    planifiees.forEach(t => tl.appendChild(creerBlocTache(t, pxParMin)));

    // Indicateur maintenant
    if (estAujourd_hui) {
        const maint = new Date();
        const min = maint.getHours() * 60 + maint.getMinutes();
        if (min >= TL_MIN_DEBUT && min <= TL_HEURE_FIN * 60) {
            const ind = document.createElement('div');
            ind.className = 'timeline-maintenant';
            ind.style.top = ((min - TL_MIN_DEBUT) * pxParMin) + 'px';
            tl.appendChild(ind);
            setInterval(() => {
                const m2 = new Date().getHours() * 60 + new Date().getMinutes();
                ind.style.top = ((m2 - TL_MIN_DEBUT) * pxParMin) + 'px';
            }, 60000);
        }
    }

    // Scroll automatique vers 7h
    setTimeout(() => {
        if (tl.parentElement) {
            tl.parentElement.scrollTop = (7 * 60 - TL_MIN_DEBUT) * pxParMin - 50;
        }
    }, 50);

    return tl;
}

function creerBlocsPauses(conteneur, pxParMin, compact) {
    const pauses = [
        { label: '🌅 Réveil & routine', heure: configJournee.heure_reveil,   duree: configJournee.duree_routine_matin, classe: 'pause-matin'    },
        { label: '🍽 Déjeuner',          heure: configJournee.heure_dejeuner,  duree: configJournee.duree_dejeuner,      classe: 'pause-dejeuner' },
        { label: '🌙 Dîner',             heure: configJournee.heure_diner,     duree: configJournee.duree_diner,         classe: 'pause-diner'    },
    ];

    pauses.forEach(p => {
        if (!p.heure || !p.duree) return;
        const min = heureVersMinutes(p.heure);
        if (min < TL_MIN_DEBUT || min >= TL_HEURE_FIN * 60) return;

        const bloc = document.createElement('div');
        bloc.className = `bloc-pause ${p.classe}`;
        bloc.style.top    = ((min - TL_MIN_DEBUT) * pxParMin) + 'px';
        bloc.style.height = Math.max(p.duree * pxParMin, 20) + 'px';
        bloc.textContent  = compact ? '' : `${p.label} (${p.duree} min)`;
        bloc.title        = `${p.label} — ${p.heure}, ${p.duree} min`;
        conteneur.appendChild(bloc);
    });
}

function creerBlocTache(tache, pxParMin) {
    const min    = heureVersMinutes(tache.heure_debut);
    const duree  = tache.duree_estimee || 30;
    const hauteur = Math.max(duree * pxParMin, 22);

    const classes = {
        urgent_important: 'zone-bloc-rouge', important: 'zone-bloc-bleu',
        urgent: 'zone-bloc-ambre', neutre: 'zone-bloc-gris',
        en_cours: 'zone-bloc-orange', fait: 'zone-bloc-vert',
    };

    const bloc = document.createElement('div');
    bloc.className = `bloc-tache ${classes[tache.zone] || 'zone-bloc-gris'}`;
    bloc.style.top    = ((min - TL_MIN_DEBUT) * pxParMin) + 'px';
    bloc.style.height = hauteur + 'px';

    const heureFin = minutesVersHeure(min + duree);
    bloc.innerHTML = hauteur >= 36
        ? `<div class="bloc-tache-titre">${echapper(tache.titre)}</div>
           <div class="bloc-tache-meta">${tache.heure_debut} → ${heureFin}</div>`
        : `<div class="bloc-tache-titre">${echapper(tache.titre)}</div>`;

    bloc.addEventListener('click', e => { e.stopPropagation(); ouvrirModal(tache); });
    return bloc;
}

// ============================================================
// PANNEAU TÂCHES NON PLANIFIÉES (vue jour)
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
            const carte = document.createElement('div');
            carte.className = 'carte-panneau';
            carte.innerHTML = `
                <div class="carte-panneau-point zone-point-${t.zone.replace(/_/g, '-')}"></div>
                <div class="carte-panneau-info">
                    <div class="carte-panneau-titre">${echapper(t.titre)}</div>
                    ${t.duree_estimee ? `<div class="carte-panneau-duree">⏱ ${t.duree_estimee} min</div>` : ''}
                </div>
                <button class="btn-action btn-modifier" onclick="ouvrirModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">✏</button>
            `;
            liste.appendChild(carte);
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
        document.getElementById('modal-config-overlay').classList.add('actif');
    } catch { alert('Erreur de connexion.'); }
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
        rendreCalerendrier(); // Redessiner avec les nouvelles pauses
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
