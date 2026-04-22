import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn, enabledProviderIds } from "@/lib/auth";
import { Github } from "lucide-react";

export const metadata = { title: "登录 · EngLearner" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  async function submitEmail(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: formData.get("email"),
      redirectTo: "/dashboard",
    });
  }

  async function loginGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  async function loginGithub() {
    "use server";
    await signIn("github", { redirectTo: "/dashboard" });
  }

  const hasGoogle = enabledProviderIds.includes("google");
  const hasGithub = enabledProviderIds.includes("github");
  const hasOAuth = hasGoogle || hasGithub;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm text-[var(--color-fg-muted)]">
            ← 返回
          </Link>
          <h1 className="mt-4 text-2xl font-semibold">登录 EngLearner</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            选择一种方式登录，学习进度会跨设备同步
          </p>
        </div>

        {hasOAuth && (
          <div className="space-y-2">
            {hasGoogle && (
              <form action={loginGoogle}>
                <button
                  type="submit"
                  className="w-full h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-border)] transition flex items-center justify-center gap-3"
                >
                  <GoogleIcon />
                  使用 Google 登录
                </button>
              </form>
            )}
            {hasGithub && (
              <form action={loginGithub}>
                <button
                  type="submit"
                  className="w-full h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-border)] transition flex items-center justify-center gap-3"
                >
                  <Github className="size-4" />
                  使用 GitHub 登录
                </button>
              </form>
            )}
          </div>
        )}

        {hasOAuth && (
          <div className="flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            或使用邮箱
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
        )}

        <form action={submitEmail} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus={!hasOAuth}
            className="w-full h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 outline-none focus:border-[var(--color-brand)] transition"
          />
          <button
            type="submit"
            className="w-full h-11 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-hover)] transition"
          >
            发送登录链接
          </button>
        </form>

        <p className="text-center text-xs text-[var(--color-fg-muted)] leading-relaxed">
          继续即表示同意将你的邮箱用于登录身份识别。
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.333z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
