
      // ---------- Player freeze (ice dragon) ----------
      let isFrozen = false,
        freezeT = 0,
        freezeImmuneT = 0;

      // 🔥 Fire dragon burn DoT
      let isBurning = false;
      let burnT = 0;
      let burnTickT = 0;
      const FIRE_BURN_DURATION = 4.0;
      const FIRE_BURN_DMG_PER_TICK = 6;
      const FIRE_BURN_CHANCE = 0.4;

      function burnPlayer(sec) {
        if (isPlayerDead) return;
        isBurning = true;
        burnT = Math.max(burnT, sec);
      }

      function burnFrame(delta) {
        if (!isBurning) return;
        burnT -= delta;
        burnTickT += delta;
        if (burnTickT >= 0.5) {
          burnTickT -= 0.5;
          damagePlayer(
            Math.round(FIRE_BURN_DMG_PER_TICK * enemyMult()),
            null,
            "dot",
          );
        }
        if (burnT <= 0) {
          isBurning = false;
          burnTickT = 0;
        }
      }
      const freezeMesh = new THREE.Group();

      // Ice core crystal (shaded, translucent)
      const freezeCoreGeo = new THREE.IcosahedronGeometry(1.05, 1);
      const freezeCoreMat = new THREE.MeshStandardMaterial({
        color: 0x7fd3ef,
        emissive: 0x1e5a80,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.75,
        flatShading: true,
      });
      const freezeCore = new THREE.Mesh(freezeCoreGeo, freezeCoreMat);
      freezeMesh.add(freezeCore);

      // Wireframe overlay for crystal edges
      const freezeWireMat = new THREE.MeshBasicMaterial({
        color: 0xc5eeff,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const freezeWire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.08, 1),
        freezeWireMat,
      );
      freezeMesh.add(freezeWire);

      // Outer glowing halo
      const freezeHaloMat = new THREE.MeshBasicMaterial({
        color: 0x9be7ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const freezeHalo = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.4, 1),
        freezeHaloMat,
      );
      freezeMesh.add(freezeHalo);

      // Orbiting ice shards
      const freezeShards = [];
      for (let i = 0; i < 6; i++) {
        const shardMat = new THREE.MeshStandardMaterial({
          color: 0xc5eeff,
          emissive: 0x4fb9e8,
          emissiveIntensity: 0.7,
          roughness: 0.1,
          metalness: 0.1,
          flatShading: true,
          transparent: true,
          opacity: 0.9,
        });
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16, 0),
          shardMat,
        );
        const angle = (i / 6) * Math.PI * 2;
        shard.position.set(
          Math.cos(angle) * 1.5,
          ((i % 3) - 1) * 0.45,
          Math.sin(angle) * 1.5,
        );
        shard.userData = { angle, baseY: shard.position.y };
        freezeMesh.add(shard);
        freezeShards.push(shard);
      }

      freezeMesh.scale.set(1, 1.45, 1);
      freezeMesh.visible = false;
      scene.add(freezeMesh);
      function freezePlayer(sec) {
        if (isFrozen || freezeImmuneT > 0 || isPlayerDead || isSkill2Immune)
          return;
        isFrozen = true;
        freezeT = sec;
        isHealing = false;
        healVFX.group.visible = false;
        punchToken++; // cancels any pending normal punch hit
        freezeMesh.visible = true;
        popAt(character.position, "FROZEN!", "dodge", 2.4);
      }
      function thawPlayer() {
        if (!isFrozen) return;
        isFrozen = false;
        freezeImmuneT = 4; // short immunity so you can't be chain-frozen
        freezeMesh.visible = false;
      }
