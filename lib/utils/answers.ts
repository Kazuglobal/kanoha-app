export function normalizeAnswer(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function answersMatch(submitted: string, expected: string) {
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}
