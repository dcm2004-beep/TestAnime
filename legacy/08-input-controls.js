      // ⚡⚡ end focus channel ⚡⚡

      // ========================================================
      // 4. CONTROLS & CAMERA DYNAMICS (UPDATED FOR DOUBLE TAP)
      // ========================================================
      const keys = { w: false, a: false, s: false, d: false, space: false };
      let strafeCooldown = 0;
      let lastKeyTimeW = 0;
      let lastKeyTimeS = 0;
      let lastKeyTimeA = 0;
      let lastKeyTimeD = 0;
      let isDashing = false;
      let sprintActive = false;
      let punchStuckStart = 0;

      const DOUBLE_TAP_MS = 300;

      // Skill input buffer: 1 / 2 pressed mid-action are remembered and fire
      // automatically as soon as the current animation clears (within 400ms).
      let bufferedSkill = null;
      let bufferedSkillTime = 0;
      const SKILL_BUFFER_WINDOW = 400;

      const DODGE_DISTANCE = 3.8;
      const DODGE_TIME_MS = 150;

      // 4-Way Dash: sideDir (-1 = Left, 1 = Right), fwdDir (1 = Forward, -1 = Backward)
      function dashPlayer(sideDir, fwdDir) {
        if (isDashing || isFrozen) return;

        if (isPunching && !isSpecialActive) {
          isPunching = false;
          isComboSteering = false;
          punchToken++;
        }

        isDashing = true;
        character.rotation.y = yaw + Math.PI;

        const steps = 10;
        const stepDist = (DODGE_DISTANCE * prog.dodgeDistMult) / steps;
        const stepMs = DODGE_TIME_MS / steps;
        let count = 0;

        // Calculate world dash vector based on camera angle
        const forwardVec = new THREE.Vector3(
          -Math.sin(yaw),
          0,
          -Math.cos(yaw),
        ).multiplyScalar(fwdDir);
        const rightVec = new THREE.Vector3(
          Math.cos(yaw),
          0,
          -Math.sin(yaw),
        ).multiplyScalar(sideDir);
        const dashDirection = new THREE.Vector3()
          .addVectors(forwardVec, rightVec)
          .normalize();

        triggerScreenShake(0.1, 0.15);
        spawnDashRing(dashDirection);

        // Play matching dash animation
        let dashAnim = "fastRun";
        if (sideDir < 0) dashAnim = "strafeLeft";
        else if (sideDir > 0) dashAnim = "strafeRight";
        else if (fwdDir < 0) dashAnim = "slowRun"; // Backstep

        if (actions[dashAnim]) playAction(dashAnim, 0.05, 2.4);

        const dashTimer = setInterval(() => {
          if (isGamePaused || isPlayerDead) {
            clearInterval(dashTimer);
            isDashing = false;
            return;
          }
          character.position.addScaledVector(dashDirection, stepDist);

          resolveFixtureCollisions(character.position);
          count++;
          if (count >= steps) {
            clearInterval(dashTimer);
            isDashing = false;
          }
        }, stepMs);
      }

      // Cyan directional shockwave — opens toward the dash direction so it
      // always trails BEHIND the character's actual movement.
      function spawnDashRing(dashDir) {
        // 180° arc (half-ring). The "gap" is what we orient toward movement.
        const ringGeo = new THREE.RingGeometry(0.4, 0.8, 32, 1, 0, Math.PI);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x9be7ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        const gy = getElevation(character.position.x, character.position.z);
        ring.position.set(
          character.position.x,
          gy + 0.12,
          character.position.z,
        );

        // Rotate the arc so its opening faces the dash direction.
        // After rotateX(-PI/2) the arc's gap starts at +Z (angle PI/2 in XZ).
        // Y-rotation R shifts the gap to (PI/2 - R); we want it at
        // atan2(dashDir.z, dashDir.x), so R = PI/2 - atan2(z, x).
        if (dashDir && (dashDir.x !== 0 || dashDir.z !== 0)) {
          ring.rotation.y = Math.PI / 2 - Math.atan2(dashDir.z, dashDir.x);
        }

        scene.add(ring);
        let s = 1.0;
        const timer = setInterval(() => {
          s += 0.3;
          ring.scale.set(s, 1, s);
          ring.material.opacity -= 0.08;
          if (ring.material.opacity <= 0) {
            clearInterval(timer);
            scene.remove(ring);
            ringGeo.dispose();
            ringMat.dispose();
          }
        }, 16);
      }

      let yaw = 0,
        pitch = 0.2;
      let velocityY = 0;
      let isGrounded = true;
      let runTime = 0;
      let isGamePaused = false;

      function togglePause(state) {
        if (isPlayerDead) return;
        endFocus(false);
        isGamePaused = state !== undefined ? state : !isGamePaused;
        const ps = document.getElementById("pause-screen");
        if (ps) ps.style.display = isGamePaused ? "flex" : "none";
        if (isGamePaused) {
          document.exitPointerLock();
        } else {
          clock.getDelta();
          batClock.getDelta();
          document.body.requestPointerLock();
        }
      }

      function resumeGame() {
        // Fullscreen FIRST (must fire synchronously in the tap gesture)
        try {
          const el = document.documentElement;
          if (
            !document.fullscreenElement &&
            !document.webkitFullscreenElement
          ) {
            if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
            else if (el.webkitRequestFullscreen)
              el.webkitRequestFullscreen().catch(() => {});
          }
        } catch (e) {}

        // ✅ Actually unpause (previously this called itself recursively)
        isGamePaused = false;
        const ps = document.getElementById("pause-screen");
        if (ps) ps.style.display = "none";
        clock.getDelta();
        batClock.getDelta();
        try {
          document.body.requestPointerLock();
        } catch (e) {}

        try {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(() => {});
          }
        } catch (e) {}
      }

      document.addEventListener("pointerlockchange", () => {
        if (isNameModalOpen) return;
        if (isTutorialActive) return;
        if (
          document.pointerLockElement !== document.body &&
          !isPlayerDead &&
          !isGamePaused
        )
          togglePause(true);
      });

      window.addEventListener("blur", () => {
        if (!isPlayerDead && !isNameModalOpen) togglePause(true);
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && !isPlayerDead && !isNameModalOpen)
          togglePause(true);
      });

      window.addEventListener("keydown", (e) => {
        // If the name prompt is open, only allow typing in the name box
        if (isNameModalOpen) {
          if (e.key === "Enter") submitPlayerName();
          return;
        }

        // 🎓 Tutorial: T or Escape finishes and starts the real battle
        if (isTutorialActive) {
          const tk = e.key.toLowerCase();
          if (tk === "t" || e.key === "Escape" || e.code === "Escape") {
            e.preventDefault();
            finishTutorial();
            return;
          }
        }

        const k = e.key.toLowerCase();
        if (isGamePaused) {
          if (performance.now() - pauseJustActivatedAt < 350) return;
          resumeGame();
          return;
        }
        if (k === "p" || e.code === "Escape" || e.key === "Escape") {
          togglePause();
          return;
        }
        if (k === "r" && isPlayerDead) {
          respawnPlayer();
          return;
        }
        if (isPlayerDead) return;

        // ⚠️ OS auto-repeat must never count as a second tap — otherwise
        // holding A/D spams the dash instead of just walking sideways.
        if (e.repeat) return;

        const now = performance.now();

        if (k === "w") {
          keys.w = true;
          if (now - lastKeyTimeW < DOUBLE_TAP_MS && strafeCooldown <= 0) {
            dashPlayer(0, 1); // ⚡ Double-tap W: Forward Lunge
            strafeCooldown = 0.5;
            lastKeyTimeW = 0;
            sprintActive = true; // 🏃 and immediately sprint while held
          } else {
            lastKeyTimeW = now;
          }
        }

        if (k === "s") {
          keys.s = true;
          if (now - lastKeyTimeS < DOUBLE_TAP_MS && strafeCooldown <= 0) {
            dashPlayer(0, -1); // ⚡ Double-tap S: Evasive Backstep
            strafeCooldown = 0.5;
            lastKeyTimeS = 0;
            sprintActive = true; // 🏃 and immediately sprint backward while held
          } else {
            lastKeyTimeS = now;
          }
        }

        if (k === "a") {
          keys.a = true;
          if (now - lastKeyTimeA < DOUBLE_TAP_MS && strafeCooldown <= 0) {
            dashPlayer(-1, 0); // ⚡ Double-tap A: Left Dodge
            strafeCooldown = 0.5;
            lastKeyTimeA = 0;
          } else {
            lastKeyTimeA = now;
          }
        }

        if (k === "d") {
          keys.d = true;
          if (now - lastKeyTimeD < DOUBLE_TAP_MS && strafeCooldown <= 0) {
            dashPlayer(1, 0); // ⚡ Double-tap D: Right Dodge
            strafeCooldown = 0.5;
            lastKeyTimeD = 0;
          } else {
            lastKeyTimeD = now;
          }
        }

        if (e.code === "Space") keys.space = true;
        if (k === "f") triggerPunch();

        if ((k === "1" || e.code === "Digit1") && !e.repeat) {
          if (isSpecialActive || isDashing) {
            queueSpecialSkill("combo");
          } else {
            triggerSkillCombo();
          }
        }
        if ((k === "2" || e.code === "Digit2") && !e.repeat) {
          if (isSpecialActive || isDashing) {
            queueSpecialSkill("kick");
          } else {
            triggerSkillElectricKick();
          }
        }
      });

      document.body.addEventListener("mousedown", (e) => {
        if (isNameModalOpen) return;
        if (isPlayerDead) return;
        if (isGamePaused) {
          resumeGame();
          return;
        }
        if (
          e.target.closest("#ui-container") ||
          e.target.closest("#death-screen") ||
          e.target.closest("#name-modal") ||
          e.target.closest("#tutorial-overlay") ||
          e.target.closest("#mode-modal")
        )
          return;

        // 🎓 Tutorial has no pointer lock — LMB = punch, RMB = focus
        if (isTutorialActive) {
          if (e.button === 0) triggerPunch();
          else if (e.button === 2) beginFocus();
          return;
        }

        if (document.pointerLockElement !== document.body) {
          document.body.requestPointerLock();
          return;
        }
        if (e.button === 0) triggerPunch();
        else if (e.button === 2) beginFocus();
      });

      window.addEventListener("mouseup", (e) => {
        if (e.button === 2) endFocus(false);
      });

      window.addEventListener("contextmenu", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
          return;
        e.preventDefault();
      });

      window.addEventListener("keyup", (e) => {
        const k = e.key.toLowerCase();
        if (k === "w") keys.w = false;
        if (k === "a") keys.a = false;
        if (k === "s") keys.s = false;
        if (k === "d") keys.d = false;
        if (e.code === "Space") keys.space = false;
      });

      let camDist = 7.8;
      window.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === document.body) {
          yaw -= e.movementX * 0.003;
          const isInvertedY = document.getElementById("invert-mouse")?.checked;
          const dirY = isInvertedY ? 1 : -1;
          pitch += e.movementY * 0.003 * dirY;
          pitch = Math.max(-0.25, Math.min(0.65, pitch));
        }
      });

      window.addEventListener(
        "wheel",
        (e) => {
          camDist += e.deltaY * 0.008;
          camDist = Math.max(2.0, Math.min(18.0, camDist));
        },
        { passive: true },
      );
