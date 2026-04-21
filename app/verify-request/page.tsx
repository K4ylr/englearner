import Link from "next/link";

export const metadata = { title: "查收邮件 · EngLearner" };

export default function VerifyRequestPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto size-12 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center text-2xl">
          ✉️
        </div>
        <h1 className="text-2xl font-semibold">请查收邮件</h1>
        <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
          我们已发送登录链接到你的邮箱。
          <br />
          点击链接即可完成登录（15 分钟内有效）。
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-[var(--color-brand)] hover:underline"
        >
          用其它邮箱登录
        </Link>
      </div>
    </main>
  );
}
