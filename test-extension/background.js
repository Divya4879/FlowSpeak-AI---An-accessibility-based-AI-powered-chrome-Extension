console.log('AI Reader background script loaded')

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender, sendResponse)
  return true
})

async function handleMessage(msg, sender, sendResponse) {
  switch (msg.action) {
    case 'GET_KEY_STATUS':
      const hasKey = await hasApiKey()
      sendResponse({ hasKey })
      break
    case 'STORE_API_KEY':
      await storeApiKey(msg.payload?.key)
      sendResponse({ success: true })
      break
    case 'TEST_API':
      const testResult = await testApiConnection()
      sendResponse(testResult)
      break
    case 'AI_EXPLAIN':
      const explanation = await explainText(msg.payload?.text)
      sendResponse(explanation)
      break
    case 'AI_EXPLAIN_CODE':
      const codeExplanation = await explainCode(msg.payload)
      sendResponse(codeExplanation)
      break
    case 'AI_SUMMARIZE_SELECTION':
      const selectionSummary = await summarizeSelection(msg.payload)
      sendResponse(selectionSummary)
      break
    case 'AI_SITE_SUMMARY':
      const siteSummary = await generateSiteSummary(msg.payload)
      sendResponse(siteSummary)
      break
    case 'AI_SUMMARIZE':
      const summary = await summarizeContent(msg.payload)
      sendResponse(summary)
      break
  }
}

async function getApiKey() {
  try {
    const result = await chrome.storage.local.get(['groq_api_key'])
    return result.groq_api_key
  } catch (e) {
    return null
  }
}

async function testApiConnection() {
  try {
    const response = await makeApiCall([{
      role: 'user',
      content: 'Say "API working"'
    }], 10)

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content?.trim()
    
    return { ok: true, message: result || 'API connected successfully' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function hasApiKey() {
  try {
    const result = await chrome.storage.local.get(['groq_api_key'])
    return !!result.groq_api_key
  } catch (e) {
    return false
  }
}

async function storeApiKey(key) {
  if (!key) return false
  try {
    await chrome.storage.local.set({ groq_api_key: key })
    return true
  } catch (e) {
    return false
  }
}

async function makeApiCall(messages, maxTokens = 150) {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('API key not configured')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.3
    })
  })

  if (response.status === 429) {
    // Wait 2 seconds and retry once
    await new Promise(resolve => setTimeout(resolve, 2000))
    const retryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.3
      })
    })
    
    if (!retryResponse.ok) {
      throw new Error(`API error: ${retryResponse.status}`)
    }
    return retryResponse
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response
}

