import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KpiCard from '../token-usage/KpiCard.vue'

// Mock echarts
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn()
  })),
  graphic: {
    LinearGradient: vi.fn()
  }
}))

describe('KpiCard', () => {
  it('renders title and value correctly', () => {
    const wrapper = mount(KpiCard, {
      props: {
        title: 'Total Usage',
        value: '1,000'
      }
    })
    
    expect(wrapper.text()).toContain('Total Usage')
    expect(wrapper.text()).toContain('1,000')
  })

  it('renders change percentage and label', () => {
    const wrapper = mount(KpiCard, {
      props: {
        title: 'Usage',
        value: '100',
        change: 5.5,
        changeLabel: 'vs yesterday'
      }
    })
    
    expect(wrapper.text()).toContain('+5.5%')
    expect(wrapper.text()).toContain('vs yesterday')
  })

  it('renders negative change correctly', () => {
    const wrapper = mount(KpiCard, {
      props: {
        title: 'Usage',
        value: '100',
        change: -2.3
      }
    })
    
    expect(wrapper.text()).toContain('-2.3%')
    // Should have red color class (rose-600)
    expect(wrapper.find('.text-rose-600').exists()).toBe(true)
  })

  it('shows loading state', () => {
    const wrapper = mount(KpiCard, {
      props: {
        title: 'Usage',
        value: '100',
        loading: true
      }
    })
    
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })
})
