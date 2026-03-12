import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UsageTable from '../token-usage/UsageTable.vue'

const mockData = [
  { id: '1', amount: 100, type: 'chat', model: 'gpt-4', balanceAfter: 900, createdAt: '2023-01-01T12:00:00Z', meta: '{"prompt_tokens": 10, "completion_tokens": 90}' },
  { id: '2', amount: 50, type: 'chat', model: 'gpt-3.5', balanceAfter: 850, createdAt: '2023-01-02T12:00:00Z' }
]

describe('UsageTable', () => {
  it('renders data correctly', () => {
    const wrapper = mount(UsageTable, {
      props: {
        data: mockData,
        loading: false,
        total: 100,
        page: 1,
        pageSize: 20
      }
    })
    
    expect(wrapper.text()).toContain('gpt-4')
    expect(wrapper.text()).toContain('gpt-3.5')
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('50')
  })

  it('parses meta correctly', () => {
    const wrapper = mount(UsageTable, {
      props: {
        data: mockData,
        loading: false,
        total: 100,
        page: 1,
        pageSize: 20
      }
    })
    
    // First row has meta
    const rows = wrapper.findAll('tbody tr')
    const firstRow = rows[0]
    expect(firstRow.text()).toContain('10') // input tokens
    expect(firstRow.text()).toContain('90') // output tokens
    
    // Second row has no meta
    const secondRow = rows[1]
    expect(secondRow.text()).toContain('-')
  })

  it('emits page change event', async () => {
    const wrapper = mount(UsageTable, {
      props: {
        data: mockData,
        loading: false,
        total: 100,
        page: 1,
        pageSize: 20
      }
    })
    
    await wrapper.findAll('button').find(b => b.text() === '下一页')?.trigger('click')
    expect(wrapper.emitted('update:page')?.[0]).toEqual([2])
  })

  it('emits filter event', async () => {
    const wrapper = mount(UsageTable, {
      props: {
        data: mockData,
        loading: false,
        total: 100,
        page: 1,
        pageSize: 20
      }
    })
    
    const select = wrapper.find('select')
    await select.setValue('gpt-4')
    expect(wrapper.emitted('filter')?.[0]).toEqual([{ model: 'gpt-4', dateRange: { start: '', end: '' } }])
  })
})
