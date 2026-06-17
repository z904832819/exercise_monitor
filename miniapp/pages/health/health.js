const { get, post, uploadFile } = require('../../utils/request')

function toDateDefault() {
  const date = new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function toYmd(value) {
  return (value || '').toString().slice(0, 10)
}

function todayMeals(meals) {
  return Array.isArray(meals) ? meals : []
}

Page({
  data: {
    loading: false,
    importing: false,
    querying: false,
    error: '',
    target: null,
    source: '',
    date: toDateDefault(),
    summary: null,
    workouts: [],
    advice: null,
    filePath: '',
    fileName: '',
  },

  onShow() {
    const app = getApp()
    if (!app.globalData || !app.globalData.token) {
      wx.reLaunch({ url: '/pages/auth/auth' })
      return
    }
    this.loadState()
  },

  async loadState() {
    this.setData({ loading: true, error: '' })
    try {
      const data = await get('/api/user/state')
      const state = data.state || {}
      this.setData({
        target: state.target || null,
        source: state.source || '',
        summary: state.healthImport ? toDateSummary(state.healthImport) : null,
      })
    } catch (error) {
      this.setData({ error: String(error.message || '加载失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  chooseFile() {
    this.setData({ error: '' })
    if (!wx.chooseMessageFile) {
      this.setData({ error: '当前微信版本不支持文件选择，请在支持版本中重试' })
      return
    }

      wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['zip', 'xml'],
      success: (res) => {
        const files = res.tempFiles || []
        const file = files[0]
        if (!file) return
        this.setData({
          filePath: file.path || file.tempFilePath || '',
          fileName: file.name || 'health-export.zip',
        })
      },
      fail: () => {
        this.setData({ error: '取消选择文件' })
      },
    })
  },

  async importHealth() {
    if (!this.data.filePath) return
    const app = getApp()
    const globalState = app && app.globalData ? app.globalData.state : {}
    const stateMeals = (globalState && Array.isArray(globalState.meals)) ? globalState.meals : []
    this.setData({ importing: true, error: '' })

    try {
      const payloadMeals = todayMeals(stateMeals)
      const calorieGoal = this.data.target && this.data.target.calorieGoal ? Number(this.data.target.calorieGoal) : 2180
      const data = await uploadFile({
        url: '/api/user/health-import',
        filePath: this.data.filePath,
        name: 'healthExport',
        formData: {
          date: this.data.date,
          calorieGoal: String(calorieGoal),
          meals: JSON.stringify(payloadMeals),
        },
      })

      this.setData({
        workouts: data.workouts || [],
        advice: data.advice || null,
        summary: data.importSummary || null,
        source: data.workouts && data.workouts.length ? 'Apple 健康导入' : this.data.source,
        filePath: '',
        fileName: '',
      })
      wx.showToast({ title: '导入完成', icon: 'success' })
    } catch (error) {
      this.setData({ error: String(error.message || '导入失败') })
    } finally {
      this.setData({ importing: false })
    }
  },

  async queryDay() {
    this.setData({ querying: true, error: '' })
    try {
      const calorieGoal = this.data.target && this.data.target.calorieGoal ? Number(this.data.target.calorieGoal) : 2180
      const data = await post('/api/user/health-query', {
        date: this.data.date,
        calorieGoal,
      })
      this.setData({
        workouts: data.workouts || [],
        advice: data.advice || null,
        summary: data.importSummary || this.data.summary,
      })
    } catch (error) {
      this.setData({ error: String(error.message || '查询失败') })
    } finally {
      this.setData({ querying: false })
    }
  },

  setDate(e) {
    this.setData({ date: e.detail.value || this.data.date })
  },
})

function toDateSummary(value) {
  if (!value || typeof value !== 'object') return null
  const range = value.range || {}
  const selectedDate = value.selectedDate || value.date || ''
  const selectedDay = value.selectedDay || {}
  return {
    range: {
      from: range.from ? String(range.from) : toYmd(selectedDate),
      to: range.to ? String(range.to) : toYmd(selectedDate),
    },
    selectedDate: selectedDate || toYmd(new Date().toISOString().slice(0, 10)),
    selectedDay: {
      steps: Number(selectedDay.steps || 0),
      activeCalories: Number(selectedDay.activeCalories || 0),
      exerciseMinutes: Number(selectedDay.exerciseMinutes || 0),
    },
    steps: Number(value.steps || 0),
    workouts: Number(value.workouts || 0),
    activeCalories: Number(value.activeCalories || 0),
    exerciseMinutes: Number(value.exerciseMinutes || 0),
  }
}
