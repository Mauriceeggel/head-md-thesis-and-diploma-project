/* =============================================================
   WEB ENTITIES (reworked) — script propre à cette page
   Quatre fonctions :
     1. construire et faire marcher les lecteurs audio (.player)
     2. le bandeau défilant qu'on peut attraper et faire glisser
     3. afficher le bouton "remonter en haut" quand on a défilé
     4. ouvrir les images en grand au milieu de la page
   ============================================================= */


/* -------------------------------------------------------------
   1. LECTEURS AUDIO
   Dans le HTML, un lecteur est juste :
     <div class="player" data-src="audio/xxx.mp3"></div>
   Ce script le remplit avec :
     ▶  00:00  [====barre====]  00:55  🔊 [==volume==]
   Chaque lecteur a son propre son. Lancer un son met les autres en pause.
   ------------------------------------------------------------- */

// Les icônes (dessinées en SVG, elles prennent la couleur du texte)
const ICONE_LECTURE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z" fill="currentColor"/></svg>';
const ICONE_PAUSE   = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5h3.5v13H3zM9.5 1.5H13v13H9.5z" fill="currentColor"/></svg>';
const ICONE_SON     = '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 5.5h3.5L9 1.5v13l-4.5-4H1z" fill="currentColor"/><path d="M12 5a4 4 0 0 1 0 6M14.5 2.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICONE_MUET    = '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 5.5h3.5L9 1.5v13l-4.5-4H1z" fill="currentColor"/><path d="M12.5 5.5l5 5M17.5 5.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

// Le HTML intérieur d'un lecteur
const MODELE_LECTEUR =
  '<button class="player-btn" aria-label="Lecture">' + ICONE_LECTURE + '</button>' +
  '<span class="player-time player-current">00:00</span>' +
  '<div class="player-bar"><div class="player-fill"></div></div>' +
  '<span class="player-time player-duration">00:00</span>' +
  '<button class="player-mute" aria-label="Couper le son">' + ICONE_SON + '</button>' +
  '<div class="player-volume"><div class="player-fill"></div></div>';

// Transforme un nombre de secondes en "mm:ss" (ex. 55 -> "00:55")
function formaterTemps(secondes) {
  if (!isFinite(secondes)) return "00:00";
  const minutes = Math.floor(secondes / 60);
  const reste = Math.floor(secondes % 60);
  return String(minutes).padStart(2, "0") + ":" + String(reste).padStart(2, "0");
}

// Permet de cliquer OU de maintenir et glisser sur une barre.
// "action" reçoit un nombre entre 0 (tout à gauche) et 1 (tout à droite).
function rendreGlissable(barre, action) {
  function calculer(event) {
    const rect = barre.getBoundingClientRect();
    if (!rect.width) return;   // barre cachée (ex. volume sur petit écran)
    const ratio = (event.clientX - rect.left) / rect.width;
    action(Math.min(1, Math.max(0, ratio)));   // on reste entre 0 et 1
  }
  barre.addEventListener("pointerdown", function (event) {
    barre.setPointerCapture(event.pointerId);  // continue à suivre la souris hors de la barre
    calculer(event);
  });
  barre.addEventListener("pointermove", function (event) {
    if (barre.hasPointerCapture(event.pointerId)) calculer(event);
  });
}

const tousLesSons = [];   // la liste des sons, pour pouvoir mettre les autres en pause

