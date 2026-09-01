export interface AiDailyUsage {
  calls: number;
  costUsd: number;
}

export interface AiCostRequest {
  estimatedCostUsd: number;
}

export interface AiCostLimits {
  dailyCallLimit: number;
  dailyCostLimitUsd: number;
}

export type AiCostDecision =
  | {
      allowed: true;
      projectedCalls: number;
      projectedCostUsd: number;
      reason?: undefined;
    }
  | {
      allowed: false;
      projectedCalls: number;
      projectedCostUsd: number;
      reason: "daily_call_limit" | "daily_cost_limit";
    };

const assertNonNegative = (name: string, value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }
};

export const checkAiCost = (
  usage: AiDailyUsage,
  request: AiCostRequest,
  limits: AiCostLimits,
): AiCostDecision => {
  assertNonNegative("calls", usage.calls);
  assertNonNegative("costUsd", usage.costUsd);
  assertNonNegative("estimatedCostUsd", request.estimatedCostUsd);
  assertNonNegative("dailyCallLimit", limits.dailyCallLimit);
  assertNonNegative("dailyCostLimitUsd", limits.dailyCostLimitUsd);

  const projectedCalls = usage.calls + 1;
  const projectedCostUsd =
    Math.round((usage.costUsd + request.estimatedCostUsd) * 1_000_000) / 1_000_000;

  if (projectedCalls > limits.dailyCallLimit) {
    return { allowed: false, projectedCalls, projectedCostUsd, reason: "daily_call_limit" };
  }
  if (projectedCostUsd > limits.dailyCostLimitUsd) {
    return { allowed: false, projectedCalls, projectedCostUsd, reason: "daily_cost_limit" };
  }
  return { allowed: true, projectedCalls, projectedCostUsd };
};

export const costLimitsFromEnv = (
  env: Record<string, string | undefined> = process.env,
): AiCostLimits => ({
  dailyCallLimit: Number(env.AI_DAILY_CALL_LIMIT ?? 100),
  dailyCostLimitUsd: Number(env.AI_DAILY_COST_LIMIT_USD ?? 2),
});
