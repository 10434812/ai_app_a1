<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { computed } from 'vue'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps<{
  data: {date: string, count: number}[]
  isDark?: boolean
}>()

const chartData = computed(() => ({
  labels: props.data.map(d => d.date.split('-').slice(1).join('/')), // Show MM/DD
  datasets: [
    {
      label: 'Token 消耗',
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        return gradient;
      },
      borderColor: '#6366f1',
      borderWidth: 2,
      pointBackgroundColor: '#fff',
      pointBorderColor: '#6366f1',
      pointHoverBackgroundColor: '#6366f1',
      pointHoverBorderColor: '#fff',
      fill: true,
      data: props.data.map(d => d.count),
      tension: 0.4
    }
  ]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: props.isDark ? '#1e293b' : '#fff',
      titleColor: props.isDark ? '#e2e8f0' : '#1e293b',
      bodyColor: props.isDark ? '#cbd5e1' : '#475569',
      borderColor: props.isDark ? '#334155' : '#e2e8f0',
      borderWidth: 1,
      padding: 10,
      displayColors: false,
      callbacks: {
        label: (context: any) => `${context.parsed.y} Tokens`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: props.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        drawBorder: false
      },
      ticks: {
        color: props.isDark ? '#64748b' : '#94a3b8',
        font: {
          size: 10
        }
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: props.isDark ? '#64748b' : '#94a3b8',
        font: {
          size: 10
        },
        maxTicksLimit: 7
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}))
</script>

<template>
  <div class="w-full h-full">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
