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
  const deleteDialog = document.getElementById('delete-account-dialog');
  const deleteForm = document.getElementById('delete-account-form');
  let deleting = false;
  document.getElementById('btn-delete-account').addEventListener('click', () => {
    deleteForm.reset();
    document.getElementById('delete-account-error').textContent = '';
    deleteDialog.showModal();
  });
  document.getElementById('delete-account-cancel').addEventListener('click', () => deleteDialog.close());
  deleteDialog.addEventListener('cancel', e => { if (deleting) e.preventDefault(); });
  deleteForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (deleting || !deleteForm.reportValidity()) return;
    deleting = true;
    const confirm = document.getElementById('delete-account-confirm');
    const cancel = document.getElementById('delete-account-cancel');
    const password = document.getElementById('delete-account-password');
    confirm.disabled = cancel.disabled = true;
    confirm.textContent = 'ELIMINAZIONE…';
    document.getElementById('delete-account-error').textContent = '';
    const res = await apiFetch('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password: password.value, confirmation: 'ELIMINA' })
    });
    password.value = '';
    deleting = false;
    confirm.disabled = cancel.disabled = false;
    confirm.textContent = 'ELIMINA DEFINITIVAMENTE';
    if (res.success) {
      const nickname = getNickname();
      localStorage.removeItem(`gs_loadout_${nickname}`);
      localStorage.removeItem(`gs_tutorial_done_${nickname}`);
      Object.keys(localStorage).filter(key => key.startsWith('gs_season_intro_') && key.endsWith(`_${nickname}`))
        .forEach(key => localStorage.removeItem(key));
      clearToken();
      setNickname('');
      // Reload also drops all cached profile, pass and game data from memory.
      window.location.reload();
    } else if (!getToken()) {
      deleteDialog.close();
    } else {
      document.getElementById('delete-account-error').textContent = res.error || 'Eliminazione non riuscita. Riprova.';
    }
  });
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
