import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";

const replace = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword, signUp },
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in and redirects to the parent dashboard", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test" } },
      error: null,
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "parent@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "password123",
    });
    expect(replace).toHaveBeenCalledWith("/parent/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a confirmation message when signup requires email verification", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "はじめての方はこちら" }));
    await user.type(screen.getByLabelText("メールアドレス"), "parent@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByRole("status")).toHaveTextContent("確認メールを送りました");
    expect(replace).not.toHaveBeenCalled();
  });
});
