/* =========================================================
   ÉCRAN DE DÉMARRAGE
   Clic (ou touche Entrée / Espace) → le son de démarrage se joue,
   la barre se remplit au rythme du son, puis l'écran disparaît en
   fondu à l'entrée du piano (FADE_START).
   ========================================================= */

(function () {

  // Moment du son (en secondes) où le fondu commence : l'entrée du piano.
  // Le son dure 4,9 s ; la barre est pleine à ce moment-là.
  const FADE_START = 2.2;

  // Durée du fondu, en secondes. Le son continue de jouer après.
  const FADE = 1.2;

  const boot = document.querySelector(".boot");
  if (!boot) return;

  const power = boot.querySelector(".boot-power");
  const progress = boot.querySelector(".boot-progress");
  const sound = boot.querySelector(".boot-sound");

  let started = false;

  power.focus();
  power.addEventListener("click", start);
  document.addEventListener("keydown", onKey);

  function onKey(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      start();
    }
  }


  /* ---------------------------------------------------------
     Démarrage
     --------------------------------------------------------- */
  function start() {
    if (started) return;
    started = true;
    document.removeEventListener("keydown", onKey);
    boot.classList.add("is-starting");

    // Horloge de secours : utilisée tant que le son ne joue pas
    const startTime = performance.now();
    let useSound = false;

    const playing = sound.play();
    if (playing) {
      playing.then(function () { useSound = true; }).catch(function () {});
    }

    let fading = false;

    // À chaque image : avancer la barre et lancer le fondu au bon moment.
    // On suit la lecture du son ; si le son ne joue pas (bloqué ou
    // fichier manquant), on suit une horloge à la place.
    function tick() {
      const elapsed = useSound
        ? sound.currentTime
        : (performance.now() - startTime) / 1000;

      progress.style.width = Math.min(100, (elapsed / FADE_START) * 100) + "%";

      if (elapsed >= FADE_START) {
        fading = true;
        fadeOut(FADE);
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    // Sécurité : si le son se termine avant que le fondu ait commencé
    // (onglet en arrière-plan, par exemple), on termine tout de suite.
    sound.addEventListener("ended", function () {
      if (!fading) {
        fading = true;
        fadeOut(0.3);
      }
    });
  }


  /* ---------------------------------------------------------
     Fondu puis suppression de l'écran
     --------------------------------------------------------- */
  function fadeOut(seconds) {
    boot.style.transitionDuration = seconds + "s";
    boot.classList.add("is-fading");
    // On cache l'écran au lieu de le supprimer : supprimer l'élément
    // <audio> qu'il contient couperait la fin du son.
    setTimeout(function () {
      boot.hidden = true;
    }, seconds * 1000 + 100);
  }

})();
