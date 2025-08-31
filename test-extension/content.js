console.log('AI Reader content script loaded')

class ContentReader {
  constructor() {
    this.state = {
      queue: [],
      idx: -1,
      speaking: false,
      paused: false,
      speed: 1.0,
      volume: 1.0,
      voiceGender: 'any',
      voiceAccent: 'any',
      lastSelection: ''
    }
    this.currentHighlighted = null
    this.init()
  }

  async init() {
    console.log('AI Reader initialized on:', window.location.hostname)
    this.loadVoices()
    this.setupSelectionTracking()
    await this.loadVoiceSettings()
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.voiceGender) this.state.voiceGender = changes.voiceGender.newValue
      if (changes.voiceAccent) this.state.voiceAccent = changes.voiceAccent.newValue
      if (changes.speed) this.state.speed = changes.speed.newValue
      if (changes.volume) this.state.volume = changes.volume.newValue
    })
  }

  async loadVoiceSettings() {
    try {
      const settings = await chrome.storage.sync.get(['voiceGender', 'voiceAccent', 'speed', 'volume'])
      
      if (settings.voiceGender) this.state.voiceGender = settings.voiceGender
      if (settings.voiceAccent) this.state.voiceAccent = settings.voiceAccent
      if (settings.speed) this.state.speed = settings.speed
      if (settings.volume) this.state.volume = settings.volume
    } catch (e) {
      console.error('Failed to load voice settings:', e)
    }
  }

  loadVoices() {
    this.voices = speechSynthesis.getVoices()
    console.log('Initial voices loaded:', this.voices.length)
    
    speechSynthesis.onvoiceschanged = () => {
      this.voices = speechSynthesis.getVoices()
      console.log('Voices updated:', this.voices.length)
    }
  }

  setupSelectionTracking() {
    document.addEventListener('mouseup', () => {
      const selection = window.getSelection()
      if (selection) {
        const text = selection.toString()
        if (text && text.trim()) {
          this.state.lastSelection = text.trim()
        }
      }
    })
  }

  buildQueue() {
    const queue = []
    const hostname = window.location.hostname

    if (hostname.includes('archiveofourown.org')) {
      this.buildAO3Queue(queue)
    } else if (hostname.includes('dev.to')) {
      this.buildDevToQueue(queue)
    } else {
      this.buildGenericQueue(queue)
    }

    return queue
  }

  buildAO3Queue(queue) {
    const title = document.querySelector('.title.heading, h2.title')
    if (title && title.textContent) {
      queue.push({ type: 'title', text: 'Story: ' + title.textContent.trim(), el: document.body })
    }

    const author = document.querySelector('.byline a[rel="author"]')
    if (author && author.textContent) {
      queue.push({ type: 'author', text: 'By ' + author.textContent.trim(), el: document.body })
    }

    const summary = document.querySelector('.summary .userstuff')
    if (summary && summary.textContent) {
      queue.push({ type: 'summary', text: 'Summary: ' + summary.textContent.trim(), el: document.body })
    }

    const chaptersContainer = document.getElementById('chapters')
    if (chaptersContainer) {
      const chapters = chaptersContainer.querySelectorAll('[id^="chapter-"]')
      chapters.forEach((chapter, index) => {
        const chapterNum = index + 1
        const chapterTitle = chapter.querySelector('h3.title, .title')
        let chapterText = 'Chapter ' + chapterNum
        
        if (chapterTitle && chapterTitle.textContent && chapterTitle.textContent.trim() !== 'Chapter Text') {
          chapterText += ': ' + chapterTitle.textContent.trim()
        }

        queue.push({
          type: 'chapter',
          text: chapterText,
          el: chapter,
          chapterNumber: chapterNum,
          chapterId: chapter.id
        })

        const paragraphs = chapter.querySelectorAll('.userstuff p')
        paragraphs.forEach(p => {
          if (p.textContent && p.textContent.trim().length > 5) {
            queue.push({
              type: 'chapter-content',
              text: p.textContent.trim(),
              el: p,
              chapter: chapterNum
            })
          }
        })
      })
    }
  }

  buildDevToQueue(queue) {
    const title = document.querySelector('h1')
    if (title && title.textContent) {
      queue.push({ type: 'title', text: title.textContent.trim(), el: document.body })
    }

    const tags = document.querySelectorAll('.crayons-tag, .tag')
    if (tags.length > 0) {
      const tagTexts = Array.from(tags).map(tag => tag.textContent.trim()).filter(Boolean)
      if (tagTexts.length > 0) {
        queue.push({ type: 'tags', text: 'Tags: ' + tagTexts.join(', '), el: document.body })
      }
    }

    const author = document.querySelector('.crayons-story__author')
    if (author && author.textContent) {
      queue.push({ type: 'author', text: 'Author: ' + author.textContent.trim(), el: document.body })
    }

    const articleMain = document.querySelector('.crayons-article__main')
    if (articleMain) {
      const walker = document.createTreeWalker(articleMain, NodeFilter.SHOW_ELEMENT, null, false)
      const processedElements = new Set()

      while (walker.nextNode()) {
        const el = walker.currentNode
        
        if (processedElements.has(el)) continue
        processedElements.add(el)

        if (/^H[2-4]$/.test(el.tagName)) {
          if (el.textContent && el.textContent.trim().length > 2) {
            queue.push({
              type: 'heading',
              text: el.textContent.trim(),
              el: el,
              level: parseInt(el.tagName[1])
            })
          }
        }
        else if (el.tagName === 'P') {
          if (el.textContent && el.textContent.trim().length > 5) {
            queue.push({
              type: 'section',
              text: el.textContent.trim(),
              el: el
            })
          }
        }
        else if (el.tagName === 'LI') {
          if (el.textContent && el.textContent.trim().length > 3) {
            queue.push({
              type: 'section',
              text: 'List item: ' + el.textContent.trim(),
              el: el
            })
          }
        }
        else if (el.tagName === 'PRE' || el.tagName === 'CODE') {
          if (el.textContent && el.textContent.trim().length > 10) {
            const language = this.detectCodeLanguage(el)
            queue.push({
              type: 'code',
              text: 'Code snippet' + (language ? ' in ' + language : '') + ' - getting AI explanation...',
              el: el,
              originalCode: el.textContent.trim(),
              language: language
            })
            this.explainCodeWithAI(el.textContent.trim(), language, queue.length - 1)
          }
        }
        else if (el.tagName === 'IMG') {
          const alt = el.getAttribute('alt')
          const src = el.getAttribute('src')
          let imageText = 'Image'
          
          if (alt && alt.trim()) {
            imageText += ': ' + alt.trim()
          } else if (src) {
            const filename = src.split('/').pop().split('?')[0]
            imageText += ': ' + filename
          }
          
          queue.push({ type: 'image', text: imageText, el: el })
        }
        else if (el.tagName === 'IFRAME' || el.classList.contains('embed')) {
          const src = el.getAttribute('src') || el.getAttribute('data-src')
          let embedText = 'Embedded content'
          
          if (src) {
            if (src.includes('youtube.com') || src.includes('youtu.be')) {
              embedText = 'YouTube video embed'
            } else if (src.includes('codepen.io')) {
              embedText = 'CodePen embed'
            } else if (src.includes('twitter.com')) {
              embedText = 'Twitter embed'
            } else if (src.includes('github.com')) {
              embedText = 'GitHub embed'
            } else {
              embedText = 'External content embed from ' + new URL(src).hostname
            }
          }
          
          queue.push({ type: 'embed', text: embedText, el: el })
        }
        else if (el.tagName === 'A' && el.href) {
          const linkText = el.textContent.trim()
          if (linkText && linkText.length > 1) {
            queue.push({ type: 'link', text: 'Link: ' + linkText, el: el })
          }
        }
      }
    }
  }

  buildGenericQueue(queue) {
    if (document.title) {
      queue.push({ type: 'title', text: document.title.trim(), el: document.body })
    }

    const paragraphs = document.querySelectorAll('p')
    paragraphs.forEach(p => {
      if (p.textContent && p.textContent.trim().length > 10) {
        queue.push({ type: 'paragraph', text: p.textContent.trim(), el: p })
      }
    })
  }

  findBestVoice() {
    if (!this.voices || this.voices.length === 0) {
      this.voices = speechSynthesis.getVoices()
    }
    
    console.log('Finding voice with preferences:', this.state.voiceGender, this.state.voiceAccent)
    console.log('All available voices:', this.voices.map(v => `${v.name} (${v.lang})`))
    
    // Specific voice patterns for each accent/gender combo
    const voicePatterns = {
      'male-en-US': ['david', 'alex', 'us english male', 'american male'],
      'female-en-US': ['zira', 'samantha', 'us english female', 'american female'],
      'male-en-GB': ['george', 'daniel', 'uk english male', 'british male'],
      'female-en-GB': ['hazel', 'kate', 'uk english female', 'british female'],
      'male-fr-FR': ['fr-fr', 'french', 'france'],
      'female-fr-FR': ['fr-fr', 'french', 'france'],
      'male-es-ES': ['es-es', 'spanish', 'spain'],
      'female-es-ES': ['es-es', 'spanish', 'spain']
    }
    
    const key = `${this.state.voiceGender}-${this.state.voiceAccent}`
    console.log('Looking for voice key:', key)
    
    if (this.state.voiceGender === 'any' || this.state.voiceAccent === 'any') {
      const englishVoice = this.voices.find(v => v.lang.startsWith('en'))
      console.log('Using default English voice:', englishVoice?.name)
      return englishVoice || this.voices[0]
    }
    
    const patterns = voicePatterns[key] || []
    
    // Try pattern matching
    for (const pattern of patterns) {
      const voice = this.voices.find(v => v.name.toLowerCase().includes(pattern))
      if (voice) {
        console.log('Found pattern match:', voice.name, 'for pattern:', pattern)
        return voice
      }
    }
    
    // Language-specific fallback with strict gender matching
    const langVoices = this.voices.filter(v => v.lang.startsWith(this.state.voiceAccent))
    console.log('Voices for language:', this.state.voiceAccent, langVoices.map(v => v.name))
    
    if (langVoices.length > 0) {
      // For French and Spanish, use any available voice regardless of gender
      if (this.state.voiceAccent === 'fr-FR' || this.state.voiceAccent === 'es-ES') {
        console.log('Using first available voice for accent:', langVoices[0].name)
        return langVoices[0]
      }
      
      // Gender-specific selection for English accents
      if (this.state.voiceGender === 'male') {
        const maleVoice = langVoices.find(v => !v.name.toLowerCase().includes('female'))
        if (maleVoice) {
          console.log('Found male voice:', maleVoice.name)
          return maleVoice
        }
      } else if (this.state.voiceGender === 'female') {
        const femaleVoice = langVoices.find(v => v.name.toLowerCase().includes('female'))
        if (femaleVoice) {
          console.log('Found female voice:', femaleVoice.name)
          return femaleVoice
        }
      }
      
      console.log('Using first voice for language:', langVoices[0].name)
      return langVoices[0]
    }
    
    const fallback = this.voices.find(v => v.lang.startsWith('en')) || this.voices[0]
    console.log('Using fallback voice:', fallback?.name)
    return fallback
  }

  speak(text) {
    if (!text || !text.trim()) return

    text = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')

    try {
      speechSynthesis.cancel()
      
      // Force reload voices if empty
      if (this.voices.length === 0) {
        this.voices = speechSynthesis.getVoices()
        if (this.voices.length === 0) {
          // Wait a bit and try again
          setTimeout(() => {
            this.voices = speechSynthesis.getVoices()
            this.speak(text)
          }, 100)
          return
        }
      }
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = this.state.speed
      utterance.volume = this.state.volume

      const selectedVoice = this.findBestVoice()
      if (selectedVoice) {
        utterance.voice = selectedVoice
        console.log('Speaking with voice:', selectedVoice.name, 'Lang:', selectedVoice.lang)
      }

      utterance.onend = () => {
        this.state.speaking = false
        if (!this.state.paused) {
          this.next()
        }
      }

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.error('Speech error:', e.error)
        }
        this.state.speaking = false
      }

      this.state.speaking = true
      speechSynthesis.speak(utterance)
    } catch (e) {
      console.error('Speech failed:', e)
      this.state.speaking = false
    }
  }

  play() {
    if (this.state.queue.length === 0) {
      this.state.queue = this.buildQueue()
    }
    
    if (this.state.idx < 0) this.state.idx = 0
    
    const current = this.state.queue[this.state.idx]
    if (current) {
      this.highlightCurrentElement(current.el)
      this.speak(current.text)
    }
  }

  highlightCurrentElement(element) {
    // Remove previous highlight
    this.removeHighlight()
    
    // Add highlight to current element
    if (element && element.classList) {
      element.classList.add('ai-reader-highlight')
      this.currentHighlighted = element
      
      // Smart scroll based on element position
      const elementRect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const scrollTop = window.pageYOffset
      
      // Calculate optimal scroll position
      let targetScroll
      if (elementRect.top < 100) {
        // Element is above viewport, scroll up
        targetScroll = scrollTop + elementRect.top - 150
      } else if (elementRect.bottom > viewportHeight - 100) {
        // Element is below viewport, scroll down
        targetScroll = scrollTop + elementRect.top - 150
      } else {
        // Element is visible, center it
        targetScroll = scrollTop + elementRect.top - (viewportHeight / 2) + (elementRect.height / 2)
      }
      
      // Smooth scroll to target position
      window.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      })
    }
  }

  removeHighlight() {
    if (this.currentHighlighted) {
      this.currentHighlighted.classList.remove('ai-reader-highlight')
      this.currentHighlighted = null
    }
  }

  next() {
    if (this.state.idx < this.state.queue.length - 1) {
      this.state.idx++
      this.play()
    } else {
      this.removeHighlight()
      this.stop()
    }
  }

  pause() {
    speechSynthesis.pause()
    this.state.paused = true
  }

  resume() {
    speechSynthesis.resume()
    this.state.paused = false
  }

  stop() {
    speechSynthesis.cancel()
    this.removeHighlight()
    this.state.speaking = false
    this.state.paused = false
    this.state.idx = -1
  }

  nextHeading() {
    if (window.location.hostname.includes('dev.to')) {
      for (let i = this.state.idx + 1; i < this.state.queue.length; i++) {
        const item = this.state.queue[i]
        if (item.type === 'heading' && item.level >= 2 && item.level <= 4) {
          this.state.idx = i
          this.play()
          return
        }
      }
    } else {
      for (let i = this.state.idx + 1; i < this.state.queue.length; i++) {
        if (this.state.queue[i].type === 'heading') {
          this.state.idx = i
          this.play()
          return
        }
      }
    }
  }

  prevHeading() {
    if (window.location.hostname.includes('dev.to')) {
      for (let i = this.state.idx - 1; i >= 0; i--) {
        const item = this.state.queue[i]
        if (item.type === 'heading' && item.level >= 2 && item.level <= 4) {
          this.state.idx = i
          this.play()
          return
        }
      }
    } else {
      for (let i = this.state.idx - 1; i >= 0; i--) {
        if (this.state.queue[i].type === 'heading') {
          this.state.idx = i
          this.play()
          return
        }
      }
    }
  }

  nextSection() {
    if (window.location.hostname.includes('dev.to')) {
      for (let i = this.state.idx + 1; i < this.state.queue.length; i++) {
        if (this.state.queue[i].type === 'section') {
          this.state.idx = i
          this.play()
          return
        }
      }
    } else {
      for (let i = this.state.idx + 1; i < this.state.queue.length; i++) {
        const item = this.state.queue[i]
        if (item.type === 'paragraph' || item.type === 'content') {
          this.state.idx = i
          this.play()
          return
        }
      }
    }
  }

  prevSection() {
    if (window.location.hostname.includes('dev.to')) {
      for (let i = this.state.idx - 1; i >= 0; i--) {
        if (this.state.queue[i].type === 'section') {
          this.state.idx = i
          this.play()
          return
        }
      }
    } else {
      for (let i = this.state.idx - 1; i >= 0; i--) {
        const item = this.state.queue[i]
        if (item.type === 'paragraph' || item.type === 'content') {
          this.state.idx = i
          this.play()
          return
        }
      }
    }
  }

  nextChapter() {
    for (let i = this.state.idx + 1; i < this.state.queue.length; i++) {
      if (this.state.queue[i].type === 'chapter') {
        this.state.idx = i
        this.play()
        return
      }
    }
  }

  prevChapter() {
    for (let i = this.state.idx - 1; i >= 0; i--) {
      if (this.state.queue[i].type === 'chapter') {
        this.state.idx = i
        this.play()
        return
      }
    }
  }

  jumpToChapter(chapterNum) {
    if (this.state.queue.length === 0) {
      this.state.queue = this.buildQueue()
    }

    const chapterIdx = this.state.queue.findIndex(item => 
      item.type === 'chapter' && item.chapterNumber === chapterNum
    )

    if (chapterIdx >= 0) {
      this.state.idx = chapterIdx
      this.play()
      return true
    }

    return false
  }

  getAllChapters() {
    if (this.state.queue.length === 0) {
      this.state.queue = this.buildQueue()
    }

    return this.state.queue
      .filter(item => item.type === 'chapter')
      .map(item => ({
        text: item.text,
        number: item.chapterNumber || 1,
        id: item.chapterId || 'chapter-' + (item.chapterNumber || 1)
      }))
  }

  detectCodeLanguage(el) {
    const classes = el.className.toLowerCase()
    const languages = ['javascript', 'python', 'java', 'css', 'html', 'json', 'sql', 'bash', 'typescript', 'react', 'vue', 'go', 'rust', 'php', 'ruby']
    
    for (const lang of languages) {
      if (classes.includes(lang) || classes.includes('language-' + lang)) {
        return lang
      }
    }
    
    const dataLang = el.getAttribute('data-language')
    if (dataLang) return dataLang
    
    return null
  }

  async explainCodeWithAI(codeText, language, queueIndex) {
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'AI_EXPLAIN_CODE',
        payload: { 
          code: codeText, 
          language: language,
          context: 'DEV.to article code snippet'
        }
      })
      
      if (result && result.ok && this.state.queue[queueIndex]) {
        this.state.queue[queueIndex].text = result.text
      } else {
        if (this.state.queue[queueIndex]) {
          const lines = codeText.split('\n').length
          this.state.queue[queueIndex].text = 'Code snippet' + (language ? ' in ' + language : '') + ' with ' + lines + ' lines'
        }
      }
    } catch (e) {
      console.error('AI code explanation failed:', e)
      if (this.state.queue[queueIndex]) {
        const lines = codeText.split('\n').length
        this.state.queue[queueIndex].text = 'Code snippet' + (language ? ' in ' + language : '') + ' with ' + lines + ' lines'
      }
    }
  }

  getSelection() {
    const selection = window.getSelection()
    return {
      text: selection ? selection.toString().trim() : (this.state.lastSelection || '')
    }
  }

  getPageContent() {
    const title = document.title
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => h.textContent.trim())
      .filter(Boolean)
      .slice(0, 10)

    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 50)
      .slice(0, 20)

    return {
      title: title,
      headings: headings,
      content: paragraphs.join('\n\n')
    }
  }

  getFullContent() {
    const hostname = window.location.hostname
    
    if (hostname.includes('archiveofourown.org')) {
      return this.getAO3FullContent()
    } else if (hostname.includes('dev.to')) {
      return this.getDevToFullContent()
    } else {
      return this.getGenericFullContent()
    }
  }

  getAO3FullContent() {
    const title = document.querySelector('.title.heading, h2.title')
    const titleText = title ? title.textContent.trim() : ''
    
    const author = document.querySelector('.byline a[rel="author"]')
    const authorText = author ? author.textContent.trim() : ''
    
    const summary = document.querySelector('.summary .userstuff')
    const summaryText = summary ? summary.textContent.trim() : ''
    
    const tags = Array.from(document.querySelectorAll('.tag')).map(tag => tag.textContent.trim()).filter(Boolean)
    
    const rating = document.querySelector('.rating')
    const ratingText = rating ? rating.textContent.trim() : ''
    
    const warnings = Array.from(document.querySelectorAll('.warnings .tag')).map(w => w.textContent.trim()).filter(Boolean)
    
    let chapters = []
    const chaptersContainer = document.getElementById('chapters')
    if (chaptersContainer) {
      const chapterElements = chaptersContainer.querySelectorAll('[id^="chapter-"]')
      chapterElements.forEach((chapter, index) => {
        const chapterTitle = chapter.querySelector('h3.title, .title')
        const chapterTitleText = chapterTitle ? chapterTitle.textContent.trim() : 'Chapter ' + (index + 1)
        
        const chapterContent = Array.from(chapter.querySelectorAll('.userstuff p'))
          .map(p => p.textContent.trim())
          .filter(Boolean)
          .join('\n\n')
        
        chapters.push({
          title: chapterTitleText,
          content: chapterContent
        })
      })
    } else {
      const content = Array.from(document.querySelectorAll('#workskin p, .userstuff.module p'))
        .map(p => p.textContent.trim())
        .filter(Boolean)
        .join('\n\n')
      
      chapters.push({
        title: 'Chapter 1',
        content: content
      })
    }

    return {
      type: 'ao3',
      title: titleText,
      author: authorText,
      summary: summaryText,
      tags: tags,
      rating: ratingText,
      warnings: warnings,
      chapters: chapters,
      totalWords: chapters.reduce((sum, ch) => sum + ch.content.split(' ').length, 0)
    }
  }

  getDevToFullContent() {
    const title = document.querySelector('h1')
    const titleText = title ? title.textContent.trim() : ''
    
    const author = document.querySelector('.crayons-story__author')
    const authorText = author ? author.textContent.trim() : ''
    
    const tags = Array.from(document.querySelectorAll('.crayons-tag, .tag')).map(tag => tag.textContent.trim()).filter(Boolean)
    
    const publishDate = document.querySelector('time[datetime]')
    const publishDateText = publishDate ? publishDate.textContent.trim() : ''
    
    const articleMain = document.querySelector('.crayons-article__main')
    let sections = []
    let codeBlocks = []
    
    if (articleMain) {
      const headings = Array.from(articleMain.querySelectorAll('h2, h3, h4'))
        .map(h => ({
          level: parseInt(h.tagName[1]),
          text: h.textContent.trim()
        }))
      
      const paragraphs = Array.from(articleMain.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(Boolean)
      
      const lists = Array.from(articleMain.querySelectorAll('ul, ol'))
        .map(list => Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean))
        .flat()
      
      const codes = Array.from(articleMain.querySelectorAll('pre, code'))
        .map(code => ({
          language: this.detectCodeLanguage(code),
          code: code.textContent.trim()
        }))
        .filter(c => c.code.length > 10)
      
      sections = [...headings.map(h => h.text), ...paragraphs, ...lists]
      codeBlocks = codes
    }

    return {
      type: 'devto',
      title: titleText,
      author: authorText,
      tags: tags,
      publishDate: publishDateText,
      sections: sections,
      codeBlocks: codeBlocks,
      totalWords: sections.join(' ').split(' ').length
    }
  }

  getGenericFullContent() {
    const title = document.title
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => h.textContent.trim())
      .filter(Boolean)
    
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 20)
    
    return {
      type: 'generic',
      title: title,
      headings: headings,
      content: paragraphs,
      totalWords: paragraphs.join(' ').split(' ').length
    }
  }

  handleMessage(msg, sender, sendResponse) {
    switch (msg.action) {
      case 'PLAY':
        this.play()
        break
      case 'PAUSE':
        this.pause()
        break
      case 'RESUME':
        this.resume()
        break
      case 'STOP':
        this.stop()
        break
      case 'NEXT_HEADING':
        this.nextHeading()
        break
      case 'PREV_HEADING':
        this.prevHeading()
        break
      case 'NEXT_SECTION':
        this.nextSection()
        break
      case 'PREV_SECTION':
        this.prevSection()
        break
      case 'NEXT_CHAPTER':
        this.nextChapter()
        break
      case 'PREV_CHAPTER':
        this.prevChapter()
        break
      case 'JUMP_TO_CHAPTER':
        const found = this.jumpToChapter(msg.payload.number || 1)
        sendResponse({ found: found })
        return true
      case 'GET_ALL_CHAPTERS':
        const chapters = this.getAllChapters()
        sendResponse({ chapters: chapters })
        return true
      case 'GET_SELECTION':
        sendResponse(this.getSelection())
        return true
      case 'GET_PAGE_CONTENT':
        sendResponse(this.getPageContent())
        return true
      case 'GET_FULL_CONTENT':
        sendResponse(this.getFullContent())
        return true
      case 'SPEAK_TEXT':
        if (msg.payload && msg.payload.text) {
          this.speak(msg.payload.text)
        }
        break
      case 'SET_SPEED':
        this.state.speed = msg.payload.speed || 1.0
        break
      case 'SET_VOLUME':
        this.state.volume = msg.payload.volume || 1.0
        break
      case 'SET_VOICE_SETTINGS':
        if (msg.payload.voiceGender) this.state.voiceGender = msg.payload.voiceGender
        if (msg.payload.voiceAccent) this.state.voiceAccent = msg.payload.voiceAccent
        break
    }
  }
}

const contentReader = new ContentReader()

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  return contentReader.handleMessage(msg, sender, sendResponse)
})
