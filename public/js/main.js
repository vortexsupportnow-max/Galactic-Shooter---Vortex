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

async function init() {
  // Init all handlers
  initAuthHandlers();
  initMenuHandlers();
  initSlotSelectHandlers();
  initCrateHandlers();
  initLeaderboardHandlers();
  initCollectionHandlers();

  // Init login starfield
  initStarField('loginStars');

  // Check existing token
  const token = getToken();
  if (token) {
    const res = await apiFetch('/auth/me');
    if (res.success) {
      setNickname(res.data.nickname);
      showMainMenu();
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
