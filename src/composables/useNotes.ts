import { computed, type Ref } from 'vue'
import { useLiveQuery } from '@/db/live'
import { db } from '@/db'
import { noteService } from '@/services/noteService'
import type { Note, NoteType } from '@/types/note'

export function useNotes(projectId: Ref<string>) {
  const notes = useLiveQuery(
    () => db.notes.where('projectId').equals(projectId.value).toArray(),
    { initialValue: [] as Note[] }
  )

  const sortedNotes = computed(() => {
    return [...notes.value].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  })

  const notesByType = computed(() => {
    const byType: Record<NoteType, Note[]> = {
      note: [],
      decision: [],
      linkdump: [],
    }
    for (const note of notes.value) {
      byType[note.type].push(note)
    }
    return byType
  })

  async function createNote(input: { content: string; type?: NoteType }) {
    return noteService.createNote(db, {
      projectId: projectId.value,
      ...input,
    })
  }

  async function updateNote(
    noteId: string,
    updates: Partial<Omit<Note, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
  ) {
    return noteService.updateNote(db, noteId, updates)
  }

  async function deleteNote(noteId: string) {
    return noteService.deleteNote(db, noteId)
  }

  function getNote(noteId: string) {
    return notes.value.find(n => n.id === noteId)
  }

  return {
    notes,
    sortedNotes,
    notesByType,
    createNote,
    updateNote,
    deleteNote,
    getNote,
  }
}
