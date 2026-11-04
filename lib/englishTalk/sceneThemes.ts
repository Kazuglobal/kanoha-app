/**
 * えいごで おはなしの場面ごとの見た目(空の色・地面の色・おともだち)。
 * サーバーのページ(シーン一覧)と 3D ステージの両方が読む純粋なデータなので、
 * "use client" のファイルには置かない(サーバーからクライアントの関数は呼べない)。
 */

export interface SceneTheme {
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

export const SCENE_THEMES: Readonly<Record<string, SceneTheme>> = {
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

const DEFAULT_SCENE_ID = "greeting";

/** 知らない場面は「あいさつ」の見た目にする(`constructor` のような Object のキー名も知らない場面として扱う)。 */
export function getSceneTheme(sceneId: string): SceneTheme {
  return Object.hasOwn(SCENE_THEMES, sceneId) ? SCENE_THEMES[sceneId] : SCENE_THEMES[DEFAULT_SCENE_ID];
}

export function getSceneFriendName(sceneId: string): string {
  return getSceneTheme(sceneId).friendName;
}
