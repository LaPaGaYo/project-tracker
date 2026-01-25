<script setup lang="ts">
import { ref } from 'vue'
import { db } from '@/db'
import { dataService } from '@/services/dataService'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'

const toast = useToast()

// Export state
const isExporting = ref(false)

// Import state
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const clearBeforeImport = ref(true)

// Clear data state
const showClearModal = ref(false)
const isClearing = ref(false)
const clearConfirmText = ref('')

async function handleExport() {
  isExporting.value = true
  try {
    const data = await dataService.exportAllData(db)
    dataService.downloadExport(data)
    toast.success('Data exported successfully')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    isExporting.value = false
  }
}

function openImportDialog() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    importFile.value = files[0]!
    showImportModal.value = true
    target.value = ''
  }
}

async function handleImport() {
  if (!importFile.value) return

  isImporting.value = true
  try {
    const data = await dataService.parseImportFile(importFile.value)
    const result = await dataService.importData(db, data, clearBeforeImport.value)

    if (result.success) {
      const total = result.imported.projects + result.imported.tasks + result.imported.notes
      toast.success(`Imported ${total} items (${result.imported.projects} projects, ${result.imported.tasks} tasks)`)
      showImportModal.value = false
      importFile.value = null
    } else {
      toast.error(result.errors.join(', '))
    }
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    isImporting.value = false
  }
}

function closeImportModal() {
  showImportModal.value = false
  importFile.value = null
  clearBeforeImport.value = true
}

async function handleClearData() {
  if (clearConfirmText.value !== 'DELETE') return

  isClearing.value = true
  try {
    await dataService.clearAllData(db)
    toast.success('All data cleared')
    showClearModal.value = false
    clearConfirmText.value = ''
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    isClearing.value = false
  }
}

function closeClearModal() {
  showClearModal.value = false
  clearConfirmText.value = ''
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-4 py-3 border-b border-planka-card/50 bg-planka-bg-light">
      <h1 class="text-xl font-semibold text-planka-text">Settings</h1>
    </header>

    <div class="flex-1 overflow-y-auto p-4 bg-planka-bg">
      <div class="max-w-2xl mx-auto space-y-8">
        <!-- Data Management Section -->
        <section>
          <h2 class="text-lg font-medium text-planka-text mb-4">Data Management</h2>

          <div class="space-y-4">
            <!-- Export -->
            <div class="p-4 bg-planka-card rounded-planka-lg">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-medium text-planka-text">Export Data</h3>
                  <p class="text-sm text-planka-text-muted mt-1">
                    Download a backup of all your projects, tasks, and notes as a JSON file.
                  </p>
                </div>
                <Button
                  :disabled="isExporting"
                  @click="handleExport"
                >
                  {{ isExporting ? 'Exporting...' : 'Export' }}
                </Button>
              </div>
            </div>

            <!-- Import -->
            <div class="p-4 bg-planka-card rounded-planka-lg">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-medium text-planka-text">Import Data</h3>
                  <p class="text-sm text-planka-text-muted mt-1">
                    Restore data from a previously exported backup file.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  @click="openImportDialog"
                >
                  Import
                </Button>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".json"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </div>
            </div>

            <!-- Clear Data -->
            <div class="p-4 bg-planka-card rounded-planka-lg ring-1 ring-planka-error/30">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-medium text-planka-error">Clear All Data</h3>
                  <p class="text-sm text-planka-error/80 mt-1">
                    Permanently delete all projects, tasks, notes, and attachments. This cannot be undone.
                  </p>
                </div>
                <Button
                  variant="danger"
                  @click="showClearModal = true"
                >
                  Clear Data
                </Button>
              </div>
            </div>
          </div>
        </section>

        <!-- About Section -->
        <section>
          <h2 class="text-lg font-medium text-planka-text mb-4">About</h2>

          <div class="p-4 bg-planka-card rounded-planka-lg">
            <h3 class="font-medium text-planka-text">Project Tracker</h3>
            <p class="text-sm text-planka-text-muted mt-1">
              A personal kanban-style project and task management application.
            </p>
            <p class="text-sm text-planka-text-muted mt-2">
              All data is stored locally in your browser using IndexedDB.
              No account required, no data sent to any server.
            </p>
          </div>
        </section>
      </div>
    </div>

    <!-- Import Modal -->
    <Modal :open="showImportModal" title="Import Data" @close="closeImportModal">
      <div class="space-y-4">
        <div class="p-3 bg-planka-bg-light rounded-planka">
          <p class="text-sm font-medium text-planka-text">Selected file:</p>
          <p class="text-sm text-planka-text-muted">{{ importFile?.name }}</p>
        </div>

        <div class="flex items-center gap-2">
          <input
            id="clear-before-import"
            v-model="clearBeforeImport"
            type="checkbox"
            class="rounded border-planka-text-muted bg-planka-bg-light text-planka-accent focus:ring-planka-accent"
          />
          <label for="clear-before-import" class="text-sm text-planka-text">
            Clear existing data before import
          </label>
        </div>

        <p class="text-sm text-planka-text-muted">
          {{ clearBeforeImport
            ? 'Warning: This will replace all existing data with the imported data.'
            : 'Imported data will be merged with existing data. Conflicts will overwrite existing items.'
          }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" @click="closeImportModal">
            Cancel
          </Button>
          <Button :disabled="isImporting" @click="handleImport">
            {{ isImporting ? 'Importing...' : 'Import' }}
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Clear Data Modal -->
    <Modal :open="showClearModal" title="Clear All Data" @close="closeClearModal">
      <div class="space-y-4">
        <div class="p-3 bg-planka-error/10 rounded-planka border border-planka-error/30">
          <p class="text-sm text-planka-error">
            This will permanently delete all your projects, tasks, notes, and attachments.
            This action cannot be undone.
          </p>
        </div>

        <div>
          <label for="confirm-delete" class="block text-sm font-medium text-planka-text mb-1">
            Type DELETE to confirm:
          </label>
          <input
            id="confirm-delete"
            v-model="clearConfirmText"
            type="text"
            class="w-full px-3 py-2 bg-planka-bg-light border border-planka-bg-light text-planka-text rounded-planka focus:outline-none focus:ring-2 focus:ring-planka-error focus:border-planka-error"
            placeholder="DELETE"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="secondary" @click="closeClearModal">
            Cancel
          </Button>
          <Button
            variant="danger"
            :disabled="clearConfirmText !== 'DELETE' || isClearing"
            @click="handleClearData"
          >
            {{ isClearing ? 'Clearing...' : 'Clear All Data' }}
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
