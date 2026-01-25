export type TaskStatus = 'Todo' | 'Doing' | 'Blocked' | 'Done'

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  dueDate: string | null
  pinnedDate: string | null
  position: number
  blockedReason: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
