
      // ==========================================
      // CLOUD HIGH SCORE & LEADERBOARD SYSTEM (TOP 10)
      // ==========================================
      const firebaseConfig = {
        apiKey: "AIzaSyD_S-X-2PEHZP32A9Pqktnj563M0TiYVt4",
        authDomain: "ninja-game-504e5.firebaseapp.com",
        databaseURL:
          "https://ninja-game-504e5-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ninja-game-504e5",
        storageBucket: "ninja-game-504e5.firebasestorage.app",
        messagingSenderId: "48270111012",
        appId: "1:48270111012:web:8c9ec0289b1ee4f8b2c3b1",
      };

      let db = null;
      try {
        if (
          typeof firebase !== "undefined" &&
          firebaseConfig.apiKey !== "YOUR_API_KEY"
        ) {
          firebase.initializeApp(firebaseConfig);
          db = firebase.database();
        }
      } catch (err) {
        console.warn("Firebase warning:", err);
      }

      let cloudScores = [];

      function saveHighScore(name, score) {
        if (score <= 0) return;
        const entry = {
          name: name || "Ninja",
          score: Math.round(score),
          timestamp: Date.now(),
        };

        // 1. Always save to LocalStorage immediately (instant backup for Live Server)
        try {
          let localBoard = JSON.parse(
            localStorage.getItem("anime_ninja_scores") || "[]",
          );
          localBoard.push(entry);
          localBoard.sort((a, b) => b.score - a.score);
          localBoard = localBoard.slice(0, 10); // Keep Top 10
          localStorage.setItem(
            "anime_ninja_scores",
            JSON.stringify(localBoard),
          );
        } catch (e) {}

        // 2. Also send to Firebase Cloud Database if connected
        if (db) {
          try {
            db.ref("leaderboard").push(entry);
          } catch (e) {
            console.warn("Firebase save error:", e);
          }
        }
      }

      // Live sync from Firebase across all computers
      if (db) {
        db.ref("leaderboard").on("value", (snapshot) => {
          const raw = snapshot.val();
          cloudScores = [];
          if (raw) {
            Object.values(raw).forEach((item) => cloudScores.push(item));
            cloudScores.sort((a, b) => b.score - a.score);
            cloudScores = cloudScores.slice(0, 10); // Keep Top 10
          }
          renderLeaderboard(cloudScores);
        });
      }

      function renderLeaderboard(scores) {
        const list = document.getElementById("death-leaderboard-list");
        const miniList = document.getElementById("mini-leaderboard-list");

        // Use Firebase scores if available, otherwise use local scores
        let board = scores;
        if (!board || board.length === 0) {
          board =
            cloudScores.length > 0
              ? cloudScores
              : JSON.parse(localStorage.getItem("anime_ninja_scores") || "[]");
        }

        if (!board || board.length === 0) {
          if (list)
            list.innerHTML = `<div style="color: #868e96; font-size: 13px; text-align: center; padding: 6px 0;">No high scores yet!</div>`;
          if (miniList)
            miniList.innerHTML = `<div style="color: #868e96; font-size: 11px;">No scores recorded</div>`;
          return;
        }

        // 1. Populate Death Screen Leaderboard (Top 10 desktop / Top 5 mobile)
        if (list) {
          const isMobileLayout = matchMedia(
            "(max-width: 900px), (max-height: 520px)",
          ).matches;
          const deathRowLimit = isMobileLayout ? 5 : 10;
          let html = "";
          board.slice(0, deathRowLimit).forEach((item, idx) => {
            const medal =
              idx === 0
                ? "🥇"
                : idx === 1
                  ? "🥈"
                  : idx === 2
                    ? "🥉"
                    : `#${idx + 1}`;
            html += `
              <div class="score-row">
                <span class="score-rank">${medal}</span>
                <span class="score-name">${item.name}</span>
                <span class="score-val">${item.score.toLocaleString()} dmg</span>
              </div>
            `;
          });
          list.innerHTML = html;
        }

        // 2. Populate Mini Leaderboard on Top-Left HUD (Top 5)
        if (miniList) {
          let miniHtml = "";
          board.slice(0, 5).forEach((item, idx) => {
            const medal =
              idx === 0
                ? "🥇"
                : idx === 1
                  ? "🥈"
                  : idx === 2
                    ? "🥉"
                    : `#${idx + 1}`;
            miniHtml += `
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-bottom: 2px;">
                <span style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">
                  ${medal} ${item.name}
                </span>
                <span style="font-weight: 800; color: #d9480f; white-space: nowrap; flex-shrink: 0;">
                  ${item.score.toLocaleString()}
                </span>
              </div>
            `;
          });
          miniList.innerHTML = miniHtml;
        }
      }
