import type { ProjectStage, TaskStatus } from "./constants";

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  stage: ProjectStage;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  blockedReason: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
