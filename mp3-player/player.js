/* =========================================================
   LECTEUR MP3
   Pilote le lecteur SoundCloud caché (API Widget) et affiche
   tout dans notre propre interface.

   Au lancement : un morceau de la playlist est choisi au hasard.
   SHUFFLE allumé : morceau suivant au hasard.
   Répéter allumé : la playlist recommence après le dernier morceau.
   ========================================================= */

(function () {

  // Page de la playlist sur SoundCloud (bouton "éjecter")
  const PLAYLIST_PAGE = "https://soundcloud.com/osmamia/sets/umqtjlqixlv0/s-yXMeuP13wrF";

  // Taille "dessinée" du lecteur (voir player.css)
  const WIDTH = 550;
  const PLAYER_HEIGHT = 232;
  const PLAYLIST_HEIGHT = 200;

  const $ = function (selector) { return document.querySelector(selector); };

  const app = $(".app");
  const stateIcon = $(".lcd-state");
  const timeEl = $(".lcd-time");
  const canvas = $(".lcd-spectrum");
  const marquee = $(".marquee");
  const marqueeText = $(".marquee-text");
  const seek = $(".seek");
  const volume = $(".slider-volume");
  const playlistPanel = $(".playlist");
  const tracksList = $(".playlist-tracks");

  const widget = SC.Widget($(".soundcloud"));

  let sounds = [];          // morceaux de la playlist
  let current = -1;         // numéro du morceau en cours (0 = premier)
  let duration = 0;         // durée du morceau (ms)
  let position = 0;         // position dans le morceau (ms)
  let state = "stopped";    // "playing", "paused" ou "stopped"
  let stopping = false;     // bouton stop en cours
  let pending = null;       // morceau demandé (voir onPlay)
  let seeking = false;      // on glisse la barre d'avancement
  let showRemaining = false;
  let shuffle = true;
  let repeat = true;


  /* ---------------------------------------------------------
     Taille : le lecteur remplit la fenêtre sans se déformer
     --------------------------------------------------------- */
  function designHeight() {
    return PLAYER_HEIGHT + (playlistPanel.hidden ? 0 : PLAYLIST_HEIGHT);
  }

  function fit() {
    const zoom = Math.min(window.innerWidth / WIDTH, window.innerHeight / designHeight());
    app.style.zoom = zoom;
    updateMarquee();
  }

  window.addEventListener("resize", fit);
  fit();

  // Demande au bureau d'ajuster la hauteur de la fenêtre (bouton PL)
  function askWindowHeight() {
    if (window.parent === window) return;
    const scale = window.innerWidth / WIDTH;
    window.parent.postMessage({
      type: "window-fit",
      height: Math.round(designHeight() * scale)
    }, "*");
  }


  /* ---------------------------------------------------------
     SoundCloud : démarrage et événements
     --------------------------------------------------------- */
  widget.bind(SC.Widget.Events.READY, function () {
    widget.setVolume(Number(volume.value));

    widget.getSounds(function (list) {
      sounds = list || [];
      renderPlaylist();
      if (!sounds.length) {
        setMarquee("PLAYLIST VIDE");
        return;
      }

      // Lancement : un morceau au hasard
      playIndex(randomIndex());

      // Si le navigateur bloque la lecture automatique
      setTimeout(function () {
        if (state !== "playing") setMarquee("APPUIE SUR ▶ POUR JOUER");
      }, 3000);
    });
  });

  widget.bind(SC.Widget.Events.PLAY, function () {
    setState("playing");

    widget.getCurrentSoundIndex(function (index) {
      // SoundCloud enchaîne parfois tout seul sur le morceau suivant :
      // si ce n'est pas celui qu'on a demandé, on y retourne.
      if (pending !== null && index !== pending) {
        widget.skip(pending);
        return;
      }
      pending = null;
      current = index;
      refreshTrack();
    });
  });

  widget.bind(SC.Widget.Events.PAUSE, function () {
    setState(stopping ? "stopped" : "paused");
    stopping = false;
  });

  widget.bind(SC.Widget.Events.FINISH, function () {
    const last = current === sounds.length - 1;
    if (shuffle) {
      playIndex(randomIndex());
    } else if (last && repeat) {
      playIndex(0);
    } else if (last) {
      setState("stopped");
    }
    // sinon SoundCloud passe lui-même au morceau suivant
  });

  widget.bind(SC.Widget.Events.PLAY_PROGRESS, function (event) {
    position = event.currentPosition;
    if (!duration && event.relativePosition > 0) {
      duration = event.currentPosition / event.relativePosition;
    }
    if (!seeking) {
      renderTime();
      renderSeek();
    }
  });


  /* ---------------------------------------------------------
     Changer de morceau
     --------------------------------------------------------- */
  function playIndex(index) {
    if (!sounds.length) return;
    pending = index;
    current = index;
    duration = 0;
    position = 0;
    renderTime();
    renderSeek();
    setMarquee(trackLabel(sounds[index], index));
    highlightTrack();
    widget.skip(index); // skip lance aussi la lecture
  }

  function randomIndex() {
    if (sounds.length <= 1) return 0;
    let index;
    do {
      index = Math.floor(Math.random() * sounds.length);
    } while (index === current);
    return index;
  }

  // Infos complètes du morceau en cours (titre, durée)
  function refreshTrack() {
    widget.getCurrentSound(function (sound) {
      if (!sound) return;
      sounds[current] = sound;
      duration = sound.duration || duration;
      setMarquee(trackLabel(sound, current));
      updatePlaylistItem(current);
      highlightTrack();
      renderSeek();
    });
  }

  // "3. Artiste - Titre"
  function trackLabel(sound, index) {
    const number = index + 1 + ". ";
    if (!sound || !sound.title) return number + "...";
    const artist = sound.user && sound.user.username;
    if (!artist || sound.title.indexOf(" - ") !== -1) return number + sound.title;
    return number + artist + " - " + sound.title;
  }


  /* ---------------------------------------------------------
     Affichage
     --------------------------------------------------------- */
  function setState(newState) {
    state = newState;
    stateIcon.className = "lcd-state is-" + state;
    if (state === "stopped") {
      position = 0;
      renderTime();
      renderSeek();
    }
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }

  function renderTime(ms) {
    const at = ms === undefined ? position : ms;
    const remaining = showRemaining && duration;
    timeEl.textContent = formatTime(remaining ? duration - at : at);
    timeEl.classList.toggle("is-remaining", Boolean(remaining));
  }

  function renderSeek() {
    seek.disabled = !duration;
    seek.value = duration ? Math.round((position / duration) * 1000) : 0;
  }

  // Titre qui défile s'il ne tient pas dans l'écran
  function setMarquee(text) {
    marqueeText.dataset.text = text;
    updateMarquee();
  }

  function updateMarquee() {
    const text = marqueeText.dataset.text || marqueeText.textContent;
    marqueeText.textContent = text;
    marquee.classList.remove("is-scrolling");

    if (marqueeText.offsetWidth > marquee.clientWidth) {
      // Texte doublé pour une boucle sans à-coup
      marqueeText.textContent = text + "   ***   " + text + "   ***   ";
      marquee.style.setProperty("--duration", text.length * 0.28 + "s");
      marquee.classList.add("is-scrolling");
    }
  }


  /* ---------------------------------------------------------
     Liste des morceaux (bouton PL)
     --------------------------------------------------------- */
  function renderPlaylist() {
    tracksList.innerHTML = "";
    sounds.forEach(function (sound, index) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      item.appendChild(label);
      item.addEventListener("click", function () {
        playIndex(index);
      });
      tracksList.appendChild(item);
      updatePlaylistItem(index);
    });
    highlightTrack();
  }

  function updatePlaylistItem(index) {
    const item = tracksList.children[index];
    if (!item) return;
    // Sans le numéro (la liste le met déjà)
    item.firstChild.textContent = trackLabel(sounds[index], index).replace(/^\d+\. /, "");
  }

  function highlightTrack() {
    Array.prototype.forEach.call(tracksList.children, function (item, index) {
      item.classList.toggle("is-current", index === current);
    });
    const active = tracksList.children[current];
    if (active && !playlistPanel.hidden) active.scrollIntoView({ block: "nearest" });
  }


  /* ---------------------------------------------------------
     Boutons
     --------------------------------------------------------- */
  $(".btn-play").addEventListener("click", function () {
    if (current < 0) {
      playIndex(randomIndex());
    } else {
      widget.play();
    }
  });

  $(".btn-pause").addEventListener("click", function () {
    if (state === "playing") widget.pause();
    else if (state === "paused") widget.play();
  });

  $(".btn-stop").addEventListener("click", function () {
    if (state === "stopped") return;
    stopping = state === "playing";
    widget.pause();
    widget.seekTo(0);
    setState("stopped");
  });

  $(".btn-prev").addEventListener("click", function () {
    if (!sounds.length) return;
    // Après 3 secondes : retour au début du morceau, comme sur les vrais lecteurs
    if (position > 3000) {
      widget.seekTo(0);
      return;
    }
    playIndex((current - 1 + sounds.length) % sounds.length);
  });

  $(".btn-next").addEventListener("click", function () {
    if (!sounds.length) return;
    playIndex(shuffle ? randomIndex() : (current + 1) % sounds.length);
  });

  $(".btn-eject").addEventListener("click", function () {
    window.open(PLAYLIST_PAGE, "_blank", "noopener");
  });

  // Boutons à voyant
  function toggle(button, on) {
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on);
  }

  $(".toggle-shuffle").addEventListener("click", function () {
    shuffle = !shuffle;
    toggle(this, shuffle);
  });

  $(".toggle-repeat").addEventListener("click", function () {
    repeat = !repeat;
    toggle(this, repeat);
  });

  // EQ : décoratif (SoundCloud ne permet pas de régler le son)
  $(".toggle-eq").addEventListener("click", function () {
    toggle(this, !this.classList.contains("is-on"));
  });

  $(".toggle-pl").addEventListener("click", function () {
    playlistPanel.hidden = !playlistPanel.hidden;
    toggle(this, !playlistPanel.hidden);
    askWindowHeight();
    fit();
    highlightTrack();
  });

  // Volume (la balance est décorative)
  volume.addEventListener("input", function () {
    widget.setVolume(Number(volume.value));
  });

  // Barre d'avancement
  seek.addEventListener("input", function () {
    seeking = true;
    renderTime((seek.value / 1000) * duration);
  });

  seek.addEventListener("change", function () {
    position = (seek.value / 1000) * duration;
    widget.seekTo(position);
    seeking = false;
    renderTime();
  });

  // Clic sur le temps : écoulé / restant
  timeEl.addEventListener("click", function () {
    showRemaining = !showRemaining;
    renderTime();
  });


  /* ---------------------------------------------------------
     Spectre animé
     (SoundCloud ne donne pas accès au son lui-même : les barres
     sont simulées, mais elles bougent seulement pendant la lecture)
     --------------------------------------------------------- */
  const ctx = canvas.getContext("2d");
  const BARS = 19;
  const ROWS = canvas.height;
  const levels = new Array(BARS).fill(0);
  const peaks = new Array(BARS).fill(0);
  let lastFrame = 0;

  // Couleur de chaque ligne : vert en bas, jaune, puis rouge en haut
  function rowColor(row) {
    const t = row / (ROWS - 1);
    if (t > 0.8) return "#ff3b1c";
    if (t > 0.6) return "#ffb21c";
    if (t > 0.4) return "#d6ff1c";
    return "#1cff3c";
  }

  function drawSpectrum(time) {
    requestAnimationFrame(drawSpectrum);
    if (time - lastFrame < 45) return; // environ 22 images / seconde
    lastFrame = time;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < BARS; i++) {
      if (state === "playing") {
        // Plus d'énergie dans les basses (à gauche)
        const base = 0.25 + 0.55 * (1 - i / BARS);
        const target = base * (0.35 + Math.random() * 0.9);
        levels[i] += (target - levels[i]) * 0.55;
      } else {
        levels[i] *= 0.8;
      }

      const height = Math.min(ROWS, Math.round(levels[i] * ROWS));
      peaks[i] = Math.max(height, peaks[i] - 0.35);

      const x = i * 4;
      for (let row = 0; row < height; row++) {
        ctx.fillStyle = rowColor(row);
        ctx.fillRect(x, ROWS - 1 - row, 3, 1);
      }
      if (peaks[i] >= 1) {
        ctx.fillStyle = "#c8c8d8";
        ctx.fillRect(x, Math.max(0, ROWS - 1 - Math.round(peaks[i])), 3, 1);
      }
    }
  }

  requestAnimationFrame(drawSpectrum);
  setState("stopped");

})();
