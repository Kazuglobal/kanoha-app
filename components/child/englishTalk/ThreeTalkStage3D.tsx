"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TalkCharacter, type TalkMood } from "./TalkCharacter";
import styles from "./englishTalk.module.css";

export interface ThreeTalkStage3DProps {
  sceneId: string;
  turnId?: string;
  turnIndex: number;
  totalTurns: number;
  started: boolean;
  mood: TalkMood;
  isListening?: boolean;
  visual?: string;
  onCharacterTap?: () => void;
}

interface SceneTheme {
  skyTop: string;
  skyMiddle: string;
  skyBottom: string;
  groundColor: number;
  grassAccent: number;
  pathColor: number;
  petalColor: number;
  friendSprite: string;
  friendName: string;
}

const SCENE_THEMES: Record<string, SceneTheme> = {
  greeting: {
    skyTop: "#8fd3ff",
    skyMiddle: "#d4f0ff",
    skyBottom: "#fff6fa",
    groundColor: 0x9ae68c,
    grassAccent: 0x7ed970,
    pathColor: 0xf7e4c4,
    petalColor: 0xffb7d5,
    friendSprite: "/images/character/chars/fuwari-base.png",
    friendName: "ふわりちゃん",
  },
  shop: {
    skyTop: "#ffd6a5",
    skyMiddle: "#fff0d6",
    skyBottom: "#fffaf0",
    groundColor: 0xa3e48c,
    grassAccent: 0x87d46e,
    pathColor: 0xf3dcc0,
    petalColor: 0xffcf96,
    friendSprite: "/images/character/chars/hinata-base.png",
    friendName: "ひなたちゃん",
  },
  park: {
    skyTop: "#7cc6fe",
    skyMiddle: "#c8ebff",
    skyBottom: "#f0faff",
    groundColor: 0x8ce28a,
    grassAccent: 0x6ecf6c,
    pathColor: 0xf5e2c0,
    petalColor: 0xfff3b0,
    friendSprite: "/images/character/chars/riku-base.png",
    friendName: "リクくん",
  },
  school: {
    skyTop: "#fcecc9",
    skyMiddle: "#fff7e6",
    skyBottom: "#fffdf9",
    groundColor: 0xe3b788,
    grassAccent: 0xd4a373,
    pathColor: 0xedd0b0,
    petalColor: 0xffdf80,
    friendSprite: "/images/character/chars/mia-base.png",
    friendName: "ミアちゃん",
  },
  zoo: {
    skyTop: "#88e0c0",
    skyMiddle: "#d6f8ec",
    skyBottom: "#f7fff9",
    groundColor: 0x98de80,
    grassAccent: 0x7bc963,
    pathColor: 0xf2dbb6,
    petalColor: 0xb8f2e6,
    friendSprite: "/images/character/chars/fuwari-safari.png",
    friendName: "ふわりちゃん",
  },
};

const CAMERA_TURN_OFFSETS: readonly { x: number; y: number; z: number; lookX: number; lookY: number }[] = [
  { x: 0.05, y: 1.38, z: 3.65, lookX: 0.22, lookY: 1.08 },
  { x: -0.08, y: 1.36, z: 3.55, lookX: 0.26, lookY: 1.06 },
  { x: 0.12, y: 1.38, z: 3.58, lookX: 0.18, lookY: 1.08 },
  { x: 0.04, y: 1.4, z: 3.68, lookX: 0.22, lookY: 1.1 },
];

