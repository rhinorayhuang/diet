<script setup lang="ts">
import {
  BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions, type Plugin,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

// 每日熱量長條圖，虛線為目標（PRD 3.7）
const props = defineProps<{
  labels: string[]
  values: (number | null)[]
  target: number | null
}>()

const colors = useChartColors()

// 以虛線畫出目標熱量
const targetLine: Plugin<'bar'> = {
  id: 'targetLine',
  afterDatasetsDraw(chart) {
    const target = props.target
    if (target == null || !colors.value) return
    const { ctx, chartArea, scales } = chart
    const y = scales.y!.getPixelForValue(target)
    ctx.save()
    ctx.strokeStyle = colors.value.text
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y)
    ctx.lineTo(chartArea.right, y)
    ctx.stroke()
    ctx.restore()
  },
}

const data = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.values,
    backgroundColor: props.values.map(v =>
      props.target != null && (v ?? 0) > props.target ? colors.value?.warning : colors.value?.primary,
    ),
    borderRadius: 4,
    maxBarThickness: 28,
  }],
}))

const options = computed<ChartOptions<'bar'>>(() => {
  const c = colors.value
  const max = Math.max(props.target ?? 0, ...props.values.map(v => v ?? 0))
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: item => `${item.formattedValue} kcal` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: c?.text, maxRotation: 0, autoSkipPadding: 8 } },
      y: {
        beginAtZero: true,
        suggestedMax: Math.ceil((max * 1.1) / 100) * 100,
        grid: { color: c?.grid },
        border: { display: false },
        ticks: { color: c?.text, maxTicksLimit: 5 },
      },
    },
  }
})
</script>

<template>
  <div class="h-48">
    <Bar v-if="colors" :data="data" :options="options" :plugins="[targetLine]" />
  </div>
</template>
