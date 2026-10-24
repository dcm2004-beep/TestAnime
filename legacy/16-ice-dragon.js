
      // ---------- Ice dragon: flying, single wing-flap loop, ranged ice beams ----------
      const DRAGON_URL = "assets/monsters/icedragon/icedragon.glb";
      const DRAGON_SCALE = 0.5,
        DRAGON_RADIUS = 0.6,
        DRAGON_FACING = 0;
      const DRAGON_HP = 3000,
        DRAGON_DMG = 18,
        DRAGON_FREEZE_CHANCE = 0.3,
        DRAGON_FREEZE_TIME = 1.2;
      const DRAGON_FLY_HEIGHT = 2.9;
      const DRAGON_ATTACK_RANGE = 15;
      const DRAGON_BEAM_SPEED = 18;
      const DRAGON_BEAM_RADIUS = 0.55;
      const DRAGON_BEAM_COOLDOWN = 2.4;
      const DRAGON_CHARGE_TIME = 0.8;

      let dragonAsset = null,
        dragonObj = null,
        dragonCd = 15;
      const dragonFixture = { x: 0, z: 0, radius: 0, h: 999 };
      const dragonBeams = [];

      loadGLTF(DRAGON_URL).then((g) => {
        if (g) dragonAsset = g;
        else console.warn("Ice dragon file not found: " + DRAGON_URL);
      });

      function spawnIceCharge(
        startPos,
        targetPos,
        duration,
        onComplete,
        type = "ice",
      ) {
        const isFire = type === "fire";
        const cCharge = isFire ? 0xffccaa : 0xbef0ff;
        const cChargeEmissive = isFire ? 0xff7744 : 0x7fdcff;
        const geo = new THREE.SphereGeometry(0.25, 12, 12);
        const mat = new THREE.MeshStandardMaterial({
          color: cCharge,
          emissive: cChargeEmissive,
          emissiveIntensity: 2.0,
          roughness: 0.1,
          transparent: true,
          opacity: 0.95,
          flatShading: true,
        });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.copy(startPos);
        scene.add(sphere);

        const light = new THREE.PointLight(isFire ? 0xff8844 : 0x9be7ff, 0, 6);
        light.position.copy(startPos);
        scene.add(light);

        // 🔴 Red aim warning line — shows the exact path the beam will take
        const dir = new THREE.Vector3().subVectors(targetPos, startPos);
        const lineLen = dir.length();
        let aimLine = null;
        if (lineLen > 0.1) {
          const lineGeo = new THREE.CylinderGeometry(0.045, 0.045, lineLen, 8);
          lineGeo.rotateX(Math.PI / 2);
          lineGeo.translate(0, 0, lineLen / 2);
          const lineMat = new THREE.MeshBasicMaterial({
            color: 0xff4466,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          aimLine = new THREE.Mesh(lineGeo, lineMat);
          aimLine.position.copy(startPos);
          aimLine.lookAt(targetPos);
          scene.add(aimLine);
        }

        const start = performance.now();
        const timer = setInterval(() => {
          const t = (performance.now() - start) / (duration * 1000);
          if (t >= 1) {
            clearInterval(timer);
            scene.remove(sphere);
            scene.remove(light);
            if (aimLine) {
              scene.remove(aimLine);
              aimLine.geometry.dispose();
              aimLine.material.dispose();
            }
            geo.dispose();
            mat.dispose();
            onComplete();
            return;
          }
          const s = 0.3 + t * 1.0;
          sphere.scale.setScalar(s);
          mat.emissiveIntensity = 2.0 + t * 3.0;
          light.intensity = t * 3.0;
          if (aimLine) {
            aimLine.material.opacity = 0.35 + Math.sin(t * Math.PI) * 0.4;
          }
        }, 16);
      }

      function spawnDragonBeam(startPos, targetPos, dmg, type = "ice") {
        Game.audio.play("beam");
        const isFire = type === "fire";
        const cGlow = isFire ? 0xff2200 : 0x2a8fd1;
        const cMid = isFire ? 0xff5533 : 0x4fb9e8;
        const cMidEmissive = isFire ? 0xffaa44 : 0x7fdcff;
        const cTip = isFire ? 0xffaa66 : 0xc5eeff;
        const cTipEmissive = isFire ? 0xff5533 : 0x4fb9e8;
        const cLight = isFire ? 0xff7744 : 0x7fdcff;
        const cFlash = isFire ? 0xffddaa : 0xd0f7ff;

        const group = new THREE.Group();

        const glowGeo = new THREE.CylinderGeometry(0.22, 0.22, 2.8, 12);
        glowGeo.rotateX(Math.PI / 2);
        const glowMat = new THREE.MeshBasicMaterial({
          color: cGlow,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.renderOrder = 1;
        group.add(glow);

        const outlineGeo = new THREE.CylinderGeometry(0.13, 0.13, 2.6, 10);
        outlineGeo.rotateX(Math.PI / 2);
        const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a1e2e });
        const outline = new THREE.Mesh(outlineGeo, outlineMat);
        outline.renderOrder = 2;
        group.add(outline);

        const midGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.55, 10);
        midGeo.rotateX(Math.PI / 2);
        const midMat = new THREE.MeshStandardMaterial({
          color: cMid,
          emissive: cMidEmissive,
          emissiveIntensity: 1.6,
          roughness: 0.2,
          metalness: 0.1,
          flatShading: true,
        });
        const mid = new THREE.Mesh(midGeo, midMat);
        mid.renderOrder = 3;
        group.add(mid);

        const coreGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.5, 8);
        coreGeo.rotateX(Math.PI / 2);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.renderOrder = 4;
        group.add(core);

        const tipGeo = new THREE.ConeGeometry(0.13, 1.1, 8);
        tipGeo.rotateX(Math.PI / 2);
        tipGeo.translate(0, 0, 1.85);
        const tipMat = new THREE.MeshStandardMaterial({
          color: cTip,
          emissive: cTipEmissive,
          emissiveIntensity: 1.0,
          roughness: 0.15,
          metalness: 0.15,
          flatShading: true,
        });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.renderOrder = 5;
        group.add(tip);

        const shardGroup = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const shardGeo = new THREE.OctahedronGeometry(0.05, 0);
          const shardMat = new THREE.MeshStandardMaterial({
            color: cTip,
            emissive: cTipEmissive,
            emissiveIntensity: 0.8,
            flatShading: true,
            roughness: 0.1,
          });
          const shard = new THREE.Mesh(shardGeo, shardMat);
          const a = (i / 4) * Math.PI * 2;
          shard.position.set(
            Math.cos(a) * 0.07,
            Math.sin(a) * 0.07,
            i % 2 === 0 ? -0.5 : 0.5,
          );
          shardGroup.add(shard);
        }
        group.add(shardGroup);

        group.position.copy(startPos);
        group.lookAt(targetPos);
        scene.add(group);

        const dir = new THREE.Vector3()
          .subVectors(targetPos, startPos)
          .normalize();

        const light = new THREE.PointLight(cLight, 2.2, 7);
        light.position.copy(startPos);
        scene.add(light);

        const flashGeo = new THREE.SphereGeometry(0.4, 12, 12);
        const flashMat = new THREE.MeshBasicMaterial({
          color: cFlash,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(startPos);
        scene.add(flash);
        let flashScale = 1.0;
        const flashTimer = setInterval(() => {
          flashScale += 0.2;
          flash.scale.setScalar(flashScale);
          flashMat.opacity -= 0.1;
          if (flashMat.opacity <= 0) {
            clearInterval(flashTimer);
            scene.remove(flash);
            flashGeo.dispose();
            flashMat.dispose();
          }
        }, 16);

        dragonBeams.push({
          group,
          shardGroup,
          light,
          dir,
          speed: DRAGON_BEAM_SPEED,
          life: 2.5,
          damage: dmg,
          hit: false,
          dragonType: type,
        });
      }

      function spawnIceShatter(pos, color = 0x9be7ff) {
        const ringGeo = new THREE.RingGeometry(0.2, 0.6, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(camera.position);
        scene.add(ring);

        let s = 1.0;
        const timer = setInterval(() => {
          s += 0.15;
          ring.scale.set(s, s, s);
          ringMat.opacity -= 0.06;
          if (ringMat.opacity <= 0) {
            clearInterval(timer);
            scene.remove(ring);
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 16);
      }

      function updateDragonBeams(delta) {
        for (let i = dragonBeams.length - 1; i >= 0; i--) {
          const b = dragonBeams[i];
          b.group.position.addScaledVector(b.dir, b.speed * delta);
          b.light.position.copy(b.group.position);
          if (b.shardGroup) {
            b.shardGroup.rotation.z += delta * 9;
            b.shardGroup.rotation.y += delta * 5;
          }

          if (!b.hit && !isPlayerDead) {
            const beamPos = b.group.position;
            const playerCenter = new THREE.Vector3(
              character.position.x,
              character.position.y + 1.0,
              character.position.z,
            );

            let minDist = Infinity;
            for (const off of [-1.2, 0, 1.2]) {
              const test = beamPos.clone().addScaledVector(b.dir, off);
              const dd = test.distanceTo(playerCenter);
              if (dd < minDist) minDist = dd;
            }

            if (minDist < DRAGON_BEAM_RADIUS) {
              b.hit = true;
              if (isDashing || isSkill2Immune) {
                spawnDodgeText();
              } else {
                damagePlayer(Math.round(b.damage), dragonObj, "ranged");
                if (b.dragonType === "fire") {
                  if (Math.random() < FIRE_BURN_CHANCE)
                    burnPlayer(FIRE_BURN_DURATION);
                  spawnIceShatter(playerCenter, 0xff8844);
                } else {
                  if (Math.random() < DRAGON_FREEZE_CHANCE)
                    freezePlayer(DRAGON_FREEZE_TIME);
                  spawnIceShatter(playerCenter, 0x9be7ff);
                }
              }
            }
          }

          b.life -= delta;
          if (b.life < 0.4) {
            const fade = Math.max(0, b.life / 0.4);
            b.group.scale.setScalar(0.3 + fade * 0.7);
            if (b.light) b.light.intensity = 2.2 * fade;
          }
          if (b.life <= 0) {
            scene.remove(b.group);
            if (b.light) scene.remove(b.light);
            b.group.traverse((n) => {
              if (n.isMesh) {
                n.geometry.dispose();
                n.material.dispose();
              }
            });
            dragonBeams.splice(i, 1);
          }
        }
      }

      function spawnDragon(type = "ice") {
        if (!dragonAsset || dragonObj) return;

        let skinned = false;
        dragonAsset.scene.traverse((n) => {
          if (n.isSkinnedMesh) skinned = true;
        });
        const mesh = skinned
          ? cloneSkinnedMesh(dragonAsset.scene)
          : dragonAsset.scene.clone(true);
        mesh.scale.setScalar(DRAGON_SCALE);
        mesh.traverse((n) => {
          if (n.isMesh) {
            n.castShadow = true;
            n.frustumCulled = false;
            if (n.material) {
              n.material = n.material.clone();
              n.material.transparent = true;
              n.material.depthWrite = true;
              if (type === "fire" && n.material.color) {
                n.material.color.setHex(0xff4433);
                if (n.material.emissive) n.material.emissive.setHex(0x552200);
              }
            }
          }
        });

        const a = Math.random() * Math.PI * 2;
        mesh.position.set(
          character.position.x + Math.sin(a) * 18,
          0,
          character.position.z + Math.cos(a) * 18,
        );
        mesh.position.y =
          getElevation(mesh.position.x, mesh.position.z) + DRAGON_FLY_HEIGHT;
        scene.add(mesh);

        const mixer = new THREE.AnimationMixer(mesh);
        const clips = (dragonAsset.animations || []).map((c) =>
          sanitizeClip(c, c.name),
        );
        const flapClip = clips[0];
        if (flapClip) {
          const act = mixer.clipAction(flapClip);
          act.setLoop(THREE.LoopRepeat);
          act.play();
        }

        const hpBar = createBatHpBar();
        hpBar.group.scale.setScalar(1.6);
        const hp = Math.round(DRAGON_HP * enemyMult());

        const d = {
          isDragon: true,
          dragonType: type,
          mesh,
          mixer,
          state: "alive",
          hp,
          maxHp: hp,
          hpBar,
          attackTimer: 0.8,
          farT: 0,
          deathT: 0,
          bobSeed: Math.random() * 100,
          attackCounter: 0,
          divePhase: null,
          diveT: 0,
          diveDir: null,
          diveHit: false,
          retreatT: 0,
        };

        dragonObj = d;
        activeBats.push(d);
        dragonFixture.radius = DRAGON_RADIUS;
        fixtures.push(dragonFixture);
        updateBatUI();
      }

      function removeDragon() {
        const d = dragonObj;
        if (!d) return;
        scene.remove(d.mesh);
        scene.remove(d.hpBar.group);
        const i = activeBats.indexOf(d);
        if (i >= 0) activeBats.splice(i, 1);
        const fi = fixtures.indexOf(dragonFixture);
        if (fi >= 0) fixtures.splice(fi, 1);

        for (let j = dragonBeams.length - 1; j >= 0; j--) {
          const b = dragonBeams[j];
          scene.remove(b.group);
          b.group.traverse((n) => {
            if (n.isMesh) {
              n.geometry.dispose();
              n.material.dispose();
            }
          });
          dragonBeams.splice(j, 1);
        }

        dragonObj = null;
        dragonCd = 15;
        updateBatUI();
      }

      function startDragonDive(d) {
        if (!d || d.state !== "alive") return;
        const M = d.mesh.position;
        const P = character.position;
        const dx = P.x - M.x;
        const dz = P.z - M.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.01) return;

        d.diveDir = new THREE.Vector3(dx / dist, 0, dz / dist);
        d.divePhase = "windup";
        d.diveT = 0;
        d.diveHit = false;
        popAt(M, "⚠ DIVE!", "crit", 2.5);
      }

      function updateDragonDive(d, delta) {
        const M = d.mesh.position;
        const P = character.position;
        const floorY = getElevation(M.x, M.z);

        d.diveT += delta;

        if (d.divePhase === "windup") {
          const targetY = floorY + DRAGON_FLY_HEIGHT + 0.8;
          M.y += (targetY - M.y) * Math.min(1, 3 * delta);
          if (d.diveT > 0.5) {
            d.divePhase = "descend";
            d.diveT = 0;
          }
        } else if (d.divePhase === "descend") {
          // 🐉 Committed-direction swoop — dodgeable by strafing perpendicular
          const step = 16 * delta;
          M.x += d.diveDir.x * step;
          M.z += d.diveDir.z * step;

          const curFloorY = getElevation(M.x, M.z);
          const targetY = curFloorY + 1.5;
          M.y += (targetY - M.y) * Math.min(1, 10 * delta);

          const dx2 = P.x - M.x;
          const dz2 = P.z - M.z;
          const dist2 = Math.hypot(dx2, dz2);

          if (!d.diveHit && dist2 < 2.5) {
            d.diveHit = true;
            if (isDashing || isSkill2Immune || isDragonFistImmune) {
              spawnDodgeText();
            } else {
              damagePlayer(Math.round(80 * enemyMult()), d, "melee");
              triggerScreenShake(0.2, 0.15);
            }
          }

          // Ends when hit lands, or after ~14.4m of travel (0.9s at 16 m/s)
          if (d.diveHit || d.diveT > 0.9) {
            d.divePhase = "low";
            d.diveT = 0;
          }
        } else if (d.divePhase === "low") {
          const targetY = floorY + 1.5;
          M.y += (targetY - M.y) * Math.min(1, 4 * delta);
          if (d.diveT > 1.2) {
            d.divePhase = "rise";
            d.diveT = 0;
          }
        } else if (d.divePhase === "rise") {
          const targetY = floorY + DRAGON_FLY_HEIGHT;
          M.y += (targetY - M.y) * Math.min(1, 4 * delta);
          if (d.diveT > 0.6) {
            d.divePhase = null;
            d.diveT = 0;
            d.diveHit = false;
            d.retreatT = 1.5;
            d.attackTimer = 1.5;
          }
        }
      }

      function dragonFrame(delta) {
        updateDragonBeams(delta);

        const d = dragonObj;
        if (!d) {
          if (
            prog.wave >= 3 &&
            !waveBossPending() &&
            !isPlayerDead &&
            dragonAsset &&
            !isTutorialActive
          ) {
            dragonCd -= delta;
            if (dragonCd <= 0) {
              // 🐉 Alternate ice / fire dragons by wave parity
              const wantFire = prog.wave % 2 === 0;
              spawnDragon(wantFire ? "fire" : "ice");
            }
          }
          return;
        }

        d.mixer.update(delta);
        const M = d.mesh.position;
        const P = character.position;

        d.hpBar.group.position.set(M.x, M.y + 1.6, M.z);
        d.hpBar.group.quaternion.copy(camera.quaternion);

        if (d.state === "dying") {
          d.deathT += delta;
          M.y -= 1.5 * delta;
          if (d.deathT > 0.6) {
            d.mesh.traverse((n) => {
              if (n.isMesh && n.material) {
                n.material.opacity = Math.max(
                  0,
                  n.material.opacity - delta * 1.2,
                );
              }
            });
          }
          if (d.deathT > 2.0) removeDragon();
          return;
        }

        const dx = P.x - M.x;
        const dz = P.z - M.z;
        const dist = Math.hypot(dx, dz);
        const toP = Math.atan2(dx, dz);

        const t = performance.now() * 0.001;
        const floorY = getElevation(M.x, M.z);
        // 🐉 Fly-height bob only when not diving — the dive controls Y itself
        if (!d.divePhase) {
          const targetY =
            floorY + DRAGON_FLY_HEIGHT + Math.sin(t * 2 + d.bobSeed) * 0.4;
          M.y += (targetY - M.y) * Math.min(1, 4 * delta);
        }

        d.mesh.rotation.y = lerpAngle(
          d.mesh.rotation.y,
          toP + DRAGON_FACING,
          Math.min(1, 3 * delta),
        );

        d.farT = dist > 18 ? d.farT + delta : Math.max(0, d.farT - 2 * delta);
        const spd = d.farT > 3.5 ? 7 + Math.min(12, (d.farT - 3.5) * 5) : 2.8;

        // 🐉 Dive state machine overrides normal movement
        if (d.divePhase) {
          updateDragonDive(d, delta);
        } else if (d.retreatT > 0) {
          // Retreat to 12m after a dive
          d.retreatT -= delta;
          if (dist < 12 && dist > 0.01) {
            M.x -= (dx / dist) * spd * 2.5 * delta;
            M.z -= (dz / dist) * spd * 2.5 * delta;
          }
        } else if (dist > 8) {
          M.x += (dx / dist) * spd * delta;
          M.z += (dz / dist) * spd * delta;
        } else if (dist < 5 && dist > 0.001) {
          M.x -= (dx / dist) * spd * 0.5 * delta;
          M.z -= (dz / dist) * spd * 0.5 * delta;
        }

        // Attack timer only runs when not diving / retreating
        if (!d.divePhase && d.retreatT <= 0) {
          d.attackTimer -= delta;
          if (
            d.attackTimer <= 0 &&
            dist <= DRAGON_ATTACK_RANGE &&
            !isPlayerDead
          ) {
            d.attackCounter = (d.attackCounter || 0) + 1;
            if (d.attackCounter % 3 === 0) {
              // 🐉 Every 3rd attack = dive instead of beam
              startDragonDive(d);
            } else {
              d.attackTimer = DRAGON_BEAM_COOLDOWN;

              const startPos = new THREE.Vector3(
                M.x + Math.sin(d.mesh.rotation.y) * 0.4,
                M.y + 0.2,
                M.z + Math.cos(d.mesh.rotation.y) * 0.4,
              );

              const lockedTarget = new THREE.Vector3(
                character.position.x,
                character.position.y + 1.0,
                character.position.z,
              );
              const dmg = Math.round(DRAGON_DMG * enemyMult());

              spawnIceCharge(
                startPos,
                lockedTarget,
                DRAGON_CHARGE_TIME,
                () => {
                  if (d.state !== "alive" || isPlayerDead) return;
                  spawnDragonBeam(startPos, lockedTarget, dmg, d.dragonType);
                },
                d.dragonType,
              );
            }
          }
        }

        for (const f of fixtures) {
          if (f === dragonFixture) continue;
          if (f.h < DRAGON_FLY_HEIGHT - 1) continue;
          const ddx = M.x - f.x;
          const ddz = M.z - f.z;
          const dd = Math.hypot(ddx, ddz);
          const min = f.radius + dragonFixture.radius;
          if (dd < min && dd > 0.001) {
            M.x = f.x + (ddx / dd) * min;
            M.z = f.z + (ddz / dd) * min;
          }
        }

        dragonFixture.x = M.x;
        dragonFixture.z = M.z;
      }