function createSkyTexture(theme: SceneTheme): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(0.55, theme.skyMiddle);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Soft sun glow
    const sunGrad = ctx.createRadialGradient(390, 110, 10, 390, 110, 140);
    sunGrad.addColorStop(0, "rgba(255, 250, 210, 0.95)");
    sunGrad.addColorStop(0.4, "rgba(255, 240, 180, 0.45)");
    sunGrad.addColorStop(1, "rgba(255, 240, 180, 0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, 512, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStarShape(innerRadius = 0.04, outerRadius = 0.09, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, "rgba(65, 45, 90, 0.34)");
    grad.addColorStop(0.6, "rgba(65, 45, 90, 0.14)");
    grad.addColorStop(1, "rgba(65, 45, 90, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * 吹き出しや後ろのキャラクターと被らない、繊細な3Dきらきらスター装飾のみを配置する
 * (注目アイテムの絵文字は右下パネルの .visual に表示されるため、中央に巨大な白丸バッジを重ねない)
 */
function createKawaiiPropMesh(turnId?: string, visual?: string): THREE.Group {
  const group = new THREE.Group();
  if (!turnId && !visual) return group;

  const starGeo = new THREE.ShapeGeometry(createStarShape(0.022, 0.05, 5));
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i += 1) {
    const s = new THREE.Mesh(starGeo, starMat);
    const angle = (i / 4) * Math.PI * 2;
    s.position.set(-0.32 + Math.cos(angle) * 0.62, 1.05 + Math.sin(angle) * 0.45, 0.45);
    group.add(s);
  }

  return group;
}

function createPastelTree(x: number, z: number, scale = 1, sakura = false): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 1.15, 12),
    new THREE.MeshLambertMaterial({ color: 0xa47148 }),
  );
  trunk.position.y = 0.56;
  tree.add(trunk);

  const mainColor = sakura ? 0xffc2dc : 0x80ed99;
  const subColor = sakura ? 0xffd6e8 : 0xa3f7b5;
  const accentColor = sakura ? 0xff9ebb : 0x57cc99;

  const puffs: readonly [number, number, number, number, number][] = [
    [0, 1.48, 0, 0.62, mainColor],
    [-0.36, 1.32, 0.18, 0.46, subColor],
    [0.38, 1.34, 0.15, 0.45, subColor],
    [0, 1.78, -0.08, 0.44, accentColor],
  ];

  for (const [px, py, pz, pr, col] of puffs) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(pr, 20, 18),
      new THREE.MeshLambertMaterial({ color: col }),
    );
    puff.position.set(px, py, pz);
    tree.add(puff);
  }

  return tree;
}

function createPastelCloud(x: number, y: number, z: number, scale = 1): THREE.Group {
  const cloud = new THREE.Group();
  cloud.position.set(x, y, z);
  cloud.scale.setScalar(scale);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (const [cx, cy, r] of [
    [0, 0, 0.42],
    [-0.36, -0.06, 0.3],
    [0.36, -0.05, 0.32],
    [0.14, 0.14, 0.28],
  ] as const) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), mat);
    puff.scale.set(1.25, 0.82, 0.7);
    puff.position.set(cx, cy, 0);
    cloud.add(puff);
  }
  return cloud;
}

