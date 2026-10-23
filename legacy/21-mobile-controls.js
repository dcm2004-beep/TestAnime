
      // ==========================================
      // TOUCH JOYSTICK, CAMERA LOOK, & BUTTONS
      // ==========================================
      const joyZone = document.getElementById("joystick-zone");
      const joyKnob = document.getElementById("joystick-knob");
      let joyTouchId = null;
      let joyOriginX = 0;
      let joyOriginY = 0;
      const JOY_MAX_DIST = 46;
      let lastJoyTapTime = 0;
      const touchJoyVector = { x: 0, y: 0, active: false };

      // 🌀 Edge-zone dodge state (replaces the old flick-to-dodge)
      let joyEdgeTriggered = false;
      const JOY_EDGE_TRIGGER = 0.82; // push past 82% of throw → dodge
      const JOY_EDGE_RELEASE = 0.68; // fall below 68% to re-arm

      // Mobile Jump & Mobile Dodge Dash
      function triggerMobileJump() {
        if (isGrounded && !isPlayerDead && !isGamePaused && !isFrozen) {
          velocityY = 13.5;
          isGrounded = false;
        }
      }

      let lastFlickSide = 0; // -1 for left, 1 for right, 0 for center

      if (joyZone) {
        joyZone.addEventListener(
          "touchstart",
          (e) => {
            e.preventDefault();
            if (joyTouchId !== null) return;
            const t = e.changedTouches[0];
            joyTouchId = t.identifier;
            const rect = joyZone.getBoundingClientRect();
            joyOriginX = rect.left + rect.width / 2;
            joyOriginY = rect.top + rect.height / 2;

            const touchOffsetX = t.clientX - joyOriginX;
            let currentTapSide = 0;
            if (touchOffsetX < -18)
              currentTapSide = -1; // Tapped on left side
            else if (touchOffsetX > 18) currentTapSide = 1; // Tapped on right side

            const now = performance.now();
            if (now - lastJoyTapTime < 340) {
              if (
                currentTapSide === -1 &&
                lastFlickSide === -1 &&
                strafeCooldown <= 0
              ) {
                // Double tap left side = Dodge Left!
                dashPlayer(-1, 0);
                strafeCooldown = 0.6;
              } else if (
                currentTapSide === 1 &&
                lastFlickSide === 1 &&
                strafeCooldown <= 0
              ) {
                // Double tap right side = Dodge Right!
                dashPlayer(1, 0);
                strafeCooldown = 0.6;
              } else {
                // Double tap center = Jump!
                triggerMobileJump();
              }
              lastJoyTapTime = 0;
              lastFlickSide = 0;
            } else {
              lastJoyTapTime = now;
              lastFlickSide = currentTapSide;
            }
          },
          { passive: false },
        );

        window.addEventListener(
          "touchmove",
          (e) => {
            if (joyTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
              const t = e.changedTouches[i];
              if (t.identifier === joyTouchId) {
                let dx = t.clientX - joyOriginX;
                let dy = t.clientY - joyOriginY;
                const dist = Math.hypot(dx, dy);

                if (dist > JOY_MAX_DIST) {
                  dx = (dx / dist) * JOY_MAX_DIST;
                  dy = (dy / dist) * JOY_MAX_DIST;
                }

                joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;

                // 360-degree analog vector calculation
                if (dist > 8) {
                  touchJoyVector.x = dx / JOY_MAX_DIST;
                  touchJoyVector.y = dy / JOY_MAX_DIST;
                  touchJoyVector.active = true;
                } else {
                  touchJoyVector.x = 0;
                  touchJoyVector.y = 0;
                  touchJoyVector.active = false;
                }

                // 🌀 Edge-zone dodge: push into the cyan ring → dodge that way
                const mag = Math.hypot(touchJoyVector.x, touchJoyVector.y);
                const edgeRing = document.getElementById("joystick-edge-ring");

                if (mag >= JOY_EDGE_TRIGGER) {
                  if (edgeRing) edgeRing.classList.add("active");
                  if (!joyEdgeTriggered && strafeCooldown <= 0 && !isDashing) {
                    joyEdgeTriggered = true;
                    lastJoyTapTime = 0; // suppress any pending double-tap
                    dashPlayer(touchJoyVector.x, -touchJoyVector.y);
                    strafeCooldown = 0.5;
                  }
                } else {
                  if (edgeRing) edgeRing.classList.remove("active");
                  if (mag <= JOY_EDGE_RELEASE) {
                    joyEdgeTriggered = false;
                  }
                }

                break;
              }
            }
          },
          { passive: false },
        );

        const resetJoystick = (e) => {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joyTouchId) {
              joyTouchId = null;
              joyKnob.style.transform = "translate(0px, 0px)";
              touchJoyVector.x = 0;
              touchJoyVector.y = 0;
              touchJoyVector.active = false;
              joyEdgeTriggered = false;
              const edgeRing = document.getElementById("joystick-edge-ring");
              if (edgeRing) edgeRing.classList.remove("active");
              break;
            }
          }
        };

        window.addEventListener("touchend", resetJoystick, { passive: false });
        window.addEventListener("touchcancel", resetJoystick, {
          passive: false,
        });
      }

      // 💨 Dedicated dodge button on the joystick edge
      const dodgeBtn = document.getElementById("joystick-dodge");
      if (dodgeBtn) {
        const fireDodge = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            isGamePaused ||
            isPlayerDead ||
            isFrozen ||
            isDashing ||
            strafeCooldown > 0 ||
            isNameModalOpen
          )
            return;
          if (
            touchJoyVector.active &&
            Math.hypot(touchJoyVector.x, touchJoyVector.y) > 0.15
          ) {
            dashPlayer(touchJoyVector.x, -touchJoyVector.y);
          } else {
            dashPlayer(0, -1); // backstep toward camera
          }
          strafeCooldown = 0.5;
        };
        dodgeBtn.addEventListener("touchstart", fireDodge, { passive: false });
        dodgeBtn.addEventListener("mousedown", fireDodge);
      }

      // Camera Drag with Right Thumb (dragging anywhere in the right half of screen)
      let camTouchId = null;
      let camLastX = 0;
      let camLastY = 0;

      window.addEventListener(
        "touchstart",
        (e) => {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const isRightSide = t.clientX > window.innerWidth * 0.35;
            const isTouchingButtons =
              t.target.closest("#touch-action-panel") ||
              t.target.closest("#name-modal") ||
              t.target.closest("#death-screen") ||
              t.target.closest("#ui-container") ||
              t.target.closest("#pause-screen") ||
              t.target.closest("#tutorial-overlay") ||
              t.target.closest("#mode-modal");

            if (isRightSide && !isTouchingButtons && camTouchId === null) {
              camTouchId = t.identifier;
              camLastX = t.clientX;
              camLastY = t.clientY;
            }
          }
        },
        { passive: false },
      );

      window.addEventListener(
        "touchmove",
        (e) => {
          if (camTouchId === null) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === camTouchId) {
              const dx = t.clientX - camLastX;
              const dy = t.clientY - camLastY;
              camLastX = t.clientX;
              camLastY = t.clientY;

              yaw -= dx * 0.005;
              const isInvertedY =
                document.getElementById("invert-mouse")?.checked;
              const dirY = isInvertedY ? 1 : -1;
              pitch += dy * 0.004 * dirY;
              pitch = Math.max(-0.25, Math.min(0.65, pitch));
              break;
            }
          }
        },
        { passive: false },
      );

      const endCamTouch = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === camTouchId) {
            camTouchId = null;
            break;
          }
        }
      };
      window.addEventListener("touchend", endCamTouch, { passive: false });
      window.addEventListener("touchcancel", endCamTouch, { passive: false });

      // Combat Button Handlers
      const btnAttack = document.getElementById("touch-attack");
      const btnSkill1 = document.getElementById("touch-skill-1");
      const btnSkill2 = document.getElementById("touch-skill-2");

      if (btnAttack) {
        btnAttack.addEventListener(
          "touchstart",
          (e) => {
            e.preventDefault();
            triggerPunch();
          },
          { passive: false },
        );
      }

      if (btnSkill1) {
        btnSkill1.addEventListener(
          "touchstart",
          (e) => {
            e.preventDefault();
            if (isSpecialActive || isDashing) {
              queueSpecialSkill("combo");
            } else {
              triggerSkillCombo();
            }
          },
          { passive: false },
        );
      }

      // ⚡ Mobile FOCUS button — hold to channel cooldowns faster
      {
        const row = document.querySelector(".touch-skill-row");
        if (row) {
          const focusBtn = document.createElement("div");
          focusBtn.id = "touch-focus";
          focusBtn.className = "touch-btn touch-btn-skill";
          focusBtn.style.cssText =
            "background:linear-gradient(135deg,rgba(0,240,255,.85),rgba(0,153,255,.85));border-color:#00f0ff;box-shadow:0 0 14px rgba(0,240,255,.5)";
          focusBtn.innerHTML =
            '<span style="font-size:16px">⚡</span><span>FOCUS</span>';
          row.appendChild(focusBtn);

          const startFocus = (e) => {
            e.preventDefault();
            beginFocus();
          };
          const stopFocus = (e) => {
            e.preventDefault();
            endFocus(false);
          };
          focusBtn.addEventListener("touchstart", startFocus, {
            passive: false,
          });
          focusBtn.addEventListener("touchend", stopFocus, {
            passive: false,
          });
          focusBtn.addEventListener("touchcancel", stopFocus, {
            passive: false,
          });
          focusBtn.addEventListener("mousedown", startFocus);
          focusBtn.addEventListener("mouseup", stopFocus);
        }
      }
