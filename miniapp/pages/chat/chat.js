const { get, post, del } = require('../../utils/request')

function normalizeThreadResponse(target, fallbackAgent, fallbackSelectedAgent) {
  const thread = target && target.thread ? target.thread : null
  return {
    activeThreadId: thread && thread.id ? thread.id : '',
    activeThreadAgent: thread && thread.agentId ? thread.agentId : (fallbackAgent || 'general'),
    selectedAgentId: thread && thread.agentId ? thread.agentId : (fallbackSelectedAgent || 'general'),
    messages: target && Array.isArray(target.chatMessages) ? target.chatMessages : [],
  }
}

function normalizeMessageText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

Page({
  data: {
    loading: false,
    sending: false,
    error: '',
    threads: [],
    agents: [],
    activeThreadId: '',
    activeThreadAgent: 'general',
    selectedAgentId: 'general',
    messages: [],
    inputText: '',
  },

  onShow() {
    const app = getApp()
    if (!app.globalData || !app.globalData.token) {
      wx.reLaunch({ url: '/pages/auth/auth' })
      return
    }
    this.loadAll()
  },

  async loadAll() {
    this.setData({ loading: true, error: '' })
    try {
      const [agentsResp, chatResp] = await Promise.all([get('/api/agent/chat/agents'), get('/api/agent/chat')])
      const threads = chatResp.chatThreads || []
      const thread = chatResp.thread || chatResp.activeChatThread || null
      const state = normalizeThreadResponse(chatResp, this.data.activeThreadAgent, this.data.selectedAgentId)
      this.setData({
        agents: agentsResp.agents || [],
        threads,
        activeThreadId: thread && thread.id ? thread.id : '',
        activeThreadAgent: thread && thread.agentId ? thread.agentId : (state.activeThreadAgent || 'general'),
        selectedAgentId: thread && thread.agentId ? thread.agentId : (state.selectedAgentId || 'general'),
        messages: state.messages,
      })
    } catch (error) {
      this.setData({ error: String(error.message || '加载失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  async refreshThreadById(threadId) {
    if (!threadId) {
      this.setData({
        activeThreadId: '',
        activeThreadAgent: this.data.activeThreadAgent || 'general',
        selectedAgentId: this.data.selectedAgentId || this.data.activeThreadAgent || 'general',
        messages: [],
      })
      return
    }

    const chatResp = await get(`/api/agent/chat?threadId=${encodeURIComponent(threadId)}`)
    const state = normalizeThreadResponse(chatResp, this.data.activeThreadAgent, this.data.selectedAgentId)
    this.setData(state)
  },

  async refreshThread(e) {
    const threadId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.threadId : ''
    if (!threadId) return
    this.setData({ loading: true, error: '' })
    try {
      await this.refreshThreadById(threadId)
    } catch (error) {
      this.setData({ error: String(error.message || '加载对话失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  async createThread() {
    if (this.data.loading) return
    this.setData({ loading: true, error: '' })
    try {
      const data = await post('/api/agent/chat/threads', {
        agentId: this.data.selectedAgentId,
        title: '新的健康对话',
      })
      const state = normalizeThreadResponse(data, this.data.selectedAgentId, this.data.selectedAgentId)
      this.setData({
        threads: data.chatThreads || [],
        activeThreadId: state.activeThreadId,
        activeThreadAgent: state.activeThreadAgent,
        selectedAgentId: state.selectedAgentId,
        messages: [],
        inputText: '',
      })
    } catch (error) {
      this.setData({ error: String(error.message || '新建失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  async deleteThread(e) {
    const threadId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.threadId : ''
    if (!threadId) return
    if (this.data.loading) return
    this.setData({ loading: true, error: '' })

    try {
      const data = await del(`/api/agent/chat/threads/${encodeURIComponent(threadId)}`)
      const threads = data.chatThreads || []
      const nextThread = threads[0] || null
      this.setData({
        threads,
        activeThreadId: nextThread && nextThread.id ? nextThread.id : '',
      })
      const nextThreadId = nextThread && nextThread.id ? nextThread.id : ''
      await this.refreshThreadById(nextThreadId)
    } catch (error) {
      this.setData({ error: String(error.message || '删除失败') })
    } finally {
      this.setData({ loading: false })
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  setAgent(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.agentId : ''
    if (!id) return
    this.setData({ selectedAgentId: id })
  },

  async send() {
    const message = normalizeMessageText(this.data.inputText)
    if (!message || this.data.sending) return
    this.setData({ sending: true, error: '' })

    try {
      const data = await post('/api/agent/chat', {
        message,
        threadId: this.data.activeThreadId || undefined,
        agentId: this.data.selectedAgentId || this.data.activeThreadAgent || 'general',
      })
      const state = normalizeThreadResponse(data, this.data.activeThreadAgent, this.data.selectedAgentId)

      this.setData({
        messages: data.chatMessages || [],
        threads: data.chatThreads || this.data.threads,
        activeThreadId: state.activeThreadId || this.data.activeThreadId,
        activeThreadAgent: state.activeThreadAgent || this.data.activeThreadAgent,
        selectedAgentId: state.selectedAgentId || this.data.selectedAgentId,
        inputText: '',
      })
    } catch (error) {
      this.setData({ error: String(error.message || '发送失败') })
    } finally {
      this.setData({ sending: false })
    }
  },

  clearCurrentThread() {
    if (!this.data.activeThreadId) return
    if (this.data.loading) return

    this.setData({ loading: true, error: '' })
    const threadId = this.data.activeThreadId

    del(`/api/agent/chat?threadId=${encodeURIComponent(threadId)}`)
      .then(() => this.refreshThreadById(threadId))
      .catch((error) => {
        this.setData({ error: String(error.message || '清空失败') })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },
})
