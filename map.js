import * as THREE from 'three';

function createFloorTexture(style) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  if (style === 'marble') {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
  } else if (style === 'wood') {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#92400e';
    for (let y = 0; y < 256; y += 32) {
      ctx.fillRect(0, y, 256, 28);
    }
  } else if (style === 'carpet') {
    ctx.fillStyle = '#581c2c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
  } else if (style === 'tile') {
    ctx.fillStyle = '#115e59';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ccfbf1';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(256, x); ctx.stroke();
    }
  } else {
    // Hazard industrial floor
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 232, 256, 24);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Dinding krim pejabat bahagian atas
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(0, 0, 256, 175);

  // Panel kayu mahogani bahagian bawah
  ctx.fillStyle = '#451a03';
  ctx.fillRect(0, 175, 256, 81);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 172, 256, 8);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createPlaqueTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  return new THREE.CanvasTexture(c);
}

export class OfficeMap {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.interactables = [];
    this.lockers = [];
    this.rooms = [
      { name: 'Lobi Lif Utama', x: 0, z: 16, w: 14, d: 10, style: 'marble' },
      { name: 'Koridor Utama', x: 0, z: 0, w: 8, d: 22, style: 'marble' },
      { name: 'Bilik Fail & Arkib', x: -12, z: 6, w: 14, d: 10, style: 'wood' },
      { name: 'Bilik Mesyuarat Eksekutif', x: 12, z: 6, w: 14, d: 10, style: 'carpet' },
      { name: 'Pantri & Ruang Rehat', x: -12, z: -7, w: 14, d: 10, style: 'tile' },
      { name: 'Bilik Server & Janakuasa', x: 12, z: -7, w: 14, d: 10, style: 'hazard' },
      { name: 'Pejabat Pengarah', x: 0, z: -17, w: 16, d: 10, style: 'wood' }
    ];

    this.patrolPoints = [
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(-12, 0, 6),
      new THREE.Vector3(12, 0, 6),
      new THREE.Vector3(-12, 0, -7),
      new THREE.Vector3(12, 0, -7),
      new THREE.Vector3(0, 0, -16),
      new THREE.Vector3(0, 0, 0)
    ];

    this.wallMat = new THREE.MeshStandardMaterial({
      map: createWallTexture(),
      roughness: 0.75
    });

