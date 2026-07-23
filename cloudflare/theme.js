const $$ = (selector) => [...document.querySelectorAll(selector)];


function applyTheme(theme) {
  const selected = ['light', 'purple', 'black'].includes(theme) ? theme : 'purple';
  document.documentElement.classList.remove('light', 'theme-light', 'theme-purple', 'theme-black');
  document.documentElement.classList.add(`theme-${selected}`);
  if (selected === 'light') document.documentElement.classList.add('light');
  localStorage.setItem('munnesir-theme', selected);
  $$('.themeChoice').forEach((btn) => btn.classList.toggle('active', btn.dataset.themeChoice === selected));
}

function setupTheme() {
  const saved = localStorage.getItem('munnesir-theme');
  applyTheme(saved === 'dark' ? 'purple' : (saved || 'purple'));
  els.themeToggle.addEventListener('click', () => {
    els.themeDialog.showModal();
    applyTheme(localStorage.getItem('munnesir-theme') || 'purple');
  });
  els.closeThemeBtn?.addEventListener('click', () => els.themeDialog.close());
  $$('.themeChoice').forEach((btn) => btn.addEventListener('click', () => {
    applyTheme(btn.dataset.themeChoice);
    els.themeDialog.close();
  }));
}


export {
    applyTheme,
    setupTheme
};