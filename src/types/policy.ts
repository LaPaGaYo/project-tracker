export interface WipLimits {
  projects: {
    Planning: number
    Active: number
  }
  tasks: {
    Doing: number
  }
}

export const DEFAULT_WIP_LIMITS: WipLimits = {
  projects: {
    Planning: 3,
    Active: 2,
  },
  tasks: {
    Doing: 1,
  },
}
