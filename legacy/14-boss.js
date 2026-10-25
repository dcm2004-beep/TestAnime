
      // ---------- Boss ----------
      const BOSS_DIR = "assets/boss/boss1/";
      const BOSS_CLIPS = [
        "idle",
        "walk",
        "attack1",
        "attack2",
        "attack3",
        "dodge",
        "fall",
        "get_up",
        "fireball",
        "death",
      ];
      const BOSS_ATTACKS = {
        attack1: { frame: 30, dmg: 150 },
        attack2: { frame: 18, dmg: 80 },
        attack3: { frame: 32, dmg: 300 },
      };
      const BOSS_PATTERNS = [
        ["attack1"],
        ["attack1", "attack2", "attack3"],
        ["attack1", "attack3"],
      ];
      const BOSS_BASE_HP = 12000,
        BOSS_FIRE_DMG = 170;
      let bossAsset = null,
        bossFailed = false,
        bossObj = null,
        bossSpawnT = 0;
      const bossFixture = { x: 0, z: 0, radius: 0, h: 99 };
      Promise.all(BOSS_CLIPS.map((n) => loadGLTF(`${BOSS_DIR}${n}.glb`))).then(
        (g) => {
          if (!g[0]) {
            bossFailed = true;
            console.warn("Boss files not found in " + BOSS_DIR);
            return;
          }
          bossAsset = {};
          BOSS_CLIPS.forEach((n, i) => (bossAsset[n] = g[i]));
        },
      );
      const angDiff = (a, b) => {
        let d = b - a;
        while (d < -Math.PI) d += Math.PI * 2;
        while (d > Math.PI) d -= Math.PI * 2;
        return Math.abs(d);
      };
      function lerpAngle(a, b, t) {
        let d = b - a;
        while (d < -Math.PI) d += Math.PI * 2;
        while (d > Math.PI) d -= Math.PI * 2;
        return a + d * t;
      }

      function bossPlay(b, name, fade = 0.15, speed = 1) {
        const a = b.acts[name];
        if (!a) return null;
        if (b.cur === a && a.loop !== THREE.LoopOnce) {
          a.setEffectiveTimeScale(speed);
          return a;
        }
        if (b.cur && b.cur !== a) b.cur.fadeOut(fade);
        a.reset()
          .setEffectiveTimeScale(speed)
          .setEffectiveWeight(1)
          .fadeIn(fade)
          .play();
        b.cur = a;
        return a;
      }
      function spawnBoss() {
        if (!bossAsset || bossObj) return;
        Game.audio.play("bossSpawn");
        const mesh = cloneSkinnedMesh(bossAsset.idle.scene);
        mesh.scale.setScalar(BOSS_SCALE);
        const hands = [],
          bones = [];
        mesh.traverse((n) => {
          if (n.isBone) bones.push(n);
          if (
            n.isBone &&
            /hand/i.test(n.name) &&
            !/(thumb|index|middle|ring|pinky|finger)/i.test(n.name)
          )
            hands.push(n);
          if (n.isMesh) {
            n.castShadow = true;
            n.frustumCulled = false;
            if (n.material) {
              n.material = n.material.clone();
              n.material.transparent = true;
              n.material.depthWrite = true;
              if (n.material.color)
                n.material.userData.trueColor = n.material.color.getHex();
            }
          }
        });
        const a = Math.random() * Math.PI * 2;
        mesh.position.set(
          character.position.x + Math.sin(a) * 22,
          0,
          character.position.z + Math.cos(a) * 22,
        );
        mesh.position.y = getElevation(mesh.position.x, mesh.position.z);
        scene.add(mesh);
        const mixer = new THREE.AnimationMixer(mesh);
        const acts = {};
        BOSS_CLIPS.forEach((n) => {
          const g = bossAsset[n];
          if (!g || !g.animations.length) return;
          const act = mixer.clipAction(sanitizeClip(g.animations[0], n));
          if (n !== "idle" && n !== "walk") {
            act.setLoop(THREE.LoopOnce);
            act.clampWhenFinished = true;
          }
          acts[n] = act;
        });
        const baseMult = Math.pow(1.2, prog.bosses);
        const b = {
          isBoss: true,
          mesh,
          mixer,
          acts,
          hands,
          bones,
          lift: 0,
          kb: null,
          cur: null,
          state: "alive",
          ai: "move",
          hp: Math.round(BOSS_BASE_HP * baseMult),
          maxHp: Math.round(BOSS_BASE_HP * baseMult),
          hpBar: { group: new THREE.Group() },
          baseMult,
          dmgMult: 1,
          fallsDone: 0,
          attackTimer: 2.5,
          plan: null,
          pattern: [],
          pIdx: 0,
          lockAng: 0,
          atk: null,
          dodgeCd: 3,
          fireCd: 4,
          comboCd: 4,
          comboChargeRing: null,
          comboTimer: 0,
          comboQueue: null,
          comboStep: 0,
          comboLockAng: 0,
          fireTick: 0,
          fallT: 0,
          deathT: 0,
          farT: 0,
          isAttacking: false,
          dodgeVx: 0,
          dodgeVz: 0,
        };
        mixer.addEventListener("finished", (e) => {
          if (e.action !== b.cur) return;
          if (b.ai === "attack" || b.ai === "fire") {
            b.ai = "move";
            b.attackTimer = 0.6 + Math.random() * 0.6;
          } else if (b.ai === "comboAttack") {
            b.comboStep++;
            if (b.comboStep < b.comboQueue.length) {
              // FULL chase: boss re-locks onto the player's CURRENT position
              // between every swing — cannot be escaped by circling
              const dxp = character.position.x - b.mesh.position.x;
              const dzp = character.position.z - b.mesh.position.z;
              const newAng = Math.atan2(dxp, dzp);
              b.comboLockAng = newAng;
              b.lockAng = newAng;
              b.mesh.rotation.y = newAng + BOSS_FACING;
              const nextName = b.comboQueue[b.comboStep];
              b.atk = { ...BOSS_ATTACKS[nextName], hit: false };
              bossPlay(b, nextName, 0.05, 3.0);
            } else {
              b.ai = "move";
              b.attackTimer = 1.0;
              b.plan = null;
              b.atk = null;
              b.comboCd = 5;
            }
          } else if (b.ai === "dodge") {
            b.ai = "move";
            b.attackTimer = Math.max(b.attackTimer, 0.4);
          } else if (b.ai === "getup") {
            b.ai = "move";
            b.attackTimer = 0.8;
            b.dmgMult *= 1.2;
            popAt(b.mesh.position, "ENRAGED +20% DMG", "crit", 3.5);
          }
        });
        bossPlay(b, "idle", 0);
        bossObj = b;
        activeBats.push(b);
        bossFixture.radius = BOSS_RADIUS * BOSS_SCALE;
        fixtures.push(bossFixture);
        $("boss-hud").style.display = "block";
        $("boss-fill").style.width = "100%";
        $("boss-hp-txt").innerText = `${b.hp} / ${b.maxHp}`;
        banner("⚔ BOSS FIGHT ⚔", 2600);
      }
      function removeBoss() {
        const b = bossObj;
        if (!b) return;
        if (b.fireSfx) b.fireSfx.stop(0.1);
        clearBossComboRing(b);
        scene.remove(b.mesh);
        const i = activeBats.indexOf(b);
        if (i >= 0) activeBats.splice(i, 1);
        const fi = fixtures.indexOf(bossFixture);
        if (fi >= 0) fixtures.splice(fi, 1);
        bossObj = null;
        $("boss-hud").style.display = "none";
        updateBatUI();
      }
      function startMelee(b, toP) {
        if (b.pIdx >= b.pattern.length) {
          b.pattern =
            BOSS_PATTERNS[Math.floor(Math.random() * BOSS_PATTERNS.length)];
          b.pIdx = 0;
        }
        const name = b.pattern[b.pIdx++];
        b.plan = null;
        b.lockAng = toP; // direction is locked for the whole swing so it can be dodged
        b.mesh.rotation.y = toP + BOSS_FACING;
        b.atk = { ...BOSS_ATTACKS[name], hit: false };
        if (!bossPlay(b, name, 0.1, 2.0)) {
          b.attackTimer = 2;
          return;
        }
        b.ai = "attack";
      }
      function startFireball(b, toP) {
        b.plan = null;
        b.lockAng = toP;
        b.mesh.rotation.y = toP + BOSS_FACING;
        b.fireTick = 0;
        b.fireCd = 7 + Math.random() * 3;
        if (!bossPlay(b, "fireball", 0.1, 1.5)) {
          b.attackTimer = 2;
          return;
        }
        b.ai = "fire";
        // 🔊 Wind-up sound lasts exactly as long as the wind-up animation (frames 0..FIRE_START at 1.5x speed)
        b.flameOn = false;
        if (b.fireSfx) b.fireSfx.stop(0.1);
        b.fireSfx = Game.audio.play("bossFireCharge", { duration: BOSS_FIRE_START / BOSS_FPS / 1.5 });
      }
      function startDodge(b) {
        if (b.fireSfx) b.fireSfx.stop(0.1); // interrupted fireball: cut its sound
        const M = b.mesh.position,
          P = character.position;
        const toP = Math.atan2(P.x - M.x, P.z - M.z);
        const act = bossPlay(b, "dodge", 0.08);
        if (!act) return false;
        const side = Math.random() < 0.5 ? 1 : -1,
          sp = (3.6 * BOSS_SPD) / Math.max(0.3, act.getClip().duration);
        b.mesh.rotation.y = toP + BOSS_FACING;
        b.dodgeVx = Math.cos(toP) * side * sp;
        b.dodgeVz = -Math.sin(toP) * side * sp;
        b.ai = "dodge";
        b.dodgeCd = 4;
        b.plan = null;
        popAt(M, "DODGE", "dodge", 3);
        return true;
      }
      function clearBossComboRing(b) {
        if (b.comboChargeRing) {
          scene.remove(b.comboChargeRing);
          b.comboChargeRing.geometry.dispose();
          b.comboChargeRing.material.dispose();
          b.comboChargeRing = null;
        }
      }

      function startBossCombo(b, toP) {
        b.plan = null;
        b.ai = "comboCharge";
        b.comboTimer = 1.0;
        b.comboLockAng = toP;
        b.lockAng = toP;
        b.mesh.rotation.y = toP + BOSS_FACING;
        b.comboQueue = [
          "attack1",
          "attack2",
          "attack3",
          "attack1",
          "attack2",
          "attack3",
        ];
        b.comboStep = 0;
        b.atk = null;
        b.comboCd = 8;
        bossPlay(b, "idle", 0.2);
        popAt(b.mesh.position, "⚡ COMBO CHARGE ⚡", "crit", 3.8);

        // Red telegraph ring
        clearBossComboRing(b);
        const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff1a53,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(
          b.mesh.position.x,
          getElevation(b.mesh.position.x, b.mesh.position.z) + 0.15,
          b.mesh.position.z,
        );
        scene.add(ring);
        b.comboChargeRing = ring;
      }

      function startFall(b) {
        if (b.fireSfx) b.fireSfx.stop(0.1);
        b.ai = "fall";
        b.fallT = 0;
        b.plan = null;
        bossPlay(b, "fall", 0.1);
        popAt(b.mesh.position, "STAGGERED!", "crit", 3.5);
      }
      function bossMeleeHit(b, dmg) {
        const M = b.mesh.position,
          P = character.position;
        const dx = P.x - M.x,
          dz = P.z - M.z;
        if (
          Math.hypot(dx, dz) > BOSS_REACH ||
          angDiff(b.lockAng, Math.atan2(dx, dz)) > (65 * Math.PI) / 180
        )
          return;
        if (isDashing) {
          spawnDodgeText();
          return;
        }
        triggerScreenShake(0.2, 0.15);
        damagePlayer(Math.round(dmg * b.baseMult * b.dmgMult), b);
      }
      function bossFireHit(b, portion = 1) {
        const M = b.mesh.position,
          P = character.position;
        const dx = P.x - M.x,
          dz = P.z - M.z;
        if (Math.hypot(dx, dz) > 19) return;
        const deg = (angDiff(b.lockAng, Math.atan2(dx, dz)) * 180) / Math.PI;
        const mult = deg <= 60 ? 1 : deg <= 90 ? 0.5 : 0; // 120° cone full damage, +30° each side half damage
        if (!mult) return;
        if (isDashing) {
          spawnDodgeText();
          return;
        }
        triggerScreenShake(0.25, 0.2);
        damagePlayer(
          Math.round(BOSS_FIRE_DMG * mult * portion * b.baseMult * b.dmgMult),
          b,
          "ranged",
        );
      }
      function damageBoss(b, amount, hitType = "normal") {
        if (b.state !== "alive") return;
        if (b.ai === "dodge" || b.ai === "fall" || b.ai === "getup") {
          popAt(b.mesh.position, "IMMUNE", "miss", 3);
          return;
        }
        // occasional dodge of normal hits (not skills), only while not mid-attack
        if (
          b.ai === "move" &&
          b.fallsDone >= 0 &&
          b.dodgeCd <= 0 &&
          (hitType === "normal" || hitType === "crit" || hitType === "combo") &&
          Math.random() < 0.4 &&
          startDodge(b)
        )
          return;
        if (hitType === "electric" || hitType === "electric-crit") {
          // Thunder Kick can't pass through the boss: it shoves it back the full kick distance
          const kx = b.mesh.position.x - character.position.x,
            kz = b.mesh.position.z - character.position.z,
            kd = Math.hypot(kx, kz) || 1;
          b.kb = { left: 6.5, vx: kx / kd, vz: kz / kd };
        }
        b.hp = Math.max(0, b.hp - amount);
        totalDamageDealt += amount;
        Game.audio.hit(hitType);
        const ls = $("live-damage-score");
        if (ls) ls.innerText = totalDamageDealt.toLocaleString();
        const txt =
          hitType === "crit"
            ? `${amount}! CRIT`
            : hitType === "electric-crit"
              ? `${amount}! ⚡ CRIT`
              : hitType === "electric"
                ? `${amount} ⚡`
                : hitType === "combo"
                  ? `${amount} 💥`
                  : hitType === "reflect"
                    ? `${amount} 🩸`
                    : `${amount}`;
        popAt(
          b.mesh.position,
          txt,
          hitType.includes("crit")
            ? "crit"
            : hitType === "electric"
              ? "electric"
              : hitType === "combo"
                ? "combo"
                : "",
          3.2,
        );
        b.mesh.traverse((n) => {
          if (
            n.isMesh &&
            n.material &&
            n.material.color &&
            n.material.userData.trueColor !== undefined
          ) {
            n.material.color.setHex(0xff3355);
            setTimeout(
              () => n.material.color.setHex(n.material.userData.trueColor),
              110,
            );
          }
        });
        $("boss-fill").style.width = `${(b.hp / b.maxHp) * 100}%`;
        $("boss-hp-txt").innerText = `${b.hp} / ${b.maxHp}`;
        if (b.hp <= 0) return bossDie(b);
        const pct = b.hp / b.maxHp;
        if (
          (b.fallsDone === 0 && pct <= 0.66) ||
          (b.fallsDone === 1 && pct <= 0.33)
        ) {
          b.fallsDone++;
          startFall(b);
        }
      }
      function bossDie(b) {
        if (b.fireSfx) b.fireSfx.stop(0.1);
        Game.audio.play("bossDie");
        b.state = "dying";
        clearBossComboRing(b);
        b.ai = "dying";
        b.deathT = 0;
        bossFixture.radius = 0;
        b.kb = null;
        batSpawnCooldown = Math.max(batSpawnCooldown, 2); // 2s breather before bats return
        bossPlay(b, "death", 0.1);
        $("boss-hud").style.display = "none";
        gainXP(400 + 80 * prog.wave);
        prog.bosses++;
        prog.wave++;
        prog.kills = 0;
        updateProgHud();
        banner(
          "BOSS DEFEATED!<br><span style='font-size:22px'>All enemies are now 20% stronger</span>",
          4200,
        );
      }
      function bossLift(b, delta) {
        // keeps the body above the floor while it lies down / gets up / dies
        let target = 0;
        if (b.ai === "fall" || b.ai === "getup" || b.ai === "dying") {
          b.mesh.updateMatrixWorld(true);
          let minY = Infinity;
          for (const bn of b.bones)
            minY = Math.min(minY, bn.matrixWorld.elements[13]);
          target = Math.max(
            0,
            0.3 * BOSS_SCALE -
              (minY -
                getElevation(b.mesh.position.x, b.mesh.position.z) -
                b.lift),
          );
        }
        b.lift += (target - b.lift) * Math.min(1, 12 * delta);
      }
      function moveBossSafely(b, stepX, stepZ) {
        const M = b.mesh.position;
        let newX = M.x + stepX;
        let newZ = M.z + stepZ;
        // 🔮 Predictive collision: clamp destination to fixture edge BEFORE moving
        for (const f of fixtures) {
          if (f === bossFixture) continue;
          const ndx = newX - f.x;
          const ndz = newZ - f.z;
          const nd = Math.hypot(ndx, ndz);
          const min = f.radius + bossFixture.radius;
          if (nd < min) {
            if (nd > 0.001) {
              newX = f.x + (ndx / nd) * min;
              newZ = f.z + (ndz / nd) * min;
            } else {
              // Boss exactly on fixture center — nudge out
              newX = f.x + min;
              newZ = f.z;
            }
          }
        }
        M.x = newX;
        M.z = newZ;
      }

      function bossFrame(delta) {
        const b = bossObj;
        if (!b) return;
        b.mixer.update(delta);
        const M = b.mesh.position,
          P = character.position;
        if (b.ai === "dying") {
          b.deathT += delta;
          if (b.deathT > 4)
            b.mesh.traverse((n) => {
              if (n.isMesh && n.material)
                n.material.opacity = Math.max(
                  0,
                  n.material.opacity - delta * 0.7,
                );
            });
          if (b.deathT > 7) removeBoss();
          else {
            bossLift(b, delta);
            M.y = getElevation(M.x, M.z) + b.lift;
          }
          return;
        }
        const dx = P.x - M.x,
          dz = P.z - M.z,
          dist = Math.hypot(dx, dz),
          toP = Math.atan2(dx, dz);
        b.dodgeCd -= delta;
        b.fireCd -= delta;
        if (b.comboCd > 0) b.comboCd -= delta;
        // running far away makes the boss speed up after a short grace period
        b.farT = dist > 18 ? b.farT + delta : Math.max(0, b.farT - 2 * delta);
        const chase = b.farT > 3.5 ? 2.5 + Math.min(4, b.farT - 3.5) : 1;

        if (b.ai === "move") {
          b.mesh.rotation.y = lerpAngle(
            b.mesh.rotation.y,
            toP + BOSS_FACING,
            Math.min(1, 6 * delta),
          );
          if (dist > BOSS_STOP) {
            const stepDist = Math.min(4 * BOSS_SPD * chase * delta, 0.9);
            moveBossSafely(b, (dx / dist) * stepDist, (dz / dist) * stepDist);
            bossPlay(b, "walk", 0.2, Math.min(2.5, chase));
          } else bossPlay(b, "idle", 0.25);
          // ⚡ Catch-up contact damage — punishes players who run too far
          if (b.farT > 3.5 && dist <= BOSS_STOP + 1.5) {
            b.catchupContactCd = (b.catchupContactCd || 0) - delta;
            if (b.catchupContactCd <= 0) {
              b.catchupContactCd = 1.0;
              if (Math.random() < 0.5) {
                // ⚡ Dodgeable — dash through it like any other boss attack
                if (isDashing || isSkill2Immune || isDragonFistImmune) {
                  spawnDodgeText();
                } else {
                  damagePlayer(Math.round(130 * b.baseMult * b.dmgMult), b);
                  triggerScreenShake(0.18, 0.12);
                  popAt(character.position, "CATCH-UP HIT!", "crit", 2.8);
                }
              }
            }
          }
          b.attackTimer -= delta;
          if (b.attackTimer <= 0) {
            if (!b.plan) {
              const comboChance =
                b.fallsDone >= 2 ? 0.45 : b.fallsDone >= 1 ? 0.28 : 0.15;
              if (
                b.comboCd <= 0 &&
                dist >= 2.5 &&
                dist <= BOSS_STOP + 6 &&
                Math.random() < comboChance
              ) {
                b.plan = "combo";
              } else if (
                b.fallsDone >= 1 &&
                b.fireCd <= 0 &&
                Math.random() < (dist > 5.5 ? 0.85 : 0.2)
              ) {
                b.plan = "fire";
              } else {
                b.plan = "melee";
              }
            }
            if (b.plan === "combo" && dist >= 2.0 && dist <= BOSS_STOP + 6.5) {
              startBossCombo(b, toP);
            } else if (b.plan === "fire" && dist < 18) startFireball(b, toP);
            else if (b.plan === "melee" && dist <= BOSS_STOP + 0.7)
              startMelee(b, toP);
          }
        } else if (b.ai === "comboCharge") {
          b.comboTimer -= delta;
          if (b.comboChargeRing) {
            b.comboChargeRing.position.set(
              M.x,
              getElevation(M.x, M.z) + 0.15,
              M.z,
            );
            const s = 1 + (1 - Math.max(0, b.comboTimer)) * 1.5;
            b.comboChargeRing.scale.set(s, 1, s);
            b.comboChargeRing.material.opacity =
              0.4 + Math.max(0, b.comboTimer) * 0.5;
          }
          if (b.comboTimer <= 0) {
            clearBossComboRing(b);
            b.ai = "comboAttack";
            b.comboStep = 0;
            b.lockAng = b.comboLockAng;
            b.atk = { ...BOSS_ATTACKS[b.comboQueue[0]], hit: false };
            bossPlay(b, b.comboQueue[0], 0.05, 3.0);
          }
        } else if (b.ai === "comboAttack") {
          if (
            b.atk &&
            !b.atk.hit &&
            b.cur &&
            b.cur.time >= b.atk.frame / BOSS_FPS
          ) {
            b.atk.hit = true;
            bossMeleeHit(b, b.atk.dmg);
            triggerScreenShake(0.12, 0.08);
          }
          // Forward lunge during the combo — clamped so it can't overshoot into a tree
          const fwd = new THREE.Vector3(
            Math.sin(b.lockAng),
            0,
            Math.cos(b.lockAng),
          );
          const lungeSpd = 3.5 * BOSS_SPD * delta;
          moveBossSafely(b, fwd.x * lungeSpd, fwd.z * lungeSpd);
        } else if (b.ai === "attack") {
          if (!b.atk.hit && b.cur && b.cur.time >= b.atk.frame / BOSS_FPS) {
            b.atk.hit = true;
            bossMeleeHit(b, b.atk.dmg);
          }
        } else if (b.ai === "fire") {
          const fr = b.cur ? b.cur.time * BOSS_FPS : 0;
          if (fr >= BOSS_FIRE_START && fr <= BOSS_FIRE_END) {
            if (!b.flameOn) {
              // 🔊 Flame sound lasts exactly as long as the damage window left in the animation
              b.flameOn = true;
              if (b.fireSfx) b.fireSfx.stop(0.05);
              b.fireSfx = Game.audio.play("bossFlame", { duration: (BOSS_FIRE_END - fr) / BOSS_FPS / 1.5 });
            }
            const p =
              (fr - BOSS_FIRE_START) / (BOSS_FIRE_END - BOSS_FIRE_START);
            firePoints.material.size = (1.3 + 2.4 * p) * BOSS_SPD; // the fireball grows
            emitFireFromHands(b, delta, p);
            while (b.fireTick <= 4 && p >= b.fireTick / 4) {
              b.fireTick++;
              bossFireHit(b, 0.2);
            } // 5 damage ticks during frames 57-80
          }
        } else if (b.ai === "dodge") {
          M.x += b.dodgeVx * delta;
          M.z += b.dodgeVz * delta;
        } else if (b.ai === "fall") {
          b.fallT += delta;
          if (b.fallT >= 3) {
            b.ai = "getup";
            if (!bossPlay(b, "get_up", 0.15)) {
              b.ai = "move";
              b.attackTimer = 1.5;
              b.dmgMult *= 1.2;
            }
          }
        }
        if (b.kb && b.kb.left > 0) {
          const s = Math.min(b.kb.left, 17 * delta);
          M.x += b.kb.vx * s;
          M.z += b.kb.vz * s;
          b.kb.left -= s;
        }
        for (const f of fixtures) {
          if (f === bossFixture) continue;
          const ddx = M.x - f.x,
            ddz = M.z - f.z,
            d = Math.hypot(ddx, ddz),
            min = f.radius + bossFixture.radius;
          if (d < min && d > 0.001) {
            M.x = f.x + (ddx / d) * min;
            M.z = f.z + (ddz / d) * min;
          }
        }
        bossLift(b, delta);
        M.y = getElevation(M.x, M.z) + b.lift;
        bossFixture.x = M.x;
        bossFixture.z = M.z;
      }
