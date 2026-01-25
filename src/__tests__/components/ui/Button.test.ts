import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from '@/components/ui/Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click me',
      },
    })
    expect(wrapper.text()).toBe('Click me')
  })

  it('applies variant classes', () => {
    const wrapper = mount(Button, {
      props: { variant: 'danger' },
      slots: { default: 'Delete' },
    })
    expect(wrapper.classes()).toContain('bg-planka-error')
  })

  it('disables when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
      slots: { default: 'Disabled' },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})
