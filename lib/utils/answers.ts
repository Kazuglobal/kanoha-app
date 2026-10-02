import { RUBY_DICTIONARY } from "@/lib/curriculum/rubyDictionary";

export function normalizeAnswer(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function toHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60),
  );
}

export function answersMatch(submitted: string, expected: string) {
  const normSub = normalizeAnswer(submitted);
  const normExp = normalizeAnswer(expected);
  if (normSub === normExp) return true;

  const hiraSub = toHiragana(normSub);
  const hiraExp = toHiragana(normExp);
  if (hiraSub === hiraExp) return true;

  if (RUBY_DICTIONARY[normSub] === normExp || RUBY_DICTIONARY[normSub] === hiraExp) return true;
  if (RUBY_DICTIONARY[normExp] === normSub || RUBY_DICTIONARY[normExp] === hiraSub) return true;

  return false;
}
