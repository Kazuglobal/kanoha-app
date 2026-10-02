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
 * WebGL (Three.js) を使った人間らしい美しいアニメ女の子キャラクター「かのはちゃん」。
 * 不気味な幾何学像ではなく、京都アニメ調の愛らしいアニメヒロインを
 * リアルタイム 3D 空間でマウス追従、パースペクティブ立体回転、動的ライティング、
 * アイドル呼吸、3Dパーティクル、スプリングジャンプで生き生きと描画。
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
  const targetRotation = useRef({ x: 0, y: 0, z: 0 });
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
        bounceSpring.current.velocity = 0.14;
      }
    };

    const handleGrowthChange = () => {
      if (propsLevel === undefined) {
        setCurrentLevel(getCharacterProgress().currentLevel.level);
        bounceSpring.current.velocity = 0.2;
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

    // 1. Scene & 3D Camera (パースペクティブ立体透視)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 0.05, 4.6);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 3. Dynamic Lighting (マウスに反応して走るハイライト)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mouseLight = new THREE.PointLight(0xfff1e6, 1.5, 8);
    mouseLight.position.set(0, 1, 3);
    scene.add(mouseLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
    rimLight.position.set(-2, 2, -1);
    scene.add(rimLight);

    // 4. Character 3D Root
    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    // 5. 3D 地面ソフトシャドウ
    const shadowGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.01, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0f1c30,
      transparent: true,
      opacity: 0.18,
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.position.set(0, -1.6, 0);
    scene.add(groundShadow);

    // 6. 3D キラキラ星屑パーティクル（celebrate / think 時に周囲を立体周回）
    const particleCount = 20;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds: { radius: number; angle: number; y: number; speed: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.8 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI * 2;
      const y = -1.2 + Math.random() * 2.4;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
      particleSpeeds.push({ radius, angle, y, speed: 0.8 + Math.random() * 1.2 });
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    // 星屑テクスチャ生成
    const starCanvas = document.createElement("canvas");
    starCanvas.width = 64;
    starCanvas.height = 64;
    const sCtx = starCanvas.getContext("2d")!;
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.3, "rgba(254, 240, 138, 0.9)");
    grad.addColorStop(1, "rgba(254, 240, 138, 0)");
    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.arc(32, 32, 30, 0, Math.PI * 2);
    sCtx.fill();

    const starTexture = new THREE.CanvasTexture(starCanvas);
    const particleMat = new THREE.PointsMaterial({
      size: 0.22,
      map: starTexture,
      transparent: true,
      opacity: mood === "celebrate" ? 0.9 : mood === "think" ? 0.5 : 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 7. 立体アニメキャラクターメッシュの生成（透明背景化した高解像度アニメテクスチャ）
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

      // 白背景の完全透過アルゴリズム（エッジを滑らかに抜く）
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 242) {
          const factor = Math.max(0, (255 - brightness) / 13);
          data[i + 3] = Math.round(data[i + 3] * factor);
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      // わずかに円弧状に丸みを帯びた立体シリンダーカーブジオメトリ
      const planeWidth = 2.4;
      const planeHeight = 3.2;
      const curveGeo = new THREE.CylinderGeometry(
        4.0,
        4.0,
        planeHeight,
        32,
        1,
        true,
        -planeWidth / (2 * 4.0),
        planeWidth / 4.0
      );

      // UVマッピング補正
      const uvs = curveGeo.attributes.uv;
      for (let i = 0; i < uvs.count; i++) {
        const u = 1 - uvs.getX(i);
        uvs.setX(i, u);
      }

      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.35,
        metalness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const characterMesh = new THREE.Mesh(curveGeo, mat);
      characterMesh.position.set(0, 0.05, 0);
      characterRoot.add(characterMesh);
    };

    // 8. マウス追従イベントリスナー
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current.x = Math.max(-1, Math.min(1, x));
      mousePos.current.y = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handlePointerMove);

    // 9. アニメーションループ
    let animationId: number;
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;
      const time = (currentTime - startTime) / 1000;

      // スプリングジャンプ減衰
      bounceSpring.current.velocity += (0 - bounceSpring.current.y) * 22 * delta;
      bounceSpring.current.velocity *= 0.86;
      bounceSpring.current.y += bounceSpring.current.velocity;

      // 自然な呼吸アニメーション（Idle Breath）
      const breath = Math.sin(time * 2.6) * 0.035;
      characterRoot.position.y = breath + bounceSpring.current.y;

      // 立体視線追従の滑らかな補間（Lerp）
      targetRotation.current.y += (mousePos.current.x * 0.4 - targetRotation.current.y) * 0.08;
      targetRotation.current.x += (-mousePos.current.y * 0.25 - targetRotation.current.x) * 0.08;
      targetRotation.current.z = -targetRotation.current.y * 0.15;

      characterRoot.rotation.y = targetRotation.current.y;
      characterRoot.rotation.x = targetRotation.current.x;
      characterRoot.rotation.z = targetRotation.current.z;

      // マウス位置に連動したライトの移動（表面にリアルタイムに走る光）
      mouseLight.position.x = mousePos.current.x * 2.5;
      mouseLight.position.y = 1 + mousePos.current.y * 2.0;

      // 3D 地面シャドウのリアルタイム追従
      const shadowScale = 1 - bounceSpring.current.y * 0.8;
      groundShadow.scale.set(shadowScale, shadowScale, shadowScale);
      groundShadow.position.x = targetRotation.current.y * 0.3;

      // 3D 星屑パーティクルの周回アニメーション
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const p = particleSpeeds[i];
        p.angle += p.speed * delta * (mood === "celebrate" ? 2.5 : 1.0);
        positions[i * 3] = Math.cos(p.angle) * p.radius;
        positions[i * 3 + 2] = Math.sin(p.angle) * p.radius;
      }
      particleGeo.attributes.position.needsUpdate = true;
      particleSystem.rotation.y += delta * 0.2;

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
      renderer.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      starTexture.dispose();
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
