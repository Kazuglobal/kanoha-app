"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { TalkMood } from "./TalkCharacter";
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

interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  mouth: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  starsGroup: THREE.Group;
  listenRing: THREE.Mesh;
}

interface ScenePalette {
  skyTop: number;
  skyBottom: number;
  ground: number;
  path: number;
  outfitPrimary: number;
  outfitSecondary: number;
  hatColor: number;
  hairColor: number;
}

const SCENE_PALETTES: Record<string, ScenePalette> = {
  greeting: {
    skyTop: 0x7ec8ff,
    skyBottom: 0xe6f7ff,
    ground: 0x7fd17b,
    path: 0xf3dfb9,
    outfitPrimary: 0xff7eb3,
    outfitSecondary: 0xffffff,
    hatColor: 0xff5c97,
    hairColor: 0x4a2c2a,
  },
  shop: {
    skyTop: 0x89d4ff,
    skyBottom: 0xfff5e4,
    ground: 0x95d57a,
    path: 0xe8d2ae,
    outfitPrimary: 0x38a169,
    outfitSecondary: 0xfffaf0,
    hatColor: 0xe53e3e,
    hairColor: 0x5a3825,
  },
  park: {
    skyTop: 0x63b3ed,
    skyBottom: 0xdff3ff,
    ground: 0x68d391,
    path: 0xedd9b4,
    outfitPrimary: 0x3182ce,
    outfitSecondary: 0xffffff,
    hatColor: 0xf6ad55,
    hairColor: 0x3b2314,
  },
  school: {
    skyTop: 0xfefcbf,
    skyBottom: 0xfffaf0,
    ground: 0xd69e6c,
    path: 0xc48b5a,
    outfitPrimary: 0x2b6cb0,
    outfitSecondary: 0xffffff,
    hatColor: 0xe53e3e,
    hairColor: 0x2d1e18,
  },
  zoo: {
    skyTop: 0x68d391,
    skyBottom: 0xe6fffa,
    ground: 0x88c96b,
    path: 0xe6c896,
    outfitPrimary: 0xd69e2e,
    outfitSecondary: 0xfffaf0,
    hatColor: 0xb7791f,
    hairColor: 0x4a2e1b,
  },
};

const CAMERA_TURN_OFFSETS: readonly { x: number; y: number; z: number; lookX: number; lookY: number }[] = [
  { x: 0.0, y: 1.52, z: 3.15, lookX: 0.0, lookY: 1.18 },
  { x: -0.42, y: 1.48, z: 2.95, lookX: 0.12, lookY: 1.12 },
  { x: 0.44, y: 1.5, z: 2.98, lookX: -0.1, lookY: 1.15 },
  { x: 0.0, y: 1.56, z: 3.25, lookX: 0.0, lookY: 1.2 },
];

function createToonMaterial(color: number, roughness = 0.55, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createTree(x: number, z: number, scale = 1, blossom = false): THREE.Group {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 1.2, 10),
    createToonMaterial(0x8b5a2b, 0.8),
  );
  trunk.position.y = 0.6;
  tree.add(trunk);

  const leafColor = blossom ? 0xffb7d5 : 0x48bb78;
  const leafColor2 = blossom ? 0xff9ec4 : 0x38a169;
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 14), createToonMaterial(leafColor, 0.65));
  c1.position.set(0, 1.5, 0);
  tree.add(c1);

  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), createToonMaterial(leafColor2, 0.65));
  c2.position.set(-0.35, 1.35, 0.2);
  tree.add(c2);

  const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), createToonMaterial(leafColor2, 0.65));
  c3.position.set(0.38, 1.38, -0.15);
  tree.add(c3);

  return tree;
}

function createAppleMesh(scale = 1): THREE.Group {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 14),
    createToonMaterial(0xe53e3e, 0.3, 0.1),
  );
  body.scale.set(1, 0.92, 1);
  group.add(body);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6),
    createToonMaterial(0x6b4226, 0.8),
  );
  stem.position.y = 0.15;
  group.add(stem);

  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    createToonMaterial(0x38a169, 0.5),
  );
  leaf.scale.set(1.6, 0.4, 0.8);
  leaf.position.set(0.04, 0.16, 0);
  leaf.rotation.z = -0.3;
  group.add(leaf);
  return group;
}

