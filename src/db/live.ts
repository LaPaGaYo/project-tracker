import { ref, onUnmounted, type Ref } from 'vue'
import { liveQuery, type Subscription } from 'dexie'

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  options: { initialValue: T }
): Ref<T> {
  const result = ref<T>(options.initialValue) as Ref<T>
  let subscription: Subscription | null = null

  const observable = liveQuery(querier)

  subscription = observable.subscribe({
    next: (value) => {
      result.value = value
    },
    error: (error) => {
      console.error('useLiveQuery error:', error)
    },
  })

  onUnmounted(() => {
    subscription?.unsubscribe()
  })

  return result
}
