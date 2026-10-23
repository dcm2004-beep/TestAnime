
      function playerStepForward(dist) {
        const fwd = new THREE.Vector3(
          Math.sin(character.rotation.y),
          0,
          Math.cos(character.rotation.y),
        );
        let allowedDist = dist;

        if (activeBats && activeBats.length > 0) {
          for (const b of activeBats) {
            if (b.state !== "alive") continue;
            const toBat = new THREE.Vector3().subVectors(
              b.mesh.position,
              character.position,
            );
            toBat.y = 0;
            const currentDist = toBat.length();
            if (currentDist > 0.001) {
              const dirToBat = toBat.clone().normalize();
              if (fwd.dot(dirToBat) > 0.35) {
                const safeDistance = Math.max(0, currentDist - 1.1);
                if (safeDistance < allowedDist) allowedDist = safeDistance;
              }
            }
          }
        }

        if (fixtures && fixtures.length > 0) {
          for (const f of fixtures) {
            const dx = f.x - character.position.x;
            const dz = f.z - character.position.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.001) {
              const dirToF = new THREE.Vector2(dx / d, dz / d);
              if (new THREE.Vector2(fwd.x, fwd.z).dot(dirToF) > 0.4) {
                const safeDistance = Math.max(0, d - (f.radius + 0.6));
                if (safeDistance < allowedDist) allowedDist = safeDistance;
              }
            }
          }
        }
        character.position.addScaledVector(fwd, allowedDist);
      }

      function onNormalPunchLanded() {
        skill1Cooldown = Math.max(0, skill1Cooldown - 0.05);
        skill2Cooldown = Math.max(0, skill2Cooldown - 0.05);
        updateSkillUI();
      }

      function updateBatUI() {
        const batHpTxt = document.getElementById("bat-hp");
        if (!batHpTxt) return;
        if (isTutorialActive) {
          batHpTxt.innerText = "🥋 Training Dummy";
          return;
        }
        const aliveBats = activeBats.filter((b) => b.state === "alive");
        if (aliveBats.length === 0) {
          batHpTxt.innerText = "Searching skies...";
          return;
        }
        let nearest = aliveBats[0];
        let minDist = 9999;
        for (const b of aliveBats) {
          const d = b.mesh.position.distanceTo(character.position);
          if (d < minDist) {
            minDist = d;
            nearest = b;
          }
        }
        batHpTxt.innerText = `${nearest.isBoss ? "Boss" : nearest.isDragon ? "Dragon" : "Bat"} HP: ${Math.round(nearest.hp)} / ${Math.round(nearest.maxHp || BAT_MAX_HP)} (${aliveBats.length} active)`;
      }

      function damageBat(b, amount, hitType = "normal", knockForce = 0.9) {
        if (!b || b.state !== "alive") return;
        if (b.isBoss) return damageBoss(b, amount, hitType);

        // ⚡ Assassinate — execute low-HP non-boss enemies on punch
        if (
          prog.assassinate &&
          hitType !== "electric" &&
          hitType !== "electric-crit" &&
          !b.isBoss &&
          !b.isTutorialDummy &&
          b.state === "alive" &&
          b.hp > 0 &&
          b.hp <= b.maxHp * 0.25
        ) {
          amount = b.hp;
          popAt(b.mesh.position, "⚡ EXECUTED", "crit", 2.0, "#ffd43b");
        }

        // 🎓 Tutorial dummy never dies — damage numbers still pop
        if (b.isTutorialDummy) {
          knockForce = 0.05;
          b.hp = Math.max(1, b.hp - amount);
        } else {
          b.hp = Math.max(0, b.hp - amount);
        }
        totalDamageDealt += amount;

        // ❄️ Frost Fist — crits slow the enemy
        if (prog.frostFist && hitType === "crit" && !b.isTutorialDummy) {
          b.slowT = 2.0;
        }

        if (b.hpBar && b.hpBar.fill) {
          const pct = Math.max(0, b.hp / (b.maxHp || BAT_MAX_HP));
          b.hpBar.fill.scale.x = pct;
          b.hpBar.fill.position.x = -((1.36 * (1 - pct)) / 2);
          if (pct < 0.25) b.hpBar.fillMat.color.setHex(0xfa5252);
          else if (pct < 0.5) b.hpBar.fillMat.color.setHex(0xfcc419);
          else b.hpBar.fillMat.color.setHex(0x40c057);
        }

        const liveScore = document.getElementById("live-damage-score");
        if (liveScore) liveScore.innerText = totalDamageDealt.toLocaleString();

        const pos = b.mesh.position.clone();
        pos.y += 1.0;
        pos.project(camera);

        if (pos.z > 1.0 || pos.z < -1.0) {
          const fwd = new THREE.Vector3(
            Math.sin(character.rotation.y),
            0,
            Math.cos(character.rotation.y),
          );
          const forwardPos = character.position
            .clone()
            .addScaledVector(fwd, 2.5);
          forwardPos.y += 1.4;
          forwardPos.project(camera);
          pos.copy(forwardPos);
        }

        const sx = Math.max(
          50,
          Math.min(
            window.innerWidth - 60,
            (pos.x * 0.5 + 0.5) * window.innerWidth,
          ),
        );
        const sy = Math.max(
          60,
          Math.min(
            window.innerHeight - 100,
            (-(pos.y * 0.5) + 0.5) * window.innerHeight,
          ),
        );

        const tag = document.createElement("div");
        if (hitType === "crit") {
          tag.className = "damage-pop crit";
          tag.innerText = `${amount}! CRIT`;
          setTimeout(() => tag.remove(), 1300);
        } else if (hitType === "electric-crit") {
          tag.className = "damage-pop crit";
          tag.style.color = "#00f0ff";
          tag.style.textShadow =
            "-2px -2px 0 #fff, 2px -2px 0 #fff, 0 0 24px #00f0ff";
          tag.innerText = `${amount}! ⚡ CRIT`;
          setTimeout(() => tag.remove(), 1400);
        } else if (hitType === "electric") {
          tag.className = "damage-pop electric";
          tag.innerText = `${amount} ⚡`;
          setTimeout(() => tag.remove(), 1300);
        } else if (hitType === "combo") {
          tag.className = "damage-pop combo";
          tag.innerText = `${amount} 💥`;
          setTimeout(() => tag.remove(), 1200);
        } else if (hitType === "reflect") {
          tag.className = "damage-pop";
          tag.style.color = "#ff9ebb";
          tag.innerText = `${amount} 🩸`;
          setTimeout(() => tag.remove(), 850);
        } else {
          tag.className = "damage-pop";
          tag.innerText = `${amount}`;
          setTimeout(() => tag.remove(), 850);
        }

        tag.style.left = `${sx}px`;
        tag.style.top = `${sy}px`;
        document.body.appendChild(tag);

        // 💥 Electric Impact Burst & Screen Flash
        if (hitType === "electric" || hitType === "electric-crit") {
          const screenFlash = document.getElementById("electric-flash");
          if (screenFlash) {
            screenFlash.classList.add("electric-flash-active");
            setTimeout(
              () => screenFlash.classList.remove("electric-flash-active"),
              80,
            );
          }

          // Spawn a quick cyan shockwave ring at the bat's position
          const ringGeo = new THREE.RingGeometry(0.2, 1.5, 32);
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.set(
            b.mesh.position.x,
            b.mesh.position.y,
            b.mesh.position.z,
          );
          scene.add(ring);

          let rScale = 1.0;
          const rTimer = setInterval(() => {
            rScale += 0.2;
            ring.scale.set(rScale, rScale, rScale);
            ring.material.opacity -= 0.05;
            if (ring.material.opacity <= 0) {
              clearInterval(rTimer);
              scene.remove(ring);
              ringGeo.dispose();
              ringMat.dispose();
            }
          }, 16);
        }

        const flashColor = hitType === "electric" ? 0x00f0ff : 0xff1744;
        b.mesh.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => {
              if (m && m.color) {
                const orig = m.color.getHex();
                m.color.setHex(flashColor);
                setTimeout(() => {
                  if (m && m.color) m.color.setHex(orig);
                }, 140);
              }
            });
          }
        });

        const knock = new THREE.Vector3()
          .subVectors(b.mesh.position, character.position)
          .normalize();
        knock.y = 0.15;
        const finalKnock = knockForce * (1 - (b.knockbackResist || 0));
        b.mesh.position.addScaledVector(knock, finalKnock);

        updateBatUI();
        if (b.hp <= 0) {
          b.state = "dying";
          if (b.hpBar && b.hpBar.group) b.hpBar.group.visible = false;
          onEnemyKilled(b);
        }
      }

      function tryHitBat(baseDmg, isCrit = false, isCombo = false) {
        if (!activeBats || activeBats.length === 0) return;

        if (isCrit) {
          triggerCritShockwave();
          for (const b of activeBats) {
            if (b.state !== "alive") continue;
            const dx = b.mesh.position.x - character.position.x;
            const dz = b.mesh.position.z - character.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist <= 4.8 + bodyR(b)) {
              if (Math.random() < 0.05) spawnBatMissText(b);
              else {
                const critDmg = rollDamage(baseDmg);
                damageBat(b, critDmg, "crit", 3.5);
                tryBloodFistHeal(critDmg);
                applyPoison(b, critDmg);
                if (isCombo) applyChakraBurn(b, critDmg);
              }
            }
          }
        } else {
          let closestBat = null;
          let closestDist = 999;
          const forward = new THREE.Vector2(
            Math.sin(character.rotation.y),
            Math.cos(character.rotation.y),
          );

          for (const b of activeBats) {
            if (b.state !== "alive") continue;
            const dx = b.mesh.position.x - character.position.x;
            const dz = b.mesh.position.z - character.position.z;
            const dist = Math.hypot(dx, dz);

            if (dist <= 3.8 + bodyR(b)) {
              const toBat = new THREE.Vector2(dx, dz).normalize();
              const dot = toBat.dot(forward);
              if (dot >= -0.1 && dist < closestDist) {
                closestDist = dist;
                closestBat = b;
              }
            }
          }

          if (closestBat) {
            const isEvaded = Math.random() < 0.12;
            if (isEvaded) {
              spawnBatMissText(closestBat);
            } else {
              const finalDmg = rollDamage(baseDmg);
              const hitType = isCombo ? "combo" : "normal";
              damageBat(closestBat, finalDmg, hitType, 0.9);
              tryBloodFistHeal(finalDmg);
              applyPoison(closestBat, finalDmg);
              if (isCombo) applyChakraBurn(closestBat, finalDmg);

              // 🗡️ Whirlwind — 60% splash to nearby enemies
              if (prog.whirlwind) {
                const whirlDmg = Math.round(finalDmg * 0.6);
                for (const wb of activeBats) {
                  if (
                    wb === closestBat ||
                    wb.state !== "alive" ||
                    wb.isTutorialDummy
                  )
                    continue;
                  const wdx = wb.mesh.position.x - character.position.x;
                  const wdz = wb.mesh.position.z - character.position.z;
                  if (Math.hypot(wdx, wdz) <= 3.0 + bodyR(wb)) {
                    damageBat(wb, whirlDmg, "combo", 0.5);
                  }
                }
              }

              if (!isCombo) {
                onNormalPunchLanded();
                if (prog.dragonFist)
                  prog.dragonFistCount = (prog.dragonFistCount || 0) + 1;
              }

              const isLeftClickFinisher =
                !isCombo && punchComboCount > 0 && punchComboCount % 3 === 0;
              if (
                (isCombo || (isLeftClickFinisher && Math.random() < 0.3)) &&
                !isPlayerDead
              ) {
                const healAmount = Math.max(
                  1,
                  Math.round(finalDmg * (isCombo ? 0.15 : 0.1)),
                );
                playerHP = Math.min(PLAYER_MAX_HP, playerHP + healAmount);
                updatePlayerUI();
                spawnHealNumber(healAmount);
              }
            }
          }
        }
      }

      let screenShakeTime = 0;
      let screenShakeDuration = 0;
      let screenShakeMagnitude = 0;

      function triggerScreenShake(intensity = 0.15, duration = 0.12) {
        screenShakeMagnitude = intensity;
        screenShakeDuration = duration;
        screenShakeTime = duration;
      }

      function smoothForwardGlide(totalDist, durationMs, steps = 16) {
        const stepDist = totalDist / steps;
        const interval = durationMs / steps;
        let count = 0;
        const glideTimer = setInterval(() => {
          if (isGamePaused) return;
          if (isPlayerDead) {
            clearInterval(glideTimer);
            return;
          }
          playerStepForward(stepDist);
          count++;
          if (count >= steps) clearInterval(glideTimer);
        }, interval);
      }

      let isSkill2Immune = false; // ⚡ Invulnerability flag for Skill 2
      let isDragonFistImmune = false; // 🐉 Invulnerability during Dragon Fist impact