    this.buildArchitecture();
    this.buildFurnitureAndLockers();
    this.spawnMissionItems();
  }

  addBox(x, y, z, w, h, d, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collide) {
      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2
      });
    }
    return mesh;
  }

  buildArchitecture() {
    const H = 4.2;
    // Lantai & Siling setiap bilik
    for (const r of this.rooms) {
      const floorMat = new THREE.MeshStandardMaterial({
        map: createFloorTexture(r.style),
        roughness: 0.65
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(r.x, 0, r.z);
      floor.receiveShadow = true;
      this.scene.add(floor);

      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(r.w, r.d),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(r.x, H, r.z);
      this.scene.add(ceil);

      // Lampu siling bilik
      const light = new THREE.PointLight(0xfff3d6, 1.35, 16);
      light.position.set(r.x, H - 0.35, r.z);
      this.scene.add(light);
    }

    // Dinding luar bangunan
    this.addBox(0, H / 2, 21.3, 15, H, 0.6, this.wallMat); // Selatan (Belakang Lif)
    this.addBox(-7.3, H / 2, 16, 0.6, H, 10.6, this.wallMat);
    this.addBox(7.3, H / 2, 16, 0.6, H, 10.6, this.wallMat);

    // Dinding Utara (Pejabat Pengarah)
    this.addBox(0, H / 2, -22.3, 17, H, 0.6, this.wallMat);
    this.addBox(-8.3, H / 2, -17, 0.6, H, 10.6, this.wallMat);
    this.addBox(8.3, H / 2, -17, 0.6, H, 10.6, this.wallMat);

    // Dinding Sayap Kiri (-19.3) & Kanan (+19.3)
    this.addBox(-19.3, H / 2, -0.5, 0.6, H, 25, this.wallMat);
    this.addBox(19.3, H / 2, -0.5, 0.6, H, 25, this.wallMat);

    // Dinding Pemisah Utara/Selatan Sayap
    this.addBox(-12, H / 2, 11.3, 15, H, 0.6, this.wallMat);
    this.addBox(12, H / 2, 11.3, 15, H, 0.6, this.wallMat);
    this.addBox(-12, H / 2, -12.3, 15, H, 0.6, this.wallMat);
    this.addBox(12, H / 2, -12.3, 15, H, 0.6, this.wallMat);

    // Dinding Pemisah antara Bilik Depan (z=6) dan Belakang (z=-7)
    this.addBox(-12, H / 2, -0.5, 14.5, H, 0.5, this.wallMat);
    this.addBox(12, H / 2, -0.5, 14.5, H, 0.5, this.wallMat);

    // Dinding Koridor dengan bukaan pintu lebar (3.2m)
    // Kiri Koridor (x = -4.3) -> pintu di z=6 dan z=-7
    this.addBox(-4.3, H / 2, 9.8, 0.5, H, 3.2, this.wallMat);
    this.addBox(-4.3, H / 2, -0.5, 0.5, H, 9.2, this.wallMat);
    this.addBox(-4.3, H / 2, -10.5, 0.5, H, 3.4, this.wallMat);

    // Kanan Koridor (x = 4.3) -> pintu di z=6 dan z=-7
    this.addBox(4.3, H / 2, 9.8, 0.5, H, 3.2, this.wallMat);
    this.addBox(4.3, H / 2, -0.5, 0.5, H, 9.2, this.wallMat);
    this.addBox(4.3, H / 2, -10.5, 0.5, H, 3.4, this.wallMat);

    // Papan Tanda Bilik Bahasa Melayu
    this.addPlaque('BILIK FAIL & ARKIB', -4.65, 3.1, 6, Math.PI / 2);
    this.addPlaque('BILIK MESYUARAT', 4.65, 3.1, 6, -Math.PI / 2);
    this.addPlaque('PANTRI & REHAT', -4.65, 3.1, -7, Math.PI / 2);
    this.addPlaque('BILIK JANAKUASA', 4.65, 3.1, -7, -Math.PI / 2);
    this.addPlaque('PEJABAT PENGARAH', 0, 3.1, -11.9, 0);
  }

  addPlaque(label, x, y, z, rotY) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      new THREE.MeshBasicMaterial({ map: createPlaqueTexture(label) })
    );
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    this.scene.add(sign);
  }

  buildFurnitureAndLockers() {
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x5c2d16, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.5 });

    // Meja-meja pejabat
    this.addBox(-14, 0.45, 6, 3.2, 0.9, 1.5, deskMat); // Bilik Fail
    this.addBox(12, 0.45, 6, 5.2, 0.9, 2.0, deskMat);  // Bilik Mesyuarat
    this.addBox(-14, 0.45, -7, 3.4, 0.9, 1.4, metalMat); // Pantri
    this.addBox(0, 0.45, -18, 3.6, 0.9, 1.6, deskMat); // Pejabat Pengarah

    // Rak server di Bilik Janakuasa
    this.addBox(15, 1.4, -9.5, 1.2, 2.8, 3.5, metalMat);
    this.addBox(15, 1.4, -4.5, 1.2, 2.8, 3.5, metalMat);

    // Pintu Lif Utama di Lobi (z = 20.8)
    const liftDoorMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.25
    });
    const liftMesh = this.addBox(0, 1.4, 20.8, 2.6, 2.8, 0.3, liftDoorMat, false);
    this.interactables.push({
      id: 'elevator',
      type: 'elevator',
      label: 'Aktifkan Lif Utama',
      position: new THREE.Vector3(0, 1.2, 20.2),
      mesh: liftMesh,
      done: false
    });

    // 6 Loker Sembunyi di lokasi strategik
    const lockerCoords = [
      { x: -5.8, z: 17.5, rot: Math.PI / 2 },
      { x: -17.8, z: 9.2, rot: Math.PI / 2 },
      { x: 17.8, z: 9.2, rot: -Math.PI / 2 },
      { x: -17.8, z: -9.5, rot: Math.PI / 2 },
      { x: 9.5, z: -10.8, rot: 0 },
      { x: -6.8, z: -20.5, rot: 0 }
    ];

    const lockerMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.45,
      metalness: 0.4
    });

    lockerCoords.forEach((lc, idx) => {
      const mesh = this.addBox(lc.x, 1.25, lc.z, 1.1, 2.5, 1.1, lockerMat, true);
      const exitOffset = new THREE.Vector3(Math.sin(lc.rot) * 1.4, 0, Math.cos(lc.rot) * 1.4);
      const lockerObj = {
        id: `locker_${idx}`,
        type: 'locker',
        label: 'Sembunyi Dalam Loker',
        position: new THREE.Vector3(lc.x, 1.2, lc.z),
        insidePos: new THREE.Vector3(lc.x, 1.65, lc.z),
        exitPos: new THREE.Vector3(lc.x, 1.65, lc.z).add(exitOffset),
        yaw: lc.rot,
        mesh
      };
      this.lockers.push(lockerObj);
      this.interactables.push(lockerObj);
    });
  }

  spawnMissionItems() {
    // 4 Fail Audit Sulit di atas meja
    const fileSpots = [
      { x: -14, y: 1.02, z: 6, room: 'Bilik Fail' },
      { x: 12, y: 1.02, z: 6, room: 'Bilik Mesyuarat' },
      { x: -14, y: 1.02, z: -7, room: 'Pantri' },
      { x: 0, y: 1.02, z: -18, room: 'Pejabat Pengarah' }
    ];

    const fileMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.6
    });

    fileSpots.forEach((f, i) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.4), fileMat);
      mesh.position.set(f.x, f.y, f.z);
      this.scene.add(mesh);
      this.interactables.push({
        id: `file_${i}`,
        type: 'file',
        label: `Ambil Fail Audit Sulit #${i + 1}`,
        position: new THREE.Vector3(f.x, f.y, f.z),
        mesh,
        done: false
      });
    });

    // 2 Suis Janakuasa Kecemasan di Bilik Server
    const switchSpots = [
      { x: 14.3, y: 1.5, z: -9.5 },
      { x: 14.3, y: 1.5, z: -4.5 }
    ];

    switchSpots.forEach((s, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.8
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.35), mat);
      mesh.position.set(s.x, s.y, s.z);
      this.scene.add(mesh);
      this.interactables.push({
        id: `switch_${i}`,
        type: 'switch',
        label: `Hidupkan Suis Janakuasa #${i + 1}`,
        position: new THREE.Vector3(s.x, s.y, s.z),
        mesh,
        done: false
      });
    });

    // 3 Bateri Lampu Suluh Tambahan
    const batterySpots = [
      { x: 0, y: 0.3, z: 2 },
      { x: -11, y: 0.3, z: -4 },
      { x: 5, y: 0.3, z: -16 }
    ];
    const batMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.7
    });

    batterySpots.forEach((b, i) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), batMat);
      mesh.position.set(b.x, b.y, b.z);
      this.scene.add(mesh);
      this.interactables.push({
        id: `battery_${i}`,
        type: 'battery',
        label: 'Ambil Bateri Lampu Suluh (+50%)',
        position: new THREE.Vector3(b.x, b.y, b.z),
        mesh,
        done: false
      });
    });
  }

  getRoomAt(x, z) {
    for (const r of this.rooms) {
      if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) {
        return r.name;
      }
    }
    return 'Koridor Tingkat 14';
  }
}
