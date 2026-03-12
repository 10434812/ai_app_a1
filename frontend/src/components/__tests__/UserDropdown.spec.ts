import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import UserDropdown from '../UserDropdown.vue'
import { createTestingPinia } from '@pinia/testing'
import { useAuthStore } from '../../stores/auth'
import { nextTick } from 'vue'

// Mock router
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock
  })
}))

describe('UserDropdown.vue', () => {
  const globalStubs = {
    'router-link': RouterLinkStub,
    teleport: true,
  }

  it('renders guest buttons when not logged in', () => {
    const wrapper = mount(UserDropdown, {
      global: {
        stubs: globalStubs,
        plugins: [createTestingPinia({
          initialState: {
            auth: { user: null }
          }
        })]
      }
    })

    expect(wrapper.text()).toContain('登录账号')
    expect(wrapper.text()).toContain('注册新用户')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('renders user info when logged in', () => {
    const wrapper = mount(UserDropdown, {
      global: {
        stubs: globalStubs,
        plugins: [createTestingPinia({
          initialState: {
            auth: {
              user: {
                id: '123',
                name: 'Test User',
                role: 'user',
                tokensBalance: 100
              }
            }
          }
        })]
      }
    })

    expect(wrapper.text()).toContain('Test User')
    expect(wrapper.text()).toContain('Token: 100')
    expect(wrapper.find('button').exists()).toBe(false) // No guest buttons
  })

  it('toggles dropdown on click', async () => {
    const wrapper = mount(UserDropdown, {
      global: {
        stubs: globalStubs,
        plugins: [createTestingPinia({
          initialState: {
            auth: { user: { name: 'Test User' } }
          }
        })]
      }
    })

    // Initial state: closed
    expect(wrapper.find('.absolute.z-50').exists()).toBe(false)

    // Click trigger
    await wrapper.find('.cursor-pointer').trigger('click')
    
    // Open state
    expect(wrapper.find('.absolute.z-50').exists()).toBe(true)
    expect(wrapper.text()).toContain('退出登录')
  })

  it('calls logout action on click', async () => {
    const wrapper = mount(UserDropdown, {
      global: {
        stubs: globalStubs,
        plugins: [createTestingPinia({
          stubActions: false, // Use real store logic (or mocked if simpler)
          initialState: {
            auth: { user: { name: 'Test User' } }
          }
        })]
      }
    })
    const store = useAuthStore()
    store.logout = vi.fn() // Explicit mock

    // Open dropdown
    await wrapper.find('.cursor-pointer').trigger('click')
    
    // Click Logout button inside dropdown
    const logoutBtn = wrapper.findAll('button').find(b => b.text().includes('退出登录'))
    await logoutBtn?.trigger('click')
    await nextTick()

    // Expect Confirmation Modal to show (we can't easily test modal visibility if it's teleported or conditional, 
    // but in our component it sets showLogoutConfirm = true)
    
    // Click confirm in modal
    const confirmBtn = wrapper.findAll('button').find(b => b.text() === '确认退出')
    await confirmBtn?.trigger('click')
    await nextTick()

    expect(store.logout).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/login')
  })
})
