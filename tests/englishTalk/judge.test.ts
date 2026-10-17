import { describe, expect, it } from "vitest";

import { TALK_SCENES, getTalkTurn } from "@/lib/curriculum/englishTalkScenes";
import {
  buildCorrectiveFeedbackEn,
  isDontKnowAnswer,
  judgeTalkAnswer,
  normalizeEnglish,
  toPublicScene,
} from "@/lib/englishTalk/judge";

const turn = (sceneId: string, turnId: string) => {
  const found = getTalkTurn(sceneId, turnId);
  if (!found) throw new Error(`missing ${turnId}`);
  return found;
};

describe("normalizeEnglish", () => {
  it("lowercases and strips punctuation and apostrophes", () => {
    expect(normalizeEnglish("  I'm FINE,  thank you! ")).toBe("im fine thank you");
    expect(normalizeEnglish("It’s a dog.")).toBe("its a dog");
  });
});

describe("isDontKnowAnswer", () => {
  it("detects English 'I don't know' and help phrases", () => {
    expect(isDontKnowAnswer("I don't know")).toBe(true);
    expect(isDontKnowAnswer("i dont know.")).toBe(true);
    expect(isDontKnowAnswer("I have no idea")).toBe(true);
    expect(isDontKnowAnswer("help")).toBe(true);
  });

  it("detects Japanese 'わからない' and phonetic en-US approximations", () => {
    expect(isDontKnowAnswer("わからない")).toBe(true);
    expect(isDontKnowAnswer("えいごが分かんない")).toBe(true);
    expect(isDontKnowAnswer("wakaranai")).toBe(true);
  });

  it("does not treat normal English answers as don't know", () => {
    expect(isDontKnowAnswer("It's a dog.")).toBe(false);
    expect(isDontKnowAnswer("My name is Yuki.")).toBe(false);
    expect(isDontKnowAnswer("Apples, please.")).toBe(false);
  });
});

describe("buildCorrectiveFeedbackEn", () => {
  it("returns turn-specific English corrective feedback", () => {
    const dogTurn = turn("park", "park-dog");
    expect(buildCorrectiveFeedbackEn(dogTurn)).toContain("It's a dog.");
    expect(buildCorrectiveFeedbackEn("Three, please.")).toBe("Nice try! Say: Three, please.");
  });
});

describe("judgeTalkAnswer", () => {
  it("accepts any phrasing that contains the key words", () => {
    const shop = turn("shop", "shop-want");
    expect(judgeTalkAnswer(shop, "Bananas please")).toBe(true);
    expect(judgeTalkAnswer(shop, "I want an apple.")).toBe(true);
    expect(judgeTalkAnswer(shop, "I'm fine.")).toBe(false);
  });

  it("does not take an unrelated I'm-sentence as a name, but accepts natural 'I'm <Name>'", () => {
    const name = turn("greeting", "greeting-name");
    expect(judgeTalkAnswer(name, "I'm fine")).toBe(false);
    expect(judgeTalkAnswer(name, "I am hungry")).toBe(false);
    expect(judgeTalkAnswer(name, "I'm a cat")).toBe(false);
    expect(judgeTalkAnswer(name, "My name is Sora.")).toBe(true);
    expect(judgeTalkAnswer(name, "I'm Sora!")).toBe(true);
    expect(judgeTalkAnswer(name, "I am Yuki")).toBe(true);
    expect(judgeTalkAnswer(name, "Hello! I'm Yuki.")).toBe(true);
    expect(judgeTalkAnswer(name, "I'm ゆうき")).toBe(true);
  });

  it("accepts Japanese katakana speech and common en-US STT phonetic homophones for kids", () => {
    expect(judgeTalkAnswer(turn("park", "park-dog"), "ドッグ")).toBe(true);
    expect(judgeTalkAnswer(turn("park", "park-dog"), "dock")).toBe(true);
    expect(judgeTalkAnswer(turn("park", "park-ball-color"), "read")).toBe(true);
    expect(judgeTalkAnswer(turn("park", "park-ball-color"), "レッド")).toBe(true);
    expect(judgeTalkAnswer(turn("shop", "shop-how-many"), "tree")).toBe(true);
    expect(judgeTalkAnswer(turn("shop", "shop-how-many"), "free")).toBe(true);
    expect(judgeTalkAnswer(turn("school", "school-pencil"), "ペンシル")).toBe(true);
  });

  it("matches whole words only", () => {
    const morning = turn("school", "school-morning");
    expect(judgeTalkAnswer(morning, "this")).toBe(false);
    expect(judgeTalkAnswer(morning, "Hi!")).toBe(true);
  });

  it("rejects empty answers", () => {
    expect(judgeTalkAnswer(turn("park", "park-dog"), "   ")).toBe(false);
  });

  it("has exactly one correct choice and the model answer passes in every turn", () => {
    for (const scene of TALK_SCENES) {
      for (const t of scene.turns) {
        const passing = t.choices.filter((choice) => judgeTalkAnswer(t, choice));
        expect(passing, t.id).toEqual([t.modelAnswer]);
      }
    }
  });
});

describe("toPublicScene", () => {
  it("does not leak the answer keys to the client", () => {
    const scene = toPublicScene(TALK_SCENES[1]);
    const json = JSON.stringify(scene);
    expect(json).not.toContain("accept");
    expect(json).not.toContain("modelAnswer");
    expect(scene.turns[0].choices).toHaveLength(4);
  });

  it("shuffles choices deterministically so the answer is not always first", () => {
    const first = toPublicScene(TALK_SCENES[0]);
    expect(toPublicScene(TALK_SCENES[0])).toEqual(first);
    const positions = TALK_SCENES.flatMap((scene) =>
      toPublicScene(scene).turns.map((t, index) =>
        t.choices.indexOf(scene.turns[index].modelAnswer),
      ),
    );
    expect(new Set(positions).size).toBeGreaterThan(1);
  });
});
