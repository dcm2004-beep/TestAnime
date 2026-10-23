      // ==========================================
      // PLAYER NAME & MODAL SYSTEM (LOADS FIRST)
      // ==========================================
      window.isNameModalOpen = true;

      // 🎓 Tutorial state
      window.isTutorialActive = false;
      let tutorialDummy = null;
      window.currentPlayerName =
        localStorage.getItem("anime_ninja_last_user") || "Ninja";

      // Prefill name input from last session
      (function () {
        const saved = localStorage.getItem("anime_ninja_last_user");
        const input = document.getElementById("player-name-input");
        if (saved && input) input.value = saved;
      })();

      window.updatePlayerBadge = function () {
        const badge = document.getElementById("ui-player-badge");
        if (badge) badge.innerText = `👤 ${window.currentPlayerName}`;
      };

      window.updatePlayerBadge = function () {
        const badge = document.getElementById("ui-player-badge");
        if (badge) badge.innerText = `👤 ${window.currentPlayerName}`;
      };

      // Automatic Landscape & Fullscreen request
      async function enterLandscapeMode() {
        try {
          const el = document.documentElement;
          if (el.requestFullscreen) {
            await el.requestFullscreen();
          } else if (el.webkitRequestFullscreen) {
            await el.webkitRequestFullscreen();
          }
        } catch (e) {}

        try {
          if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock("landscape");
          }
        } catch (e) {}
      }

      // 🖥️ Fullscreen wrapper — fires SYNCHRONOUSLY in the tap handler
      window.startBattle = function () {
        try {
          const el = document.documentElement;
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if (el.webkitRequestFullscreen)
            el.webkitRequestFullscreen().catch(() => {});
        } catch (e) {}
        // Give the fullscreen animation a moment, then lock landscape
        setTimeout(() => {
          try {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock("landscape").catch(() => {});
            }
          } catch (e) {}
        }, 250);
        submitPlayerName();
      };

      window.submitPlayerName = function () {
        const input = document.getElementById("player-name-input");
        const val = input ? input.value.trim() : "";
        window.currentPlayerName = val.length > 0 ? val : "Ninja";
        try {
          localStorage.setItem(
            "anime_ninja_last_user",
            window.currentPlayerName,
          );
        } catch (e) {}

        window.updatePlayerBadge();

        // Hide name modal
        const nameModal = document.getElementById("name-modal");
        if (nameModal)
          nameModal.style.setProperty("display", "none", "important");

        // Request fullscreen here (user gesture) so the mode card appears fullscreen
        enterLandscapeMode();

        // Show mode selection card — isNameModalOpen stays true so background input is blocked
        const modeModal = document.getElementById("mode-modal");
        if (modeModal)
          modeModal.style.setProperty("display", "flex", "important");
      };

      window.openNamePrompt = function () {
        try {
          document.exitPointerLock();
        } catch (e) {}
        window.isNameModalOpen = true;
        const modal = document.getElementById("name-modal");
        const input = document.getElementById("player-name-input");
        if (input) {
          input.value = window.currentPlayerName;
          setTimeout(() => input.focus(), 50);
        }
        if (modal) {
          modal.style.setProperty("display", "flex", "important");
        }
      };