function buildPastelEnvironment(scene: THREE.Scene, sceneId: string, theme: SceneTheme): THREE.Group {
  const envGroup = new THREE.Group();

  // Warm soft lighting
  const ambient = new THREE.AmbientLight(0xfff8fc, 1.25);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xfffdf5, 0.85);
  dirLight.position.set(3, 7, 5);
  scene.add(dirLight);

  // Pastel Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshLambertMaterial({ color: theme.groundColor }),
  );
  ground.rotation.x = -Math.PI / 2;
  envGroup.add(ground);

  // Soft rolling background hills
  for (const [hx, hz, hr, sy] of [
    [-3.2, -4.8, 2.8, 0.45],
    [2.8, -5.2, 3.2, 0.42],
    [0.2, -5.8, 3.6, 0.38],
  ] as const) {
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(hr, 24, 18),
      new THREE.MeshLambertMaterial({ color: theme.grassAccent }),
    );
    hill.scale.set(1.3, sy, 0.7);
    hill.position.set(hx, -0.2, hz);
    envGroup.add(hill);
  }

  // Rounded stepping-stone pathway leading from camera to the character
  const pathBase = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 9.5),
    new THREE.MeshLambertMaterial({ color: theme.pathColor }),
  );
  pathBase.rotation.x = -Math.PI / 2;
  pathBase.position.set(0, 0.01, 2.2);
  envGroup.add(pathBase);

  for (let i = 0; i < 7; i += 1) {
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.03, 16),
      new THREE.MeshLambertMaterial({ color: 0xfff8eb }),
    );
    stone.scale.set(1.2, 1, 0.78);
    stone.position.set((i % 2 === 0 ? -1 : 1) * 0.14, 0.022, 0.6 + i * 0.72);
    envGroup.add(stone);
  }

  //Cute pastel flowers along the path
  for (const [fx, fz, fcol] of [
    [-1.15, 1.2, 0xff8fab],
    [-1.35, 2.1, 0xffd166],
    [1.2, 1.4, 0xff8fab],
    [1.4, 2.3, 0xa8dadc],
    [-1.6, 0.2, 0xffb3c6],
    [1.65, 0.3, 0xffd166],
  ] as const) {
    const flower = new THREE.Group();
    flower.position.set(fx, 0.05, fz);
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 8),
        new THREE.MeshBasicMaterial({ color: fcol }),
      );
      petal.position.set(Math.cos(a) * 0.06, 0.02, Math.sin(a) * 0.06);
      flower.add(petal);
    }
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    );
    center.position.y = 0.04;
    flower.add(center);
    envGroup.add(flower);
  }

  // Fluffy 3D clouds
  envGroup.add(createPastelCloud(-2.6, 3.6, -4.5, 0.95));
  envGroup.add(createPastelCloud(2.5, 3.8, -4.8, 1.05));

  // Scene-specific delicate 3D structures
  if (sceneId === "greeting") {
    envGroup.add(createPastelTree(-2.3, -1.5, 1.15, true));
    envGroup.add(createPastelTree(2.4, -1.6, 1.1, true));
    envGroup.add(createPastelTree(-3.2, 0.8, 0.95, false));
    envGroup.add(createPastelTree(3.1, 0.9, 0.95, false));
  } else if (sceneId === "shop") {
    // Cute pastel fruit stall
    const stall = new THREE.Group();
    stall.position.set(0.35, 0, -0.65);
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.72, 0.65),
      new THREE.MeshLambertMaterial({ color: 0xf4a261 }),
    );
    counter.position.y = 0.36;
    stall.add(counter);

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(2.74, 0.08, 0.76),
      new THREE.MeshLambertMaterial({ color: 0xfff3e0 }),
    );
    top.position.y = 0.74;
    stall.add(top);

    for (let i = -2; i <= 2; i += 1) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.1, 1.1),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff758f : 0xffffff }),
      );
      roof.position.set(i * 0.54, 2.25, 0.05);
      roof.rotation.x = 0.22;
      stall.add(roof);
    }
    envGroup.add(stall);
    envGroup.add(createPastelTree(-2.7, -1.6, 1.0, false));
    envGroup.add(createPastelTree(2.8, -1.6, 1.0, false));
  } else if (sceneId === "park") {
    envGroup.add(createPastelTree(-2.4, -1.5, 1.15, false));
    envGroup.add(createPastelTree(2.5, -1.4, 1.1, false));
    // White pastel fence
    for (let i = -4; i <= 4; i += 1) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.6, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      post.position.set(i * 0.65, 0.3, -2.1);
      envGroup.add(post);
    }
  } else if (sceneId === "school") {
    // Classroom chalkboard in background
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.55, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xd4a373 }),
    );
    frame.position.set(0.2, 1.75, -1.85);
    envGroup.add(frame);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.18, 1.35, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x3b7a57 }),
    );
    board.position.set(0.2, 1.75, -1.83);
    envGroup.add(board);
  } else if (sceneId === "zoo") {
    envGroup.add(createPastelTree(-2.6, -1.6, 1.15, false));
    envGroup.add(createPastelTree(2.6, -1.6, 1.15, false));
    for (let i = -4; i <= 4; i += 1) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.65, 10),
        new THREE.MeshLambertMaterial({ color: 0xb07d4f }),
      );
      post.position.set(i * 0.68, 0.32, -1.6);
      envGroup.add(post);
    }
  }

  scene.add(envGroup);
  return envGroup;
}

