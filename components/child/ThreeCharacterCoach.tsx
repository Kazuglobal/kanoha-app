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

const CHARACTER_IMAGE_PATHS: Record<string, string> = {
  happy: "/images/character/kanoha_happy.jpg",
  think: "/images/character/kanoha_think.jpg",
  celebrate: "/images/character/kanoha_celebrate.jpg",
};

/**
 * ThreeCharacterCoach
 * 人間らしい愛らしさを100%宿したアニメ女の子キャラクター「かのはちゃん」。
 * 不気味な幾何学球体の像ではなく、京都アニメ調の完璧な人間美少女アートワークを
 * Three.js (WebGL) の 3D 空間で、多層曲面パララックス・3Dマウス視線追従・
 * 動的ライティング・3Dアイドル呼吸・立体星屑パーティクル・スプリングジャンプによって
 * 生き生きとした立体アニメキャラクターとして完全再現。
 */
export function ThreeCharacterCoach({
  mood = "happy",
  level: propsLevel,
  accessories: propsAccessories,
  onClick,
}: ThreeCharacterCoachProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  // マウス座標
  const mousePos = useRef({ x: 0, y: 0 });
  const targetRotation = useRef({ y: 0, x: 0, z: 0 });
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
        bounceSpring.current.velocity = 0.16;
      }
    };

    const handleGrowthChange = () => {
      if (propsLevel === undefined) {
        setCurrentLevel(getCharacterProgress().currentLevel.level);
        bounceSpring.current.velocity = 0.22;
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

    // 1. Scene & 3D Perspective Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.05, 4.8);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 3. 3D Lighting (マウス位置に連動して走る光)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const mouseLight = new THREE.PointLight(0xfff3e8, 1.6, 9);
    mouseLight.position.set(0, 1.2, 3.2);
    scene.add(mouseLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
    rimLight.position.set(-2.5, 2, -1);
    scene.add(rimLight);

    // 4. 3D Character Group
    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    // 5. 3D 地面ソフトシャドウ（楕円メッシュ）
    const shadowGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.01, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0f1c30,
      transparent: true,
      opacity: 0.18,
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.position.set(0, -1.65, 0);
    scene.add(groundShadow);

    // 6. 3D キラキラ星屑パーティクル（立体的周回アニメーション）
    const particleCount = 20;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds: { radius: number; angle: number; y: number; speed: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.85 + Math.random() * 0.9;
      const angle = Math.random() * Math.PI * 2;
      const y = -1.2 + Math.random() * 2.4;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
      particleSpeeds.push({ radius, angle, y, speed: 0.8 + Math.random() * 1.2 });
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const starCanvas = document.createElement("canvas");
    starCanvas.width = 64;
    starCanvas.height = 64;
    const sCtx = starCanvas.getContext("2d")!;
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.35, "rgba(254, 240, 138, 0.9)");
    grad.addColorStop(1, "rgba(254, 240, 138, 0)");
    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.arc(32, 32, 30, 0, Math.PI * 2);
    sCtx.fill();

    const starTexture = new THREE.CanvasTexture(starCanvas);
    const particleMat = new THREE.PointsMaterial({
      size: 0.24,
      map: starTexture,
      transparent: true,
      opacity: mood === "celebrate" ? 0.95 : mood === "think" ? 0.55 : 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. 人間らしいアニメ美少女の 3D 曲面マルチレイヤーメッシュ生成
    let isDisposed = false;
    const imgPath = CHARACTER_IMAGE_PATHS[mood] || CHARACTER_IMAGE_PATHS.happy;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgPath;
    img.onload = () => {
      if (isDisposed) return;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // 白背景の完全透過処理
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 240) {
          const factor = Math.max(0, (255 - brightness) / 15);
          data[i + 3] = Math.round(data[i + 3] * factor);
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      // 立体的な曲面ジオメトリ（シリンダーベンド）
      const planeWidth = 2.45;
      const planeHeight = 3.3;
      const curveGeo = new THREE.CylinderGeometry(
        4.2,
        4.2,
        planeHeight,
        36,
        1,
        true,
        -planeWidth / (2 * 4.2),
        planeWidth / 4.2
      );

      const uvs = curveGeo.attributes.uv;
      for (let i = 0; i < uvs.count; i++) {
        const u = 1 - uvs.getX(i);
        uvs.setX(i, u);
      }

      // メインキャラクターメッシュ（3Dライティングに反応する Toon/Standard マテリアル）
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.32,
        metalness: 0.04,
        side: THREE.FrontSide,
        depthWrite: false,
      });

      const characterMesh = new THREE.Mesh(curveGeo, mat);
      characterMesh.position.set(0, 0.05, 0);
      characterRoot.add(characterMesh);

      // 立体感を際立たせる前面ハイライトレイヤー（胸元と顔周りのパースペクティブ視差）
      const frontAccentMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const frontAccentMesh = new THREE.Mesh(curveGeo, frontAccentMat);
      frontAccentMesh.scale.set(1.02, 1.02, 1.02);
      frontAccentMesh.position.set(0, 0.05, 0.04);
      characterRoot.add(frontAccentMesh);
    };

    // 8. マウス追従
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current.x = Math.max(-1, Math.min(1, x));
      mousePos.current.y = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handlePointerMove);

    // 9. アニメーションループ（Three.js WebGL レンダリング）
    let animationId: number;
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;
      const time = (currentTime - startTime) / 1000;

      // スプリングジャンプ減衰
      bounceSpring.current.velocity += (0 - bounceSpring.current.y) * 20 * delta;
      bounceSpring.current.velocity *= 0.86;
      bounceSpring.current.y += bounceSpring.current.velocity;

      // 3D アイドル呼吸アニメーション
      const breath = Math.sin(time * 2.6) * 0.035;
      characterRoot.position.y = breath + bounceSpring.current.y;

      // 立体マウス視線追従の滑らかな補間（Lerp）
      targetRotation.current.y += (mousePos.current.x * 0.38 - targetRotation.current.y) * 0.08;
      targetRotation.current.x += (-mousePos.current.y * 0.24 - targetRotation.current.x) * 0.08;
      targetRotation.current.z = -targetRotation.current.y * 0.12;

      characterRoot.rotation.y = targetRotation.current.y;
      characterRoot.rotation.x = targetRotation.current.x;
      characterRoot.rotation.z = targetRotation.current.z;

      // マウス位置に連動して動く 3D 光源
      mouseLight.position.x = mousePos.current.x * 2.6;
      mouseLight.position.y = 1.2 + mousePos.current.y * 2.0;

      // 3D 地面シャドウのリアルタイム追従
      const shadowScale = 1 - bounceSpring.current.y * 0.8;
      groundShadow.scale.set(shadowScale, shadowScale, shadowScale);
      groundShadow.position.x = targetRotation.current.y * 0.28;

      // 3D 星屑パーティクルの螺旋周回
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const p = particleSpeeds[i];
        p.angle += p.speed * delta * (mood === "celebrate" ? 2.4 : 1.0);
        positions[i * 3] = Math.cos(p.angle) * p.radius;
        positions[i * 3 + 2] = Math.sin(p.angle) * p.radius;
      }
      particleGeo.attributes.position.needsUpdate = true;
      particleSystem.rotation.y += delta * 0.18;

      renderer.render(scene, camera);
    };

    animate(performance.now());

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
      isDisposed = true;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      particleGeo.dispose();
      particleMat.dispose();
      starTexture.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mood, currentLevel, currentAccessories]);

  const handleContainerClick = () => {
    bounceSpring.current.velocity = 0.24;
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
