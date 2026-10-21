/* =========================================================
   BUREAU — ouverture des dossiers en fenêtres
   Un dossier avec l'attribut data-window s'ouvre dans une
   fenêtre style macOS au lieu de quitter la page.

   Dans la fenêtre :
   - barre de titre : glisser pour déplacer, double-clic pour agrandir
   - bords et coins : glisser pour redimensionner
   - rouge : fermer · jaune : réduire · vert : agrandir / rétablir
   - à droite : plein écran · ouvrir dans un nouvel onglet
   ========================================================= */

(function () {

  // Sur petit écran (téléphone), les fenêtres s'ouvrent agrandies
  const SMALL_SCREEN = window.matchMedia("(max-width: 700px)");

  // Fenêtres déjà créées, rangées par adresse (href du dossier)
  const windows = new Map();

  // Chaque fenêtre cliquée passe devant les autres
  let topZ = 10;

  // Décalage pour que plusieurs fenêtres ne s'ouvrent pas pile au même endroit
  let cascade = 0;


  /* ---------------------------------------------------------
     Clic sur un dossier
     --------------------------------------------------------- */
  document.querySelectorAll(".folder[data-window]").forEach(function (folder) {
    folder.addEventListener("click", function (event) {
      // Cmd/Ctrl + clic : on garde le comportement normal du lien
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      openWindow(folder.getAttribute("href"), folder.dataset.window);
    });
  });


  /* ---------------------------------------------------------
     Ouvrir (ou ramener devant) une fenêtre
     --------------------------------------------------------- */
  function openWindow(url, title) {
    let win = windows.get(url);

    if (!win) {
      win = createWindow(url, title);
      windows.set(url, win);
    }

    win.classList.remove("is-minimized");
    focusWindow(win);
  }


  /* ---------------------------------------------------------
     Construire la fenêtre
     --------------------------------------------------------- */
  function createWindow(url, title) {
    const win = document.createElement("section");
    win.className = "window is-opening";
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", title);

    win.innerHTML =
      '<header class="window-bar">' +
        '<div class="window-lights">' +
          '<button class="light light-close" type="button" aria-label="Fermer"></button>' +
          '<button class="light light-minimize" type="button" aria-label="Réduire"></button>' +
          '<button class="light light-zoom" type="button" aria-label="Agrandir"></button>' +
        '</div>' +
        '<div class="window-title"></div>' +
        '<div class="window-tools">' +
          '<button class="window-tool tool-fullscreen" type="button" aria-label="Plein écran" title="Plein écran">' +
            '<svg viewBox="0 0 16 16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>' +
          '</button>' +
          '<a class="window-tool tool-newtab" target="_blank" rel="noopener" aria-label="Ouvrir dans un nouvel onglet" title="Ouvrir dans un nouvel onglet">' +
            '<svg viewBox="0 0 16 16"><path d="M9 2h5v5M14 2 7 9M12 10v4H2V4h4"/></svg>' +
          '</a>' +
        '</div>' +
      '</header>' +
      '<iframe class="window-content" allow="autoplay; fullscreen"></iframe>' +
      '<div class="resize resize-n" data-dir="n"></div>' +
      '<div class="resize resize-s" data-dir="s"></div>' +
      '<div class="resize resize-e" data-dir="e"></div>' +
      '<div class="resize resize-w" data-dir="w"></div>' +
      '<div class="resize resize-ne" data-dir="ne"></div>' +
      '<div class="resize resize-nw" data-dir="nw"></div>' +
      '<div class="resize resize-se" data-dir="se"></div>' +
      '<div class="resize resize-sw" data-dir="sw"></div>';

    win.querySelector(".window-title").textContent = title;
    win.querySelector(".tool-newtab").href = url;
    win.querySelector(".window-content").src = url;

    // Taille et position de départ : 80 % de l'écran, centrée
    const w = Math.min(1100, Math.round(window.innerWidth * 0.8));
    const h = Math.min(760, Math.round(window.innerHeight * 0.8));
    win.style.width = w + "px";
    win.style.height = h + "px";
    win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2) + cascade) + "px";
    win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2) + cascade) + "px";
    cascade = (cascade + 24) % 120;

    if (SMALL_SCREEN.matches) win.classList.add("is-maximized");

    win.addEventListener("animationend", function () {
      win.classList.remove("is-opening");
    });

    document.body.appendChild(win);

    // --- Boutons ---
    win.querySelector(".light-close").addEventListener("click", function () {
      closeWindow(win, url);
    });

    win.querySelector(".light-minimize").addEventListener("click", function () {
      win.classList.add("is-minimized");
      activateTopWindow();
    });

    win.querySelector(".light-zoom").addEventListener("click", function () {
      toggleMaximize(win);
    });

    win.querySelector(".tool-fullscreen").addEventListener("click", function () {
      if (document.fullscreenElement === win) {
        document.exitFullscreen();
      } else if (win.requestFullscreen) {
        win.requestFullscreen();
      } else if (win.webkitRequestFullscreen) {
        win.webkitRequestFullscreen(); // ancien Safari
      }
    });

    // Les boutons ne doivent pas déclencher le déplacement de la fenêtre
    win.querySelectorAll(".light, .window-tool").forEach(function (button) {
      button.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
        focusWindow(win);
      });
    });

    // --- Mettre la fenêtre devant quand on clique dessus ---
    win.addEventListener("pointerdown", function () {
      focusWindow(win);
    });

    // Un clic dans l'iframe ne remonte pas jusqu'ici : on détecte
    // quand la page perd le focus au profit de cette iframe.
    window.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.activeElement === win.querySelector(".window-content")) {
          focusWindow(win);
        }
      });
    });

    // --- Déplacer / agrandir avec la barre de titre ---
    const bar = win.querySelector(".window-bar");
    bar.addEventListener("pointerdown", function (event) {
      startDrag(event, win);
    });
    bar.addEventListener("dblclick", function (event) {
      if (event.target.closest(".light, .window-tool")) return;
      toggleMaximize(win);
    });

    // --- Redimensionner avec les bords et les coins ---
    win.querySelectorAll(".resize").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (event) {
        startResize(event, win, handle.dataset.dir);
      });
    });

    return win;
  }


  /* ---------------------------------------------------------
     Fermer / agrandir / mettre au premier plan
     --------------------------------------------------------- */
  function closeWindow(win, url) {
    if (document.fullscreenElement === win) document.exitFullscreen();
    win.remove();
    windows.delete(url);
    activateTopWindow();
  }

  function toggleMaximize(win) {
    win.classList.toggle("is-maximized");
  }

  function focusWindow(win) {
    document.querySelectorAll(".window.is-active").forEach(function (other) {
      if (other !== win) other.classList.remove("is-active");
    });
    win.classList.add("is-active");
    win.style.zIndex = ++topZ;
  }

  // Après une fermeture ou une réduction : la fenêtre visible la plus
  // en avant redevient active.
  function activateTopWindow() {
    let best = null;
    document.querySelectorAll(".window:not(.is-minimized)").forEach(function (win) {
      if (!best || Number(win.style.zIndex) > Number(best.style.zIndex)) best = win;
    });
    document.querySelectorAll(".window.is-active").forEach(function (win) {
      win.classList.remove("is-active");
    });
    if (best) best.classList.add("is-active");
  }


  /* ---------------------------------------------------------
     Déplacement
     --------------------------------------------------------- */
  function startDrag(event, win) {
    if (event.button !== 0) return;
    if (win.classList.contains("is-maximized") || document.fullscreenElement === win) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = win.offsetLeft;
    const startTop = win.offsetTop;

    track(event, function (e) {
      const left = startLeft + e.clientX - startX;
      // La barre de titre reste toujours atteignable (pas au-dessus de l'écran)
      const top = Math.max(0, startTop + e.clientY - startY);
      win.style.left = left + "px";
      win.style.top = Math.min(top, window.innerHeight - 36) + "px";
    });
  }


  /* ---------------------------------------------------------
     Redimensionnement
     dir = n, s, e, w ou un coin (ne, nw, se, sw)
     --------------------------------------------------------- */
  function startResize(event, win, dir) {
    if (event.button !== 0) return;
    event.stopPropagation();
    focusWindow(win);

    const style = getComputedStyle(win);
    const minW = parseFloat(style.minWidth);
    const minH = parseFloat(style.minHeight);

    const startX = event.clientX;
    const startY = event.clientY;
    const start = {
      left: win.offsetLeft,
      top: win.offsetTop,
      width: win.offsetWidth,
      height: win.offsetHeight
    };

    track(event, function (e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (dir.includes("e")) {
        win.style.width = Math.max(minW, start.width + dx) + "px";
      }
      if (dir.includes("s")) {
        win.style.height = Math.max(minH, start.height + dy) + "px";
      }
      if (dir.includes("w")) {
        const width = Math.max(minW, start.width - dx);
        win.style.width = width + "px";
        win.style.left = start.left + start.width - width + "px";
      }
      if (dir.includes("n")) {
        const height = Math.max(minH, start.height - dy);
        const top = Math.max(0, start.top + start.height - height);
        win.style.height = start.top + start.height - top + "px";
        win.style.top = top + "px";
      }
    });
  }


  /* ---------------------------------------------------------
     Suivre la souris / le doigt jusqu'au relâchement
     --------------------------------------------------------- */
  function track(event, onMove) {
    event.preventDefault();
    document.body.classList.add("is-dragging");

    function move(e) {
      onMove(e);
    }

    function stop() {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

})();
