import * as THREE from 'three';

function createPlaceholderTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Bayang siluet dramatik jika assets/anwar.png belum diletakkan
  const grad = ctx.createRadialGradient(256, 230, 40, 256, 256, 240);
  grad.addColorStop(0, '#fca5a5');
  grad.addColorStop(0.65, '#991b1b');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(256, 240, 125, 160, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mata menyala
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(210, 205, 16, 0, Math.PI * 2);
  ctx.arc(302, 205, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LETAK anwar.png', 256, 430);
  ctx.font = '20px sans-serif';
  ctx.fillText('DALAM FOLDER assets/', 256, 462);

  return new THREE.CanvasTexture(c);
}

export class AnwarEntity {
  constructor(scene, patrolPoints) {
    this.scene = scene;
    this.patrolPoints = patrolPoints;
    this.currentWaypoint = 0;

    this.position = new THREE.Vector3(0, 0, -16);
    this.state = 'RONDA'; // RONDA | KEJAR
    this.baseSpeed = 5.4;
    this.chaseSpeed = 6.7;
    this.detectRange = 17;
    this.loseTimer = 0;
    this.imageSrc = '';

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const mat = new THREE.SpriteMaterial({
      map: createPlaceholderTexture(),
      transparent: true
    });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(2.3, 2.7, 1);
    this.sprite.position.y = 1.45;
    this.group.add(this.sprite);

    // Aura merah malap di sekeliling entiti
    this.auraLight = new THREE.PointLight(0xdc2626, 1.4, 9);
    this.auraLight.position.set(0, 1.6, 0);
    this.group.add(this.auraLight);

    this.scene.add(this.group);
    this.tryLoadDefaultFace();
  }

  tryLoadDefaultFace() {
    const loader = new THREE.TextureLoader();
    loader.load(
      './anwar.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.sprite.material.map = tex;
        this.sprite.material.needsUpdate = true;
        this.imageSrc = './anwar.png';
      },
      undefined,
      () => {
        // Kekal guna placeholder jika fail belum wujud
        this.imageSrc = this.sprite.material.map.image.toDataURL();
      }
    );
  }

  setCustomFace(dataUrl) {
    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.sprite.material.map = tex;
      this.sprite.material.needsUpdate = true;
      this.imageSrc = dataUrl;
    });
  }

  setDifficulty(diff) {
    // Kelajuan seimbang supaya pemain sentiasa boleh pecut & menyorok secara adil
    if (diff === 'mudah') {
      this.baseSpeed = 4.2;
      this.chaseSpeed = 5.6;
      this.detectRange = 13;
    } else if (diff === 'sukar') {
      this.baseSpeed = 5.6;
      this.chaseSpeed = 7.5;
      this.detectRange = 21;
    } else {
      this.baseSpeed = 4.9;
      this.chaseSpeed = 6.6;
      this.detectRange = 17;
    }
  }

  reset() {
    this.position.set(0, 0, -16);
    this.group.position.copy(this.position);
    this.state = 'RONDA';
    this.currentWaypoint = 1;
    this.loseTimer = 0;
  }

  update(dt, playerPos, isPlayerHiding, isPlayerSprinting, audio, onCatch) {
    const flatPlayer = new THREE.Vector3(playerPos.x, 0, playerPos.z);
    const dist = this.position.distanceTo(flatPlayer);

    // Bunyi jeritan "SAKAU!" semakin kerap bila dekat
    audio.triggerProximityScream(dist, 22);

    const effectiveDetect = isPlayerSprinting ? this.detectRange * 1.25 : this.detectRange;

    if (!isPlayerHiding && dist < effectiveDetect) {
      this.state = 'KEJAR';
      this.loseTimer = 3.5;
    } else if (this.state === 'KEJAR') {
      this.loseTimer -= dt;
      if (isPlayerHiding || this.loseTimer <= 0) {
        this.state = 'RONDA';
      }
    }

    let target;
    let speed;

    if (this.state === 'KEJAR' && !isPlayerHiding) {
      target = flatPlayer;
      speed = this.chaseSpeed;
    } else {
      target = this.patrolPoints[this.currentWaypoint];
      speed = this.baseSpeed;
      if (this.position.distanceTo(target) < 1.2) {
        this.currentWaypoint = (this.currentWaypoint + 1) % this.patrolPoints.length;
      }
    }

    const dir = new THREE.Vector3().subVectors(target, this.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) {
      dir.normalize();
      this.position.addScaledVector(dir, speed * dt);
    }

    // Animasi terapung/mengejar
    const bob = Math.sin(performance.now() * (this.state === 'KEJAR' ? 0.018 : 0.008)) * 0.12;
    this.group.position.set(this.position.x, 0, this.position.z);
    this.sprite.position.y = 1.45 + bob;

    // Semak tangkapan (hanya jika tidak bersembunyi di dalam loker)
    if (!isPlayerHiding && dist < 1.35) {
      onCatch();
    }

    return dist;
  }
}
