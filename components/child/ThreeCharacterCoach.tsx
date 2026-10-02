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

/**
 * ThreeCharacterCoach
 * WebGL (Three.js) を使った立体的なアニメの女の子キャラクター「かのはちゃん」。
 * 頭からツインテール、きらめく瞳、制服、プリーツスカート、レースソックス、ローファーまで完全再現。
 * マウス視線追従、ふんわり揺れるツインテール、自然なまばたき、タップジャンプを搭載。
 */
export function ThreeCharacterCoach({
  mood = "happy",
  level: propsLevel,
  accessories: propsAccessories,
  onClick,
}: ThreeCharacterCoachProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  // マウス座標（-1〜1）
  const mousePos = useRef({ x: 0, y: 0 });
  const targetLook = useRef({ x: 0, y: 0 });
  // タップ・クリック時のバウンス
  const bounceSpring = useRef({ y: 0, velocity: 0 });

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

  useEffect(() => {
    if (propsLevel !== undefined) setCurrentLevel(propsLevel);
  }, [propsLevel]);

  useEffect(() => {
    if (propsAccessories) setCurrentAccessories(propsAccessories);
  }, [propsAccessories]);

  // グローバルイベント同期
  useEffect(() => {
    const handleAccessoryChange = (e: Event) => {
      const customEvent = e as CustomEvent<EquippedAccessories>;
      if (customEvent.detail && !propsAccessories) {
        setCurrentAccessories(customEvent.detail);
        bounceSpring.current.velocity = 0.12;
      }
    };

    const handleGrowthChange = () => {
      if (propsLevel === undefined) {
        setCurrentLevel(getCharacterProgress().currentLevel.level);
        bounceSpring.current.velocity = 0.18;
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

    const width = container.clientWidth || 200;
    const height = container.clientHeight || 250;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.28, 4.8);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 3. Lighting (柔らかなアニメセル調ライティング)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5eb, 1.25);
    keyLight.position.set(2.5, 4, 3.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.65);
    fillLight.position.set(-2.5, 1.5, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfbcfe8, 0.75);
    rimLight.position.set(0, -2, -2.5);
    scene.add(rimLight);

    // 4. Root Character Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // ==========================================
    // マテリアルパレット（高品質アニメ調）
    // ==========================================
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffede0,
      roughness: 0.55,
      metalness: 0.02,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x7c4322,
      roughness: 0.45,
      metalness: 0.05,
    });

    const hairHighlightMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.7,
    });

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x081528 });
    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeLineMat = new THREE.MeshBasicMaterial({ color: 0x1a2436 });
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xff6b8b,
      transparent: true,
      opacity: 0.55,
    });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0xbe123c });

    const uniformNavyMat = new THREE.MeshStandardMaterial({
      color: 0x1a2b47,
      roughness: 0.5,
    });
    const blouseWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
    });
    const ribbonRedMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.35,
    });
    const skirtNavyMat = new THREE.MeshStandardMaterial({
      color: 0x1e3355,
      roughness: 0.45,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.25,
      metalness: 0.65,
    });
    const socksWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    });
    const shoeBrownMat = new THREE.MeshStandardMaterial({
      color: 0x451e08,
      roughness: 0.25,
      metalness: 0.15,
    });

    // ==========================================
    // 1. 地面のソフトシャドウ
    // ==========================================
    const shadowGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.01, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0f1c30,
      transparent: true,
      opacity: 0.18,
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.position.set(0, -1.35, 0);
    rootGroup.add(groundShadow);

    // ==========================================
    // 2. 下半身（脚・ソックス・ローファー）
    // ==========================================
    const legsGroup = new THREE.Group();
    legsGroup.position.set(0, -0.65, 0);
    rootGroup.add(legsGroup);

    // 左脚 & 右脚
    [-0.17, 0.17].forEach((xPos) => {
      // 太もも〜すね
      const legGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.7, 16);
      const legMesh = new THREE.Mesh(legGeo, skinMat);
      legMesh.position.set(xPos, -0.15, 0);
      legsGroup.add(legMesh);

      // レース付き白クルーソックス
      const sockGeo = new THREE.CylinderGeometry(0.075, 0.07, 0.38, 16);
      const sockMesh = new THREE.Mesh(sockGeo, socksWhiteMat);
      sockMesh.position.set(xPos, -0.32, 0);
      legsGroup.add(sockMesh);

      // ソックスの折り返しフリル
      const frillGeo = new THREE.TorusGeometry(0.085, 0.018, 8, 20);
      const frillMesh = new THREE.Mesh(frillGeo, socksWhiteMat);
      frillMesh.rotation.x = Math.PI / 2;
      frillMesh.position.set(xPos, -0.13, 0);
      legsGroup.add(frillMesh);

      // ブラウンのエナメルローファー
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(xPos, -0.56, 0.04);

      // 靴底
      const soleGeo = new THREE.BoxGeometry(0.16, 0.05, 0.32);
      const soleMesh = new THREE.Mesh(soleGeo, new THREE.MeshBasicMaterial({ color: 0x1f2937 }));
      soleMesh.position.set(0, -0.05, 0);
      shoeGroup.add(soleMesh);

      // アッパー（甲）
      const upperGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const upperMesh = new THREE.Mesh(upperGeo, shoeBrownMat);
      upperMesh.scale.set(0.9, 0.75, 1.45);
      upperMesh.position.set(0, 0, 0.02);
      shoeGroup.add(upperMesh);

      // 甲のストラップ & バックル
      const strapGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.025, 16);
      const strapMesh = new THREE.Mesh(strapGeo, shoeBrownMat);
      strapMesh.rotation.z = Math.PI / 2;
      strapMesh.position.set(0, 0.05, -0.02);
      shoeGroup.add(strapMesh);

      const buckleGeo = new THREE.BoxGeometry(0.03, 0.03, 0.02);
      const buckleMesh = new THREE.Mesh(buckleGeo, goldMat);
      buckleMesh.position.set(0, 0.06, 0.05);
      shoeGroup.add(buckleMesh);

      legsGroup.add(shoeGroup);
    });

    // ==========================================
    // 3. プリーツスカート
    // ==========================================
    const skirtGroup = new THREE.Group();
    skirtGroup.position.set(0, -0.55, 0);
    rootGroup.add(skirtGroup);

    // ふんわり広がるAラインスカート本体
    const skirtGeo = new THREE.CylinderGeometry(0.38, 0.68, 0.52, 28, 1, true);
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtNavyMat);
    skirtMesh.position.set(0, 0, 0);
    skirtGroup.add(skirtMesh);

    // スカート裾のホワイトセーラーライン
    const hemLineGeo = new THREE.TorusGeometry(0.66, 0.012, 8, 32);
    const hemLineMesh = new THREE.Mesh(hemLineGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hemLineMesh.rotation.x = Math.PI / 2;
    hemLineMesh.position.set(0, -0.24, 0);
    skirtGroup.add(hemLineMesh);

    // ウエストベルト & バックル
    const beltGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.06, 24);
    const beltMesh = new THREE.Mesh(beltGeo, new THREE.MeshBasicMaterial({ color: 0x3d1a08 }));
    beltMesh.position.set(0, 0.24, 0);
    skirtGroup.add(beltMesh);

    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), goldMat);
    beltBuckle.position.set(0, 0.24, 0.39);
    skirtGroup.add(beltBuckle);

    // ==========================================
    // 4. 上半身（ブラウス・ネイビーベスト・胸元リボン）
    // ==========================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.15, 0);
    rootGroup.add(torsoGroup);

    // ベスト身頃
    const vestGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.48, 20);
    const vestMesh = new THREE.Mesh(vestGeo, uniformNavyMat);
    vestMesh.scale.set(1.05, 1, 0.85);
    vestMesh.position.set(0, 0, 0);
    torsoGroup.add(vestMesh);

    // 丸襟ブラウス（ピーターパンカラー）
    const collarLeft = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16, Math.PI), blouseWhiteMat);
    collarLeft.rotation.set(Math.PI / 3, 0, 0.3);
    collarLeft.position.set(-0.1, 0.22, 0.22);
    torsoGroup.add(collarLeft);

    const collarRight = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16, Math.PI), blouseWhiteMat);
    collarRight.rotation.set(Math.PI / 3, 0, -0.3);
    collarRight.position.set(0.1, 0.22, 0.22);
    torsoGroup.add(collarRight);

    // ベストの金ボタン2つ
    [0.08, -0.04].forEach((yPos) => {
      const buttonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), goldMat);
      buttonMesh.position.set(0, yPos, 0.34);
      torsoGroup.add(buttonMesh);
    });

    // 胸元の大きなコーラルピンクリボンタイ
    const ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(0, 0.17, 0.32);

    // 結び目
    const knotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), ribbonRedMat);
    knotMesh.scale.set(1.2, 1, 1);
    ribbonGroup.add(knotMesh);

    // 左右のふっくらウィング
    const wingGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const leftWing = new THREE.Mesh(wingGeo, ribbonRedMat);
    leftWing.scale.set(1.3, 0.85, 0.45);
    leftWing.rotation.set(0, 0, 0.25);
    leftWing.position.set(-0.12, 0, -0.02);
    ribbonGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, ribbonRedMat);
    rightWing.scale.set(1.3, 0.85, 0.45);
    rightWing.rotation.set(0, 0, -0.25);
    rightWing.position.set(0.12, 0, -0.02);
    ribbonGroup.add(rightWing);

    // 垂れリボン
    const tailGeo = new THREE.BoxGeometry(0.06, 0.16, 0.015);
    const leftTail = new THREE.Mesh(tailGeo, ribbonRedMat);
    leftTail.rotation.z = -0.2;
    leftTail.position.set(-0.06, -0.11, 0);
    ribbonGroup.add(leftTail);

    const rightTail = new THREE.Mesh(tailGeo, ribbonRedMat);
    rightTail.rotation.z = 0.2;
    rightTail.position.set(0.06, -0.11, 0);
    ribbonGroup.add(rightTail);

    torsoGroup.add(ribbonGroup);

    // ==========================================
    // 5. 腕と手（ポーズ別）
    // ==========================================
    const armsGroup = new THREE.Group();
    torsoGroup.add(armsGroup);

    if (mood === "celebrate") {
      // バンザイポーズ
      [-1, 1].forEach((side) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.36, 0.15, 0);
        arm.rotation.z = side * -2.4;
        arm.rotation.x = -0.3;

        // 袖
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.4, 16), blouseWhiteMat);
        sleeve.position.set(0, 0.18, 0);
        arm.add(sleeve);

        // 前腕＆手
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), skinMat);
        hand.position.set(0, 0.4, 0);
        arm.add(hand);

        armsGroup.add(arm);
      });
    } else if (mood === "think") {
      // 考え中ポーズ（右手があご、左手は腰）
      // 右手
      const rightArm = new THREE.Group();
      rightArm.position.set(0.36, 0.12, 0);
      rightArm.rotation.set(0.8, -0.4, -1.2);
      const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 16), blouseWhiteMat);
      sleeveR.position.set(0, -0.16, 0);
      rightArm.add(sleeveR);
      const handR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), skinMat);
      handR.position.set(0, -0.34, 0);
      rightArm.add(handR);
      armsGroup.add(rightArm);

      // 左手
      const leftArm = new THREE.Group();
      leftArm.position.set(-0.36, 0.12, 0);
      leftArm.rotation.set(0.3, 0.2, 0.8);
      const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.35, 16), blouseWhiteMat);
      sleeveL.position.set(0, -0.16, 0);
      leftArm.add(sleeveL);
      const handL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), skinMat);
      handL.position.set(0, -0.33, 0);
      leftArm.add(handL);
      armsGroup.add(leftArm);
    } else {
      // 通常ポーズ（胸の前で両手をきゅっと握る愛らしいお行儀ポーズ）
      [-1, 1].forEach((side) => {
        const arm = new THREE.Group();
        arm.position.set(side * 0.35, 0.12, 0);
        arm.rotation.set(0.65, side * 0.4, side * 0.6);

        // 白いパフスリーブ
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), blouseWhiteMat);
        puff.position.set(0, 0, 0);
        arm.add(puff);

        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.38, 16), blouseWhiteMat);
        sleeve.position.set(0, -0.18, 0);
        arm.add(sleeve);

        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), skinMat);
        hand.position.set(0, -0.36, 0);
        arm.add(hand);

        armsGroup.add(arm);
      });
    }

    // ==========================================
    // 6. 頭部グループ（顔・目・髪・ツインテール）
    // ==========================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.45, 0);
    rootGroup.add(headGroup);

    // 首
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 16), skinMat);
    neck.position.set(0, -0.22, 0);
    headGroup.add(neck);

    // 顔ベース（愛らしいアニメ輪郭フェイス）
    const faceGeo = new THREE.SphereGeometry(0.58, 32, 32);
    const faceMesh = new THREE.Mesh(faceGeo, skinMat);
    faceMesh.scale.set(1.02, 1.05, 0.94);
    faceMesh.position.set(0, 0, 0);
    headGroup.add(faceMesh);

    // ほんのり桜色チーク
    [-0.24, 0.24].forEach((xPos) => {
      const cheekGeo = new THREE.SphereGeometry(0.11, 16, 16);
      const cheek = new THREE.Mesh(cheekGeo, cheekMat);
      cheek.scale.set(1.4, 0.8, 0.2);
      cheek.position.set(xPos, -0.06, 0.52);
      headGroup.add(cheek);
    });

    // ちょこんとした鼻
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), skinMat);
    nose.position.set(0, -0.03, 0.56);
    headGroup.add(nose);

    // 笑顔のお口
    const mouthGeo = new THREE.TorusGeometry(0.065, 0.015, 8, 16, Math.PI);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.rotation.set(Math.PI, 0, 0);
    mouth.position.set(0, -0.16, 0.54);
    headGroup.add(mouth);

    // 立体アニメ瞳（エメラルドブルーの澄んだ瞳）
    const eyesGroup = new THREE.Group();
    headGroup.add(eyesGroup);

    const eyeMeshes: THREE.Group[] = [];

    [-0.2, 0.2].forEach((xPos) => {
      const singleEye = new THREE.Group();
      singleEye.position.set(xPos, 0.05, 0.48);

      // 白目
      const whiteGeo = new THREE.SphereGeometry(0.14, 20, 20);
      const whiteMesh = new THREE.Mesh(whiteGeo, eyeWhiteMat);
      whiteMesh.scale.set(0.9, 1.15, 0.35);
      singleEye.add(whiteMesh);

      // 虹彩（エメラルドブルー）
      const irisGeo = new THREE.SphereGeometry(0.115, 18, 18);
      const irisMesh = new THREE.Mesh(irisGeo, eyeIrisMat);
      irisMesh.scale.set(0.85, 1.05, 0.38);
      irisMesh.position.set(0, -0.01, 0.02);
      singleEye.add(irisMesh);

      // 瞳孔
      const pupilGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const pupilMesh = new THREE.Mesh(pupilGeo, eyePupilMat);
      pupilMesh.scale.set(0.85, 1, 0.4);
      pupilMesh.position.set(0, 0, 0.04);
      singleEye.add(pupilMesh);

      // キラキラ主光ハイライト（白）
      const spark1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), eyeSparkleMat);
      spark1.position.set(-0.03, 0.05, 0.08);
      singleEye.add(spark1);

      // 星屑サブハイライト
      const spark2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), eyeSparkleMat);
      spark2.position.set(0.04, -0.04, 0.08);
      singleEye.add(spark2);

      // 上アイライン（まつ毛）
      const lashGeo = new THREE.TorusGeometry(0.13, 0.022, 8, 16, Math.PI * 0.7);
      const lashMesh = new THREE.Mesh(lashGeo, eyeLineMat);
      lashMesh.rotation.set(0, 0, xPos < 0 ? 0.3 : -0.3);
      lashMesh.position.set(0, 0.1, 0.07);
      singleEye.add(lashMesh);

      eyesGroup.add(singleEye);
      eyeMeshes.push(singleEye);
    });

    // 眉毛
    [-0.2, 0.2].forEach((xPos) => {
      const browGeo = new THREE.TorusGeometry(0.12, 0.016, 6, 16, Math.PI * 0.5);
      const brow = new THREE.Mesh(browGeo, new THREE.MeshBasicMaterial({ color: 0x542810 }));
      brow.rotation.set(0, 0, xPos < 0 ? 0.25 : -0.25);
      brow.position.set(xPos, 0.23, 0.48);
      headGroup.add(brow);
    });

    // ==========================================
    // 7. 髪型（後頭部・前髪・アホ毛・ツインテール）
    // ==========================================
    // 後頭部
    const backHairGeo = new THREE.SphereGeometry(0.63, 24, 24);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.scale.set(1.05, 1.05, 1.05);
    backHair.position.set(0, 0.04, -0.06);
    headGroup.add(backHair);

    // 天使の輪（ハイライトリング）
    const haloGeo = new THREE.TorusGeometry(0.56, 0.028, 8, 32);
    const haloMesh = new THREE.Mesh(haloGeo, hairHighlightMat);
    haloMesh.rotation.x = Math.PI / 2.2;
    haloMesh.position.set(0, 0.34, 0.08);
    headGroup.add(haloMesh);

    // 前髪（M字バング・毛束）
    const bangsGroup = new THREE.Group();
    headGroup.add(bangsGroup);

    [-0.26, -0.12, 0, 0.12, 0.26].forEach((xPos, idx) => {
      const bangGeo = new THREE.ConeGeometry(0.11, 0.36, 12);
      const bangMesh = new THREE.Mesh(bangGeo, hairMat);
      bangMesh.rotation.set(-0.35, 0, (idx - 2) * 0.15);
      bangMesh.position.set(xPos, 0.28, 0.46);
      bangsGroup.add(bangMesh);
    });

    // サイド姫毛
    [-0.48, 0.48].forEach((xPos, i) => {
      const sideLockGeo = new THREE.ConeGeometry(0.09, 0.52, 12);
      const sideLock = new THREE.Mesh(sideLockGeo, hairMat);
      sideLock.rotation.set(0.1, 0, i === 0 ? 0.3 : -0.3);
      sideLock.position.set(xPos, -0.05, 0.3);
      headGroup.add(sideLock);
    });

    // 頭頂のアホ毛
    const ahogeGeo = new THREE.TorusGeometry(0.18, 0.024, 8, 16, Math.PI * 0.7);
    const ahoge = new THREE.Mesh(ahogeGeo, hairMat);
    ahoge.rotation.set(0.2, 0.3, 0.6);
    ahoge.position.set(0.06, 0.65, 0.08);
    headGroup.add(ahoge);

    // ミントグリーンのヘアピン
    const pinGeo = new THREE.BoxGeometry(0.14, 0.035, 0.02);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.3 });
    const hairpin = new THREE.Mesh(pinGeo, pinMat);
    hairpin.rotation.set(0, 0, -0.4);
    hairpin.position.set(-0.32, 0.36, 0.49);
    headGroup.add(hairpin);

    // 左右のふんわり揺れるツインテール
    const leftTailGroup = new THREE.Group();
    leftTailGroup.position.set(-0.52, 0.28, -0.05);
    headGroup.add(leftTailGroup);

    const rightTailGroup = new THREE.Group();
    rightTailGroup.position.set(0.52, 0.28, -0.05);
    headGroup.add(rightTailGroup);

    [leftTailGroup, rightTailGroup].forEach((tailGroup, idx) => {
      const dir = idx === 0 ? -1 : 1;

      // ピンクリボン留め具
      const tieGeo = new THREE.TorusGeometry(0.09, 0.03, 8, 16);
      const tieMesh = new THREE.Mesh(tieGeo, ribbonRedMat);
      tailGroup.add(tieMesh);

      // ふんわりカールした毛束（複数のカーブメッシュで立体感）
      const strand1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.75, 16), hairMat);
      strand1.rotation.set(0.15, 0, dir * 0.45);
      strand1.position.set(dir * 0.18, -0.32, 0);
      tailGroup.add(strand1);

      const strand2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 16), hairMat);
      strand2.rotation.set(-0.2, 0, dir * 0.7);
      strand2.position.set(dir * 0.28, -0.25, -0.08);
      tailGroup.add(strand2);
    });

    // ==========================================
    // 8. 着せ替えアクセサリー（3D）
    // ==========================================
    if (currentAccessories.hat === "hat_beret") {
      const beretGeo = new THREE.SphereGeometry(0.58, 20, 20);
      const beretMesh = new THREE.Mesh(beretGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
      beretMesh.scale.set(1.15, 0.4, 1.15);
      beretMesh.rotation.set(-0.2, 0, 0.3);
      beretMesh.position.set(0.15, 0.6, 0);
      headGroup.add(beretMesh);
    } else if (currentAccessories.hat === "hat_crown") {
      const crownGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.2, 16);
      const crownMesh = new THREE.Mesh(crownGeo, goldMat);
      crownMesh.position.set(0, 0.68, 0.05);
      headGroup.add(crownMesh);
    }

    if (currentAccessories.glasses === "glasses_round") {
      const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });
      [-0.2, 0.2].forEach((xPos) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 24), glassFrameMat);
        rim.position.set(xPos, 0.05, 0.58);
        headGroup.add(rim);
      });
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8), glassFrameMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.05, 0.58);
      headGroup.add(bridge);
    }

    // ==========================================
    // 9. マウスインタラクション & アニメーションループ
    // ==========================================
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current.x = Math.max(-1, Math.min(1, x));
      mousePos.current.y = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handlePointerMove);

    let animationId: number;
    let lastTime = performance.now();
    const startTime = lastTime;
    let blinkTimer = 0;
    let isBlinking = false;
    let blinkDuration = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) * 0.001, 0.1);
      lastTime = now;
      const time = (now - startTime) * 0.001;

      // スプリングジャンプの減衰
      bounceSpring.current.velocity += (0 - bounceSpring.current.y) * 18 * delta;
      bounceSpring.current.velocity *= 0.88;
      bounceSpring.current.y += bounceSpring.current.velocity;

      // 呼吸（Idle Breath）
      const breath = Math.sin(time * 2.8) * 0.025;
      rootGroup.position.y = -0.1 + breath + bounceSpring.current.y;

      // マウス追従の滑らかな補間（Lerp）
      targetLook.current.x += (mousePos.current.x * 0.35 - targetLook.current.x) * 0.1;
      targetLook.current.y += (mousePos.current.y * 0.25 - targetLook.current.y) * 0.1;

      headGroup.rotation.y = targetLook.current.x;
      headGroup.rotation.x = -targetLook.current.y;

      // ツインテールの遅延ふんわり揺れ物理
      const tailSway = Math.sin(time * 3.2) * 0.08 - targetLook.current.x * 0.35;
      leftTailGroup.rotation.z = tailSway;
      rightTailGroup.rotation.z = -tailSway;

      // 自然なまばたきアニメーション
      blinkTimer += delta;
      if (!isBlinking && blinkTimer > 2.8 + Math.random() * 2.5) {
        isBlinking = true;
        blinkDuration = 0;
        blinkTimer = 0;
      }

      if (isBlinking) {
        blinkDuration += delta;
        const blinkScale = blinkDuration < 0.08 ? 0.08 : 1;
        eyeMeshes.forEach((eye) => {
          eye.scale.y = blinkScale;
        });
        if (blinkDuration > 0.15) {
          isBlinking = false;
          eyeMeshes.forEach((eye) => {
            eye.scale.y = 1;
          });
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 200;
      const h = container.clientHeight || 250;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mood, currentLevel, currentAccessories]);

  const handleContainerClick = () => {
    bounceSpring.current.velocity = 0.22;
    if (onClick) onClick();
  };

  if (!hasWebGL) {
    return null;
  }

  return (
    <div
      ref={mountRef}
      onClick={handleContainerClick}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        cursor: "pointer",
        userSelect: "none",
      }}
      title="クリックしてみてね！"
    />
  );
}
