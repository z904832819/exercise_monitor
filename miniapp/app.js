App({
  globalData: {
    token: '',
    user: null,
    baseApiUrl: 'http://127.0.0.1:8787',
    state: null,
    chatThreads: [],
    activeChatThread: null,
    chatMessages: [],
  },

  onLaunch() {
    const savedBase = wx.getStorageSync('fitagent_api_base')
    if (savedBase) this.globalData.baseApiUrl = String(savedBase)

    const token = wx.getStorageSync('fitagent_token')
    if (token) this.globalData.token = String(token)

    const user = wx.getStorageSync('fitagent_user')
    if (user) {
      try {
        this.globalData.user = JSON.parse(String(user))
      } catch {
        this.globalData.user = null
      }
    }
  },

  setSession(token, user, bundle) {
    this.globalData.token = token || ''
    this.globalData.user = user || null
    this.globalData.state = bundle && bundle.state ? bundle.state : this.globalData.state
    if (!this.globalData.state) this.globalData.state = null
    this.globalData.chatThreads = bundle && Array.isArray(bundle.chatThreads) ? bundle.chatThreads : this.globalData.chatThreads || []
    this.globalData.activeChatThread = bundle && bundle.activeChatThread ? bundle.activeChatThread : this.globalData.activeChatThread
    this.globalData.chatMessages = bundle && Array.isArray(bundle.chatMessages) ? bundle.chatMessages : this.globalData.chatMessages || []

    if (token) {
      wx.setStorageSync('fitagent_token', token)
    }
    if (user) {
      wx.setStorageSync('fitagent_user', JSON.stringify(user))
    } else {
      wx.removeStorageSync('fitagent_user')
    }
  },

  clearSession() {
    this.globalData.token = ''
    this.globalData.user = null
    this.globalData.state = null
    this.globalData.chatThreads = []
    this.globalData.activeChatThread = null
    this.globalData.chatMessages = []
    wx.removeStorageSync('fitagent_token')
    wx.removeStorageSync('fitagent_user')
  },
})
