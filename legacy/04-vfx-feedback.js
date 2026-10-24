
      const lightningGroup = new THREE.Group();
      scene.add(lightningGroup);
      let isLightningActive = false;
      let lightningIntensity = 1.0;

      const electricLight = new THREE.PointLight(0x00f7ff, 0, 9);
      scene.add(electricLight);

      // Chidori Aura (Glowing sphere around the foot)
      const chidoriMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const chidori = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 16),
        chidoriMat,
      );
      chidori.renderOrder = 1000;
      scene.add(chidori);

      function createAnimeLightning(start, end, isCore) {
        const points = [];
        const steps = 7;
        const dir = new THREE.Vector3().subVectors(end, start);

        for (let i = 0; i <= steps; i++) {
          const p = start.clone().addScaledVector(dir, i / steps);
          // Add jagged randomness to the middle points
          if (i > 0 && i < steps) {
            p.x += (Math.random() - 0.5) * 0.8;
            p.y += (Math.random() - 0.5) * 0.8;
            p.z += (Math.random() - 0.5) * 0.8;
          }
          points.push(p);
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const radius = isCore ? 0.018 : 0.06;
        const geo = new THREE.TubeGeometry(curve, 16, radius, 4, false);

        const color = isCore ? 0xffffff : 0x00ffff;
        const mat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        return new THREE.Mesh(geo, mat);
      }

      function updateLightningVFX() {
        // Clear old lightning
        while (lightningGroup.children.length > 0) {
          const obj = lightningGroup.children[0];
          lightningGroup.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        }

        if (!isLightningActive) {
          electricLight.intensity = 0;
          chidoriMat.opacity = 0;
          return;
        }

        const fwd = new THREE.Vector3(
          Math.sin(character.rotation.y),
          0,
          Math.cos(character.rotation.y),
        );
        const footPos = character.position.clone().addScaledVector(fwd, 1.1);
        footPos.y += 0.5;
        const bodyPos = character.position.clone();
        bodyPos.y += 1.2;

        // Chidori Aura Update
        chidori.position.copy(footPos);
        const pulse = 1.0 + Math.random() * 0.15;
        chidori.scale.set(pulse, pulse, pulse);
        chidoriMat.opacity = Math.min(0.5, 0.22 * lightningIntensity);

        electricLight.position.copy(footPos);
        electricLight.intensity = 1.8 * lightningIntensity;

        // Spawn new lightning arcs (smaller, tighter spread)
        const boltCount = Math.floor(3 * lightningIntensity);
        for (let i = 0; i < boltCount; i++) {
          const start = i % 2 === 0 ? bodyPos : footPos;
          const end = footPos
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 0.9 * lightningIntensity,
                (Math.random() - 0.5) * 0.8 * lightningIntensity,
                (Math.random() - 0.5) * 0.9 * lightningIntensity,
              ),
            );

          // Outer Cyan Glow
          lightningGroup.add(createAnimeLightning(start, end, false));
          // Inner White Core
          lightningGroup.add(createAnimeLightning(start, end, true));
        }
      }

      function spawnHealNumber(amount) {
        if (amount <= 0) return;
        const pos = character.position.clone();
        pos.y += 2.0;
        pos.project(camera);
        const sx = Math.max(
          60,
          Math.min(
            window.innerWidth - 60,
            (pos.x * 0.5 + 0.5) * window.innerWidth - 80,
          ),
        );
        const sy = Math.max(
          60,
          Math.min(
            window.innerHeight - 80,
            (-(pos.y * 0.5) + 0.5) * window.innerHeight - 30,
          ),
        );
        const tag = document.createElement("div");
        tag.className = "damage-pop heal";
        tag.innerText = `+${amount} HP 💚`;
        tag.style.left = `${sx}px`;
        tag.style.top = `${sy}px`;
        document.body.appendChild(tag);
        setTimeout(() => tag.remove(), 1000);
      }

      function spawnDodgeText() {
        Game.audio.play("dodge");
        const pos = character.position.clone();
        pos.y += 2.0;
        pos.project(camera);
        if (pos.z <= 1.0) {
          const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
          const tag = document.createElement("div");
          tag.className = "damage-pop dodge";
          tag.innerText = `DODGED!`;
          tag.style.left = `${sx}px`;
          tag.style.top = `${sy}px`;
          document.body.appendChild(tag);
          setTimeout(() => tag.remove(), 950);
        }

        // 🗡️ Phantom's Grace — reward the dodge
        if (prog.phantomGrace && !isPlayerDead) {
          prog.phantomCritReady = true;
          const healAmt = Math.round(PLAYER_MAX_HP * 0.02);
          if (healAmt > 0) {
            playerHP = Math.min(PLAYER_MAX_HP, playerHP + healAmt);
            updatePlayerUI();
            spawnHealNumber(healAmt);
          }
        }
      }

      function spawnBatMissText(bat) {
        const pos = bat.mesh.position.clone();
        pos.y += 1.1;
        pos.project(camera);
        if (pos.z <= 1.0) {
          const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
          const tag = document.createElement("div");
          tag.className = "damage-pop miss";
          tag.innerText = `MISS`;
          tag.style.left = `${sx}px`;
          tag.style.top = `${sy}px`;
          document.body.appendChild(tag);
          setTimeout(() => tag.remove(), 900);
        }
        const side = (Math.random() > 0.5 ? 1 : -1) * 0.9;
        bat.mesh.position.x += side;
        bat.mesh.position.y += 0.4;
      }

      function triggerCritShockwave() {
        const ringGeo = new THREE.RingGeometry(0.4, 0.75, 48);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff1a53,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.renderOrder = 999;
        ring.position.set(
          character.position.x,
          character.position.y + 0.25,
          character.position.z,
        );
        scene.add(ring);

        let scale = 1.0;
        const ringInterval = setInterval(() => {
          scale += 0.35;
          ring.scale.set(scale, scale, scale);
          ring.material.opacity -= 0.06;
          if (ring.material.opacity <= 0) {
            clearInterval(ringInterval);
            scene.remove(ring);
          }
        }, 16);
      }

      function spawnLightExplosion(
        pos,
        color = 0xfff2a8,
        maxScale = 3.2,
        duration = 380,
      ) {
        const group = new THREE.Group();

        // Bright core flash
        const coreGeo = new THREE.SphereGeometry(0.35, 20, 20);
        const coreMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.renderOrder = 999;
        group.add(core);

        // Semi-transparent outer halo
        const haloGeo = new THREE.SphereGeometry(0.55, 20, 20);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.renderOrder = 998;
        group.add(halo);

        // Ground shockwave ring
        const ringGeo = new THREE.RingGeometry(0.3, 0.7, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.renderOrder = 997;
        ring.position.y = -pos.y + getElevation(pos.x, pos.z) + 0.15;
        group.add(ring);

        group.position.copy(pos);
        scene.add(group);

        const flashLight = new THREE.PointLight(color, 3.0, 8);
        flashLight.position.copy(pos);
        scene.add(flashLight);

        let elapsed = 0;
        const timer = setInterval(() => {
          elapsed += 16;
          const t = Math.min(1, elapsed / duration);

          const coreS = 0.5 + t * maxScale;
          core.scale.set(coreS, coreS, coreS);
          coreMat.opacity = 0.85 * (1 - t);

          const haloS = 0.8 + t * maxScale * 1.4;
          halo.scale.set(haloS, haloS, haloS);
          haloMat.opacity = 0.35 * (1 - t);

          const ringS = 1 + t * maxScale * 1.8;
          ring.scale.set(ringS, 1, ringS);
          ringMat.opacity = 0.9 * (1 - t);

          flashLight.intensity = 3.0 * (1 - t);

          if (t >= 1) {
            clearInterval(timer);
            scene.remove(group);
            scene.remove(flashLight);
            coreGeo.dispose();
            coreMat.dispose();
            haloGeo.dispose();
            haloMat.dispose();
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 16);
      }
