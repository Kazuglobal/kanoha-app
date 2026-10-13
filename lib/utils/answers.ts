import { RUBY_DICTIONARY } from "@/lib/curriculum/rubyDictionary";

export function normalizeAnswer(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function toHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60),
  );
}

/**
 * 単位および助数詞の同義語マッピング
 */
const UNIT_MAP: Record<string, string> = {
  // 体積・かさ
  "ミリリットル": "ml",
  "みりりっとる": "ml",
  "ミリ": "ml",
  "みり": "ml",
  "ml": "ml",
  "デシリットル": "dl",
  "でしりっとる": "dl",
  "デシ": "dl",
  "でし": "dl",
  "dl": "dl",
  "リットル": "l",
  "りっとる": "l",
  "l": "l",
  // 長さ
  "センチメートル": "cm",
  "せんちめーとる": "cm",
  "センチ": "cm",
  "せんち": "cm",
  "cm": "cm",
  "ミリメートル": "mm",
  "みりめーとる": "mm",
  "mm": "mm",
  "メートル": "m",
  "めーとる": "m",
  "m": "m",
  "キロメートル": "km",
  "きろめーとる": "km",
  "km": "km",
  // 重さ
  "キログラム": "kg",
  "きろぐらむ": "kg",
  "kg": "kg",
  "グラム": "g",
  "ぐらむ": "g",
  "g": "g",
  // 時間
  "時": "時",
  "じ": "時",
  "分": "分",
  "ふん": "分",
  "ぷん": "分",
  "秒": "秒",
  "びょう": "秒",
  // 助数詞
  "個": "こ",
  "こ": "こ",
  "枚": "まい",
  "まい": "まい",
  "本": "ほん",
  "ほん": "ほん",
  "匹": "ひき",
  "ひき": "ひき",
  "人": "人",
  "にん": "人",
  "つ": "つ",
  "羽": "わ",
  "わ": "わ",
  "台": "だい",
  "だい": "だい",
  "冊": "さつ",
  "さつ": "さつ",
  "回": "かい",
  "かい": "かい",
  "点": "点",
  "てん": "点",
  "円": "円",
  "えん": "円",
};

/**
 * 漢数字（一〜九十九、百、千）をアラビア数字文字列に変換
 */
export function kanjiDigitsToNumber(str: string): string {
  if (!str) return str;
  if (/^\d+$/.test(str)) return str;

  const digitMap: Record<string, number> = {
    "〇": 0, "零": 0,
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9,
  };

  if (!/^[〇零一二三四五六七八九十百千]+$/.test(str)) {
    return str;
  }

  let total = 0;
  let current = 0;

  for (const char of str) {
    if (char in digitMap) {
      current = digitMap[char];
    } else if (char === "十") {
      total += (current === 0 ? 1 : current) * 10;
      current = 0;
    } else if (char === "百") {
      total += (current === 0 ? 1 : current) * 100;
      current = 0;
    } else if (char === "千") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
    }
  }
  total += current;
  return String(total);
}

/**
 * ひらがな数詞（ぜろ〜きゅうじゅうきゅう、ひゃく、せん）をアラビア数字文字列に変換
 */
export function hiraganaDigitsToNumber(str: string): string {
  if (!str) return str;
  if (/^\d+$/.test(str)) return str;

  const singles: Record<string, number> = {
    "ぜろ": 0, "れい": 0,
    "いち": 1, "に": 2, "さん": 3, "よん": 4, "し": 4, "ご": 5,
    "ろく": 6, "なな": 7, "しち": 7, "はち": 8, "きゅう": 9, "く": 9,
  };

  if (str in singles) return String(singles[str]);

  // 10〜99の合成
  // パターン: (数字)? じゅう (数字)?
  const jyuMatch = str.match(/^(?:(いち|に|さん|よん|し|ご|ろく|なな|しち|はち|きゅう|く))?じゅう(?:(いち|に|さん|よん|し|ご|ろく|なな|しち|はち|きゅう|く))?$/);
  if (jyuMatch) {
    const tens = jyuMatch[1] ? singles[jyuMatch[1]] : 1;
    const ones = jyuMatch[2] ? singles[jyuMatch[2]] : 0;
    return String(tens * 10 + ones);
  }

  // 100
  if (str === "ひゃく") return "100";
  // 1000
  if (str === "せん") return "1000";

  return str;
}

