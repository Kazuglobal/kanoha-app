interface CompleteLearningSessionInput {
  childId: string;
  durationSeconds: number;
  problemId: string;
  score: number;
  sessionId: string;
}

export interface CompleteLearningSessionResult {
  sessionSaved: boolean;
  reviewScheduled: boolean;
  reportSent: boolean;
}

const jsonRequest = (body: Record<string, unknown>, method = "POST") => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const safeFetch = async (input: string, init: RequestInit): Promise<boolean> => {
  try {
    return (await fetch(input, init)).ok;
  } catch {
    return false;
  }
};

/**
 * セッション終了 → 復習予定 → Slack レポートの順に直列で送る。
 * レポートは保存済みの結果から作られるため、前2つを待ってから送る(並列にしない)。
 * 正解数・問題数はサーバーが attempts から導出するので送らない。
 */
export async function completeLearningSession(
  input: CompleteLearningSessionInput,
): Promise<CompleteLearningSessionResult> {
  const sessionSaved = await safeFetch(`/api/sessions/${input.sessionId}`, jsonRequest({
    childId: input.childId,
    durationSeconds: input.durationSeconds,
  }, "PATCH"));
  const reviewScheduled = await safeFetch("/api/reviews/schedule", jsonRequest({
    childId: input.childId,
    problemId: input.problemId,
    similarCorrectCount: input.score,
  }));
  const reportSent = await safeFetch("/api/reports/slack", jsonRequest({ childId: input.childId }));
  return { sessionSaved, reviewScheduled, reportSent };
}
