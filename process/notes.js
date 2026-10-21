/* =========================================================
   BLOC-NOTES
   Construit la liste de gauche à partir des <article class="note">
   et affiche la note choisie. L'adresse retient la note ouverte
   (ex. notes.html#26-10-07), pour pouvoir partager un lien direct.
   ========================================================= */

(function () {

  const app = document.querySelector(".notes-app");
  const list = document.querySelector(".notes-list");
  const notes = Array.from(document.querySelectorAll(".note"));
  const items = new Map();

  // --- Remplir la liste ---
  notes.forEach(function (note) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notes-item";

    const title = document.createElement("span");
    title.className = "notes-item-title";
    title.textContent = note.dataset.title;

    // Début du texte de la note, comme aperçu
    const firstParagraph = note.querySelector("h2 ~ p:not(.note-with)");
    const preview = firstParagraph ? firstParagraph.textContent.trim() : "";

    const meta = document.createElement("span");
    meta.className = "notes-item-meta";
    meta.innerHTML = "<b></b>";
    meta.querySelector("b").textContent = note.dataset.date;
    meta.append(preview);

    item.append(title, meta);
    item.addEventListener("click", function () {
      history.replaceState(null, "", "#" + note.id);
      show(note.id);
      app.classList.add("is-reading");
    });

    list.appendChild(item);
    items.set(note.id, item);
  });

  // --- Retour à la liste (petit écran) ---
  document.querySelector(".notes-back").addEventListener("click", function () {
    app.classList.remove("is-reading");
  });

  // --- Afficher une note ---
  function show(id) {
    notes.forEach(function (note) {
      const visible = note.id === id;
      note.classList.toggle("is-visible", visible);
      items.get(note.id).classList.toggle("is-selected", visible);
    });
    document.querySelector(".notes-content").scrollTop = 0;
  }

  // Au chargement : la note indiquée dans l'adresse, sinon la plus récente
  const fromHash = decodeURIComponent(location.hash.slice(1));
  const start = notes.some(function (n) { return n.id === fromHash; }) ? fromHash : notes[0].id;
  show(start);
  if (fromHash === start) app.classList.add("is-reading");

})();