/**
 * 音声認識や話し言葉にありがちなプレフィックス・サフィックスを除去
 */
export function stripSpeechFillers(str: string): string {
  let cleaned = str.trim();
  cleaned = cleaned.replace(/^(?:こたえは|答えは|こたえ|答え|それは|えーと|あの)[：:\s]*/i, "");
  cleaned = cleaned.replace(/(?:です|でした|だよ|だね|だ|とおもいます|と思います)[。！!？\?]*$/, "");
  return cleaned.trim();
}

/**
 * 単一の「数値＋単位」（例: "1000mL", "43こ", "100", "さんこ", "三個"）を分解
 */
function parseSingleNumberWithUnit(val: string): { num: string; unit: string } | null {
  const norm = normalizeAnswer(val);

  // 1. 半角数字 + 単位
  const directMatch = norm.match(/^(\d+(?:\.\d+)?)([a-zぁ-んァ-ヶ一-龠]*)$/);
  if (directMatch) {
    const num = directMatch[1];
    const rawUnit = directMatch[2];
    const normalizedUnit = rawUnit ? (UNIT_MAP[rawUnit] || rawUnit) : "";
    return { num, unit: normalizedUnit };
  }

  // 2. 漢数字 + 単位（例: "三個", "十二人", "三"）
  const kanjiMatch = norm.match(/^([〇零一二三四五六七八九十百千]+)([a-zぁ-んァ-ヶ一-龠]*)$/);
  if (kanjiMatch) {
    const converted = kanjiDigitsToNumber(kanjiMatch[1]);
    if (/^\d+$/.test(converted)) {
      const rawUnit = kanjiMatch[2];
      const normalizedUnit = rawUnit ? (UNIT_MAP[rawUnit] || rawUnit) : "";
      return { num: converted, unit: normalizedUnit };
    }
  }

  // 3. ひらがな数詞 + 単位（例: "さんこ", "じゅうにまい", "さん"）
  // 単位候補がUNIT_MAPにあればそれを引き、残りをひらがな数字として判定
  for (const [unitKey, canonical] of Object.entries(UNIT_MAP)) {
    if (norm.endsWith(unitKey)) {
      const prefix = norm.slice(0, -unitKey.length);
      const converted = hiraganaDigitsToNumber(prefix);
      if (/^\d+$/.test(converted)) {
        return { num: converted, unit: canonical };
      }
    }
  }

  // 単位なしのひらがな数詞（例: "さん", "じゅうに"）
  const hiraConverted = hiraganaDigitsToNumber(norm);
  if (/^\d+$/.test(hiraConverted)) {
    return { num: hiraConverted, unit: "" };
  }

  return null;
}

/**
 * 複合単位（例: "3L7dL", "3時45分"）内の単位表記を統一
 */
function normalizeUnitsInString(str: string): string {
  let res = str;
  const sortedKeys = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const canonical = UNIT_MAP[key];
    if (key !== canonical) {
      res = res.replaceAll(key, canonical);
    }
  }
  return res;
}

const RUBY_KEYS_BY_LENGTH = Object.keys(RUBY_DICTIONARY).sort((a, b) => b.length - a.length);

