
      let PLAYER_MAX_HP = 2000;
      let playerHP = PLAYER_MAX_HP;
      let isPlayerDead = false;
      let totalDamageDealt = 0;

      let batTemplate = null;
      let batAnimClip = null;
      const BAT_MAX_HP = 1350;

      const activeBats = [];
      let gameSurvivalTime = 0;
      let batSpawnCooldown = 1.5;

      function cloneSkinnedMesh(source) {
        const cloneLookup = new Map();
        const clone = source.clone();
        function parallelTraverse(a, b) {
          cloneLookup.set(a, b);
          for (let i = 0; i < a.children.length; i++)
            parallelTraverse(a.children[i], b.children[i]);
        }
        parallelTraverse(source, clone);

        source.traverse((src) => {
          if (!src.isSkinnedMesh) return;
          const cln = cloneLookup.get(src);
          const orderedCloneBones = [];
          for (let i = 0; i < src.skeleton.bones.length; i++)
            orderedCloneBones.push(cloneLookup.get(src.skeleton.bones[i]));
          cln.bind(
            new THREE.Skeleton(
              orderedCloneBones,
              src.skeleton.boneInverses.map((m) => m.clone()),
            ),
            src.bindMatrix.clone(),
          );
        });
        return clone;
      }

      function updatePlayerUI() {
        const txt = document.getElementById("player-hp-txt");
        const bar = document.getElementById("player-hp-bar");
        if (txt) txt.innerText = `${Math.round(playerHP)} / ${PLAYER_MAX_HP}`;
        if (bar) {
          const pct = Math.max(0, playerHP / PLAYER_MAX_HP);
          bar.style.width = `${pct * 100}%`;
          if (pct < 0.25) bar.style.background = "#fa5252";
          else if (pct < 0.5) bar.style.background = "#fcc419";
          else bar.style.background = "#40c057";
        }
      }

      function triggerKarmicBlast() {
        const blastDmg = Math.round(180 * enemyMult() * getBloodDebtMult());
        const healAmt = Math.round(PLAYER_MAX_HP * 0.1);
        const AOE_RADIUS = 10;

        // Green shockwave ring (skill-3 visual style)
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
        let s = 1.0;
        const timer = setInterval(() => {
          s += 0.4;
          ring.scale.set(s, 1, s);
          ringMat.opacity -= 0.05;
          if (ringMat.opacity <= 0) {
            clearInterval(timer);
            scene.remove(ring);
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 16);

        // AoE damage
        for (const b of activeBats) {
          if (b.state !== "alive") continue;
          const dist = b.mesh.position.distanceTo(character.position);
          if (dist > AOE_RADIUS) continue;
          damageBat(b, blastDmg, "crit", 1.5);
        }

        // Heal
        if (!isPlayerDead) {
          playerHP = Math.min(PLAYER_MAX_HP, playerHP + healAmt);
          updatePlayerUI();
          spawnHealNumber(healAmt);
        }

        triggerScreenShake(0.25, 0.15);
        popAt(character.position, `KARMIC BLAST!`, "crit", 2.8);
      }

      function tryRevive() {
        if ((prog.revivesLeft || 0) <= 0) return false;
        prog.revivesLeft--;

        // Restore state
        playerHP = Math.round(PLAYER_MAX_HP * 0.5);
        isPlayerDead = false;
        isFrozen = false;
        freezeMesh.visible = false;
        isHealing = false;
        healVFX.group.visible = false;
        isPunching = false;
        isSpecialActive = false;
        isDashing = false;
        isComboSteering = false;
        punchToken++;

        // Reset skill cooldowns — small safety valve
        skill1Cooldown = 0;
        skill2Cooldown = 0;
        skill3Cooldown = 0;
        updateSkillUI();

        // 2.5s invuln
        isSkill2Immune = true;
        setTimeout(() => (isSkill2Immune = false), 2500);

        // Push enemies back
        for (const b of activeBats) {
          const away = new THREE.Vector3().subVectors(
            b.mesh.position,
            character.position,
          );
          away.y = 0;
          if (away.lengthSq() < 0.01) away.set(1, 0, 0);
          away.normalize();
          const pushDist = b.isBoss ? 15 : 12;
          b.mesh.position.addScaledVector(away, pushDist);
          if (b.isBoss) {
            b.attackTimer = Math.max(b.attackTimer, 2.5);
            b.ai = "move";
            b.atk = null;
            b.plan = null;
          } else if (b.isDragon) {
            b.attackTimer = Math.max(b.attackTimer, 3.0);
          } else {
            b.isAttacking = false;
            b.attackTimer = 2.5;
          }
        }

        // Clear incoming dragon beams
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

        // VFX
        spawnLightExplosion(
          character.position.clone().add(new THREE.Vector3(0, 1, 0)),
          0x69db7c,
          5.0,
          600,
        );
        const flash = document.createElement("div");
        flash.style.cssText =
          "position:fixed;inset:0;background:radial-gradient(circle,rgba(255,255,255,0.9),rgba(105,219,124,0.5) 40%,transparent);pointer-events:none;z-index:998;opacity:1;transition:opacity 0.6s;";
        document.body.appendChild(flash);
        setTimeout(() => (flash.style.opacity = "0"), 80);
        setTimeout(() => flash.remove(), 700);

        banner("💚 REVIVED! (50% HP, 2.5s invuln)", 2400);
        updatePlayerUI();
        return true;
      }

      function damagePlayer(amount, attacker = null, damageType = "melee") {
        if (isPlayerDead) return;

        if (isSkill2Immune || isDragonFistImmune) {
          spawnDodgeText();
          return;
        }

        if (prog.evasion > 0 && Math.random() < prog.evasion) {
          spawnDodgeText();
          return;
        }

        const reducedAmount = Math.round(amount * (1 - prog.dmgReduction));

        // ⚡ Focus channel breaks on any damage that actually lands
        if (isFocusing) {
          endFocus(true);
          popAt(character.position, "FOCUS BROKEN", "dodge", 2.2);
        }

        playerHP = Math.max(0, playerHP - reducedAmount);
        updatePlayerUI();

        // 💀 Blood Debt — each hit taken grants a stack
        if (prog.bloodDebt && reducedAmount > 0) {
          prog.bloodDebtStacks = Math.min(15, prog.bloodDebtStacks + 1);
          prog.bloodDebtExpiry = performance.now() + 6000;
        }

        const pos = character.position.clone();
        pos.y += 1.6;
        pos.project(camera);
        if (pos.z <= 1.0) {
          const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
          const tag = document.createElement("div");
          tag.className = "damage-pop";
          tag.style.color = "#ff4d4d";
          tag.innerText = `-${reducedAmount}`;
          tag.style.left = `${sx}px`;
          tag.style.top = `${sy}px`;
          document.body.appendChild(tag);
          setTimeout(() => tag.remove(), 750);
        }

        // ⚔️ Counter Stance — reflect (ranged at 50% value)
        if (attacker && prog.reflectPct > 0 && amount > 0) {
          const reflectMult = damageType === "ranged" ? 0.5 : 1;
          const reflectDmg = Math.round(
            amount * prog.reflectPct * reflectMult * getBloodDebtMult(),
          );
          if (reflectDmg > 0) {
            damageBat(attacker, reflectDmg, "reflect", 0);
            popAt(
              character.position,
              `REFLECT ${reflectDmg}`,
              "",
              2.0,
              "#ff9ebb",
            );
          }
        }

        // 💥 Karmic Blast — accumulate damage, trigger at 25% max HP
        if (prog.karmicBlast) {
          const nowMs = performance.now();
          if (!prog._lastKarmaBlastAt) prog._lastKarmaBlastAt = 0;
          prog.karmaMeter = (prog.karmaMeter || 0) + reducedAmount;
          const threshold = PLAYER_MAX_HP * 0.25;
          if (
            prog.karmaMeter >= threshold &&
            nowMs - prog._lastKarmaBlastAt > 2000
          ) {
            prog.karmaMeter = 0;
            prog._lastKarmaBlastAt = nowMs;
            triggerKarmicBlast();
          }
        }

        // 🪨 Thorned Hide — 10-40% of damage taken back as AoE
        if (prog.thornedHide > 0 && reducedAmount > 0 && !isPlayerDead) {
          const THORN_RADIUS = 6;
          const thornDmg = Math.round(
            reducedAmount * prog.thornedHide * getBloodDebtMult(),
          );
          if (thornDmg > 0) {
            for (const tb of activeBats) {
              if (tb.state !== "alive") continue;
              if (tb.isTutorialDummy) continue;
              const tdx = tb.mesh.position.x - character.position.x;
              const tdz = tb.mesh.position.z - character.position.z;
              if (Math.hypot(tdx, tdz) > THORN_RADIUS) continue;
              damageBat(tb, thornDmg, "reflect", 0);
            }
            // 🪨 Stone-spike ring VFX
            const ringGeo = new THREE.RingGeometry(0.6, 1.6, 24);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
              color: 0xc08457,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.9,
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
            let rs = 1.0;
            const rTimer = setInterval(() => {
              rs += 0.3;
              ring.scale.set(rs, 1, rs);
              ringMat.opacity -= 0.07;
              if (ringMat.opacity <= 0) {
                clearInterval(rTimer);
                scene.remove(ring);
                ringGeo.dispose();
                ringMat.dispose();
              }
            }, 16);
          }
        }

        character.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => {
              if (m.color && m.userData.trueColor !== undefined) {
                m.color.setHex(0xff2222);
                setTimeout(() => m.color.setHex(m.userData.trueColor), 120);
              }
            });
          }
        });

        if (playerHP <= 0) {
          if (tryRevive()) return;
          isPlayerDead = true;
          document.exitPointerLock();
          const endScore = document.getElementById("end-damage-score");
          if (endScore) endScore.innerText = totalDamageDealt.toLocaleString();

          saveHighScore(currentPlayerName, totalDamageDealt);
          renderLeaderboard();

          const ds = document.getElementById("death-screen");
          if (ds) ds.style.display = "flex";
        }
      }

      function respawnPlayer() {
        isPlayerDead = false;
        playerHP = PLAYER_MAX_HP;
        totalDamageDealt = 0;
        isPunching = false;
        isSpecialActive = false;
        queuedSkill = null;
        isComboSteering = false;
        isDashing = false;
        punchStuckStart = 0;
        lastCritTime = 0;
        runTime = 0;
        gameSurvivalTime = 0;
        batSpawnCooldown = 1.5;
        skill1Cooldown = 0;
        skill2Cooldown = 0;
        resetProgression();

        updatePlayerUI();
        updateSkillUI();

        const liveScore = document.getElementById("live-damage-score");
        if (liveScore) liveScore.innerText = "0";

        character.position.set(0, getElevation(0, 0), 0);
        character.rotation.y = 0;

        character.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => {
              if (m.userData.trueColor !== undefined)
                m.color.setHex(m.userData.trueColor);
            });
          }
        });

        const ds = document.getElementById("death-screen");
        if (ds) ds.style.display = "none";

        for (const b of activeBats) {
          b.mesh.position.x += 15;
          b.mesh.position.z += 15;
          b.isAttacking = false;
          b.attackTimer = 3.0;
        }
        document.body.requestPointerLock();
      }
