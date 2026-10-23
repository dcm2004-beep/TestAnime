
      // ---------- HUD ----------
      document.head.insertAdjacentHTML(
        "beforeend",
        `<style>
        #prog-hud{position:absolute;top:60px;right:24px;width:190px;background:rgba(18,22,34,.82);border:2px solid rgba(255,158,187,.6);border-radius:14px;padding:8px 12px;color:#fff;font:bold 12.5px "Segoe UI",sans-serif;z-index:100;pointer-events:none}
        .pbar{height:8px;background:#2b2f3a;border-radius:6px;overflow:hidden;margin-top:5px}.pbar>div{height:100%;width:0}
        #boss-hud{position:absolute;top:140px;left:50%;transform:translateX(-50%);width:420px;max-width:80vw;display:none;color:#ffd8d8;font:bold 13px "Segoe UI",sans-serif;text-align:center;z-index:100;pointer-events:none;text-shadow:0 2px 4px #000}
        #banner{position:absolute;top:28%;left:50%;transform:translateX(-50%);font:900 44px Impact,sans-serif;color:#fff;text-shadow:0 0 18px #ff5277,3px 3px 0 #000;z-index:1001;pointer-events:none;opacity:0;transition:opacity .4s;text-align:center;white-space:nowrap}
        #upgrade-modal{position:fixed;inset:0;background:rgba(10,12,20,.78);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:2000}
        .up-card{width:190px;padding:14px;border-radius:14px;background:#1c2233;border:2px solid #ff9ebb;color:#fff;font:600 14px "Segoe UI",sans-serif;text-align:center;cursor:pointer;transition:transform .1s}
        .up-card:hover{background:#2a3350;transform:translateY(-4px)}
        .skill-card.ready.heal-card{border-color:#69db7c;color:#fff;animation:healReadyFlash 1.0s infinite ease-in-out}
      </style>`,
      );
      document.body.insertAdjacentHTML(
        "beforeend",
        `
        <div id="prog-hud"><div style="display:flex;justify-content:space-between"><span id="lv-txt">LV 1</span><span id="wave-txt">WAVE 1</span></div>
          <div class="pbar"><div id="xp-fill" style="background:linear-gradient(90deg,#4dabf7,#74c0fc)"></div></div></div>
        <div id="boss-hud"><div>⚔ BOSS <span id="boss-hp-txt"></span></div>
          <div class="pbar" style="height:14px;border:2px solid #000"><div id="boss-fill" style="background:linear-gradient(90deg,#c92a2a,#ff6b6b);width:100%"></div></div></div>
        <div id="banner"></div><div id="upgrade-modal"></div>`,
      );
      $("skills-hud").insertAdjacentHTML(
        "beforeend",
        `
        <div id="skill3-card" class="skill-card heal-card ready"><span class="key-badge">KEY 3</span>
          <div class="skill-name">HEALING TRANCE 🌿</div>
          <div id="skill3-status" class="skill-status" style="color:#69db7c">READY!</div>
          <div class="skill-progress-track"><div id="skill3-fill" class="skill-progress-fill" style="width:100%;background:linear-gradient(90deg,#2f9e44,#8ce99a)"></div></div></div>`,
      );
      {
        const tb = document.createElement("div");
        tb.id = "touch-skill-3";
        tb.className = "touch-btn touch-btn-skill";
        tb.style.cssText =
          "background:linear-gradient(135deg,rgba(47,158,68,.85),rgba(140,233,154,.85));border-color:#8ce99a";
        tb.innerHTML =
          '<span style="font-size:16px">🌿</span><span>HEAL</span>';
        document.querySelector(".touch-skill-row").appendChild(tb);
        tb.addEventListener(
          "touchstart",
          (e) => {
            e.preventDefault();
            triggerSkillHeal();
          },
          { passive: false },
        );
      }

      function popAt(pos, text, cls = "", yOff = 1.0, color = null) {
        const p = new THREE.Vector3(pos.x, pos.y + yOff, pos.z).project(camera);
        if (p.z > 1) return;
        const tag = document.createElement("div");
        tag.className = "damage-pop " + cls;
        tag.innerText = text;
        if (color) tag.style.color = color;
        tag.style.left = `${(p.x * 0.5 + 0.5) * window.innerWidth}px`;
        tag.style.top = `${(-p.y * 0.5 + 0.5) * window.innerHeight}px`;
        document.body.appendChild(tag);
        setTimeout(() => tag.remove(), 1300);
      }
      let bannerTimer = 0;
      function banner(html, ms = 2200) {
        const b = $("banner");
        b.innerHTML = html;
        b.style.opacity = 1;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => (b.style.opacity = 0), ms);
      }
      const xpNeed = () => Math.round(80 * Math.pow(1.3, prog.level - 1));
      function updateProgHud() {
        $("lv-txt").innerText = `LV ${prog.level}`;
        $("wave-txt").innerText = `WAVE ${prog.wave}`;
        $("xp-fill").style.width =
          `${Math.min(100, (prog.xp / xpNeed()) * 100)}%`;
      }
