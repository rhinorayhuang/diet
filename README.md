# 飲食記錄

家庭自用的飲食記錄 PWA：拍照或文字記錄每餐，由 Claude 估算熱量與營養素，並產生每日總結。

需求文件：[docs/PRD.md](docs/PRD.md)

## 技術

Nuxt 4（TypeScript、SPA 模式）· Nuxt UI · Supabase（Postgres / Storage / Auth）· Claude API · Vercel

## 目錄

```
app/            前端（頁面、版型、composables）
shared/         前後端共用的型別與純函式（熱量目標計算、台灣時間與餐別）
server/api/     API routes
server/utils/ai AI 供應商介面與 Claude 實作
supabase/       資料庫 migration
```

## 本機開發

需要 Node 22.22.3 以上（見 `.nvmrc`）。

```bash
nvm use
npm install
cp .env.example .env   # 填入 Supabase 與 Anthropic 金鑰
npm run dev
```

## 第一次設定

1. 建立 Supabase 專案，在 SQL Editor 執行 `supabase/migrations/0001_init.sql`。
2. Supabase → Authentication → Providers：關閉「Allow new users to sign up」。
3. Supabase → Authentication → Users：新增家庭帳號（Email + 密碼）。建立帳號時會自動建立家庭資料。
4. 在 Anthropic Console 建立 API key，並設定每月花費上限。
5. 在 Vercel 匯入專案，設定 `.env.example` 中的三個環境變數。
