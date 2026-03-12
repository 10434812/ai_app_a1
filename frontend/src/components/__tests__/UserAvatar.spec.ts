import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAvatar from '../UserAvatar.vue'

describe('UserAvatar.vue', () => {
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://example.com/avatar.jpg'
  }

  it('renders avatar image when url is provided', () => {
    const wrapper = mount(UserAvatar, {
      props: { user: mockUser }
    })
    
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(mockUser.avatar)
  })

  it('upgrades HTTP WeChat url to HTTPS', () => {
    const wechatUser = {
      ...mockUser,
      avatar: 'http://thirdwx.qlogo.cn/mmopen/vi_32/DYAIOgq83er/132'
    }
    
    const wrapper = mount(UserAvatar, {
      props: { user: wechatUser }
    })
    
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('https://thirdwx.qlogo.cn/mmopen/vi_32/DYAIOgq83er/132')
  })

  it('renders initial fallback when avatar is missing', () => {
    const wrapper = mount(UserAvatar, {
      props: { 
        user: { ...mockUser, avatar: undefined } 
      }
    })
    
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('T')
  })

  it('renders initial fallback on image load error', async () => {
    const wrapper = mount(UserAvatar, {
      props: { user: mockUser }
    })
    
    // Simulate error
    await wrapper.find('img').trigger('error')
    
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('T')
  })

  it('applies size classes correctly', () => {
    const wrapper = mount(UserAvatar, {
      props: { user: mockUser, size: 'lg' }
    })
    
    expect(wrapper.classes()).toContain('w-20')
    expect(wrapper.classes()).toContain('h-20')
  })
})
