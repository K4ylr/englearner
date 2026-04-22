# EngLearner

> 智能推荐、间隔重复的英语背单词应用。
> Next.js 15 · Auth.js v5 (magic link) · Neon Postgres · Prisma · FSRS。

## 当前进度

**Phase A — 骨架上线 ✅**

- Next.js 15 + TypeScript + Tailwind CSS v4
- Auth.js v5 + Resend 邮箱魔法链接登录
- Prisma + Neon Postgres 数据模型（User / Word / UserWord / ReviewLog / PlacementAnswer / DailySession）
- `ts-fsrs` 间隔重复封装（`lib/fsrs.ts`）
- 首页 / 登录 / 邮件确认 / 仪表盘 页面

**Phase B — 词库 + 学习主循环 ✅**

- 预筛词库 JSON (`data/seed-words.json`)，管理员 API 一次性导入
- FSRS 调度 + `/api/study/next`（新词 1:3 穿插复习）
- `/api/study/review` 提交评分 → `ts-fsrs` 更新下次 due
- 闪卡 UI：有道英美发音、YouGlish 真实语境视频、键盘 1/2/3/4 评分
- Dashboard 显示今日任务数并链接到 `/study`

**Phase C — 个性化**（未开工）

- 自适应水平测评（binary-search freqBand）
- 兴趣方向选择、每日 pace 设置
- 按 CEFR × topic 推荐新词

**Phase D — 打磨**（未开工）

- Dashboard 图表（连续天数、掌握曲线）
- 词表浏览/搜索、键盘快捷键、移动端手势、深色模式

## 本地开发

```bash
pnpm install
cp .env.example .env   # 填入真实值，见下
pnpm prisma migrate dev
pnpm dev
```

打开 http://localhost:3000。

### 环境变量

| 变量 | 来源 |
|---|---|
| `DATABASE_URL` | Neon 控制台 (https://neon.tech) 或 Vercel 集成自动注入 |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_RESEND_KEY` | Resend 控制台 (https://resend.com/api-keys) 免费 3000/月 |
| `EMAIL_FROM` | 邮件发件人。先用 `onboarding@resend.dev` 测试，生产换自己验证过的域名 |
| `ADMIN_SECRET` | 保护 `/api/admin/seed`。`openssl rand -base64 24` 生成 |

## 部署到 Vercel

1. **推送仓库到 GitHub**（已完成）
2. **Vercel 控制台 → New Project → Import** 这个仓库
3. **开通 Neon**：Project → Storage → Create Database → Neon。`DATABASE_URL` 会被自动注入到所有环境
4. **添加其他环境变量**（Settings → Environment Variables）：
   - `AUTH_SECRET`（必填，生产值与本地不同）
   - `AUTH_RESEND_KEY`
   - `EMAIL_FROM`
5. **Build Command** 保持默认 `pnpm build`（`package.json` 里的 `build` 脚本已经包含 `prisma generate && next build`）
6. **首次部署后**，在本地对 Neon 执行一次 migrate：
   ```bash
   DATABASE_URL="<production-url>" pnpm prisma migrate deploy
   ```
   或者把 build 命令改成 `pnpm prisma migrate deploy && pnpm build`。
7. 访问部署后的域名 → `/login` → 输入邮箱 → 查收登录链接 → 进入 `/dashboard` ✅

### 首次导入词库（Phase B 上线后一次性）

Redeploy 完成后调一次 admin seed 接口：

```bash
curl -X POST -H "x-admin-secret: $ADMIN_SECRET" \
  https://<your-domain>/api/admin/seed
```

返回 `{ "inserted": N, "total": N }` 即完成。Dashboard 上"词库总量"
会显示数字，"开始学习"按钮变为可用。

如需重新导入（会清空所有用户学习记录）：

```bash
curl -X DELETE -H "x-admin-secret: $ADMIN_SECRET" \
  https://<your-domain>/api/admin/seed
curl -X POST  -H "x-admin-secret: $ADMIN_SECRET" \
  https://<your-domain>/api/admin/seed
```

### 验证清单

- [ ] 登录 → 跳到 `/dashboard`
- [ ] Dashboard 显示"词库总量"有数值
- [ ] 点"开始学习"进入 `/study`，显示闪卡
- [ ] 按 **Space** 翻面，按 **1/2/3/4** 评分
- [ ] 点击 **US/UK** 按钮能听到有道发音
- [ ] 点击"听真人怎么说"嵌入 YouGlish 视频
- [ ] 回仪表盘后，"今日已学"计数增加

## 技术选型说明

| 需求 | 选择 | 替代方案 | 取舍 |
|---|---|---|---|
| 框架 | Next.js 15 App Router | Remix / Astro | Vercel 一等公民，Server Actions 简化认证 |
| 认证 | Auth.js v5 Resend | NextAuth + 自己的邮件服务 | Resend 免费 3k/月，无需自建 SMTP |
| 数据库 | Neon Postgres | Supabase / Turso | Vercel 官方集成一键接入 |
| ORM | Prisma | Drizzle | 团队熟悉度高，schema DSL 清晰 |
| 间隔重复 | FSRS (`ts-fsrs`) | SM-2 | 现代数据驱动算法，比 SM-2 省约 20% 时间达到同等留存 |
| 词库 | ECDICT (MIT) | 手工维护 | 开箱含中英翻译 + 词频 + CET/Collins/Oxford 标签 |
| 发音 | 有道 CDN | 自建 TTS | 免费、稳定、英美音齐全 |
| 例句 | dictionaryapi.dev | 付费 API | 免费无 key，构建时缓存入 DB |
| 视频 | YouGlish widget | YouTube API | 无需 API key，真实语境发音 |

## 许可

私有项目。
