
      // 🐉 Dragon Fist finisher — slow, heavy, high-damage, lifesteal
      function triggerDragonFist() {
        if (isSpecialActive || isDashing || isPlayerDead || isFrozen) return;
        if (!actions.punch) return;

        prog.dragonFistCount = 0;
        isPunching = true;
        isSpecialActive = false;
        isDragonFistImmune = true;
        punchToken++;
        const tok = punchToken;
        punchStartTime = performance.now();
        punchRecoverMs = 900; // heavy commitment

        autoFaceNearestEnemy(14);

        if (currentAction === actions.punch) currentAction = null;
        playAction("punch", 0.0, 0.8); // slow-mo heavy swing

        // Gold charge ring at feet
        const chargeRingGeo = new THREE.RingGeometry(0.5, 1.5, 32);
        chargeRingGeo.rotateX(-Math.PI / 2);
        const chargeRingMat = new THREE.MeshBasicMaterial({
          color: 0xffd43b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const chargeRing = new THREE.Mesh(chargeRingGeo, chargeRingMat);
        chargeRing.position.set(
          character.position.x,
          character.position.y + 0.15,
          character.position.z,
        );
        scene.add(chargeRing);

        // 💛 Yellow invulnerability aura
        const auraMat = new THREE.MeshBasicMaterial({
          color: 0xffd700,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide,
        });
        const aura = new THREE.Mesh(
          new THREE.SphereGeometry(1.1, 20, 20),
          auraMat,
        );
        aura.position.set(
          character.position.x,
          character.position.y + 1.2,
          character.position.z,
        );
        scene.add(aura);
        const auraLight = new THREE.PointLight(0xffd700, 3.5, 6);
        auraLight.position.copy(aura.position);
        scene.add(auraLight);
        setTimeout(() => {
          scene.remove(aura);
          scene.remove(auraLight);
          auraMat.dispose();
        }, 420);

        let crs = 1.0;
        const crTimer = setInterval(() => {
          crs += 0.03;
          chargeRing.scale.set(crs, 1, crs);
          chargeRingMat.opacity -= 0.022;
          if (chargeRingMat.opacity <= 0) {
            clearInterval(crTimer);
            scene.remove(chargeRing);
            chargeRingGeo.dispose();
            chargeRingMat.dispose();
          }
        }, 16);

        // Impact frame at 400ms into the animation
        setTimeout(() => {
          if (punchToken !== tok) {
            isDragonFistImmune = false;
            return;
          }
          if (isPlayerDead) {
            isDragonFistImmune = false;
            return;
          }

          const fwd = new THREE.Vector3(
            Math.sin(character.rotation.y),
            0,
            Math.cos(character.rotation.y),
          );
          const impactPos = character.position
            .clone()
            .addScaledVector(fwd, 1.5);
          impactPos.y += 1.2;

          spawnLightExplosion(impactPos, 0xffffff, 4.5, 500);
          triggerScreenShake(0.5, 0.3);

          const DMG = 210;
          let totalHeal = 0;
          const coneDir = new THREE.Vector2(fwd.x, fwd.z);
          for (const b of activeBats) {
            if (b.state !== "alive") continue;
            const dx = b.mesh.position.x - character.position.x;
            const dz = b.mesh.position.z - character.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 3.5 + bodyR(b)) continue;
            if (dist >= 0.01) {
              const toBat = new THREE.Vector2(dx, dz).normalize();
              if (toBat.dot(coneDir) < 0.0) continue;
            }
            const dmg = rollDamage(DMG);
            damageBat(b, dmg, "crit", 4.0);
            totalHeal += dmg;
          }

          if (totalHeal > 0) {
            const cappedHeal = Math.min(
              totalHeal,
              Math.round(PLAYER_MAX_HP * 0.5),
            );
            playerHP = Math.min(PLAYER_MAX_HP, playerHP + cappedHeal);
            updatePlayerUI();
            spawnHealNumber(cappedHeal);
            popAt(character.position, "🐉 DRAGON FIST!", "crit", 3.0);
          } else {
            popAt(character.position, "DRAGON FIST! (miss)", "miss", 3.0);
          }

          const flash = document.createElement("div");
          flash.style.cssText =
            "position:fixed;inset:0;background:rgba(255,240,180,0.55);pointer-events:none;z-index:998;opacity:1;transition:opacity 0.18s;";
          document.body.appendChild(flash);
          setTimeout(() => (flash.style.opacity = "0"), 80);
          setTimeout(() => flash.remove(), 350);
        }, 400);

        setTimeout(() => {
          isDragonFistImmune = false;
        }, 400);
      }

      // 🎯 Directional Cone Magnet (Industry Standard for 3D Action Games)
      function autoFaceNearestEnemy(maxRange = 14) {
        let target = null;
        let bestScore = -999;

        // Camera forward direction
        const aimAngle = yaw + Math.PI;
        const camForward = new THREE.Vector2(
          Math.sin(aimAngle),
          Math.cos(aimAngle),
        );

        if (activeBats && activeBats.length > 0) {
          for (const b of activeBats) {
            if (b.state !== "alive") continue;

            const dx = b.mesh.position.x - character.position.x;
            const dz = b.mesh.position.z - character.position.z;
            const dist = Math.hypot(dx, dz);

            if (dist <= maxRange) {
              const toEnemy = new THREE.Vector2(dx, dz).normalize();
              const dot = camForward.dot(toEnemy); // 1.0 = directly center screen, 0 = 90 deg side, -1 = behind

              // Only snap if the enemy is in front of the camera view (> 0.25 is ~150° forward cone)
              // Or if the enemy is in point-blank melee range (< 2.8m)
              if (dot > 0.25 || dist < 2.8) {
                // Prioritize enemies that are both in your view and close to you
                const score = dot * 2.0 - dist / maxRange;
                if (score > bestScore) {
                  bestScore = score;
                  target = b;
                }
              }
            }
          }
        }

        if (target) {
          // Soft-snap ninja directly towards the intended target
          const dx = target.mesh.position.x - character.position.x;
          const dz = target.mesh.position.z - character.position.z;
          character.rotation.y = Math.atan2(dx, dz);
        } else {
          // If no enemy is in your cone, attack strictly where your crosshair aims (attacks CAN miss)
          character.rotation.y = aimAngle;
        }
      }

      function triggerSkillElectricKick() {
        // Can interrupt normal punch, but CANNOT interrupt Ability 1
        if (
          isSpecialActive ||
          isPlayerDead ||
          isFrozen ||
          skill2Cooldown > 0 ||
          !actions.kickElectric
        )
          return;

        punchToken++; // Cancels any pending normal punch damage
        isPunching = true;
        isSpecialActive = true;
        isSkill2Immune = true; // ⚡ Become fully immune to damage during Thunder Kick
        isComboSteering = false;

        // 🎯 Smart Skill-Shot:
        if (touchJoyVector && touchJoyVector.active) {
          // If pushing joystick: fire in joystick run direction
          character.rotation.y =
            Math.atan2(touchJoyVector.x, touchJoyVector.y) + yaw;
        } else if (!("ontouchstart" in window)) {
          // Desktop (mouse): fire strictly at crosshair
          character.rotation.y = yaw + Math.PI;
        }
        // On mobile without joystick: keeps current body facing direction!

        const cdMult = prog.chakraOverload ? prog.cdMult * 1.5 : prog.cdMult;
        skill2Cooldown = SKILL2_MAX_CD * cdMult;
        updateSkillUI();

        playAction("kickElectric", 0.0, 1.5);

        // ⚡ Storm Lance: ranged version — no dash, no jump, forward bolt
        if (prog.stormLance) {
          setTimeout(() => {
            const fwd = new THREE.Vector3(
              Math.sin(character.rotation.y),
              0,
              Math.cos(character.rotation.y),
            );
            const startPos = character.position.clone();
            startPos.y += 1.2;
            const endPos = startPos.clone().addScaledVector(fwd, 14);

            // Cyan beam VFX
            const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 14, 12);
            beamGeo.rotateX(Math.PI / 2);
            beamGeo.translate(0, 0, 7);
            const beamMat = new THREE.MeshBasicMaterial({
              color: 0x00ffff,
              transparent: true,
              opacity: 0.85,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.copy(startPos);
            beam.lookAt(endPos);
            scene.add(beam);
            let beamOp = 0.85;
            const beamTimer = setInterval(() => {
              beamOp -= 0.06;
              beamMat.opacity = beamOp;
              if (beamOp <= 0) {
                clearInterval(beamTimer);
                scene.remove(beam);
                beamGeo.dispose();
                beamMat.dispose();
              }
            }, 16);

            // Corridor damage: 14m long, 2.5m wide
            const _rai =
              (prog.raitonMult || 1) * (prog.chakraOverload ? 2.0 : 1.0);
            const corridorWidth = 2.5;
            const corridorLength = 14;
            for (const b of activeBats) {
              if (b.state !== "alive") continue;
              const toBat = new THREE.Vector3().subVectors(
                b.mesh.position,
                character.position,
              );
              toBat.y = 0;
              const forwardDist = toBat.dot(fwd);
              if (forwardDist < 0 || forwardDist > corridorLength) continue;
              const lateral = toBat
                .clone()
                .sub(fwd.clone().multiplyScalar(forwardDist))
                .length();
              if (lateral > corridorWidth + bodyR(b)) continue;

              const isCrit = Math.random() < 0.1;
              const baseDmg = rollDamage(420 * _rai, prog.skillDmgMult);
              const dmg = isCrit
                ? Math.round(baseDmg * 3 * (1 + prog.critDmgBonus))
                : baseDmg;
              damageBat(b, dmg, isCrit ? "electric-crit" : "electric", 2.0);
              applyChakraBurn(b, dmg);
              tryBloodFistHeal(dmg);
            }

            // Screen flash + shake
            const flash = document.getElementById("electric-flash");
            if (flash) {
              flash.classList.add("electric-flash-active");
              setTimeout(
                () => flash.classList.remove("electric-flash-active"),
                120,
              );
            }
            triggerScreenShake(0.25, 0.15);
          }, 200);

          // Invuln ends after 1.2s
          setTimeout(() => {
            isSkill2Immune = false;
          }, 1200);
          return; // Skip melee path entirely
        }

        const hitBats = new Set(); // Keeps track of bats we already hit

        setTimeout(() => {
          isLightningActive = true;
          lightningIntensity = 1.0;
          velocityY = 7.0;
          isGrounded = false;
          smoothForwardGlide(6.5, 380, 18);
        }, 178);

        // Continuous pass-through damage check
        const checkInterval = setInterval(() => {
          if (isGamePaused || isPlayerDead) return;
          lightningIntensity = 2.6;

          const forward = new THREE.Vector2(
            Math.sin(character.rotation.y),
            Math.cos(character.rotation.y),
          );
          for (const b of activeBats) {
            if (b.state !== "alive" || hitBats.has(b)) continue;

            const dx = b.mesh.position.x - character.position.x;
            const dz = b.mesh.position.z - character.position.z;
            const dist = Math.hypot(dx, dz);

            // If the bat is within our 3.5m path
            if (dist <= 3.5 + bodyR(b)) {
              const toBat = new THREE.Vector2(dx, dz).normalize();
              const dot = toBat.dot(forward);
              if (dot >= -0.2) {
                // Hits anything in front/side of us
                if (Math.random() < 0.08) {
                  spawnBatMissText(b);
                } else {
                  // ⚡ 10% Chance for 3x Critical Damage
                  const isCrit = Math.random() < 0.1;
                  const _rai =
                    (prog.raitonMult || 1) * (prog.chakraOverload ? 2.0 : 1.0);
                  const baseDmg =
                    dot >= 0.5
                      ? rollDamage(420 * _rai, prog.skillDmgMult)
                      : rollDamage(210 * _rai, prog.skillDmgMult);
                  const dmg = isCrit
                    ? Math.round(baseDmg * 3 * (1 + prog.critDmgBonus))
                    : baseDmg;

                  if (isCrit) {
                    triggerScreenShake(0.35, 0.2); // Extra impact shake on crit
                  }

                  damageBat(
                    b,
                    dmg,
                    isCrit ? "electric-crit" : "electric",
                    dot >= 0.5 ? 8.0 : 3.5,
                  );
                  applyChakraBurn(b, dmg);
                  tryBloodFistHeal(dmg);
                }
                hitBats.add(b); // Mark as hit so we don't hit them again
              }
            }
          }
        }, 30); // Check every 30ms while flying

        setTimeout(() => {
          clearInterval(checkInterval);
        }, 600);
        setTimeout(() => {
          lightningIntensity = 0.5;
        }, 444);
        setTimeout(() => {
          // Final impact screen flash when the kick ends
          const screenFlash = document.getElementById("electric-flash");
          if (screenFlash) {
            screenFlash.classList.add("electric-flash-active");
            setTimeout(
              () => screenFlash.classList.remove("electric-flash-active"),
              100,
            );
          }
        }, 400);
        setTimeout(() => {
          isLightningActive = false;
          isSkill2Immune = false; // Immunity ends when the kick finishes
        }, 844);
      }

      function triggerSkillCombo() {
        // Can interrupt normal punch, but CANNOT interrupt Ability 2
        if (
          isSpecialActive ||
          isPlayerDead ||
          isFrozen ||
          skill1Cooldown > 0 ||
          !actions.punchCombo
        )
          return;

        punchToken++; // Cancels any pending normal punch damage
        isPunching = true;
        isSpecialActive = true;
        isComboSteering = true;

        // 🎯 Smart Skill-Shot:
        if (touchJoyVector && touchJoyVector.active) {
          // If pushing joystick: fire in joystick run direction
          character.rotation.y =
            Math.atan2(touchJoyVector.x, touchJoyVector.y) + yaw;
        } else if (!("ontouchstart" in window)) {
          // Desktop (mouse): fire strictly at crosshair
          character.rotation.y = yaw + Math.PI;
        }
        // On mobile without joystick: keeps current body facing direction!

        const cdMult = prog.chakraOverload ? prog.cdMult * 1.5 : prog.cdMult;
        skill1Cooldown = SKILL1_MAX_CD * cdMult;
        updateSkillUI();

        const _sdm = prog.skillDmgMult * (prog.chakraOverload ? 2.0 : 1.0);
        const _cdb = 1 + prog.critDmgBonus;
        playAction("punchCombo", 0.0, 1.5);
        if (!prog.flurryRanged) {
          setTimeout(() => {
            smoothForwardGlide(4.5, 840, 22);
          }, 222);
        }
        const _comboHit = () => {
          triggerScreenShake(0.08, 0.08);
          if (prog.flurryRanged) {
            tryHitBatCone(50 * _sdm, 12, 0.2);
            spawnChakraWave(0x00f0ff);
          } else {
            tryHitBat(70 * _sdm, false, true);
          }
        };
        setTimeout(_comboHit, 356);
        setTimeout(_comboHit, 467);
        setTimeout(_comboHit, 622);

        // Final hit — 30% chance to CRIT with a light explosion
        setTimeout(() => {
          if (prog.flurryRanged) {
            // Ranged finisher: crit-check on cone
            const fwd2 = new THREE.Vector2(
              Math.sin(character.rotation.y),
              Math.cos(character.rotation.y),
            );
            const anyBatInCone = activeBats.some((b) => {
              if (b.state !== "alive") return false;
              const dx = b.mesh.position.x - character.position.x;
              const dz = b.mesh.position.z - character.position.z;
              const dist = Math.hypot(dx, dz);
              if (dist > 14 + bodyR(b)) return false;
              if (dist < 0.01) return true;
              return new THREE.Vector2(dx, dz).normalize().dot(fwd2) >= 0.0;
            });
            const isComboCrit = anyBatInCone && Math.random() < 0.3;
            if (isComboCrit) {
              triggerScreenShake(0.3, 0.18);
              const goldFlash = document.createElement("div");
              goldFlash.style.cssText =
                "position:fixed;inset:0;background:rgba(255,220,100,0.45);pointer-events:none;z-index:998;opacity:1;transition:opacity 0.14s;";
              document.body.appendChild(goldFlash);
              setTimeout(() => {
                goldFlash.style.opacity = "0";
              }, 70);
              setTimeout(() => goldFlash.remove(), 260);
              tryHitBatCone(150 * _sdm * _cdb, 14, 0.0);
              spawnChakraWave(0xffd43b);
            } else {
              triggerScreenShake(0.18, 0.12);
              tryHitBatCone(50 * _sdm, 12, 0.2);
              spawnChakraWave(0x00f0ff);
            }
          } else {
            // Melee finisher (original behavior)
            const anyBatInRange = activeBats.some((b) => {
              if (b.state !== "alive") return false;
              const dx = b.mesh.position.x - character.position.x;
              const dz = b.mesh.position.z - character.position.z;
              return Math.hypot(dx, dz) <= 4.8;
            });
            const isComboCrit = anyBatInRange && Math.random() < 0.3;

            if (isComboCrit) {
              triggerScreenShake(0.3, 0.18);
              const fwd = new THREE.Vector3(
                Math.sin(character.rotation.y),
                0,
                Math.cos(character.rotation.y),
              );
              const impactPos = character.position
                .clone()
                .addScaledVector(fwd, 1.7);
              impactPos.y += 1.2;
              spawnLightExplosion(impactPos, 0xffd43b, 3.0, 420);

              const goldFlash = document.createElement("div");
              goldFlash.style.cssText =
                "position:fixed;inset:0;background:rgba(255,220,100,0.45);pointer-events:none;z-index:998;opacity:1;transition:opacity 0.14s;";
              document.body.appendChild(goldFlash);
              setTimeout(() => {
                goldFlash.style.opacity = "0";
              }, 70);
              setTimeout(() => goldFlash.remove(), 260);

              tryHitBat(210 * _sdm * _cdb, true, true);
            } else {
              triggerScreenShake(0.18, 0.12);
              tryHitBat(70 * _sdm, false, true);
            }
          }
        }, 733);
      }

      // ── Mage helpers ──
      function getChannelTime() {
        return prog.flowTrance ? 2.0 : HEAL_TIME;
      }

      function tryHitBatCone(baseDmg, range = 12, minDot = 0.2) {
        if (!activeBats || activeBats.length === 0) return;
        const fwd = new THREE.Vector2(
          Math.sin(character.rotation.y),
          Math.cos(character.rotation.y),
        );
        for (const b of activeBats) {
          if (b.state !== "alive") continue;
          const dx = b.mesh.position.x - character.position.x;
          const dz = b.mesh.position.z - character.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > range + bodyR(b)) continue;
          if (dist < 0.01) {
            // extremely close, hit anyway
          } else {
            const toBat = new THREE.Vector2(dx, dz).normalize();
            if (toBat.dot(fwd) < minDot) continue;
          }
          const dmg = rollDamage(baseDmg);
          damageBat(b, dmg, "combo", 0.9);
          applyPoison(b, dmg);
          applyChakraBurn(b, dmg);
          // 🩸 Flurry combo self-heal — matches the melee path's hardcoded 15%
          if (!isPlayerDead) {
            const healAmount = Math.max(1, Math.round(dmg * 0.15));
            playerHP = Math.min(PLAYER_MAX_HP, playerHP + healAmount);
            updatePlayerUI();
            spawnHealNumber(healAmount);
          }
          tryBloodFistHeal(dmg);
        }
      }

      function spawnChakraWave(color = 0x00f0ff) {
        const fwd = new THREE.Vector3(
          Math.sin(character.rotation.y),
          0,
          Math.cos(character.rotation.y),
        );
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const ringGeo = new THREE.RingGeometry(0.3, 1.5, 24);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
              color,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.85,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            const dist = 1.5 + i * 2.5;
            ring.position.copy(character.position).addScaledVector(fwd, dist);
            ring.position.y += 1.0;
            scene.add(ring);
            let s = 1.0;
            const timer = setInterval(() => {
              s += 0.15;
              ring.scale.set(s, 1, s);
              ringMat.opacity -= 0.09;
              if (ringMat.opacity <= 0) {
                clearInterval(timer);
                scene.remove(ring);
                ringGeo.dispose();
                ringMat.dispose();
              }
            }, 16);
          }, i * 35);
        }
      }

      // Punches can be chained as soon as the hit has landed (no waiting for the
      // full animation). Clicks pressed slightly too early are buffered.
      let punchStartTime = 0;
      let punchRecoverMs = 230;
      let punchBufferedAt = 0;
      // 🎯 Crit internal cooldown — prevents crit spam when the punch rate is high
      let lastCritTime = 0;
      const CRIT_MIN_INTERVAL = 400; // ms between two critical hits

      function triggerPunch() {
        // 🐉 Dragon Fist: if charged, consume and fire the finisher
        if (prog.dragonFist && (prog.dragonFistCount || 0) >= 15) {
          triggerDragonFist();
          return;
        }

        if (isSpecialActive || isDashing || isPlayerDead || isFrozen) return;
        if (isPunching && performance.now() - punchStartTime < punchRecoverMs) {
          punchBufferedAt = performance.now();
          return;
        }

        autoFaceNearestEnemy(12);
        let isCrit = Math.random() < prog.critChance;
        let phantomBonus = 0;
        if (prog.phantomCritReady) {
          isCrit = true;
          phantomBonus = 0.5; // +50% crit damage from Phantom's Grace
          prog.phantomCritReady = false;
        }
        let punchAnim = "punch";

        if (isCrit && actions.punchCrit) {
          punchAnim = "punchCrit";
          punchComboCount = 0;
        } else {
          punchComboCount++;
          if (punchComboCount % 3 === 0 && actions.punchLeft)
            punchAnim = "punchLeft";
          else punchAnim = "punch";
        }

        if (!actions[punchAnim]) return;

        // 🥋 Multi-strike tiers — one click fires N hits at high attack speed
        let punchesPerClick = 1;
        let perPunchDmg = 1.0;
        let recoveryFloor = 70;
        let mult = prog.punchSpeedMult;
        if (isBerserkerActive()) mult *= 0.8; // 🔥 +20% attack speed
        if (mult < 0.42) {
          punchesPerClick = 3;
          perPunchDmg = 0.65;
          recoveryFloor = 170;
        } else if (mult < 0.6) {
          punchesPerClick = 2;
          perPunchDmg = 0.75;
          recoveryFloor = 180;
        }

        isPunching = true;
        isSpecialActive = false;
        punchToken++;
        const currentPunchToken = punchToken;
        punchStartTime = performance.now();
        const baseRecovery = punchAnim === "punchCrit" ? 320 : 240;
        punchRecoverMs = Math.max(recoveryFloor, baseRecovery * mult);
        if (currentAction === actions[punchAnim]) currentAction = null;
        playAction(punchAnim, 0.0, 4.2);

        if (punchAnim === "punchCrit") {
          playerStepForward(1.2);
          setTimeout(() => {
            if (punchToken !== currentPunchToken) return;
            triggerScreenShake(0.26, 0.18);
            tryHitBat(
              280 *
                perPunchDmg *
                punchesPerClick *
                (1 + prog.critDmgBonus + phantomBonus),
              true,
            );
          }, 150);
        } else {
          playerStepForward(0.65);
          triggerScreenShake(0.06, 0.06);
          const delayBase = 125;
          const delayGap = Math.max(
            20,
            (recoveryFloor - delayBase) / punchesPerClick,
          );
          for (let i = 0; i < punchesPerClick; i++) {
            const delay = delayBase + i * delayGap;
            setTimeout(() => {
              if (punchToken !== currentPunchToken) return;
              tryHitBat(70 * perPunchDmg, false);
            }, delay);
          }
        }

        // 🌀 Clone Jutsu — every 4s, a phantom strike follows your punch
        if (
          prog.cloneJutsu &&
          performance.now() >= (prog.cloneReadyAt || 0) &&
          !isPlayerDead
        ) {
          prog.cloneReadyAt = performance.now() + 4000;
          setTimeout(() => {
            if (punchToken !== currentPunchToken || isPlayerDead) return;
            let nearest = null,
              bestDist = 6.5;
            for (const cb of activeBats) {
              if (cb.state !== "alive" || cb.isTutorialDummy) continue;
              const d = cb.mesh.position.distanceTo(character.position);
              if (d < bestDist) {
                bestDist = d;
                nearest = cb;
              }
            }
            if (nearest) {
              const cloneDmg = Math.round(rollDamage(70 * perPunchDmg) * 0.3);
              // Cyan phantom burst
              const burstPos = nearest.mesh.position.clone();
              burstPos.y += 1.0;
              spawnLightExplosion(burstPos, 0x00f0ff, 2.0, 280);
              damageBat(nearest, cloneDmg, "combo", 0.6);
              popAt(nearest.mesh.position, "CLONE 🌀", "", 2.2, "#00f0ff");
            }
          }, 180);
        }
      }
