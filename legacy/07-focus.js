
      // ⚡⚡ FOCUS CHANNEL — HOLD RMB TO RAPIDLY RECHARGE SKILL COOLDOWNS ⚡⚡
      // Rooted channel. All skill cooldowns tick at FOCUS_RATE.
      // Breaks on move / jump / attack / skill / any damage.
      let isFocusing = false;
      let focusStartMs = 0;
      let focusLockoutMs = 0;
      const FOCUS_RATE = 3.0;
      const FOCUS_BREAK_LOCKOUT_MS = 1500;

      const focusVFX = {
        group: new THREE.Group(),
        core: null,
        ring: null,
        light: null,
        mat: null,
        ringMat: null,
      };
      {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(1.05, 16, 16),
          mat,
        );
        core.renderOrder = 990;
        focusVFX.core = core;
        focusVFX.mat = mat;
        focusVFX.group.add(core);

        const ringGeo = new THREE.RingGeometry(0.9, 1.15, 40);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.05;
        ring.renderOrder = 990;
        focusVFX.ring = ring;
        focusVFX.ringMat = ringMat;
        focusVFX.group.add(ring);

        const light = new THREE.PointLight(0x00f0ff, 0, 8);
        focusVFX.light = light;
        focusVFX.group.add(light);

        focusVFX.group.visible = false;
        scene.add(focusVFX.group);
      }

      document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="focus-indicator" style="display:none;position:fixed;left:50%;top:58%;transform:translateX(-50%);text-align:center;font:900 20px Impact,sans-serif;color:#00f0ff;text-shadow:0 0 18px #00f0ff,2px 2px 0 #000;letter-spacing:2px;z-index:150;pointer-events:none">⚡ FOCUSING ⚡<div style="font:600 11px 'Segoe UI',sans-serif;color:#a5f3ff;margin-top:3px;letter-spacing:0.5px">SKILL COOLDOWNS ×3</div></div>`,
      );

      function beginFocus() {
        if (
          isFocusing ||
          isPlayerDead ||
          isGamePaused ||
          isFrozen ||
          isDashing ||
          isSpecialActive ||
          isPunching ||
          isHealing ||
          !isGrounded ||
          isNameModalOpen
        )
          return;
        if (performance.now() < focusLockoutMs) return;
        if (keys.w || keys.a || keys.s || keys.d || touchJoyVector.active)
          return;

        isFocusing = true;
        focusStartMs = performance.now();
        focusVFX.group.visible = true;
        character.rotation.y = yaw + Math.PI;

        const el = document.getElementById("focus-indicator");
        if (el) el.style.display = "block";
      }

      function endFocus(applyLockout) {
        if (!isFocusing) return;
        isFocusing = false;
        focusVFX.group.visible = false;
        focusVFX.mat.opacity = 0;
        focusVFX.ringMat.opacity = 0;
        focusVFX.light.intensity = 0;
        const el = document.getElementById("focus-indicator");
        if (el) el.style.display = "none";
        if (applyLockout)
          focusLockoutMs = performance.now() + FOCUS_BREAK_LOCKOUT_MS;
      }

      function updateFocus(delta) {
        if (!isFocusing) return;

        const moving =
          keys.w || keys.a || keys.s || keys.d || touchJoyVector.active;
        if (
          moving ||
          !isGrounded ||
          isPlayerDead ||
          isGamePaused ||
          isFrozen ||
          isPunching ||
          isSpecialActive ||
          isDashing ||
          isHealing
        ) {
          endFocus(false);
          return;
        }

        // Continuously face camera aim while focusing
        let dAngle = yaw + Math.PI - character.rotation.y;
        while (dAngle < -Math.PI) dAngle += Math.PI * 2;
        while (dAngle > Math.PI) dAngle -= Math.PI * 2;
        character.rotation.y += dAngle * 0.15;

        const t = performance.now() * 0.001;
        focusVFX.group.position.set(
          character.position.x,
          character.position.y + 1.2,
          character.position.z,
        );
        focusVFX.core.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
        focusVFX.mat.opacity = 0.28 + Math.sin(t * 6) * 0.08;
        focusVFX.ring.rotation.y += delta * 1.5;
        focusVFX.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.1);
        focusVFX.ringMat.opacity = 0.5 + Math.sin(t * 7) * 0.15;
        focusVFX.light.intensity = 2.0 + Math.sin(t * 8) * 0.6;
      }
