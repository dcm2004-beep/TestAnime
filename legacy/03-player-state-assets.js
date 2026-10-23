
      const character = new THREE.Group();
      scene.add(character);

      let mixer = null;
      const actions = {};
      let currentAction = null;
      let isPunching = false;
      let isSpecialActive = false; // Tracks if Ability 1 or 2 is currently casting
      let isComboSteering = false;
      let punchComboCount = 0;
      let punchToken = 0; // Invalidates normal punch hits when interrupted

      let queuedSkill = null;
      let queuedSkillTime = 0;
      const SKILL_QUEUE_WINDOW = 1200;

      function queueSpecialSkill(skillName) {
        queuedSkill = skillName;
        queuedSkillTime = performance.now();
      }

      function checkQueuedSkill() {
        if (!queuedSkill) return;
        if (performance.now() - queuedSkillTime > SKILL_QUEUE_WINDOW) {
          queuedSkill = null;
          return;
        }
        if (isPlayerDead || isGamePaused || isDashing) return;

        const next = queuedSkill;
        if (next === "combo" && skill1Cooldown <= 0) {
          queuedSkill = null;
          triggerSkillCombo();
        } else if (next === "kick" && skill2Cooldown <= 0) {
          queuedSkill = null;
          triggerSkillElectricKick();
        }
      }

      const SKILL1_MAX_CD = 8.0;
      const SKILL2_MAX_CD = 12.0;
      let skill1Cooldown = 0;
      let skill2Cooldown = 0;

      let _skill1WasOnCd = false;
      let _skill2WasOnCd = false;
      let _skill3WasOnCd = false;

      function _flashJustReady(cardEl, key) {
        if (!cardEl) return;
        cardEl.classList.remove("just-ready");
        // Force reflow so re-adding the class restarts the animation
        void cardEl.offsetWidth;
        cardEl.classList.add("just-ready");
        setTimeout(() => cardEl.classList.remove("just-ready"), 780);
      }

      function updateSkillUI() {
        const c1 = document.getElementById("skill1-card");
        const t1 = document.getElementById("skill1-status");
        const f1 = document.getElementById("skill1-fill");

        const c2 = document.getElementById("skill2-card");
        const t2 = document.getElementById("skill2-status");
        const f2 = document.getElementById("skill2-fill");

        if (c1 && t1 && f1) {
          if (skill1Cooldown <= 0) {
            if (_skill1WasOnCd) {
              _flashJustReady(c1, "skill1");
              _skill1WasOnCd = false;
            }
            c1.classList.add("ready");
            t1.innerText = "READY!";
            t1.style.color = "#ffd43b";
            f1.style.width = "100%";
          } else {
            _skill1WasOnCd = true;
            c1.classList.remove("ready");
            t1.innerText = `${skill1Cooldown.toFixed(1)}s`;
            t1.style.color = "#868e96";
            const pct = Math.max(
              0,
              Math.min(
                100,
                (1 - skill1Cooldown / (SKILL1_MAX_CD * prog.cdMult)) * 100,
              ),
            );
            f1.style.width = `${pct}%`;
          }
        }

        if (c2 && t2 && f2) {
          if (skill2Cooldown <= 0) {
            if (_skill2WasOnCd) {
              _flashJustReady(c2, "skill2");
              _skill2WasOnCd = false;
            }
            c2.classList.add("ready");
            t2.innerText = "READY!";
            t2.style.color = "#00f0ff";
            f2.style.width = "100%";
          } else {
            _skill2WasOnCd = true;
            c2.classList.remove("ready");
            t2.innerText = `${skill2Cooldown.toFixed(1)}s`;
            t2.style.color = "#868e96";
            const pct = Math.max(
              0,
              Math.min(
                100,
                (1 - skill2Cooldown / (SKILL2_MAX_CD * prog.cdMult)) * 100,
              ),
            );
            f2.style.width = `${pct}%`;
          }
        }
      }

      // 💀 Blood Debt — returns current damage multiplier from stacks
      function getBloodDebtMult() {
        if (!prog.bloodDebt || prog.bloodDebtStacks <= 0) return 1;
        if (performance.now() > prog.bloodDebtExpiry) {
          prog.bloodDebtStacks = 0;
          return 1;
        }
        return Game.damage.bloodDebtMult(prog.bloodDebtStacks);
      }

      // 🐍 Serpent Strike — poison application & tick
      function applyPoison(b, dmgDealt) {
        if (!b || b.state !== "alive") return;
        if (b.isBoss || b.isTutorialDummy) return;
        if (prog.serpentStrike <= 0) return;
        const poisonTotal = dmgDealt * prog.serpentStrike;
        if (poisonTotal <= 0) return;
        const dps = poisonTotal / 5.0;
        b.poisonT = 5.0;
        b.poisonDps = Math.max(b.poisonDps || 0, dps);
        if (!b.poisonTick) b.poisonTick = 0;
        if (!b._poisonPopped) {
          popAt(b.mesh.position, "POISONED 🐍", "", 1.8, "#51cf66");
          b._poisonPopped = true;
        }
      }

      function tickPoison(b, dt) {
        if (!b.poisonT || b.poisonT <= 0) return;
        if (b.isBoss || b.isTutorialDummy) return;
        if (b.state !== "alive") {
          b.poisonT = 0;
          return;
        }
        b.poisonT -= dt;
        b.poisonTick = (b.poisonTick || 0) + dt;
        if (b.poisonTick >= 0.5) {
          b.poisonTick -= 0.5;
          const tickDmg = Math.round((b.poisonDps || 0) * 0.5);
          if (tickDmg > 0) {
            b.hp = Math.max(0, b.hp - tickDmg);
            totalDamageDealt += tickDmg;
            const ls = document.getElementById("live-damage-score");
            if (ls) ls.innerText = totalDamageDealt.toLocaleString();
            if (b.hpBar && b.hpBar.fill) {
              const pct = Math.max(0, b.hp / (b.maxHp || BAT_MAX_HP));
              b.hpBar.fill.scale.x = pct;
              b.hpBar.fill.position.x = -((1.36 * (1 - pct)) / 2);
              if (pct < 0.25) b.hpBar.fillMat.color.setHex(0xfa5252);
              else if (pct < 0.5) b.hpBar.fillMat.color.setHex(0xfcc419);
              else b.hpBar.fillMat.color.setHex(0x40c057);
            }
            popAt(b.mesh.position, `${tickDmg} 🐍`, "", 1.2, "#51cf66");
            if (b.hp <= 0) {
              b.state = "dying";
              if (b.hpBar && b.hpBar.group) b.hpBar.group.visible = false;
              onEnemyKilled(b);
            }
          }
        }
        if (b.poisonT <= 0) {
          b.poisonT = 0;
          b.poisonDps = 0;
        }
      }

      function isBerserkerActive() {
        return Game.damage.isBerserk({
          unlocked: prog.berserker,
          dead: isPlayerDead,
          hp: playerHP,
          maxHp: PLAYER_MAX_HP,
        });
      }

      function applyChakraBurn(b, dmgDealt) {
        if (!b || b.state !== "alive" || b.isTutorialDummy) return;
        if (!prog.chakraInfusion || dmgDealt <= 0) return;
        const burnDps = dmgDealt * 0.08;
        b.burnT = 3.0;
        b.burnDps = Math.max(b.burnDps || 0, burnDps);
        if (!b.burnTick) b.burnTick = 0;
      }

      function tickBurn(b, dt) {
        if (!b.burnT || b.burnT <= 0) return;
        if (b.isTutorialDummy || b.state !== "alive") {
          b.burnT = 0;
          return;
        }
        b.burnT -= dt;
        b.burnTick = (b.burnTick || 0) + dt;
        if (b.burnTick >= 0.5) {
          b.burnTick -= 0.5;
          const tickDmg = Math.round((b.burnDps || 0) * 0.5);
          if (tickDmg > 0) {
            b.hp = Math.max(0, b.hp - tickDmg);
            totalDamageDealt += tickDmg;
            const ls = document.getElementById("live-damage-score");
            if (ls) ls.innerText = totalDamageDealt.toLocaleString();
            if (b.hpBar && b.hpBar.fill) {
              const pct = Math.max(0, b.hp / (b.maxHp || BAT_MAX_HP));
              b.hpBar.fill.scale.x = pct;
              b.hpBar.fill.position.x = -((1.36 * (1 - pct)) / 2);
            }
            popAt(b.mesh.position, `${tickDmg} 🔥`, "", 1.2, "#ff6644");
            if (b.hp <= 0) {
              b.state = "dying";
              if (b.hpBar && b.hpBar.group) b.hpBar.group.visible = false;
              onEnemyKilled(b);
            }
          }
        }
        if (b.burnT <= 0) {
          b.burnT = 0;
          b.burnDps = 0;
        }
      }

      function rollDamage(base, extraMult = 1) {
        return Game.damage.rollDamage({
          base,
          extraMult,
          dmgMult: prog.dmgMult,
          bloodDebt: getBloodDebtMult(),
          berserk: isBerserkerActive(),
        });
      }

      // Blood Fist heal helper — silent if heal is small, pops a number if big
      function tryBloodFistHeal(dmgDealt) {
        if (prog.bloodFistPct <= 0 || isPlayerDead || dmgDealt <= 0) return;
        const healAmount = Math.round(dmgDealt * prog.bloodFistPct);
        if (healAmount <= 0) return;
        playerHP = Math.min(PLAYER_MAX_HP, playerHP + healAmount);
        updatePlayerUI();
        if (healAmount >= 15) spawnHealNumber(healAmount);
      }

      function playAction(name, duration = 0.2, speed = 1.0) {
        const nextAction = actions[name];
        if (!nextAction) return;

        if (currentAction === nextAction) {
          // Already on this action - at least update the playback speed
          // (fixes dash leaving strafe animation stuck at 2.4x)
          nextAction.setEffectiveTimeScale(speed);
          // If a LoopOnce action already finished, restart it so it can fire 'finished' again
          if (
            nextAction.loop === THREE.LoopOnce &&
            nextAction.time >= nextAction.getClip().duration - 0.001
          ) {
            nextAction
              .reset()
              .setEffectiveTimeScale(speed)
              .setEffectiveWeight(1)
              .fadeIn(0.05)
              .play();
          }
          return;
        }

        if (currentAction) currentAction.fadeOut(duration);
        nextAction
          .reset()
          .setEffectiveTimeScale(speed)
          .setEffectiveWeight(1)
          .fadeIn(duration)
          .play();
        currentAction = nextAction;
      }

      function sanitizeClip(clip, customName) {
        clip.name = customName;
        clip.tracks.forEach((track) => {
          if (track.name.includes("|"))
            track.name = track.name.split("|").pop();
          if (track.name.endsWith(".position")) {
            const startX = track.values[0];
            const startZ = track.values[2];
            for (let i = 0; i < track.values.length; i += 3) {
              track.values[i] = startX;
              track.values[i + 2] = startZ;
            }
          }
        });
        return clip;
      }

      const loader = new THREE.GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);

      function loadGLTF(url) {
        return new Promise((resolve) => {
          loader.load(
            url,
            (gltf) => resolve(gltf),
            undefined,
            () => resolve(null),
          );
        });
      }

      Promise.all([
        loadGLTF("assets/main/idle01.glb"),
        loadGLTF("assets/main/slow_run01.glb"),
        loadGLTF("assets/main/fast_run01.glb"),
        loadGLTF("assets/main/jump01.glb"),
        loadGLTF("assets/main/punch01.glb"),
        loadGLTF("assets/main/punch_left01.glb"),
        loadGLTF("assets/main/punch_crit01.glb"),
        loadGLTF("assets/main/punch_combo01.glb"),
        loadGLTF("assets/main/kick_electric.glb"),
        loadGLTF("assets/main/strafe_left.glb"),
        loadGLTF("assets/main/strafe_right.glb"),
      ]).then(
        ([
          idleGltf,
          slowGltf,
          fastGltf,
          jumpGltf,
          punchGltf,
          punchLeftGltf,
          critGltf,
          comboGltf,
          kickGltf,
          strafeLeftGltf,
          strafeRightGltf,
        ]) => {
          const baseGltf = idleGltf || slowGltf || fastGltf;
          if (!baseGltf) return;

          const model = baseGltf.scene;
          model.traverse((node) => {
            if (node.isMesh && node.material) {
              const mats = Array.isArray(node.material)
                ? node.material
                : [node.material];
              mats.forEach((m) => {
                m.depthWrite = true;
                m.alphaTest = 0.5;
                m.roughness = 0.8;
                m.metalness = 0.0;
                if (!m.userData.trueColor && m.color) {
                  m.userData.trueColor = m.color.getHex();
                }
              });
            }
          });

          character.add(model);
          mixer = new THREE.AnimationMixer(model);

          if (idleGltf && idleGltf.animations.length > 0)
            actions.idle = mixer.clipAction(
              sanitizeClip(idleGltf.animations[0], "idle"),
            );
          if (slowGltf && slowGltf.animations.length > 0)
            actions.slowRun = mixer.clipAction(
              sanitizeClip(slowGltf.animations[0], "slowRun"),
            );
          if (fastGltf && fastGltf.animations.length > 0)
            actions.fastRun = mixer.clipAction(
              sanitizeClip(fastGltf.animations[0], "fastRun"),
            );

          if (jumpGltf && jumpGltf.animations.length > 0) {
            actions.jump = mixer.clipAction(
              sanitizeClip(jumpGltf.animations[0], "jump"),
            );
            actions.jump.setLoop(THREE.LoopOnce);
            actions.jump.clampWhenFinished = true;
          }

          function setupAttack(gltf, key) {
            if (gltf && gltf.animations.length > 0) {
              actions[key] = mixer.clipAction(
                sanitizeClip(gltf.animations[0], key),
              );
              actions[key].setLoop(THREE.LoopOnce);
              actions[key].clampWhenFinished = true;
            }
          }

          setupAttack(punchGltf, "punch");
          setupAttack(punchLeftGltf, "punchLeft");
          setupAttack(critGltf, "punchCrit");
          setupAttack(comboGltf, "punchCombo");
          setupAttack(kickGltf, "kickElectric");

          // --- Strafe animations for A / D (looping) ---
          if (strafeLeftGltf && strafeLeftGltf.animations.length > 0) {
            actions.strafeLeft = mixer.clipAction(
              sanitizeClip(strafeLeftGltf.animations[0], "strafeLeft"),
            );
            actions.strafeLeft.setLoop(THREE.LoopRepeat);
          }
          if (strafeRightGltf && strafeRightGltf.animations.length > 0) {
            actions.strafeRight = mixer.clipAction(
              sanitizeClip(strafeRightGltf.animations[0], "strafeRight"),
            );
            actions.strafeRight.setLoop(THREE.LoopRepeat);
          }

          mixer.addEventListener("finished", (e) => {
            const attacks = [
              actions.punch,
              actions.punchLeft,
              actions.punchCrit,
              actions.punchCombo,
              actions.kickElectric,
            ];
            if (attacks.includes(e.action)) {
              isPunching = false;
              isComboSteering = false;
              isSpecialActive = false;
              checkQueuedSkill();
              if (!isPunching && isGrounded)
                playAction(
                  keys.w || keys.a || keys.s || keys.d ? "slowRun" : "idle",
                  0.12,
                );
            }
          });

          if (actions.idle) playAction("idle");
          updateSkillUI();
        },
      );
