import type { ProjectTrackerDB } from '@/db/schema'
import type { Note, NoteType } from '@/types/note'
import { activityService } from './activityService'

interface CreateNoteInput {
  projectId: string
  content: string
  type?: NoteType
}

async function createNote(
  db: ProjectTrackerDB,
  input: CreateNoteInput
): Promise<Note> {
  const now = new Date().toISOString()

  const note: Note = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    content: input.content,
    type: input.type ?? 'note',
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', [db.notes, db.activity], async () => {
    await db.notes.add(note)
    await activityService.logNoteCreated(db, note.id, { projectId: note.projectId, type: note.type })
  })

  return note
}

async function updateNote(
  db: ProjectTrackerDB,
  noteId: string,
  updates: Partial<Omit<Note, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
): Promise<Note> {
  const note = await db.notes.get(noteId)
  if (!note) {
    throw new Error(`Note ${noteId} not found`)
  }

  const updated: Note = {
    ...note,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await db.transaction('rw', [db.notes, db.activity], async () => {
    await db.notes.put(updated)
    await activityService.logNoteUpdated(db, noteId, updates)
  })

  return updated
}

async function deleteNote(
  db: ProjectTrackerDB,
  noteId: string
): Promise<void> {
  await db.notes.delete(noteId)
}

async function getNotesForProject(
  db: ProjectTrackerDB,
  projectId: string
): Promise<Note[]> {
  return db.notes.where('projectId').equals(projectId).toArray()
}

async function getNote(
  db: ProjectTrackerDB,
  noteId: string
): Promise<Note | undefined> {
  return db.notes.get(noteId)
}

export const noteService = {
  createNote,
  updateNote,
  deleteNote,
  getNotesForProject,
  getNote,
}
