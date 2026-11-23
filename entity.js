import * as THREE from 'three';

function createPlaceholderTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

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
  ctx.fillText('DI REPO GITHUB', 256, 462);

  return new THREE.CanvasTexture(c);
}

// Semak jika segmen garis (x1,z1)->(x2,z2) bersilang dengan kotak dinding
function lineIntersectsBox(x1, z1, x2, z2, box, pad = 0.45) {
  const minX = box.minX - pad;
  const maxX = box.maxX + pad;
  const minZ = box.minZ - pad;
  const maxZ = box.maxZ + pad;

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  const checks = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dz, z1 - minZ],
    [dz, maxZ - z1]
  ];

  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-6) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

export class AnwarEntity {
  constructor(scene, officeMap) {
    this.scene = scene;
    this.map = officeMap;
    this.patrolIndex = 0;

    this.position = new THREE.Vector3(0, 0, -24);
    this.state = 'RONDA'; // RONDA | KEJAR
    this.baseSpeed = 4.8;
    this.chaseSpeed = 6.5;
    this.detectRange = 20;
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

    this.auraLight = new THREE.PointLight(0xdc2626, 1.5, 11);
    this.auraLight.position.set(0, 1.6, 0);
    this.group.add(this.auraLight);

    this.scene.add(this.group);
    this.tryLoadDefaultFace();
  }

