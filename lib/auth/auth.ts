import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      parentPinHash: {
        type: "string",
        required: false,
      },
      parentPinFailedAttempts: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      parentPinLockedUntil: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Auth = typeof auth;
