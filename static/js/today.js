// ===== MA JOURNÉE — Timeline verticale =====

// Constantes de la timeline
const HEURE_DEBUT = 5;        // 5h00
const HEURE_FIN = 24;         // 00h00 (minuit)
const PX_PAR_MINUTE = 3;      // 1 heure = 180px
const MINUTES_DEBUT = HEURE_DEBUT * 60;  // 300 minutes

// Listes locales (mises à jour après chaque action)
let tachesPlanifieesLocales = [...tachesPlanifiees];
let tachesNonPlanifieesLocales = [...tachesNonPlanifiees];

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', function () {
    construireTimeline();
    afficherTachesPanneau();
});

// ===== CONSTRUCTION DE LA TIMELINE =====

function construireTimeline() {
    const timeline = document.getElementById('timeline');
    const hauteurTotale = (HEURE_FIN - HEURE_DEBUT) * 60 * PX_PAR_MINUTE;
    timeline.style.height = hauteurTotale + 'px';
    timeline.innerHTML = '';

    // Marqueurs d'heures (toutes les 30 min)
    for (let h = HEURE_DEBUT; h <= HEURE_FIN; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === HEURE_FIN && m > 0) break;
            const minutes = h * 60 + m;
            const top = minutesVersTop(minutes);

            const marqueur = document.createElement('div');
            marqueur.className = 'timeline-marqueur' + (m === 0 ? ' timeline-marqueur-heure' : '');
            marqueur.style.top = top + 'px';

            const label = document.createElement('div');
            label.className = 'timeline-label';
            label.textContent = m === 0
                ? `${String(h % 24).padStart(2, '0')}:00`
                : `${String(h % 24).padStart(2, '0')}:30`;
            marqueur.appendChild(label);

            timeline.appendChild(marqueur);
        }
    }

    // Zone cliquable (pour créer une tâche sur un créneau libre)
    const zoneClics = document.createElement('div');
    zoneClics.className = 'timeline-zone-clics';
    zoneClics.style.height = hauteurTotale + 'px';
    zoneClics.addEventListener('click', clicSurTimeline);
    timeline.appendChild(zoneClics);

    // Blocs de pauses
    afficherBlocsConfig();

    // Tâches planifiées
    afficherBlocs();

    // Indicateur "maintenant"
    afficherIndicateurMaintenant();
    setInterval(afficherIndicateurMaintenant, 60000);
}

// ===== INDICATEUR "MAINTENANT" =====

function afficherIndicateurMaintenant() {
    const ancien = document.getElementById('indicateur-maintenant');
    if (ancien) ancien.remove();

    const maintenant = new Date();
    const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

    if (minutesMaintenant < MINUTES_DEBUT || minutesMaintenant > HEURE_FIN * 60) return;

    const indicateur = document.createElement('div');
    indicateur.id = 'indicateur-maintenant';
    indicateur.className = 'timeline-maintenant';
    indicateur.style.top = minutesVersTop(minutesMaintenant) + 'px';
    indicateur.title = 'Maintenant';
    document.getElementById('timeline').appendChild(indicateur);
}

// ===== BLOCS DE PAUSES =====

function afficherBlocsConfig() {
    // Retirer les anciens blocs de pause
    document.querySelectorAll('.bloc-pause').forEach(b => b.remove());

    const pauses = [
        {
            label: '🌅 Réveil & routine',
            heure: configJournee.heure_reveil,
            duree: configJournee.duree_routine_matin,
            classe: 'pause-matin',
        },
        {
            label: '🍽 Déjeuner',
            heure: configJournee.heure_dejeuner,
            duree: configJournee.duree_dejeuner,
            classe: 'pause-dejeuner',
        },
        {
            label: '🌙 Dîner',
            heure: configJournee.heure_diner,
            duree: configJournee.duree_diner,
            classe: 'pause-diner',
        },
    ];

    const timeline = document.getElementById('timeline');

    pauses.forEach(pause => {
        if (!pause.heure || !pause.duree) return;

        const minutes = heureVersMinutes(pause.heure);
        if (minutes < MINUTES_DEBUT || minutes >= HEURE_FIN * 60) return;

        const bloc = document.createElement('div');
        bloc.className = `bloc-pause ${pause.classe}`;
        bloc.style.top = minutesVersTop(minutes) + 'px';
        bloc.style.height = Math.max(pause.duree * PX_PAR_MINUTE, 24) + 'px';
        bloc.textContent = `${pause.label} (${pause.duree} min)`;
        timeline.appendChild(bloc);
    });
}

