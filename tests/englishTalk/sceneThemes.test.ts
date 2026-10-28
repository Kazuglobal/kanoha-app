import { describe, expect, it } from "vitest";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { getSceneFriendName, getSceneTheme, SCENE_THEMES } from "@/lib/englishTalk/sceneThemes";

describe("sceneThemes", () => {
  it("全ての場面に見た目とおともだちの名前がある", () => {
    for (const scene of TALK_SCENES) {
      const theme = SCENE_THEMES[scene.id];
      expect(theme, `${scene.id} の見た目`).toBeDefined();
      expect(getSceneFriendName(scene.id)).toBe(theme.friendName);
      expect(theme.friendName.length).toBeGreaterThan(0);
    }
  });

  it("知らない場面は「あいさつ」の見た目になる", () => {
    expect(getSceneTheme("no-such-scene")).toBe(SCENE_THEMES.greeting);
    expect(getSceneFriendName("no-such-scene")).toBe(SCENE_THEMES.greeting.friendName);
  });

  it("Object のもともとのキー名(constructor など)でも、あいさつの見た目に戻る", () => {
    for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(getSceneTheme(id), id).toBe(SCENE_THEMES.greeting);
      expect(getSceneFriendName(id), id).toBe(SCENE_THEMES.greeting.friendName);
    }
  });

  it("おともだちの画像は、公開フォルダの画像を指している", () => {
    for (const theme of Object.values(SCENE_THEMES)) {
      expect(theme.friendSprite).toMatch(/^\/images\/character\/chars\/[a-z-]+\.png$/);
    }
  });
});
