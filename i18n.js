// i18n.js - Simple i18n loader for Tetris
async function loadLanguage(lang) {
  try {
    const res = await fetch(`i18n/${lang}.json`)
    if (!res.ok) throw new Error('Not found')
    return await res.json()
  } catch {
    return null
  }
}

async function initI18n() {
  const userLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase()
  let lang = userLang.startsWith('zh') ? 'zh' : 'en'
  let dict = await loadLanguage(lang)
  if (!dict) dict = await loadLanguage('en')
  if (!dict) return
  updatePageContent(dict)
}

function updatePageContent(t) {
  if (t.title) {
    document.title = t.title
    const h1 = document.querySelector('h1')
    if (h1) h1.textContent = t.title
  }
  const widthLabel = document.querySelector('label[for="width-input"]')
  if (widthLabel && t.widthLabel) widthLabel.textContent = t.widthLabel
  const heightLabel = document.querySelector('label[for="height-input"]')
  if (heightLabel && t.heightLabel) heightLabel.textContent = t.heightLabel
  const startBtn = document.getElementById('start-button')
  if (startBtn && t.startButton) startBtn.textContent = t.startButton
  const controlsInfo = document.querySelector('.controls-info')
  if (controlsInfo && t.controlsInfo) controlsInfo.textContent = t.controlsInfo
}

document.addEventListener('DOMContentLoaded', initI18n)
