// i18n.js — Internationalization for MediaDownloader
(function() {
  const LANGUAGES = [
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'zh', flag: '🇨🇳', name: '中文' },
    { code: 'ja', flag: '🇯🇵', name: '日本語' },
    { code: 'ko', flag: '🇰🇷', name: '한국어' },
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'fr', flag: '🇫🇷', name: 'Français' },
    { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
    { code: 'pt', flag: '🇧🇷', name: 'Português' },
    { code: 'ru', flag: '🇷🇺', name: 'Русский' },
    { code: 'ar', flag: '🇸🇦', name: 'العربية' },
    { code: 'hi', flag: '🇮🇳', name: 'हिन्दी' },
    { code: 'th', flag: '🇹🇭', name: 'ไทย' },
    { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
    { code: 'id', flag: '🇮🇩', name: 'Indonesia' },
    { code: 'ms', flag: '🇲🇾', name: 'Melayu' },
    { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
    { code: 'it', flag: '🇮🇹', name: 'Italiano' },
    { code: 'nl', flag: '🇳🇱', name: 'Nederlands' },
    { code: 'pl', flag: '🇵🇱', name: 'Polski' },
    { code: 'uk', flag: '🇺🇦', name: 'Українська' },
    { code: 'ro', flag: '🇷🇴', name: 'Română' },
    { code: 'cs', flag: '🇨🇿', name: 'Čeština' },
    { code: 'hu', flag: '🇭🇺', name: 'Magyar' },
    { code: 'el', flag: '🇬🇷', name: 'Ελληνικά' }
  ];

  const RTL_LANGS = ['ar'];
  let currentTranslations = {};

  function detectLanguage() {
    const saved = localStorage.getItem('i18n-lang');
    if (saved) return saved;
    const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0].toLowerCase();
    const supported = LANGUAGES.find(l => l.code === browserLang);
    return supported ? supported.code : 'en';
  }

  async function loadTranslations(lang) {
    try {
      const resp = await fetch('/locales/' + lang + '.json');
      if (!resp.ok) throw new Error('Not found');
      return await resp.json();
    } catch {
      if (lang !== 'en') return loadTranslations('en');
      return {};
    }
  }

  function applyTranslations(translations) {
    currentTranslations = translations;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!translations[key]) return;
      const attr = el.getAttribute('data-i18n-attr');
      if (attr === 'placeholder') {
        el.placeholder = translations[key];
      } else if (attr === 'value') {
        el.value = translations[key];
      } else {
        el.innerHTML = translations[key];
      }
    });
  }

  function applyDirection(lang) {
    if (RTL_LANGS.includes(lang)) {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = lang;
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lang;
    }
  }

  function buildSelector() {
    const container = document.getElementById('lang-selector');
    if (!container) return;
    const select = document.createElement('select');
    select.id = 'lang-select';
    select.style.cssText = 'background:#222;color:#ccc;border:1px solid #444;border-radius:6px;padding:4px 8px;font-size:13px;cursor:pointer;outline:none;';
    LANGUAGES.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.flag + ' ' + l.name;
      select.appendChild(opt);
    });
    select.value = detectLanguage();
    select.addEventListener('change', async function() {
      const lang = this.value;
      localStorage.setItem('i18n-lang', lang);
      applyDirection(lang);
      const t = await loadTranslations(lang);
      applyTranslations(t);
    });
    container.appendChild(select);
  }

  // Expose for dynamic use in app.js
  window.i18n = {
    t: function(key) { return currentTranslations[key] || key; },
    lang: detectLanguage
  };

  // Init
  document.addEventListener('DOMContentLoaded', async function() {
    buildSelector();
    const lang = detectLanguage();
    applyDirection(lang);
    const t = await loadTranslations(lang);
    applyTranslations(t);
  });
})();
