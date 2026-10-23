
      // ==========================================
      // LEAF-VILLAGE TRAINING GROUNDS (Naruto style)
      // ==========================================
      const fixtures = [];
      const treeMeshes = [];
      const PLAYER_PAD = 0.3;
      const toon = (c) =>
        new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp });

      function addFixture(x, z, radius, h = 99) {
        fixtures.push({ x, z, radius, h });
      }
      // circles along a rotated line (for long walls, fences, stalls)
      function addLineFixtures(x, z, rotY, halfLen, radius, n, h = 99) {
        for (let i = 0; i < n; i++) {
          const o = n === 1 ? 0 : -halfLen + (2 * halfLen * i) / (n - 1);
          addFixture(x + o * Math.cos(rotY), z - o * Math.sin(rotY), radius, h);
        }
      }
      function isFree(x, z, r) {
        return fixtures.every(
          (f) => Math.hypot(f.x - x, f.z - z) > f.radius + r + 1.0,
        );
      }
      // Pushes the player out of every solid object (low ones can be jumped over)
      function resolveFixtureCollisions(pos) {
        for (let pass = 0; pass < 2; pass++) {
          for (const f of fixtures) {
            if (pos.y > getElevation(f.x, f.z) + f.h) continue;
            const dx = pos.x - f.x;
            const dz = pos.z - f.z;
            const minD = f.radius + PLAYER_PAD;
            const d = Math.hypot(dx, dz);
            if (d < minD && d > 0.001) {
              pos.x = f.x + (dx / d) * minD;
              pos.z = f.z + (dz / d) * minD;
            }
          }
        }
        pos.x = Math.max(-125, Math.min(125, pos.x));
        pos.z = Math.max(-125, Math.min(125, pos.z));
      }

      // ---------- Ground: patchy anime grass + dirt training circle ----------
      const groundGeo = new THREE.PlaneGeometry(260, 260, 90, 90);
      groundGeo.rotateX(-Math.PI / 2);
      const groundPos = groundGeo.attributes.position;
      const gCol = new Float32Array(groundPos.count * 3);
      const colDark = new THREE.Color(0x2f9e48);
      const colLight = new THREE.Color(0x8fd45a);
      const colDirt = new THREE.Color(0xcfa86e);
      const tmpCol = new THREE.Color();
      for (let i = 0; i < groundPos.count; i++) {
        const x = groundPos.getX(i);
        const z = groundPos.getZ(i);
        groundPos.setY(i, getElevation(x, z));
        const n =
          Math.sin(x * 0.21) * Math.cos(z * 0.17) +
          Math.sin(x * 0.07 + z * 0.11) * 0.8 +
          Math.sin(x * 0.45) * Math.sin(z * 0.4) * 0.5;
        tmpCol
          .copy(colDark)
          .lerp(colLight, Math.max(0, Math.min(1, (n + 1.6) / 3.2)));
        const r = Math.hypot(x, z) + n * 1.6;
        if (r < 14) tmpCol.lerp(colDirt, Math.min(1, (14 - r) / 4));
        gCol[i * 3] = tmpCol.r;
        gCol[i * 3 + 1] = tmpCol.g;
        gCol[i * 3 + 2] = tmpCol.b;
      }
      groundGeo.setAttribute("color", new THREE.BufferAttribute(gCol, 3));
      groundGeo.computeVertexNormals();
      const ground = new THREE.Mesh(
        groundGeo,
        new THREE.MeshToonMaterial({
          vertexColors: true,
          gradientMap: toonRamp,
        }),
      );
      ground.receiveShadow = true;
      scene.add(ground);

      // ---------- Swaying grass (instanced, animated in the vertex shader) ----------
      const grassUniforms = { uTime: { value: 0 } };
      const BLADE_H = 0.75;
      const bladeGeo = new THREE.PlaneGeometry(0.14, BLADE_H, 1, 3);
      bladeGeo.translate(0, BLADE_H / 2, 0);
      {
        const p = bladeGeo.attributes.position;
        const bc = new Float32Array(p.count * 3);
        const base = new THREE.Color(0x23803a);
        const tip = new THREE.Color(0xb6ec6a);
        for (let i = 0; i < p.count; i++) {
          const t = p.getY(i) / BLADE_H;
          p.setX(i, p.getX(i) * (1 - t * 0.85)); // taper to a point
          tmpCol.copy(base).lerp(tip, t);
          bc[i * 3] = tmpCol.r;
          bc[i * 3 + 1] = tmpCol.g;
          bc[i * 3 + 2] = tmpCol.b;
        }
        bladeGeo.setAttribute("color", new THREE.BufferAttribute(bc, 3));
      }
      const grassMat = new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap: toonRamp,
        side: THREE.DoubleSide,
      });
      grassMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = grassUniforms.uTime;
        shader.vertexShader =
          "uniform float uTime;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            `vec3 transformed = vec3(position);
             vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
             transformed.x += sin(uTime * 2.2 + ip.x * 0.45 + ip.z * 0.35) * 0.16 * position.y;
             transformed.z += cos(uTime * 1.6 + ip.z * 0.4 + ip.x * 0.2) * 0.09 * position.y;`,
          );
      };
      const CLUMPS = 2600;
      const BLADES_PER_CLUMP = 5;
      const grass = new THREE.InstancedMesh(
        bladeGeo,
        grassMat,
        CLUMPS * BLADES_PER_CLUMP,
      );
      const dummy = new THREE.Object3D();
      let gi = 0;
      for (let c = 0; c < CLUMPS; c++) {
        const cx = (Math.random() - 0.5) * 240;
        const cz = (Math.random() - 0.5) * 240;
        if (Math.hypot(cx, cz) < 11) continue; // keep the dirt circle clear
        for (let b = 0; b < BLADES_PER_CLUMP; b++) {
          const x = cx + (Math.random() - 0.5) * 1.4;
          const z = cz + (Math.random() - 0.5) * 1.4;
          dummy.position.set(x, getElevation(x, z) - 0.02, z);
          dummy.rotation.set(
            (Math.random() - 0.5) * 0.4,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.4,
          );
          dummy.scale.set(1, 0.6 + Math.random() * 1.1, 1);
          dummy.updateMatrix();
          grass.setMatrixAt(gi++, dummy.matrix);
        }
      }
      grass.count = gi;
      grass.frustumCulled = false;
      scene.add(grass);

      // ---------- Tiny flowers ----------
      const flowerGeo = new THREE.SphereGeometry(0.1, 6, 4);
      [0xffffff, 0xffe066, 0xff9ebb].forEach((color) => {
        const mesh = new THREE.InstancedMesh(flowerGeo, toon(color), 220);
        for (let i = 0; i < 220; i++) {
          const x = (Math.random() - 0.5) * 220;
          const z = (Math.random() - 0.5) * 220;
          dummy.position.set(x, getElevation(x, z) + 0.3, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(0.8 + Math.random() * 0.6);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        scene.add(mesh);
      });

      // ---------- Rocks (solid, small ones can be jumped) ----------
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rockMat = toon(0x9a9aa8);
      for (let i = 0; i < 90; i++) {
        const gx = (Math.random() - 0.5) * 220;
        const gz = (Math.random() - 0.5) * 220;
        if (Math.hypot(gx, gz) < 6) continue;
        const s = 0.4 + Math.random() * 0.9;
        const rock = createStylizedMesh(rockGeo, rockMat, 0.05);
        rock.scale.set(s, s * 0.75, s);
        rock.position.set(gx, getElevation(gx, gz) + s * 0.35, gz);
        rock.rotation.y = Math.random() * Math.PI * 2;
        scene.add(rock);
        addFixture(gx, gz, s * 0.9, s * 1.1);
      }

      // ---------- Shared materials ----------
      const woodMat = toon(0x795548);
      const ropeMat = toon(0xd7ccc8);
      const stoneMat = toon(0xb4b4be);
      const wallMat = toon(0xf4e6c4);
      const darkMat = toon(0x2b2b33);
      const toriiRed = toon(0xc8321e);
      const roofOrange = toon(0xe0602a);
      const roofTeal = toon(0x2f8f8a);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      const steelMat = toon(0x8795a8);

      function placeGroup(g, x, z, rotY) {
        g.position.set(x, getElevation(x, z), z);
        g.rotation.y = rotY;
        scene.add(g);
      }
      function addPart(g, geo, mat, x, y, z, outline = 0.03) {
        const m = createStylizedMesh(geo, mat, outline);
        m.position.set(x, y, z);
        g.add(m);
        return m;
      }

      // ---------- Training posts (Team 7 style) ----------
      function buildTrainingPost(x, z) {
        const post = new THREE.Group();
        addPart(
          post,
          new THREE.CylinderGeometry(0.3, 0.4, 3.5, 8),
          woodMat,
          0,
          1.75,
          0,
          0.04,
        );
        [1.5, 2.0].forEach((h, i) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.35 - i * 0.02, 0.05, 8, 12),
            ropeMat,
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = h;
          post.add(ring);
        });
        placeGroup(post, x, z, 0);
        addFixture(x, z, 0.4);
      }

      // ---------- Konoha-style house ----------
      function buildLeafHouse(x, z, rotY, roofMat) {
        const g = new THREE.Group();
        addPart(
          g,
          new THREE.BoxGeometry(7.4, 1.2, 5.4),
          stoneMat,
          0,
          0.1,
          0,
          0.02,
        );
        addPart(
          g,
          new THREE.BoxGeometry(6.6, 3.4, 4.6),
          wallMat,
          0,
          2.6,
          0,
          0.025,
        );
        addPart(g, new THREE.BoxGeometry(6.9, 0.3, 4.9), woodMat, 0, 4.35, 0);
        const roof = addPart(
          g,
          new THREE.ConeGeometry(5.6, 2.8, 4),
          roofMat,
          0,
          5.8,
          0,
        );
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1, 1, 0.78);
        addPart(
          g,
          new THREE.BoxGeometry(1.3, 2.3, 0.15),
          darkMat,
          0,
          2.15,
          2.35,
          0.02,
        );
        [-2.2, 2.2].forEach((wx) => {
          addPart(
            g,
            new THREE.BoxGeometry(1.1, 1.0, 0.15),
            glowMat,
            wx,
            3.0,
            2.35,
            0.04,
          );
          addPart(
            g,
            new THREE.BoxGeometry(0.1, 1.0, 0.18),
            woodMat,
            wx,
            3.0,
            2.36,
            0,
          );
        });
        placeGroup(g, x, z, rotY);
        addLineFixtures(x, z, rotY, 2.4, 2.5, 3, 5);
      }

      // ---------- Torii gate ----------
      function buildTorii(x, z, rotY) {
        const g = new THREE.Group();
        [-2.2, 2.2].forEach((px) =>
          addPart(
            g,
            new THREE.CylinderGeometry(0.32, 0.38, 6, 10),
            toriiRed,
            px,
            3,
            0,
            0.04,
          ),
        );
        addPart(g, new THREE.BoxGeometry(5.2, 0.3, 0.4), toriiRed, 0, 4.7, 0);
        addPart(g, new THREE.BoxGeometry(7.4, 0.45, 0.7), toriiRed, 0, 6.1, 0);
        addPart(g, new THREE.BoxGeometry(7.9, 0.25, 0.85), darkMat, 0, 6.45, 0);
        placeGroup(g, x, z, rotY);
        addLineFixtures(x, z, rotY, 2.2, 0.4, 2);
        // stone lanterns flanking the gate
        [-3.8, 3.8].forEach((o) =>
          buildLantern(
            x + o * Math.cos(rotY) + 1.2 * Math.sin(rotY),
            z - o * Math.sin(rotY) + 1.2 * Math.cos(rotY),
          ),
        );
      }

      // ---------- Stone lantern ----------
      function buildLantern(x, z) {
        const g = new THREE.Group();
        addPart(
          g,
          new THREE.CylinderGeometry(0.55, 0.65, 0.35, 8),
          stoneMat,
          0,
          0.18,
          0,
          0.04,
        );
        addPart(
          g,
          new THREE.CylinderGeometry(0.17, 0.2, 1.3, 8),
          stoneMat,
          0,
          1.0,
          0,
          0.05,
        );
        addPart(
          g,
          new THREE.BoxGeometry(0.9, 0.8, 0.9),
          stoneMat,
          0,
          1.95,
          0,
          0.04,
        );
        addPart(
          g,
          new THREE.BoxGeometry(0.5, 0.5, 0.95),
          glowMat,
          0,
          1.95,
          0,
          0,
        );
        addPart(
          g,
          new THREE.BoxGeometry(0.95, 0.5, 0.5),
          glowMat,
          0,
          1.95,
          0,
          0,
        );
        const cap = addPart(
          g,
          new THREE.ConeGeometry(0.85, 0.6, 4),
          stoneMat,
          0,
          2.65,
          0,
          0.04,
        );
        cap.rotation.y = Math.PI / 4;
        placeGroup(g, x, z, 0);
        addFixture(x, z, 0.45);
      }

      // ---------- Giant shuriken stuck in the ground ----------
      const shurikenShape = new THREE.Shape();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 1.7 : 0.45;
        const a = (i / 8) * Math.PI * 2 + Math.PI / 4;
        if (i === 0) shurikenShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shurikenShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const shurikenHole = new THREE.Path();
      shurikenHole.absarc(0, 0, 0.2, 0, Math.PI * 2, true);
      shurikenShape.holes.push(shurikenHole);
      const shurikenGeo = new THREE.ExtrudeGeometry(shurikenShape, {
        depth: 0.14,
        bevelEnabled: false,
      });
      shurikenGeo.translate(0, 0, -0.07);
      function buildShuriken(x, z, rotY) {
        const g = new THREE.Group();
        const s = addPart(g, shurikenGeo, steelMat, 0, 1.45, 0, 0.05);
        s.rotation.x = -0.3;
        s.rotation.z = Math.random() * 0.8;
        placeGroup(g, x, z, rotY);
        addFixture(x, z, 0.8, 3.2);
      }

      // ---------- Ichiraku-style ramen stall ----------
      function buildRamenStall(x, z, rotY) {
        const g = new THREE.Group();
        addPart(g, new THREE.BoxGeometry(4, 1.1, 1.5), woodMat, 0, 0.55, 0.3);
        [-1.9, 1.9].forEach((px) =>
          addPart(
            g,
            new THREE.BoxGeometry(0.2, 3.1, 0.2),
            woodMat,
            px,
            1.55,
            -0.6,
            0.04,
          ),
        );
        addPart(
          g,
          new THREE.BoxGeometry(4.6, 0.25, 2.6),
          roofOrange,
          0,
          3.2,
          0.1,
        );
        for (let i = -1; i <= 1; i++)
          addPart(
            g,
            new THREE.BoxGeometry(1.1, 1.1, 0.06),
            wallMat,
            i * 1.25,
            2.5,
            1.35,
            0.03,
          );
        addPart(
          g,
          new THREE.BoxGeometry(3.6, 1.6, 0.1),
          toriiRed,
          0,
          1.9,
          -0.7,
          0.02,
        );
        placeGroup(g, x, z, rotY);
        addLineFixtures(x, z, rotY, 1.5, 1.1, 2, 4);
      }

      // Structures first, so trees/posts can avoid them
      buildLeafHouse(25, -30, 0.4, roofOrange);
      buildLeafHouse(-35, 40, -0.6, roofTeal);
      buildLeafHouse(-55, -20, 1.1, roofOrange);
      buildLeafHouse(45, 55, -1.2, roofTeal);
      buildTorii(10, 22, 0.3);
      buildTorii(-20, -30, -0.5);
      buildTorii(60, -10, 1.4);
      buildRamenStall(-20, 15, 0.6);
      buildShuriken(-15, -45, 0.4);
      buildShuriken(35, 10, -0.8);
      buildShuriken(-45, 8, 1.2);
      buildShuriken(5, -60, 0);
      [-4, 0, 4].forEach((px) => buildTrainingPost(px, -14)); // three posts in a row
      for (let i = 0; i < 6; i++) {
        const lx = (Math.random() - 0.5) * 160;
        const lz = (Math.random() - 0.5) * 160;
        if (Math.hypot(lx, lz) > 14 && isFree(lx, lz, 0.5))
          buildLantern(lx, lz);
      }

      // ---------- Trees ----------
      // 🍃 NOTE: every tree gets its OWN cloned material. If they share one,
      // fading one tree fades every tree in the world.
      const trunkMatBase = toon(0x5d4037);
      const leafMatsBase = [toon(0x43a047), toon(0x2e7d32), toon(0x81c784)];

      function buildAnimeTree(x, z) {
        const tree = new THREE.Group();

        // Trunk material — per-tree clone, transparent so it CAN fade
        const trunkMaterial = trunkMatBase.clone();
        trunkMaterial.transparent = true;
        trunkMaterial.opacity = 1.0;
        trunkMaterial.depthWrite = true;

        const trunkMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.45, 5.0, 10),
          trunkMaterial,
        );
        trunkMesh.position.y = 2.5;
        trunkMesh.castShadow = true;
        tree.add(trunkMesh);
        treeMeshes.push(trunkMesh);

        // Leaf material — per-tree clone, transparent
        const chosenMat =
          leafMatsBase[Math.floor(Math.random() * leafMatsBase.length)].clone();
        chosenMat.transparent = true;
        chosenMat.opacity = 1.0;
        chosenMat.depthWrite = true;

        const puffs = [
          { x: 0, y: 5.2, z: 0, r: 2.3 },
          { x: 1.2, y: 4.5, z: 0.5, r: 1.6 },
          { x: -1.2, y: 4.6, z: -0.5, r: 1.6 },
          { x: 0.0, y: 6.4, z: 0.0, r: 1.7 },
          { x: 0.0, y: 7.5, z: 0.0, r: 1.0 },
        ];
        puffs.forEach((p) => {
          const puff = new THREE.Mesh(
            new THREE.DodecahedronGeometry(p.r, 1),
            chosenMat,
          );
          puff.position.set(p.x, p.y, p.z);
          puff.castShadow = true;
          tree.add(puff);
          treeMeshes.push(puff);
        });
        placeGroup(tree, x, z, 0);
        addFixture(x, z, 0.5);
      }

      for (let i = 0; i < 70; i++) {
        const tx = (Math.random() - 0.5) * 180;
        const tz = (Math.random() - 0.5) * 180;
        if (Math.hypot(tx, tz) > 14 && isFree(tx, tz, 2.0))
          buildAnimeTree(tx, tz);
      }
      for (let i = 0; i < 8; i++) {
        const px = (Math.random() - 0.5) * 150;
        const pz = (Math.random() - 0.5) * 150;
        if (Math.hypot(px, pz) > 18 && isFree(px, pz, 0.5))
          buildTrainingPost(px, pz);
      }

      // ---------- Distant misty hills for depth ----------
      const hillMats = [toon(0x7fb88a), toon(0x95c9a2)];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
        const r = 150 + Math.random() * 25;
        const h = 25 + Math.random() * 35;
        const hill = new THREE.Mesh(
          new THREE.ConeGeometry(30 + Math.random() * 20, h, 7),
          hillMats[i % 2],
        );
        hill.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
        scene.add(hill);
      }
