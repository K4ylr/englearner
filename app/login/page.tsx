import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "@/lib/auth";

export const metadata = { title: "登录 · EngLearner" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  async function submit(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: formData.get("email"),
      redirectTo: "/dashboard",
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm text-[var(--color-fg-muted)]">
            ← 返回
          </Link>
          <h1 className="mt-4 text-2xl font-semibold">登录 EngLearner</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            输入邮箱，我们会发送一次性登录链接
          </p>
        </div>
        <form action={submit} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
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
          继续即表示同意我们将你的邮箱用于登录身份识别。
        </p>
      </div>
    </main>
  );
}