function createDogMesh(): THREE.Group {
  const dog = new THREE.Group();
  dog.name = "prop-dog";
  const furMat = createToonMaterial(0xd69e5c, 0.6);
  const darkMat = createToonMaterial(0x5c3a21, 0.6);
  const noseMat = createToonMaterial(0x1a202c, 0.3);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.28, 8, 14), furMat);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.28, 0);
  dog.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), furMat);
  head.position.set(0.22, 0.48, 0.08);
  dog.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), createToonMaterial(0xfff5eb, 0.6));
  snout.position.set(0.32, 0.44, 0.2);
  dog.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), noseMat);
  nose.position.set(0.36, 0.47, 0.27);
  dog.add(nose);

  const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), darkMat);
  leftEar.scale.set(0.5, 1.5, 0.8);
  leftEar.position.set(0.08, 0.48, 0.18);
  leftEar.rotation.z = 0.3;
  dog.add(leftEar);

  const rightEar = leftEar.clone();
  rightEar.position.set(0.34, 0.48, -0.02);
  rightEar.rotation.z = -0.3;
  dog.add(rightEar);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), noseMat);
  eyeL.position.set(0.2, 0.53, 0.25);
  dog.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.set(0.33, 0.53, 0.18);
  dog.add(eyeR);

  for (const [lx, lz] of [
    [-0.14, 0.1],
    [-0.14, -0.1],
    [0.14, 0.1],
    [0.14, -0.1],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8), furMat);
    leg.position.set(lx, 0.11, lz);
    dog.add(leg);
  }

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.22, 8), darkMat);
  tail.position.set(-0.3, 0.4, 0);
  tail.rotation.z = 0.6;
  tail.name = "dog-tail";
  dog.add(tail);

  return dog;
}

function createElephantMesh(): THREE.Group {
  const elephant = new THREE.Group();
  elephant.name = "prop-elephant";
  const grayMat = createToonMaterial(0x90a4ae, 0.6);
  const earInnerMat = createToonMaterial(0xf4b8c8, 0.65);
  const ivoryMat = createToonMaterial(0xfffaf0, 0.4);
  const darkMat = createToonMaterial(0x1a202c, 0.3);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 16), grayMat);
  body.scale.set(1.15, 0.92, 0.95);
  body.position.set(0, 0.62, 0);
  elephant.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), grayMat);
  head.position.set(0, 0.92, 0.42);
  elephant.add(head);

  // Ears
  const leftEarGroup = new THREE.Group();
  leftEarGroup.position.set(-0.28, 0.95, 0.35);
  leftEarGroup.name = "elephant-ear-l";
  const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), grayMat);
  earOuter.scale.set(0.9, 1.15, 0.22);
  earOuter.position.x = -0.14;
  leftEarGroup.add(earOuter);
  const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), earInnerMat);
  earInner.scale.set(0.85, 1.05, 0.18);
  earInner.position.set(-0.14, 0, 0.03);
  leftEarGroup.add(earInner);
  elephant.add(leftEarGroup);

  const rightEarGroup = leftEarGroup.clone();
  rightEarGroup.position.set(0.28, 0.95, 0.35);
  rightEarGroup.scale.x = -1;
  rightEarGroup.name = "elephant-ear-r";
  elephant.add(rightEarGroup);

  // Trunk
  const trunkGroup = new THREE.Group();
  trunkGroup.position.set(0, 0.85, 0.7);
  trunkGroup.name = "elephant-trunk";
  const trunk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.38, 10), grayMat);
  trunk1.position.set(0, -0.14, 0.08);
  trunk1.rotation.x = -0.45;
  trunkGroup.add(trunk1);
  const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.048, 0.26, 10), grayMat);
  trunk2.position.set(0, -0.26, 0.25);
  trunk2.rotation.x = -1.1;
  trunkGroup.add(trunk2);
  elephant.add(trunkGroup);

  // Tusks
  for (const side of [-1, 1] as const) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 8), ivoryMat);
    tusk.position.set(side * 0.13, 0.74, 0.68);
    tusk.rotation.x = Math.PI * 0.65;
    elephant.add(tusk);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), darkMat);
    eye.position.set(side * 0.16, 0.98, 0.69);
    elephant.add(eye);
  }

  for (const [lx, lz] of [
    [-0.24, 0.24],
    [0.24, 0.24],
    [-0.24, -0.24],
    [0.24, -0.24],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 10), grayMat);
    leg.position.set(lx, 0.21, lz);
    elephant.add(leg);
  }

  return elephant;
}

