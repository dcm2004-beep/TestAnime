
      // ---------- XP, levels, upgrade picks ----------
      let upgradeOpen = false,
        upgradePicks = 0,
        upgradeChoices = [],
        upgradeOpenedAt = 0;
      const UPGRADES = [
        // ── Universal ──
        {
          t: "🥊 Iron Fists",
          d: "×1.20 damage (all sources)",
          tier: 1,
          f: () => (prog.dmgMult *= 1.2),
        },
        // ── Warrior ──
        {
          t: "❤️ Tough Body",
          d: "+300 max HP and heal 300",
          tier: 1,
          f: () => {
            PLAYER_MAX_HP += 300;
            playerHP = Math.min(PLAYER_MAX_HP, playerHP + 300);
          },
        },
        {
          t: "🩸 Blood Fist",
          d: "Punch and Thunder Kick damage heals 15% (cap 45%)",
          tier: 1,
          f: () =>
            (prog.bloodFistPct = Math.min(0.45, prog.bloodFistPct + 0.15)),
        },
        {
          t: "👊 Flurry Hands",
          d: "+25% attack speed (faster punches)",
          tier: 1,
          f: () =>
            (prog.punchSpeedMult = Math.max(0.4, prog.punchSpeedMult * 0.8)),
        },
        {
          t: "🐉 Dragon Fist",
          d: "Every 15 landed punches: next punch is a heavy 300% AoE lifesteal finisher",
          tier: 3,
          f: () => (prog.dragonFist = true),
        },
        // ── Assassin ──
        {
          t: "🎯 Keen Eye",
          d: "+8% crit chance",
          tier: 1,
          f: () => (prog.critChance += 0.08),
        },
        {
          t: "💥 Executioner",
          d: "+50% critical hit damage",
          tier: 1,
          f: () => (prog.critDmgBonus += 0.5),
        },
        {
          t: "🗡️ Phantom's Grace",
          d: "Successful dodges heal 2% HP and empower next punch to guaranteed crit (+50% crit dmg)",
          tier: 2,
          f: () => (prog.phantomGrace = true),
        },
        {
          t: "💨 Shadow Evasion",
          d: "+10% dodge chance (max 60%)",
          tier: 1,
          f: () => (prog.evasion = Math.min(0.6, prog.evasion + 0.1)),
        },
        // ── Mage ──
        {
          t: "⏱ Quick Chakra",
          d: "Skill cooldowns ×0.85 (floor 0.40)",
          tier: 1,
          f: () => (prog.cdMult = Math.max(0.4, prog.cdMult * 0.85)),
        },
        {
          t: "🔥 Chakra Amp",
          d: "+35% skill damage (Flurry & Thunder Kick)",
          tier: 1,
          f: () => (prog.skillDmgMult *= 1.35),
        },
        {
          t: "🌊 Chakra Wave",
          d: "Flurry becomes a ranged AoE cone (12m, −30% per hit, no dash)",
          tier: 1,
          f: () => (prog.flurryRanged = true),
        },
        {
          t: "⚡ Storm Lance",
          d: "Thunder Kick becomes a 14m ranged lightning lance (no dash, 1.2s invuln)",
          tier: 2,
          f: () => (prog.stormLance = true),
        },
        {
          t: "🌿 Quick Trance",
          d: "Healing Trance channel 3s → 2s (same total heal)",
          tier: 2,
          f: () => (prog.flowTrance = true),
        },
        {
          t: "⚡ Raiton Master",
          d: "+50% Thunder Kick damage",
          tier: 2,
          f: () => (prog.raitonMult = (prog.raitonMult || 1) * 1.5),
        },
        {
          t: "🏃 Swift Wind",
          d: "+15% move speed, +5% dodge",
          tier: 1,
          f: () => {
            prog.speedMult *= 1.15;
            prog.evasion = Math.min(0.6, prog.evasion + 0.05);
          },
        },
        // ── Sage ──
        {
          t: "🌿 Deep Focus",
          d: "Healing Trance heals +4% max HP",
          tier: 1,
          f: () => (prog.healPct += 0.04),
        },
        {
          t: "🛡 Iron Skin",
          d: "−10% damage taken (multiplicative, cap 50%)",
          tier: 1,
          f: () =>
            (prog.dmgReduction = Math.min(
              0.5,
              1 - (1 - prog.dmgReduction) * 0.9,
            )),
        },
        {
          t: "⚔️ Counter Stance",
          d: "Reflect 20% of melee damage taken (cap 80%)",
          tier: 1,
          f: () => (prog.reflectPct = Math.min(0.8, prog.reflectPct + 0.2)),
        },
        {
          t: "💥 Karmic Blast",
          d: "Every 25% max HP taken unleashes a healing AoE blast",
          tier: 3,
          f: () => (prog.karmicBlast = true),
        },
        // 🌿 Sage — tank-damage skills (Phase B)
        {
          t: "🌿 Nature's Wrath",
          d: "Heal Burst ×1.5 damage (stacks to ×3, scales with Chakra Amp)",
          tier: 2,
          f: () => (prog.natureWrath = Math.min(3.0, prog.natureWrath * 1.5)),
        },
        {
          t: "🐍 Serpent Strike",
          d: "Punches poison enemies for 30% of damage over 5s (stacks to 60%)",
          tier: 2,
          f: () =>
            (prog.serpentStrike = Math.min(0.6, prog.serpentStrike + 0.3)),
        },
        {
          t: "🪨 Thorned Hide",
          d: "Taking damage deals 10% back to nearby enemies (stacks to 40%)",
          tier: 2,
          f: () => (prog.thornedHide = Math.min(0.4, prog.thornedHide + 0.1)),
        },
        {
          t: "💀 Blood Debt",
          d: "Each hit taken grants +3% damage for 6s (stacks to +45%)",
          tier: 2,
          f: () => (prog.bloodDebt = true),
        },
        // ⚔️ Phase C
        {
          t: "🗡️ Whirlwind",
          d: "Punches also hit all enemies within 3m for 60% damage",
          tier: 2,
          f: () => (prog.whirlwind = true),
        },
        {
          t: "🔥 Berserker",
          d: "Below 30% HP: +50% damage and +20% attack speed",
          tier: 2,
          f: () => (prog.berserker = true),
        },
        {
          t: "💨 Shadow Step",
          d: "Dodge cooldown −30% and dash distance +25% (stacks 3×)",
          tier: 2,
          f: () => {
            prog.dodgeCdMult = Math.max(0.4, prog.dodgeCdMult * 0.7);
            prog.dodgeDistMult = Math.min(1.75, prog.dodgeDistMult * 1.25);
          },
        },
        {
          t: "❄️ Frost Fist",
          d: "Critical hits slow enemies 50% for 2s",
          tier: 2,
          f: () => (prog.frostFist = true),
        },
        {
          t: "🔥 Chakra Infusion",
          d: "Skills apply a 3s burn for 8% of hit damage/sec",
          tier: 2,
          f: () => (prog.chakraInfusion = true),
        },
        {
          t: "🌀 Clone Jutsu",
          d: "Every 4s, a shadow clone strikes your target for 30% bonus damage",
          tier: 2,
          f: () => (prog.cloneJutsu = true),
        },
        // 🌟 Tier 3 Capstones
        {
          t: "⚡ Assassinate",
          d: "Punches instantly execute enemies below 25% HP (does not work on bosses)",
          tier: 3,
          f: () => (prog.assassinate = true),
        },
        {
          t: "🌀 Chakra Overload",
          d: "Skills deal 2× damage but cooldowns +50%",
          tier: 3,
          f: () => (prog.chakraOverload = true),
        },
      ];
      function gainXP(n) {
        prog.xp += n;
        while (prog.xp >= xpNeed()) {
          prog.xp -= xpNeed();
          prog.level++;
          PLAYER_MAX_HP += 100;
          prog.dmgMult += 0.05;
          playerHP = Math.min(PLAYER_MAX_HP, playerHP + PLAYER_MAX_HP * 0.3);
          updatePlayerUI();
          banner(`LEVEL ${prog.level}!`, 1600);
          popAt(character.position, "LEVEL UP!", "heal", 2.4);
          if (prog.level % 2 === 0) upgradePicks++; // a choice every 2nd level
        }
        updateProgHud();
      }
      // 🎯 Archetype tags — used to bias future upgrade offerings
      const ARCHETYPE_MAP = {
        "🥊 Iron Fists": "universal",
        "❤️ Tough Body": "universal",
        "🩸 Blood Fist": "warrior",
        "👊 Flurry Hands": "warrior",
        "🐉 Dragon Fist": "warrior",
        "🎯 Keen Eye": "assassin",
        "💥 Executioner": "assassin",
        "🗡️ Phantom's Grace": "assassin",
        "💨 Shadow Evasion": "assassin",
        "⏱ Quick Chakra": "mage",
        "🔥 Chakra Amp": "mage",
        "🌊 Chakra Wave": "mage",
        "⚡ Storm Lance": "mage",
        "🌿 Quick Trance": "mage",
        "⚡ Raiton Master": "mage",
        "🏃 Swift Wind": "mage",
        "🌿 Deep Focus": "sage",
        "🛡 Iron Skin": "sage",
        "⚔️ Counter Stance": "sage",
        "💥 Karmic Blast": "sage",
        "🌿 Nature's Wrath": "sage",
        "🐍 Serpent Strike": "sage",
        "🪨 Thorned Hide": "sage",
        "💀 Blood Debt": "sage",
        "🗡️ Whirlwind": "warrior",
        "🔥 Berserker": "warrior",
        "💨 Shadow Step": "universal",
        "❄️ Frost Fist": "universal",
        "🔥 Chakra Infusion": "mage",
        "🌀 Clone Jutsu": "mage",
        "⚡ Assassinate": "assassin",
        "🌀 Chakra Overload": "mage",
      };
      // 🎯 One-time upgrades — after picking, they leave the pool forever
      const ONE_TIME_UPGRADES = new Set([
        "🐉 Dragon Fist",
        "🗡️ Phantom's Grace",
        "🌊 Chakra Wave",
        "⚡ Storm Lance",
        "🌿 Quick Trance",
        "💥 Karmic Blast",
        "💀 Blood Debt",
        "🗡️ Whirlwind",
        "🔥 Berserker",
        "❄️ Frost Fist",
        "🔥 Chakra Infusion",
        "🌀 Clone Jutsu",
        "⚡ Assassinate",
        "🌀 Chakra Overload",
      ]);

      // 🚫 Filters out upgrades that would do nothing on this pick
      function isUpgradeUseful(u) {
        // 🌟 Tier gating
        if (!u.tier) u.tier = 1;
        const arch = ARCHETYPE_MAP[u.t] || "universal";
        const picks =
          arch === "universal" ? 999 : prog.archetypePicks?.[arch] || 0;
        if (u.tier === 2 && picks < 2) return false;
        if (u.tier === 3 && (picks < 5 || prog.level < 8)) return false;

        if (ONE_TIME_UPGRADES.has(u.t) && prog.pickedOneTime?.[u.t])
          return false;
        if (u.t === "🌿 Nature's Wrath" && prog.natureWrath >= 3.0)
          return false;
        if (u.t === "🐍 Serpent Strike" && prog.serpentStrike >= 0.6)
          return false;
        if (u.t === "🪨 Thorned Hide" && prog.thornedHide >= 0.4) return false;
        if (u.t === "💨 Shadow Evasion" && prog.evasion >= 0.6) return false;
        if (
          u.t === "💨 Shadow Step" &&
          prog.dodgeCdMult <= 0.4 &&
          prog.dodgeDistMult >= 1.75
        )
          return false;
        if (u.t === "🛡 Iron Skin" && prog.dmgReduction >= 0.5) return false;
        if (u.t === "⚔️ Counter Stance" && prog.reflectPct >= 0.6) return false;
        if (u.t === "👊 Flurry Hands" && prog.punchSpeedMult <= 0.4)
          return false;
        if (u.t === "⏱ Quick Chakra" && prog.cdMult <= 0.4) return false;
        return true;
      }

      function openUpgrade() {
        upgradeOpen = true;
        upgradePicks--;
        isGamePaused = true;
        document.exitPointerLock();

        const ap = prog.archetypePicks || {
          warrior: 0,
          assassin: 0,
          mage: 0,
          sage: 0,
        };

        // 1. Filter out useless / already-owned upgrades
        const eligible = UPGRADES.filter(isUpgradeUseful);

        // 2. Identify primary archetype (most picks, ties broken randomly)
        let maxPicks = 0;
        let tied = [];
        ["warrior", "assassin", "mage", "sage"].forEach((arch) => {
          const p = ap[arch] || 0;
          if (p > maxPicks) {
            maxPicks = p;
            tied = [arch];
          } else if (p === maxPicks && p > 0) {
            tied.push(arch);
          }
        });
        const primaryArch =
          tied.length > 1
            ? tied[Math.floor(Math.random() * tied.length)]
            : tied[0] || null;

        // 3. Weighted pool — sharper bias toward invested archetypes
        const weightedPool = eligible.map((u) => {
          const arch = ARCHETYPE_MAP[u.t] || "universal";
          let w;
          if (arch === "universal") {
            w = 0.8; // slightly rarer so archetype cards dominate
          } else {
            const thisPicks = ap[arch] || 0;
            w = 1.0 + 2.0 * thisPicks;
            // Soft lock: once committed (3+ picks), off-archetype cards are rare
            if (primaryArch && arch !== primaryArch && maxPicks >= 3) {
              w *= 0.15;
            }
          }
          return { upgrade: u, weight: w };
        });

        upgradeChoices = [];

        // 4. Guarantee 1 card from primary archetype
        if (primaryArch) {
          const primaryPool = weightedPool.filter(
            (x) => ARCHETYPE_MAP[x.upgrade.t] === primaryArch,
          );
          if (primaryPool.length > 0) {
            const total = primaryPool.reduce((s, x) => s + x.weight, 0);
            let roll = Math.random() * total;
            let idx = primaryPool.length - 1;
            for (let j = 0; j < primaryPool.length; j++) {
              roll -= primaryPool[j].weight;
              if (roll <= 0) {
                idx = j;
                break;
              }
            }
            const picked = primaryPool[idx];
            upgradeChoices.push(picked.upgrade);
            const removeIdx = weightedPool.indexOf(picked);
            if (removeIdx >= 0) weightedPool.splice(removeIdx, 1);
          }
        }

        // 5. Fill remaining slots from weighted pool
        while (upgradeChoices.length < 3 && weightedPool.length > 0) {
          const total = weightedPool.reduce((s, x) => s + x.weight, 0);
          let roll = Math.random() * total;
          let idx = weightedPool.length - 1;
          for (let j = 0; j < weightedPool.length; j++) {
            roll -= weightedPool[j].weight;
            if (roll <= 0) {
              idx = j;
              break;
            }
          }
          upgradeChoices.push(weightedPool[idx].upgrade);
          weightedPool.splice(idx, 1);
        }

        const m = $("upgrade-modal");
        m.innerHTML =
          `<div style="font:900 30px Impact,sans-serif;color:#fff;margin-bottom:14px">CHOOSE AN UPGRADE</div><div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">` +
          upgradeChoices
            .map(
              (u, i) =>
                `<div class="up-card" data-i="${i}"><div style="font-size:11px;opacity:.6">PRESS ${i + 1}</div>${u.tier === 3 ? '<div style="font-size:10px;color:#ffd43b;font-weight:900;letter-spacing:1px">★ CAPSTONE</div>' : u.tier === 2 ? '<div style="font-size:10px;color:#74c0fc;font-weight:700;letter-spacing:1px">◆ ADVANCED</div>' : ""}<div style="font-size:18px;margin:6px 0">${u.t}</div><div>${u.d}</div></div>`,
            )
            .join("") +
          `</div>`;
        m.style.display = "flex";
        upgradeOpenedAt = performance.now();
        const cards = m.querySelectorAll(".up-card");
        cards.forEach((c) => (c.style.opacity = 0.35));
        setTimeout(() => cards.forEach((c) => (c.style.opacity = 1)), 1500); // picks are ignored until the cards light up
      }
      function pickUpgrade(i) {
        if (
          !upgradeOpen ||
          performance.now() - upgradeOpenedAt < 1500 ||
          !upgradeChoices[i]
        )
          return;
        upgradeChoices[i].f();
        // 🎯 Mark one-time upgrades so they leave the pool
        if (ONE_TIME_UPGRADES.has(upgradeChoices[i].t)) {
          if (!prog.pickedOneTime) prog.pickedOneTime = {};
          prog.pickedOneTime[upgradeChoices[i].t] = true;
        }
        // 🎯 Track archetype for weighted offerings next time
        const chosenArch = ARCHETYPE_MAP[upgradeChoices[i].t] || "universal";
        if (chosenArch !== "universal") {
          if (!prog.archetypePicks)
            prog.archetypePicks = { warrior: 0, assassin: 0, mage: 0, sage: 0 };
          prog.archetypePicks[chosenArch] =
            (prog.archetypePicks[chosenArch] || 0) + 1;
        }
        upgradeOpen = false;
        $("upgrade-modal").style.display = "none";
        const ps = $("pause-screen");
        if (ps) ps.style.display = "none";
        isGamePaused = false;
        updatePlayerUI();
        updateSkillUI();
        try {
          document.body.requestPointerLock();
        } catch (e) {}
      }
      $("upgrade-modal").addEventListener("click", (e) => {
        const c = e.target.closest(".up-card");
        if (c) pickUpgrade(+c.dataset.i);
      });
      window.addEventListener(
        "keydown",
        (e) => {
          if (!upgradeOpen) return;
          e.stopImmediatePropagation();
          if (["1", "2", "3"].includes(e.key)) pickUpgrade(+e.key - 1);
        },
        true,
      );
      window.addEventListener(
        "mousedown",
        (e) => {
          if (upgradeOpen) e.stopPropagation();
        },
        true,
      );

      function onEnemyKilled(b) {
        const typeXpMult = b.xpMult || 1;
        const xp = (30 + 6 * prog.wave) * (b.isDragon ? 3 : 1) * typeXpMult;
        popAt(b.mesh.position, `+${xp} XP`, "", 1.5, "#74c0fc");
        gainXP(xp);
        prog.kills++;
        if (prog.kills >= Math.max(2, Math.round((3 + 2 * prog.wave) * 0.7))) {
          prog.wave++;
          prog.kills = 0;
          updateProgHud();
          banner(waveBossPending() ? "⚠ BOSS INCOMING ⚠" : `WAVE ${prog.wave}`);
        }
      }
      function batChaseSpeed(b, dist, dt) {
        // "Far" now starts at 12 m instead of 16 m, so a kiting mage
        // can't sit at 13 m and be untouched.
        b.farT =
          dist > 12 ? (b.farT || 0) + dt : Math.max(0, (b.farT || 0) - 2 * dt);

        // Enemies also get faster as waves go up (previously speed was flat).
        const waveBoost = 1 + Math.min(1.2, (prog.wave - 1) * 0.08);
        const base = 3.4 * (b.batSpeed || 1) * waveBoost;

        if (b.farT > 2.0)
          return (
            (10 + Math.min(30, (b.farT - 2.0) * 14)) *
            (b.batSpeed || 1) *
            waveBoost
          );
        return base;
      }
      function resetProgression() {
        endFocus(false);
        focusLockoutMs = 0;
        sprintActive = false;
        // 🏹 Clear any lingering bat projectiles
        for (let i = batProjectiles.length - 1; i >= 0; i--) {
          const p = batProjectiles[i];
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          batProjectiles.splice(i, 1);
        }
        Object.assign(prog, {
          level: 1,
          xp: 0,
          wave: 1,
          kills: 0,
          bosses: 0,
          dmgMult: 1,
          cdMult: 1,
          speedMult: 1,
          critChance: 0.2,
          healPct: 0.1,
          evasion: 0,
          skillDmgMult: 1,
          critDmgBonus: 0,
          reflectPct: 0,
          dmgReduction: 0,
          punchSpeedMult: 1,
          bloodFistPct: 0,
          flurryRanged: false,
          flowTrance: false,
          karmicBlast: false,
          karmaMeter: 0,
          _lastKarmaBlastAt: 0,
          dragonFist: false,
          dragonFistCount: 0,
          phantomGrace: false,
          phantomCritReady: false,
          archetypePicks: { warrior: 0, assassin: 0, mage: 0, sage: 0 },
          revivesLeft: 1,
          stormLance: false,
          pickedOneTime: {},
          natureWrath: 1,
          serpentStrike: 0,
          thornedHide: 0,
          bloodDebt: false,
          bloodDebtStacks: 0,
          bloodDebtExpiry: 0,
          whirlwind: false,
          berserker: false,
          dodgeCdMult: 1,
          dodgeDistMult: 1,
          frostFist: false,
          chakraInfusion: false,
          cloneJutsu: false,
          cloneReadyAt: 0,
          assassinate: false,
          chakraOverload: false,
        });
        PLAYER_MAX_HP = BASE_MAX_HP;
        playerHP = PLAYER_MAX_HP;
        upgradePicks = 0;
        skill3Cooldown = 0;
        isHealing = false;
        healVFX.group.visible = false;
        removeBoss();
        removeDragon();
        thawPlayer();
        updateProgHud();
        updatePlayerUI();
        updateSkillUI();
      }
