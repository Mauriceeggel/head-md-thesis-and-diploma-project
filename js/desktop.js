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
  document.querySelectorAll(".folder").forEach(function (folder) {
    folder.addEventListener("click", function (event) {
      // Clic à la fin d'un déplacement de l'icône : on n'ouvre rien
      if (folder.dataset.justMoved) {
        event.preventDefault();
        return;
      }
      if (!folder.hasAttribute("data-window")) return;
      // Cmd/Ctrl + clic : on garde le comportement normal du lien
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      openWindow(folder.getAttribute("href"), folder.dataset.window, {
        width: Number(folder.dataset.width) || 0,
        height: Number(folder.dataset.height) || 0
      });
    });
  });


  /* ---------------------------------------------------------
     Messages venant des pages ouvertes dans les fenêtres
     - "open-image" : ouvrir une image en grand
       (process/notes.js, clic sur une image)
     - "window-fit" : ajuster la hauteur de la fenêtre
       (mp3-player/player.js, bouton PL)
     --------------------------------------------------------- */
  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || typeof data.type !== "string") return;

    // On n'accepte que les messages venant de nos propres fenêtres
    const source = Array.from(windows.values()).find(function (win) {
      const frame = win.querySelector("iframe");
      return frame && frame.contentWindow === event.source;
    });
    if (!source) return;

    if (data.type === "open-image" && typeof data.url === "string") {
      openWindow(data.url, data.title || "Image", {
        image: true,
        width: data.width,
        height: data.height
      });
    }

    if (data.type === "window-fit" && data.height > 0) {
      const bar = source.querySelector(".window-bar").offsetHeight;
      const borders = source.offsetHeight - source.clientHeight;
      const height = Math.min(window.innerHeight, Math.round(data.height) + bar + borders);
      source.style.height = height + "px";
      // La fenêtre ne doit pas dépasser du bas de l'écran
      if (source.offsetTop + height > window.innerHeight) {
        source.style.top = Math.max(0, window.innerHeight - height) + "px";
      }
    }
  });


  /* ---------------------------------------------------------
     Icônes du bureau déplaçables
     On les glisse comme sur un vrai bureau ; leur place est
     retenue par le navigateur (pour ce visiteur seulement).
     Un simple clic (sans glisser) ouvre toujours l'app.
     --------------------------------------------------------- */
  const desktop = document.querySelector(".desktop");
  const ICONS_KEY = "desktop-icons";
  const MOVE_THRESHOLD = 4; // px avant de considérer que c'est un glisser

  function loadIconPositions() {
    try {
      return JSON.parse(localStorage.getItem(ICONS_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function saveIconPositions() {
    const positions = {};
    desktop.querySelectorAll(".folder").forEach(function (folder) {
      positions[folder.getAttribute("href")] = {
        left: folder.offsetLeft,
        top: folder.offsetTop
      };
    });
    try {
      localStorage.setItem(ICONS_KEY, JSON.stringify(positions));
    } catch (error) {
      // stockage indisponible (navigation privée…) : tant pis
    }
  }

  // Garde l'icône entièrement visible sur le bureau
  function placeIcon(folder, left, top) {
    const maxLeft = Math.max(0, desktop.clientWidth - folder.offsetWidth);
    const maxTop = Math.max(0, desktop.clientHeight - folder.offsetHeight);
    folder.style.left = Math.min(maxLeft, Math.max(0, left)) + "px";
    folder.style.top = Math.min(maxTop, Math.max(0, top)) + "px";
  }

  // Au départ, les icônes sont rangées en colonne par le CSS.
  // On note cette place, puis on passe en placement libre.
  (function setupDesktopIcons() {
    const folders = Array.from(desktop.querySelectorAll(".folder"));
    const saved = loadIconPositions();
    const initial = folders.map(function (folder) {
      return { left: folder.offsetLeft, top: folder.offsetTop };
    });

    desktop.classList.add("is-free");

    folders.forEach(function (folder, index) {
      const position = saved[folder.getAttribute("href")] || initial[index];
      placeIcon(folder, position.left, position.top);

      folder.draggable = false; // pas de "glisser-déposer" natif du lien
      folder.addEventListener("pointerdown", function (event) {
        startIconDrag(event, folder);
      });
    });

    window.addEventListener("resize", function () {
      folders.forEach(function (folder) {
        placeIcon(folder, folder.offsetLeft, folder.offsetTop);
      });
    });
  })();

  function startIconDrag(event, folder) {
    if (event.button !== 0) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = folder.offsetLeft;
    const startTop = folder.offsetTop;
    let moved = false;

    track(event, function (e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
      if (!moved) {
        moved = true;
        folder.classList.add("is-moving");
      }
      placeIcon(folder, startLeft + dx, startTop + dy);
    }, function () {
      folder.classList.remove("is-moving");
      if (!moved) return;
      saveIconPositions();
      // Le "click" qui suit le relâchement ne doit pas ouvrir l'app
      folder.dataset.justMoved = "1";
      setTimeout(function () {
        delete folder.dataset.justMoved;
      });
    });
  }


  /* ---------------------------------------------------------
     Ouvrir (ou ramener devant) une fenêtre
     options.image : true pour une fenêtre "aperçu d'image"
     options.width / options.height : taille réelle de l'image
     --------------------------------------------------------- */
  function openWindow(url, title, options) {
    let win = windows.get(url);

    if (!win) {
      win = createWindow(url, title, options || {});
      windows.set(url, win);
    }

    win.classList.remove("is-minimized");
    focusWindow(win);
  }


  /* ---------------------------------------------------------
     Construire la fenêtre
     --------------------------------------------------------- */
  function createWindow(url, title, options) {
    const win = document.createElement("section");
    win.className = "window is-opening" + (options.image ? " window--image" : "");
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
      (options.image
        ? '<div class="window-content window-image"><img alt="" draggable="false"></div>' +
          // Zoom de l'image, en bas à droite (voir setupImageZoom)
          '<div class="image-zoom">' +
            '<button class="image-zoom-step" type="button" data-step="-1" aria-label="Dézoomer">−</button>' +
            '<input class="image-zoom-slider" type="range" min="100" max="400" step="1" value="100" aria-label="Zoom">' +
            '<button class="image-zoom-step" type="button" data-step="1" aria-label="Zoomer">+</button>' +
            '<button class="image-zoom-value" type="button" title="Revenir à 100 %">100 %</button>' +
          '</div>'
        : '<iframe class="window-content" allow="autoplay; fullscreen"></iframe>') +
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
    // Taille de départ : 80 % de l'écran au maximum
    let w = Math.min(1100, Math.round(window.innerWidth * 0.8));
    let h = Math.min(760, Math.round(window.innerHeight * 0.8));

    if (options.image) {
      const img = win.querySelector(".window-image img");
      img.src = url;
      img.alt = title;

      // La fenêtre prend les proportions de l'image (sans la
      // dépasser en taille réelle), barre de titre comprise.
      if (options.width > 0 && options.height > 0) {
        const BAR = 36;
        const maxW = Math.round(window.innerWidth * 0.85);
        const maxH = Math.round(window.innerHeight * 0.85) - BAR;
        const scale = Math.min(1, maxW / options.width, maxH / options.height);
        w = Math.max(320, Math.round(options.width * scale));
        h = Math.max(200, Math.round(options.height * scale) + BAR);
      }
    } else {
      win.querySelector(".window-content").src = url;

      // Taille demandée par le dossier (data-width / data-height) :
      // c'est la taille du contenu, on ajoute la barre de titre.
      if (options.width > 0 && options.height > 0) {
        const BAR = 36;
        w = Math.min(window.innerWidth, options.width + 2);
        h = Math.min(window.innerHeight, options.height + BAR + 2);
      }
    }

    // Position de départ : centrée
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

    if (options.image) setupImageZoom(win);

    return win;
  }


  /* ---------------------------------------------------------
     Zoom dans une fenêtre d'image
     - slider en bas à droite (100 % = image entière dans la fenêtre)
     - boutons − / + et clic sur le pourcentage pour revenir à 100 %
     - pincer sur le trackpad (ou Ctrl + molette) pour zoomer
     - double-clic sur l'image : zoom ×2 / retour à 100 %
     - image zoomée : glisser pour se déplacer dedans
     --------------------------------------------------------- */
  function setupImageZoom(win) {
    const MIN = 1;
    const MAX = 4;
    const STEP = 0.25; // pas des boutons − / +

    const view = win.querySelector(".window-image");
    const img = view.querySelector("img");
    const slider = win.querySelector(".image-zoom-slider");
    const value = win.querySelector(".image-zoom-value");

    let zoom = 1;

    // Taille de l'image quand elle tient entière dans la fenêtre
    function fitSize() {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh || !view.clientWidth || !view.clientHeight) return null;
      const scale = Math.min(view.clientWidth / nw, view.clientHeight / nh);
      return { width: nw * scale, height: nh * scale };
    }

    // Change le zoom en gardant immobile le point (x, y) de la fenêtre
    // (par défaut le centre) : on zoome "vers" ce point.
    function setZoom(newZoom, x, y) {
      const fit = fitSize();
      if (!fit) return;

      newZoom = Math.min(MAX, Math.max(MIN, newZoom));
      const box = view.getBoundingClientRect();
      if (x === undefined) x = box.width / 2;
      if (y === undefined) y = box.height / 2;

      // Où se trouve ce point sur l'image, en proportion (0 → 1)
      const before = img.getBoundingClientRect();
      const ratioX = clamp01((box.left + x - before.left) / before.width);
      const ratioY = clamp01((box.top + y - before.top) / before.height);

      zoom = newZoom;
      img.style.width = fit.width * zoom + "px";
      img.style.height = fit.height * zoom + "px";
      view.classList.toggle("is-zoomed", zoom > 1);

      // On fait défiler pour ramener ce point sous la souris / au centre
      const after = img.getBoundingClientRect();
      view.scrollLeft += after.left + ratioX * after.width - (box.left + x);
      view.scrollTop += after.top + ratioY * after.height - (box.top + y);

      const percent = Math.round(zoom * 100);
      slider.value = percent;
      value.textContent = percent + " %";
      // Partie remplie du slider (voir --fill dans style.css)
      slider.style.setProperty("--fill", ((zoom - MIN) / (MAX - MIN)) * 100 + "%");
    }

    function clamp01(n) {
      return isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
    }

    // Taille correcte dès que l'image est chargée, puis à chaque
    // redimensionnement de la fenêtre (agrandir, plein écran…)
    if (img.complete) setZoom(zoom);
    img.addEventListener("load", function () { setZoom(zoom); });
    if (window.ResizeObserver) {
      new ResizeObserver(function () { setZoom(zoom); }).observe(view);
    }

    // --- Commandes en bas à droite ---
    slider.addEventListener("input", function () {
      setZoom(slider.value / 100);
    });

    win.querySelectorAll(".image-zoom-step").forEach(function (button) {
      button.addEventListener("click", function () {
        setZoom(zoom + Number(button.dataset.step) * STEP);
      });
    });

    value.addEventListener("click", function () {
      setZoom(1);
    });

    // --- Pincer (trackpad) / Ctrl + molette ---
    view.addEventListener("wheel", function (event) {
      if (!event.ctrlKey) return; // molette seule : défilement normal
      event.preventDefault();
      const box = view.getBoundingClientRect();
      setZoom(zoom * Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top);
    }, { passive: false });

    // --- Double-clic : zoom ×2 à l'endroit cliqué / retour à 100 % ---
    img.addEventListener("dblclick", function (event) {
      const box = view.getBoundingClientRect();
      setZoom(zoom > 1 ? 1 : 2, event.clientX - box.left, event.clientY - box.top);
    });

    // --- Glisser pour se déplacer dans l'image zoomée ---
    view.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || zoom <= 1) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = view.scrollLeft;
      const startTop = view.scrollTop;

      view.classList.add("is-panning");
      track(event, function (e) {
        view.scrollLeft = startLeft - (e.clientX - startX);
        view.scrollTop = startTop - (e.clientY - startY);
      });
      window.addEventListener("pointerup", function () {
        view.classList.remove("is-panning");
      }, { once: true });
    });
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
  function track(event, onMove, onEnd) {
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
      if (onEnd) onEnd();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

})();
