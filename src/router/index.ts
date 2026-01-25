import { createRouter, createWebHistory } from 'vue-router'
import PortfolioView from '@/views/PortfolioView.vue'
import TodayView from '@/views/TodayView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'

const routes = [
  { path: '/', name: 'portfolio', component: PortfolioView },
  { path: '/today', name: 'today', component: TodayView },
  { path: '/project/:id', name: 'project', component: ProjectDetailView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
