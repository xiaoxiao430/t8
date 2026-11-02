'use strict';
/* Organization distribution first; local modal scope never changes the main route. */
(() => {
  let data = null, view = null;
  const size = 12;
  const h = value => esc(String(value ?? ''));
  const department = p => p.department || '待分学部';
  const id = p => p.teacher_id || p.id;
  const unique = rows => [...new Map(rows.map(p => [id(p),p])).values()];
  const scenarios = {
    stable:['表现稳定','核对持续性，沉淀可分享的课堂实践。'],
    improving:['支持后改善','核对支持前后的变化，再观察新课是否稳定。'],
    persistent:['持续需要支持','复核同班科连续课次，安排共备与复评。'],
    missing:['依据待补齐','先补齐冻结名单和缺失课次，再作判断。'],
    unsupported:['学校支持待兑现','先由学校落实导师与课务资源，再约定复评。'],
    exam_gap:['考试目标有差距','核对原目标与同口径结果，安排专项支持。']
  };
  const focuses = {
    follow_up:'核对连续课次与教师说明，落实教学改进支持。',
    praise:'核对近期进步，分享具体有效实践。',
    support:'先确认资源与责任人，跟进学校支持落实。',
    review:'仅核查独立职责线索，听取教师说明；责任尚未确定。'
  };
  const categories = {excellent:'优秀',good:'良好',support:'重点支持',pending:'资料待补齐',not_applicable:'非任教 · 不适用'};
  const inScope = (p,s) => (!s.campus || p.campus === s.campus) && (!s.department || department(p) === s.department);
  const scopeName = s => [s.campus,s.department].filter(Boolean).join(' · ') || '集团全部校区';
  const pathKey = () => JSON.stringify([view.campus,view.department]);
  function localState() {
    const key = pathKey();
    if (!view.saved.has(key)) view.saved.set(key,{q:'',page:1});
    return view.saved.get(key);
  }
  function selected() {
    if (view.kind === 'ai') return window.HouwaiInsights.build(data.management || [],data.management_cases || [],{}).groups.find(g => g.key === view.key)?.items || [];
    if (view.kind === 'scenario') return unique(data.management || []).filter(p => p.scenario === view.key);
    const q = new URLSearchParams({education_basis:view.basis});
    if (view.category) q.set('category',view.category);
    if (view.facet) {q.set('facet',view.facet);q.set('value',view.value);}
    return publicRows(data,q);
  }
  function denominator(scope) {
    return unique(data.people.filter(p => inScope(p,scope) && (view.kind === 'hr' || p.teaching === true))).length;
  }
  function focus(count) {
    if (!count) return '当前范围无符合此条件的人员；保留零值，不推断教学质量。';
    if (view.kind === 'ai') return focuses[view.key];
    if (view.kind === 'scenario') return scenarios[view.key][1];
    if (view.category) return ({excellent:'回看春季正式依据，提炼可分享实践。',good:'回看春季正式依据，持续跟进成长。',support:'按春季完整学期依据，核对后续支持落实。',pending:'补核春季完整学期依据，不推断表现。',not_applicable:'保留基础档案；教学评价不适用。'})[view.category];
    return '核对人员与教育背景事实，按需查看档案。';
  }
  function children() {
    if (!view.campus) return (data.tree?.campuses || []).map(c => ({campus:c.name,department:'',name:c.name}));
    const c = data.tree?.campuses?.find(c => c.name === view.campus);
    const names = new Set((c?.departments || []).map(d => d.name));
    data.people.filter(p => p.campus === view.campus).forEach(p => names.add(department(p)));
    return [...names].map(name => ({campus:view.campus,department:name,name}));
  }
  function crumbs() {
    const root = view.base;
    return `<nav class="drill-crumbs" aria-label="分类分布层级">${!root.campus?'<button data-drill-level="group">集团</button>':'<span>集团</span>'}${view.campus?`<span aria-hidden="true">/</span>${!root.department?`<button data-drill-level="campus">${h(view.campus)}</button>`:`<span>${h(view.campus)}</span>`}`:''}${view.department?`<span aria-hidden="true">/</span><span aria-current="page">${h(view.department)}</span>`:''}</nav>`;
  }
  function distribution(rows) {
    const next = view.campus ? '学部' : '校区';
    return `<div class="drill-section-title"><h3>${next}分布</h3><span>先看组织，再看教师</span></div><div class="drill-distribution">${children().map(s => {
      const count = rows.filter(p => inScope(p,s)).length, total = denominator(s), proportion = total ? (count/total*100).toFixed(1)+'%' : '—';
      return `<button class="drill-row" data-drill-campus="${h(s.campus)}" data-drill-dept="${h(s.department)}" data-drill-count="${count}" data-drill-denominator="${total}" aria-label="${h(s.name)}，${count}人，占${total}人${proportion}，查看${view.campus?'教师':'学部'}"><span class="drill-row-title">${h(s.name)}<small>${view.campus?'查看该学部教师':'查看学部分布'} ↗</small></span><span class="drill-row-number"><strong>${count}<small>人</small></strong><span>${count} / ${total} · ${proportion}</span></span><span class="drill-row-focus">${h(focus(count))}</span></button>`;
    }).join('')}</div><p class="drill-note">${view.campus?'各学部':'三个校区'}人数按人员编号去重后相加，与上方当前范围人数一致。${view.kind==='ai'?'同一教师可出现在不同提示类别，各类不可相加。':view.kind==='hr'&&['awards','certificates'].includes(view.facet)?'同一人可有多种荣誉或证书，各项不可相加。':''}</p>`;
  }
  function person(p) {
    const key = id(p), profile = data.people.find(x => x.id === key) || p;
    const reason = p.reason || p.focus || (view.category ? `2026年春季 · ${categories[view.category]}（最新完整学期已发布结论）` : `${view.title} · ${view.basis === 'undergraduate' ? '本科学历院校' : '最高已获学历院校'}口径`);
    const source = p.source_note || (view.kind === 'scenario' ? '秋季教学与支持过程情境，截至2026-10-30；与春季正式分层分别展示。' : view.category ? '春季完整学期冻结依据 · 演示，非当前学期评价。' : '人员事实档案；荣誉及证书按人员去重。');
    const links = view.kind === 'ai' ? `<button class="text-link" data-ins-proof="${h(p.id)}">${p.case_id?'核查责任事实':'查看依据与行动'} ↗</button><button class="text-link" data-ins-person="${h(key)}" data-ins-tab="${h(p.profile_tab || 'growth')}">查看档案 ↗</button>` : `<button class="text-link" ${view.kind==='scenario'?'data-demo-open':'data-org-open'}="${h(key)}">查看档案 ↗</button>`;
    return `<article class="drill-person" data-drill-person="${h(key)}"><header>${typeof avatar==='function'?avatar(profile,'table-avatar'):''}<div><strong>${h(p.name)}</strong><span>${h(key)} · ${h(department(p))} · ${h(p.subject || p.position || '非任教岗位')}</span></div></header><p>${h(reason)}</p>${p.action?`<p><b>行动</b> ${h(p.action)}</p>`:''}<small>来源：${h(source)}</small><footer>${links}</footer></article>`;
  }
  function roster(rows) {
    const state = localState(), q = state.q.toLocaleLowerCase();
    const found = rows.filter(p => !q || [p.name,id(p),p.subject,p.position,p.reason,p.focus].join(' ').toLocaleLowerCase().includes(q));
    const pages = Math.max(1,Math.ceil(found.length/size));state.page = Math.min(Math.max(1,state.page),pages);
    return `<div class="drill-section-title"><h3>该学部教师与人员</h3><span>仅当前学部</span></div><form data-drill-search class="drill-search"><label class="sr-only" for="drillQuery">搜索姓名、编号、学科或依据</label><input id="drillQuery" type="search" value="${h(state.q)}" placeholder="搜索姓名、编号、学科或依据"><button class="button" type="submit">搜索</button></form><p class="drill-note" role="status">符合筛选 ${found.length} 人 / 本类 ${rows.length} 人 · 第 ${state.page} / ${pages} 页 · 每页 ${size} 人</p><div class="drill-people">${found.slice((state.page-1)*size,state.page*size).map(person).join('') || `<p class="drill-empty">${rows.length?'没有符合搜索词的人员。清空搜索可查看本学部名单。':'该学部当前为 0 人。此条件无匹配记录，不代表教学质量结论。'}</p>`}</div><div class="drill-pages"><button class="button" data-drill-page="${state.page-1}" ${state.page===1?'disabled':''}>上一页</button><span>${state.page} / ${pages}</span><button class="button" data-drill-page="${state.page+1}" ${state.page===pages?'disabled':''}>下一页</button></div>`;
  }
  function body() {
    const rows = unique(selected()).filter(p => inScope(p,view)), total = denominator(view), percent = total ? (rows.length/total*100).toFixed(1)+'%' : '—';
    const canBack = view.department && !view.base.department || view.campus && !view.base.campus;
    return `<section class="org-drilldown" data-drill-kind="${view.kind}" data-drill-view="${view.department?'teachers':view.campus?'departments':'campuses'}">${crumbs()}<div class="drill-heading"><div><span class="drill-kicker">${h(view.period)}</span><h2>${h(view.title)}</h2><p>${h(scopeName(view))}</p></div><div class="drill-total"><strong data-drill-total="${rows.length}">${rows.length}<small>人</small></strong><span>${rows.length} / ${total} · ${percent}</span></div></div><p class="drill-method">分母：${view.kind==='hr'?'当前组织全体教职工':'当前组织任教人员（非任教岗位不适用）'} ${total} 人。${view.kind==='hr'&&!view.category?`学历与院校采用${view.basis==='undergraduate'?'本科':'最高已获'}学历口径。`:''}全部为演示数据，只读浏览。</p>${view.department?roster(rows):distribution(rows)}<footer class="drill-footer">${canBack?'<button class="text-link" data-drill-back>← 返回上一级分布</button>':'<span>组织分布逐级查看</span>'}<button class="text-link" data-drill-close>关闭并返回原页面</button></footer></section>`;
  }
  function update() {
    const host = document.querySelector('#overlay-root .modal-body');if (!host) return;
    host.innerHTML = body();host.scrollTop = 0;
  }
  async function open(el) {
    if (!data) {try {data = await publicData;} catch {return;}}
    const base = window.HouwaiOrgFlow?.currentScope() || {campus:org.campus,department:org.department};
    view = {base:{...base},campus:base.campus || '',department:base.department || '',basis:org.basis,saved:new Map()};
    if (el.hasAttribute('data-ins-category')) {
      view.kind='ai';view.key=el.dataset.insCategory;
      view.title=window.HouwaiInsights.build(data.management || [],data.management_cases || [],{}).groups.find(g=>g.key===view.key)?.label || 'AI管理提示';view.period='AI管理提示 · 演示规则 · 需人工确认';
    } else if (el.hasAttribute('data-demo-scenario')) {
      view.kind='scenario';view.key=el.dataset.demoScenario;view.title=scenarios[view.key]?.[0] || '教学情境';view.period='2026年秋季 · 教学与支持过程';
    } else {
      view.kind='hr';view.category=el.dataset.orgCategory || '';view.facet=el.dataset.orgFacet || '';view.value=el.dataset.orgValue || '';
      if (view.facet==='subject'&&view.value==='true') view.facet='teaching';
      const label = el.querySelector('.drill-original-label')?.textContent || el.querySelector('span')?.textContent || el.textContent;
      view.title=view.category?`${categories[view.category]} · 春季正式分层`:view.facet?label.trim().replace(/\s*[↗→]\s*$/,''):'教职工总数';
      view.period=view.category?'2026年春季 · 最新完整学期 · 正式已发布':'人员结构 · 事实档案';
    }
    openModal(`${view.title} · 组织分布`,body(),'集团 → 校区 → 学部 → 教师',true);
    document.querySelector('#overlay-root .modal')?.classList.add('drill-dialog');
  }
  document.addEventListener('click',e => {
    const el = e.target.closest('[data-ins-category],[data-demo-scenario],[data-org-category],[data-org-facet],[data-drill-campus],[data-drill-level],[data-drill-back],[data-drill-page],[data-drill-close]');
    if (el) {
      e.preventDefault();e.stopImmediatePropagation();
      if (el.matches('[data-ins-category],[data-demo-scenario],[data-org-category],[data-org-facet]')) {open(el);return;}
      if (!view) return;
      if (el.hasAttribute('data-drill-close')) {closeModal();return;}
      if (el.hasAttribute('data-drill-page')) localState().page=Number(el.dataset.drillPage);
      else if (el.hasAttribute('data-drill-campus')) {view.campus=el.dataset.drillCampus;view.department=el.dataset.drillDept;}
      else if (el.dataset.drillLevel==='group') {view.campus='';view.department='';}
      else if (el.dataset.drillLevel==='campus') view.department='';
      else if (el.hasAttribute('data-drill-back')) {if(view.department)view.department='';else view.campus='';}
      update();return;
    }
    // Existing handlers own profile routing and the nested evidence drawer.
    const profile = e.target.closest('.org-drilldown [data-org-open]');
    if (profile) closeModal();
  },true);
  document.addEventListener('submit',e => {
    if (!e.target.matches('[data-drill-search]')) return;
    e.preventDefault();e.stopImmediatePropagation();
    localState().q=e.target.querySelector('input').value.trim();localState().page=1;update();
  },true);
  publicData.then(value => {data=value;}).catch(()=>{});
})();
