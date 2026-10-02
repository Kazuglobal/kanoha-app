"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface ThreeCharacterCoachProps {
  mood?: "happy" | "think" | "celebrate";
  onClick?: () => void;
}

export function ThreeCharacterCoach({
  mood = "happy",
  onClick,
}: ThreeCharacterCoachProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  // マウス追従用ターゲット
  const mousePos = useRef({ x: 0, y: 0 });
  // タップ・クリック時のバウンス用
  const bounceSpring = useRef({ scaleY: 1, scaleXZ: 1, velocity: 0 });

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

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
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

    // Sprout Group (頭の若葉の新芽)
    const sproutGroup = new THREE.Group();
    sproutGroup.position.set(0, 1.0, 0);

    const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.35, 16);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.3 });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0, 0.17, 0);
    sproutGroup.add(stemMesh);

    const leafGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.25 });

    const leafLeft = new THREE.Mesh(leafGeo, leafMat);
    leafLeft.scale.set(0.4, 1.0, 0.15);
    leafLeft.rotation.z = Math.PI / 3.5;
    leafLeft.position.set(-0.16, 0.32, 0);
    sproutGroup.add(leafLeft);

    const leafRight = new THREE.Mesh(leafGeo, leafMat);
    leafRight.scale.set(0.4, 1.0, 0.15);
    leafRight.rotation.z = -Math.PI / 3.5;
    leafRight.position.set(0.16, 0.32, 0);
    sproutGroup.add(leafRight);

    characterGroup.add(sproutGroup);

    // Eyes
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

    // Little Hands
    const handGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const handMat = new THREE.MeshStandardMaterial({
      color: bodyColors[mood],
      roughness: 0.3,
    });

    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(-1.05, -0.25, 0.3);
    characterGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, handMat);
    rightHand.position.set(1.05, -0.25, 0.3);
    characterGroup.add(rightHand);

    // 5. Mouse tracking handler
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

    // 6. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let celebrateAngle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

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
        1.05 * breathScale * spring.scaleXZ,
      );

      // Sprout gentle swaying
      sproutGroup.rotation.z = Math.sin(elapsed * 3.5) * 0.15;

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
        celebrateAngle += 0.05;
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

    // 7. Click bounce trigger
    const handleContainerClick = () => {
      bounceSpring.current.velocity = -0.32; // squash
      onClick?.();
    };

    container.addEventListener("click", handleContainerClick);

    // 8. Cleanup
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
  }, [mood, onClick]);

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
