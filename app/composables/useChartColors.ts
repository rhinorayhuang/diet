// Chart.js 畫在 canvas 上，讀不到 CSS 變數，所以把 Nuxt UI 的顏色解析成實際色碼，並跟著深淺色模式更新
const TOKENS = {
  primary: '--ui-primary',
  warning: '--ui-warning',
  text: '--ui-text-muted',
  grid: '--ui-border',
} as const

type ChartColors = Record<keyof typeof TOKENS, string>

function resolve(variable: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

export function useChartColors() {
  const colorMode = useColorMode()
  const colors = ref<ChartColors | null>(null)

  function update() {
    colors.value = Object.fromEntries(
      Object.entries(TOKENS).map(([key, variable]) => [key, resolve(variable)]),
    ) as ChartColors
  }

  onMounted(update)
  // 切換模式後要等 class 套用到 <html> 才讀得到新顏色
  watch(() => colorMode.value, () => nextTick(update))

  return colors
}
