
      // 🦇 BAT_TYPES now lives in src/data/enemies.js (exposed as window.BAT_TYPES by src/main.js)

      // 🎯 Ranged bat projectile system
      const batProjectiles = [];
      function spawnBatProjectile(from, to, dmg, color) {
        Game.audio.play("spit");
        const geo = new THREE.SphereGeometry(0.3, 10, 10);
        const mat = new THREE.MeshBasicMaterial({
          color: color || 0xb168f0,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(from);
        scene.add(mesh);
        const dir = new THREE.Vector3().subVectors(to, from).normalize();
        batProjectiles.push({
          mesh,
          dir,
          speed: 9,
          dmg,
          life: 3.0,
          hit: false,
        });
      }
      function updateBatProjectiles(dt) {
        for (let i = batProjectiles.length - 1; i >= 0; i--) {
          const p = batProjectiles[i];
          p.mesh.position.addScaledVector(p.dir, p.speed * dt);
          p.life -= dt;
          if (!p.hit && !isPlayerDead) {
            const target = new THREE.Vector3(
              character.position.x,
              character.position.y + 1.0,
              character.position.z,
            );
            if (p.mesh.position.distanceTo(target) < 1.2) {
              p.hit = true;
              if (isDashing || isSkill2Immune || isDragonFistImmune)
                spawnDodgeText();
              else damagePlayer(p.dmg, null, "ranged");
              p.life = 0;
            }
          }
          if (p.life <= 0) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            batProjectiles.splice(i, 1);
          }
        }
      }

      // 🎲 Weighted type picker based on current wave
      function pickBatType() {
        return Game.waves.pickBatType(prog.wave, Math.random());
      }

      function createBatHpBar() {
        const group = new THREE.Group();
        const bg = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 0.14),
          new THREE.MeshBasicMaterial({ color: 0x222226, depthTest: false }),
        );
        bg.renderOrder = 999;
        group.add(bg);

        const fillMat = new THREE.MeshBasicMaterial({
          color: 0x40c057,
          depthTest: false,
        });
        const fill = new THREE.Mesh(
          new THREE.PlaneGeometry(1.36, 0.1),
          fillMat,
        );
        fill.position.z = 0.01;
        fill.renderOrder = 1000;
        group.add(fill);

        scene.add(group);
        return { group, fill, fillMat };
      }

      loader.load("assets/monsters/bat/bat.glb", (gltf) => {
        batTemplate = gltf.scene;
        batTemplate.scale.set(0.8, 0.8, 0.8);
        batTemplate.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            if (node.material) {
              node.material = node.material.clone();
              node.material.transparent = true;
              node.material.opacity = 1.0;
              node.material.depthWrite = true;
              if (!node.material.userData.trueColor)
                node.material.userData.trueColor = node.material.color.getHex();
            }
          }
        });
        if (gltf.animations && gltf.animations.length > 0)
          batAnimClip = gltf.animations[0];
      });

      function spawnBatInstance(type = "normal") {
        if (!batTemplate) return;
        const cfg = BAT_TYPES[type] || BAT_TYPES.normal;
        const batMesh = cloneSkinnedMesh(batTemplate);

        const typeScale = cfg.scale || 0.8;
        batMesh.scale.set(typeScale, typeScale, typeScale);

        batMesh.traverse((n) => {
          if (n.isMesh && n.material) {
            n.material = n.material.clone();
            n.material.transparent = true;
            n.material.opacity = 1.0;
            n.material.depthWrite = true;
            if (cfg.color && n.material.color) {
              n.material.color.setHex(cfg.color);
            }
            if (cfg.glow && n.material.emissive) {
              n.material.emissive.setHex(cfg.color || 0xffdd44);
              n.material.emissiveIntensity = 0.9;
            }
          }
        });

        // 🛡️ Armored bat: visible shield sphere
        if (type === "armored") {
          const shieldGeo = new THREE.SphereGeometry(1.1, 12, 10);
          const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const shield = new THREE.Mesh(shieldGeo, shieldMat);
          batMesh.add(shield);
        }

        let mixer = null;
        if (batAnimClip) {
          mixer = new THREE.AnimationMixer(batMesh);
          mixer.clipAction(batAnimClip).play();
        }

        const hpBar = createBatHpBar();
        const angle = Math.random() * Math.PI * 2;
        const dist = 6.0 + Math.random() * 3.0;
        batMesh.position.x = character.position.x + Math.sin(angle) * dist;
        batMesh.position.z = character.position.z + Math.cos(angle) * dist;
        batMesh.position.y =
          getElevation(batMesh.position.x, batMesh.position.z) + 1.8;

        scene.add(batMesh);

        const hpMult = cfg.hpMult || 1;
        const finalHp = Math.round(
          (cfg.hp || BAT_MAX_HP) * hpMult * enemyMult(),
        );
        const dmgMult = cfg.dmgMult || 1;
        const finalDmg = Math.round((cfg.dmg || 45) * dmgMult * enemyMult());
        const finalSpecialDmg = Math.round(
          (cfg.specialDmg || 180) * dmgMult * enemyMult(),
        );

        const batObj = {
          batType: type,
          batDmg: finalDmg,
          batSpecialDmg: finalSpecialDmg,
          batSpeed: cfg.speed || 1,
          knockbackResist: cfg.knockbackResist || 0,
          explodeRadius: cfg.explodeRadius || 3.5,
          xpMult: cfg.xpMult || 1,
          mesh: batMesh,
          mixer: mixer,
          hp: finalHp,
          maxHp: finalHp,
          state: "alive",
          hpBar: hpBar,
          attackTimer: 1.5 + Math.random() * 1.0,
          isAttacking: false,
          diveY: 0,
          strafeSeed: Math.random() * 50,
          attackCount: 0,
          baseScale: typeScale,
          slowT: 0,
        };

        activeBats.push(batObj);
        updateBatUI();
      }

      function checkBatHitLanded(
        bat,
        maxRange = 2.4,
        coneAngle = 0.4,
        maxBatYDiff = 1.3,
      ) {
        if (isPlayerDead) return false;
        if (isDashing) return false; // Double-tap dash successfully evades normal attacks!

        const dx = character.position.x - bat.mesh.position.x;
        const dz = character.position.z - bat.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > maxRange) return false;

        const playerFloorY = getElevation(
          character.position.x,
          character.position.z,
        );
        const playerJumpHeight = character.position.y - playerFloorY;
        if (playerJumpHeight > maxBatYDiff) return false;

        const batFacing = new THREE.Vector3(0, 0, -1).applyQuaternion(
          bat.mesh.quaternion,
        );
        const toPlayer = new THREE.Vector3(dx, 0, dz).normalize();
        const dot = batFacing.dot(toPlayer);
        return dot >= coneAngle;
      }

      function executeBatDive(b, onFinished) {
        const toPlayer = new THREE.Vector3().subVectors(
          character.position,
          b.mesh.position,
        );
        toPlayer.y = 0;
        const currentDist = toPlayer.length();
        if (currentDist > 0.001) toPlayer.normalize();

        const safeLungeDist = Math.max(0.2, currentDist - 1.3);
        b.mesh.lookAt(
          character.position.x,
          character.position.y + 1.2,
          character.position.z,
        );
        b.mesh.rotateY(Math.PI);

        let elapsed = 0;
        const windupInterval = setInterval(() => {
          if (isGamePaused) return;
          elapsed += 0.02;
          b.diveY = Math.sin((elapsed / 0.2) * (Math.PI / 2)) * 0.7;

          if (elapsed >= 0.2) {
            clearInterval(windupInterval);
            let diveElapsed = 0;
            const diveDuration = 0.16;

            const strikeInterval = setInterval(() => {
              if (isGamePaused) return;
              diveElapsed += 0.016;
              b.diveY = 0.7 - (diveElapsed / diveDuration) * 1.3;
              b.mesh.position.addScaledVector(
                toPlayer,
                (0.016 / diveDuration) * safeLungeDist,
              );

              if (diveElapsed >= diveDuration) {
                clearInterval(strikeInterval);
                if (b.state === "alive") {
                  const hitLanded = checkBatHitLanded(b, 2.4, 0.35, 1.25);
                  if (hitLanded) damagePlayer(b.batDmg || 45, b);
                  else spawnDodgeText();
                }

                let recElapsed = 0;
                const recoverInterval = setInterval(() => {
                  if (isGamePaused) return;
                  recElapsed += 0.02;
                  b.diveY = -0.6 + (recElapsed / 0.2) * 0.6;
                  b.mesh.position.addScaledVector(toPlayer, -0.016 * 2.8);
                  b.mesh.lookAt(
                    character.position.x,
                    character.position.y + 1.2,
                    character.position.z,
                  );
                  b.mesh.rotateY(Math.PI);
                  if (recElapsed >= 0.2) {
                    clearInterval(recoverInterval);
                    b.diveY = 0;
                    onFinished();
                  }
                }, 16);
              }
            }, 16);
          }
        }, 16);
      }

      function triggerBatImpactWave(x, y, z) {
        const ringGeo = new THREE.RingGeometry(0.3, 2.4, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff1744,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y + 0.1, z);
        scene.add(ring);

        let scale = 1.0;
        const timer = setInterval(() => {
          scale += 0.45;
          ring.scale.set(scale, scale, scale);
          ring.material.opacity -= 0.08;
          if (ring.material.opacity <= 0) {
            clearInterval(timer);
            scene.remove(ring);
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 16);
      }

      function executeBatSpecialDive(b, onFinished) {
        const initialScale = b.baseScale;
        const maxTitanScale = 2.0;
        const originalColors = [];

        b.mesh.traverse((n) => {
          if (n.isMesh && n.material) {
            originalColors.push({
              mat: n.material,
              color: n.material.color.getHex(),
            });
          }
        });

        const pos = b.mesh.position.clone();
        pos.y += 1.8;
        pos.project(camera);
        if (pos.z <= 1.0) {
          const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
          const tag = document.createElement("div");
          tag.className = "damage-pop";
          tag.style.color = "#ff1744";
          tag.style.fontSize = "26px";
          tag.innerText = `⚠️ TITAN SLAM!`;
          tag.style.left = `${sx}px`;
          tag.style.top = `${sy}px`;
          document.body.appendChild(tag);
          setTimeout(() => tag.remove(), 1000);
        }

        b.mesh.traverse((n) => {
          if (n.isMesh && n.material) n.material.color.setHex(0xff1744);
        });

        // 🎯 LOCK ATTACK DIRECTION EARLY: Bat commits to where you are standing right NOW
        const lungeDir = new THREE.Vector3().subVectors(
          character.position,
          b.mesh.position,
        );
        lungeDir.y = 0;
        if (lungeDir.lengthSq() > 0.001) lungeDir.normalize();

        // Bat faces its locked strike path
        b.mesh.lookAt(
          b.mesh.position.x + lungeDir.x,
          b.mesh.position.y,
          b.mesh.position.z + lungeDir.z,
        );
        b.mesh.rotateY(Math.PI);

        let growElapsed = 0;
        const growDuration = 0.9;

        const growInterval = setInterval(() => {
          if (isGamePaused) return;
          growElapsed += 0.02;
          const progress = Math.min(1.0, growElapsed / growDuration);
          const currentScale =
            initialScale +
            (maxTitanScale - initialScale) * Math.sin(progress * (Math.PI / 2));
          b.mesh.scale.set(currentScale, currentScale, currentScale);
          b.diveY = progress * 0.5;

          if (progress >= 1.0) {
            clearInterval(growInterval);

            let diveElapsed = 0;
            const diveDuration = 0.38;
            const totalDistance = 5.5;
            let hasDealtDamage = false;

            const diveInterval = setInterval(() => {
              if (isGamePaused) return;
              diveElapsed += 0.016;
              const diveProgress = Math.min(1.0, diveElapsed / diveDuration);

              const currentScale =
                maxTitanScale - (maxTitanScale - initialScale) * diveProgress;
              b.mesh.scale.set(currentScale, currentScale, currentScale);
              b.diveY = 0.5 - diveProgress * 1.5;
              b.mesh.position.addScaledVector(
                lungeDir,
                (0.016 / diveDuration) * totalDistance,
              );

              if (!hasDealtDamage && b.state === "alive") {
                const toPlayer = new THREE.Vector3().subVectors(
                  character.position,
                  b.mesh.position,
                );
                toPlayer.y = 0;
                const horizontalDist = toPlayer.length();
                const playerFloorY = getElevation(
                  character.position.x,
                  character.position.z,
                );
                const playerJumpHeight = character.position.y - playerFloorY;
                const isVaultingOver = playerJumpHeight > 0.6;
                const isFacingPlayer = toPlayer.normalize().dot(lungeDir) > 0.2;

                // If you strafe-dash (isDashing) or jump over, you DODGE!
                if (
                  horizontalDist <= 1.35 &&
                  isFacingPlayer &&
                  !isVaultingOver &&
                  !isDashing
                ) {
                  hasDealtDamage = true;
                  damagePlayer(b.batSpecialDmg || 180, b);
                  triggerScreenShake(0.45, 0.25);
                  triggerBatImpactWave(
                    character.position.x,
                    playerFloorY,
                    character.position.z,
                  );
                }
              }

              if (diveProgress >= 1.0) {
                clearInterval(diveInterval);
                b.mesh.scale.set(initialScale, initialScale, initialScale);

                if (!hasDealtDamage && b.state === "alive") {
                  spawnDodgeText();
                  const floorY = getElevation(
                    b.mesh.position.x,
                    b.mesh.position.z,
                  );
                  triggerBatImpactWave(
                    b.mesh.position.x,
                    floorY,
                    b.mesh.position.z,
                  );
                }

                let recElapsed = 0;
                const recInterval = setInterval(() => {
                  if (isGamePaused) return;
                  recElapsed += 0.02;
                  b.diveY = -1.0 + (recElapsed / 0.4) * 1.0;

                  if (recElapsed >= 0.4) {
                    clearInterval(recInterval);
                    b.diveY = 0;
                    b.mesh.scale.set(initialScale, initialScale, initialScale);
                    originalColors.forEach((item) =>
                      item.mat.color.setHex(item.color),
                    );
                    onFinished();
                  }
                }, 16);
              }
            }, 16);
          }
        }, 20);
      }

      const batClock = new THREE.Clock();
      function updateBatFrame() {
        requestAnimationFrame(updateBatFrame);
        if (isNameModalOpen || isGamePaused) return;

        const bDelta = Math.min(batClock.getDelta(), 0.08);
        gameSurvivalTime += bDelta;
        updateBatProjectiles(bDelta);

        const maxBats = isTutorialActive
          ? 0
          : bossActive() || waveBossPending()
            ? 0
            : Math.min(10, 4 + Math.floor((prog.wave - 1) / 1.0));
        batSpawnCooldown -= bDelta;
        const currentAlive = activeBats.filter(
          (b) => b.state === "alive" && !b.isBoss && !b.isDragon,
        ).length;

        if (batSpawnCooldown <= 0 && currentAlive < maxBats && batTemplate) {
          const type = pickBatType();
          if (type === "swarm") {
            const toSpawn = Math.min(3, maxBats - currentAlive);
            for (let i = 0; i < toSpawn; i++) spawnBatInstance("swarm");
            batSpawnCooldown = 4.0 + Math.random() * 1.5;
          } else {
            spawnBatInstance(type);
            batSpawnCooldown = 2.1 + Math.random() * 1.2;
          }
        }

        const t = performance.now() * 0.0025;

        for (let i = activeBats.length - 1; i >= 0; i--) {
          const b = activeBats[i];
          if (b.isBoss || b.isDragon) continue;
          if (b.mixer) b.mixer.update(bDelta);

          // 🎓 Tutorial dummy: hover in place, face the player, never attack
          if (b.isTutorialDummy) {
            b.mesh.position.y =
              getElevation(b.mesh.position.x, b.mesh.position.z) +
              1.8 +
              Math.sin(t * 3) * 0.2;
            b.mesh.lookAt(
              character.position.x,
              character.position.y + 1.2,
              character.position.z,
            );
            b.mesh.rotateY(Math.PI);
            continue;
          }

          // 🐍 Poison DoT tick
          tickPoison(b, bDelta);
          // 🔥 Chakra burn tick + ❄️ slow timer
          tickBurn(b, bDelta);
          if (b.slowT > 0) b.slowT -= bDelta;

          // 🏹 Ranged bat AI: keep distance, fire projectiles
          if (b.batType === "ranged" && b.state === "alive") {
            b.mesh.position.y =
              getElevation(b.mesh.position.x, b.mesh.position.z) +
              2.2 +
              Math.sin(t * 2.5 + b.strafeSeed) * 0.3;
            b.hpBar.group.position.set(
              b.mesh.position.x,
              b.mesh.position.y + 1.0,
              b.mesh.position.z,
            );
            b.hpBar.group.quaternion.copy(camera.quaternion);

            const dist = b.mesh.position.distanceTo(character.position);
            const toP = new THREE.Vector3().subVectors(
              character.position,
              b.mesh.position,
            );
            toP.y = 0;
            if (toP.lengthSq() > 0.001) toP.normalize();
            b.mesh.lookAt(
              character.position.x,
              character.position.y + 1.2,
              character.position.z,
            );
            b.mesh.rotateY(Math.PI);

            if (dist > 14) {
              b.mesh.position.addScaledVector(toP, 3.0 * bDelta);
            } else if (dist < 10) {
              b.mesh.position.addScaledVector(toP, -3.0 * bDelta);
            } else {
              // strafe hover
              const side = new THREE.Vector3(-toP.z, 0, toP.x);
              b.mesh.position.addScaledVector(
                side,
                Math.sin(t * 2 + b.strafeSeed) * 1.5 * bDelta,
              );
            }

            b.attackTimer -= bDelta;
            if (b.attackTimer <= 0 && dist <= 15 && !isPlayerDead) {
              b.attackTimer = 1.8;
              const muzzle = b.mesh.position.clone();
              muzzle.y += 0.2;
              const target = character.position.clone();
              target.y += 1.0;
              spawnBatProjectile(muzzle, target, b.batDmg, 0xb168f0);
            }
            continue;
          }

          // 💥 Exploder bat AI: charge & self-destruct
          if (b.batType === "exploder" && b.state === "alive") {
            b.mesh.position.y =
              getElevation(b.mesh.position.x, b.mesh.position.z) +
              1.6 +
              Math.sin(t * 4 + b.strafeSeed) * 0.25 +
              b.diveY;
            b.hpBar.group.position.set(
              b.mesh.position.x,
              b.mesh.position.y + 1.0,
              b.mesh.position.z,
            );
            b.hpBar.group.quaternion.copy(camera.quaternion);

            const dist = b.mesh.position.distanceTo(character.position);
            const toP = new THREE.Vector3().subVectors(
              character.position,
              b.mesh.position,
            );
            toP.y = 0;
            if (toP.lengthSq() > 0.001) toP.normalize();

            if (dist < 2.8 && !isPlayerDead) {
              // 💥 BOOM
              Game.audio.play("boom");
              const radius = b.explodeRadius;
              const dxp = character.position.x - b.mesh.position.x;
              const dzp = character.position.z - b.mesh.position.z;
              if (Math.hypot(dxp, dzp) < radius) {
                if (isDashing || isSkill2Immune || isDragonFistImmune)
                  spawnDodgeText();
                else damagePlayer(b.batDmg, b, "melee");
              }
              triggerBatImpactWave(
                b.mesh.position.x,
                getElevation(b.mesh.position.x, b.mesh.position.z),
                b.mesh.position.z,
              );
              triggerScreenShake(0.3, 0.2);
              b.hp = 0;
              b.state = "dying";
              if (b.hpBar && b.hpBar.group) b.hpBar.group.visible = false;
              onEnemyKilled(b);
              continue;
            }
            // aggressive approach
            b.mesh.position.addScaledVector(toP, 3.2 * bDelta);
            continue;
          }

          if (b.state === "alive") {
            b.mesh.position.y =
              getElevation(b.mesh.position.x, b.mesh.position.z) +
              1.6 +
              Math.sin(t * 3 + b.strafeSeed) * 0.35 +
              b.diveY;
            b.hpBar.group.position.set(
              b.mesh.position.x,
              b.mesh.position.y + 1.2 * (b.mesh.scale.y / 0.8),
              b.mesh.position.z,
            );
            b.hpBar.group.quaternion.copy(camera.quaternion);

            if (!b.isAttacking) {
              b.mesh.lookAt(
                character.position.x,
                character.position.y + 1.2,
                character.position.z,
              );
              b.mesh.rotateY(Math.PI);
            }

            const dist = b.mesh.position.distanceTo(character.position);

            if (dist < 4.5 && !b.isAttacking) {
              const toPlayer = new THREE.Vector3()
                .subVectors(character.position, b.mesh.position)
                .normalize();
              const sideVector = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
              const strafeMotion = Math.sin(t * 2.2 + b.strafeSeed);
              b.mesh.position.addScaledVector(
                sideVector,
                strafeMotion * 1.6 * bDelta,
              );
            }

            if (dist > 2.0 && !b.isAttacking) {
              const approach = new THREE.Vector3()
                .subVectors(character.position, b.mesh.position)
                .normalize();
              const slowMult = b.slowT > 0 ? 0.5 : 1;
              b.mesh.position.addScaledVector(
                approach,
                batChaseSpeed(b, dist, bDelta) * slowMult * bDelta,
              );
            }

            b.attackTimer -= bDelta;
            if (
              dist <= 4.0 &&
              b.attackTimer <= 0 &&
              !b.isAttacking &&
              !isPlayerDead
            ) {
              b.isAttacking = true;
              b.attackCount++;

              if (b.attackCount % 3 === 0) {
                executeBatSpecialDive(b, () => {
                  b.isAttacking = false;
                  b.attackTimer = 2.6;
                });
              } else {
                executeBatDive(b, () => {
                  setTimeout(() => {
                    if (b.state === "alive" && !isPlayerDead && !isGamePaused) {
                      executeBatDive(b, () => {
                        b.isAttacking = false;
                        b.attackTimer = 2.2;
                      });
                    } else {
                      b.isAttacking = false;
                      b.attackTimer = 2.2;
                    }
                  }, 380);
                });
              }
            }
          } else if (b.state === "dying") {
            let minOpacity = 1.0;
            b.mesh.traverse((n) => {
              if (n.isMesh && n.material) {
                n.material.opacity -= 1.8 * bDelta;
                if (n.material.opacity < minOpacity)
                  minOpacity = n.material.opacity;
              }
            });

            if (minOpacity <= 0) {
              scene.remove(b.mesh);
              scene.remove(b.hpBar.group);
              activeBats.splice(i, 1);
              updateBatUI();
            }
          }
        }
      }
      updateBatFrame();
