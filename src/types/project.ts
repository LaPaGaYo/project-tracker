export type ProjectStage = 'Idea' | 'Planning' | 'Active' | 'Paused' | 'Completed' | 'Archived'

export interface Project {
  id: string
  title: string
  description: string
  stage: ProjectStage
  dueDate: string | null
  tagIds: string[]
  links: { title: string; url: string }[]
  timeEstimate: number | null
  pinnedDate: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}
