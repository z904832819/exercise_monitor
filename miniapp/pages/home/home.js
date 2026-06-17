const { get } = require('../../utils/request')

function getCurrentApp() {
  return getApp()
}

function toYmd(value) {
  const text = (value || '').toString().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function sumMeals(meals, dateText) {
  return (meals || []).reduce(
    (acc, item) => {
      if (toYmd(item.date) !== dateText) return acc
      acc.calories += Number(item.calories) || 0
      acc.protein += Number(item.protein) || 0
      acc.carbs += Number(item.carbs) || 0
      acc.fat += Number(item.fat) || 0
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function sumWorkouts(workouts, dateText) {
  return (workouts || []).filter((item) => toYmd(item.date) === dateText).reduce((acc, item) => acc + (Number(item.calories) || 0), 0)
}

function todayKey() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

function safeText(value, fallback = '') {
  return value == null || value === undefined ? fallback : String(value)
}

Page({
  data: {
    loading: true,
    error: '',
    greeting: '',
    user: null,
    target: null,
    profile: null,
    meals: [],
    workouts: [],
    motionAnalysis: null,
    healthAdvice: null,
    summary: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      workouts: 0,
      activeCalories: 0,
    },
  },

  onShow() {
    const app = getCurrentApp()
    if (!app.globalData || !app.globalData.token) {
      wx.reLaunch({ url: '/pages/auth/auth' })
      return
    }
    this.loadOverview()
  },

  async loadOverview() {
    const app = getCurrentApp()
    this.setData({ loading: true, error: '' })

    try {
      const data = await get('/api/auth/me')
      const state = data.state || {}
      const meals = Array.isArray(state.meals) ? state.meals : []
      const workouts = Array.isArray(state.workouts) ? state.workouts : []
      const today = todayKey()
      const summary = {
        ...sumMeals(meals, today),
        workouts: workouts.filter((item) => toYmd(item.date) === today).length,
        activeCalories: Math.round(sumWorkouts(workouts, today)),
      }
      this.setData({
        user: data.user,
        greeting: data.user && data.user.displayName ? data.user.displayName : (data.user && data.user.username) || '',
        target: state.target || null,
        profile: state.profile || null,
        meals,
        workouts,
        motionAnalysis: state.motionAnalysis || null,
        healthAdvice: state.healthAdvice || null,
        summary,
      })

        app.globalData.user = data.user || null
      app.globalData.state = state
      app.globalData.chatThreads = data.chatThreads || []
      app.globalData.activeChatThread = data.activeChatThread || null
      app.globalData.chatMessages = data.chatMessages || []
    } catch (error) {
      this.setData({ error: String(error.message || '加载失败') })
      if (String(error.message || '').includes('登录')) {
        app.clearSession()
        wx.reLaunch({ url: '/pages/auth/auth' })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  openPage(e) {
    const url = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.url : ''
    if (!url) return
    wx.navigateTo({ url })
  },

  logout() {
    getCurrentApp().clearSession()
    wx.reLaunch({ url: '/pages/auth/auth' })
  },

})
