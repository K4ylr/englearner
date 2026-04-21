import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 text-sm text-[var(--color-fg-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-3 py-1">
          <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
          FSRS 算法 · 智能推荐 · 间隔重复
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight">
          背你真正需要的
          <br />
          <span className="text-[var(--color-brand)]">英语单词</span>
        </h1>
        <p className="text-lg text-[var(--color-fg-muted)] max-w-xl mx-auto leading-relaxed">
          根据你当前的词汇量和感兴趣的领域智能推荐单词。
          新词与复习自动穿插，让记忆真正牢靠。
        </p>
        <div className="flex items-center justify-center gap-3">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-brand)] px-6 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] transition"
            >
              进入学习 →
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-brand)] px-6 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] transition"
            >
              邮箱登录开始
            </Link>
          )}
        </div>
        <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Feature
            title="自适应测评"
            body="60 秒测出你的词汇量，推荐不再是随机瞎背。"
          />
          <Feature
            title="常用为主"
            body="基于 BNC/COCA 词频，只学你真正会用到的词。"
          />
          <Feature
            title="真实语境"
            body="例句、中英释义、YouGlish 视频，听真人怎么用。"
          />
        </div>
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="font-medium mb-1">{title}</div>
      <div className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
        {body}
      </div>
    </div>
  );
}