/** 答えの前後につけがちな かっこ・句読点(「ひくい」/ ひくい。)を落とす */
function stripPunctuation(str: string): string {
  return str.replace(/[「」『』()（）［］\[\]【】。、,.!?！？・〜~"'“”‘’]/g, "");
}

/** 漢字を辞書の読みに最長一致で置き換えて、ひらがなに揃える(低い → ひくい) */
export function toReading(str: string): string {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const key = RUBY_KEYS_BY_LENGTH.find((k) => str.startsWith(k, i));
    out += key ? RUBY_DICTIONARY[key] : str[i];
    i += key ? key.length : 1;
  }
  return toHiragana(out);
}

/** 「低い（ひくい）」のように読みが添えてある正解は、どちらの書き方も正解にする */
function expectedVariants(expected: string): string[] {
  const match = expected.normalize("NFKC").match(/^(.+?)\((.+?)\)$/);
  return match ? [expected, match[1], match[2]] : [expected];
}

export function answersMatch(submitted: string, expected: string): boolean {
  if (!submitted || !expected) return false;

  // 話し言葉のフィラー（「こたえは3です」「あおぞらです」等）を除去した候補も試す
  const subCandidate = stripSpeechFillers(submitted);
  const variants = expectedVariants(expected);

  return variants.some((variant) => matchesSingle(submitted, variant) || (subCandidate !== submitted && matchesSingle(subCandidate, variant)));
}

/** 分数の書き方をそろえる(1/4・4ぶんの1 → 4分の1)。stripPunctuation より先に呼ぶ。 */
function toFractionForm(str: string): string {
  return str.replace(/^(\d+)\/(\d+)$/, "$2分の$1").replace(/(\d+)ぶんの(\d+)/, "$1分の$2");
}

function matchesSingle(submitted: string, expected: string): boolean {
  if (strictMatch(submitted, expected)) return true;

  const cleanSub = stripPunctuation(toFractionForm(normalizeAnswer(submitted)));
  const cleanExp = stripPunctuation(toFractionForm(normalizeAnswer(expected)));
  if (!cleanSub || !cleanExp) return false;
  if (strictMatch(cleanSub, cleanExp)) return true;

  // 5. 送りがな つきの漢字も読みで照合(低い ⇔ ひくい、友だち ⇔ ともだち)
  return toReading(cleanSub) === toReading(cleanExp);
}

function strictMatch(submitted: string, expected: string): boolean {
  const normSub = normalizeAnswer(submitted);
  const normExp = normalizeAnswer(expected);
  if (normSub === normExp) return true;

  // 1. ひらがな・カタカナ同一視
  const hiraSub = toHiragana(normSub);
  const hiraExp = toHiragana(normExp);
  if (hiraSub === hiraExp) return true;

  // 2. 単一数値＋単位（または単位なし数値）の照合
  // 子どもが「1000」とだけ入力しても「1000mL」と正解照合できる
  const subNum = parseSingleNumberWithUnit(normSub);
  const expNum = parseSingleNumberWithUnit(normExp);
  if (subNum && expNum && subNum.num === expNum.num) {
    if (!subNum.unit || !expNum.unit || subNum.unit === expNum.unit) {
      return true;
    }
  }

  // 3. 単位の正規化後の直接比較 (複合単位 3L7dL, 3時45分 等)
  const unitNormSub = normalizeUnitsInString(normSub).replace(/^(\d+):(\d+)$/, "$1時$2分");
  const unitNormExp = normalizeUnitsInString(normExp).replace(/^(\d+):(\d+)$/, "$1時$2分");
  if (unitNormSub === unitNormExp) return true;

  const hiraUnitSub = toHiragana(unitNormSub);
  const hiraUnitExp = toHiragana(unitNormExp);
  if (hiraUnitSub === hiraUnitExp) return true;

  // 4. ルビ辞書（漢字・ひらがな相互変換）
  if (RUBY_DICTIONARY[normSub] === normExp || RUBY_DICTIONARY[normSub] === hiraExp) return true;
  if (RUBY_DICTIONARY[normExp] === normSub || RUBY_DICTIONARY[normExp] === hiraSub) return true;
  if (RUBY_DICTIONARY[hiraSub] === normExp || RUBY_DICTIONARY[hiraSub] === hiraExp) return true;
  if (RUBY_DICTIONARY[hiraExp] === normSub || RUBY_DICTIONARY[hiraExp] === hiraSub) return true;

  return false;
}
