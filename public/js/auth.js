// ===== AUTH MODULE =====

function showLoginScreen() {
  showScreen('login');
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-nickname').value = '';
  document.getElementById('login-password').value = '';
}

function showRegisterScreen() {
  showScreen('register');
  document.getElementById('reg-error').textContent = '';
  document.getElementById('reg-nickname').value = '';
  document.getElementById('reg-password').value = '';
}

function initAuthHandlers() {
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-nickname').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  document.getElementById('register-btn').addEventListener('click', handleRegister);
  document.getElementById('reg-nickname').addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });
  document.getElementById('reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });

  document.getElementById('goto-register').addEventListener('click', showRegisterScreen);
  document.getElementById('goto-login').addEventListener('click', showLoginScreen);
}

async function handleLogin() {
  const nickname = document.getElementById('login-nickname').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  if (!nickname || !password) { errEl.textContent = 'FILL ALL FIELDS'; return; }

  const btn = document.getElementById('login-btn');
  btn.textContent = '...';
  btn.disabled = true;

  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nickname, password })
  });

  btn.textContent = 'ENTER';
  btn.disabled = false;

  if (res.success) {
    setToken(res.data.token);
    setNickname(res.data.nickname);
    showMainMenu();
    runWelcomeFlow();
  } else {
    errEl.textContent = res.error || 'LOGIN FAILED';
  }
}

async function handleRegister() {
  const nickname = document.getElementById('reg-nickname').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');

  if (!nickname || !password) { errEl.textContent = 'FILL ALL FIELDS'; return; }
  if (nickname.length < 3) { errEl.textContent = 'NICKNAME TOO SHORT'; return; }
  if (password.length < 8) { errEl.textContent = 'PASSWORD MIN 8 CHARS'; return; }

  const btn = document.getElementById('register-btn');
  btn.textContent = '...';
  btn.disabled = true;

  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nickname, password })
  });

  btn.textContent = 'CREATE';
  btn.disabled = false;

  if (res.success) {
    setToken(res.data.token);
    setNickname(res.data.nickname);
    showMainMenu();
    runWelcomeFlow();
  } else {
    errEl.textContent = res.error || 'REGISTER FAILED';
  }
}
