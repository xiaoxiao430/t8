'use strict';
/* Read-only synthetic rule suggestions; load after leadership-demo.js and insight-model.js. */
(() => {
  let records = null, cases = [], view = {key:'',q:'',page:1}, detailFocus = null;
  const size = 12;
  const scopeLabel = () => [org.campus,org.department].filter(Boolean).join(' · ') || '集团全部校区';
  const safe = value => esc(value == null || value === '' ? '待核实' : String(value));
  const build = () => window.HouwaiInsights.build(records || [], cases, {campus:org.campus,department:org.department});
  const itemKey = x => String(x.id);
  const allItems = () => build().groups.flatMap(g => g.items);
  const findItem = id => allItems().find(x => itemKey(x) === id);
  const personLink = (x,tab=x.profile_tab || 'growth',label='查看档案 ↗') => `<button class="text-link" data-ins-person="${safe(x.teacher_id)}" data-ins-tab="${safe(tab)}">${safe(label)}</button>`;
  const proofButton = x => `<button class="text-link" data-ins-proof="${safe(itemKey(x))}">${x.case_id ? '核查责任事实' : '查看依据与行动'} ↗</button>`;
  function panel() {
    if (!records || !org.summary || state.data.actor.role === 'mentor') return '';
    const model = build();
    return `<section class="ins-panel panel" id="managementInsights" aria-label="AI管理提示"><header class="ins-heading"><div><span class="ins-mark" aria-hidden="true">✦</span><h2>AI管理提示</h2></div><span class="ins-badge">演示规则演示 · 待校方确认</span></header><p class="ins-summary">${safe(model.summary)}</p><div class="ins-context">${safe(scopeLabel())} · 截至 ${safe(model.as_of)} · 人工确认后执行</div><div class="ins-categories">${model.groups.map(g => `<button data-ins-category="${safe(g.key)}" aria-label="${safe(g.label)}，${g.count}人，查看全部名单"><span>${safe(g.label)}</span><strong>${g.count}<small>人</small></strong><span class="ins-category-link">查看名单 ↗</span></button>`).join('')}</div><ol class="ins-priorities" aria-label="优先行动">${model.priorities.slice(0,3).map((x,i) => `<li data-ins-priority="${safe(itemKey(x))}"><span class="ins-order">${i+1}</span><div><div class="ins-priority-title"><strong>${safe(x.name)}</strong><span>${safe(x.department)} · ${safe(x.subject)}</span></div><p class="ins-action">${safe(x.action)}</p><p class="ins-reason">依据：${safe(x.reason)}</p><div class="ins-priority-foot"><span>责任人 ${safe(x.owner_name)} · 期限 ${safe(x.due_date)}</span>${proofButton(x)}</div></div></li>`).join('') || '<li>当前范围暂无需提示事项。</li>'}</ol><p class="ins-footnote">按当前范围去重计人；同一教师可出现在多类，人数不可相加。纪律／责任事实与教学改进分开核验；低教学结果或记录缺失不自动形成处分。</p></section>`;
  }
  function itemHTML(x) {
    return `<article class="ins-list-person" data-ins-item="${safe(x.teacher_id)}"><header><strong>${safe(x.name)}</strong><span>${safe(x.teacher_id)} · ${safe(x.campus)} · ${safe(x.department)} · ${safe(x.subject)}</span></header><p><b>依据</b>${safe(x.reason)}</p><p><b>建议行动</b>${safe(x.action)}</p><p class="ins-owner">责任人 ${safe(x.owner_name)} · 期限 ${safe(x.due_date)}</p><small>待人工确认 · 核验人 ${safe(x.verification_owner_name || x.owner_name)}<br>适用局限：${safe(x.evidence_limitations)}<br>来源：${safe(x.source_note)}</small><footer>${proofButton(x)}${personLink(x)}</footer></article>`;
  }
  function listBody() {
    const group = build().groups.find(g => g.key === view.key), q = view.q.toLocaleLowerCase();
    const rows = (group?.items || []).filter(x => !q || [x.name,x.teacher_id,x.campus,x.department,x.subject,x.reason,x.owner_name].join(' ').toLocaleLowerCase().includes(q));
    const pages = Math.max(1,Math.ceil(rows.length/size)); view.page = Math.min(Math.max(1,view.page),pages);
    return `<p class="ins-list-count" role="status">共 ${rows.length} 人 · 第 ${view.page} / ${pages} 页 · 每页 ${size} 人</p>${rows.slice((view.page-1)*size,view.page*size).map(itemHTML).join('') || '<p class="ins-empty">暂无符合条件的教师，可调整搜索词或组织范围。</p>'}<div class="ins-pagination"><button class="button" data-ins-page="${view.page-1}" ${view.page===1?'disabled':''}>上一页</button><span>${view.page} / ${pages}</span><button class="button" data-ins-page="${view.page+1}" ${view.page===pages?'disabled':''}>下一页</button></div>`;
  }
  function openList(key) {
    const g = build().groups.find(x => x.key === key);if (!g) return;
    view = {key,q:'',page:1};
    openModal(`${g.label} · 全部名单`,`<p class="ins-list-note">${safe(scopeLabel())} · 演示规则建议，待校方确认。名单按教师去重，类别可重叠。</p>${key==='review'?'<p class="ins-boundary">仅核查独立的纪律／责任线索，责任尚未确定。教学结果低、课堂记录缺失不自动产生处分；先听取教师说明、核对学校资源，再由授权人员复核。</p>':''}<form id="insSearch" class="ins-search"><label class="sr-only" for="insQuery">搜索教师姓名、编号、校区或学科</label><input id="insQuery" type="search" placeholder="搜索姓名、编号、校区、学科或责任人"><button class="button" type="submit">搜索</button></form><div id="insResults">${listBody()}</div>`,'AI管理提示 · 演示规则演示',true);
  }
  function updateList() {const box=document.querySelector('#insResults');if(box){box.innerHTML=listBody();box.closest('.modal-body').scrollTop=0;}}
  function closeDetail() {
    const host=document.querySelector('#insDetailHost');if (!host) return;
    host.remove();document.body.style.overflow=document.querySelector('#overlay-root .modal')?'hidden':'';
    document.querySelector('#overlay-root .modal')?.removeAttribute('inert');
    if(detailFocus?.isConnected)detailFocus.focus();detailFocus=null;
  }
  function detailModal(title,content) {
    closeDetail(); detailFocus=document.activeElement;
    document.querySelector('#overlay-root .modal')?.setAttribute('inert','');
    const host=document.createElement('div');host.id='insDetailHost';host.className='ins-detail-backdrop';
    host.innerHTML=`<section class="ins-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="insDetailTitle"><header><div><small>演示规则演示 · 人工核验</small><h2 id="insDetailTitle">${safe(title)}</h2></div><button data-ins-close aria-label="关闭依据详情">×</button></header><div class="ins-detail-body">${content}</div></section>`;
    document.body.append(host);document.body.style.overflow='hidden';host.querySelector('[data-ins-close]').focus();
  }
  function caseHTML(c) {
    return `<p class="ins-boundary">待人工复核 · 责任未定。纪律／责任事实与教学改进分开核验，当前不形成处分决定。</p><p class="ins-case-meta">${safe(c.name)} · ${safe(c.campus)} · ${safe(c.department)}<br>线索日期 ${safe(c.occurred_at)} · 来源 ${safe(c.source)}<br>责任人 ${safe(c.owner_name)} · 核验期限 ${safe(c.due_date)}</p><section class="ins-facts"><h3>已登记的事实线索</h3>${(c.facts || []).map(f => `<article><b>${safe(f.date)}</b><p>${safe(f.text)}</p><small>来源：${safe(f.source)} · 依据编号 ${safe(f.id)}</small></article>`).join('') || '<p>事实材料待补齐。</p>'}</section><section><h3>教师说明 · 待听取与核实</h3><p>${safe(c.teacher_response || '待听取教师说明，保留教师回应机会。')}</p></section><section><h3>学校资源与支持核查</h3><p>${safe(c.school_support_check)}</p></section><section><h3>下一步 · 人工复核</h3><p>${safe(c.next_action)}</p></section><p class="ins-list-note">${safe(c.note || '全部为独立职责台账，不依据教学低分推定责任。')}</p><footer class="ins-detail-links">${personLink(c,'growth','查看教师档案 ↗')}${personLink(c,'support','核对培养与支持 ↗')}${personLink(c,'appraisal','查看评价考核 ↗')}</footer>`;
  }
  function openCase(id) {
    const c=[...cases,...(org.detail?.management_cases || [])].find(x => String(x.id)===id);if(c)detailModal(c.title || '责任事实核查',caseHTML(c));
  }
  function openProof(id) {
    const x=findItem(id);if (!x) return;if(x.case_id){openCase(String(x.case_id));return;}
    detailModal(`${x.name} · 行动依据`,`<p class="ins-boundary">过程建议，需结合原始材料与教师说明人工确认。</p><section><h3>待人工确认</h3><p>核验人 ${safe(x.verification_owner_name || x.owner_name)}</p><p>${safe(x.evidence_limitations)}</p></section><section><h3>为什么提示</h3><p>${safe(x.reason)}</p><small>来源：${safe(x.source_note)}</small></section><section><h3>建议采取的行动</h3><p>${safe(x.action)}</p><p>责任人 ${safe(x.owner_name)} · 期限 ${safe(x.due_date)}</p></section><section><h3>回到原始记录</h3><p>${(x.evidence_ids || []).length ? `课次依据编号：${x.evidence_ids.map(safe).join('、')}。进入课堂与学情，查看首次、复测及逐人题数。` : '先核对档案与支持台账；尚无课次依据时，补齐后再判断。'}</p></section><footer class="ins-detail-links">${personLink(x,'classroom','查看课堂与学情 ↗')}${personLink(x,'support','核对培养与支持 ↗')}${personLink(x,'appraisal','查看评价考核 ↗')}</footer>`);
  }
  const previousDashboard=orgDashboard;
  orgDashboard=function(){return panel()+previousDashboard();};
  const previousGrowth=orgLegacy.profileGrowth;
  orgLegacy.profileGrowth=function(t){const list=(org.detail?.management_cases || []).filter(c=>c.teacher_id===t.id);return (list.length?`<section class="panel ins-profile-cases" id="insProfileCases"><h2>责任核查记录</h2><p>独立职责台账 · 待人工复核，责任未定；与教学改进分开核验。</p>${list.map(c=>`<button class="text-link" data-ins-case="${safe(c.id)}">${safe(c.title)} · 查看事实与教师说明 ↗</button>`).join('')}</section>`:'')+previousGrowth(t);};
  document.addEventListener('click',e=>{
    if(e.target.id==='insDetailHost'){closeDetail();return;}
    const el=e.target.closest('[data-ins-category],[data-ins-page],[data-ins-proof],[data-ins-case],[data-ins-person],[data-ins-close]');if(!el)return;e.preventDefault();
    if(el.hasAttribute('data-ins-close'))closeDetail();
    else if(el.hasAttribute('data-ins-category'))openList(el.dataset.insCategory);
    else if(el.hasAttribute('data-ins-page')){view.page=Number(el.dataset.insPage);updateList();document.querySelector('#insResults button:not(:disabled)')?.focus();}
    else if(el.hasAttribute('data-ins-proof'))openProof(el.dataset.insProof);
    else if(el.hasAttribute('data-ins-case'))openCase(el.dataset.insCase);
    else {const id=el.dataset.insPerson,tab=el.dataset.insTab || 'growth';closeDetail();closeModal();state.profileTab=tab;state.teacher=id;org.report=false;const hash=`#profile/${encodeURIComponent(id)}/${encodeURIComponent(tab)}`;if(location.hash===hash){readRoute();render();}else location.hash=hash;}
  });
  document.addEventListener('submit',e=>{if(e.target.id!=='insSearch')return;e.preventDefault();view.q=document.querySelector('#insQuery').value.trim();view.page=1;updateList();});
  document.addEventListener('keydown',e=>{const host=document.querySelector('#insDetailHost');if(!host)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeDetail();}else if(e.key==='Tab'){const nodes=[...host.querySelectorAll('button,a[href],input,[tabindex="0"]')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
  const source=typeof publicDataPromise!=='undefined'?publicDataPromise:publicData;
  source.then(data=>{records=Array.isArray(data.management)?data.management:[];cases=Array.isArray(data.management_cases)?data.management_cases:[];if(state.data)render();}).catch(()=>{});
})();