// ===== BLOCS DE TÂCHES =====

function afficherBlocs() {
    // Retirer les anciens blocs de tâches
    document.querySelectorAll('.bloc-tache').forEach(b => b.remove());

    tachesPlanifieesLocales.forEach(tache => {
        if (!tache.heure_debut) return;
        const bloc = creerBlocTache(tache);
        document.getElementById('timeline').appendChild(bloc);
    });
}

function creerBlocTache(tache) {
    const minutes = heureVersMinutes(tache.heure_debut);
    const duree = tache.duree_estimee || 30;
    const hauteur = Math.max(duree * PX_PAR_MINUTE, 30);

    const classeZone = {
        urgent_important: 'zone-bloc-rouge',
        important: 'zone-bloc-bleu',
        urgent: 'zone-bloc-ambre',
        neutre: 'zone-bloc-gris',
        en_cours: 'zone-bloc-orange',
        fait: 'zone-bloc-vert',
    }[tache.zone] || 'zone-bloc-gris';

    const bloc = document.createElement('div');
    bloc.className = `bloc-tache ${classeZone}`;
    bloc.id = `bloc-${tache.id}`;
    bloc.style.top = minutesVersTop(minutes) + 'px';
    bloc.style.height = hauteur + 'px';
    bloc.dataset.id = tache.id;

    const heureDebut = tache.heure_debut;
    const heureFin = minutesVersHeure(minutes + duree);
    const titreAffiché = hauteur >= 40
        ? `<div class="bloc-tache-titre">${echapper(tache.titre)}</div>
           <div class="bloc-tache-meta">${heureDebut} → ${heureFin}</div>`
        : `<div class="bloc-tache-titre">${echapper(tache.titre)}</div>`;

    bloc.innerHTML = titreAffiché;

    bloc.addEventListener('click', function (e) {
        e.stopPropagation();
        ouvrirModal(tache);
    });

    return bloc;
}

// ===== PANNEAU TÂCHES NON PLANIFIÉES =====

function afficherTachesPanneau() {
    const panneau = document.getElementById('panneau-non-planifiees');
    panneau.innerHTML = '';

    if (tachesNonPlanifieesLocales.length === 0) {
        panneau.innerHTML = '<p style="font-size:0.82rem; color:var(--texte-secondaire); text-align:center; padding:1rem 0;">Toutes les tâches sont planifiées !</p>';
        return;
    }

    tachesNonPlanifieesLocales.forEach(tache => {
        const carte = document.createElement('div');
        carte.className = 'carte-panneau';
        carte.id = `panneau-carte-${tache.id}`;

        const classeZone = tache.zone.replace('_', '-');
        carte.innerHTML = `
            <div class="carte-panneau-point zone-point-${classeZone}"></div>
            <div class="carte-panneau-info">
                <div class="carte-panneau-titre">${echapper(tache.titre)}</div>
                ${tache.duree_estimee ? `<div class="carte-panneau-duree">⏱ ${tache.duree_estimee} min</div>` : ''}
            </div>
            <button class="btn-action btn-modifier" onclick="ouvrirModal(${JSON.stringify(tache).replace(/"/g, '&quot;')})">✏</button>
        `;
        panneau.appendChild(carte);
    });
}

// ===== CLIC SUR LA TIMELINE =====

function clicSurTimeline(event) {
    const timeline = document.getElementById('timeline');
    const rect = timeline.getBoundingClientRect();
    const y = event.clientY - rect.top + timeline.scrollTop;

    // Convertir la position en heure
    const minutesDepuisDebut = Math.floor(y / PX_PAR_MINUTE);
    const minutesTotales = MINUTES_DEBUT + minutesDepuisDebut;

    // Arrondir aux 15 minutes les plus proches
    const minutesArrondies = Math.round(minutesTotales / 15) * 15;
    const heure = minutesVersHeure(minutesArrondies);

    // Pré-remplir la date du jour
    const aujourd_hui = new Date().toISOString().split('T')[0];
    ouvrirModal(null, null, heure);

    // Pré-remplir aussi la date
    setTimeout(() => {
        document.getElementById('tache-date').value = aujourd_hui;
    }, 50);
}

