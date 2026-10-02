import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";

const replace = vi.fn();
const refresh = vi.fn();
const signInEmail = vi.fn();
const signUpEmail = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in and redirects to the parent dashboard", async () => {
    signInEmail.mockResolvedValue({
      data: { user: { id: "test" } },
      error: null,
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "parent@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(signInEmail).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "password123",
    });
    expect(replace).toHaveBeenCalledWith("/parent/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an error message when sign in fails", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { message: "invalid" } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "parent@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("メールアドレスまたはパスワードを確認してください。");
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs up and redirects to the parent dashboard", async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "はじめての方はこちら" }));
    await user.type(screen.getByLabelText("メールアドレス"), "newparent@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(signUpEmail).toHaveBeenCalledWith({
      email: "newparent@example.com",
      password: "password123",
      name: "newparent",
    });
    expect(replace).toHaveBeenCalledWith("/parent/dashboard");
  });
});
