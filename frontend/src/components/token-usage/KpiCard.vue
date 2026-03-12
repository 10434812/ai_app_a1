<script setup lang="ts">
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { echarts } from '../../utils/echarts'

const props = defineProps<{
  title: string
  value: string | number
  trendData?: number[]
  change?: number // percentage
  changeLabel?: string
  loading?: boolean
  prefix?: string
  suffix?: string
  color?: string
}>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value || !props.trendData || props.trendData.length === 0) return
  
  chart = echarts.init(chartRef.value)
  
  const option = {
    grid: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    xAxis: {
      type: 'category',
      show: false,
      data: props.trendData.map((_, i) => i)
    },
    yAxis: {
      type: 'value',
      show: false,
      min: (value: { min: number }) => value.min * 0.95,
      max: (value: { max: number }) => value.max * 1.05
    },
    series: [
      {
        data: props.trendData,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: props.color || '#0EA5E9',
          width: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: props.color ? `${props.color}33` : 'rgba(14, 165, 233, 0.2)' },
            { offset: 1, color: props.color ? `${props.color}00` : 'rgba(14, 165, 233, 0)' }
          ])
        }
      }
    ]
  }
  
  chart.setOption(option)
}

watch(() => props.trendData, () => {
  if (chart) {
    chart.setOption({
      series: [{ data: props.trendData }]
    })
  } else {
    initChart()
  }
}, { deep: true })

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) {
    chart.dispose()
  }
})

const handleResize = () => {
  chart?.resize()
}

const isPositive = computed(() => (props.change || 0) >= 0)
</script>

<template>
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-card p-6 border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-full transition-all duration-300 hover:shadow-lg">
    <div class="flex justify-between items-start mb-2">
      <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ title }}</h3>
      <div v-if="change !== undefined" class="flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
        :class="isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'">
        <span>{{ isPositive ? '+' : '' }}{{ change }}%</span>
        <span class="ml-1" v-if="changeLabel">{{ changeLabel }}</span>
      </div>
    </div>
    
    <div v-if="loading" class="animate-pulse space-y-3">
      <div class="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
      <div class="h-10 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
    </div>
    
    <div v-else>
      <div class="flex items-baseline gap-1 mb-4">
        <span v-if="prefix" class="text-xl text-slate-500 dark:text-slate-400">{{ prefix }}</span>
        <span class="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{{ value }}</span>
        <span v-if="suffix" class="text-sm text-slate-500 dark:text-slate-400">{{ suffix }}</span>
      </div>
      
      <div v-if="trendData && trendData.length > 0" class="h-12 w-full" ref="chartRef"></div>
    </div>
  </div>
</template>
