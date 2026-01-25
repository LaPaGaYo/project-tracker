export type NoteType = 'note' | 'decision' | 'linkdump'

export interface Note {
  id: string
  projectId: string
  content: string
  type: NoteType
  createdAt: string
  updatedAt: string
}
