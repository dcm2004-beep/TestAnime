
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87ceeb);
      scene.fog = new THREE.Fog(0xa4d3ee, 45, 160);

      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;

      document.body.appendChild(renderer.domElement);

      const toonPalette = new Uint8Array([
        140, 140, 170, 255, 210, 210, 230, 255, 255, 255, 255, 255,
      ]);
      const toonRamp = new THREE.DataTexture(
        toonPalette,
        3,
        1,
        THREE.RGBAFormat,
      );
      toonRamp.minFilter = THREE.NearestFilter;
      toonRamp.magFilter = THREE.NearestFilter;
      toonRamp.needsUpdate = true;

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1b5e20, 0.5);
      scene.add(hemiLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
      scene.add(ambientLight);

      const sun = new THREE.DirectionalLight(0xfffaea, 0.8);
      sun.position.set(40, 80, 40);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      const shadowSize = 50;
      sun.shadow.camera.left = -shadowSize;
      sun.shadow.camera.right = shadowSize;
      sun.shadow.camera.top = shadowSize;
      sun.shadow.camera.bottom = -shadowSize;
      scene.add(sun);

      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x111115,
        side: THREE.BackSide,
      });
      function createStylizedMesh(geo, mat, outlineThickness = 0.03) {
        const parent = new THREE.Group();
        const mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;
        parent.add(mainMesh);

        if (outlineThickness > 0) {
          const outlineMesh = new THREE.Mesh(geo, outlineMat);
          outlineMesh.scale.multiplyScalar(1 + outlineThickness);
          parent.add(outlineMesh);
        }
        return parent;
      }

      function getElevation(x, z) {
        return (
          Math.sin(x * 0.035) * Math.cos(z * 0.035) * 2.2 +
          Math.sin(x * 0.07) * 0.9
        );
      }
