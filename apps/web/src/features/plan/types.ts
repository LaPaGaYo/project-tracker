export interface PlanStageViewModel {
  label: string;
  title: string;
  progressLabel: string;
}

export interface CurrentPlanStageViewModel extends PlanStageViewModel {
  goal: string;
}

export interface PlanItemViewModel {
  title: string;
  description: string;
  linkedIssues: string[];
  stageTitle: string;
}

export interface StageGateViewModel {
  title: string;
  description: string;
  linkedIssues: string[];
  stageTitle: string;
}

export interface PlanViewModel {
  currentStage: CurrentPlanStageViewModel;
  stages: PlanStageViewModel[];
  items: PlanItemViewModel[];
  gates: StageGateViewModel[];
}
