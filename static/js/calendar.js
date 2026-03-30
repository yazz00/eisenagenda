// ===== CALENDRIER — Vue mensuelle et hebdomadaire =====

let taches = [];
let vueActuelle = 'mensuel'; // 'mensuel' ou 'hebdomadaire'
let dateActuelle = new Date();

// Noms des jours et mois en français
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_COMPLETS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', function () {
    taches = tachesInitiales || [];
    rendreCalerendrier();
});

// ===== NAVIGATION =====

function naviguer(direction) {
    if (vueActuelle === 'mensuel') {
        dateActuelle.setMonth(dateActuelle.getMonth() + direction);
    } else {
        dateActuelle.setDate(dateActuelle.getDate() + (direction * 7));
    }
    rendreCalerendrier();
}

function allerAujourdhui() {
    dateActuelle = new Date();
    rendreCalerendrier();
}

function changerVue(nouvelleVue) {
    vueActuelle = nouvelleVue;
    document.getElementById('btn-mensuel').classList.toggle('actif', nouvelleVue === 'mensuel');
    document.getElementById('btn-hebdo').classList.toggle('actif', nouvelleVue === 'hebdomadaire');
    rendreCalerendrier();
}

// ===== RENDU PRINCIPAL =====

function rendreCalerendrier() {
    if (vueActuelle === 'mensuel') {
        rendreMensuel();
    } else {
        rendreHebdomadaire();
    }
}

// ===== VUE MENSUELLE =====

function rendreMensuel() {
    const annee = dateActuelle.getFullYear();
    const mois = dateActuelle.getMonth();

    // Titre
    document.getElementById('titre-mois').textContent = `${MOIS[mois]} ${annee}`;

    // Premier jour du mois (converti en lundi=0 ... dimanche=6)
    const premierJour = new Date(annee, mois, 1);
    let jourDebutSemaine = premierJour.getDay() - 1; // Décalage lundi=0
    if (jourDebutSemaine < 0) jourDebutSemaine = 6; // Dimanche

    // Dernier jour du mois
    const dernierJour = new Date(annee, mois + 1, 0).getDate();

    const conteneur = document.getElementById('calendrier');
    conteneur.innerHTML = '';

    // En-têtes des jours
    const entetes = document.createElement('div');
    entetes.className = 'calendrier-entetes';
    JOURS.forEach(jour => {
        const th = document.createElement('div');
        th.className = 'calendrier-entete';
        th.textContent = jour;
        entetes.appendChild(th);
    });
    conteneur.appendChild(entetes);

    // Grille des jours
    const grille = document.createElement('div');
    grille.className = 'calendrier-jours';

    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    // Jours du mois précédent
    const moisPrec = new Date(annee, mois, 0);
    for (let i = jourDebutSemaine - 1; i >= 0; i--) {
        const jour = moisPrec.getDate() - i;
        const cellule = creerCelluleJour(
            new Date(annee, mois - 1, jour),
            jour, true, false
        );
        grille.appendChild(cellule);
    }

    // Jours du mois courant
    for (let jour = 1; jour <= dernierJour; jour++) {
        const dateJour = new Date(annee, mois, jour);
        const estAujord_hui = dateJour.getTime() === aujourd_hui.getTime();
        const cellule = creerCelluleJour(dateJour, jour, false, estAujord_hui);
        grille.appendChild(cellule);
    }

    // Compléter la dernière semaine avec les jours du mois suivant
    const totalCellules = grille.children.length;
    const cellulesRestantes = totalCellules % 7 === 0 ? 0 : 7 - (totalCellules % 7);
    for (let jour = 1; jour <= cellulesRestantes; jour++) {
        const cellule = creerCelluleJour(
            new Date(annee, mois + 1, jour),
            jour, true, false
        );
        grille.appendChild(cellule);
    }

    conteneur.appendChild(grille);
}