function createPandaMesh(): THREE.Group {
  const panda = new THREE.Group();
  const whiteMat = createToonMaterial(0xffffff, 0.5);
  const blackMat = createToonMaterial(0x1a202c, 0.5);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), whiteMat);
  body.position.y = 0.24;
  panda.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), whiteMat);
  head.position.set(0, 0.54, 0.04);
  panda.add(head);

  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), blackMat);
    ear.position.set(side * 0.15, 0.7, 0.02);
    panda.add(ear);

    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), blackMat);
    patch.scale.set(1, 0.8, 0.4);
    patch.position.set(side * 0.08, 0.56, 0.21);
    panda.add(patch);

    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), blackMat);
    arm.position.set(side * 0.22, 0.28, 0.08);
    panda.add(arm);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), blackMat);
  nose.position.set(0, 0.51, 0.23);
  panda.add(nose);

  return panda;
}

function buildSceneEnvironment(scene: THREE.Scene, sceneId: string, palette: ScenePalette): void {
  scene.background = new THREE.Color(palette.skyTop);
  scene.fog = new THREE.FogExp2(palette.skyBottom, 0.042);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, palette.ground, 0.95);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffaf0, 1.15);
  dirLight.position.set(4.5, 8.5, 6.0);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xdff3ff, 0.45);
  fillLight.position.set(-4.0, 4.0, 3.0);
  scene.add(fillLight);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(18, 40),
    createToonMaterial(palette.ground, 0.85),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Walking path from player camera to character
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 10),
    createToonMaterial(palette.path, 0.9),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 2.5);
  scene.add(path);

  if (sceneId === "greeting") {
    // Sun in the morning sky
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 20, 18),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    );
    sun.position.set(3.8, 5.2, -6.5);
    scene.add(sun);

    scene.add(createTree(-2.4, -1.6, 1.15, true));
    scene.add(createTree(2.5, -1.8, 1.1, false));
    scene.add(createTree(-3.2, 1.4, 0.95, false));
    scene.add(createTree(3.1, 1.2, 1.0, true));

    // Park bench
    const bench = new THREE.Group();
    bench.position.set(-1.7, 0, -0.3);
    bench.rotation.y = 0.45;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.42), createToonMaterial(0xc07a45));
    seat.position.y = 0.38;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 0.08), createToonMaterial(0xc07a45));
    back.position.set(0, 0.6, -0.17);
    bench.add(back);
    scene.add(bench);
  } else if (sceneId === "shop") {
    // Fruit shop stall
    const stall = new THREE.Group();
    stall.position.set(0, 0, 0.82);

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.78, 0.68),
      createToonMaterial(0xc88a51, 0.75),
    );
    counter.position.y = 0.39;
    stall.add(counter);

    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.52, 0.08, 0.78),
      createToonMaterial(0xf6e0b5, 0.6),
    );
    counterTop.position.y = 0.8;
    stall.add(counterTop);

    // Posts & striped awning
    for (const side of [-1.1, 1.1] as const) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10),
        createToonMaterial(0x9c6334, 0.8),
      );
      post.position.set(side, 1.1, -0.2);
      stall.add(post);
    }

    for (let i = -2; i <= 2; i += 1) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.12, 1.2),
        createToonMaterial(i % 2 === 0 ? 0xe53e3e : 0xffffff, 0.5),
      );
      stripe.position.set(i * 0.52, 2.22, 0.05);
      stripe.rotation.x = 0.25;
      stall.add(stripe);
    }

    // Fruit display on counter sides
    for (let i = 0; i < 3; i += 1) {
      const apple = createAppleMesh(0.75);
      apple.position.set(-0.85 + i * 0.22, 0.92, 0.05);
      stall.add(apple);

      const orange = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 10),
        createToonMaterial(0xed8936, 0.4),
      );
      orange.position.set(0.45 + i * 0.22, 0.92, 0.05);
      stall.add(orange);
    }

    scene.add(stall);
    scene.add(createTree(-2.8, -1.8, 1.0, false));
    scene.add(createTree(2.8, -1.8, 1.0, false));
  } else if (sceneId === "park") {
    scene.add(createTree(-2.5, -1.5, 1.2, false));
    scene.add(createTree(2.6, -1.4, 1.1, false));
    scene.add(createTree(-3.4, 1.5, 0.9, false));

    // White park fence in background
    for (let i = -4; i <= 4; i += 1) {
      const picket = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.65, 0.05),
        createToonMaterial(0xffffff, 0.5),
      );
      picket.position.set(i * 0.65, 0.32, -2.4);
      scene.add(picket);
    }
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.08, 0.06),
      createToonMaterial(0xffffff, 0.5),
    );
    rail.position.set(0, 0.45, -2.4);
    scene.add(rail);
  } else if (sceneId === "school") {
    // Classroom back wall & chalkboard
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5),
      createToonMaterial(0xfffaf0, 0.85),
    );
    backWall.position.set(0, 2.5, -1.8);
    scene.add(backWall);

    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.7, 0.08),
      createToonMaterial(0xb7791f, 0.7),
    );
    boardFrame.position.set(0, 1.85, -1.72);
    scene.add(boardFrame);

    const chalkboard = new THREE.Mesh(
      new THREE.BoxGeometry(3.36, 1.48, 0.1),
      createToonMaterial(0x276749, 0.75),
    );
    chalkboard.position.set(0, 1.85, -1.7);
    scene.add(chalkboard);

    // Classroom desk in front of character
    const desk = new THREE.Group();
    desk.position.set(0, 0, 0.88);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 0.65),
      createToonMaterial(0xd69e5c, 0.6),
    );
    top.position.y = 0.72;
    desk.add(top);
    for (const [lx, lz] of [
      [-0.65, 0.25],
      [0.65, 0.25],
      [-0.65, -0.25],
      [0.65, -0.25],
    ] as const) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8),
        createToonMaterial(0x718096, 0.5),
      );
      leg.position.set(lx, 0.36, lz);
      desk.add(leg);
    }
    scene.add(desk);
  } else if (sceneId === "zoo") {
    scene.add(createTree(-2.8, -1.8, 1.15, false));
    scene.add(createTree(2.8, -1.8, 1.2, false));

    // Zoo wooden fence
    for (let i = -4; i <= 4; i += 1) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8),
        createToonMaterial(0x8b5a2b, 0.8),
      );
      post.position.set(i * 0.7, 0.35, -1.25);
      scene.add(post);
    }
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 0.08, 0.06),
      createToonMaterial(0xa06b3b, 0.8),
    );
    bar.position.set(0, 0.52, -1.25);
    scene.add(bar);

    // Background Panda & Giraffe
    const bgPanda = createPandaMesh();
    bgPanda.position.set(-1.7, 0, -1.7);
    bgPanda.rotation.y = 0.35;
    scene.add(bgPanda);
  }
}

