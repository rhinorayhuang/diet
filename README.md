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
5. 部署到 Vercel（見下一節）。

## 部署到 Vercel

Vercel 會自動偵測 Nuxt，不需要額外設定；Node 版本由 `package.json` 的 `engines` 指定為 22。

1. 到 [vercel.com/new](https://vercel.com/new) 用 GitHub 登入，匯入 `rhinorayhuang/diet`。
2. Framework Preset 保持 **Nuxt.js**，Build／Output 設定都用預設值。
3. 在 **Environment Variables** 加入三個變數（值和本機 `.env` 相同）：
   - `NUXT_PUBLIC_SUPABASE_URL`
   - `NUXT_PUBLIC_SUPABASE_KEY`
   - `NUXT_ANTHROPIC_API_KEY`
4. 按 **Deploy**。之後每次推到 `main` 都會自動重新部署。
5. （選用）Supabase → Authentication → URL Configuration：把 **Site URL** 改成 Vercel 網址，日後使用密碼重設信件時才會導回正確網址。

部署完成後用手機開啟網址並登入，在 Safari「分享 → 加入主畫面」（iOS）或 Chrome「安裝應用程式」（Android）即可當成 App 使用。
