# AI Accessibility Reader

Advanced AI-powered screen reader with intelligent content analysis, customizable voice options, site summaries, code explanations, and seamless navigation for AO3 and DEV.to.

## 🚀 Local Installation

### Step 1: Download the Extension
1. **Download** or **clone** this repository to your computer
2. **Extract** the files if downloaded as ZIP
3. **Navigate** to the `test-extension` folder

### Step 2: Load Extension in Chrome
1. **Open Chrome** browser
2. **Go to**: `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top-right corner)
4. **Click "Load unpacked"**
5. **Select** the `test-extension` folder
6. **Extension loads** and appears in your extensions list

### Step 3: Get Groq API Key (Required for AI Features)
1. **Visit**: [Groq Console](https://console.groq.com/keys)
2. **Sign up** for free account
3. **Create new API key**
4. **Copy** the API key

### Step 4: Configure Extension
1. **Click** the extension icon in Chrome toolbar
2. **Click "Settings"** (⚙️ button)
3. **Paste your API key** in the text field
4. **Click "Save API Key"**
5. **Click "Test Connection"** to verify it works

### Step 5: Start Using
1. **Visit any website** (try dev.to or archiveofourown.org)
2. **Click the extension icon**
3. **Click "Play"** to start reading
4. **Use AI features** to explain text or summarize content

## 🎧 Features

### Core Reading
- **Text-to-Speech**: Natural voice reading of web content
- **Smart Navigation**: Jump between headings, sections, chapters
- **Speed Control**: Adjust reading speed (0.5x - 2.5x)
- **Volume Control**: Customize audio volume
- **Voice Options**: Choose gender (Male/Female) and accent preferences

### Voice Customization
- **Gender Selection**: Male or Female voice options
- **Accent Options**: 
  - American English
  - British English
  - French English (French accent)
  - Spanish English (Spanish accent)
- **Voice Status Display**: Shows current voice settings in popup

### AI-Powered Features
- **🤖 Explain Selected**: AI explains any selected text
- **📝 Summarize Selected**: AI summarizes selected content
- **📊 Site Summary**: Comprehensive AI analysis of entire page
- **💻 Code Explanation**: Automatic AI analysis of code blocks
- **Rate Limit Handling**: Automatic retry for API limits

### Specialized Support
- **📚 AO3**: Chapter navigation, story summaries
- **💻 DEV.to**: Technical content optimization, code analysis
- **🌐 Universal**: Works on all websites

## 🎮 How to Use

### Basic Reading
1. **Visit any webpage**
2. **Click extension icon**
3. **Click "Play"** to start reading
4. **Use "Pause"/"Stop"** to control playback

### Voice Customization
1. **Right-click extension icon** → **Options**
2. **Select Voice Gender**: Male or Female
3. **Select Accent**: American, British, French, or Spanish English
4. **Click "Test Speech"** to preview
5. **Settings save automatically**

### Navigation
- **Next/Prev Heading**: Jump between H2, H3, H4 headings (DEV.to)
- **Next/Prev Section**: Navigate paragraphs and lists
- **Next/Prev Chapter**: AO3 chapter navigation

### AI Features
1. **Select text** on any webpage
2. **Click "Explain Selected"** for AI explanation
3. **Click "Site Summary"** for full page analysis
4. **Code blocks** get automatic AI explanations

## ⚙️ Settings

### Speech Settings
- **Voice Gender**: Male or Female
- **Voice Accent**: American, British, French, or Spanish English
- **Reading Speed**: 0.5x to 2.5x speed
- **Volume**: 0% to 100% volume
- **Test Speech**: Preview voice settings
- **Auto-Save**: Settings save automatically when changed

### AI Configuration
- **API Key**: Your Groq API key for AI features
- **Test Connection**: Verify API key works
- **Model**: Uses llama-3.1-8b-instant (free tier)

## 🔧 Troubleshooting

### Extension Not Loading
- **Check**: Developer mode is enabled
- **Verify**: Selected correct `test-extension` folder
- **Reload**: Click refresh icon on extension

### AI Features Not Working
- **Check**: API key is saved in settings
- **Test**: Click "Test Connection" in settings
- **Rate Limits**: Extension automatically retries on 429 errors
- **Verify**: You have internet connection

### Voice Not Changing
- **Check**: Voice settings are saved in Options
- **Reload**: Refresh the webpage after changing voice settings
- **System Voices**: Extension uses available system voices
- **Test**: Use "Test Speech" to verify voice selection

### No Speech Output
- **Check**: Volume is not muted
- **Verify**: Browser has audio permissions
- **Test**: Use "Test Speech" in settings

## 📁 File Structure

```
test-extension/
├── manifest.json          # Extension configuration
├── popup.html             # Main interface
├── popup.js               # Interface logic
├── popup.css              # Interface styling
├── content.js             # Page content analysis & voice handling
├── content.css            # Content styling
├── background.js          # AI API handling with retry logic
├── options.html           # Settings page with voice options
├── options.js             # Settings logic with auto-save
├── icon16.png             # Extension icon (16px)
├── icon48.png             # Extension icon (48px)
└── icon128.png            # Extension icon (128px)
```

## 🔒 Privacy

- **Local Storage**: API keys and voice settings stored locally in browser
- **No Data Collection**: Extension doesn't collect personal data
- **Secure API**: AI requests sent directly to Groq (not stored)
- **Minimal Permissions**: Only accesses current tab content

## 📝 Version

**Current Version**: 9.0.0

### What's New in v9.0.0
- **Voice Customization**: Male/Female gender selection
- **Accent Options**: American, British, French, Spanish English
- **Voice Status Display**: Shows current voice in popup
- **Auto-Save Settings**: Voice preferences save automatically
- **Improved API Handling**: Better rate limit management
- **Enhanced Voice Selection**: Intelligent voice matching

## 🆘 Support

If you encounter issues:
1. **Check** all steps above are completed
2. **Verify** API key is working with "Test Connection"
3. **Test** voice settings with "Test Speech"
4. **Reload** the extension from `chrome://extensions/`
5. **Check** browser console for error messages

---

**Enjoy accessible web browsing with AI-powered assistance and customizable voices!** 🎉
# FlowSpeak-AI---An-accessibility-based-AI-powered-chrome-Extension
