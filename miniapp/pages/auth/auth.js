const { post } = require('../../utils/request')

function getCurrentApp() {
  return getApp()
}

Page({
  data: {
    mode: 'login',
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    loading: false,
    error: '',
    notice: '',
  },

  onShow() {
    const app = getCurrentApp()
    if (app.globalData && app.globalData.token) {
      wx.reLaunch({ url: '/pages/home/home' })
    }
  },

  setMode(e) {
    const mode = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.mode : ''
    if (!mode || mode === this.data.mode) return
    this.setData({
      mode,
      error: '',
      notice: '',
    })
  },

  setField(e) {
    const field = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.field : ''
    const value = e.detail.value
    if (!field) return
    this.setData({ [field]: value })
  },

  async submit() {
    if (this.data.loading) return
    const { mode, username, password, confirmPassword, displayName } = this.data
    if (!trim(username) || !trim(password) || (mode === 'register' && (!trim(displayName) || !trim(confirmPassword)))) {
      this.setData({ error: mode === 'register' ? '请输入用户名、昵称、密码和确认密码' : '请输入用户名和密码' })
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      this.setData({ error: '两次输入的密码不一致' })
      return
    }

    this.setData({ loading: true, error: '', notice: '' })
    const app = getCurrentApp()

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = {
        username: trim(username),
        password: trim(password),
      }
      if (mode === 'register') {
        payload.displayName = trim(displayName)
        payload.confirmPassword = trim(confirmPassword)
      }

      const bundle = await post(endpoint, payload)
      if (mode === 'register' && !bundle.token) {
        this.setData({
          notice: bundle.message || '注册申请已提交，请等待管理员审批后再登录。',
          password: '',
          confirmPassword: '',
        })
        return
      }
      app.setSession(bundle.token, bundle.user, bundle)
      wx.setStorageSync('fitagent_api_base', app.globalData.baseApiUrl)
      wx.reLaunch({ url: '/pages/home/home' })
    } catch (error) {
      this.setData({ error: String(error.message || '登录失败') })
    } finally {
      this.setData({ loading: false })
    }
  },
})

function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}
