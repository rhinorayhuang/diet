/** 從 $fetch、Supabase 或一般錯誤中取出給使用者看的訊息 */
export function errorMessage(e: unknown): string {
  const err = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
  return err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? String(e)
}
