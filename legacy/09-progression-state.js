
      // ==========================================================
      // PROGRESSION: XP / LEVELS / WAVES / HEAL CHANNEL / BOSS
      // ==========================================================
      const $ = (id) => document.getElementById(id);
      const BASE_MAX_HP = 2000;
      const BOSS_FPS = 30; // attack "frame N" is converted to seconds with this
      const BOSS_SCALE = 2.0; // size of the boss model in the world
      const BOSS_FACING = 0; // set to Math.PI if the boss model faces backwards
      const BOSS_RADIUS = 1.3;
      const BOSS_FIRE_START = 57,
        BOSS_FIRE_END = 80; // fireball frames: it grows and damages during these
      const BOSS_STOP = BOSS_RADIUS * BOSS_SCALE + 2.2,
        BOSS_REACH = BOSS_RADIUS * BOSS_SCALE + 3.2,
        BOSS_SPD = 0.6 + 0.4 * BOSS_SCALE;
      const bodyR = (b) =>
        b.isBoss ? BOSS_RADIUS * BOSS_SCALE : b.isDragon ? DRAGON_RADIUS : 0;
      const prog = {
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
        // ── Build-system fields (Phase 1) ──
        skillDmgMult: 1, // Chakra Amp — boosts Skill 1 & Skill 2 damage
        critDmgBonus: 0, // Executioner — extra multiplier on crit hits
        reflectPct: 0, // Counter Stance — % of melee damage taken reflected
        dmgReduction: 0, // Iron Skin — damage taken multiplier (0.5 = −50%)
        punchSpeedMult: 1, // Flurry Hands — punch recovery time multiplier
        bloodFistPct: 0, // Blood Fist — % of punch damage healed
        flurryRanged: false, // Chakra Wave — Flurry becomes ranged AoE cone
        flowTrance: false, // Quick Trance — Healing Trance 3s → 2s
        karmicBlast: false, // Karmic Blast — damage accumulation keystone
        karmaMeter: 0, // accumulated damage toward next blast
        _lastKarmaBlastAt: 0, // internal cooldown timestamp
        dragonFist: false, // Dragon Fist — 15-punch buildup finisher
        dragonFistCount: 0, // buildup counter
        phantomGrace: false, // Phantom's Grace — dodge → heal + guaranteed crit
        phantomCritReady: false, // flag consumed on next punch
        archetypePicks: { warrior: 0, assassin: 0, mage: 0, sage: 0 }, // weighted offering
        revivesLeft: 1, // 💚 Extra life — 1 free revive per run
        stormLance: false, // ⚡ Storm Lance — Thunder Kick becomes ranged
        pickedOneTime: {}, // 🎯 tracks one-time upgrades already chosen
        // 🌿 Sage Phase B
        natureWrath: 1, // burst damage multiplier (1 = none, ×1.5 per pick, cap ×3)
        serpentStrike: 0, // poison % (0 = none, +0.3 per pick, cap 0.6)
        thornedHide: 0, // retaliation % (0 = none, +0.1 per pick, cap 0.4)
        bloodDebt: false, // unlock flag
        bloodDebtStacks: 0, // 0..15
        bloodDebtExpiry: 0, // timestamp
        // 🗡 Phase C
        whirlwind: false, // punches AoE
        berserker: false, // low-HP damage buff
        dodgeCdMult: 1, // <1 = shorter cooldown
        dodgeDistMult: 1, // >1 = longer dash
        frostFist: false, // crits slow enemies
        chakraInfusion: false, // skills apply burn
        cloneJutsu: false, // phantom punch backup
        cloneReadyAt: 0, // timestamp when clone fires
        assassinate: false, // T3 Assassin capstone
        chakraOverload: false, // T3 Mage capstone
      };
      const enemyMult = () => Game.waves.enemyMult(prog.wave, prog.bosses);
      const bossActive = () => !!bossObj && bossObj.state === "alive";
      const waveBossPending = () => Game.waves.isBossWave(prog.wave);
