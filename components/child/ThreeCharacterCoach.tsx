"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  getCharacterProgress,
  getEquippedAccessories,
  DEFAULT_EQUIPPED,
  type EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";

interface ThreeCharacterCoachProps {
  mood?: "happy" | "think" | "celebrate";
  level?: number;
  accessories?: EquippedAccessories;
  onClick?: () => void;
}

export function ThreeCharacterCoach({
  mood = "happy",
  level: propsLevel,
  accessories: propsAccessories,
  onClick,
}: ThreeCharacterCoachProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  // マウス追従用ターゲット
  const mousePos = useRef({ x: 0, y: 0 });
  // タップ・クリック時のバウンス用
  const bounceSpring = useRef({ scaleY: 1, scaleXZ: 1, velocity: 0 });

  // 内部ステート（プロップスで渡されない場合はストアから取得）
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    if (propsLevel !== undefined) return propsLevel;
    if (typeof window !== "undefined") {
      return getCharacterProgress().currentLevel.level;
    }
    return 1;
  });

  const [currentAccessories, setCurrentAccessories] = useState<EquippedAccessories>(() => {
    if (propsAccessories) return propsAccessories;
    if (typeof window !== "undefined") {
      return getEquippedAccessories();
    }
    return DEFAULT_EQUIPPED;
  });

  // プロップス変更への追従
  useEffect(() => {
    if (propsLevel !== undefined) setCurrentLevel(propsLevel);
  }, [propsLevel]);

  useEffect(() => {
    if (propsAccessories) setCurrentAccessories(propsAccessories);
  }, [propsAccessories]);

  // グローバルイベントによる自動同期
  useEffect(() => {
    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail && !propsAccessories) {
        setCurrentAccessories(customEvent.detail);
        // 着替え時に弾む
        bounceSpring.current.velocity = -0.28;
      }
    };

    const handleGrowthChange = () => {
      if (propsLevel === undefined) {
        setCurrentLevel(getCharacterProgress().currentLevel.level);
        bounceSpring.current.velocity = -0.35;
      }
    };

    window.addEventListener("kanoha-accessory-update", handleAccessoryChange);
    window.addEventListener("kanoha-reward-update", handleGrowthChange);
    window.addEventListener("kanoha-level-up", handleGrowthChange);

    return () => {
      window.removeEventListener("kanoha-accessory-update", handleAccessoryChange);
      window.removeEventListener("kanoha-reward-update", handleGrowthChange);
      window.removeEventListener("kanoha-level-up", handleGrowthChange);
    };
  }, [propsAccessories, propsLevel]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // WebGL サポート判定
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = container.clientWidth || 180;
    const height = container.clientHeight || 180;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const bottomGlow = new THREE.PointLight(0xa7f3d0, 0.8, 10);
    bottomGlow.position.set(0, -2, 2);
    scene.add(bottomGlow);

    // 4. Character Root Group
    const characterGroup = new THREE.Group();
    scene.add(characterGroup);

    // Material Colors based on mood
    const bodyColors = {
      happy: 0x14b8a6, // Emerald Mint
      think: 0x6366f1, // Indigo
      celebrate: 0xff5b4f, // Coral
    };

    // Body
    const bodyGeometry = new THREE.SphereGeometry(1.0, 36, 36);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColors[mood],
      roughness: 0.28,
      metalness: 0.05,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.scale.set(1.15, 1.0, 1.05);
    characterGroup.add(bodyMesh);

    // ========================================================
    // 5. Growth Stage Decoration (頭部の成長: 芽→双葉→四つ葉→花)
    // ========================================================
    const growthGroup = new THREE.Group();
    growthGroup.position.set(0, 1.0, 0);

    const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.35, 16);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.3 });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0, 0.17, 0);
    growthGroup.add(stemMesh);

    const leafGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.25 });

    if (currentLevel === 1) {
      // Stage 1: 小さな芽がちょこん
      const leafSingle = new THREE.Mesh(leafGeo, leafMat);
      leafSingle.scale.set(0.35, 0.7, 0.15);
      leafSingle.position.set(0, 0.32, 0);
      growthGroup.add(leafSingle);
    } else if (currentLevel === 2) {
      // Stage 2: 双葉
      const leafLeft = new THREE.Mesh(leafGeo, leafMat);
      leafLeft.scale.set(0.4, 1.0, 0.15);
      leafLeft.rotation.z = Math.PI / 3.5;
      leafLeft.position.set(-0.16, 0.32, 0);
      growthGroup.add(leafLeft);

      const leafRight = new THREE.Mesh(leafGeo, leafMat);
      leafRight.scale.set(0.4, 1.0, 0.15);
      leafRight.rotation.z = -Math.PI / 3.5;
      leafRight.position.set(0.16, 0.32, 0);
      growthGroup.add(leafRight);
    } else if (currentLevel === 3) {
      // Stage 3: 四つ葉
      const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
      angles.forEach((angle) => {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.scale.set(0.38, 0.9, 0.14);
        leaf.rotation.z = Math.PI / 3.5;
        leaf.rotation.y = angle;
        leaf.position.set(Math.cos(angle) * 0.14, 0.32, Math.sin(angle) * 0.14);
        growthGroup.add(leaf);
      });
    } else if (currentLevel === 4) {
      // Stage 4: ピンクのつぼみ
      const budGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const budMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.3 });
      const budMesh = new THREE.Mesh(budGeo, budMat);
      budMesh.scale.set(0.8, 1.2, 0.8);
      budMesh.position.set(0, 0.36, 0);
      growthGroup.add(budMesh);

      // 小さな葉っぱ2枚
      const leafLeft = new THREE.Mesh(leafGeo, leafMat);
      leafLeft.scale.set(0.3, 0.7, 0.12);
      leafLeft.rotation.z = Math.PI / 3;
      leafLeft.position.set(-0.14, 0.22, 0);
      growthGroup.add(leafLeft);
    } else {
      // Stage 5: まんかいマスターのお花
      const centerGeo = new THREE.SphereGeometry(0.16, 16, 16);
      const centerMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2 });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      centerMesh.position.set(0, 0.38, 0.05);
      growthGroup.add(centerMesh);

      const petalGeo = new THREE.SphereGeometry(0.2, 16, 16);
      const petalMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 });
      for (let i = 0; i < 5; i++) {
        const theta = (i * (Math.PI * 2)) / 5;
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.scale.set(0.6, 0.9, 0.2);
        petal.rotation.z = theta;
        petal.position.set(Math.sin(theta) * 0.26, 0.38 + Math.cos(theta) * 0.26, 0);
        growthGroup.add(petal);
      }
    }

    characterGroup.add(growthGroup);

    // ========================================================
    // 6. Hats (ぼうし)
    // ========================================================
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.96, 0);

    if (currentAccessories.hat === "hat_safari") {
      // 探検帽（ベージュつば付き）
      const safariMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.45 });
      const crownGeo = new THREE.CylinderGeometry(0.52, 0.65, 0.42, 24);
      const crown = new THREE.Mesh(crownGeo, safariMat);
      crown.position.set(0, 0.25, 0);
      hatGroup.add(crown);

      const brimGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.06, 24);
      const brim = new THREE.Mesh(brimGeo, safariMat);
      brim.position.set(0, 0.06, 0);
      hatGroup.add(brim);

      const bandMat = new THREE.MeshBasicMaterial({ color: 0x582f0e });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24), bandMat);
      band.position.set(0, 0.16, 0);
      hatGroup.add(band);
    } else if (currentAccessories.hat === "hat_beret") {
      // 赤いベレー帽（斜めにかぶる）
      const beretMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.4 });
      const beretGeo = new THREE.SphereGeometry(0.68, 24, 24);
      const beret = new THREE.Mesh(beretGeo, beretMat);
      beret.scale.set(1.1, 0.42, 1.1);
      beret.rotation.z = 0.28;
      beret.rotation.x = -0.15;
      beret.position.set(0.12, 0.18, 0);
      hatGroup.add(beret);

      const stemTip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8),
        new THREE.MeshBasicMaterial({ color: 0x2b2d42 })
      );
      stemTip.position.set(0.18, 0.4, -0.05);
      hatGroup.add(stemTip);
    } else if (currentAccessories.hat === "hat_ribbon") {
      // ピンクのリボン
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xff6584, roughness: 0.25 });
      const ribbonCenter = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), ribbonMat);
      ribbonCenter.position.set(0, 0.18, 0.4);
      hatGroup.add(ribbonCenter);

      const ribbonWingGeo = new THREE.TorusGeometry(0.25, 0.08, 12, 24);
      const leftWing = new THREE.Mesh(ribbonWingGeo, ribbonMat);
      leftWing.position.set(-0.32, 0.22, 0.35);
      leftWing.rotation.y = 0.4;
      hatGroup.add(leftWing);

      const rightWing = new THREE.Mesh(ribbonWingGeo, ribbonMat);
      rightWing.position.set(0.32, 0.22, 0.35);
      rightWing.rotation.y = -0.4;
      hatGroup.add(rightWing);
    } else if (currentAccessories.hat === "hat_wizard") {
      // 魔法使いの帽子（紫とんがり帽子）
      const wizardMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.35 });
      const coneGeo = new THREE.ConeGeometry(0.55, 1.1, 24);
      const cone = new THREE.Mesh(coneGeo, wizardMat);
      cone.position.set(0, 0.55, -0.05);
      cone.rotation.z = 0.1;
      hatGroup.add(cone);

      const brimGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.05, 24);
      const brim = new THREE.Mesh(brimGeo, wizardMat);
      brim.position.set(0, 0.06, 0);
      hatGroup.add(brim);

      const starTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      starTip.position.set(0.12, 1.1, -0.05);
      hatGroup.add(starTip);
    } else if (currentAccessories.hat === "hat_crown") {
      // 黄金の王冠
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.6,
        roughness: 0.2,
      });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.48, 0.28, 16), crownMat);
      crownBase.position.set(0, 0.15, 0);
      hatGroup.add(crownBase);

      // 王冠のトゲ
      const spikeGeo = new THREE.ConeGeometry(0.11, 0.24, 8);
      for (let i = 0; i < 5; i++) {
        const theta = (i * (Math.PI * 2)) / 5;
        const spike = new THREE.Mesh(spikeGeo, crownMat);
        spike.position.set(Math.sin(theta) * 0.48, 0.38, Math.cos(theta) * 0.48);
        hatGroup.add(spike);

        // トゲの先端に宝石
        const jewel = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 8),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xef4444 : 0x3b82f6 })
        );
        jewel.position.set(Math.sin(theta) * 0.48, 0.5, Math.cos(theta) * 0.48);
        hatGroup.add(jewel);
      }
    }

    if (currentAccessories.hat !== "hat_none") {
      characterGroup.add(hatGroup);
    }

    // ========================================================
    // 7. Eyes (目・表情)
    // ========================================================
    const eyeGeo = new THREE.SphereGeometry(0.125, 20, 20);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.38, 0.12, 0.98);
    characterGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.38, 0.12, 0.98);
    characterGroup.add(rightEye);

    // Eye Highlights
    const highlightGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftHighlight = new THREE.Mesh(highlightGeo, highlightMat);
    leftHighlight.position.set(-0.03, 0.03, 0.1);
    leftEye.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeo, highlightMat);
    rightHighlight.position.set(-0.03, 0.03, 0.1);
    rightEye.add(rightHighlight);

    // ========================================================
    // 8. Glasses (めがね)
    // ========================================================
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.12, 1.05);

    if (currentAccessories.glasses === "glasses_round") {
      // まるめがね（ゴールド細フレーム）
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.7,
        roughness: 0.25,
      });
      const rimGeo = new THREE.TorusGeometry(0.19, 0.026, 12, 28);

      const leftRim = new THREE.Mesh(rimGeo, frameMat);
      leftRim.position.set(-0.38, 0, 0);
      glassesGroup.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeo, frameMat);
      rightRim.position.set(0.38, 0, 0);
      glassesGroup.add(rightRim);

      // ブリッジ（中央のつなぎ）
      const bridgeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.38, 8);
      const bridge = new THREE.Mesh(bridgeGeo, frameMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.03, -0.01);
      glassesGroup.add(bridge);
    } else if (currentAccessories.glasses === "glasses_star") {
      // ほしのサングラス（黄色・星型風）
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.2,
        roughness: 0.2,
      });
      const rimGeo = new THREE.TorusGeometry(0.21, 0.035, 5, 5); // 5角形（星っぽい）

      const leftStar = new THREE.Mesh(rimGeo, starMat);
      leftStar.position.set(-0.38, 0, 0);
      leftStar.rotation.z = Math.PI / 5;
      glassesGroup.add(leftStar);

      const rightStar = new THREE.Mesh(rimGeo, starMat);
      rightStar.position.set(0.38, 0, 0);
      rightStar.rotation.z = Math.PI / 5;
      glassesGroup.add(rightStar);

      const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8),
        starMat
      );
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.02, 0);
      glassesGroup.add(bridge);
    }

    if (currentAccessories.glasses !== "glasses_none") {
      characterGroup.add(glassesGroup);
    }

    // Cheeks
    const cheekGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xff4d6d,
      transparent: true,
      opacity: 0.75,
    });

    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.scale.set(1.0, 0.6, 0.2);
    leftCheek.position.set(-0.55, -0.06, 0.92);
    characterGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.scale.set(1.0, 0.6, 0.2);
    rightCheek.position.set(0.55, -0.06, 0.92);
    characterGroup.add(rightCheek);

    // Smile Mouth
    const mouthGeo = new THREE.TorusGeometry(0.12, 0.03, 8, 20, Math.PI);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, -0.08, 1.05);
    mouthMesh.rotation.x = Math.PI;
    characterGroup.add(mouthMesh);

    // ========================================================
    // 9. Little Hands & Gloves (手・てぶくろ)
    // ========================================================
    const handGeo = new THREE.SphereGeometry(0.15, 16, 16);

    let handColor = bodyColors[mood];
    if (currentAccessories.gloves === "gloves_mitten") {
      handColor = 0xffffff; // 白いミトン
    } else if (currentAccessories.gloves === "gloves_gold") {
      handColor = 0xf59e0b; // きんのグローブ
    }

    const handMat = new THREE.MeshStandardMaterial({
      color: handColor,
      roughness: currentAccessories.gloves === "gloves_gold" ? 0.2 : 0.35,
      metalness: currentAccessories.gloves === "gloves_gold" ? 0.6 : 0.05,
    });

    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(-1.05, -0.25, 0.3);
    characterGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.set(1.05, -0.25, 0.3);
    characterGroup.add(rightHand);

    // 手袋のカフス（手首のもこもこリング）
    if (currentAccessories.gloves !== "gloves_none") {
      const cuffGeo = new THREE.TorusGeometry(0.13, 0.035, 12, 20);
      const cuffMat = new THREE.MeshStandardMaterial({
        color: currentAccessories.gloves === "gloves_gold" ? 0xfef08a : 0xf3f4f6,
        roughness: 0.3,
      });

      const leftCuff = new THREE.Mesh(cuffGeo, cuffMat);
      leftCuff.position.set(-0.95, -0.25, 0.25);
      leftCuff.rotation.y = Math.PI / 2;
      characterGroup.add(leftCuff);

      const rightCuff = new THREE.Mesh(cuffGeo, cuffMat);
      rightCuff.position.set(0.95, -0.25, 0.25);
      rightCuff.rotation.y = Math.PI / 2;
      characterGroup.add(rightCuff);
    }

    // 10. Mouse tracking handler
    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      };
    };

    window.addEventListener("mousemove", onMouseMove);

    // 11. Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();
    let blinkTimer = 0;
    let isBlinking = false;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = (performance.now() - startTime) * 0.001;

      // Idle Hover & Breathing
      const hoverY = Math.sin(elapsed * 2.2) * 0.08;
      const breathScale = 1 + Math.sin(elapsed * 3) * 0.02;

      // Spring physics for tap bounce (Squash & Stretch)
      const spring = bounceSpring.current;
      const force = (1 - spring.scaleY) * 0.18;
      spring.velocity += force;
      spring.velocity *= 0.82; // damping
      spring.scaleY += spring.velocity;
      spring.scaleXZ = 1 + (1 - spring.scaleY) * 0.5;

      characterGroup.position.y = hoverY;
      characterGroup.scale.set(
        1.15 * breathScale * spring.scaleXZ,
        1.0 * breathScale * spring.scaleY,
        1.05 * breathScale * spring.scaleXZ
      );

      // Growth decoration gentle swaying
      growthGroup.rotation.z = Math.sin(elapsed * 3.5) * 0.15;
      if (currentAccessories.hat !== "hat_none") {
        hatGroup.rotation.z = Math.sin(elapsed * 2.5) * 0.04;
      }

      // Mouse Eye & Head following
      const targetLookX = mousePos.current.x * 0.28;
      const targetLookY = mousePos.current.y * 0.22;

      characterGroup.rotation.y += (targetLookX - characterGroup.rotation.y) * 0.08;
      characterGroup.rotation.x += (-targetLookY - characterGroup.rotation.x) * 0.08;

      // Eye pupil parallax
      leftHighlight.position.x = -0.03 + mousePos.current.x * 0.02;
      rightHighlight.position.x = -0.03 + mousePos.current.x * 0.02;

      // Natural Blinking
      blinkTimer += 0.016;
      if (!isBlinking && blinkTimer > 3.2 + Math.random() * 2) {
        isBlinking = true;
        blinkTimer = 0;
      }
      if (isBlinking) {
        leftEye.scale.y = 0.08;
        rightEye.scale.y = 0.08;
        if (blinkTimer > 0.14) {
          isBlinking = false;
          leftEye.scale.y = 1;
          rightEye.scale.y = 1;
          blinkTimer = 0;
        }
      }

      // Mood-specific motions
      if (mood === "celebrate") {
        characterGroup.position.y += Math.abs(Math.sin(elapsed * 6)) * 0.25;
        leftHand.position.y = 0.35 + Math.sin(elapsed * 8) * 0.15;
        rightHand.position.y = 0.35 + Math.cos(elapsed * 8) * 0.15;
        characterGroup.rotation.z = Math.sin(elapsed * 5) * 0.12;
      } else if (mood === "think") {
        characterGroup.rotation.z = 0.14 + Math.sin(elapsed * 1.8) * 0.04;
        leftHand.position.y = -0.15;
        rightHand.position.set(0.4, 0.05, 0.95); // 手をあごに当てるポーズ
      } else {
        // Happy
        leftHand.position.y = -0.25 + Math.sin(elapsed * 2) * 0.04;
        rightHand.position.y = -0.25 + Math.cos(elapsed * 2) * 0.04;
        characterGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.04;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 12. Click bounce trigger
    const handleContainerClick = () => {
      bounceSpring.current.velocity = -0.32; // squash
      onClick?.();
    };

    container.addEventListener("click", handleContainerClick);

    // 13. Cleanup
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", handleContainerClick);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      stemGeo.dispose();
      stemMat.dispose();
      leafGeo.dispose();
      leafMat.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      highlightGeo.dispose();
      highlightMat.dispose();
      cheekGeo.dispose();
      cheekMat.dispose();
      mouthGeo.dispose();
      mouthMat.dispose();
      handGeo.dispose();
      handMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mood, currentLevel, currentAccessories, onClick]);

  if (!hasWebGL) {
    return null; // Fallback to SVG in parent
  }

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        cursor: "pointer",
        touchAction: "none",
      }}
      title="クリックしてね！"
    />
  );
}