function createCharacterRig(sceneId: string, palette: ScenePalette): CharacterRig {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = createToonMaterial(0xffe2cc, 0.55);
  const outfitMat = createToonMaterial(palette.outfitPrimary, 0.55);
  const accentMat = createToonMaterial(palette.outfitSecondary, 0.5);
  const hairMat = createToonMaterial(palette.hairColor, 0.65);
  const darkMat = createToonMaterial(0x1a202c, 0.25);
  const cheekMat = createToonMaterial(0xff9ebb, 0.6);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.42, 0);
  const legMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 8, 12), skinMat);
  legMeshL.position.y = -0.16;
  leftLeg.add(legMeshL);
  const shoeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), createToonMaterial(palette.hatColor, 0.5));
  shoeL.scale.set(0.95, 0.65, 1.35);
  shoeL.position.set(0, -0.35, 0.04);
  leftLeg.add(shoeL);
  bodyGroup.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.set(0.14, 0.42, 0);
  bodyGroup.add(rightLeg);

  // Torso / Dress
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.34, 0.62, 18),
    outfitMat,
  );
  torso.position.y = 0.68;
  bodyGroup.add(torso);

  // Collar / Apron detail
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.045, 10, 20),
    accentMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.96;
  bodyGroup.add(collar);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 0.92, 0);
  const armMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.28, 8, 12), outfitMat);
  armMeshL.position.set(-0.06, -0.15, 0);
  armMeshL.rotation.z = 0.25;
  leftArm.add(armMeshL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skinMat);
  handL.position.set(-0.12, -0.32, 0.02);
  leftArm.add(handL);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 0.92, 0);
  const armMeshR = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.28, 8, 12), outfitMat);
  armMeshR.position.set(0.06, -0.15, 0);
  armMeshR.rotation.z = -0.25;
  rightArm.add(armMeshR);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skinMat);
  handR.position.set(0.12, -0.32, 0.02);
  rightArm.add(handR);
  bodyGroup.add(rightArm);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.28, 0);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 20), skinMat);
  head.scale.set(1.04, 0.98, 0.96);
  headGroup.add(head);

  // Hair cap + twin tails
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.325, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hairCap.position.y = 0.02;
  hairCap.rotation.x = -0.18;
  headGroup.add(hairCap);

  for (const side of [-1, 1] as const) {
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), hairMat);
    bang.scale.set(1.1, 0.7, 0.55);
    bang.position.set(side * 0.11, 0.16, 0.25);
    bang.rotation.z = side * -0.25;
    headGroup.add(bang);

    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), hairMat);
    tail.scale.set(0.85, 1.35, 0.85);
    tail.position.set(side * 0.34, 0.02, -0.05);
    tail.rotation.z = side * 0.35;
    headGroup.add(tail);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), cheekMat);
    cheek.scale.set(1.2, 0.7, 0.35);
    cheek.position.set(side * 0.18, -0.05, 0.27);
    headGroup.add(cheek);
  }

  // Scene hat/accessory
  if (sceneId === "shop" || sceneId === "park" || sceneId === "zoo") {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.12, 18),
      createToonMaterial(palette.hatColor, 0.5),
    );
    hat.position.set(0, 0.31, 0);
    headGroup.add(hat);
  } else {
    const ribbon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 1),
      createToonMaterial(palette.hatColor, 0.45),
    );
    ribbon.scale.set(1.6, 0.8, 0.6);
    ribbon.position.set(-0.24, 0.24, 0.12);
    headGroup.add(ribbon);
  }

  // Eyes with white catchlights
  const createEye = (x: number) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 12), darkMat);
    eye.scale.set(0.9, 1.15, 0.5);
    eye.position.set(x, 0.03, 0.285);
    const catchlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    catchlight.position.set(0.014, 0.018, 0.035);
    eye.add(catchlight);
    return eye;
  };
  const leftEye = createEye(-0.11);
  const rightEye = createEye(0.11);
  headGroup.add(leftEye, rightEye);

  // Mouth (scales dynamically with speech)
  const mouth = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 14, 12),
    createToonMaterial(0xe53e6b, 0.4),
  );
  mouth.scale.set(1.25, 0.42, 0.4);
  mouth.position.set(0, -0.1, 0.29);
  headGroup.add(mouth);

  // Celebration stars group
  const starsGroup = new THREE.Group();
  starsGroup.position.set(0, 1.25, 0);
  starsGroup.visible = false;
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  for (let i = 0; i < 8; i += 1) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), starMat);
    const angle = (i / 8) * Math.PI * 2;
    star.position.set(Math.cos(angle) * 0.68, (i % 2) * 0.22, Math.sin(angle) * 0.68);
    starsGroup.add(star);
  }
  root.add(starsGroup);

  // Listening ring on ground
  const listenRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: 0x38b2ac, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
  );
  listenRing.rotation.x = -Math.PI / 2;
  listenRing.position.y = 0.025;
  listenRing.visible = false;
  root.add(listenRing);

  return {
    root,
    bodyGroup,
    headGroup,
    leftEye,
    rightEye,
    mouth,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    starsGroup,
    listenRing,
  };
}

