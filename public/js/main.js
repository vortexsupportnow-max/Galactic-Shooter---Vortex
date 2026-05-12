// ===== MAIN ENTRY POINT =====

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const screen = document.getElementById(`screen-${name}`);
  if (screen) {
    screen.style.display = 'flex';
    screen.classList.add('active');
  }

  // Stop game when leaving game screen
  if (name !== 'game' && gameInstance) {
    gameInstance.stop();
  }
}

// ===== INTRO ANIMATION =====
function showIntro() {
  return new Promise(resolve => {
    const introEl = document.getElementById('screen-intro');
    if (!introEl) { resolve(); return; }

    // Populate intro starfield
    initStarField('introStars');

    // Make sure intro is visible
    introEl.style.display = 'flex';
    introEl.classList.add('active');

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      introEl.classList.add('intro-exit');
      setTimeout(() => {
        introEl.style.display = 'none';
        introEl.classList.remove('active', 'intro-exit');
        resolve();
      }, 600);
    };

    // Auto-advance after 3.5 seconds
    const timer = setTimeout(finish, 3500);

    // Skip on tap/click
    introEl.addEventListener('click', () => { clearTimeout(timer); finish(); }, { once: true });
  });
}

async function init() {
  // Init all handlers
  initAuthHandlers();
  initMenuHandlers();
  initSlotSelectHandlers();
  initCrateHandlers();
  initLeaderboardHandlers();
  initCollectionHandlers();
  initSkinHandlers();
  initSettingsHandlers();
  initTutorialHandlers();
  initWheelHandlers();
  initAbilityInfoHandlers();
  initPassHandlers();
  initPatchNotesHandlers();

  // Init login starfield
  initStarField('loginStars');

  // Show intro animation first
  await showIntro();

  // Check existing token
  const token = getToken();
  if (token) {
    const res = await apiFetch('/auth/me');
    if (res.success) {
      setNickname(res.data.nickname);
      showMainMenu();
      maybeShowTutorial();
      return;
    } else {
      clearToken();
    }
  }

  showLoginScreen();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
