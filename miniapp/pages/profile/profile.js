const { get, post } = require('../../utils/request')

const defaultProfile = {
  heightCm: '',
  weightKg: '',
  age: '',
  sex: 'male',
  activityLevel: 'medium',
  goal: 'maintain',
}

function parseProfileState(raw) {
  if (!raw || typeof raw !== 'object') return { ...defaultProfile }
  return {
    heightCm: String(raw.heightCm || ''),
    weightKg: String(raw.weightKg || ''),
    age: String(raw.age || ''),
    sex: raw.sex === 'female' ? 'female' : 'male',
    activityLevel: raw.activityLevel === 'low' ? 'low' : raw.activityLevel === 'high' ? 'high' : 'medium',
    goal: raw.goal === 'fat_loss' ? 'fat_loss' : raw.goal === 'muscle_gain' ? 'muscle_gain' : 'maintain',
  }
}

Page({
  data: {
    loading: true,
    saving: false,
    error: '',
    profile: defaultProfile,
    target: null,
  },

  onShow() {
    const app = getApp()
    if (!app.globalData || !app.globalData.token) {
      wx.reLaunch({ url: '/pages/auth/auth' })
      return
    }
    this.load()
  },

  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const bundle = await get('/api/auth/me')
      const state = bundle.state || {}
      this.setData({
        profile: parseProfileState(state.profile),
        target: state.target || null,
      })
    } catch (error) {
      this.setData({ error: String(error.message || '加载失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  setField(e) {
    const field = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.field : ''
    const value = e.detail.value
    if (!field) return
    this.setData({ ['profile.' + field]: value })
  },

  setPickerValue(e) {
    const field = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.field : ''
    const value = e.detail.value
    if (!field) return
    const optionsText = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.options || '' : ''
    const options = optionsText.split(',')
    const selected = options[Number(value)] || options[0] || ''
    this.setData({ ['profile.' + field]: selected })
  },

  async generateTarget() {
    if (this.data.saving) return
    const profile = this.data.profile
    this.setData({ saving: true, error: '' })

    try {
      const body = {
        heightCm: Number(profile.heightCm),
        weightKg: Number(profile.weightKg),
        age: Number(profile.age),
        sex: profile.sex,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
      }
      const data = await post('/api/agent/nutrition-target', body)
      this.setData({ target: data.target })
      wx.showToast({ title: '目标已生成', icon: 'success' })
    } catch (error) {
      this.setData({ error: String(error.message || '生成失败') })
    } finally {
      this.setData({ saving: false })
    }
  },
})
