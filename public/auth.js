/* Authentication shared by the existing WGH pages. No credentials in browser storage. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  let identity = {user: null, csrf_token: null};
  const adminSelector = '#addMatchButton,#scheduleAddButton,.edit-match-button,.delete-match-button,.edit-schedule-button,.delete-schedule-button,#youtubeRegisterForm,[data-admin-only]';
  function showIdentity() {
    document.documentElement.classList.toggle('wgh-admin', identity.user?.role === 'admin');
    document.querySelectorAll('[data-auth-panel]').forEach(panel => {
      panel.replaceChildren();
      const label = document.createElement('span');
      label.textContent = identity.user ? `${identity.user.name} · ${identity.user.role === 'admin' ? '관리자' : identity.user.role === 'player' ? '선수 회원' : '일반 회원'}` : '공개 기록은 로그인 없이 볼 수 있어요.';
      if (identity.user?.role === 'admin') {
        const teamSettings = document.createElement('button');
        teamSettings.type = 'button'; teamSettings.className = 'club-team-settings';
        teamSettings.dataset.adminOnly = ''; teamSettings.dataset.wghTeamSettings = '';
        teamSettings.textContent = '팀명 변경'; panel.append(teamSettings);
      }
      panel.append(label);
      if (identity.user) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = '로그아웃';
        button.addEventListener('click', async () => {
          try {
            const response = await window.fetch('/auth/logout', {method: 'POST'});
            if (!response.ok) throw new Error('로그아웃에 실패했습니다. 새로고침 후 다시 시도해 주세요.');
            location.reload();
          } catch (error) { alert(error.message); }
        });
        const account=document.createElement('a');account.href='/account.html';account.textContent='내 페이지';panel.append(account,button);
      } else {
        const link = document.createElement('a');
        link.href = '/account.html'; link.textContent = 'Google 계정으로 로그인';
        panel.append(link);
      }
    });
    window.dispatchEvent(new CustomEvent('wgh-auth-changed', {detail: {user: identity.user}}));
  }
  const ready = nativeFetch('/auth/me', {cache: 'no-store'}).then(async response => {
    if (!response.ok) throw new Error('로그인 상태 확인 실패');
    identity = await response.json();
  }).catch(() => {
    identity = {user: null, csrf_token: null};
    document.documentElement.dataset.authError = 'true';
  }).then(() => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showIdentity, {once: true});
    else showIdentity();
    if(identity.user?.consent_required && location.pathname!=='/account.html')location.replace('/account.html');
    return identity;
  });
  window.WGHAuthReady=ready;
  window.addEventListener('wgh-membership-changed', async () => {
    try { const response=await nativeFetch('/auth/me',{cache:'no-store'}); if(response.ok){identity=await response.json();showIdentity();} } catch (_) {}
  });
  window.addEventListener('pageshow',event=>{if(event.persisted && /\/(video(?:_backup|-register)?|feedback)\.html$/i.test(location.pathname))location.reload();});
  window.fetch = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin === location.origin && !['GET','HEAD','OPTIONS'].includes(method)) {
      await ready;
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(options.headers).forEach((value, key) => headers.set(key, value));
      if (identity.csrf_token) headers.set('X-CSRF-Token', identity.csrf_token);
      options = {...options, headers};
    }
    const response = await nativeFetch(input, options);
    if (url.origin === location.origin && [401,403].includes(response.status)) {
      // Recheck revoked/expired permissions before the next interaction.
      identity = {user: null, csrf_token: null}; showIdentity();
      // The video viewer renders an actionable login/consent message for read errors.
      // A blocking alert here prevents its pending fetch handler from continuing.
      const videoRead = ['GET','HEAD'].includes(method) && url.pathname === '/api/youtube-videos';
      if (!videoRead) alert('로그인 또는 관리자 권한을 확인해 주세요.');
    }
    return response;
  };
  document.addEventListener('click', event => {
    if (identity.user?.role !== 'admin' && event.target.closest(adminSelector)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
})();
