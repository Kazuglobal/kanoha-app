import { z } from "zod";
import { DEFAULT_EQUIPPED } from "@/lib/rewards/catalog";
import {
  REWARD_CYCLE,
  YEN_PER_CYCLE,
  canEquip,
  normalizeEquipped,
  normalizeRewardState,
} from "@/lib/rewards/rewardLogic";
import {
  importLegacyRewards,
  loadChildRewards,
  saveEquippedAccessories,
} from "@/lib/rewards/serverRewards";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { uuid } from "@/lib/utils/schemas";

/**
 * 子どものごほうび(5円メーター・累計正解数)と着せかえ。
 * GET: 読む / PATCH: 着せかえを1つ変える / POST: 旧端末(localStorage)のデータを1回だけ取り込む。
 * 正解数を増やすのは /api/attempts だけ。
 */

type RouteContext = { params: Promise<{ id: string }> };

const category = z.enum([
  "hat",
  "glasses",
  "gloves",
  "clothes",
  "hairstyle",
  "hair_color",
  "shoes",
  "shoes_color",
  "accessory",
]);
const equipInput = z.object({ category, itemId: z.string().trim().min(1).max(64) });

/** 取り込みの上限: これより多い正解数は旧データとして不自然なので受け付けない。 */
const MAX_IMPORT_CORRECT = 5000;
const importInput = z.object({
  reward: z.object({
    currentCycleCount: z.number().int().min(0).max(REWARD_CYCLE - 1),
    totalCorrectCount: z.number().int().min(0).max(MAX_IMPORT_CORRECT),
    totalRewardYen: z.number().int().min(0),
    lastRewardEarnedAt: z.string().max(40).optional(),
  }),
  equipped: z.record(z.string(), z.unknown()).optional(),
});

async function authorize(context: RouteContext, action: string, limit: number) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return { id, response: apiError("Invalid child profile") };
  const auth = await requireOwnedChild(id);
  if (auth.response) return { id, response: auth.response };
  if (!(await checkRateLimitDb(auth.user!.id, action, limit))) {
    return { id, response: apiError("Too many requests", 429) };
  }
  return { id, db: auth.db, response: null };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) return apiError("Invalid child profile");
  const auth = await requireOwnedChild(id);
  if (auth.response) return auth.response;
  try {
    return apiSuccess(await loadChildRewards(auth.db, id));
  } catch {
    return internalError();
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = await parseJson(request, equipInput);
  if (!parsed.success) return apiError("Invalid accessory");
  const auth = await authorize(context, "rewards", 60);
  if (auth.response) return auth.response;

  try {
    const current = await loadChildRewards(auth.db, auth.id);
    const { category: slot, itemId } = parsed.data;
    if (!canEquip(slot, itemId, current.reward.totalCorrectCount)) return apiError("Invalid accessory");
    const equipped = { ...current.equipped, [slot]: itemId };
    await saveEquippedAccessories(auth.db, auth.id, equipped);
    return apiSuccess({ ...current, equipped, stored: true });
  } catch {
    return internalError();
  }
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = await parseJson(request, importInput);
  if (!parsed.success) return apiError("Invalid rewards");
  const auth = await authorize(context, "rewards-import", 5);
  if (auth.response) return auth.response;

  const base = normalizeRewardState(parsed.data.reward);
  // 金額は正解数から作れる分まで(10問で5円)
  const maxYen = Math.floor(base.totalCorrectCount / REWARD_CYCLE) * YEN_PER_CYCLE;
  const reward = { ...base, totalRewardYen: Math.min(base.totalRewardYen, maxYen) };
  const requested = normalizeEquipped(parsed.data.equipped ?? DEFAULT_EQUIPPED);
  const equipped = normalizeEquipped(
    Object.fromEntries(
      Object.entries(requested).filter(([slot, itemId]) =>
        canEquip(slot as z.infer<typeof category>, itemId, reward.totalCorrectCount),
      ),
    ),
  );

  try {
    const imported = await importLegacyRewards(auth.db, auth.id, reward, equipped);
    const current = await loadChildRewards(auth.db, auth.id);
    return apiSuccess({ ...current, imported });
  } catch {
    return internalError();
  }
}