function creerCelluleJour(date, numeroJour, autreMois, estAujord_hui) {
    const cellule = document.createElement('div');
    cellule.className = 'calendrier-jour';
    if (autreMois) cellule.classList.add('autre-mois');
    if (estAujord_hui) cellule.classList.add('aujourd-hui');

    const dateISO = formaterDateISO(date);

    // Numéro du jour
    const numDiv = document.createElement('div');
    numDiv.className = 'jour-numero';
    numDiv.textContent = numeroJour;
    cellule.appendChild(numDiv);

    // Tâches de ce jour
    const tachesJour = taches.filter(t => t.date_echeance === dateISO);
    const divTaches = document.createElement('div');
    divTaches.className = 'jour-taches';

    tachesJour.forEach(tache => {
        const tacheDiv = creerTacheCal(tache);
        divTaches.appendChild(tacheDiv);
    });

    cellule.appendChild(divTaches);

    // Clic sur jour vide → ouvrir modal création avec date pré-remplie
    cellule.addEventListener('click', function (e) {
        if (e.target === cellule || e.target === numDiv || e.target === divTaches) {
            if (!autreMois) {
                ouvrirModal(null, null);
                setTimeout(() => {
                    document.getElementById('tache-date').value = dateISO;
                }, 50);
            }
        }
    });

    return cellule;
}

// ===== VUE HEBDOMADAIRE =====

function rendreHebdomadaire() {
    // Trouver le lundi de la semaine actuelle
    const jourSemaine = dateActuelle.getDay();
    const decalage = jourSemaine === 0 ? -6 : 1 - jourSemaine; // Lundi=1 → decalage=0
    const lundi = new Date(dateActuelle);
    lundi.setDate(dateActuelle.getDate() + decalage);

    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);

    // Titre
    const titreDebut = `${lundi.getDate()} ${MOIS[lundi.getMonth()].substring(0, 3)}.`;
    const titreFin = `${dimanche.getDate()} ${MOIS[dimanche.getMonth()].substring(0, 3)}. ${dimanche.getFullYear()}`;
    document.getElementById('titre-mois').textContent = `${titreDebut} – ${titreFin}`;

    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    const conteneur = document.getElementById('calendrier');
    conteneur.innerHTML = '';

    const semaine = document.createElement('div');
    semaine.className = 'semaine-grille';

    for (let i = 0; i < 7; i++) {
        const date = new Date(lundi);
        date.setDate(lundi.getDate() + i);
        const estAujord_hui = date.getTime() === aujourd_hui.getTime();
        const dateISO = formaterDateISO(date);

        const colonne = document.createElement('div');
        colonne.className = 'semaine-jour';

        // Titre de la colonne
        const titre = document.createElement('div');
        titre.className = 'semaine-jour-titre' + (estAujord_hui ? ' aujourd-hui' : '');
        titre.textContent = `${JOURS_COMPLETS[i]} ${date.getDate()}`;
        colonne.appendChild(titre);

        // Tâches du jour
        const divTaches = document.createElement('div');
        divTaches.className = 'semaine-taches';

        const tachesJour = taches.filter(t => t.date_echeance === dateISO);
        tachesJour.forEach(tache => {
            const tacheDiv = creerTacheCal(tache);
            divTaches.appendChild(tacheDiv);
        });

        // Clic sur zone vide → ouvrir modal création
        colonne.addEventListener('click', function (e) {
            if (e.target === colonne || e.target === titre || e.target === divTaches) {
                ouvrirModal(null, null);
                setTimeout(() => {
                    document.getElementById('tache-date').value = dateISO;
                }, 50);
            }
        });

        colonne.appendChild(divTaches);
        semaine.appendChild(colonne);
    }

    conteneur.appendChild(semaine);
}

// ===== UTILITAIRES =====

function creerTacheCal(tache) {
    const div = document.createElement('div');
    const classeZone = tache.zone.replace('_', '-');
    div.className = `tache-cal zone-${classeZone}`;
    div.textContent = tache.titre;
    div.title = tache.titre + (tache.description ? '\n' + tache.description : '');

    div.addEventListener('click', function (e) {
        e.stopPropagation();
        ouvrirModal(tache);
    });

    return div;
}

function formaterDateISO(date) {
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, '0');
    const jour = String(date.getDate()).padStart(2, '0');
    return `${annee}-${mois}-${jour}`;
}

// ===== CALLBACK APRÈS SAUVEGARDE (depuis base.html) =====

function apresModificationTache(tacheMisAJour, estModification) {
    if (estModification) {
        const index = taches.findIndex(t => t.id === tacheMisAJour.id);
        if (index !== -1) taches[index] = tacheMisAJour;
    } else {
        taches.push(tacheMisAJour);
    }
    rendreCalerendrier();
}
