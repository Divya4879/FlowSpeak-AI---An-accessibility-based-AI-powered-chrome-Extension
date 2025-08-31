// Settings management
async function saveApiKey() {
  const apiKey = document.getElementById('apiKey').value.trim()
  if (!apiKey) {
    showStatus('keyStatus', 'Please enter an API key', 'error')
    return
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'STORE_API_KEY',
      payload: { key: apiKey }
    })
    showStatus('keyStatus', 'API key saved successfully!', 'success')
    document.getElementById('apiKey').value = ''
  } catch (e) {
    showStatus('keyStatus', 'Failed to save API key: ' + e.message, 'error')
  }
}

async function testApiKey() {
  showStatus('keyStatus', 'Testing connection...', 'success')
  
  try {
    const result = await chrome.runtime.sendMessage({ action: 'TEST_API' })
    
    if (result?.ok) {
      showStatus('keyStatus', '✅ Connection successful! ' + result.message, 'success')
    } else {
      showStatus('keyStatus', '❌ Test failed: ' + (result?.error || 'Unknown error'), 'error')
    }
  } catch (e) {
    showStatus('keyStatus', '❌ Test failed: ' + e.message, 'error')
  }
}

async function saveVoiceSettings() {
  const voiceGender = document.getElementById('voiceGender').value
  const voiceAccent = document.getElementById('voiceAccent').value
  const speed = parseFloat(document.getElementById('speed').value)
  const volume = parseFloat(document.getElementById('volume').value)

  try {
    await chrome.storage.sync.set({
      voiceGender,
      voiceAccent,
      speed,
      volume
    })
    showStatus('speechStatus', 'Voice settings saved successfully!', 'success')
  } catch (e) {
    showStatus('speechStatus', 'Failed to save settings: ' + e.message, 'error')
  }
}

function testSpeech() {
  const text = 'This is a test of the speech synthesis system with your selected voice preferences.'
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = parseFloat(document.getElementById('speed').value)
  utterance.volume = parseFloat(document.getElementById('volume').value)
  
  // Apply voice preferences
  const voiceGender = document.getElementById('voiceGender').value
  const voiceAccent = document.getElementById('voiceAccent').value
  
  // Force reload voices
  const voices = speechSynthesis.getVoices()
  console.log('Test speech - Available voices:', voices.map(v => ({ name: v.name, lang: v.lang })))
  
  const selectedVoice = findBestVoice(voiceGender, voiceAccent)
  if (selectedVoice) {
    utterance.voice = selectedVoice
    console.log('Test using voice:', selectedVoice.name, selectedVoice.lang)
  }
  
  speechSynthesis.speak(utterance)
  showStatus('speechStatus', `Testing with voice: ${selectedVoice?.name || 'default'}`, 'success')
}

function findBestVoice(gender, accent) {
  const voices = speechSynthesis.getVoices()
  console.log('Options - Finding voice with:', gender, accent)
  console.log('All available voices:', voices.map(v => `${v.name} (${v.lang})`))
  
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
  
  const key = `${gender}-${accent}`
  
  if (gender === 'any' || accent === 'any') {
    return voices.find(v => v.lang.startsWith('en')) || voices[0]
  }
  
  const patterns = voicePatterns[key] || []
  
  // Try pattern matching
  for (const pattern of patterns) {
    const voice = voices.find(v => v.name.toLowerCase().includes(pattern))
    if (voice) {
      console.log('Found pattern match:', voice.name)
      return voice
    }
  }
  
  // Language-specific fallback
  const langVoices = voices.filter(v => v.lang.startsWith(accent))
  
  if (langVoices.length > 0) {
    // For French and Spanish, use any available voice
    if (accent === 'fr-FR' || accent === 'es-ES') {
      return langVoices[0]
    }
    
    if (gender === 'male') {
      const maleVoice = langVoices.find(v => !v.name.toLowerCase().includes('female'))
      if (maleVoice) return maleVoice
    } else if (gender === 'female') {
      const femaleVoice = langVoices.find(v => v.name.toLowerCase().includes('female'))
      if (femaleVoice) return femaleVoice
    }
    
    return langVoices[0]
  }
  
  return voices.find(v => v.lang.startsWith('en')) || voices[0]
}

function showStatus(elementId, message, type) {
  const element = document.getElementById(elementId)
  element.textContent = message
  element.className = `status ${type}`
  element.style.display = 'block'
  
  setTimeout(() => {
    element.style.display = 'none'
  }, 3000)
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('saveKey').addEventListener('click', saveApiKey)
  document.getElementById('testKey').addEventListener('click', testApiKey)
  document.getElementById('testSpeech').addEventListener('click', testSpeech)
  document.getElementById('saveVoiceSettings').addEventListener('click', saveVoiceSettings)
  
  // Auto-save voice settings when changed
  document.getElementById('voiceGender').addEventListener('change', saveVoiceSettings)
  document.getElementById('voiceAccent').addEventListener('change', saveVoiceSettings)
  
  // Speed slider
  document.getElementById('speed').addEventListener('input', async (e) => {
    document.getElementById('speedValue').textContent = e.target.value + 'x'
    await chrome.storage.sync.set({ speed: parseFloat(e.target.value) })
  })
  
  // Volume slider
  document.getElementById('volume').addEventListener('input', async (e) => {
    document.getElementById('volumeValue').textContent = Math.round(e.target.value * 100) + '%'
    await chrome.storage.sync.set({ volume: parseFloat(e.target.value) })
  })
  
  // Load saved settings
  try {
    const settings = await chrome.storage.sync.get(['voiceGender', 'voiceAccent', 'speed', 'volume'])
    
    if (settings.voiceGender) document.getElementById('voiceGender').value = settings.voiceGender
    if (settings.voiceAccent) document.getElementById('voiceAccent').value = settings.voiceAccent
    if (settings.speed) {
      document.getElementById('speed').value = settings.speed
      document.getElementById('speedValue').textContent = settings.speed + 'x'
    }
    if (settings.volume) {
      document.getElementById('volume').value = settings.volume
      document.getElementById('volumeValue').textContent = Math.round(settings.volume * 100) + '%'
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  
  // Check API key status
  chrome.runtime.sendMessage({ action: 'GET_KEY_STATUS' }).then(result => {
    if (result?.hasKey) {
      document.getElementById('apiKey').placeholder = 'API key is configured - enter new key to update'
    }
  })
})