// ===== CONFIG JOURNÉE =====

async function ouvrirConfigJournee() {
    // Charger la config actuelle depuis l'API
    try {
        const reponse = await fetch('/api/config/journee');
        const config = await reponse.json();
        configJournee = config;

        document.getElementById('cfg-heure-reveil').value = config.heure_reveil || '07:00';
        document.getElementById('cfg-duree-matin').value = config.duree_routine_matin || 60;
        document.getElementById('cfg-heure-dejeuner').value = config.heure_dejeuner || '12:30';
        document.getElementById('cfg-duree-dejeuner').value = config.duree_dejeuner || 60;
        document.getElementById('cfg-heure-diner').value = config.heure_diner || '19:30';
        document.getElementById('cfg-duree-diner').value = config.duree_diner || 45;

        document.getElementById('modal-config-overlay').classList.add('actif');
    } catch (err) {
        alert('Erreur de connexion au serveur.');
    }
}

function fermerConfigJournee() {
    document.getElementById('modal-config-overlay').classList.remove('actif');
}

function fermerConfigSiExterieur(event) {
    if (event.target === document.getElementById('modal-config-overlay')) {
        fermerConfigJournee();
    }
}

async function sauvegarderConfig(event) {
    event.preventDefault();

    const erreurs = document.getElementById('config-erreurs');
    erreurs.style.display = 'none';

    const donnees = {
        heure_reveil: document.getElementById('cfg-heure-reveil').value,
        duree_routine_matin: parseInt(document.getElementById('cfg-duree-matin').value) || 0,
        heure_dejeuner: document.getElementById('cfg-heure-dejeuner').value,
        duree_dejeuner: parseInt(document.getElementById('cfg-duree-dejeuner').value) || 0,
        heure_diner: document.getElementById('cfg-heure-diner').value,
        duree_diner: parseInt(document.getElementById('cfg-duree-diner').value) || 0,
    };

    try {
        const reponse = await fetch('/api/config/journee', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });

        const resultat = await reponse.json();

        if (!reponse.ok) {
            const msgs = resultat.erreurs || [resultat.erreur || 'Erreur inconnue.'];
            erreurs.innerHTML = msgs.join('<br>');
            erreurs.style.display = 'block';
            return;
        }

        configJournee = resultat;
        fermerConfigJournee();
        afficherBlocsConfig(); // Mettre à jour les blocs visuellement

    } catch (err) {
        erreurs.textContent = 'Erreur de connexion au serveur.';
        erreurs.style.display = 'block';
    }
}

// ===== CALLBACK APRÈS SAUVEGARDE TÂCHE (depuis base.html) =====

function apresModificationTache(tache, estModification) {
    if (estModification) {
        // Mettre à jour dans les deux listes
        tachesPlanifieesLocales = tachesPlanifieesLocales.filter(t => t.id !== tache.id);
        tachesNonPlanifieesLocales = tachesNonPlanifieesLocales.filter(t => t.id !== tache.id);
    }

    // Placer dans la bonne liste selon si elle a une heure
    if (tache.heure_debut && tache.date_echeance === new Date().toISOString().split('T')[0]) {
        tachesPlanifieesLocales.push(tache);
        tachesPlanifieesLocales.sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
    } else {
        tachesNonPlanifieesLocales.push(tache);
    }

    afficherBlocs();
    afficherTachesPanneau();
}

// ===== UTILITAIRES =====

function heureVersMinutes(heure) {
    // "HH:MM" → nombre de minutes depuis minuit
    const [h, m] = heure.split(':').map(Number);
    return h * 60 + m;
}

function minutesVersTop(minutes) {
    // minutes depuis minuit → pixels depuis le haut de la timeline
    return (minutes - MINUTES_DEBUT) * PX_PAR_MINUTE;
}

function minutesVersHeure(minutes) {
    // minutes depuis minuit → "HH:MM"
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function echapper(texte) {
    if (!texte) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(texte));
    return div.innerHTML;
}