/**
 * 3D空間内で微細に呼吸・揺れ動く高精細キャラクターメッシュを作る
 */
function create3DSpriteCharacter(spriteUrl: string, shadowTex: THREE.Texture): {
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  basePositions: Float32Array;
  glowRing: THREE.Mesh;
  starsGroup: THREE.Group;
} {
  const group = new THREE.Group();
  // 左のかのはちゃんと右の吹き出しのあいだ（中央やや左のオープンな位置）に立たせて、吹き出しと絶対に被らないようにする
  group.position.set(-0.32, 0, 0.12);

  // Soft contact shadow under shoes
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // 頭頂部が上端で切れず全身がきれいに収まるサイズに調整
  const geometry = new THREE.PlaneGeometry(1.48, 2.04, 20, 28);
  geometry.translate(0, 1.02, 0);
  const basePositions = new Float32Array(geometry.attributes.position.array);

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
  });

  const loader = new THREE.TextureLoader();
  loader.load(
    spriteUrl,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      material.map = tex;
      material.needsUpdate = true;
    },
    undefined,
    () => {
      // Ignore texture load error in headless environments
    },
  );

  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Listening ring around feet
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.64, 36),
    new THREE.MeshBasicMaterial({
      color: 0x38b2ac,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.025;
  glowRing.visible = false;
  group.add(glowRing);

  // 3D 5-pointed pastel stars for celebration
  const starsGroup = new THREE.Group();
  starsGroup.position.set(0, 1.35, 0.1);
  starsGroup.visible = false;
  const starGeo = new THREE.ShapeGeometry(createStarShape(0.04, 0.095, 5));
  const starColors = [0xffd166, 0xff8fab, 0x72efdd, 0xcdb4db] as const;
  for (let i = 0; i < 8; i += 1) {
    const star = new THREE.Mesh(
      starGeo,
      new THREE.MeshBasicMaterial({ color: starColors[i % starColors.length], side: THREE.DoubleSide }),
    );
    const angle = (i / 8) * Math.PI * 2;
    star.position.set(Math.cos(angle) * 0.85, (i % 2) * 0.25, Math.sin(angle) * 0.35);
    starsGroup.add(star);
  }
  group.add(starsGroup);

  return { group, mesh, basePositions, glowRing, starsGroup };
}

/**
 * Three.js による繊細で可愛らしい 3D 英会話ステージ。
 * - 不気味なプリミティブ球体人間は使わず、高精細3Dレンダリングキャラクター＋3D頂点変形＋桜・光パーティクルの3Dジオラマ空間を描画
 * - 左側には着せ替え対応のかのはちゃん、3D空間の中央にはステージのお友だちが登場して対面でやり取りする
 */
export function ThreeTalkStage3D({
  sceneId,
  turnId,
  turnIndex,
  started,
  mood,
  isListening = false,
  visual,
  onCharacterTap,
}: ThreeTalkStage3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [speaking, setSpeaking] = useState(false);

  const stateRef = useRef({
    started,
    mood,
    speaking: false,
    isListening,
    turnIndex,
    turnId,
    visual,
    pointerX: 0,
    pointerY: 0,
  });

  stateRef.current.started = started;
  stateRef.current.mood = mood;
  stateRef.current.speaking = speaking;
  stateRef.current.isListening = isListening;
  stateRef.current.turnIndex = turnIndex;
  stateRef.current.turnId = turnId;
  stateRef.current.visual = visual;

  const propGroupHolderRef = useRef<{
    scene: THREE.Scene | null;
    currentProp: THREE.Group | null;
  }>({
    scene: null,
    currentProp: null,
  });

  useEffect(() => {
    const onStart = () => setSpeaking(true);
    const onEnd = () => setSpeaking(false);
    window.addEventListener("kanoha-coach-speaking-start", onStart);
    window.addEventListener("kanoha-coach-speaking-end", onEnd);
    return () => {
      window.removeEventListener("kanoha-coach-speaking-start", onStart);
      window.removeEventListener("kanoha-coach-speaking-end", onEnd);
    };
  }, []);

  useEffect(() => {
    const holder = propGroupHolderRef.current;
    if (!holder.scene) return;
    if (holder.currentProp) {
      holder.scene.remove(holder.currentProp);
      holder.currentProp = null;
    }
    if (started && (turnId || visual)) {
      const nextProp = createKawaiiPropMesh(turnId, visual);
      nextProp.scale.setScalar(0.01);
      holder.scene.add(nextProp);
      holder.currentProp = nextProp;
    }
  }, [started, turnId, visual]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl2") ?? testCanvas.getContext("webgl");
      if (!gl) return;
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    const activeTheme = SCENE_THEMES[sceneId] ?? SCENE_THEMES.greeting;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = renderer.domElement;
    canvas.className = styles.threeCanvas;
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const skyTex = createSkyTexture(activeTheme);
    scene.background = skyTex;

    const shadowTex = createSoftShadowTexture();
    buildPastelEnvironment(scene, sceneId, activeTheme);

    // 3D空間で迎えてくれるお友だちキャラクター (高精細3Dレンダリングテクスチャ + リアルタイム頂点変形)
    const friendChar = create3DSpriteCharacter(activeTheme.friendSprite, shadowTex);
    scene.add(friendChar.group);

    // 3D空間を舞う桜の花びら・光パーティクル
    const petalsGroup = new THREE.Group();
    const petalGeo = new THREE.CircleGeometry(0.042, 8);
    const petalMat = new THREE.MeshBasicMaterial({
      color: activeTheme.petalColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
    });
    const petals: { mesh: THREE.Mesh; speed: number; sway: number; phase: number }[] = [];
    for (let i = 0; i < 26; i += 1) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.scale.set(1.4, 0.85, 1);
      p.position.set(
        (Math.random() - 0.5) * 6.5,
        0.4 + Math.random() * 3.5,
        -1.5 + Math.random() * 4.5,
      );
      petalsGroup.add(p);
      petals.push({
        mesh: p,
        speed: 0.22 + Math.random() * 0.25,
        sway: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    scene.add(petalsGroup);

    const propHolder = propGroupHolderRef.current;
    propHolder.scene = scene;
    if (stateRef.current.started && (stateRef.current.turnId || stateRef.current.visual)) {
      const initialProp = createKawaiiPropMesh(stateRef.current.turnId, stateRef.current.visual);
      scene.add(initialProp);
      propHolder.currentProp = initialProp;
    }

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 1.65, 5.2);
    const currentLookAt = new THREE.Vector3(0, 1.15, 0);
    camera.lookAt(currentLookAt);

    let frameId = 0;
    const clock = new THREE.Clock();
    let walkPhase = 0;

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      // Smooth camera walk-in and per-turn framing
      const turnCam = CAMERA_TURN_OFFSETS[st.turnIndex % CAMERA_TURN_OFFSETS.length];
      const targetCamZ = st.started ? turnCam.z : 4.85;
      const targetCamX = (st.started ? turnCam.x : Math.sin(elapsed * 0.35) * 0.22) + st.pointerX * 0.18;
      const distZ = Math.abs(camera.position.z - targetCamZ);

      if (st.started && distZ > 0.1) {
        walkPhase += dt * 10;
      }
      const walkBob = st.started && distZ > 0.1 ? Math.sin(walkPhase) * 0.032 : 0;
      const targetCamY = (st.started ? turnCam.y : 1.58) + walkBob + st.pointerY * 0.1;

      camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 3.8);
      camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 4.2);
      camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 3.2);

      const targetLookX = st.started ? turnCam.lookX : 0.08;
      const targetLookY = st.started ? turnCam.lookY : 1.15;
      currentLookAt.x += (targetLookX - currentLookAt.x) * Math.min(1, dt * 5);
      currentLookAt.y += (targetLookY - currentLookAt.y) * Math.min(1, dt * 5);
      camera.lookAt(currentLookAt);

      // Delicate skeletal vertex deformation on the 3D character mesh (breathing, hair sway, speaking bounce)
      const posAttr = friendChar.mesh.geometry.attributes.position;
      const posArr = posAttr.array as Float32Array;
      const baseArr = friendChar.basePositions;
      const swayRate = st.speaking ? 6.5 : 2.2;
      const swayAmp = st.speaking ? 0.038 : 0.018;
      const tiltTarget = st.mood === "think" ? -0.08 : 0;

      for (let i = 0; i < posArr.length; i += 3) {
        const bx = baseArr[i];
        const by = baseArr[i + 1];
        const bz = baseArr[i + 2];
        const heightRatio = Math.max(0, Math.min(1, by / 2.04));

        // Breathing expansion + soft hair/upper-body sway
        const breathY = Math.sin(elapsed * 2.5) * 0.022 * heightRatio;
        const swayX =
          Math.sin(elapsed * swayRate + heightRatio * 1.6) * swayAmp * heightRatio * heightRatio +
          tiltTarget * heightRatio;
        const waveZ = Math.cos(elapsed * 2.8 + bx * 2.2) * 0.025 * heightRatio;

        posArr[i] = bx + swayX;
        posArr[i + 1] = by + breathY;
        posArr[i + 2] = bz + waveZ;
      }
      posAttr.needsUpdate = true;

      // Jump / Speaking / Listening motion
      if (st.mood === "celebrate") {
        friendChar.mesh.position.y = Math.abs(Math.sin(elapsed * 7.5)) * 0.24;
      } else if (st.speaking) {
        friendChar.mesh.position.y = Math.abs(Math.sin(elapsed * 9)) * 0.045;
      } else {
        friendChar.mesh.position.y = 0;
      }

      friendChar.group.rotation.y = st.pointerX * 0.14 + Math.sin(elapsed * 1.4) * 0.04;

      friendChar.glowRing.visible = st.isListening;
      if (st.isListening) {
        friendChar.glowRing.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.1);
      }

      friendChar.starsGroup.visible = st.mood === "celebrate";
      if (friendChar.starsGroup.visible) {
        friendChar.starsGroup.rotation.z = elapsed * 1.4;
        friendChar.starsGroup.position.y = 1.35 + Math.sin(elapsed * 5) * 0.1;
      }

      // Animate floating sakura petals / light particles
      for (const p of petals) {
        p.mesh.position.y -= p.speed * dt;
        p.mesh.position.x += Math.sin(elapsed * 1.5 + p.phase) * p.sway * dt;
        p.mesh.rotation.x = elapsed * 1.8 + p.phase;
        p.mesh.rotation.y = elapsed * 1.2 + p.phase;
        if (p.mesh.position.y < 0.08) {
          p.mesh.position.y = 3.6;
        }
      }

      // Animate kawaii turn prop card
      const activeProp = propHolder.currentProp;
      if (activeProp) {
        const nextScale = activeProp.scale.x + (1 - activeProp.scale.x) * Math.min(1, dt * 8);
        activeProp.scale.setScalar(nextScale);
        activeProp.position.y = Math.sin(elapsed * 3.2) * 0.05;
      }

      renderer?.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 260);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(frameId);
      propHolder.scene = null;
      propHolder.currentProp = null;
      skyTex.dispose();
      shadowTex.dispose();
      renderer?.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [sceneId]);

  return (
    <div
      ref={containerRef}
      className={styles.threeViewport}
      data-testid="three-talk-stage"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          stateRef.current.pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          stateRef.current.pointerY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
        }
      }}
      onPointerLeave={() => {
        stateRef.current.pointerX = 0;
        stateRef.current.pointerY = 0;
      }}
    >
      {/* 高精細3Dレンダリング＆着せ替え対応の「かのはちゃん」が3Dステージの手前に立って一緒に会話する */}
      <div className={styles.stageMainCharacterSpot}>
        <TalkCharacter mood={mood} onTap={onCharacterTap} />
      </div>
    </div>
  );
}
