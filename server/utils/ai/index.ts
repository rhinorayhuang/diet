import type { AiModel } from '#shared/types/domain'
import { createClaudeProvider } from './claude'
import type { AiProvider } from './provider'

export function useAiProvider(model: AiModel): AiProvider {
  const { anthropicApiKey } = useRuntimeConfig()
  if (!anthropicApiKey) {
    throw createError({ statusCode: 500, statusMessage: '尚未設定 NUXT_ANTHROPIC_API_KEY' })
  }
  return createClaudeProvider(anthropicApiKey, model)
}
