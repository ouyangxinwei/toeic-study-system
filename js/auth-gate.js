/**
 * Supabase Auth 登录门禁。
 * 用户名通过 profile 表映射到 Supabase Auth email；密码由 Supabase Auth 验证。
 * 注意：这不是自行实现的密码存储，不会在数据库明文保存密码。
 */
(function () {
  const USERNAME_EMAIL_DOMAIN = 'example.com';
  let gate;

  function usernameToEmail(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,32}$/.test(normalized)) return null;
    return `${normalized}@${USERNAME_EMAIL_DOMAIN}`;
  }

  function showGate(message = '') {
    if (!gate) return;
    gate.hidden = false;
    const messageEl = gate.querySelector('#authMessage');
    messageEl.textContent = message;
  }

  function hideGate() {
    if (gate) gate.hidden = true;
    const logout = document.getElementById('logoutBtn');
    if (logout) logout.hidden = false;
  }

  function buildGate() {
    gate = document.createElement('div');
    gate.id = 'authGate';
    gate.className = 'auth-gate';
    gate.innerHTML = `
      <form id="authLoginForm" class="auth-card">
        <div class="auth-logo">📚</div>
        <h1>TOEIC 错题学习系统</h1>
        <p class="auth-subtitle">请登录以继续</p>
        <label for="authUsername">用户名</label>
        <input id="authUsername" name="username" autocomplete="username" required maxlength="32" placeholder="输入用户名" />
        <label for="authPassword">密码</label>
        <input id="authPassword" name="password" type="password" autocomplete="current-password" required placeholder="输入密码" />
        <button id="authSubmit" type="submit">登录</button>
        <p id="authMessage" class="auth-message" role="status" aria-live="polite"></p>
        <p class="auth-hint">登录需要有效的 Supabase Auth 用户及数据库权限。</p>
      </form>`;
    document.body.appendChild(gate);
    gate.querySelector('#authLoginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = gate.querySelector('#authUsername').value;
      const password = gate.querySelector('#authPassword').value;
      const email = usernameToEmail(username);
      const submit = gate.querySelector('#authSubmit');
      if (!email) return showGate('用户名只能包含字母、数字、点、下划线或连字符（2–32 位）。');
      if (!window.toeicSupabaseReady || !window.toeicSupabase) {
        return showGate('Supabase 尚未初始化：' + (window.toeicSupabaseError || '请检查 URL、Key 和网络连接。'));
      }
      submit.disabled = true;
      submit.textContent = '正在验证…';
      showGate('正在连接 Supabase 并验证登录信息…');
      try {
        const { error } = await window.toeicSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        hideGate();
      } catch (error) {
        showGate('登录失败：' + (error.message || '用户名或密码不正确。'));
      } finally {
        submit.disabled = false;
        submit.textContent = '登录';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    buildGate();
    const logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', async () => {
      if (window.toeicSupabase) {
        const { error } = await window.toeicSupabase.auth.signOut();
        if (error) console.error('[Auth] 退出登录失败:', error);
      }
      if (logout) logout.hidden = true;
      showGate('已退出登录。');
    });

    if (!window.toeicSupabaseReady || !window.toeicSupabase) {
      showGate('Supabase 尚未初始化：' + (window.toeicSupabaseError || '请检查配置。'));
      return;
    }
    try {
      const { data, error } = await window.toeicSupabase.auth.getSession();
      if (error) throw error;
      if (data.session) hideGate();
      else showGate();
      window.toeicSupabase.auth.onAuthStateChange((_event, session) => {
        if (session) hideGate();
        else {
          const logoutButton = document.getElementById('logoutBtn');
          if (logoutButton) logoutButton.hidden = true;
          showGate();
        }
      });
    } catch (error) {
      showGate('无法检查登录状态：' + (error.message || String(error)));
    }
  });
})();
