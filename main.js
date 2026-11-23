import * as THREE from 'three';
import { HorrorAudio } from './audio.js';
import { OfficeMap } from './map.js';
import { AnwarEntity } from './entity.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x070a12, 0.032);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 80);
scene.add(camera);

const hemiLight = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 0.78);
scene.add(hemiLight);

const flashlight = new THREE.SpotLight(0xfffbeb, 4.4, 30, Math.PI / 5.2, 0.45, 1.0);
flashlight.position.set(0.25, -0.2, 0);
flashlight.target.position.set(0, -0.2, -5);
camera.add(flashlight);
camera.add(flashlight.target);

const audio = new HorrorAudio();
const officeMap = new OfficeMap(scene);
const anwar = new AnwarEntity(scene, officeMap);

const state = {
  mode: 'LOBBY',
  difficulty: 'sederhana',
  sensitivity: 1.0,
  yaw: Math.PI,
  pitch: 0,
  pos: new THREE.Vector3(0, 1.65, 26),
  stamina: 100,
  battery: 100,
  flashlightOn: true,
  isHiding: false,
  currentLocker: null,
  filesCollected: 0,
  switchesOn: 0,
  elapsedTime: 0,
  introTimer: 0,
  touchEnabled: ('ontouchstart' in window) || navigator.maxTouchPoints > 0
};

const keys = {};
let joyVec = { x: 0, y: 0 };
let mobileSprinting = false;

const screens = {
  LOBBY: document.getElementById('lobby-screen'),
  INTRO: document.getElementById('intro-screen'),
  PLAYING: document.getElementById('hud-screen'),
  PAUSED: document.getElementById('pause-screen'),
  JUMPSCARE: document.getElementById('jumpscare-screen'),
  DEATH: document.getElementById('death-screen'),
  WIN: document.getElementById('win-screen')
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('active', k === name);
  });
}

// ================= LOBI CONTROLS =================
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
    anwar.setDifficulty(state.difficulty);
  });
});

const sensSlider = document.getElementById('sens-slider');
const sensVal = document.getElementById('sens-val');
sensSlider.addEventListener('input', () => {
  state.sensitivity = parseFloat(sensSlider.value);
  sensVal.textContent = state.sensitivity.toFixed(1);
});

document.getElementById('face-upload').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    anwar.setCustomFace(reader.result);
    document.getElementById('asset-status').textContent = `Muka dimuat naik: ${file.name}`;
  };
  reader.readAsDataURL(file);
});

document.getElementById('audio-upload').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await audio.setCustomAudioFile(file);
  document.getElementById('asset-status').textContent = `Suara dimuat naik: ${file.name}`;
});

document.getElementById('btn-start').addEventListener('click', () => {
  audio.init();
  audio.playClick();
  resetGame();
  startIntro();
});

document.getElementById('btn-start-skip').addEventListener('click', () => {
  audio.init();
  audio.playClick();
  resetGame();
  beginGameplay();
});

document.getElementById('btn-skip-intro').addEventListener('click', () => {
  audio.playClick();
  beginGameplay();
});

// ================= INTRO SINEMATIK =================
const introShots = [
  {
    speaker: 'AIMAN (JURUAUDIT DALAMAN)',
    text: 'Jam sudah 2:17 pagi... Semua staf dah balik, tinggal aku seorang di Tingkat 14 Menara Perdana.',
    camPos: new THREE.Vector3(0, 2.3, 27),
    lookAt: new THREE.Vector3(0, 1.4, 14)
  },
  {
    speaker: 'SISTEM KESELAMATAN MENARA',
    text: 'AMARAN: Sistem lif utama telah dikunci secara manual. Bekalan kuasa kecemasan terputus.',
    camPos: new THREE.Vector3(18, 2.2, -5),
    lookAt: new THREE.Vector3(23, 1.5, -10)
  },
  {
    speaker: 'AIMAN (JURUAUDIT DALAMAN)',
    text: '4 Fail Audit Sulit tu masih di atas meja bilik-bilik pejabat. Aku kena kumpul semua dan hidupkan janakuasa!',
    camPos: new THREE.Vector3(-16, 2.1, 13),
    lookAt: new THREE.Vector3(-16, 1.0, 9)
  },
  {
    speaker: 'SUARA DARI HUJUNG KORIDOR',
    text: '"SAKAU... SAKAU... MANA KAU NAK LARI?!" — Cepat cari jalan keluar atau menyorok!',
    camPos: new THREE.Vector3(0, 1.9, -12),
    lookAt: new THREE.Vector3(0, 1.5, -24)
  }
];

