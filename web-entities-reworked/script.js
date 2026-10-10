/* =============================================================
   WEB ENTITIES (reworked) — script propre à cette page
   Cinq fonctions :
     1. construire et faire marcher les lecteurs audio (.player)
     2. le bandeau défilant qu'on peut attraper et faire glisser
     3. afficher le bouton "remonter en haut" quand on a défilé
     4. ouvrir les images en grand au milieu de la page
     5. transformer la vidéo de fond en animation ASCII
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


/* -------------------------------------------------------------
   5. FOND ANIMÉ ASCII
   Plusieurs fois par seconde :
     a. on réduit l'image actuelle de la vidéo à une petite grille
        (1 pixel = 1 case de texte)
     b. pour chaque case, on choisit un caractère selon la luminosité
        (sombre -> " ", clair -> "@") et on garde la couleur du pixel
     c. on dessine ces caractères dans le <canvas> plein écran

   ATTENTION : si la page est ouverte par double-clic (adresse file://),
   Chrome interdit de lire les pixels de la vidéo. Il faut l'ouvrir avec
   un serveur local (ex. extension "Live Server" de VS Code).
   Dans ce cas, on affiche simplement la vidéo à la place.
   ------------------------------------------------------------- */

// Réglages : change ces valeurs pour modifier le rendu
const CARACTERES   = " .-+*=#@";   // du plus sombre au plus clair
const LARGEUR_CASE = 10;           // largeur d'une case en pixels (plus petit = plus de détails)
const HAUTEUR_CASE = 16;           // hauteur d'une case en pixels
const IMAGES_PAR_SECONDE = 15;     // vitesse de rafraîchissement du dessin
const LUMINOSITE   = 0.85;         // > 1 : couleurs plus vives, < 1 : plus sombres
const CONTRASTE    = 2.4;          // > 1 : plus de cases vides dans les zones sombres
const EN_COULEUR   = true;         // false : tout en gris clair

const video  = document.querySelector(".ascii-source");
const dessin = document.querySelector(".ascii-bg");
const ctx    = dessin.getContext("2d");

// Petit canvas invisible qui sert à lire les pixels de la vidéo réduite
const lecture    = document.createElement("canvas");
const ctxLecture = lecture.getContext("2d", { willReadFrequently: true });

// Moins d'images par seconde si la personne a demandé "réduire les animations"
const animationsReduites = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const intervalle = 1000 / (animationsReduites ? 3 : IMAGES_PAR_SECONDE);

let colonnes = 0;
let lignes = 0;

// Adapte la taille du dessin à la fenêtre
function redimensionner() {
  const ratio = window.devicePixelRatio || 1;   // écrans "retina" : dessin plus net
  dessin.width  = window.innerWidth  * ratio;
  dessin.height = window.innerHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  colonnes = Math.ceil(window.innerWidth  / LARGEUR_CASE);
  lignes   = Math.ceil(window.innerHeight / HAUTEUR_CASE);
  lecture.width  = colonnes;
  lecture.height = lignes;
}
redimensionner();
window.addEventListener("resize", redimensionner);

// Copie l'image actuelle de la vidéo dans la petite grille,
// en la recadrant pour qu'elle remplisse tout l'écran (comme object-fit: cover)
function lireVideo() {
  const ecran = (colonnes * LARGEUR_CASE) / (lignes * HAUTEUR_CASE);   // proportions de l'écran
  const film  = video.videoWidth / video.videoHeight;                  // proportions de la vidéo
  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
  if (film > ecran) {
    sw = sh * ecran;                     // vidéo trop large : on coupe les côtés
    sx = (video.videoWidth - sw) / 2;
  } else {
    sh = sw / ecran;                     // vidéo trop haute : on coupe le haut et le bas
    sy = (video.videoHeight - sh) / 2;
  }
  ctxLecture.drawImage(video, sx, sy, sw, sh, 0, 0, colonnes, lignes);
  return ctxLecture.getImageData(0, 0, colonnes, lignes).data;   // [r, g, b, a, r, g, b, a, …]
}

function dessinerAscii() {
  const pixels = lireVideo();

  ctx.fillStyle = "#020202";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.font = HAUTEUR_CASE - 2 + 'px "BPdotsUnicasePlus", monospace';
  ctx.textBaseline = "top";

  for (let y = 0; y < lignes; y++) {
    for (let x = 0; x < colonnes; x++) {
      const i = (y * colonnes + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

      // Luminosité perçue, entre 0 (noir) et 1 (blanc)
      let lum = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * LUMINOSITE;
      lum = Math.min(1, Math.max(0, (lum - 0.5) * CONTRASTE + 0.5));   // on accentue l'écart clair / sombre
      const caractere = CARACTERES[Math.floor(lum * (CARACTERES.length - 1))];
      if (caractere === " ") continue;   // case vide : rien à dessiner

      ctx.fillStyle = EN_COULEUR
        ? "rgb(" + Math.min(255, r * LUMINOSITE) + "," + Math.min(255, g * LUMINOSITE) + "," + Math.min(255, b * LUMINOSITE) + ")"
        : "#bbbbbb";
      ctx.fillText(caractere, x * LARGEUR_CASE, y * HAUTEUR_CASE);
    }
  }
}

// Si la lecture des pixels est interdite : on affiche la vidéo telle quelle
function passerEnModeVideo(erreur) {
  console.warn("Fond ASCII indisponible (ouvre la page avec un serveur local, ex. Live Server) :", erreur);
  document.body.classList.add("ascii-indisponible");
}

let dernierDessin = 0;

function boucleAscii(instant) {
  if (document.body.classList.contains("ascii-indisponible")) return;   // on arrête la boucle

  if (instant - dernierDessin >= intervalle && video.readyState >= 2) {   // 2 = une image est prête
    dernierDessin = instant;
    try {
      dessinerAscii();
    } catch (erreur) {
      passerEnModeVideo(erreur);
      return;
    }
  }
  requestAnimationFrame(boucleAscii);
}

// Certains navigateurs bloquent la lecture automatique : on la relance au besoin
video.muted = true;
video.play().catch(function () {
  document.addEventListener("pointerdown", function () { video.play(); }, { once: true });
});

requestAnimationFrame(boucleAscii);
