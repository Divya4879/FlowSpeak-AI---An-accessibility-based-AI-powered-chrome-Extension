class AIReader {
  constructor() {
    this.elements = this.getElements()
    this.currentSite = ''
    this.hasApiKey = false
    this.init()
  }

  getElements() {
    return {
      status: document.getElementById('status'),
      play: document.getElementById('play'),
      pause: document.getElementById('pause'),
      stop: document.getElementById('stop'),
      prevHeading: document.getElementById('prevHeading'),
      nextHeading: document.getElementById('nextHeading'),
      prevSection: document.getElementById('prevSection'),
      nextSection: document.getElementById('nextSection'),
      prevChapter: document.getElementById('prevChapter'),
      nextChapter: document.getElementById('nextChapter'),
      chapterInput: document.getElementById('chapterInput'),
      jumpToChapter: document.getElementById('jumpToChapter'),
      sectionInput: document.getElementById('sectionInput'),
      jumpToSection: document.getElementById('jumpToSection'),
      chapterDropdown: document.getElementById('chapterDropdown'),
      chapterSection: document.getElementById('chapterSection'),
      speedSlider: document.getElementById('speedSlider'),
      volumeSlider: document.getElementById('volumeSlider'),
      speedValue: document.getElementById('speedValue'),
      volumeValue: document.getElementById('volumeValue'),
      testApi: document.getElementById('testApi'),
      explainSelected: document.getElementById('explainSelected'),
      summarizeSelected: document.getElementById('summarizeSelected'),
      siteSummary: document.getElementById('siteSummary'),
      aiSection: document.getElementById('aiSection'),
      aiResult: document.getElementById('aiResult'),
      settings: document.getElementById('settings'),
      siteInfo: document.getElementById('siteInfo'),
      voiceStatus: document.getElementById('voiceStatus')
    }
  }

  async init() {
    this.setupEventListeners()
    await this.loadSettings()
    await this.detectSite()
    await this.loadChapters()
    this.setStatus('Ready to read')
    
    // Debug: Check if AI buttons exist
    console.log('AI buttons:', {
      testApi: !!this.elements.testApi,
      explainSelected: !!this.elements.explainSelected,
      summarizeSelected: !!this.elements.summarizeSelected,
      siteSummary: !!this.elements.siteSummary
    })
  }

  setupEventListeners() {
    // Playback controls
    this.elements.play.addEventListener('click', () => this.sendMessage('PLAY'))
    this.elements.pause.addEventListener('click', () => this.sendMessage('PAUSE'))
    this.elements.stop.addEventListener('click', () => this.sendMessage('STOP'))

    // Navigation
    this.elements.prevHeading.addEventListener('click', () => this.sendMessage('PREV_HEADING'))
    this.elements.nextHeading.addEventListener('click', () => this.sendMessage('NEXT_HEADING'))
    this.elements.prevSection.addEventListener('click', () => this.sendMessage('PREV_SECTION'))
    this.elements.nextSection.addEventListener('click', () => this.sendMessage('NEXT_SECTION'))
    this.elements.prevChapter.addEventListener('click', () => this.sendMessage('PREV_CHAPTER'))
    this.elements.nextChapter.addEventListener('click', () => this.sendMessage('NEXT_CHAPTER'))

    // Chapter navigation
    this.elements.jumpToChapter.addEventListener('click', () => this.jumpToChapter())
    this.elements.chapterDropdown.addEventListener('change', (e) => this.selectChapter(e))
    this.elements.chapterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.jumpToChapter()
    })

    // Section navigation
    this.elements.jumpToSection.addEventListener('click', () => this.jumpToSection())
    this.elements.sectionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.jumpToSection()
    })

    // Speed and volume
    this.elements.speedSlider.addEventListener('input', (e) => this.updateSpeed(e))
    this.elements.volumeSlider.addEventListener('input', (e) => this.updateVolume(e))

    // AI features
    if (this.elements.testApi) {
      this.elements.testApi.addEventListener('click', () => {
        console.log('Test API clicked')
        this.testApiConnection()
      })
    }
    if (this.elements.explainSelected) {
      this.elements.explainSelected.addEventListener('click', () => {
        console.log('Explain Selected clicked')
        this.explainSelected()
      })
    }
    if (this.elements.summarizeSelected) {
      this.elements.summarizeSelected.addEventListener('click', () => {
        console.log('Summarize Selected clicked')
        this.summarizeSelected()
      })
    }
    if (this.elements.siteSummary) {
      this.elements.siteSummary.addEventListener('click', () => {
        console.log('Site Summary clicked')
        this.generateSiteSummary()
      })
    }

    // Settings
    this.elements.settings.addEventListener('click', () => this.openSettings())
  }

  async sendMessage(action, payload = {}) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action, payload }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Content script not ready')
              resolve(null)
            } else {
              resolve(response)
            }
          })
        } else {
          resolve(null)
        }
      })
    })
  }

  setStatus(text, type = 'info') {
    this.elements.status.textContent = text
    this.elements.status.className = `status ${type}`
    
    if (type === 'speaking') {
      this.elements.status.classList.add('speaking')
    } else {
      this.elements.status.classList.remove('speaking')
    }
  }

  async detectSite() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = new URL(tab.url)
      this.currentSite = url.hostname

      this.elements.siteInfo.textContent = this.getSiteDisplayName(this.currentSite)

      // Show chapter controls for AO3
      if (this.currentSite.includes('archiveofourown.org')) {
        this.elements.chapterSection.style.display = 'block'
      }

      // Always show AI features and check for API key
      console.log('Showing AI section')
      this.elements.aiSection.style.display = 'block'
      
      const keyStatus = await chrome.runtime.sendMessage({ action: 'GET_KEY_STATUS' })
      console.log('Key status:', keyStatus)
      
      if (keyStatus?.hasKey) {
        this.hasApiKey = true
        this.setStatus('AI features ready', 'success')
      } else {
        this.hasApiKey = false
        this.setStatus('Add API key in settings for AI features', 'info')
      }
    } catch (e) {
      console.error('Site detection error:', e)
      this.elements.siteInfo.textContent = 'Unknown site'
      this.elements.aiSection.style.display = 'block'
    }
  }

  getSiteDisplayName(hostname) {
    const siteNames = {
      'archiveofourown.org': '📚 Archive of Our Own',
      'dev.to': '💻 DEV Community',
      'medium.com': '📝 Medium',
      'github.com': '🐙 GitHub',
      'stackoverflow.com': '❓ Stack Overflow',
      'reddit.com': '🔴 Reddit',
      'wikipedia.org': '📖 Wikipedia'
    }

    for (const [domain, name] of Object.entries(siteNames)) {
      if (hostname.includes(domain)) return name
    }

    return `🌐 ${hostname}`
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(['speed', 'volume', 'voiceGender', 'voiceAccent'])
      
      const speed = settings.speed || 1.0
      const volume = settings.volume || 1.0

      this.elements.speedSlider.value = speed
      this.elements.volumeSlider.value = volume
      this.elements.speedValue.textContent = `${speed}x`
      this.elements.volumeValue.textContent = `${Math.round(volume * 100)}%`

      // Send all settings to content script
      this.sendMessage('SET_SPEED', { speed })
      this.sendMessage('SET_VOLUME', { volume })
      this.sendMessage('SET_VOICE_SETTINGS', { 
        voiceGender: settings.voiceGender || 'any',
        voiceAccent: settings.voiceAccent || 'any'
      })
      
      // Update voice status display
      this.updateVoiceStatus(settings.voiceGender || 'any', settings.voiceAccent || 'any')
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  async loadChapters() {
    if (!this.currentSite.includes('archiveofourown.org')) return

    try {
      const result = await this.sendMessage('GET_ALL_CHAPTERS')
      if (result?.chapters && result.chapters.length > 0) {
        this.populateChapterDropdown(result.chapters)
        this.setStatus(`Found ${result.chapters.length} chapters`)
      }
    } catch (e) {
      console.error('Failed to load chapters:', e)
    }
  }

  populateChapterDropdown(chapters) {
    this.elements.chapterDropdown.innerHTML = '<option value="">Select Chapter...</option>'
    
    chapters.forEach(chapter => {
      const option = document.createElement('option')
      option.value = chapter.number
      option.textContent = chapter.text
      this.elements.chapterDropdown.appendChild(option)
    })
  }

  async jumpToChapter() {
    const chapterNum = parseInt(this.elements.chapterInput.value)
    if (!chapterNum || chapterNum < 1) {
      this.setStatus('Enter valid chapter number', 'error')
      return
    }

    const result = await this.sendMessage('JUMP_TO_CHAPTER', { number: chapterNum })
    if (result?.found) {
      this.setStatus(`Jumped to Chapter ${chapterNum}`, 'success')
      this.elements.chapterInput.value = ''
    } else {
      this.setStatus(`Chapter ${chapterNum} not found`, 'error')
    }
  }

  async jumpToSection() {
    const sectionText = this.elements.sectionInput.value.trim()
    if (!sectionText) {
      this.setStatus('Enter section name to search', 'error')
      return
    }

    const result = await this.sendMessage('JUMP_TO_SECTION', { text: sectionText })
    if (result?.found) {
      this.setStatus(`Found section: ${sectionText}`, 'success')
      this.elements.sectionInput.value = ''
    } else {
      this.setStatus(`Section "${sectionText}" not found`, 'error')
    }
  }

  async selectChapter(e) {
    const chapterNum = parseInt(e.target.value)
    if (!chapterNum) return

    const result = await this.sendMessage('JUMP_TO_CHAPTER', { number: chapterNum })
    if (result?.found) {
      this.setStatus(`Selected Chapter ${chapterNum}`, 'success')
    } else {
      this.setStatus(`Chapter ${chapterNum} not found`, 'error')
    }
  }

  async updateSpeed(e) {
    const speed = parseFloat(e.target.value)
    this.elements.speedValue.textContent = `${speed}x`
    
    await chrome.storage.sync.set({ speed })
  }

  async updateVolume(e) {
    const volume = parseFloat(e.target.value)
    this.elements.volumeValue.textContent = `${Math.round(volume * 100)}%`
    
    await chrome.storage.sync.set({ volume })
  }

  async testApiConnection() {
    this.setStatus('Testing API connection...', 'info')
    this.showAIResult('Connecting to Groq API...')

    try {
      const result = await chrome.runtime.sendMessage({ action: 'TEST_API' })
      console.log('API test result:', result)

      if (result?.ok) {
        this.showAIResult('✅ API Connection Working: ' + result.message)
        this.setStatus('API connection successful', 'success')
      } else {
        this.showAIResult('❌ API Connection Failed: ' + (result?.error || 'Unknown error'))
        this.setStatus('API connection failed', 'error')
      }
    } catch (e) {
      console.error('API test error:', e)
      this.showAIResult('❌ API Test Error: ' + e.message)
      this.setStatus('API test failed', 'error')
    }
  }

  async explainSelected() {
    console.log('explainSelected called, hasApiKey:', this.hasApiKey)
    
    if (!this.hasApiKey) {
      this.setStatus('API key required - go to settings', 'error')
      this.showAIResult('❌ No API key configured. Click the settings button to add your Groq API key.')
      return
    }

    try {
      const selection = await this.sendMessage('GET_SELECTION')
      console.log('Selection result:', selection)
      
      if (!selection?.text?.trim()) {
        this.setStatus('Select text on the page first', 'error')
        this.showAIResult('❌ No text selected. Please select some text on the page first.')
        return
      }

      this.setStatus('AI is explaining...', 'info')
      this.showAIResult('🤖 Getting AI explanation...')

      const result = await chrome.runtime.sendMessage({
        action: 'AI_EXPLAIN',
        payload: { text: selection.text }
      })
      
      console.log('AI explain result:', result)

      if (result?.ok) {
        this.showAIResult('✅ ' + result.text)
        this.setStatus('Explanation ready', 'success')
        this.sendMessage('SPEAK_TEXT', { text: result.text })
      } else {
        this.showAIResult('❌ ' + (result?.error || 'Explanation failed'))
        this.setStatus('AI explanation failed', 'error')
      }
    } catch (e) {
      console.error('AI error:', e)
      this.showAIResult('❌ Error: ' + e.message)
      this.setStatus('AI error', 'error')
    }
  }

  async summarizeSelected() {
    if (!this.hasApiKey) {
      this.setStatus('API key required for AI features', 'error')
      return
    }

    const selection = await this.sendMessage('GET_SELECTION')
    if (!selection?.text?.trim()) {
      this.setStatus('Select text on the page first', 'error')
      return
    }

    this.setStatus('AI is summarizing selection...', 'info')
    this.showAIResult('Analyzing selected text...')

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'AI_SUMMARIZE_SELECTION',
        payload: { text: selection.text, site: this.currentSite }
      })

      if (result?.ok) {
        this.showAIResult(result.text)
        this.setStatus('Selection summary ready', 'success')
        this.sendMessage('SPEAK_TEXT', { text: result.text })
      } else {
        this.showAIResult(result?.error || 'Summarization failed')
        this.setStatus('AI summarization failed', 'error')
      }
    } catch (e) {
      this.showAIResult('Error: ' + e.message)
      this.setStatus('AI error', 'error')
    }
  }

  async generateSiteSummary() {
    if (!this.hasApiKey) {
      this.setStatus('API key required for AI features', 'error')
      return
    }

    this.setStatus('AI is analyzing entire site...', 'info')
    this.showAIResult('Extracting and analyzing content...')

    try {
      const content = await this.sendMessage('GET_FULL_CONTENT')
      if (!content) {
        this.setStatus('Could not extract site content', 'error')
        return
      }

      const result = await chrome.runtime.sendMessage({
        action: 'AI_SITE_SUMMARY',
        payload: { ...content, site: this.currentSite }
      })

      if (result?.ok) {
        this.showAIResult(result.text)
        this.setStatus('Site summary ready', 'success')
        this.sendMessage('SPEAK_TEXT', { text: result.text })
      } else {
        this.showAIResult(result?.error || 'Site summary failed')
        this.setStatus('AI site summary failed', 'error')
      }
    } catch (e) {
      this.showAIResult('Error: ' + e.message)
      this.setStatus('AI error', 'error')
    }
  }

  showAIResult(text) {
    this.elements.aiResult.textContent = text
    this.elements.aiResult.style.display = 'block'
  }

  updateVoiceStatus(gender, accent) {
    const genderText = gender === 'any' ? 'Any' : gender.charAt(0).toUpperCase() + gender.slice(1)
    const accentMap = {
      'any': 'Any English',
      'en-US': 'American English',
      'en-GB': 'British English', 
      'fr-FR': 'French English',
      'es-ES': 'Spanish English'
    }
    const accentText = accentMap[accent] || accent
    this.elements.voiceStatus.textContent = `Voice: ${genderText} ${accentText}`
  }

  openSettings() {
    try {
      chrome.runtime.openOptionsPage()
    } catch (e) {
      console.error('Could not open options page:', e)
      this.setStatus('Settings page not available', 'error')
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AIReader()
})

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.source === 'content' && msg.action === 'STATUS_UPDATE') {
    const reader = window.aiReader
    if (reader) {
      reader.setStatus(msg.payload.text, msg.payload.type || 'info')
    }
  }
})
