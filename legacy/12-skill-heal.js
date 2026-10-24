
      // ---------- Skill 3: Healing Trance ----------
      const SKILL3_MAX_CD = 20,
        HEAL_TIME = 3.0;
      let skill3Cooldown = 0,
        isHealing = false,
        healT = 0,
        healTickT = 0,
        totalHealedThisTrance = 0,
        totalIntendedHeal = 0;
      const healVFX = { group: new THREE.Group(), streaks: [] };
      const STREAK_COUNT = 36;
      const HEAL_COLOR_GREEN = new THREE.Color(0xa8ffb8);
      const HEAL_COLOR_WHITE = new THREE.Color(0xffffff);
      const RING_COLOR_GREEN = new THREE.Color(0x8dffa0);
      for (let i = 0; i < STREAK_COUNT; i++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(0.07, 1.5),
          new THREE.MeshBasicMaterial({
            color: 0xa8ffb8,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        const a = (i / STREAK_COUNT) * Math.PI * 2;
        const r = 0.4 + (i % 4) * 0.28;
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        m.rotation.y = -a;
        // Each streak appears at a specific point in the channel:
        // first streaks at 0%, last ones at 75% — all 36 are visible for the final 25%
        const startThreshold = (i / (STREAK_COUNT - 1)) * 0.75;
        m.userData = {
          ph: Math.random(),
          sp: 0.5 + Math.random() * 0.6,
          startThreshold,
        };
        m.visible = false;
        healVFX.group.add(m);
        healVFX.streaks.push(m);
      }
      const healRing = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0x8dffa0,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      healRing.position.y = 0.1;
      healVFX.group.add(healRing);
      healVFX.group.visible = false;
      scene.add(healVFX.group);

      const playerMoving = () =>
        keys.w || keys.a || keys.s || keys.d || touchJoyVector.active;
      {
        const fsBtn = document.getElementById("fullscreen-btn");
        if (fsBtn) {
          const canFullscreen =
            typeof document.documentElement.requestFullscreen === "function";

          if (!canFullscreen) {
            // iOS Safari / iPhone PWA can't fullscreen HTML — hide the button
            fsBtn.style.display = "none";
          } else {
            const updateFsIcon = () => {
              const isFs = !!(
                document.fullscreenElement || document.webkitFullscreenElement
              );
              fsBtn.innerText = isFs ? "⤡" : "⛶";
              fsBtn.title = isFs ? "Exit fullscreen" : "Enter fullscreen";
            };

            const fireToggle = (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                if (
                  document.fullscreenElement ||
                  document.webkitFullscreenElement
                ) {
                  if (document.exitFullscreen) document.exitFullscreen();
                  else if (document.webkitExitFullscreen)
                    document.webkitExitFullscreen();
                } else {
                  const el = document.documentElement;
                  if (el.requestFullscreen) el.requestFullscreen();
                  else if (el.webkitRequestFullscreen)
                    el.webkitRequestFullscreen();
                }
              } catch (err) {}
              // Icon updates on the fullscreenchange event below
            };

            fsBtn.addEventListener("touchstart", fireToggle, {
              passive: false,
            });
            fsBtn.addEventListener("mousedown", fireToggle);
            document.addEventListener("fullscreenchange", updateFsIcon);
            document.addEventListener("webkitfullscreenchange", updateFsIcon);
            updateFsIcon();
          }
        }
      }

      let pauseJustActivatedAt = 0;
      {
        const pb = document.getElementById("pause-btn");
        if (pb) {
          const firePause = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isPlayerDead || isNameModalOpen) return;
            pauseJustActivatedAt = performance.now();
            togglePause(true);
          };
          pb.addEventListener("touchstart", firePause, { passive: false });
          pb.addEventListener("mousedown", firePause);
        }
      }

      function triggerSkillHeal() {
        if (
          isPlayerDead ||
          isFrozen ||
          isHealing ||
          skill3Cooldown > 0 ||
          isSpecialActive ||
          isDashing ||
          !isGrounded ||
          playerMoving()
        )
          return;
        // 🌿 Heal interrupts normal punch (skills 1 & 2 already do this)
        if (isPunching) {
          punchToken++; // cancels pending punch hit
          isPunching = false;
          isComboSteering = false;
        }
        isHealing = true;
        Game.audio.play("heal");
        healT = 0;
        healTickT = 0;
        totalHealedThisTrance = 0;
        totalIntendedHeal = 0;
        skill3Cooldown = SKILL3_MAX_CD * prog.cdMult;
        healVFX.group.visible = true;
        updateSkillUI();
      }
      function healFrame(delta) {
        if (skill3Cooldown > 0) {
          skill3Cooldown = Math.max(
            0,
            skill3Cooldown - delta * (isFocusing ? FOCUS_RATE : 1),
          );
          updateSkillUI();
        }
        if (!isHealing) return;
        // any action cancels the trance (taking damage does not)
        if (
          isPlayerDead ||
          isPunching ||
          isSpecialActive ||
          isDashing ||
          !isGrounded ||
          playerMoving()
        ) {
          isHealing = false;
          healVFX.group.visible = false;
          totalHealedThisTrance = 0;
          totalIntendedHeal = 0;
          popAt(character.position, "CANCELLED", "miss", 2.2);
          return;
        }
        healT += delta;
        healTickT += delta;
        if (healTickT >= 1) {
          healTickT -= 1;
          const amt = Math.round(
            (PLAYER_MAX_HP * prog.healPct) / getChannelTime(),
          );
          totalIntendedHeal += amt; // burst damage scales with INTENDED heal,
          //                            so a full-HP cast still fires the burst
          const before = playerHP;
          playerHP = Math.min(PLAYER_MAX_HP, playerHP + amt);
          const actual = playerHP - before;
          if (actual > 0) {
            totalHealedThisTrance += actual;
            updatePlayerUI();
            spawnHealNumber(actual);
          }
        }
        if (healT >= getChannelTime() + 0.02) {
          isHealing = false;
          healVFX.group.visible = false;
          const healed = Math.max(totalHealedThisTrance, totalIntendedHeal);
          totalHealedThisTrance = 0;
          totalIntendedHeal = 0;
          unleashHealBurst(healed);
        }
      }

      function unleashHealBurst(healedAmount) {
        if (healedAmount <= 0) return;

        const isCrit = Math.random() < 0.5;
        let burstMult = isCrit ? 2 : 1;
        if (prog.natureWrath > 1) {
          burstMult *= prog.natureWrath * (prog.skillDmgMult || 1);
        }
        const dmg = Math.round(healedAmount * burstMult * getBloodDebtMult());
        const AOE_RADIUS = 22;
        const KNOCKBACK_DIST = 15;

        // 💥 Screen flash — pure white core, fading through green to transparent
        const flash = document.createElement("div");
        flash.style.cssText =
          "position:fixed;inset:0;background:radial-gradient(circle,#ffffff 0%,rgba(230,255,240,0.92) 20%,rgba(105,219,124,0.55) 50%,rgba(105,219,124,0.18) 75%,transparent 100%);pointer-events:none;z-index:998;opacity:1;transition:opacity 0.5s;";
        document.body.appendChild(flash);
        setTimeout(() => {
          flash.style.opacity = "0";
        }, 80);
        setTimeout(() => flash.remove(), 650);

        // ⚪ Pure white burst sphere at the player (the "climax" pop)
        const whiteBurstGeo = new THREE.SphereGeometry(0.5, 20, 20);
        const whiteBurstMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const whiteBurst = new THREE.Mesh(whiteBurstGeo, whiteBurstMat);
        whiteBurst.position.set(
          character.position.x,
          character.position.y + 1.2,
          character.position.z,
        );
        whiteBurst.renderOrder = 1000;
        scene.add(whiteBurst);
        let wbScale = 1.0;
        const wbTimer = setInterval(() => {
          wbScale += 0.35;
          whiteBurst.scale.setScalar(wbScale);
          whiteBurstMat.opacity -= 0.055;
          if (whiteBurstMat.opacity <= 0) {
            clearInterval(wbTimer);
            scene.remove(whiteBurst);
            whiteBurstGeo.dispose();
            whiteBurstMat.dispose();
          }
        }, 16);

        // Green shockwave ring (existing behavior, unchanged)
        const ringGeo = new THREE.RingGeometry(0.6, 1.8, 48);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x51cf66,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(
          character.position.x,
          getElevation(character.position.x, character.position.z) + 0.15,
          character.position.z,
        );
        scene.add(ring);
        let ringScale = 1.0;
        const ringTimer = setInterval(() => {
          ringScale += 0.5;
          ring.scale.set(ringScale, 1, ringScale);
          ringMat.opacity -= 0.045;
          if (ringMat.opacity <= 0) {
            clearInterval(ringTimer);
            scene.remove(ring);
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 16);

        const burstLight = new THREE.PointLight(0x69db7c, 5, AOE_RADIUS * 1.5);
        burstLight.position.set(
          character.position.x,
          character.position.y + 1.5,
          character.position.z,
        );
        scene.add(burstLight);
        let lightIntensity = 5;
        const lightTimer = setInterval(() => {
          lightIntensity -= 0.18;
          burstLight.intensity = Math.max(0, lightIntensity);
          if (lightIntensity <= 0) {
            clearInterval(lightTimer);
            scene.remove(burstLight);
          }
        }, 16);

        triggerScreenShake(isCrit ? 0.42 : 0.3, 0.28);

        for (const b of activeBats) {
          if (b.state !== "alive") continue;
          const dist = b.mesh.position.distanceTo(character.position);
          if (dist > AOE_RADIUS) continue;

          const kb = new THREE.Vector3().subVectors(
            b.mesh.position,
            character.position,
          );
          kb.y = 0;
          if (kb.lengthSq() < 0.01) kb.set(1, 0, 0);
          kb.normalize();

          if (b.isBoss) {
            if (b.ai === "fall" || b.ai === "getup" || b.ai === "dying")
              continue;
            if (b.ai === "attack" || b.ai === "fire" || b.ai === "dodge") {
              b.ai = "move";
              b.attackTimer = 2.5;
              b.atk = null;
              b.plan = null;
            }
            b.kb = { left: KNOCKBACK_DIST, vx: kb.x, vz: kb.z };
            b.dodgeCd = 2;
          } else if (b.isDragon) {
            b.attackTimer = 3.0;
            b.mesh.position.x += kb.x * KNOCKBACK_DIST;
            b.mesh.position.z += kb.z * KNOCKBACK_DIST;
            b.mesh.position.y =
              getElevation(b.mesh.position.x, b.mesh.position.z) +
              DRAGON_FLY_HEIGHT;
          } else {
            b.isAttacking = false;
            b.attackTimer = 2.5;
            b.mesh.position.x += kb.x * KNOCKBACK_DIST;
            b.mesh.position.z += kb.z * KNOCKBACK_DIST;
          }

          damageBat(b, dmg, isCrit ? "crit" : "normal", 0);
        }

        for (let i = dragonBeams.length - 1; i >= 0; i--) {
          const beam = dragonBeams[i];
          scene.remove(beam.group);
          if (beam.light) scene.remove(beam.light);
          beam.group.traverse((n) => {
            if (n.isMesh) {
              n.geometry.dispose();
              n.material.dispose();
            }
          });
          dragonBeams.splice(i, 1);
        }

        popAt(
          character.position,
          isCrit ? `HEAL BURST CRIT! ${dmg}` : `HEAL BURST! ${dmg}`,
          isCrit ? "crit" : "heal",
          2.8,
        );
      }
      function updateHealVFX(t) {
        if (!healVFX.group.visible) return;
        healVFX.group.position.copy(character.position);

        // 0 → 1 as the channel progresses
        const progress = Math.min(1, healT / getChannelTime());
        // Streaks rise faster near the end (energy building)
        const speedBoost = 1 + progress * 2.5;

        healVFX.streaks.forEach((m) => {
          const threshold = m.userData.startThreshold;
          const active = progress >= threshold;
          m.visible = active;
          if (!active) return;

          // How long this particular streak has been visible (0 → 1)
          const appearProgress = Math.min(
            1,
            (progress - threshold) / Math.max(0.05, 1 - threshold),
          );

          // Vertical motion
          const f = (t * m.userData.sp * speedBoost + m.userData.ph) % 1;
          m.position.y = f * 2.8 + 0.7;

          // Fade in as the streak appears, then pulse as it travels up
          const pulse = Math.sin(f * Math.PI);
          const appearFade = Math.min(1, appearProgress * 3);
          m.material.opacity = pulse * 0.85 * appearFade + progress * 0.15;

          // 💚 Green → ⚪ White
          m.material.color
            .copy(HEAL_COLOR_GREEN)
            .lerp(HEAL_COLOR_WHITE, progress);

          // Grow wider/taller as the burst approaches
          const widthScale = 1 + progress * 0.4;
          const heightScale = 1 + progress * 0.9;
          m.scale.set(widthScale, heightScale, widthScale);
        });

        // Ground ring: grows, brightens, and whitens toward the end
        const ringPulse = 1 + Math.sin(t * 4) * 0.08;
        const ringGrow = 1 + progress * 1.8;
        healRing.scale.setScalar(ringPulse * ringGrow);
        healRing.material.opacity =
          (0.5 + 0.3 * Math.sin(t * 6)) * (1 + progress * 0.5);
        healRing.material.color
          .copy(RING_COLOR_GREEN)
          .lerp(HEAL_COLOR_WHITE, progress);
      }
      const _baseSkillUI = updateSkillUI;
      updateSkillUI = function () {
        _baseSkillUI();
        const c = $("skill3-card"),
          t = $("skill3-status"),
          f = $("skill3-fill");
        if (!c) return;
        if (isHealing) {
          _skill3WasOnCd = false;
          c.classList.remove("ready");
          t.innerText = "CHANNELING";
          t.style.color = "#69db7c";
          f.style.width = `${Math.min(100, (healT / getChannelTime()) * 100)}%`;
        } else if (skill3Cooldown <= 0) {
          if (_skill3WasOnCd) {
            _flashJustReady(c, "skill3");
            _skill3WasOnCd = false;
          }
          c.classList.add("ready");
          t.innerText = "READY!";
          t.style.color = "#69db7c";
          f.style.width = "100%";
        } else {
          _skill3WasOnCd = true;
          c.classList.remove("ready");
          t.innerText = `${skill3Cooldown.toFixed(1)}s`;
          t.style.color = "#868e96";
          f.style.width = `${Math.max(0, Math.min(100, (1 - skill3Cooldown / (SKILL3_MAX_CD * prog.cdMult)) * 100))}%`;
        }
      };
      window.addEventListener("keydown", (e) => {
        if (e.repeat || isNameModalOpen || isGamePaused || isPlayerDead) return;
        if (e.key === "3") triggerSkillHeal();
      });