  tryLoadDefaultFace() {
    const loader = new THREE.TextureLoader();
    loader.load(
      './assets/anwar.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.sprite.material.map = tex;
        this.sprite.material.needsUpdate = true;
        this.imageSrc = './assets/anwar.png';
      },
      undefined,
      () => {
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
            this.imageSrc = this.sprite.material.map.image.toDataURL();
          }
        );
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
    if (diff === 'mudah') {
      this.baseSpeed = 4.1;
      this.chaseSpeed = 5.5;
      this.detectRange = 16;
    } else if (diff === 'sukar') {
      this.baseSpeed = 5.5;
      this.chaseSpeed = 7.4;
      this.detectRange = 25;
    } else {
      this.baseSpeed = 4.8;
      this.chaseSpeed = 6.5;
      this.detectRange = 20;
    }
  }

  reset() {
    this.position.set(0, 0, -24);
    this.group.position.copy(this.position);
    this.state = 'RONDA';
    this.patrolIndex = 1;
    this.loseTimer = 0;
  }

  hasLineOfSight(fromPos, toPos, pad = 0.45) {
    for (const box of this.map.colliders) {
      if (lineIntersectsBox(fromPos.x, fromPos.z, toPos.x, toPos.z, box, pad)) {
        return false;
      }
    }
    return true;
  }

  canOccupy(nx, nz, radius = 0.52) {
    for (const b of this.map.colliders) {
      if (nx + radius > b.minX && nx - radius < b.maxX && nz + radius > b.minZ && nz - radius < b.maxZ) {
        return false;
      }
    }
    return true;
  }

  // Pergerakan fizikal ketat: tidak sesekali menembusi dinding atau perabot
  moveWithCollision(vx, vz) {
    const r = 0.52;
    let moved = false;
    if (this.canOccupy(this.position.x + vx, this.position.z, r)) {
      this.position.x += vx;
      moved = true;
    }
    if (this.canOccupy(this.position.x, this.position.z + vz, r)) {
      this.position.z += vz;
      moved = true;
    }
    return moved;
  }

  findNearestNode(pos) {
    const nodes = this.map.navNodes;
    let bestVisible = null;
    let bestVisDist = Infinity;
    let bestAny = nodes[0];
    let bestAnyDist = Infinity;

    for (const n of nodes) {
      const d = pos.distanceTo(n.pos);
      if (d < bestAnyDist) {
        bestAnyDist = d;
        bestAny = n;
      }
      if (d < bestVisDist && this.hasLineOfSight(pos, n.pos, 0.35)) {
        bestVisDist = d;
        bestVisible = n;
      }
    }
    return bestVisible || bestAny;
  }

  // Laluan terpendek melalui pintu-pintu bilik (Dijkstra atas 19 nod)
  getNextWaypointToward(targetPos) {
    const nodes = this.map.navNodes;
    const startNode = this.findNearestNode(this.position);
    const goalNode = this.findNearestNode(targetPos);

    if (startNode.id === goalNode.id) {
      return goalNode.pos;
    }

    const dist = new Map();
    const prev = new Map();
    const unvisited = new Set();

    for (const n of nodes) {
      dist.set(n.id, Infinity);
      unvisited.add(n.id);
    }
    dist.set(startNode.id, 0);

    while (unvisited.size > 0) {
      let uId = null;
      let minD = Infinity;
      for (const id of unvisited) {
        const d = dist.get(id);
        if (d < minD) {
          minD = d;
          uId = id;
        }
      }
      if (uId === null || uId === goalNode.id) break;
      unvisited.delete(uId);

      const uNode = nodes[uId];
      for (const vId of uNode.links) {
        if (!unvisited.has(vId)) continue;
        const vNode = nodes[vId];
        const alt = minD + uNode.pos.distanceTo(vNode.pos);
        if (alt < dist.get(vId)) {
          dist.set(vId, alt);
          prev.set(vId, uId);
        }
      }
    }

    let step = goalNode.id;
    while (prev.has(step) && prev.get(step) !== startNode.id) {
      step = prev.get(step);
    }
    return nodes[step].pos;
  }

  update(dt, playerPos, playerYaw, isPlayerHiding, isPlayerSprinting, audio, onCatch) {
    const flatPlayer = new THREE.Vector3(playerPos.x, 0, playerPos.z);
    const dist = this.position.distanceTo(flatPlayer);

    // Kira sudut stereo kiri/kanan relatif kepada pandangan pemain
    const toEntity = new THREE.Vector3().subVectors(this.position, flatPlayer);
    const worldAngle = Math.atan2(-toEntity.x, -toEntity.z);
    let relAngle = worldAngle - playerYaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;
    const stereoPan = -Math.sin(relAngle);

    // Kemas kini audio dinamik (kuat bila dekat, terus mengecil & senyap bila jauh)
    audio.updateProximityAudio(dist, stereoPan, true, 30);

    const canSeePlayer = !isPlayerHiding && dist < this.detectRange && this.hasLineOfSight(this.position, flatPlayer, 0.4);
    const canHearSprint = !isPlayerHiding && isPlayerSprinting && dist < this.detectRange * 0.85;

    if (canSeePlayer || canHearSprint) {
      this.state = 'KEJAR';
      this.loseTimer = 4.0;
    } else if (this.state === 'KEJAR') {
      this.loseTimer -= dt;
      if (isPlayerHiding || this.loseTimer <= 0) {
        this.state = 'RONDA';
      }
    }

    let steerTarget;
    let speed;

    if (this.state === 'KEJAR' && !isPlayerHiding) {
      speed = this.chaseSpeed;
      if (this.hasLineOfSight(this.position, flatPlayer, 0.48)) {
        steerTarget = flatPlayer;
      } else {
        // Ikut laluan pintu bilik supaya tidak melanggar dinding
        steerTarget = this.getNextWaypointToward(flatPlayer);
      }
    } else {
      speed = this.baseSpeed;
      const patrolNodeId = this.map.patrolNodeIds[this.patrolIndex];
      const patrolGoal = this.map.navNodes[patrolNodeId].pos;

      if (this.position.distanceTo(patrolGoal) < 1.6) {
        this.patrolIndex = (this.patrolIndex + 1) % this.map.patrolNodeIds.length;
      }

      if (this.hasLineOfSight(this.position, patrolGoal, 0.48)) {
        steerTarget = patrolGoal;
      } else {
        steerTarget = this.getNextWaypointToward(patrolGoal);
      }
    }

    const dir = new THREE.Vector3().subVectors(steerTarget, this.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) {
      dir.normalize();
      const moved = this.moveWithCollision(dir.x * speed * dt, dir.z * speed * dt);
      if (!moved) {
        // Jika tersangkut bucu meja, gelongsor ke sisi
        this.moveWithCollision(-dir.z * speed * dt, dir.x * speed * dt);
      }
    }

    const bob = Math.sin(performance.now() * (this.state === 'KEJAR' ? 0.018 : 0.008)) * 0.12;
    this.group.position.set(this.position.x, 0, this.position.z);
    this.sprite.position.y = 1.45 + bob;

    // Tangkapan hanya berlaku jika tiada dinding menghalang dan pemain tidak bersembunyi
    if (!isPlayerHiding && dist < 1.35 && this.hasLineOfSight(this.position, flatPlayer, 0.3)) {
      onCatch();
    }

    return dist;
  }
}
