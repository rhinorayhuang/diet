import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { AiModel } from '#shared/types/domain'
import {
  AiRefusalError,
  type AiProvider,
  type AiUsage,
  type DailySummaryInput,
  type RecognizedItem,
} from './provider'

const ItemSchema = z.object({
  name: z.string().describe('食物名稱，繁體中文'),
  portion: z.string().describe('份量描述，例如「1 碗（約 200g）」'),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})
const ItemsSchema = z.object({ items: z.array(ItemSchema) })

type RawItem = z.infer<typeof ItemSchema>

const RECOGNIZE_SYSTEM = `你是營養估算助理。根據使用者提供的餐點照片或文字描述，列出每一樣食物，估算份量、熱量（kcal）與蛋白質、碳水、脂肪（g）。
- 以台灣常見的食物與份量為基準。
- 一道菜如果有明顯分開的組成（例如便當的主菜、配菜、白飯），分成多個品項。
- 使用者的文字補充（例如「飯只吃一半」）優先於照片判斷。
- 名稱與份量描述一律使用繁體中文。
- 數值四捨五入到整數。`

const SUMMARY_SYSTEM = `你是一位友善的營養師，為使用者撰寫當天的飲食總結。
- 使用繁體中文，口吻友善、不說教。
- 內容依序包含：當日攝取和目標的比較（熱量、蛋白質、碳水、脂肪）、飲食評語（優點與可改善之處）、明天的具體建議。
- 參考最近 7 天的攝取與體重趨勢，但重點放在當天。
- 篇幅控制在手機一個畫面內（約 200–300 字）。
- 畫面只顯示純文字：不要使用 Markdown（#、**、表格等），以空行分段、「・」列點，可以用少量 emoji。
- 不要寫標題或日期，直接開始內容。`

function toItem(raw: RawItem): RecognizedItem {
  return {
    name: raw.name,
    portion: raw.portion,
    kcal: Math.round(raw.kcal),
    proteinG: Math.round(raw.protein_g),
    carbsG: Math.round(raw.carbs_g),
    fatG: Math.round(raw.fat_g),
  }
}

export function createClaudeProvider(apiKey: string, model: AiModel): AiProvider {
  const client = new Anthropic({ apiKey })

  // Haiku 5.5 不支援 server-side fallback
  const fallbackParams = model === 'claude-haiku-5-5'
    ? {}
    : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

  function usageOf(message: Anthropic.Beta.BetaMessage): AiUsage {
    return {
      model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }
  }

  function assertNotRefused(message: Anthropic.Beta.BetaMessage) {
    if (message.stop_reason === 'refusal') {
      throw new AiRefusalError(message.stop_details?.explanation ?? 'AI 拒絕處理此請求')
    }
  }

  function dietNoteLine(dietNote?: string | null) {
    return dietNote ? `\n使用者的飲食備註：${dietNote}` : ''
  }

  return {
    async recognizeMeal({ images, text, dietNote }) {
      const content: Anthropic.Beta.BetaContentBlockParam[] = images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.data },
      }))
      content.push({
        type: 'text',
        text: (text ? `使用者描述／補充：${text}` : '請辨識照片中的餐點。') + dietNoteLine(dietNote),
      })

      const message = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        system: RECOGNIZE_SYSTEM,
        output_config: { effort: 'medium', format: betaZodOutputFormat(ItemsSchema) },
        messages: [{ role: 'user', content }],
        ...fallbackParams,
      })
      assertNotRefused(message)
      return { items: (message.parsed_output?.items ?? []).map(toItem), usage: usageOf(message) }
    },

    async reestimateItem({ name, portion, dietNote }) {
      const message = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        system: RECOGNIZE_SYSTEM,
        output_config: { effort: 'low', format: betaZodOutputFormat(ItemSchema) },
        messages: [{
          role: 'user',
          content: `請只估算這一項食物：${name}，份量：${portion}${dietNoteLine(dietNote)}`,
        }],
        ...fallbackParams,
      })
      assertNotRefused(message)
      if (!message.parsed_output) throw new Error('AI 回傳格式錯誤')
      return { item: toItem(message.parsed_output), usage: usageOf(message) }
    },

    async dailySummary(input: DailySummaryInput) {
      const message = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: SUMMARY_SYSTEM,
        output_config: { effort: 'medium' },
        messages: [{
          role: 'user',
          content: `以下是使用者 ${input.date} 的資料（JSON）：\n${JSON.stringify(input, null, 2)}`,
        }],
        ...fallbackParams,
      })
      assertNotRefused(message)
      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim()
      return { text, usage: usageOf(message) }
    },
  }
}