function startIntro() {
  state.mode = 'INTRO';
  state.introTimer = 0;
  audio.updateProximityAudio(999, 0, false);
  showScreen('INTRO');
}

function beginGameplay() {
  state.mode = 'PLAYING';
  showScreen('PLAYING');
  document.getElementById('mobile-controls').classList.toggle('visible', state.touchEnabled);
  if (!state.touchEnabled && canvas.requestPointerLock) {
    canvas.requestPointerLock();
  }
}

// ================= RESET PERMAINAN =================
function resetGame() {
  state.pos.set(0, 1.65, 26);
  state.yaw = Math.PI;
  state.pitch = 0;
  state.stamina = 100;
  state.battery = 100;
  state.flashlightOn = true;
  flashlight.visible = true;
  state.isHiding = false;
  state.currentLocker = null;
  state.filesCollected = 0;
  state.switchesOn = 0;
  state.elapsedTime = 0;

  officeMap.interactables.forEach((item) => {
    item.done = false;
    if (item.mesh && item.type !== 'elevator' && item.type !== 'locker') {
      item.mesh.visible = true;
    }
    if (item.type === 'switch' && item.mesh) {
      item.mesh.material.color.setHex(0xef4444);
      item.mesh.material.emissive.setHex(0x991b1b);
    }
  });

  anwar.setDifficulty(state.difficulty);
  anwar.reset();
  audio.updateProximityAudio(999, 0, false);
  updateMissionHUD();
}

// ================= KAWALAN PC & TELEFON =================
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (state.mode !== 'PLAYING') return;

  if (e.code === 'KeyF') toggleFlashlight();
  if (e.code === 'KeyE') triggerInteract();
  if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('mousemove', (e) => {
  if (state.mode !== 'PLAYING') return;
  if (document.pointerLockElement === canvas) {
    state.yaw -= e.movementX * 0.0022 * state.sensitivity;
    state.pitch -= e.movementY * 0.0022 * state.sensitivity;
    state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'PLAYING') return;
  if (!state.touchEnabled && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    return;
  }
  if (e.button === 0) triggerInteract();
  if (e.button === 2) toggleFlashlight();
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

// Sentuhan Telefon: Kayu Ria Kiri
const joyZone = document.getElementById('joystick-zone');
const joyStick = document.getElementById('joystick-stick');
let joyTouchId = null;

joyZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  updateJoystick(t);
});

joyZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) updateJoystick(t);
  }
});

const resetJoy = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      joyVec = { x: 0, y: 0 };
      joyStick.style.transform = 'translate(-50%, -50%)';
    }
  }
};
joyZone.addEventListener('touchend', resetJoy);
joyZone.addEventListener('touchcancel', resetJoy);

function updateJoystick(touch) {
  const rect = joyZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = 40;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyVec.x = dx / maxR;
  joyVec.y = dy / maxR;
}

// Sentuhan Telefon: Seret Kanan Untuk Pandang
const lookZone = document.getElementById('look-zone');
let lookTouchId = null;
let lastLookX = 0;
let lastLookY = 0;

lookZone.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  lookTouchId = t.identifier;
  lastLookX = t.clientX;
  lastLookY = t.clientY;
});

lookZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === lookTouchId) {
      const dx = t.clientX - lastLookX;
      const dy = t.clientY - lastLookY;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
      state.yaw -= dx * 0.0055 * state.sensitivity;
      state.pitch -= dy * 0.0055 * state.sensitivity;
      state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
    }
  }
});

lookZone.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === lookTouchId) lookTouchId = null;
  }
});

// Butang Telefon
document.getElementById('mob-flashlight').addEventListener('touchstart', (e) => {
  e.preventDefault();
  toggleFlashlight();
});

