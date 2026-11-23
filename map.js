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
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 232, 256, 24);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function createWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(0, 0, 256, 175);

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

    // Susun atur pejabat yang luas (64m x 68m) supaya pemain ada ruang luas untuk mengelak & lari
    this.rooms = [
      { name: 'Lobi Lif Utama', x: 0, z: 25, w: 20, d: 14, style: 'marble' },
      { name: 'Koridor Utama', x: 0, z: 0, w: 12, d: 36, style: 'marble' },
      { name: 'Bilik Fail & Arkib', x: -18, z: 9, w: 24, d: 18, style: 'wood' },
      { name: 'Pantri & Ruang Rehat', x: -18, z: -9, w: 24, d: 18, style: 'tile' },
      { name: 'Bilik Mesyuarat Eksekutif', x: 18, z: 9, w: 24, d: 18, style: 'carpet' },
      { name: 'Bilik Server & Janakuasa', x: 18, z: -9, w: 24, d: 18, style: 'hazard' },
      { name: 'Pejabat Pengarah', x: 0, z: -26, w: 32, d: 16, style: 'wood' }
    ];

    // Graf nod navigasi (pusat bilik + semua pintu lebar 4.6m) untuk laluan AI tanpa tembus dinding
    this.navNodes = [
      { id: 0, pos: new THREE.Vector3(0, 0, 25), links: [1] },          // Lobi Lif
      { id: 1, pos: new THREE.Vector3(0, 0, 15), links: [0, 2] },       // Koridor Selatan
      { id: 2, pos: new THREE.Vector3(0, 0, 9), links: [1, 3, 6, 11] }, // Koridor Depan (Pintu Fail & Mesyuarat)
      { id: 3, pos: new THREE.Vector3(0, 0, 0), links: [2, 4] },        // Koridor Tengah
      { id: 4, pos: new THREE.Vector3(0, 0, -9), links: [3, 5, 10, 15] }, // Koridor Belakang (Pintu Pantri & Server)
      { id: 5, pos: new THREE.Vector3(0, 0, -14.5), links: [4, 16, 17] }, // Koridor Utara (Ke Pejabat Pengarah)

      // Sayap Barat (Bilik Fail <-> Pantri melalui pintu sambung #8)
      { id: 6, pos: new THREE.Vector3(-6, 0, 9), links: [2, 7] },       // Pintu Koridor <-> Bilik Fail
      { id: 7, pos: new THREE.Vector3(-19, 0, 9), links: [6, 8] },      // Tengah Bilik Fail
      { id: 8, pos: new THREE.Vector3(-20, 0, 0), links: [7, 9] },      // Pintu Sambung Bilik Fail <-> Pantri
      { id: 9, pos: new THREE.Vector3(-19, 0, -9), links: [8, 10] },    // Tengah Pantri
      { id: 10, pos: new THREE.Vector3(-6, 0, -9), links: [4, 9] },     // Pintu Koridor <-> Pantri

      // Sayap Timur (Bilik Mesyuarat <-> Bilik Server melalui pintu sambung #13)
      { id: 11, pos: new THREE.Vector3(6, 0, 9), links: [2, 12] },      // Pintu Koridor <-> Bilik Mesyuarat
      { id: 12, pos: new THREE.Vector3(19, 0, 9), links: [11, 13] },    // Tengah Bilik Mesyuarat
      { id: 13, pos: new THREE.Vector3(20, 0, 0), links: [12, 14] },    // Pintu Sambung Mesyuarat <-> Server
      { id: 14, pos: new THREE.Vector3(19, 0, -9), links: [13, 15] },   // Tengah Bilik Server
      { id: 15, pos: new THREE.Vector3(6, 0, -9), links: [4, 14] },     // Pintu Koridor <-> Bilik Server

      // Utara (Pejabat Pengarah dengan 2 pintu keluar)
      { id: 16, pos: new THREE.Vector3(-3.7, 0, -18), links: [5, 18] }, // Pintu Kiri Pengarah
      { id: 17, pos: new THREE.Vector3(3.7, 0, -18), links: [5, 18] },  // Pintu Kanan Pengarah
      { id: 18, pos: new THREE.Vector3(0, 0, -24), links: [16, 17] }    // Tengah Pejabat Pengarah
    ];

    this.patrolNodeIds = [18, 7, 9, 1, 12, 14, 3];

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
    const H = 4.6;

    // Lantai, Siling & Pencahayaan setiap bilik
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

      const light = new THREE.PointLight(0xfff3d6, 1.5, 24);
      light.position.set(r.x, H - 0.35, r.z);
      this.scene.add(light);
    }

    // Dinding Lobi Lif Utama (z: 18 .. 32, x: -10 .. +10)
    this.addBox(0, H / 2, 32.3, 20.6, H, 0.6, this.wallMat);
    this.addBox(-10.3, H / 2, 25.3, 0.6, H, 14.6, this.wallMat);
    this.addBox(10.3, H / 2, 25.3, 0.6, H, 14.6, this.wallMat);
    this.addBox(-8.15, H / 2, 18, 4.3, H, 0.6, this.wallMat);
    this.addBox(8.15, H / 2, 18, 4.3, H, 0.6, this.wallMat);

    // Dinding Luar Sayap Barat & Timur (x = -30.3 & x = +30.3)
    this.addBox(-30.3, H / 2, 0, 0.6, H, 36.6, this.wallMat);
    this.addBox(30.3, H / 2, 0, 0.6, H, 36.6, this.wallMat);

    // Dinding Selatan Sayap (z = 18) & Utara Sayap (z = -18)
    this.addBox(-18.15, H / 2, 18, 24.3, H, 0.6, this.wallMat);
    this.addBox(18.15, H / 2, 18, 24.3, H, 0.6, this.wallMat);
    this.addBox(-23.15, H / 2, -18, 14.3, H, 0.6, this.wallMat);
    this.addBox(23.15, H / 2, -18, 14.3, H, 0.6, this.wallMat);

    // Dinding Pejabat Pengarah (z: -34 .. -18, x: -16 .. +16)
    this.addBox(0, H / 2, -34.3, 32.6, H, 0.6, this.wallMat);
    this.addBox(-16.3, H / 2, -26.15, 0.6, H, 16.6, this.wallMat);
    this.addBox(16.3, H / 2, -26.15, 0.6, H, 16.6, this.wallMat);

    // Dinding Pemisah Koridor Barat (x = -6) dengan pintu lebar 4.6m di z=9 & z=-9
    this.addBox(-6, H / 2, 14.65, 0.6, H, 6.7, this.wallMat);
    this.addBox(-6, H / 2, 0, 0.6, H, 13.4, this.wallMat);
    this.addBox(-6, H / 2, -14.65, 0.6, H, 6.7, this.wallMat);

    // Dinding Pemisah Koridor Timur (x = +6) dengan pintu lebar 4.6m di z=9 & z=-9
    this.addBox(6, H / 2, 14.65, 0.6, H, 6.7, this.wallMat);
    this.addBox(6, H / 2, 0, 0.6, H, 13.4, this.wallMat);
    this.addBox(6, H / 2, -14.65, 0.6, H, 6.7, this.wallMat);

    // Dinding Pemisah Tengah Sayap Barat (z = 0) dengan pintu sambung 4.6m di x = -20
    this.addBox(-26.15, H / 2, 0, 7.7, H, 0.6, this.wallMat);
    this.addBox(-11.85, H / 2, 0, 11.7, H, 0.6, this.wallMat);

    // Dinding Pemisah Tengah Sayap Timur (z = 0) dengan pintu sambung 4.6m di x = +20
    this.addBox(11.85, H / 2, 0, 11.7, H, 0.6, this.wallMat);
    this.addBox(26.15, H / 2, 0, 7.7, H, 0.6, this.wallMat);

    // Dinding Pejabat Pengarah (z = -18) dengan 2 pintu masuk lebar 4.6m di x = -3.7 & x = +3.7
    this.addBox(-11.0, H / 2, -18, 10.0, H, 0.6, this.wallMat);
    this.addBox(0, H / 2, -18, 2.8, H, 0.6, this.wallMat);
    this.addBox(11.0, H / 2, -18, 10.0, H, 0.6, this.wallMat);

    // Papan Tanda Bilik Bahasa Melayu
    this.addPlaque('BILIK FAIL & ARKIB', -5.65, 3.4, 9, Math.PI / 2);
    this.addPlaque('BILIK MESYUARAT', 5.65, 3.4, 9, -Math.PI / 2);
    this.addPlaque('PANTRI & REHAT', -5.65, 3.4, -9, Math.PI / 2);
    this.addPlaque('BILIK JANAKUASA', 5.65, 3.4, -9, -Math.PI / 2);
    this.addPlaque('PEJABAT PENGARAH', 0, 3.4, -17.65, 0);
  }

  addPlaque(label, x, y, z, rotY) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 0.72),
      new THREE.MeshBasicMaterial({ map: createPlaqueTexture(label) })
    );
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    this.scene.add(sign);
  }

  buildFurnitureAndLockers() {
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x5c2d16, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.5 });

    // Perabot disusun di tengah bilik luas supaya pemain boleh pusing/elak sekeliling meja
    this.addBox(-16, 0.45, 9, 4.0, 0.9, 1.8, deskMat);   // Bilik Fail
    this.addBox(16, 0.45, 9, 6.2, 0.9, 2.2, deskMat);    // Bilik Mesyuarat
    this.addBox(-16, 0.45, -9, 4.2, 0.9, 1.6, metalMat); // Pantri
    this.addBox(0, 0.45, -28.5, 4.8, 0.9, 1.8, deskMat); // Pejabat Pengarah

    // Rak server di Bilik Janakuasa (dengan laluan luas)
    this.addBox(23.5, 1.4, -12, 1.4, 2.8, 4.2, metalMat);
    this.addBox(23.5, 1.4, -6, 1.4, 2.8, 4.2, metalMat);

    // Pintu Lif Utama di Lobi (z = 31.8)
    const liftDoorMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.25
    });
    const liftMesh = this.addBox(0, 1.5, 31.8, 3.2, 3.0, 0.3, liftDoorMat, false);
    this.interactables.push({
      id: 'elevator',
      type: 'elevator',
      label: 'Aktifkan Lif Utama',
      position: new THREE.Vector3(0, 1.2, 31.0),
      mesh: liftMesh,
      done: false
    });

    // 8 Loker Sembunyi di setiap bilik & koridor
    const lockerCoords = [
      { x: -8.8, z: 26, rot: Math.PI / 2 },
      { x: -28.8, z: 14, rot: Math.PI / 2 },
      { x: 28.8, z: 14, rot: -Math.PI / 2 },
      { x: -28.8, z: -14, rot: Math.PI / 2 },
      { x: 28.8, z: -14, rot: -Math.PI / 2 },
      { x: -14.8, z: -31, rot: Math.PI / 2 },
      { x: 14.8, z: -31, rot: -Math.PI / 2 },
      { x: -4.8, z: 0, rot: Math.PI / 2 }
    ];

    const lockerMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.4,
      metalness: 0.35
    });

    lockerCoords.forEach((lc, idx) => {
      const mesh = this.addBox(lc.x, 1.3, lc.z, 1.2, 2.6, 1.2, lockerMat, true);
      const exitOffset = new THREE.Vector3(Math.sin(lc.rot) * 1.5, 0, Math.cos(lc.rot) * 1.5);
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
    // 4 Fail Audit Sulit di atas meja setiap bilik utama
    const fileSpots = [
      { x: -16, y: 1.02, z: 9 },
      { x: 16, y: 1.02, z: 9 },
      { x: -16, y: 1.02, z: -9 },
      { x: 0, y: 1.02, z: -28.5 }
    ];

    const fileMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.7
    });

    fileSpots.forEach((f, i) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.45), fileMat);
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
      { x: 22.6, y: 1.5, z: -12 },
      { x: 22.6, y: 1.5, z: -6 }
    ];

    switchSpots.forEach((s, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.85
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.4), mat);
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

    // 4 Bateri Lampu Suluh Tambahan
    const batterySpots = [
      { x: 0, y: 0.3, z: 4 },
      { x: -20, y: 0.3, z: 0 },
      { x: 20, y: 0.3, z: 0 },
      { x: 0, y: 0.3, z: -22 }
    ];
    const batMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.75
    });

    batterySpots.forEach((b, i) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 12), batMat);
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
