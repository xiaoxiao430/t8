'use strict';
/* Public demonstration only. Load after pages-runtime.js and organization.js. */
(() => {
  let records = null;
  const scenarios = [
    ['stable','表现稳定','保持有效做法','复评时核对持续性，沉淀可分享的课堂实践。'],
    ['improving','支持后改善','确认支持成效','比较首次与复测，复评时再看新课是否稳定。'],
    ['persistent','持续需要支持','核实连续信号','回到同一班科连续课次，调整辅导与课堂实践。'],
    ['missing','依据待补齐','先补记录','核对冻结应交名单与缺失课次，补齐后再判断。'],
    ['unsupported','学校支持待兑现','先落实学校承诺','由支持责任人说明进展，再约定落实与复评。'],
    ['exam_gap','考试目标有差距','回看目标与实际','核对原目标和同口径考试，安排专项支持。']
  ];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const percent = (a,b) => b > 0 ? `${(a/b*100).toFixed(1)}%` : '待核';
  const display = value => value === null || value === undefined || value === '' ? '待核' : String(value);
  const statusNames = {achieved:'达到目标',not_achieved:'未达目标',undetermined:'待判断',unknown:'待核',pending:'待落实',overdue:'已逾期',completed:'已落实',delivered:'已落实',in_progress:'落实中',not_started:'待落实',fulfilled:'已落实',missing:'资料待补齐'};
  const statusText = value => statusNames[value] || display(value);
  const scopeRows = () => (records || []).filter(x => (!org.campus || x.campus === org.campus) && (!org.department || (x.department || '待分学部') === org.department));
  const unique = rows => [...new Map(rows.map(x => [x.id,x])).values()];
  const metric = (label,value,note) => `<div class="demo-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;
  function dashboard() {
    if (!records || !org.summary || state.data.actor.role === 'mentor') return '';
    const rows = unique(scopeRows()), sum = key => rows.reduce((a,x) => a + number(x.mastery?.[key]),0);
    const expected = sum('expected'), determined = sum('determined'), achieved = sum('achieved');
    const valid = rows.reduce((a,x) => a + number(x.parent?.valid),0), invited = rows.reduce((a,x) => a + number(x.parent?.invited),0);
    const examGap = rows.filter(x => x.exam?.status === 'not_achieved').length;
    const supportDue = rows.filter(x => x.scenario === 'unsupported').length;
    return `<section class="demo-leadership panel" id="demoTeachingOverview" aria-label="当前学期教学管理概览">
      <header class="demo-heading"><div><span class="demo-kicker">从教学表现，到具体支持</span><h2>当前学期 · 教学与支持概览</h2><p>${esc(org.department || org.campus || '集团全部校区')} · 2026年秋季 · 截至10月30日</p></div><span class="demo-readonly">全员虚拟情境 · 只读</span></header>
      <div class="demo-metrics">${metric('已配置教学情境',`${rows.length}人`,`任教人员 ${org.summary.counts?.teaching ?? '待核'} 人；非任教岗位不适用`)}${metric('首次堂堂清实现率',percent(achieved,determined),`${achieved} / ${determined} 已判定课次达到目标`)}${metric('课堂记录覆盖',percent(determined,expected),`已判定 ${determined} / 应评 ${expected} 课次`)}${metric('考试需专项支持',`${examGap}人`,`学校支持待兑现情境 ${supportDue} 人`)}</div>
      <p class="demo-method">首次堂堂清按课次汇总，复测单列；缺失课次保留待判断，不跨班科拼接连续异常。点击情境，查看每位教师的依据、行动和责任人。</p>
      <div class="demo-scenario-grid">${scenarios.map(([key,label,focus,action]) => {const list = rows.filter(x => x.scenario === key);return `<button class="demo-scenario" data-demo-scenario="${key}" aria-label="${esc(label)}，${list.length}人，查看全部名单"><span class="demo-scenario-top"><span>${esc(label)}</span><strong>${list.length}<small>人</small></strong></span><b>${esc(focus)}</b><p>${esc(action)}</p><span class="demo-scenario-names">${esc(list.slice(0,2).map(x => x.name).join('、') || '当前范围暂无人员')}${list.length>2?' 等':''}</span><span class="demo-card-link">查看全部名单 ↗</span></button>`;}).join('')}</div>
      <footer class="demo-period-note"><div><b>秋季调研 · 进行中预演</b><span>有效回答 ${valid} / 邀请 ${invited}，有效覆盖 ${percent(valid,invited)}。个人满意度与样本是否足量，到档案分别核对。</span></div><div><b>春季完整学期 · 正式已发布</b><span>下方历史发展分层沿用冻结结论；秋季过程与调研预演分别展示，不据此改写春季分层。</span></div></footer>
    </section>`;
  }
  function classroomSummary(value) {
    if (!value || typeof value !== 'object') return display(value);
    return value.summary || value.note || Object.entries(value).map(([k,v]) => `${({classes:'任教班级',lessons:'课次',expected:'应评课次',determined:'已判定课次',missing:'缺失课次',analyzed:'已分析课次',class_count:'班级数',lesson_count:'课次数'}[k] || k)} ${Array.isArray(v) ? v.join('、') : display(v)}`).join(' · ');
  }
  function personal(t) {
    const row = org.detail?.demo_management;
    if (!row || row.id !== t.id) return '';
    const m = row.mastery || {}, parent = row.parent || {}, exam = row.exam || {};
    const lessons = (state.data.lessons || []).filter(l => l.teacher_id === t.id);
    const month = lessons.filter(l => String(l.date).startsWith('2026-10'));
    const monthDetermined = month.filter(l => ['achieved','not_achieved'].includes(l.first?.status)).length;
    const monthAchieved = month.filter(l => l.first?.status === 'achieved').length;
    const retests = month.filter(l => l.retest);
    const chosen = (row.evidence_ids || []).map(id => lessons.find(l => l.id === id)).filter(Boolean);
    const evidence = chosen.length ? chosen : lessons.slice(-4);
    return `<section class="demo-personal panel" id="demoPersonalSummary" aria-label="个人教学与管理摘要"><header class="demo-heading"><div><span class="demo-kicker">2026年秋季 · 截至10月30日</span><h2>本期关注：${esc(row.label || scenarios.find(x => x[0] === row.scenario)?.[1] || '教学与支持')}</h2><p>${esc(classroomSummary(row.classroom_summary))}</p></div><button class="text-link" data-demo-tab="classroom">查看课堂与学情 ↗</button></header>
      <div class="demo-metrics">${metric('秋季首次堂堂清',percent(number(m.achieved),number(m.determined)),`${display(m.achieved)} / ${display(m.determined)} 已判定课次达到目标`)}${metric('课堂记录覆盖',percent(number(m.determined),number(m.expected)),`应评 ${display(m.expected)} · 已判定 ${display(m.determined)} · 待核 ${display(m.unknown)}`)}${metric('考试目标与实际',statusText(exam.status),`原目标 ${display(exam.target)}人 · 实际 ${display(exam.actual)}人（达到约定分数线）`)}${metric('秋季总体满意度 · 预演',parent.satisfaction == null ? '待核' : rate(parent.satisfaction),`有效 ${display(parent.valid)} / 邀请 ${display(parent.invited)} · 覆盖 ${percent(number(parent.valid),number(parent.invited))}`)}</div>
      ${number(m.unknown) > 0 ? '<p class="demo-incomplete">资料待补齐，暂不作完整达标判断；上方实现率仅限已判定课次。</p>' : ''}
      <p class="demo-method">${esc(parent.period_label || '秋季调研预演')}：${esc(parent.note || '当前仅为过程样例，样本口径独立核对，不形成正式学期结论。')} 春季正式分层见「评价考核」。</p>
      <p class="demo-month-summary"><b>10月过程</b> 应评 ${month.length} 课 · 已判定 ${monthDetermined} 课 · 首次达标 ${monthAchieved} 课（${percent(monthAchieved,monthDetermined)}）；另有 ${retests.length} 课保留复测记录。首次与复测分别核对。</p>
      <div class="demo-action-plan"><div><span>关注依据</span><p>${esc(display(row.focus))}</p></div><div><span>下一步行动</span><p>${esc(display(row.action))}</p></div><div><span>责任与复评</span><p>${esc(display(row.owner_name))} · 既往支持：${esc(statusText(row.support_status))}<br>下一步落实期限：${esc(display(row.due_date))}（待开展）<br>复评 ${esc(display(row.review_date))}<br>${esc(display(row.stage))}</p><button class="text-link" data-demo-tab="support">查看培养与支持 ↗</button></div></div>
      ${(row.trend || []).length ? `<p class="demo-trend">首次实现率过程：${row.trend.map(x => `${esc(x.label)} ${x.rate == null ? '待核' : esc(rate(x.rate))}`).join(' → ')}<span>按各阶段已判定课次计算，待核不计达标。</span></p>` : ''}
      <div class="demo-evidence"><h3>回到课次 · 首次与复测分列</h3><p>90/90按正确题数及冻结应交名单判断；复测反映支持后变化，保留首次结果。</p>${evidence.slice(0,6).map(l => `<button class="demo-evidence-row" data-demo-lesson="${esc(l.id)}"><span><b>${esc(l.date)} · ${esc(l.class_name)} · ${esc(l.title)}</b><small>${esc(l.subject || t.subject)} · 第${esc(l.sequence)}课 · 课堂示例</small></span><span>首次 ${esc(statusText(l.first?.status))}<small>复测 ${l.retest ? esc(statusText(l.retest.status)) : '尚无记录'}</small></span><span class="demo-card-link">查看依据 ↗</span></button>`).join('') || '<p class="tiny">课次依据待补齐，不推断结果。</p>'}</div>
    </section>`;
  }
  let listState = {scenario:'',q:'',page:1};
  function listRows() {const q = listState.q.toLocaleLowerCase();return unique(scopeRows()).filter(x => x.scenario === listState.scenario && (!q || [x.name,x.id,x.campus,x.department,x.subject].join(' ').toLocaleLowerCase().includes(q)));}
  function listBody() {
    const rows = listRows(), pages = Math.max(1,Math.ceil(rows.length/20));listState.page = Math.min(Math.max(1,listState.page),pages);
    return `<div class="demo-list-count" role="status">共 ${rows.length} 人 · 第 ${listState.page} / ${pages} 页 · 每页20人</div><div class="demo-name-list">${rows.slice((listState.page-1)*20,listState.page*20).map(x => `<article class="demo-list-person"><div class="demo-list-title"><button class="text-link" data-demo-open="${esc(x.id)}"><b>${esc(x.name)}</b> · 查看档案 ↗</button><span>${esc(x.campus)} · ${esc(x.department)} · ${esc(x.subject)}</span></div><p><b>关注</b> ${esc(display(x.focus))}</p><p><b>行动</b> ${esc(display(x.action))}</p><footer>责任人 ${esc(display(x.owner_name))} · 既往支持：${esc(statusText(x.support_status))}<br>下一步落实期限：${esc(display(x.due_date))}（待开展） · 复评 ${esc(display(x.review_date))}</footer></article>`).join('') || '<p class="tiny">暂无符合条件的教师，请调整搜索词或组织范围。</p>'}</div><div class="demo-list-pages"><button class="button" data-demo-page="${listState.page-1}" ${listState.page <= 1 ? 'disabled' : ''}>上一页</button><span>${listState.page} / ${pages}</span><button class="button" data-demo-page="${listState.page+1}" ${listState.page >= pages ? 'disabled' : ''}>下一页</button></div>`;
  }
  function updateList() {const box = document.querySelector('#demoScenarioResults');if (box) {box.innerHTML = listBody();box.closest('.modal-body').scrollTop = 0;}}
  function openList(key) {
    const scenario = scenarios.find(x => x[0] === key);if (!scenario) return;
    listState = {scenario:key,q:'',page:1};
    openModal(`${scenario[1]} · 教师名单`,`<p class="demo-list-intro">${esc(org.department || org.campus || '集团全部校区')} · ${esc(scenario[3])} 以下为秋季过程情境，与春季正式分层分别展示。</p><form id="demoScenarioSearch" class="demo-list-search"><label class="sr-only" for="demoScenarioQuery">搜索情境教师</label><input id="demoScenarioQuery" type="search" placeholder="搜索姓名、编号、校区或学科"><button class="button" type="submit">搜索</button></form><div id="demoScenarioResults">${listBody()}</div>`,'本期关注 · 支持与复评');
  }
  const originalDashboard = orgDashboard;
  orgDashboard = function() {return dashboard() + originalDashboard();};
  const originalGrowth = orgLegacy.profileGrowth;
  orgLegacy.profileGrowth = function(t) {return personal(t) + originalGrowth(t);};
  document.addEventListener('click',e => {
    const el = e.target.closest('[data-demo-scenario],[data-demo-open],[data-demo-page],[data-demo-tab],[data-demo-lesson]');if (!el) return;e.preventDefault();
    if (el.hasAttribute('data-demo-scenario')) openList(el.dataset.demoScenario);
    else if (el.hasAttribute('data-demo-page')) {listState.page = number(el.dataset.demoPage);updateList();document.querySelector('#demoScenarioResults button')?.focus();}
    else if (el.hasAttribute('data-demo-open')) {closeModal();state.profileTab = 'growth';org.report = false;go('profile',el.dataset.demoOpen);}
    else if (el.hasAttribute('data-demo-tab')) {state.profileTab = el.dataset.demoTab;org.report = false;go('profile',org.detailId);}
    else if (el.hasAttribute('data-demo-lesson')) showLesson(el.dataset.demoLesson);
  });
  document.addEventListener('submit',e => {if (e.target.id !== 'demoScenarioSearch') return;e.preventDefault();listState.q = document.querySelector('#demoScenarioQuery').value.trim();listState.page = 1;updateList();});
  publicData.then(data => {records = Array.isArray(data.management) ? unique(data.management) : null;if (state.data) render();}).catch(() => {});
})();
