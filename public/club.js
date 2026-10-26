/* Shared team settings and league-only editing. No player/score/video payloads. */
(() => {
  const api = async (url, options = {}) => {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok || result.success === false) {
      const error = new Error(typeof result.detail === 'string' ? result.detail : '입력 내용을 확인하고 다시 시도해 주세요.');
      error.status = response.status;
      throw error;
    }
    return result.data;
  };
  const send = (url, method, data) => api(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
  const el = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  let teamName = 'WGH 은평';
  let pickerNumber = 0;
  function applyName(name) {
    teamName = name;
    document.querySelectorAll('[data-team-name]').forEach(element => { element.textContent = name; });
  }
  const ready = api('/api/club-settings').then(settings => { applyName(settings.team_name); return settings; }).catch(() => null);

  function mountLeaguePicker(form, before, {current = null, atomicNewMatch = false} = {}) {
    const group = el('div', undefined, 'form-group club-league-picker');
    const id = `clubLeague${++pickerNumber}`;
    const label = el('label', '리그'); label.htmlFor = id;
    const select = el('select'); select.id = id; select.dataset.leagueSelect = ''; select.disabled = true;
    select.append(new Option('리그를 불러오는 중…',''));
    const extra = el('div', undefined, 'club-new-league'); extra.hidden = true;
    const inputLabel = el('label', '새 리그 이름'); inputLabel.htmlFor = id + 'Name';
    const input = el('input'); input.id = id + 'Name'; input.type = 'text'; input.maxLength = 100; input.placeholder = '예: 위리그';
    const add = el('button', '리그 추가', 'club-secondary-button'); add.type = 'button'; add.hidden = atomicNewMatch;
    const status = el('p', '', 'club-field-status'); status.setAttribute('role','status');
    extra.append(inputLabel,input,add); group.append(label,select,extra,status);
    form.insertBefore(group,before);
    let adding = false;
    select.addEventListener('change', () => { extra.hidden = select.value !== '__new__'; input.required = !extra.hidden; });
    const load = api('/api/leagues').then(leagues => {
      if (!group.isConnected) return;
      select.replaceChildren(new Option('리그 미지정',''));
      for (const league of leagues) select.add(new Option(league.name,String(league.league_id)));
      if (current?.league_id != null && !leagues.some(league => league.league_id === current.league_id)) {
        const old = new Option((current.league_name || '기존 리그') + ' (사용 중지)',String(current.league_id));
        old.disabled = true; select.add(old);
      }
      select.add(new Option('＋ 직접 추가','__new__'));
      select.value = current?.league_id == null ? '' : String(current.league_id);
      select.disabled = false;
    });
    // The edit form also loads players. Handle an early rejection immediately;
    // awaiting the original promise below still blocks saving and shows the error.
    load.catch(() => {});
    add.addEventListener('click', async () => {
      if (adding) return;
      const name = input.value.trim();
      if (!name) { status.textContent = '새 리그 이름을 입력해 주세요.'; input.focus(); return; }
      adding = true; add.disabled = true; select.disabled = true;
      const submit = form.querySelector('[type=submit]'); submit.disabled = true;
      status.textContent = '리그 추가 중입니다…';
      try {
        const league = await send('/api/leagues','POST',{name});
        if (!group.isConnected) return;
        let option = [...select.options].find(option => option.value === String(league.league_id));
        if (!option) { option = new Option(league.name,String(league.league_id)); select.add(option,select.options.length-1); }
        select.value = option.value; extra.hidden = true; input.required = false;
        status.textContent = '리그를 선택했습니다. 저장하면 이 경기에 적용됩니다.';
        window.dispatchEvent(new Event('wgh-leagues-changed'));
      } catch (error) { status.textContent = error.message; }
      finally { adding = false; if (group.isConnected) { add.disabled = false; select.disabled = false; submit.disabled = false; } }
    });
    return {ready:load, get busy() {return adding;}, value() {
      if (select.disabled) throw new Error('리그 목록을 불러온 뒤 저장해 주세요.');
      if (select.value === '__new__') {
        const name = input.value.trim();
        if (!name) throw new Error('새 리그 이름을 입력해 주세요.');
        if (!atomicNewMatch) throw new Error('리그 추가 버튼을 눌러 선택한 뒤 저장해 주세요.');
        return {league_name:name};
      }
      return {league_id:select.value ? Number(select.value) : null};
    }};
  }

  function dialogShell(trigger,title,description) {
    const dialog = el('dialog',undefined,'club-dialog');
    dialog.setAttribute('aria-labelledby','clubDialogTitle');
    const heading = el('h2',title); heading.id = 'clubDialogTitle';
    const note = el('p',description,'club-dialog-note');
    const form = el('form');
    const status = el('p','','club-dialog-status'); status.setAttribute('role','status');
    const actions = el('div',undefined,'modal-actions');
    const cancel = el('button','취소','cancel-button'); cancel.type = 'button';
    const save = el('button','저장','save-match-button'); save.type = 'submit'; save.disabled = true;
    actions.append(cancel,save); form.append(status,actions); dialog.append(heading,note,form);
    let busy = false;
    cancel.addEventListener('click', () => { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); },{once:true});
    document.body.append(dialog); dialog.showModal();
    return {dialog,form,status,save, get busy() {return busy;}, set busy(value) {busy=value;save.disabled=value;cancel.disabled=value;}};
  }

  document.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-wgh-team-settings]');
    if (!trigger || !document.documentElement.classList.contains('wgh-admin') || document.querySelector('.club-dialog[open],.wgh-register-dialog[open]')) return;
    const view = dialogShell(trigger,'팀명 변경','경기 화면에 표시할 우리 팀 이름입니다. 기존 경기 기록과 영상 제목은 유지됩니다.');
    let original;
    const label = el('label','팀 이름'); label.htmlFor = 'clubTeamName';
    const input = el('input'); input.id = 'clubTeamName'; input.maxLength = 100; input.required = true;
    const group = el('div',undefined,'form-group'); group.append(label,input); view.form.prepend(group);
    try {
      original = await api('/api/club-settings');
      if (!view.dialog.isConnected) return;
      input.value = original.team_name; view.save.disabled = false; input.focus();
    } catch (error) { view.status.textContent = error.message; }
    view.form.addEventListener('submit', async event => {
      event.preventDefault(); if (!original || view.busy || view.save.disabled) return;
      const name = input.value.trim();
      if (!name) { view.status.textContent = '팀 이름을 입력해 주세요.'; return; }
      view.busy = true; view.status.textContent = '팀명을 저장하는 중입니다…';
      try {
        const settings = await send('/api/admin/club-settings','PUT',{team_name:name,expected_revision:original.revision});
        applyName(settings.team_name);
        window.dispatchEvent(new Event('wgh-club-changed'));
        view.busy = false; view.dialog.close();
      } catch (error) { view.busy = false; view.status.textContent = error.message; if (error.status === 409) view.save.disabled = true; }
    });
  });
  window.WGHClub = {ready, mountLeaguePicker, get teamName() {return teamName;}};
})();
