import { headers } from "next/headers";
import { auth } from "./auth";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  parentPinHash?: string | null;
  parentPinFailedAttempts: number;
  parentPinLockedUntil?: string | null;
}

export interface AppSession {
  user: AppUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

/**
 * サーバー側で現在の Better Auth セッションを取得
 */
export const getServerSession = async (): Promise<AppSession | null> => {
  try {
    const headerList = await headers();
    const session = await auth.api.getSession({
      headers: headerList,
    });
    if (!session?.user) return null;
    return session as unknown as AppSession;
  } catch {
    return null;
  }
};

/**
 * 認証必須のサーバー関数ヘルパー
 */
export const requireServerSession = async (): Promise<AppSession> => {
  const session = await getServerSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
};
