<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, nextTick } from 'vue'
import { echarts } from '../../utils/echarts'

const props = defineProps<{
  data: { name: string; value: number }[]
  loading?: boolean
  title?: string
}>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chart) return
  
  // Sort data descending and take top 5 if not already
  const sortedData = [...props.data].sort((a, b) => b.value - a.value).slice(0, 5)
  
  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      bottom: 4,
      icon: 'circle',
      itemGap: 20,
      textStyle: {
        color: '#64748B'
      }
    },
    toolbox: {
      feature: {
        saveAsImage: { title: '下载' },
        dataView: { title: '数据视图', readOnly: true }
      },
      iconStyle: {
        borderColor: '#94A3B8'
      }
    },
    series: [
      {
        name: '模型占比',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '42%'],
        itemStyle: {
          borderRadius: 5,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            color: '#1E293B'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        labelLine: {
          show: false
        },
        data: sortedData
      }
    ],
    color: [
      '#0EA5E9', // slate-blue
      '#10B981', // emerald
      '#F59E0B', // amber
      '#8B5CF6', // violet
      '#EC4899', // pink
    ]
  }
  
  chart.setOption(option)
}

watch(() => props.data, () => {
  if (chart) {
    updateChart()
  } else {
    initChart()
  }
}, { deep: true })

onMounted(() => {
  nextTick(() => {
    initChart()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})

const handleResize = () => {
  chart?.resize()
}
</script>

<template>
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-card p-6 border border-slate-100 dark:border-slate-700 h-full flex flex-col min-h-0">
    <h3 class="text-lg font-semibold text-slate-800 dark:text-white mb-4 shrink-0">{{ title || '模型占比 (TOP 5)' }}</h3>
    <div class="w-full flex-1 min-h-[260px]" ref="chartRef"></div>
  </div>
</template>