const mobSprintBtn = document.getElementById('mob-sprint');
mobSprintBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  mobileSprinting = true;
  mobSprintBtn.classList.add('active');
});
mobSprintBtn.addEventListener('touchend', () => {
  mobileSprinting = false;
  mobSprintBtn.classList.remove('active');
});

document.getElementById('mob-interact').addEventListener('touchstart', (e) => {
  e.preventDefault();
  triggerInteract();
});

// Menu Jeda & Butang Akhir
document.getElementById('btn-pause').addEventListener('click', pauseGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  audio.playClick();
  beginGameplay();
});
document.getElementById('btn-toggle-touch').addEventListener('click', () => {
  state.touchEnabled = !state.touchEnabled;
  document.getElementById('mobile-controls').classList.toggle('visible', state.touchEnabled);
  showToast(state.touchEnabled ? 'Kawalan Telefon Diaktifkan' : 'Kawalan Telefon Dimatikan');
});
document.getElementById('btn-quit').addEventListener('click', returnToLobby);
document.getElementById('btn-retry').addEventListener('click', () => {
  resetGame();
  beginGameplay();
});
document.getElementById('btn-death-lobby').addEventListener('click', returnToLobby);
document.getElementById('btn-win-again').addEventListener('click', () => {
  resetGame();
  beginGameplay();
});
document.getElementById('btn-win-lobby').addEventListener('click', returnToLobby);

function pauseGame() {
  if (state.mode !== 'PLAYING') return;
  state.mode = 'PAUSED';
  audio.updateProximityAudio(999, 0, false);
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('PAUSED');
}

function returnToLobby() {
  state.mode = 'LOBBY';
  audio.updateProximityAudio(999, 0, false);
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('LOBBY');
}

function toggleFlashlight() {
  if (state.battery <= 0) {
    showToast('Bateri lampu suluh sudah habis!');
    return;
  }
  state.flashlightOn = !state.flashlightOn;
  flashlight.visible = state.flashlightOn;
  audio.playClick();
}

