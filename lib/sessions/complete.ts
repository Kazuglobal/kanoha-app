interface CompleteLearningSessionInput {
  answerCorrect: boolean;
  childId: string;
  durationSeconds: number;
  problemId: string;
  score: number;
  sessionId: string;
  similarProblemCount: number;
}

const jsonRequest = (body: Record<string, unknown>, method = "POST") => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function completeLearningSession(input: CompleteLearningSessionInput) {
  return Promise.allSettled([
    fetch(`/api/sessions/${input.sessionId}`, jsonRequest({
      childId: input.childId,
      totalQuestions: input.similarProblemCount + 1,
      correctCount: input.score + Number(input.answerCorrect),
      durationSeconds: input.durationSeconds,
    }, "PATCH")),
    fetch("/api/reviews/schedule", jsonRequest({
      childId: input.childId,
      problemId: input.problemId,
      similarCorrectCount: input.score,
    })),
    fetch("/api/reports/slack", jsonRequest({ childId: input.childId })),
  ]);
}
