import { ref, onMounted } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'project-tracker-theme'

// Global reactive state (shared across all component instances)
const theme = ref<Theme>('system')
const resolvedTheme = ref<'light' | 'dark'>('light')

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolvedValue: 'light' | 'dark') {
  if (typeof document === 'undefined') return

  if (resolvedValue === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  resolvedTheme.value = resolvedValue
}

function resolveTheme(themeValue: Theme): 'light' | 'dark' {
  if (themeValue === 'system') {
    return getSystemTheme()
  }
  return themeValue
}

function loadTheme() {
  if (typeof localStorage === 'undefined') return

  const saved = localStorage.getItem(THEME_KEY) as Theme | null
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    theme.value = saved
  }
  applyTheme(resolveTheme(theme.value))
}

function setTheme(newTheme: Theme) {
  theme.value = newTheme
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_KEY, newTheme)
  }
  applyTheme(resolveTheme(newTheme))
}

function toggleTheme() {
  const next: Theme = resolvedTheme.value === 'light' ? 'dark' : 'light'
  setTheme(next)
}

// Initialize on module load
if (typeof window !== 'undefined') {
  loadTheme()

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (theme.value === 'system') {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  })
}

export function useTheme() {
  // Ensure theme is loaded when composable is used in a component
  onMounted(() => {
    if (theme.value === 'system') {
      applyTheme(resolveTheme(theme.value))
    }
  })

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  }
}
