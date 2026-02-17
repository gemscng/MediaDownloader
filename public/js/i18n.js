// i18n.js — Internationalization for MediaDownloader (Redesigned)
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
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }

  function buildSelector() {
    const container = document.getElementById('lang-selector');
    if (!container) return;

    const currentLang = detectLanguage();
    const langObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

    // Button
    const btn = document.createElement('button');
    btn.className = 'lang-btn';
    btn.setAttribute('aria-label', 'Change language');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="globe-icon">🌐</span><span class="flag">' + langObj.flag + '</span>';

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'lang-dropdown';
    dropdown.setAttribute('role', 'listbox');

    LANGUAGES.forEach(l => {
      const option = document.createElement('button');
      option.className = 'lang-option' + (l.code === currentLang ? ' active' : '');
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', l.code === currentLang);
      option.innerHTML = '<span>' + l.flag + '</span> ' + l.name;
      option.addEventListener('click', async () => {
        localStorage.setItem('i18n-lang', l.code);
        applyDirection(l.code);
        const t = await loadTranslations(l.code);
        applyTranslations(t);
        // Update button
        btn.querySelector('.flag').textContent = l.flag;
        // Update active state
        dropdown.querySelectorAll('.lang-option').forEach(o => {
          o.classList.remove('active');
          o.setAttribute('aria-selected', 'false');
        });
        option.classList.add('active');
        option.setAttribute('aria-selected', 'true');
        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
      dropdown.appendChild(option);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
    dropdown.addEventListener('click', e => e.stopPropagation());

    container.appendChild(btn);
    container.appendChild(dropdown);
  }

  // Expose for dynamic use
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
