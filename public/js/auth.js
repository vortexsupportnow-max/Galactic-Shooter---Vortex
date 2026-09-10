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

function showRecoverScreen() {
  showScreen('recover');
  document.getElementById('recover-error').textContent = '';
  document.getElementById('recover-nickname').value = '';
  document.getElementById('recover-code').value = '';
  document.getElementById('recover-password').value = '';
}

// Shows the code and waits for the player to confirm they wrote it down. Resolves
// only on acknowledgement, so the caller can hold the flow until then.
function showRecoveryCode(code) {
  return new Promise(resolve => {
    const overlay = document.getElementById('recovery-code-overlay');
    const check = document.getElementById('recovery-ack-check');
    const done = document.getElementById('recovery-done');
    const copy = document.getElementById('recovery-copy');

    document.getElementById('recovery-code-value').textContent = code;
    check.checked = false;
    done.disabled = true;
    copy.textContent = 'COPIA';
    overlay.classList.remove('hidden');

    const onCheck = () => { done.disabled = !check.checked; };
    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = 'COPIATO ✓';
      } catch (e) {
        copy.textContent = 'COPIA NON RIUSCITA';
      }
    };
    const cleanup = () => {
      check.removeEventListener('change', onCheck);
      copy.removeEventListener('click', onCopy);
      done.removeEventListener('click', onDone);
    };
    const onDone = () => {
      if (!check.checked) return;
      cleanup();
      overlay.classList.add('hidden');
      resolve();
    };

    check.addEventListener('change', onCheck);
    copy.addEventListener('click', onCopy);
    done.addEventListener('click', onDone);
  });
}

async function handleRecover() {
  const nickname = document.getElementById('recover-nickname').value.trim();
  const code = document.getElementById('recover-code').value.trim();
  const password = document.getElementById('recover-password').value;
  const errEl = document.getElementById('recover-error');

  if (!nickname || !code || !password) { errEl.textContent = 'COMPILA TUTTI I CAMPI'; return; }
  if (password.length < 8) { errEl.textContent = 'PASSWORD MIN 8 CHARS'; return; }

  const btn = document.getElementById('recover-btn');
  btn.textContent = '...';
  btn.disabled = true;

  const res = await apiFetch('/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ nickname, code, newPassword: password })
  });

  btn.textContent = 'RECUPERA';
  btn.disabled = false;

  if (res.success) {
    setToken(res.data.token);
    setNickname(res.data.nickname);
    // The used code is now dead — hand over the replacement before moving on
    if (res.data.recoveryCode) await showRecoveryCode(res.data.recoveryCode);
    showMainMenu();
    runWelcomeFlow();
  } else {
    errEl.textContent = res.error || 'RECUPERO FALLITO';
  }
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

  document.getElementById('goto-recover').addEventListener('click', showRecoverScreen);
  document.getElementById('recover-back').addEventListener('click', showLoginScreen);
  document.getElementById('recover-btn').addEventListener('click', handleRecover);
  document.getElementById('recover-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleRecover(); });
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
    // Accounts created before recovery codes existed are issued one here
    if (res.data.recoveryCode) await showRecoveryCode(res.data.recoveryCode);
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
    if (res.data.recoveryCode) await showRecoveryCode(res.data.recoveryCode);
    showMainMenu();
    runWelcomeFlow();
  } else {
    errEl.textContent = res.error || 'REGISTER FAILED';
  }
}