function showToast(msg) {
  const el = document.getElementById('toast-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2400);
}

// ================= INTERAKSI BARANG & LOKER =================
let nearestInteractable = null;

function triggerInteract() {
  if (state.isHiding && state.currentLocker) {
    state.isHiding = false;
    state.pos.copy(state.currentLocker.exitPos);
    state.currentLocker = null;
    document.getElementById('hiding-banner').classList.add('hidden');
    audio.playLocker();
    return;
  }

  if (!nearestInteractable) return;
  const item = nearestInteractable;

  if (item.type === 'locker') {
    state.isHiding = true;
    state.currentLocker = item;
    state.pos.copy(item.insidePos);
    state.yaw = item.yaw;
    state.pitch = 0;
    document.getElementById('hiding-banner').classList.remove('hidden');
    audio.playLocker();
  } else if (item.type === 'file') {
    item.done = true;
    item.mesh.visible = false;
    state.filesCollected++;
    audio.playPickup();
    showToast(`Fail Audit Sulit diperoleh (${state.filesCollected}/4)!`);
    updateMissionHUD();
  } else if (item.type === 'switch') {
    if (state.filesCollected < 4) {
      showToast('Kumpul kesemua 4 Fail Audit Sulit dahulu!');
      return;
    }
    item.done = true;
    item.mesh.material.color.setHex(0x22c55e);
    item.mesh.material.emissive.setHex(0x15803d);
    state.switchesOn++;
    audio.playSwitch();
    showToast(`Suis Janakuasa dihidupkan (${state.switchesOn}/2)!`);
    updateMissionHUD();
  } else if (item.type === 'battery') {
    item.done = true;
    item.mesh.visible = false;
    state.battery = Math.min(100, state.battery + 50);
    audio.playPickup();
    showToast('Bateri lampu suluh dicas +50%!');
  } else if (item.type === 'elevator') {
    if (state.filesCollected < 4 || state.switchesOn < 2) {
      showToast('Lif terkunci! Lengkapkan fail audit & suis janakuasa dahulu.');
      return;
    }
    triggerWin();
  }
}

function updateMissionHUD() {
  const el = document.getElementById('mission-text');
  if (state.filesCollected < 4) {
    el.textContent = `Fasa 1: Kumpul Fail Audit Sulit (${state.filesCollected} / 4)`;
  } else if (state.switchesOn < 2) {
    el.textContent = `Fasa 2: Hidupkan Suis Janakuasa (${state.switchesOn} / 2)`;
  } else {
    el.textContent = 'Fasa 3: Kembali ke Lobi Lif Utama & Melarikan Diri!';
  }
}

// ================= JUMPSCARE, KALAH & MENANG =================
function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function triggerCatch() {
  if (state.mode !== 'PLAYING') return;
  state.mode = 'JUMPSCARE';
  if (document.pointerLockElement) document.exitPointerLock();

  document.getElementById('jumpscare-img').src = anwar.imageSrc;
  showScreen('JUMPSCARE');
  audio.playJumpscare();

  setTimeout(() => {
    state.mode = 'END';
    audio.updateProximityAudio(999, 0, false);
    document.getElementById('stat-death-room').textContent = officeMap.getRoomAt(state.pos.x, state.pos.z);
    document.getElementById('stat-death-time').textContent = formatTime(state.elapsedTime);
    document.getElementById('stat-death-files').textContent = `${state.filesCollected} / 4`;
    document.getElementById('stat-death-switches').textContent = `${state.switchesOn} / 2`;
    showScreen('DEATH');
  }, 1550);
}

function triggerWin() {
  state.mode = 'END';
  audio.updateProximityAudio(999, 0, false);
  if (document.pointerLockElement) document.exitPointerLock();
  audio.playPickup();
  document.getElementById('stat-win-diff').textContent = state.difficulty.toUpperCase();
  document.getElementById('stat-win-time').textContent = formatTime(state.elapsedTime);
  showScreen('WIN');
}

// ================= PERGERAKAN & PERLANGGARAN =================
function canMoveTo(nx, nz) {
  const r = 0.42;
  for (const b of officeMap.colliders) {
    if (nx + r > b.minX && nx - r < b.maxX && nz + r > b.minZ && nz - r < b.maxZ) {
      return false;
    }
  }
  return true;
}

function updatePlayer(dt) {
  if (state.isHiding) {
    camera.position.copy(state.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    return false;
  }

  let forward = 0;
  let right = 0;
  if (keys['KeyW'] || keys['ArrowUp']) forward += 1;
  if (keys['KeyS'] || keys['ArrowDown']) forward -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) right += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) right -= 1;

  if (Math.abs(joyVec.x) > 0.1 || Math.abs(joyVec.y) > 0.1) {
    forward -= joyVec.y;
    right += joyVec.x;
  }

  const wantsSprint = keys['ShiftLeft'] || keys['ShiftRight'] || mobileSprinting;
  const isMoving = Math.hypot(forward, right) > 0.1;
  const isSprinting = wantsSprint && isMoving && state.stamina > 2;

  if (isSprinting) {
    state.stamina = Math.max(0, state.stamina - 24 * dt);
  } else {
    state.stamina = Math.min(100, state.stamina + 18 * dt);
  }

  const speed = isSprinting ? 9.0 : 5.4;
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);

  let vx = (-sin * forward + cos * right);
  let vz = (-cos * forward - sin * right);
  const len = Math.hypot(vx, vz);
  if (len > 0.001) {
    vx = (vx / len) * speed * dt;
    vz = (vz / len) * speed * dt;
  }

  if (canMoveTo(state.pos.x + vx, state.pos.z)) state.pos.x += vx;
  if (canMoveTo(state.pos.x, state.pos.z + vz)) state.pos.z += vz;

  if (state.flashlightOn) {
    const drain = state.difficulty === 'mudah' ? 1.0 : 1.5;
    state.battery = Math.max(0, state.battery - drain * dt);
    if (state.battery === 0) {
      state.flashlightOn = false;
      flashlight.visible = false;
    }
  }

  const bob = isMoving ? Math.sin(performance.now() * (isSprinting ? 0.017 : 0.011)) * 0.06 : 0;
  camera.position.set(state.pos.x, state.pos.y + bob, state.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;

  nearestInteractable = null;
  let bestDist = 2.8;
  for (const item of officeMap.interactables) {
    if (item.done) continue;
    const d = state.pos.distanceTo(item.position);
    if (d < bestDist) {
      bestDist = d;
      nearestInteractable = item;
    }
  }

  const promptEl = document.getElementById('interact-prompt');
  if (nearestInteractable) {
    promptEl.innerHTML = `Tekan <strong>[E]</strong> / <strong>AKSI</strong>: ${nearestInteractable.label}`;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }

  document.getElementById('stamina-fill').style.width = `${state.stamina}%`;
  document.getElementById('battery-fill').style.width = `${state.battery}%`;
  document.getElementById('room-name').textContent = `Lokasi: ${officeMap.getRoomAt(state.pos.x, state.pos.z)}`;

  return isSprinting;
}

