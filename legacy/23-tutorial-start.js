
      // ==========================================
      // 🎓 TUTORIAL MODE
      // ==========================================
      window.startTutorial = function () {
        // Clean any leftover dummy from a previous run
        if (tutorialDummy) {
          scene.remove(tutorialDummy.mesh);
          if (tutorialDummy.hpBar && tutorialDummy.hpBar.group)
            scene.remove(tutorialDummy.hpBar.group);
          const _i = activeBats.indexOf(tutorialDummy);
          if (_i >= 0) activeBats.splice(_i, 1);
          tutorialDummy = null;
        }
        isTutorialActive = true;
        resetProgression();
        character.position.set(0, getElevation(0, 0), 0);
        // Face AWAY from the camera so the bat spawns in front of the player,
        // and we look at the character's back (yaw 0 puts the camera at +Z).
        yaw = 0;
        character.rotation.y = yaw + Math.PI;
        playerHP = PLAYER_MAX_HP;
        totalDamageDealt = 0;
        skill1Cooldown = 0;
        skill2Cooldown = 0;
        skill3Cooldown = 0;
        updatePlayerUI();
        updateSkillUI();

        const progHud = document.getElementById("prog-hud");
        if (progHud) progHud.style.display = "none";

        const overlay = document.getElementById("tutorial-overlay");
        if (overlay) overlay.style.display = "block";

        spawnTutorialDummy();

        try {
          clock.getDelta();
          batClock.getDelta();
        } catch (e) {}
      };

      function spawnTutorialDummy() {
        if (!isTutorialActive) return;
        if (!batTemplate) {
          setTimeout(spawnTutorialDummy, 200);
          return;
        }
        if (tutorialDummy) return;

        const batMesh = cloneSkinnedMesh(batTemplate);
        batMesh.traverse((n) => {
          if (n.isMesh && n.material) {
            n.material = n.material.clone();
            n.material.transparent = true;
            n.material.opacity = 1.0;
            n.material.depthWrite = true;
          }
        });

        const fwd = new THREE.Vector3(
          Math.sin(character.rotation.y),
          0,
          Math.cos(character.rotation.y),
        );
        batMesh.position.copy(character.position).addScaledVector(fwd, 5);
        batMesh.position.y =
          getElevation(batMesh.position.x, batMesh.position.z) + 1.8;

        let mixer = null;
        if (batAnimClip) {
          mixer = new THREE.AnimationMixer(batMesh);
          mixer.clipAction(batAnimClip).play();
        }

        const hpBar = createBatHpBar();
        hpBar.group.visible = false;

        scene.add(batMesh);

        tutorialDummy = {
          mesh: batMesh,
          mixer,
          hp: 999999,
          maxHp: 999999,
          state: "alive",
          hpBar,
          attackTimer: 999999,
          isAttacking: false,
          diveY: 0,
          strafeSeed: 0,
          attackCount: 0,
          baseScale: 0.8,
          specialCooldown: 999999,
          isTutorialDummy: true,
        };

        activeBats.push(tutorialDummy);
        updateBatUI();
      }

      function finishTutorial() {
        if (!isTutorialActive) return;
        isTutorialActive = false;

        if (tutorialDummy) {
          scene.remove(tutorialDummy.mesh);
          if (tutorialDummy.hpBar && tutorialDummy.hpBar.group)
            scene.remove(tutorialDummy.hpBar.group);
          const i = activeBats.indexOf(tutorialDummy);
          if (i >= 0) activeBats.splice(i, 1);
          tutorialDummy = null;
        }

        const overlay = document.getElementById("tutorial-overlay");
        if (overlay) overlay.style.display = "none";
        const progHud = document.getElementById("prog-hud");
        if (progHud) progHud.style.display = "";

        totalDamageDealt = 0;
        resetProgression();
        skill1Cooldown = 0;
        skill2Cooldown = 0;
        skill3Cooldown = 0;
        updateSkillUI();
        const liveScore = document.getElementById("live-damage-score");
        if (liveScore) liveScore.innerText = "0";

        try {
          localStorage.setItem("anime_ninja_tutorial_done", "1");
        } catch (e) {}

        try {
          clock.getDelta();
          batClock.getDelta();
        } catch (e) {}
        batSpawnCooldown = 2.0;

        try {
          if (!("ontouchstart" in window)) document.body.requestPointerLock();
        } catch (e) {}

        banner("⚔ BATTLE START!", 1800);
      }

      // Wire the Finish button (works on desktop click AND mobile tap)
      (function () {
        const btn = document.getElementById("finish-tutorial-btn");
        if (!btn) return;
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finishTutorial();
        };
        btn.addEventListener("touchstart", handler, { passive: false });
        btn.addEventListener("mousedown", handler);
      })();

      // 🎮 Start the real game (skips tutorial)
      window.startGameMode = function () {
        const modeModal = document.getElementById("mode-modal");
        if (modeModal) modeModal.style.display = "none";
        window.isNameModalOpen = false;
        if (typeof isGamePaused !== "undefined") isGamePaused = false;
        isTutorialActive = false;
        const ds = document.getElementById("death-screen");
        if (ds) ds.style.display = "none";
        if (isPlayerDead) respawnPlayer();
        Game.audio.music.play("battle");
        enterLandscapeMode();
        try {
          clock.getDelta();
        } catch (e) {}
        try {
          batClock.getDelta();
        } catch (e) {}
        try {
          document.body.requestPointerLock();
        } catch (e) {}
      };

      // 🎓 Start the tutorial
      window.startTutorialMode = function () {
        const modeModal = document.getElementById("mode-modal");
        if (modeModal) modeModal.style.display = "none";
        window.isNameModalOpen = false;
        if (typeof isGamePaused !== "undefined") isGamePaused = false;
        const ds = document.getElementById("death-screen");
        if (ds) ds.style.display = "none";
        if (isPlayerDead) isPlayerDead = false;
        Game.audio.music.play("battle");
        enterLandscapeMode();
        try {
          clock.getDelta();
        } catch (e) {}
        try {
          batClock.getDelta();
        } catch (e) {}
        window.startTutorial();
        // 🖱️ Lock mouse so players can look around during the tutorial
        // (Desktop only — mobile browsers don't support pointer lock.)
        try {
          document.body.requestPointerLock();
        } catch (e) {}
      };

      // Wire mode-selection buttons (touch + mouse)
      (function () {
        const gameBtn = document.getElementById("mode-game-btn");
        const tutorialBtn = document.getElementById("mode-tutorial-btn");
        if (gameBtn) {
          const h = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.startGameMode();
          };
          gameBtn.addEventListener("touchstart", h, { passive: false });
          gameBtn.addEventListener("mousedown", h);
        }
        if (tutorialBtn) {
          const h = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.startTutorialMode();
          };
          tutorialBtn.addEventListener("touchstart", h, { passive: false });
          tutorialBtn.addEventListener("mousedown", h);
        }
      })();

      window.updatePlayerBadge();
      renderLeaderboard(); // Show scores immediately on launch
