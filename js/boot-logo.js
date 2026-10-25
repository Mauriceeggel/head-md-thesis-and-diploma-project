/* =========================================================
   LOGO 3D DU BOUTON DE DÉMARRAGE
   Charge img/kgm-logo-3d.glb, lui donne une matière métallique
   et l'anime :
   - en attente : il tourne lentement sur lui-même
   - au survol  : il tourne plus vite et s'incline vers la souris
   - au clic    : il accélère, puis ralentit pendant le chargement
   Si la 3D ne peut pas s'afficher, le dessin SVG du bouton reste.
   ========================================================= */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODEL = "img/kgm-logo-3d.glb";

// Matière métallique : change ces valeurs pour un autre métal
// (or : 0xd4af37 · cuivre : 0xb87333 · argent / chrome : 0xdddddd)
const METAL_COLOR = 0xdddddd;
const ROUGHNESS = 0.3;           // 0 = miroir parfait, 1 = métal brossé mat

// Vitesses de rotation (tours par seconde)
const SPEED_IDLE = 0.12;
const SPEED_HOVER = 0.35;
const SPEED_CLICK = 2.5;         // élan au moment du clic

const boot = document.querySelector(".boot");
const button = document.querySelector(".boot-power--3d");

if (boot && button) init();

function init() {
  // --- Rendu ---
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    return; // pas de WebGL : on garde le dessin SVG
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1.35;   // luminosité générale

  const scene = new THREE.Scene();

  // Un métal n'a pas de couleur propre : il reflète ce qui l'entoure.
  // RoomEnvironment est une pièce virtuelle éclairée qui sert de reflet.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Deux lumières pour faire briller les arêtes du métal quand il tourne
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(-3, -1, -2);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  // Le logo tourne dans "pivot" ; "tilt" gère l'inclinaison vers la souris
  const tilt = new THREE.Group();
  const pivot = new THREE.Group();
  tilt.add(pivot);
  scene.add(tilt);

  const material = new THREE.MeshStandardMaterial({
    color: METAL_COLOR,
    metalness: 1,
    roughness: ROUGHNESS
  });

  new GLTFLoader().load(MODEL, function (gltf) {
    const logo = gltf.scene;

    logo.traverse(function (child) {
      if (child.isMesh) child.material = material;
    });

    // Centrer le logo et le mettre à une taille connue
    const box = new THREE.Box3().setFromObject(logo);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    logo.position.sub(center);
    const scale = 2 / Math.max(size.x, size.y, size.z);
    pivot.scale.setScalar(scale);
    pivot.add(logo);

    button.prepend(renderer.domElement);
    button.classList.add("has-3d");
    resize();
    requestAnimationFrame(loop);
  }, undefined, function () {
    // Modèle introuvable : on garde le dessin SVG
  });

  // --- Taille du rendu = taille du bouton ---
  function resize() {
    const w = button.clientWidth;
    const h = button.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // --- Souris ---
  let hover = false;
  const pointer = { x: 0, y: 0 };

  button.addEventListener("pointerenter", function () { hover = true; });
  button.addEventListener("pointerleave", function () {
    hover = false;
    pointer.x = 0;
    pointer.y = 0;
  });
  button.addEventListener("pointermove", function (event) {
    const rect = button.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  });

  // --- Clic : un élan de rotation (le clic lui-même est géré par boot.js) ---
  let speed = SPEED_IDLE;
  // (écoute "capture" : passe avant boot.js, qui marque le démarrage)
  button.addEventListener("click", kick, true);
  window.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") kick();
  }, true);

  function kick() {
    if (boot.classList.contains("is-starting")) return;
    speed = SPEED_CLICK;
  }

  // --- Animation ---
  const clock = new THREE.Clock();

  function loop() {
    // L'écran de démarrage a disparu : on arrête de calculer la 3D
    if (boot.hidden) {
      renderer.dispose();
      return;
    }

    const dt = Math.min(clock.getDelta(), 0.1);
    const starting = boot.classList.contains("is-starting");

    // La vitesse revient doucement vers sa valeur de repos
    const target = starting ? SPEED_HOVER : (hover ? SPEED_HOVER : SPEED_IDLE);
    speed += (target - speed) * Math.min(1, dt * 1.5);
    pivot.rotation.y += speed * Math.PI * 2 * dt;

    // Inclinaison douce vers la souris
    tilt.rotation.x += (pointer.y * 0.35 - tilt.rotation.x) * Math.min(1, dt * 6);
    tilt.rotation.z += (-pointer.x * 0.15 - tilt.rotation.z) * Math.min(1, dt * 6);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
}
