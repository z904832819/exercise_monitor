const { get, post, del, uploadFile } = require('../../utils/request')

function toYmd(value) {
  return (value || '').toString().slice(0, 10)
}

function toDateDefault() {
  const date = new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function readNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function mealTotals(meals, dateText) {
  return (meals || []).reduce(
    (acc, item) => {
      if (toYmd(item.date) !== dateText) return acc
      acc.calories += readNumber(item.calories)
      return acc
    },
    { calories: 0 },
  )
}

Page({
  data: {
    loading: false,
    analyzing: false,
    saving: false,
    deleting: false,
    error: '',
    target: null,
    date: toDateDefault(),
    mealType: 'lunch',
    foodName: '',
    meals: [],
    workouts: [],
    dailyMeals: [],
    imagePath: '',
    imageName: '',
    analysis: null,
    selectedCalories: 0,
    activeCalories: 0,
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
      const meals = Array.isArray(state.meals) ? state.meals : []
      const target = state.target || null
      const workouts = Array.isArray(state.workouts) ? state.workouts : []
      const selectedDate = this.data.date
      const selectedMeals = meals.filter((item) => toYmd(item.date) === selectedDate)
      const selectedCalories = mealTotals(selectedMeals, selectedDate).calories
      const activeCalories = workouts.reduce((acc, item) => (toYmd(item.date) === selectedDate ? acc + readNumber(item.calories) : acc), 0)
      this.setData({
        meals,
        workouts,
        dailyMeals: selectedMeals,
        target,
        selectedCalories,
        activeCalories,
      })
    } catch (error) {
      this.setData({ error: String(error.message || '加载失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  setDate(e) {
    const date = e.detail.value || this.data.date
    const meals = this.data.meals || []
    const selectedMeals = meals.filter((item) => toYmd(item.date) === date)
    const selectedWorkouts = (Array.isArray(this.data.workouts) ? this.data.workouts : []).filter((item) => toYmd(item.date) === date)
    const selectedCalories = mealTotals(selectedMeals, date).calories
    const activeCalories = selectedWorkouts.reduce((acc, item) => acc + readNumber(item.calories), 0)
    this.setData({ date, selectedCalories, dailyMeals: selectedMeals, activeCalories })
  },

  setMealType(e) {
    const mealType = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.type : ''
    if (!mealType) return
    this.setData({ mealType })
  },

  setFoodName(e) {
    this.setData({ foodName: e.detail.value })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFilePaths && res.tempFilePaths[0] ? res.tempFilePaths[0] : ''
        const name = path ? path.split('/').pop() : 'photo.jpg'
        this.setData({
          imagePath: path,
          imageName: name,
          analysis: null,
        })
      },
      fail: () => {
        this.setData({ error: '取消选择图片' })
      },
    })
  },

  async analyzeFood() {
    if (!this.data.imagePath || this.data.analyzing) return
    this.setData({ analyzing: true, error: '' })

    try {
      const calorieGoal = this.data.target && this.data.target.calorieGoal ? readNumber(this.data.target.calorieGoal) : 2180
      const meals = this.data.meals || []
      const selectedMeals = meals.filter((item) => toYmd(item.date) === this.data.date)
      const selectedCalories = mealTotals(selectedMeals, this.data.date).calories
      const data = await uploadFile({
        url: '/api/agent/food',
        filePath: this.data.imagePath,
        name: 'image',
        formData: {
          foodName: this.data.foodName || '未命名餐食',
          calorieGoal: String(calorieGoal),
          activeCalories: String(readNumber(this.data.activeCalories)),
          eatenCalories: String(selectedCalories),
        },
      })

      this.setData({
        analysis: data.analysis,
      })
    } catch (error) {
      this.setData({ error: String(error.message || '识别失败') })
    } finally {
      this.setData({ analyzing: false })
    }
  },

  async saveMeal() {
    const analysis = this.data.analysis
    if (!analysis || this.data.saving) return
    if (analysis.calories <= 0) {
      this.setData({ error: '当前食物估算热量无效' })
      return
    }

    this.setData({ saving: true, error: '' })

    try {
      const payloadMeal = {
        name: analysis.name || this.data.foodName || '未命名餐食',
        calories: readNumber(analysis.calories),
        protein: readNumber(analysis.protein),
        carbs: readNumber(analysis.carbs),
        fat: readNumber(analysis.fat),
        ingredients: Array.isArray(analysis.ingredients) ? analysis.ingredients : [],
        mealType: this.data.mealType,
        date: this.data.date,
      }

      const resp = await post('/api/user/meals', { meal: payloadMeal })
      const meals = Array.isArray(resp.meals) ? resp.meals : []
      this.setData({
        meals,
        imagePath: '',
        analysis: null,
        selectedCalories: mealTotals(meals.filter((item) => toYmd(item.date) === this.data.date), this.data.date).calories,
        dailyMeals: meals.filter((item) => toYmd(item.date) === this.data.date),
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      this.setData({ error: String(error.message || '保存失败') })
    } finally {
      this.setData({ saving: false })
    }
  },

  async deleteMeal(e) {
    const id = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : ''
    if (!id) return
    this.setData({ deleting: true, error: '' })

    try {
      const data = await del(`/api/user/meals/${encodeURIComponent(String(id))}`)
      const meals = Array.isArray(data.meals) ? data.meals : []
      this.setData({
        meals,
        dailyMeals: meals.filter((item) => toYmd(item.date) === this.data.date),
        selectedCalories: mealTotals(meals.filter((item) => toYmd(item.date) === this.data.date), this.data.date).calories,
      })
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (error) {
      this.setData({ error: String(error.message || '删除失败') })
    } finally {
      this.setData({ deleting: false })
    }
  },
})