function buildTurnPropGroup(turnId?: string): THREE.Group {
  const group = new THREE.Group();
  if (!turnId) return group;

  if (turnId === "greeting-age") {
    // 3D Birthday cake with candles
    const cake = new THREE.Group();
    cake.position.set(0.62, 0.72, 1.05);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.18, 18),
      createToonMaterial(0xfff5f7, 0.5),
    );
    cake.add(base);
    const icing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.05, 18),
      createToonMaterial(0xff7eb3, 0.4),
    );
    icing.position.y = 0.08;
    cake.add(icing);
    for (let i = -1; i <= 1; i += 1) {
      const candle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8),
        createToonMaterial(0x63b3ed, 0.4),
      );
      candle.position.set(i * 0.08, 0.16, 0);
      cake.add(candle);
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffc83d }),
      );
      flame.position.set(i * 0.08, 0.25, 0);
      cake.add(flame);
    }
    group.add(cake);
  } else if (turnId === "shop-want") {
    // Floating Apple, Banana, Orange trio
    const trio = new THREE.Group();
    trio.position.set(0, 1.15, 1.1);
    const apple = createAppleMesh(1.1);
    apple.position.x = -0.36;
    trio.add(apple);

    const banana = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.042, 10, 16, Math.PI * 0.85),
      createToonMaterial(0xf6e05e, 0.4),
    );
    banana.position.set(0, 0.02, 0);
    banana.rotation.z = -0.4;
    trio.add(banana);

    const orange = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 14),
      createToonMaterial(0xed8936, 0.35),
    );
    orange.position.x = 0.36;
    trio.add(orange);
    group.add(trio);
  } else if (turnId === "shop-how-many") {
    // 3 Apples in a row
    const apples = new THREE.Group();
    apples.position.set(0, 1.08, 1.12);
    for (let i = -1; i <= 1; i += 1) {
      const apple = createAppleMesh(1.05);
      apple.position.x = i * 0.34;
      apples.add(apple);
    }
    group.add(apples);
  } else if (turnId === "shop-here-you-are") {
    // 3D Shopping bag
    const bag = new THREE.Group();
    bag.position.set(0, 1.05, 1.25);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.4, 0.22),
      createToonMaterial(0xf6ad55, 0.6),
    );
    bag.add(box);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.016, 8, 16, Math.PI),
      createToonMaterial(0x9c4221, 0.6),
    );
    handle.position.y = 0.2;
    bag.add(handle);
    group.add(bag);
  } else if (turnId === "park-soccer") {
    // 3D Soccer Ball
    const ballGroup = new THREE.Group();
    ballGroup.position.set(0.52, 0.32, 1.15);
    ballGroup.name = "prop-soccer";
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 18),
      createToonMaterial(0xffffff, 0.4),
    );
    ballGroup.add(ball);
    const spots = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.223, 0),
      new THREE.MeshBasicMaterial({ color: 0x1a202c, wireframe: true }),
    );
    ballGroup.add(spots);
    group.add(ballGroup);
  } else if (turnId === "park-dog") {
    const dog = createDogMesh();
    dog.position.set(0.68, 0, 0.95);
    dog.rotation.y = -0.5;
    group.add(dog);
  } else if (turnId === "park-ball-color") {
    // Bright Red Ball
    const redBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 24, 20),
      createToonMaterial(0xe53e3e, 0.25, 0.15),
    );
    redBall.position.set(0.55, 0.95, 1.15);
    group.add(redBall);
  } else if (turnId === "school-pencil") {
    // 3D Yellow Pencil
    const pencil = new THREE.Group();
    pencil.position.set(0, 1.08, 1.12);
    pencil.rotation.z = Math.PI / 4;
    pencil.rotation.y = 0.3;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.58, 6),
      createToonMaterial(0xf6e05e, 0.45),
    );
    pencil.add(shaft);
    const tipWood = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.14, 12),
      createToonMaterial(0xfbd38d, 0.6),
    );
    tipWood.position.y = 0.36;
    pencil.add(tipWood);
    const lead = new THREE.Mesh(
      new THREE.ConeGeometry(0.022, 0.06, 10),
      createToonMaterial(0x2d3748, 0.4),
    );
    lead.position.y = 0.41;
    pencil.add(lead);
    const eraser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.1, 12),
      createToonMaterial(0xf687b3, 0.5),
    );
    eraser.position.y = -0.34;
    pencil.add(eraser);
    group.add(pencil);
  } else if (turnId === "school-books") {
    // 3 Colorful Books stacked on desk
    const books = new THREE.Group();
    books.position.set(0, 0.82, 0.92);
    const colors = [0xe53e3e, 0x38a169, 0x3182ce] as const;
    colors.forEach((color, idx) => {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.075, 0.3),
        createToonMaterial(color, 0.5),
      );
      book.position.set((idx - 1) * 0.03, idx * 0.085, 0);
      book.rotation.y = (idx - 1) * 0.12;
      books.add(book);
    });
    group.add(books);
  } else if (turnId === "school-sing") {
    // Floating 3D music notes
    const notes = new THREE.Group();
    notes.position.set(0.55, 1.25, 0.9);
    for (let i = 0; i < 3; i += 1) {
      const note = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 10),
        createToonMaterial(i === 1 ? 0xff7eb3 : 0x63b3ed, 0.4),
      );
      note.position.set((i - 1) * 0.24, (i % 2) * 0.16, 0);
      notes.add(note);
    }
    group.add(notes);
  } else if (turnId === "zoo-elephant" || turnId === "zoo-big") {
    const elephant = createElephantMesh();
    elephant.position.set(0.82, 0, -0.35);
    elephant.rotation.y = -0.35;
    if (turnId === "zoo-big") {
      elephant.scale.setScalar(1.18);
    }
    group.add(elephant);
  } else if (turnId === "zoo-like") {
    const panda = createPandaMesh();
    panda.position.set(0.68, 0, 0.85);
    panda.rotation.y = -0.4;
    group.add(panda);
  }

  return group;
}

