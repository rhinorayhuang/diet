<script setup lang="ts">
import {
  CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

// 體重折線圖（PRD 3.7）
const props = defineProps<{
  labels: string[]
  values: number[]
}>()

const colors = useChartColors()

const data = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.values,
    borderColor: colors.value?.primary,
    backgroundColor: colors.value?.primary,
    pointRadius: props.values.length > 30 ? 0 : 3,
    tension: 0.3,
  }],
}))

const options = computed<ChartOptions<'line'>>(() => {
  const c = colors.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: item => `${item.formattedValue} kg` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: c?.text, maxRotation: 0, autoSkipPadding: 8 } },
      y: {
        grace: 1,
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
    <Line v-if="colors" :data="data" :options="options" />
  </div>
</template>
