
      function progressionFrame(delta) {
        healFrame(delta);
        updateHealVFX(performance.now() / 1000);
        if (
          waveBossPending() &&
          !bossObj &&
          !isPlayerDead &&
          !isTutorialActive
        ) {
          bossSpawnT += delta;
          if (bossSpawnT > 4) {
            bossSpawnT = 0;
            if (bossAsset) spawnBoss();
            else if (bossFailed) {
              prog.wave++;
              updateProgHud();
            } // no boss files: skip the boss wave
          }
        } else bossSpawnT = 0;
        bossFrame(delta);
        dragonFrame(delta);
        updateFire(delta);
        burnFrame(delta);

        if (isFrozen) {
          freezeT -= delta;
          freezeMesh.position.set(
            character.position.x,
            character.position.y + 1.2,
            character.position.z,
          );
          const ft = performance.now() * 0.001;
          freezeCore.rotation.y += delta * 0.6;
          freezeCore.rotation.x += delta * 0.3;
          freezeWire.rotation.y -= delta * 0.4;
          freezeHalo.scale.setScalar(1 + Math.sin(ft * 4) * 0.08);
          freezeHaloMat.opacity = 0.2 + Math.sin(ft * 5) * 0.1;
          freezeShards.forEach((s, idx) => {
            s.userData.angle += delta * 1.2;
            const r = 1.5 + Math.sin(ft * 3 + idx) * 0.2;
            s.position.x = Math.cos(s.userData.angle) * r;
            s.position.z = Math.sin(s.userData.angle) * r;
            s.position.y = s.userData.baseY + Math.sin(ft * 4 + idx) * 0.2;
            s.rotation.x += delta * 2;
            s.rotation.y += delta * 1.5;
          });
          if (freezeT <= 0) thawPlayer();
        }
        if (freezeImmuneT > 0) freezeImmuneT -= delta;
        if (upgradePicks > 0 && !upgradeOpen && !isPlayerDead) openUpgrade();
      }
      updateProgHud();

      const clock = new THREE.Clock();
      const treeRaycaster = new THREE.Raycaster();

      function renderLoop() {
        requestAnimationFrame(renderLoop);
        if (isNameModalOpen || isGamePaused) return;

        const delta = Math.min(clock.getDelta(), 0.08);
        grassUniforms.uTime.value = performance.now() / 1000;
        progressionFrame(delta);
        updateFocus(delta);

        if (strafeCooldown > 0)
          strafeCooldown -= delta / (prog.dodgeCdMult || 1);

        const _cdMult = isFocusing ? FOCUS_RATE : 1;
        if (skill1Cooldown > 0) {
          skill1Cooldown = Math.max(0, skill1Cooldown - delta * _cdMult);
          updateSkillUI();
        }
        if (skill2Cooldown > 0) {
          skill2Cooldown = Math.max(0, skill2Cooldown - delta * _cdMult);
          updateSkillUI();
        }

        // Fire a buffered punch click as soon as the previous punch has recovered
        if (punchBufferedAt && !isPlayerDead) {
          const nowMs = performance.now();
          if (nowMs - punchBufferedAt > 500) punchBufferedAt = 0;
          else if (
            !isSpecialActive &&
            !isDashing &&
            (!isPunching || nowMs - punchStartTime >= punchRecoverMs)
          ) {
            punchBufferedAt = 0;
            triggerPunch();
          }
        }

        // Execute the queued special skill the moment Ability 1 or 2 finishes
        if (queuedSkill && !isSpecialActive && !isDashing && !isPlayerDead) {
          checkQueuedSkill();
        }

        if (!isPlayerDead && playerHP < PLAYER_MAX_HP) {
          playerHP = Math.min(PLAYER_MAX_HP, playerHP + 0.8 * delta);
          updatePlayerUI();
        }

        if (isComboSteering && !isPlayerDead) {
          const aimHeading = yaw + Math.PI;
          let dAngle = aimHeading - character.rotation.y;
          while (dAngle < -Math.PI) dAngle += Math.PI * 2;
          while (dAngle > Math.PI) dAngle -= Math.PI * 2;
          character.rotation.y += dAngle * 0.25;
        }

        // Failsafe: if an attack flag somehow gets stuck, force it off after 1.2s
        if (isPunching) {
          if (punchStuckStart === 0) punchStuckStart = performance.now();
          else if (performance.now() - punchStuckStart > 1200) {
            isPunching = false;
            isSpecialActive = false;
            isComboSteering = false;
            punchStuckStart = 0;
          }
        } else {
          punchStuckStart = 0;
        }

        const move = new THREE.Vector3();
        if (!isPlayerDead && !isFrozen) {
          if (touchJoyVector.active) {
            // Smooth 360° Analog Joystick input
            move.x = touchJoyVector.x;
            move.z = touchJoyVector.y;
          } else {
            // Keyboard W/A/S/D input
            if (keys.w) move.z -= 1;
            if (keys.s) move.z += 1;
            if (keys.a) move.x -= 1;
            if (keys.d) move.x += 1;
          }
        }

        const isMoving = move.lengthSq() > 0.04;
        let currentSpeed = 7.5 * prog.speedMult;
        let animSpeed = 1.0;

        if (isMoving && !isPunching && !isPlayerDead) {
          runTime += delta;
          move.normalize();
          move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

          let targetAnim = "slowRun";
          let targetHeading = Math.atan2(move.x, move.z);

          // Strafe animations only apply to dedicated A / D keys on keyboard
          const isStrafingLeft =
            !touchJoyVector.active &&
            keys.a &&
            !keys.d &&
            !keys.w &&
            !keys.s &&
            actions.strafeLeft;
          const isStrafingRight =
            !touchJoyVector.active &&
            keys.d &&
            !keys.a &&
            !keys.w &&
            !keys.s &&
            actions.strafeRight;

          if (isStrafingLeft) {
            targetAnim = "strafeLeft";
            targetHeading = yaw + Math.PI;
            if (runTime >= 2.0) {
              currentSpeed = 16.0 * prog.speedMult;
              animSpeed = 1.8;
            }
          } else if (isStrafingRight) {
            targetAnim = "strafeRight";
            targetHeading = yaw + Math.PI;
            if (runTime >= 2.0) {
              currentSpeed = 16.0 * prog.speedMult;
              animSpeed = 1.8;
            }
          } else if (sprintActive) {
            currentSpeed = 16.0 * prog.speedMult;
            targetAnim = "fastRun";
          } else if (runTime >= 2.0) {
            currentSpeed = 16.0 * prog.speedMult;
            targetAnim = "fastRun";
          }

          let dAngle = targetHeading - character.rotation.y;
          while (dAngle < -Math.PI) dAngle += Math.PI * 2;
          while (dAngle > Math.PI) dAngle -= Math.PI * 2;
          character.rotation.y += dAngle * 0.22;

          if (isGrounded && !isDashing) playAction(targetAnim, 0.2, animSpeed);

          character.position.x += move.x * currentSpeed * delta;
          character.position.z += move.z * currentSpeed * delta;

          resolveFixtureCollisions(character.position);
        } else {
          runTime = 0;
          sprintActive = false; // 🏃 release the key → sprint ends
          if (isGrounded && !isPunching && !isDashing) playAction("idle", 0.25);
        }

        if (!isGrounded && !isPunching) playAction("jump", 0.15);
        if (mixer) mixer.update(isFrozen ? 0 : delta);
        updateLightningVFX();

        const floorY = getElevation(character.position.x, character.position.z);
        if (keys.space && isGrounded && !isFrozen) {
          velocityY = 13.5;
          Game.audio.play("jump");
          isGrounded = false;
        }

        velocityY -= 32 * delta;
        character.position.y += velocityY * delta;

        if (character.position.y <= floorY) {
          character.position.y = floorY;
          velocityY = 0;
          isGrounded = true;
        }

        const shoulderOffset = 0.85;
        const sideX = Math.cos(yaw) * shoulderOffset;
        const sideZ = -Math.sin(yaw) * shoulderOffset;

        let camX =
          character.position.x +
          Math.sin(yaw) * camDist * Math.cos(pitch) +
          sideX;
        let camZ =
          character.position.z +
          Math.cos(yaw) * camDist * Math.cos(pitch) +
          sideZ;
        let camY = character.position.y + 2.6 + Math.sin(pitch) * camDist;

        if (screenShakeTime > 0) {
          screenShakeTime -= delta;
          const shakePower =
            screenShakeMagnitude * (screenShakeTime / screenShakeDuration);
          camX += (Math.random() - 0.5) * shakePower;
          camY += (Math.random() - 0.5) * shakePower;
          camZ += (Math.random() - 0.5) * shakePower;
        }

        const groundAtCamera = getElevation(camX, camZ);
        if (camY < groundAtCamera + 0.6) camY = groundAtCamera + 0.6;

        camera.position.set(camX, camY, camZ);
        camera.lookAt(
          character.position.x + sideX * 0.25,
          character.position.y + 1.5,
          character.position.z + sideZ * 0.25,
        );

        if (treeMeshes.length > 0) {
          const charHead = new THREE.Vector3(
            character.position.x,
            character.position.y + 1.6,
            character.position.z,
          );
          const toCam = new THREE.Vector3().subVectors(
            camera.position,
            charHead,
          );
          treeRaycaster.set(charHead, toCam.clone().normalize());
          const hits = treeRaycaster.intersectObjects(treeMeshes, false);
          const hitMeshes = new Set();
          for (const hit of hits) {
            if (hit.distance < toCam.length()) hitMeshes.add(hit.object);
          }
          for (const tm of treeMeshes) {
            const targetOpacity = hitMeshes.has(tm) ? 0.18 : 1.0;
            // smooth fade instead of a hard snap
            tm.material.opacity += (targetOpacity - tm.material.opacity) * 0.25;
            // while faded, don't write depth so it can't hide the player
            tm.material.depthWrite = tm.material.opacity > 0.95;
          }
        }
        renderer.render(scene, camera);
      }
      requestAnimationFrame(renderLoop);

      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