/**
 * Three.js による 3D 英会話ステージ。
 * 各ステージ・各ターンの場面が3D空間として現れ、カメラが歩いてキャラクターと対面してやりとりする。
 */
export function ThreeTalkStage3D({
  sceneId,
  turnId,
  turnIndex,
  started,
  mood,
  isListening = false,
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
    pointerX: 0,
    pointerY: 0,
  });

  stateRef.current.started = started;
  stateRef.current.mood = mood;
  stateRef.current.speaking = speaking;
  stateRef.current.isListening = isListening;
  stateRef.current.turnIndex = turnIndex;
  stateRef.current.turnId = turnId;

  const propGroupHolderRef = useRef<{
    scene: THREE.Scene | null;
    currentProp: THREE.Group | null;
    renderedTurnId: string | undefined;
  }>({
    scene: null,
    currentProp: null,
    renderedTurnId: undefined,
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

  // Update 3D turn prop whenever turnId changes
  useEffect(() => {
    const holder = propGroupHolderRef.current;
    if (!holder.scene) return;
    if (holder.currentProp) {
      holder.scene.remove(holder.currentProp);
      holder.currentProp = null;
    }
    if (started && turnId) {
      const nextProp = buildTurnPropGroup(turnId);
      nextProp.scale.setScalar(0.01);
      holder.scene.add(nextProp);
      holder.currentProp = nextProp;
      holder.renderedTurnId = turnId;
    }
  }, [started, turnId]);

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

    const palette = SCENE_PALETTES[sceneId] ?? SCENE_PALETTES.greeting;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const canvas = renderer.domElement;
    canvas.className = styles.threeCanvas;
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    buildSceneEnvironment(scene, sceneId, palette);

    const rig = createCharacterRig(sceneId, palette);
    scene.add(rig.root);

    const propHolder = propGroupHolderRef.current;
    propHolder.scene = scene;
    if (stateRef.current.started && stateRef.current.turnId) {
      const initialProp = buildTurnPropGroup(stateRef.current.turnId);
      scene.add(initialProp);
      propHolder.currentProp = initialProp;
      propHolder.renderedTurnId = stateRef.current.turnId;
    }

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 60);
    camera.position.set(0, 1.85, 6.2);
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

      // Camera target based on whether conversation has started and current turnIndex
      const turnCam = CAMERA_TURN_OFFSETS[st.turnIndex % CAMERA_TURN_OFFSETS.length];
      const targetCamZ = st.started ? turnCam.z : 5.8;
      const targetCamX = (st.started ? turnCam.x : Math.sin(elapsed * 0.4) * 0.35) + st.pointerX * 0.22;
      const distZ = Math.abs(camera.position.z - targetCamZ);

      if (st.started && distZ > 0.12) {
        walkPhase += dt * 11;
      }

      const walkBob = st.started && distZ > 0.12 ? Math.sin(walkPhase) * 0.045 : 0;
      const targetCamY = (st.started ? turnCam.y : 1.82) + walkBob + st.pointerY * 0.12;

      camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 3.8);
      camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 4.2);
      camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 3.2);

      const targetLookX = st.started ? turnCam.lookX : 0;
      const targetLookY = st.started ? turnCam.lookY : 1.12;
      currentLookAt.x += (targetLookX - currentLookAt.x) * Math.min(1, dt * 5);
      currentLookAt.y += (targetLookY - currentLookAt.y) * Math.min(1, dt * 5);
      camera.lookAt(currentLookAt);

      // Character animation
      const blinkCycle = elapsed % 3.6;
      const eyeScaleY = blinkCycle > 3.45 ? 0.12 : 1.15;
      rig.leftEye.scale.y = eyeScaleY;
      rig.rightEye.scale.y = eyeScaleY;

      // Lip sync mouth animation
      if (st.speaking) {
        const mouthOpen = 0.55 + Math.abs(Math.sin(elapsed * 18)) * 1.45;
        rig.mouth.scale.set(1.15, mouthOpen, 0.5);
      } else if (st.mood === "celebrate") {
        rig.mouth.scale.set(1.45, 0.9, 0.45);
      } else {
        rig.mouth.scale.set(1.25, 0.42, 0.4);
      }

      // Mood & Body language
      rig.starsGroup.visible = st.mood === "celebrate";
      if (rig.starsGroup.visible) {
        rig.starsGroup.rotation.y = elapsed * 2.6;
        rig.starsGroup.position.y = 1.3 + Math.sin(elapsed * 5) * 0.12;
      }

      rig.listenRing.visible = st.isListening;
      if (st.isListening) {
        const pulse = 1 + Math.sin(elapsed * 6) * 0.12;
        rig.listenRing.scale.setScalar(pulse);
      }

      if (st.mood === "celebrate") {
        rig.bodyGroup.position.y = Math.abs(Math.sin(elapsed * 8.5)) * 0.32;
        rig.headGroup.rotation.z = Math.sin(elapsed * 7) * 0.1;
        rig.leftArm.rotation.z = -2.2 + Math.sin(elapsed * 10) * 0.25;
        rig.rightArm.rotation.z = 2.2 - Math.sin(elapsed * 10) * 0.25;
      } else if (st.mood === "think") {
        rig.bodyGroup.position.y = Math.sin(elapsed * 2.2) * 0.02;
        rig.headGroup.rotation.z += (-0.18 - rig.headGroup.rotation.z) * 0.12;
        rig.rightArm.rotation.z += (1.15 - rig.rightArm.rotation.z) * 0.12;
        rig.leftArm.rotation.z += (0.15 - rig.leftArm.rotation.z) * 0.12;
      } else if (!st.started) {
        // Waving from afar before conversation starts
        rig.bodyGroup.position.y = Math.sin(elapsed * 2.5) * 0.03;
        rig.headGroup.rotation.z = Math.sin(elapsed * 2) * 0.05;
        rig.rightArm.rotation.z = 2.1 + Math.sin(elapsed * 8) * 0.35;
        rig.leftArm.rotation.z = 0.1;
      } else if (st.speaking) {
        rig.bodyGroup.position.y = Math.abs(Math.sin(elapsed * 6)) * 0.04;
        rig.headGroup.rotation.x = Math.sin(elapsed * 7) * 0.06;
        rig.headGroup.rotation.z = Math.sin(elapsed * 3.5) * 0.06;
        rig.rightArm.rotation.z = 0.55 + Math.sin(elapsed * 6) * 0.25;
        rig.leftArm.rotation.z = -0.35 - Math.cos(elapsed * 5) * 0.2;
      } else {
        // Attentive idle / listening
        rig.bodyGroup.position.y = Math.sin(elapsed * 2.4) * 0.025;
        rig.headGroup.rotation.z *= 0.9;
        rig.headGroup.rotation.x = st.isListening ? 0.07 : Math.sin(elapsed * 1.8) * 0.03;
        rig.rightArm.rotation.z *= 0.9;
        rig.leftArm.rotation.z *= 0.9;
      }

      // Animate active 3D turn prop
      const activeProp = propHolder.currentProp;
      if (activeProp) {
        const nextScale = activeProp.scale.x + (1 - activeProp.scale.x) * Math.min(1, dt * 8);
        activeProp.scale.setScalar(nextScale);

        const dog = activeProp.getObjectByName("prop-dog");
        if (dog) {
          const tail = dog.getObjectByName("dog-tail");
          if (tail) tail.rotation.x = Math.sin(elapsed * 14) * 0.45;
          dog.position.y = Math.abs(Math.sin(elapsed * 4.5)) * 0.06;
        }

        const elephant = activeProp.getObjectByName("prop-elephant");
        if (elephant) {
          const trunk = elephant.getObjectByName("elephant-trunk");
          if (trunk) trunk.rotation.x = Math.sin(elapsed * 3) * 0.35;
          const earL = elephant.getObjectByName("elephant-ear-l");
          const earR = elephant.getObjectByName("elephant-ear-r");
          if (earL) earL.rotation.y = Math.sin(elapsed * 4) * 0.22;
          if (earR) earR.rotation.y = -Math.sin(elapsed * 4) * 0.22;
        }

        const soccer = activeProp.getObjectByName("prop-soccer");
        if (soccer) {
          soccer.position.y = 0.24 + Math.abs(Math.sin(elapsed * 5)) * 0.25;
          soccer.rotation.x = elapsed * 2.5;
        }
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
      renderer?.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [sceneId]);

  const pose = speaking && mood !== "celebrate" ? "speaking" : mood;

  return (
    <div
      ref={containerRef}
      className={styles.threeViewport}
      data-testid="three-talk-stage"
      onClick={onCharacterTap}
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
      <div
        className={styles.threeCharacterAnchor}
        data-testid="talk-character"
        data-pose={pose}
        aria-hidden="true"
      />
    </div>
  );
}