// ================= PELAN LANTAI (MINIMAP) =================
const miniCanvas = document.getElementById('minimap-canvas');
const mCtx = miniCanvas.getContext('2d');

function drawMinimap(entityDist) {
  mCtx.clearRect(0, 0, 160, 160);
  const scale = 2.15;
  const cx = 80;
  const cy = 82;

  mCtx.fillStyle = '#1e293b';
  for (const r of officeMap.rooms) {
    mCtx.fillRect(
      cx + (r.x - r.w / 2) * scale,
      cy + (r.z - r.d / 2) * scale,
      r.w * scale,
      r.d * scale
    );
  }

  for (const item of officeMap.interactables) {
    if (item.done) continue;
    if (item.type === 'file') mCtx.fillStyle = '#facc15';
    else if (item.type === 'switch') mCtx.fillStyle = '#ef4444';
    else if (item.type === 'locker') mCtx.fillStyle = '#38bdf8';
    else if (item.type === 'elevator') mCtx.fillStyle = '#22c55e';
    else continue;

    mCtx.fillRect(cx + item.position.x * scale - 2.2, cy + item.position.z * scale - 2.2, 4.4, 4.4);
  }

  if (entityDist < 24) {
    mCtx.fillStyle = '#ef4444';
    mCtx.beginPath();
    mCtx.arc(cx + anwar.position.x * scale, cy + anwar.position.z * scale, 4.2, 0, Math.PI * 2);
    mCtx.fill();
  }

  mCtx.fillStyle = '#ffffff';
  mCtx.beginPath();
  mCtx.arc(cx + state.pos.x * scale, cy + state.pos.z * scale, 3.8, 0, Math.PI * 2);
  mCtx.fill();
}

// ================= GELUNG UTAMA =================
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.mode === 'LOBBY') {
    const t = now * 0.00025;
    camera.position.set(Math.sin(t) * 12, 2.6, Math.cos(t) * 12);
    camera.lookAt(0, 1.3, 0);
  } else if (state.mode === 'INTRO') {
    state.introTimer += dt;
    const totalIntro = 16;
    const shotIdx = Math.min(introShots.length - 1, Math.floor(state.introTimer / 4));
    const shot = introShots[shotIdx];

    document.getElementById('intro-speaker').textContent = shot.speaker;
    document.getElementById('intro-text').textContent = shot.text;
    document.getElementById('intro-bar').style.width = `${Math.min(100, (state.introTimer / totalIntro) * 100)}%`;

    camera.position.lerp(shot.camPos, 0.05);
    camera.lookAt(shot.lookAt);

    if (state.introTimer >= totalIntro) {
      beginGameplay();
    }
  } else if (state.mode === 'PLAYING') {
    state.elapsedTime += dt;
    const isSprinting = updatePlayer(dt);
    const dist = anwar.update(dt, state.pos, state.yaw, state.isHiding, isSprinting, audio, triggerCatch);

    const dangerRatio = Math.max(0, Math.min(1, 1 - dist / 16));
    document.getElementById('danger-pulse').style.opacity = dangerRatio.toFixed(2);
    document.getElementById('danger-banner').classList.toggle('hidden', dist > 15);

    drawMinimap(dist);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(animate);
