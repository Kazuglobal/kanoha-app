"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  getCharacterProgress,
  getEquippedAccessories,
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
    return {
      hat: "hat_safari",
      glasses: "glasses_none",
      gloves: "gloves_mitten",
      clothes: "clothes_tshirt",
    };
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
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // 3. Lights (温かみのある照明)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const bottomGlow = new THREE.PointLight(0xffedea, 0.55, 10);
    bottomGlow.position.set(0, -2, 2);
    scene.add(bottomGlow);

    // 4. Character Root Group
    const characterGroup = new THREE.Group();
    scene.add(characterGroup);

    // Material Colors based on mood
    const shirtColors = {
      happy: 0x14b8a6, // ターコイズミント
      think: 0x6366f1, // インディゴブルー
      celebrate: 0xff5b4f, // コーラルレッド
    };

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometriesToDispose.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      materialsToDispose.push(m);
      return m;
    };

    // 共通マテリアル
    const skinMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd8c0, // 親しみやすい明るい肌色
        roughness: 0.45,
        metalness: 0.02,
      })
    );

    const hairMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x5c3d2e, // やわらかなダークブラウン
        roughness: 0.55,
        metalness: 0.05,
      })
    );

    const shirtMat = regMat(
      new THREE.MeshStandardMaterial({
        color: shirtColors[mood],
        roughness: 0.4,
        metalness: 0.04,
      })
    );

    const whiteMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.35,
      })
    );

    const darkMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0x16243b,
      })
    );

    // ========================================================
    // 5. Head Group (頭部・髪・耳・顔・帽子・メガネ)
    // ========================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.32, 0);
    characterGroup.add(headGroup);

    // 5.1 頭部メッシュ（球体）
    const headGeo = regGeo(new THREE.SphereGeometry(0.78, 32, 32));
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.scale.set(1.02, 1.0, 0.98);
    headGroup.add(headMesh);

    // 5.2 髪の毛
    const hairGroup = new THREE.Group();
    headGroup.add(hairGroup);

    // 後ろ髪（後頭部をふんわりカバー）
    const backHairGeo = regGeo(
      new THREE.SphereGeometry(0.83, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.6)
    );
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 0.02, -0.04);
    backHair.rotation.x = -0.15;
    hairGroup.add(backHair);

    // 前髪・サイド髪（丸みのあるかわいい房）
    const frontBangCenterGeo = regGeo(new THREE.SphereGeometry(0.24, 16, 16));
    const centerBang = new THREE.Mesh(frontBangCenterGeo, hairMat);
    centerBang.scale.set(0.82, 0.95, 0.35);
    centerBang.position.set(0, 0.46, 0.66);
    centerBang.rotation.x = 0.22;
    hairGroup.add(centerBang);

    const frontBangSideGeo = regGeo(new THREE.SphereGeometry(0.21, 16, 16));
    const leftBang = new THREE.Mesh(frontBangSideGeo, hairMat);
    leftBang.scale.set(0.8, 0.9, 0.32);
    leftBang.position.set(-0.28, 0.44, 0.62);
    leftBang.rotation.x = 0.2;
    leftBang.rotation.z = 0.18;
    hairGroup.add(leftBang);

    const rightBang = new THREE.Mesh(frontBangSideGeo, hairMat);
    rightBang.scale.set(0.8, 0.9, 0.32);
    rightBang.position.set(0.28, 0.44, 0.62);
    rightBang.rotation.x = 0.2;
    rightBang.rotation.z = -0.18;
    hairGroup.add(rightBang);

    // サイドの髪（もみあげ）
    const sideHairGeo = regGeo(new THREE.SphereGeometry(0.18, 14, 14));
    const leftSide = new THREE.Mesh(sideHairGeo, hairMat);
    leftSide.scale.set(0.35, 1.25, 0.35);
    leftSide.position.set(-0.73, 0.05, 0.16);
    hairGroup.add(leftSide);

    const rightSide = new THREE.Mesh(sideHairGeo, hairMat);
    rightSide.scale.set(0.35, 1.25, 0.35);
    rightSide.position.set(0.73, 0.05, 0.16);
    hairGroup.add(rightSide);

    // チャームポイント：ぴょこんと跳ねたアホ毛
    const tuftGeo = regGeo(new THREE.ConeGeometry(0.08, 0.28, 8));
    const tuft = new THREE.Mesh(tuftGeo, hairMat);
    tuft.position.set(0.08, 0.85, 0.02);
    tuft.rotation.z = -0.38;
    hairGroup.add(tuft);

    // 5.3 耳
    const earGeo = regGeo(new THREE.SphereGeometry(0.15, 16, 16));
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.scale.set(0.4, 0.85, 0.65);
    leftEar.position.set(-0.77, 0.02, 0.05);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.scale.set(0.4, 0.85, 0.65);
    rightEar.position.set(0.77, 0.02, 0.05);
    headGroup.add(rightEar);

    // 5.4 目
    const eyeGeo = regGeo(new THREE.SphereGeometry(0.105, 20, 20));
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.27, 0.04, 0.72);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.27, 0.04, 0.72);
    headGroup.add(rightEye);

    // 瞳のハイライト
    const highlightGeo = regGeo(new THREE.SphereGeometry(0.038, 12, 12));
    const leftHighlight = new THREE.Mesh(highlightGeo, whiteMat);
    leftHighlight.position.set(-0.026, 0.028, 0.085);
    leftEye.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeo, whiteMat);
    rightHighlight.position.set(-0.026, 0.028, 0.085);
    rightEye.add(rightHighlight);

    // まゆげ
    const browGeo = regGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8));
    const leftBrow = new THREE.Mesh(browGeo, hairMat);
    leftBrow.position.set(-0.27, 0.22, 0.71);
    leftBrow.rotation.z = Math.PI / 2 + 0.1;
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, hairMat);
    rightBrow.position.set(0.27, 0.22, 0.71);
    rightBrow.rotation.z = Math.PI / 2 - (mood === "think" ? 0.35 : 0.1);
    if (mood === "think") {
      rightBrow.position.y += 0.04; // 考え中の片眉上げ
    }
    headGroup.add(rightBrow);

    // ほっぺチーク
    const cheekMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xff7694,
        transparent: true,
        opacity: 0.65,
      })
    );
    const cheekGeo = regGeo(new THREE.SphereGeometry(0.11, 16, 16));
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.scale.set(1.1, 0.65, 0.2);
    leftCheek.position.set(-0.43, -0.1, 0.65);
    headGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.scale.set(1.1, 0.65, 0.2);
    rightCheek.position.set(0.43, -0.1, 0.65);
    headGroup.add(rightCheek);

    // 口
    let mouthMesh: THREE.Mesh;
    if (mood === "think") {
      // 考え中：おちょぼ口
      const mouthGeo = regGeo(new THREE.TorusGeometry(0.042, 0.02, 8, 16));
      mouthMesh = new THREE.Mesh(mouthGeo, darkMat);
      mouthMesh.position.set(0, -0.12, 0.75);
    } else if (mood === "celebrate") {
      // 満面のにっこり笑顔
      const mouthGeo = regGeo(new THREE.TorusGeometry(0.12, 0.026, 8, 20, Math.PI));
      mouthMesh = new THREE.Mesh(mouthGeo, darkMat);
      mouthMesh.position.set(0, -0.1, 0.75);
      mouthMesh.rotation.x = Math.PI;
    } else {
      // やさしい笑顔
      const mouthGeo = regGeo(new THREE.TorusGeometry(0.085, 0.022, 8, 20, Math.PI));
      mouthMesh = new THREE.Mesh(mouthGeo, darkMat);
      mouthMesh.position.set(0, -0.12, 0.75);
      mouthMesh.rotation.x = Math.PI;
    }
    headGroup.add(mouthMesh);

    // ========================================================
    // 6. Hats (頭部にフィットする帽子)
    // ========================================================
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.72, 0);

    if (currentAccessories.hat === "hat_safari") {
      // 探検帽（ベージュつば付き）
      const safariMat = regMat(new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.45 }));
      const crownGeo = regGeo(new THREE.CylinderGeometry(0.5, 0.62, 0.4, 24));
      const crown = new THREE.Mesh(crownGeo, safariMat);
      crown.position.set(0, 0.22, 0);
      hatGroup.add(crown);

      const brimGeo = regGeo(new THREE.CylinderGeometry(0.88, 0.88, 0.06, 24));
      const brim = new THREE.Mesh(brimGeo, safariMat);
      brim.position.set(0, 0.04, 0);
      hatGroup.add(brim);

      const bandMat = regMat(new THREE.MeshBasicMaterial({ color: 0x582f0e }));
      const band = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.53, 0.53, 0.08, 24)),
        bandMat
      );
      band.position.set(0, 0.14, 0);
      hatGroup.add(band);
    } else if (currentAccessories.hat === "hat_beret") {
      // 赤いベレー帽（斜めにかぶる）
      const beretMat = regMat(new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.4 }));
      const beretGeo = regGeo(new THREE.SphereGeometry(0.64, 24, 24));
      const beret = new THREE.Mesh(beretGeo, beretMat);
      beret.scale.set(1.05, 0.4, 1.05);
      beret.rotation.z = 0.28;
      beret.rotation.x = -0.15;
      beret.position.set(0.12, 0.16, 0);
      hatGroup.add(beret);

      const stemTip = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8)),
        regMat(new THREE.MeshBasicMaterial({ color: 0x2b2d42 }))
      );
      stemTip.position.set(0.18, 0.38, -0.05);
      hatGroup.add(stemTip);
    } else if (currentAccessories.hat === "hat_ribbon") {
      // ピンクのリボン
      const ribbonMat = regMat(
        new THREE.MeshStandardMaterial({ color: 0xff6584, roughness: 0.25 })
      );
      const ribbonCenter = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.13, 16, 16)), ribbonMat);
      ribbonCenter.position.set(0.35, 0.15, 0.38);
      hatGroup.add(ribbonCenter);

      const ribbonWingGeo = regGeo(new THREE.TorusGeometry(0.22, 0.07, 12, 24));
      const leftWing = new THREE.Mesh(ribbonWingGeo, ribbonMat);
      leftWing.position.set(0.12, 0.18, 0.35);
      leftWing.rotation.y = 0.4;
      hatGroup.add(leftWing);

      const rightWing = new THREE.Mesh(ribbonWingGeo, ribbonMat);
      rightWing.position.set(0.58, 0.18, 0.35);
      rightWing.rotation.y = -0.4;
      hatGroup.add(rightWing);
    } else if (currentAccessories.hat === "hat_wizard") {
      // 魔法使いの帽子（紫とんがり帽子）
      const wizardMat = regMat(new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.35 }));
      const coneGeo = regGeo(new THREE.ConeGeometry(0.52, 1.05, 24));
      const cone = new THREE.Mesh(coneGeo, wizardMat);
      cone.position.set(0, 0.52, -0.04);
      cone.rotation.z = 0.1;
      hatGroup.add(cone);

      const brimGeo = regGeo(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 24));
      const brim = new THREE.Mesh(brimGeo, wizardMat);
      brim.position.set(0, 0.05, 0);
      hatGroup.add(brim);

      const starTip = new THREE.Mesh(
        regGeo(new THREE.SphereGeometry(0.085, 12, 12)),
        regMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 }))
      );
      starTip.position.set(0.11, 1.05, -0.04);
      hatGroup.add(starTip);
    } else if (currentAccessories.hat === "hat_crown") {
      // 黄金の王冠
      const crownMat = regMat(
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.65,
          roughness: 0.2,
        })
      );
      const crownBase = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.48, 0.44, 0.26, 16)),
        crownMat
      );
      crownBase.position.set(0, 0.14, 0);
      hatGroup.add(crownBase);

      const spikeGeo = regGeo(new THREE.ConeGeometry(0.1, 0.22, 8));
      for (let i = 0; i < 5; i++) {
        const theta = (i * (Math.PI * 2)) / 5;
        const spike = new THREE.Mesh(spikeGeo, crownMat);
        spike.position.set(Math.sin(theta) * 0.44, 0.35, Math.cos(theta) * 0.44);
        hatGroup.add(spike);

        const jewel = new THREE.Mesh(
          regGeo(new THREE.SphereGeometry(0.04, 8, 8)),
          regMat(new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xef4444 : 0x3b82f6 }))
        );
        jewel.position.set(Math.sin(theta) * 0.44, 0.46, Math.cos(theta) * 0.44);
        hatGroup.add(jewel);
      }
    }

    if (currentAccessories.hat !== "hat_none") {
      headGroup.add(hatGroup);
    }

    // ========================================================
    // 7. Glasses (メガネ・頭部に追従)
    // ========================================================
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.04, 0.77);

    if (currentAccessories.glasses === "glasses_round") {
      // まるめがね（ゴールド細フレーム）
      const frameMat = regMat(
        new THREE.MeshStandardMaterial({
          color: 0xd97706,
          metalness: 0.7,
          roughness: 0.25,
        })
      );
      const rimGeo = regGeo(new THREE.TorusGeometry(0.17, 0.024, 12, 28));

      const leftRim = new THREE.Mesh(rimGeo, frameMat);
      leftRim.position.set(-0.27, 0, 0);
      glassesGroup.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeo, frameMat);
      rightRim.position.set(0.27, 0, 0);
      glassesGroup.add(rightRim);

      const bridgeGeo = regGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8));
      const bridge = new THREE.Mesh(bridgeGeo, frameMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.02, -0.01);
      glassesGroup.add(bridge);
    } else if (currentAccessories.glasses === "glasses_star") {
      // ほしのサングラス
      const starMat = regMat(
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          metalness: 0.2,
          roughness: 0.2,
        })
      );
      const rimGeo = regGeo(new THREE.TorusGeometry(0.19, 0.032, 5, 5));

      const leftStar = new THREE.Mesh(rimGeo, starMat);
      leftStar.position.set(-0.27, 0, 0);
      leftStar.rotation.z = Math.PI / 5;
      glassesGroup.add(leftStar);

      const rightStar = new THREE.Mesh(rimGeo, starMat);
      rightStar.position.set(0.27, 0, 0);
      rightStar.rotation.z = Math.PI / 5;
      glassesGroup.add(rightStar);

      const bridge = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8)),
        starMat
      );
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.02, 0);
      glassesGroup.add(bridge);
    }

    if (currentAccessories.glasses !== "glasses_none") {
      headGroup.add(glassesGroup);
    }

    // ========================================================
    // 8. Body Group (首・洋服/体・襟・成長エンブレムバッジ)
    // ========================================================
    const bodyGroup = new THREE.Group();
    characterGroup.add(bodyGroup);

    // 首
    const neckGeo = regGeo(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 16));
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, -0.22, 0);
    bodyGroup.add(neckMesh);

    // 服のマテリアル & 装飾 (currentAccessories.clothes)
    const equippedClothes = currentAccessories.clothes || "clothes_tshirt";

    let bodyClothMat = shirtMat;
    let sleeveMat = shirtMat;

    if (equippedClothes === "clothes_school") {
      bodyClothMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }));
      sleeveMat = bodyClothMat;
    } else if (equippedClothes === "clothes_safari") {
      bodyClothMat = regMat(new THREE.MeshStandardMaterial({ color: 0xc59b6d, roughness: 0.45 }));
      sleeveMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }));
    } else if (equippedClothes === "clothes_hoodie") {
      bodyClothMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 }));
      sleeveMat = bodyClothMat;
    } else if (equippedClothes === "clothes_wizard") {
      bodyClothMat = regMat(new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.35 }));
      sleeveMat = bodyClothMat;
    } else if (equippedClothes === "clothes_hero") {
      bodyClothMat = regMat(
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.65, roughness: 0.2 })
      );
      sleeveMat = bodyClothMat;
    }

    // 洋服メッシュ
    const shirtGeo = regGeo(new THREE.CylinderGeometry(0.42, 0.62, 0.72, 24));
    const shirtMesh = new THREE.Mesh(shirtGeo, bodyClothMat);
    shirtMesh.position.set(0, -0.62, 0);
    bodyGroup.add(shirtMesh);

    // 服ごとの固有アクセント & 襟装飾
    if (equippedClothes === "clothes_school") {
      // がくせいふく: 白いシャツ襟 + 赤いネクタイ + 金ボタン
      const collarMesh = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.24, 0.04, 12, 24)),
        whiteMat
      );
      collarMesh.position.set(0, -0.28, 0.02);
      collarMesh.rotation.x = Math.PI / 2;
      bodyGroup.add(collarMesh);

      // 赤いネクタイ
      const tieMat = regMat(new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.4 }));
      const tieKnot = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.045, 8, 8)), tieMat);
      tieKnot.position.set(0, -0.32, 0.46);
      bodyGroup.add(tieKnot);

      const tieBody = new THREE.Mesh(
        regGeo(new THREE.ConeGeometry(0.06, 0.22, 6)),
        tieMat
      );
      tieBody.position.set(0, -0.45, 0.47);
      tieBody.rotation.x = 0.12;
      bodyGroup.add(tieBody);

      // 金ボタン
      const buttonMat = regMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      const btnGeo = regGeo(new THREE.SphereGeometry(0.025, 8, 8));
      const btn1 = new THREE.Mesh(btnGeo, buttonMat);
      btn1.position.set(0, -0.6, 0.53);
      bodyGroup.add(btn1);
      const btn2 = new THREE.Mesh(btnGeo, buttonMat);
      btn2.position.set(0, -0.72, 0.58);
      bodyGroup.add(btn2);
    } else if (equippedClothes === "clothes_safari") {
      // たんけんベスト: カーキの襟 + ポケット2つ + グリーンバンダナ
      const collarMesh = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.24, 0.04, 12, 24)),
        regMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 }))
      );
      collarMesh.position.set(0, -0.28, 0.02);
      collarMesh.rotation.x = Math.PI / 2;
      bodyGroup.add(collarMesh);

      // ポケット
      const pocketMat = regMat(new THREE.MeshStandardMaterial({ color: 0xa98467, roughness: 0.5 }));
      const pockGeo = regGeo(new THREE.BoxGeometry(0.12, 0.12, 0.04));
      const pockL = new THREE.Mesh(pockGeo, pocketMat);
      pockL.position.set(-0.22, -0.62, 0.48);
      bodyGroup.add(pockL);
      const pockR = new THREE.Mesh(pockGeo, pocketMat);
      pockR.position.set(0.22, -0.62, 0.48);
      bodyGroup.add(pockR);
    } else if (equippedClothes === "clothes_hoodie") {
      // ポップパーカー: 立体フード + カンガルーポケット
      const hoodMat = regMat(new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 }));
      const hoodRing = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.28, 0.08, 12, 24)),
        hoodMat
      );
      hoodRing.position.set(0, -0.26, -0.06);
      hoodRing.rotation.x = Math.PI / 2 - 0.2;
      bodyGroup.add(hoodRing);

      // カンガルーポケット
      const kPocket = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.3, 0.15, 0.05)),
        hoodMat
      );
      kPocket.position.set(0, -0.68, 0.54);
      bodyGroup.add(kPocket);
    } else if (equippedClothes === "clothes_wizard") {
      // まほうのローブ: ゴールド縦ライン + 金のハイネック
      const goldTrimMat = regMat(
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.25 })
      );
      const collarMesh = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.24, 0.04, 12, 24)),
        goldTrimMat
      );
      collarMesh.position.set(0, -0.28, 0.02);
      collarMesh.rotation.x = Math.PI / 2;
      bodyGroup.add(collarMesh);

      // フロントの金トリム
      const trimMesh = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 8)),
        goldTrimMat
      );
      trimMesh.position.set(0, -0.62, 0.53);
      bodyGroup.add(trimMesh);
    } else if (equippedClothes === "clothes_hero") {
      // ゆうしゃのよろい: 真紅のマント + ブルーの勇者クリスタル
      const capeMat = regMat(new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.35 }));
      const capeGeo = regGeo(new THREE.CylinderGeometry(0.48, 0.72, 0.8, 16, 1, true, -Math.PI * 0.7, Math.PI * 1.4));
      const cape = new THREE.Mesh(capeGeo, capeMat);
      cape.position.set(0, -0.64, -0.08);
      cape.scale.set(1.05, 1.0, 1.05);
      bodyGroup.add(cape);

      // 胸のクリスタル
      const crystalMat = regMat(
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.4, roughness: 0.1 })
      );
      const crystal = new THREE.Mesh(regGeo(new THREE.OctahedronGeometry(0.08)), crystalMat);
      crystal.position.set(0, -0.42, 0.48);
      bodyGroup.add(crystal);

      // 金の丸襟
      const collarMesh = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.25, 0.05, 12, 24)),
        bodyClothMat
      );
      collarMesh.position.set(0, -0.28, 0.02);
      collarMesh.rotation.x = Math.PI / 2;
      bodyGroup.add(collarMesh);
    } else {
      // いつものTシャツ: 白い丸襟
      const collarGeo = regGeo(new THREE.TorusGeometry(0.25, 0.045, 12, 24));
      const collarMesh = new THREE.Mesh(collarGeo, whiteMat);
      collarMesh.position.set(0, -0.28, 0.02);
      collarMesh.rotation.x = Math.PI / 2;
      bodyGroup.add(collarMesh);
    }

    // ========================================================
    // 9. Growth Stage Badge (胸元の成長エンブレムバッジ: Lv1〜5)
    // ========================================================
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0.26, -0.5, 0.46);
    badgeGroup.rotation.y = 0.2;
    bodyGroup.add(badgeGroup);

    // バッジ台座ピン
    const badgeBaseMat = regMat(
      new THREE.MeshStandardMaterial({
        color: currentLevel >= 4 ? 0xf59e0b : 0xe2e8f0,
        metalness: 0.6,
        roughness: 0.25,
      })
    );
    const badgeBaseGeo = regGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16));
    const badgeBase = new THREE.Mesh(badgeBaseGeo, badgeBaseMat);
    badgeBase.rotation.x = Math.PI / 2;
    badgeGroup.add(badgeBase);

    // レベル別シンボル
    const leafMat = regMat(new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3 }));
    const leafGeo = regGeo(new THREE.SphereGeometry(0.08, 12, 12));

    if (currentLevel === 1) {
      // Stage 1: 小さな芽ピン
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(0.4, 0.8, 0.2);
      leaf.position.set(0, 0, 0.03);
      badgeGroup.add(leaf);
    } else if (currentLevel === 2) {
      // Stage 2: 双葉ピン
      const leafL = new THREE.Mesh(leafGeo, leafMat);
      leafL.scale.set(0.4, 0.8, 0.2);
      leafL.rotation.z = Math.PI / 4;
      leafL.position.set(-0.04, 0, 0.03);
      badgeGroup.add(leafL);

      const leafR = new THREE.Mesh(leafGeo, leafMat);
      leafR.scale.set(0.4, 0.8, 0.2);
      leafR.rotation.z = -Math.PI / 4;
      leafR.position.set(0.04, 0, 0.03);
      badgeGroup.add(leafR);
    } else if (currentLevel === 3) {
      // Stage 3: 四つ葉クローバー
      const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
      angles.forEach((angle) => {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.scale.set(0.35, 0.6, 0.18);
        leaf.rotation.z = angle;
        leaf.position.set(Math.cos(angle) * 0.04, Math.sin(angle) * 0.04, 0.03);
        badgeGroup.add(leaf);
      });
    } else if (currentLevel === 4) {
      // Stage 4: ピンクのつぼみチャーム
      const budMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.25 }));
      const budGeo = regGeo(new THREE.SphereGeometry(0.09, 12, 12));
      const budMesh = new THREE.Mesh(budGeo, budMat);
      budMesh.scale.set(0.8, 1.1, 0.5);
      budMesh.position.set(0, 0, 0.03);
      badgeGroup.add(budMesh);
    } else {
      // Stage 5: まんかいマスターの黄金フラワー
      const centerMat = regMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 }));
      const center = new THREE.Mesh(regGeo(new THREE.SphereGeometry(0.06, 12, 12)), centerMat);
      center.position.set(0, 0, 0.04);
      badgeGroup.add(center);

      const petalMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 }));
      for (let i = 0; i < 5; i++) {
        const theta = (i * (Math.PI * 2)) / 5;
        const petal = new THREE.Mesh(leafGeo, petalMat);
        petal.scale.set(0.35, 0.55, 0.18);
        petal.rotation.z = theta;
        petal.position.set(Math.sin(theta) * 0.07, Math.cos(theta) * 0.07, 0.03);
        badgeGroup.add(petal);
      }
    }

    // ========================================================
    // 10. Arms, Hands & Gloves (腕・手・手袋)
    // ========================================================
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.54, -0.4, 0);
    characterGroup.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.54, -0.4, 0);
    characterGroup.add(rightArmGroup);

    // 袖
    const sleeveGeo = regGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.24, 16));
    const leftSleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    leftSleeve.rotation.z = 0.45;
    leftSleeve.position.set(-0.08, -0.05, 0);
    leftArmGroup.add(leftSleeve);

    const rightSleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    rightSleeve.rotation.z = -0.45;
    rightSleeve.position.set(0.08, -0.05, 0);
    rightArmGroup.add(rightSleeve);

    // 手・手袋
    let handColor = 0xffd8c0; // デフォルト肌色
    let handRoughness = 0.45;
    let handMetalness = 0.02;

    if (currentAccessories.gloves === "gloves_mitten") {
      handColor = 0xffffff;
      handRoughness = 0.35;
    } else if (currentAccessories.gloves === "gloves_gold") {
      handColor = 0xf59e0b;
      handRoughness = 0.2;
      handMetalness = 0.65;
    }

    const handMat = regMat(
      new THREE.MeshStandardMaterial({
        color: handColor,
        roughness: handRoughness,
        metalness: handMetalness,
      })
    );

    const handGeo = regGeo(new THREE.SphereGeometry(0.13, 16, 16));

    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(-0.25, -0.22, 0.15);
    leftArmGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.set(0.25, -0.22, 0.15);
    rightArmGroup.add(rightHand);

    // 手袋のカフス（手首もこもこリング）
    if (currentAccessories.gloves !== "gloves_none") {
      const cuffGeo = regGeo(new THREE.TorusGeometry(0.11, 0.032, 12, 20));
      const cuffMat = regMat(
        new THREE.MeshStandardMaterial({
          color: currentAccessories.gloves === "gloves_gold" ? 0xfef08a : 0xf3f4f6,
          roughness: 0.3,
        })
      );

      const leftCuff = new THREE.Mesh(cuffGeo, cuffMat);
      leftCuff.position.set(-0.2, -0.16, 0.12);
      leftCuff.rotation.y = Math.PI / 2;
      leftArmGroup.add(leftCuff);

      const rightCuff = new THREE.Mesh(cuffGeo, cuffMat);
      rightCuff.position.set(0.2, -0.16, 0.12);
      rightCuff.rotation.y = Math.PI / 2;
      rightArmGroup.add(rightCuff);
    }

    // 11. Mouse tracking handler
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

    // 12. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Idle Hover & Breathing
      const hoverY = Math.sin(elapsed * 2.2) * 0.06;
      const breathScale = 1 + Math.sin(elapsed * 3) * 0.015;

      // Spring physics for tap bounce (Squash & Stretch)
      const spring = bounceSpring.current;
      const force = (1 - spring.scaleY) * 0.18;
      spring.velocity += force;
      spring.velocity *= 0.82; // damping
      spring.scaleY += spring.velocity;
      spring.scaleXZ = 1 + (1 - spring.scaleY) * 0.5;

      characterGroup.position.y = hoverY;
      characterGroup.scale.set(
        breathScale * spring.scaleXZ,
        breathScale * spring.scaleY,
        breathScale * spring.scaleXZ
      );

      // 帽子・バッジの微細な揺れ
      if (currentAccessories.hat !== "hat_none") {
        hatGroup.rotation.z = Math.sin(elapsed * 2.5) * 0.03;
      }
      badgeGroup.rotation.z = Math.sin(elapsed * 2.8) * 0.05;

      // Mouse Eye & Head following
      const targetLookX = mousePos.current.x * 0.25;
      const targetLookY = mousePos.current.y * 0.18;

      headGroup.rotation.y += (targetLookX - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (-targetLookY - headGroup.rotation.x) * 0.08;

      // Eye pupil parallax
      leftHighlight.position.x = -0.026 + mousePos.current.x * 0.015;
      rightHighlight.position.x = -0.026 + mousePos.current.x * 0.015;

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
        // バンザイジャンプ！
        characterGroup.position.y += Math.abs(Math.sin(elapsed * 6)) * 0.22;
        leftArmGroup.rotation.z = 2.4 + Math.sin(elapsed * 8) * 0.25;
        rightArmGroup.rotation.z = -2.4 - Math.cos(elapsed * 8) * 0.25;
        characterGroup.rotation.z = Math.sin(elapsed * 5) * 0.08;
      } else if (mood === "think") {
        // 思案ポーズ（首を傾げ、右手をあごに）
        headGroup.rotation.z = 0.12 + Math.sin(elapsed * 1.8) * 0.03;
        leftArmGroup.rotation.z = 0.1;
        rightArmGroup.rotation.z = -1.2;
        rightHand.position.set(0.12, 0.15, 0.45);
      } else {
        // Happy: やさしく手を振る
        leftArmGroup.rotation.z = 0.1 + Math.sin(elapsed * 2) * 0.08;
        rightArmGroup.rotation.z = -0.1 - Math.cos(elapsed * 2) * 0.08;
        characterGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.02;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 13. Click bounce trigger
    const handleContainerClick = () => {
      bounceSpring.current.velocity = -0.32; // squash
      onClick?.();
    };

    container.addEventListener("click", handleContainerClick);

    // 14. Cleanup
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", handleContainerClick);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());

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
