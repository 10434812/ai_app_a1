<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, nextTick } from 'vue'
import { echarts } from '../../utils/echarts'
import type { CallbackDataParams } from 'echarts/types/dist/shared'

const props = defineProps<{
  data: { date: string; value: number; name?: string }[]
  loading?: boolean
  title?: string
  dimension?: 'user' | 'model'
}>()

const emit = defineEmits(['update:dimension'])

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const readAxisTooltipPoint = (params: CallbackDataParams[] | CallbackDataParams) => {
  const point = Array.isArray(params) ? params[0] : params
  const axisValue = typeof point.axisValue === 'string' ? point.axisValue : String(point.axisValue ?? '')
  const rawValue = Array.isArray(point.value) ? point.value[1] ?? point.value[0] : point.value
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)

  return {
    axisValue,
    value: Number.isFinite(value) ? value : 0,
  }
}

const initChart = () => {
  if (!chartRef.value) return
  
  chart = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chart) return
  
  const dates = [...new Set(props.data.map(item => item.date))]
  // Simple aggregation if needed, or just mapping
  // Assuming props.data is already aggregated by date for the current dimension
  
  const values = props.data.map(item => item.value)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#E2E8F0',
      textStyle: {
        color: '#1E293B'
      },
      formatter: (params: CallbackDataParams[] | CallbackDataParams) => {
        const {axisValue, value} = readAxisTooltipPoint(params)
        return `<div class="font-medium text-slate-800">${axisValue}</div>
                <div class="text-primary-600 font-bold">${value.toLocaleString()} Tokens</div>`
      }
    },
    grid: {
      left: '4%',
      right: '4%',
      top: 36,
      bottom: 32,
      containLabel: true
    },
    toolbox: {
      feature: {
        saveAsImage: { title: '下载' },
        restore: { title: '还原' },
        dataView: { title: '数据视图', readOnly: true }
      },
      iconStyle: {
        borderColor: '#94A3B8'
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: {
        lineStyle: { color: '#CBD5E1' }
      },
      axisLabel: {
        color: '#64748B',
        formatter: (value: string) => value?.slice?.(5) || value,
        interval: dates.length > 14 ? Math.ceil(dates.length / 7) : 0,
        rotate: dates.length > 14 ? 30 : 0
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: { type: 'dashed', color: '#E2E8F0' }
      },
      axisLabel: {
        color: '#64748B'
      }
    },
    series: [
      {
        name: 'Token Usage',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#0EA5E9',
          borderColor: '#fff',
          borderWidth: 2
        },
        lineStyle: {
          width: 3,
          color: '#0EA5E9'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(14, 165, 233, 0.3)' },
            { offset: 1, color: 'rgba(14, 165, 233, 0.05)' }
          ])
        },
        data: values
      }
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

const setDimension = (dim: 'user' | 'model') => {
  emit('update:dimension', dim)
}
</script>

<template>
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-card p-6 border border-slate-100 dark:border-slate-700 h-full flex flex-col min-h-0">
    <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 shrink-0">
      <h3 class="text-lg font-semibold text-slate-800 dark:text-white">{{ title || 'Token 消耗趋势' }}</h3>
      
      <div class="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
        <button 
          @click="setDimension('user')"
          class="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
          :class="dimension === 'user' ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'"
        >
          用户维度
        </button>
        <button 
          @click="setDimension('model')"
          class="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
          :class="dimension === 'model' ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'"
        >
          模型维度
        </button>
      </div>
    </div>
    
    <div class="w-full flex-1 min-h-[260px]" ref="chartRef"></div>
  </div>
</template>
