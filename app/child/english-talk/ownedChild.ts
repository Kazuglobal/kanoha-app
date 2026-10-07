import { getServerSession } from "@/lib/auth/session";
import { ownsChild } from "@/lib/utils/api";

const UUID = /^[0-9a-f-]{36}$/i;

/** クエリの childId は、ログイン中の親が持っている子どものときだけ使う(それ以外はデモ扱い)。 */
export async function resolveOwnedChildId(childId?: string): Promise<string | undefined> {
  if (!childId || !UUID.test(childId)) return undefined;
  const session = await getServerSession();
  if (!session?.user) return undefined;
  return (await ownsChild(session.user.id, childId)) ? childId : undefined;
}