document.querySelectorAll(".player").forEach(function (lecteur) {
  lecteur.innerHTML = MODELE_LECTEUR;

  const son = new Audio(lecteur.dataset.src);
  son.preload = "metadata";   // charge seulement la durée, pas tout le fichier
  tousLesSons.push(son);

  const bouton      = lecteur.querySelector(".player-btn");
  const tempsActuel = lecteur.querySelector(".player-current");
  const tempsTotal  = lecteur.querySelector(".player-duration");
  const barre       = lecteur.querySelector(".player-bar");
  const remplissage = barre.querySelector(".player-fill");
  const boutonMuet  = lecteur.querySelector(".player-mute");
  const volume      = lecteur.querySelector(".player-volume");
  const niveau      = volume.querySelector(".player-fill");

  niveau.style.width = son.volume * 100 + "%";

  // ▶ / ❚❚
  bouton.addEventListener("click", function () {
    if (son.paused) {
      tousLesSons.forEach(function (autre) {
        if (autre !== son) autre.pause();
      });
      son.play();
    } else {
      son.pause();
    }
  });

  son.addEventListener("play", function () {
    lecteur.classList.add("is-playing");
    bouton.innerHTML = ICONE_PAUSE;
  });

  son.addEventListener("pause", function () {
    lecteur.classList.remove("is-playing");
    bouton.innerHTML = ICONE_LECTURE;
  });

  // La durée est connue -> on l'affiche à droite
  son.addEventListener("loadedmetadata", function () {
    tempsTotal.textContent = formaterTemps(son.duration);
  });

  // Pendant la lecture -> temps à gauche + barre qui avance
  son.addEventListener("timeupdate", function () {
    tempsActuel.textContent = formaterTemps(son.currentTime);
    if (son.duration) {
      remplissage.style.width = (son.currentTime / son.duration) * 100 + "%";
    }
  });

  // Fin du son -> retour au début
  son.addEventListener("ended", function () {
    son.currentTime = 0;
  });

  // Clic ou glisser sur la barre -> on se déplace dans le son
  rendreGlissable(barre, function (ratio) {
    if (son.duration) son.currentTime = ratio * son.duration;
  });

  // Clic ou glisser sur la barre de volume
  rendreGlissable(volume, function (ratio) {
    son.volume = ratio;
    son.muted = false;
  });

  // Icône haut-parleur -> couper / remettre le son
  boutonMuet.addEventListener("click", function () {
    son.muted = !son.muted;
  });

  // Le volume change -> on met à jour la barre et l'icône
  son.addEventListener("volumechange", function () {
    const coupe = son.muted || son.volume === 0;
    niveau.style.width = (son.muted ? 0 : son.volume * 100) + "%";
    boutonMuet.innerHTML = coupe ? ICONE_MUET : ICONE_SON;
  });
});


/* -------------------------------------------------------------
   2. BANDEAU DÉFILANT
   Le texte avance tout seul. Quand on maintient le clic dessus,
   il s'arrête et on peut le faire glisser en avant et en arrière.
   Quand on relâche, il reprend son défilement.
   ------------------------------------------------------------- */

const bandeau = document.querySelector(".ticker");
const piste = bandeau.querySelector(".ticker-track");

const VITESSE = 70;        // pixels par seconde : augmente pour aller plus vite

let position = 0;          // décalage actuel du texte, en pixels
let attrape = false;       // true pendant qu'on maintient le clic
let departSouris = 0;      // position de la souris au moment du clic
let departPosition = 0;    // position du texte au moment du clic
let dernierInstant = null;

// Le texte est écrit deux fois : quand on a avancé d'une copie entière,
// on revient au début sans que ça se voie (boucle infinie).
function boucler() {
  const longueur = piste.scrollWidth / 2;
  if (!longueur) return;   // texte pas encore affiché
  position = ((position % longueur) - longueur) % longueur;   // reste entre -longueur et 0
}

function animer(instant) {
  if (dernierInstant !== null && !attrape) {
    position -= VITESSE * (instant - dernierInstant) / 1000;
  }
  dernierInstant = instant;
  boucler();
  piste.style.transform = "translateX(" + position + "px)";
  requestAnimationFrame(animer);
}
requestAnimationFrame(animer);

bandeau.addEventListener("pointerdown", function (event) {
  attrape = true;
  departSouris = event.clientX;
  departPosition = position;
  bandeau.setPointerCapture(event.pointerId);
  bandeau.classList.add("is-grabbed");
});

bandeau.addEventListener("pointermove", function (event) {
  if (!attrape) return;
  position = departPosition + (event.clientX - departSouris);
});

function relacher() {
  attrape = false;
  bandeau.classList.remove("is-grabbed");
}
bandeau.addEventListener("pointerup", relacher);
bandeau.addEventListener("pointercancel", relacher);


/* -------------------------------------------------------------
   3. BOUTON "REMONTER EN HAUT"
   Il apparaît dès qu'on a défilé de plus de 400 pixels.
   ------------------------------------------------------------- */

const boutonHaut = document.querySelector(".to-top");

window.addEventListener("scroll", function () {
  boutonHaut.classList.toggle("is-visible", window.scrollY > 400);
});


/* -------------------------------------------------------------
   4. IMAGES EN PLEIN ÉCRAN
   Un clic sur une image d'un message l'affiche en grand
   dans la <dialog class="lightbox">. Les photos de profil ne sont pas concernées.
   Un clic n'importe où (ou la touche Échap) referme la fenêtre.
   ------------------------------------------------------------- */

const fenetreImage = document.querySelector(".lightbox");
const grandeImage = fenetreImage.querySelector("img");

const images = document.querySelectorAll(".attachment img");

images.forEach(function (image) {
  image.addEventListener("click", function () {
    grandeImage.src = image.src;               // on copie l'image cliquée
    grandeImage.alt = image.alt;
    fenetreImage.showModal();                  // ouvre la fenêtre par-dessus la page
  });
});

fenetreImage.addEventListener("click", function () {
  fenetreImage.close();
});
