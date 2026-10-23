
      // ---------- Fire particles (boss fireball) ----------
      const FIRE_MAX = 900;
      const fireP = {
        pos: new Float32Array(FIRE_MAX * 3),
        col: new Float32Array(FIRE_MAX * 3),
        vel: new Float32Array(FIRE_MAX * 3),
        life: new Float32Array(FIRE_MAX),
        max: new Float32Array(FIRE_MAX).fill(1),
        next: 0,
      };
      for (let i = 0; i < FIRE_MAX; i++) fireP.pos[i * 3 + 1] = -999;
      const fireGeo = new THREE.BufferGeometry();
      fireGeo.setAttribute("position", new THREE.BufferAttribute(fireP.pos, 3));
      fireGeo.setAttribute("color", new THREE.BufferAttribute(fireP.col, 3));
      const fireTex = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d");
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "#fff");
        gr.addColorStop(0.4, "#fff8");
        gr.addColorStop(1, "#0000");
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();
      const firePoints = new THREE.Points(
        fireGeo,
        new THREE.PointsMaterial({
          size: 1.3,
          map: fireTex,
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      firePoints.frustumCulled = false;
      scene.add(firePoints);
      function emitFire(o, ang, n, grow = 1) {
        for (let k = 0; k < n; k++) {
          const i = fireP.next;
          fireP.next = (i + 1) % FIRE_MAX;
          const a = ang + (Math.random() - 0.5) * Math.PI * (150 / 180),
            sp = (9 + Math.random() * 8) * grow;
          fireP.pos[i * 3] = o.x + (Math.random() - 0.5) * 0.3;
          fireP.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * 0.3;
          fireP.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * 0.3;
          fireP.vel[i * 3] = Math.sin(a) * sp;
          fireP.vel[i * 3 + 1] = (Math.random() - 0.3) * 2.2;
          fireP.vel[i * 3 + 2] = Math.cos(a) * sp;
          fireP.life[i] = fireP.max[i] = 0.5 + Math.random() * 0.5;
        }
      }
      function updateFire(dt) {
        for (let i = 0; i < FIRE_MAX; i++) {
          if (fireP.life[i] <= 0) {
            fireP.pos[i * 3 + 1] = -999;
            continue;
          }
          fireP.life[i] -= dt;
          const f = Math.max(0, fireP.life[i] / fireP.max[i]);
          fireP.pos[i * 3] += fireP.vel[i * 3] * dt;
          fireP.pos[i * 3 + 1] += fireP.vel[i * 3 + 1] * dt;
          fireP.pos[i * 3 + 2] += fireP.vel[i * 3 + 2] * dt;
          fireP.vel[i * 3 + 1] += 1.5 * dt;
          fireP.vel[i * 3] *= 0.985;
          fireP.vel[i * 3 + 2] *= 0.985;
          fireP.col[i * 3] = Math.min(1, f * 2);
          fireP.col[i * 3 + 1] = Math.max(0, Math.min(1, f * 1.5 - 0.25));
          fireP.col[i * 3 + 2] = Math.max(0, f - 0.8) * 2;
        }
        fireGeo.attributes.position.needsUpdate = true;
        fireGeo.attributes.color.needsUpdate = true;
        if (!(bossObj && bossObj.ai === "fire"))
          firePoints.material.size = Math.max(
            1.3,
            firePoints.material.size - 3 * dt,
          );
      }
      const _hv = new THREE.Vector3();
      function emitFireFromHands(b, dt, grow = 0) {
        const n = Math.max(1, Math.round(140 * dt * (1 + 1.5 * grow))),
          sp = (0.5 + 0.9 * grow) * BOSS_SPD;
        if (b.hands.length)
          b.hands.forEach((h) => {
            h.getWorldPosition(_hv);
            emitFire(_hv, b.lockAng, n, sp);
          });
        else {
          _hv.set(
            b.mesh.position.x + Math.sin(b.lockAng) * 1.2 * BOSS_SCALE,
            b.mesh.position.y + 1.7 * BOSS_SCALE,
            b.mesh.position.z + Math.cos(b.lockAng) * 1.2 * BOSS_SCALE,
          );
          emitFire(_hv, b.lockAng, n * 2, sp);
        }
      }