async function explainText(text) {
  if (!text?.trim()) {
    return { ok: false, error: 'No text provided' }
  }

  try {
    const response = await makeApiCall([{
      role: 'user',
      content: `Explain briefly: "${text.slice(0, 500)}"`
    }], 100)

    const data = await response.json()
    const explanation = data.choices?.[0]?.message?.content?.trim()

    if (explanation) {
      return { ok: true, text: explanation }
    } else {
      return { ok: false, error: 'No explanation generated' }
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function explainCode(payload) {
  const { code, language, context } = payload
  
  if (!code?.trim()) {
    return { ok: false, error: 'No code provided' }
  }

  const apiKey = await getApiKey()
  if (!apiKey) {
    return { ok: false, error: 'API key not configured' }
  }

  try {
    const prompt = `Analyze this ${language || 'code'} snippet in detail:

CODE:
${code}

CONTEXT: ${context || 'Code from web article'}

Provide a comprehensive analysis including:
1. Programming Language: ${language || 'Identify the language'}
2. Implementation Details: How the code works step by step
3. Use Cases: When and why you would use this code
4. Efficiency: Time/space complexity and performance considerations
5. Best Practices: Code quality and potential improvements
6. Key Concepts: Important programming concepts demonstrated

Make it accessible and educational for screen reader users.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 600,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const explanation = data.choices?.[0]?.message?.content?.trim()

    if (explanation) {
      return { ok: true, text: `Code Analysis: ${explanation}` }
    } else {
      return { ok: false, error: 'No explanation generated' }
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function summarizeSelection(payload) {
  const { text, site } = payload
  
  if (!text?.trim()) {
    return { ok: false, error: 'No text provided' }
  }

  const apiKey = await getApiKey()
  if (!apiKey) {
    return { ok: false, error: 'API key not configured' }
  }

  try {
    const prompt = `Summarize this selected text from ${site || 'a website'} for accessibility users:

SELECTED TEXT:
${text}

Provide a clear, concise summary that captures the main points and key information. Make it well-structured and easy to understand when read aloud.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 400,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    if (summary) {
      return { ok: true, text: summary }
    } else {
      return { ok: false, error: 'No summary generated' }
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function generateSiteSummary(payload) {
  const apiKey = await getApiKey()
  if (!apiKey) {
    return { ok: false, error: 'API key not configured' }
  }

  try {
    let prompt = ''
    
    if (payload.type === 'ao3') {
      prompt = `Create a well-structured summary of this AO3 fanfiction. Format with clear sections and bullet points:

TITLE: ${payload.title}
AUTHOR: ${payload.author}
SUMMARY: ${payload.summary}
TAGS: ${payload.tags.join(', ')}
RATING: ${payload.rating}
CHAPTERS: ${payload.chapters.length}
TOTAL WORDS: ${payload.totalWords}

CONTENT PREVIEW:
${payload.chapters.slice(0, 2).map(ch => `${ch.title}: ${ch.content.slice(0, 500)}...`).join('\n\n')}

Format your response exactly like this:

STORY OVERVIEW:
• Brief plot summary in 2-3 sentences
• Main setting and time period

MAIN THEMES:
• Primary theme 1
• Primary theme 2
• Primary theme 3

CONTENT DETAILS:
• Rating: [rating and why]
• Length: ${payload.chapters.length} chapters, ${payload.totalWords} words
• Status: [complete/ongoing based on content]

WHAT TO EXPECT:
• Writing style and tone
• Character focus and relationships
• Target audience and appeal

Use bullet points and clear section headers for accessibility.`
    } else if (payload.type === 'devto') {
      prompt = `Create a well-structured summary of this DEV.to article. Format with clear sections and bullet points:

TITLE: ${payload.title}
AUTHOR: ${payload.author}
TAGS: ${payload.tags.join(', ')}
PUBLISHED: ${payload.publishDate}
WORD COUNT: ${payload.totalWords}

CONTENT SECTIONS:
${payload.sections.slice(0, 10).join('\n')}

CODE EXAMPLES: ${payload.codeBlocks.length} snippets in: ${payload.codeBlocks.map(c => c.language).filter(Boolean).join(', ')}

Format your response exactly like this:

ARTICLE OVERVIEW:
• Main topic and purpose in 2-3 sentences
• Problem being solved or concept explained

KEY TECHNICAL CONCEPTS:
• Primary technology/framework discussed
• Important programming concepts covered
• Tools and libraries mentioned

LEARNING OUTCOMES:
• What readers will learn
• Skills they will develop
• Practical applications

CODE EXAMPLES:
• Programming languages: ${payload.codeBlocks.map(c => c.language).filter(Boolean).join(', ')}
• Implementation details covered
• Difficulty level: [beginner/intermediate/advanced]

TARGET AUDIENCE:
• Recommended skill level
• Prerequisites needed
• Who will benefit most

Use bullet points and clear section headers for accessibility.`
    } else {
      prompt = `Create a well-structured summary of this website. Format with clear sections and bullet points:

TITLE: ${payload.title}
HEADINGS: ${payload.headings.join(', ')}
WORD COUNT: ${payload.totalWords}

CONTENT:
${payload.content.slice(0, 10).join('\n\n')}

Format your response exactly like this:

CONTENT OVERVIEW:
• Main topic and purpose in 2-3 sentences
• Type of content (article, guide, reference, etc.)

KEY INFORMATION:
• Most important points covered
• Primary insights or data presented
• Notable facts or statistics

CONTENT STRUCTURE:
• How information is organized
• Main sections and topics
• Flow and logical progression

TARGET AUDIENCE:
• Who this content is designed for
• Required background knowledge
• Primary use cases

Use bullet points and clear section headers for accessibility.`
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 700,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    if (summary) {
      return { ok: true, text: summary }
    } else {
      return { ok: false, error: 'No summary generated' }
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function summarizeContent(content) {
  if (!content?.content?.trim()) {
    return { ok: false, error: 'No content provided' }
  }

  const apiKey = await getApiKey()
  if (!apiKey) {
    return { ok: false, error: 'API key not configured' }
  }

  try {
    const prompt = `Summarize this content for accessibility:\n\nTitle: ${content.title}\n\nContent: ${content.content.slice(0, 2000)}`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 300,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    if (summary) {
      return { ok: true, text: summary }
    } else {
      return { ok: false, error: 'No summary generated' }
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
