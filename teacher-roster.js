'use strict';
/* Compact, scoped personnel reading and a read-only teacher-local weekly timetable. */
(function(){
  const nativeRoster=orgRosterHTML;
  const safe=value=>esc(value==null?'':String(value));
  let sequence=0,returnFocus=null;
  function degree(value){const d=value||{},badge=d.tier==='985'?'985':d.tier==='211非985'?'211':'',href=/^https:\/\//.test(d.school_url||'')?d.school_url:'',school=safe(d.university||'院校待补充');return `<div class="roster-degree-head"><strong class="roster-degree">${safe(d.education||'待补充')}</strong>${badge?`<span class="roster-school-badge tier-${badge}" title="${badge==='985'?'985院校，同时属于211院校':'211院校'}">${badge}</span>`:''}</div>${href?`<a class="roster-school" href="${safe(href)}" target="_blank" rel="noopener noreferrer" title="查看${school}">${school}</a>`:`<small class="roster-school">${school}</small>`}`;}

  function periodLabel(value){return (value?.period||'').replace('-spring','春').replace('-fall','秋')||value?.period_label||'学期';}
  function row(t){
    const p=t.teaching_profile||{},e=p.evaluation||{},s=p.parent_satisfaction||{},teaching=t.teaching!==false;
    const knownLoad=teaching&&Number.isInteger(p.weekly_load)&&p.weekly_load>=0;
    const evaluation=e.label||(!teaching?'不适用':'待评价');
    const satisfaction=!teaching?'不适用':s.sufficient&&typeof s.rate==='number'?`${Number.isInteger(s.rate)?s.rate:s.rate.toFixed(1)}%`:'资料待补齐';
    return `<tr data-roster-teacher="${safe(t.id)}"><td><button class="org-person roster-person" data-org-open="${safe(t.id)}" aria-label="打开${safe(t.name)}档案">${avatar(t,'table-avatar')}<span><strong>${safe(t.name)}</strong><small>${safe(t.position||'岗位待补充')}</small></span></button></td><td><strong>${safe(p.houwai_joined_on||'未填写')}</strong><small>${Number.isInteger(p.tenure_months)?'在厚外'+Math.floor(p.tenure_months/12)+'年'+p.tenure_months%12+'个月':''}</small></td><td>${degree(p.first_education)}</td><td>${degree(p.final_education||t.highest)}</td><td class="roster-major" title="${safe(p.major||t.major||'待补充')}">${safe(p.major||t.major||'待补充')}</td><td>${safe(teaching?t.subject||'待补充':'不适用')}</td><td>${knownLoad?`<button class="roster-weekly" data-roster-schedule="${safe(t.id)}" data-weekly-load="${safe(p.weekly_load)}" aria-label="查看${safe(t.name)}每周${safe(p.weekly_load)}节课的课表"><b>${safe(p.weekly_load)}</b><span>节／周 ↗</span></button>`:`<span class="roster-unknown">${teaching?'待补充':'不适用'}</span>`}</td><td><span class="roster-evaluation ${safe(e.status||'pending_review')}">${safe(evaluation)}</span><small class="roster-evaluation-period">${safe(periodLabel(e))}${teaching?' · '+(e.human_confirmed?'已确认':'待确认'):''}</small></td><td><strong class="roster-satisfaction ${s.sufficient?'':'pending'}">${safe(satisfaction)}</strong>${teaching?`<small class="roster-sample">有效 ${safe(s.valid??'—')} / 应邀 ${safe(s.expected??'—')}</small>`:''}</td></tr>`;
  }
  orgRosterHTML=function(){
    const original=nativeRoster.apply(this,arguments),r=org.roster;
    if(!r||state.data?.actor?.role==='mentor')return original;
    const box=document.createElement('div');box.innerHTML=original;const table=box.querySelector('.table-scroll table');if(!table)return original;
    table.closest('.table-scroll').classList.add('compact-roster-scroll');
    table.outerHTML=`<table id="teacherRosterCompact" aria-label="教师核心情况名册"><colgroup><col class="roster-col-person"><col class="roster-col-joined"><col class="roster-col-degree"><col class="roster-col-degree"><col class="roster-col-major"><col class="roster-col-subject"><col class="roster-col-load"><col class="roster-col-evaluation"><col class="roster-col-satisfaction"></colgroup><thead><tr><th>教师</th><th>入职厚外</th><th>第一学历</th><th>最终学历</th><th>专业</th><th>任教学科</th><th>周课量</th><th>教学评价</th><th>家长满意度</th></tr></thead><tbody>${r.items.map(row).join('')||'<tr><td colspan="9">没有符合筛选条件的授权人员</td></tr>'}</tbody></table>`;
    return box.innerHTML;
  };
  function close(){sequence++;document.getElementById('teacherTimetableOverlay')?.remove();if(returnFocus?.isConnected)returnFocus.focus();}
  function mount(title){close();returnFocus=document.activeElement;const host=document.createElement('div');host.id='teacherTimetableOverlay';host.innerHTML=`<div class="roster-schedule-backdrop" data-roster-backdrop></div><section class="roster-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="teacherTimetableTitle"><header><div><span>教学安排 · 按教师查看</span><h2 id="teacherTimetableTitle">${safe(title)}</h2></div><button class="roster-schedule-close" data-roster-close aria-label="关闭课表">×</button></header><div id="teacherTimetableBody" role="status"><p class="roster-schedule-note">正在读取当前教师的周课表…</p></div></section>`;document.body.append(host);host.querySelector('[data-roster-close]').focus();return host;}
  function timetable(p,name){
    const rows=Array.isArray(p.timetable)?p.timetable:[],days=[1,2,3,4,5],labels={1:'周一',2:'周二',3:'周三',4:'周四',5:'周五'},periods=[1,2,3,4,5,6,7,8];
    const extra=rows.filter(x=>!days.includes(Number(x.weekday))||!periods.includes(Number(x.period)));
    const lesson=x=>`<article class="roster-schedule-lesson" data-schedule-lesson="${safe(x.id)}"><strong>${safe(x.subject||'学科待补充')}</strong><span>${safe(x.class_name||'班级待补充')}</span><small>${safe(x.room||'教室待补充')}</small></article>`;
    return `<p class="roster-schedule-note">${safe(name)} · ${p.weekly_load==null?'周课量待补充':safe(p.weekly_load)+'节／周'}。以下为排课安排，实际授课与课堂反馈在个人档案中查看。</p><div class="roster-timetable-scroll"><table id="teacherTimetable" aria-label="${safe(name)}一周课表"><thead><tr><th>节次</th>${days.map(x=>`<th>${labels[x]}</th>`).join('')}</tr></thead><tbody>${periods.map(period=>{const time=rows.find(x=>Number(x.period)===period)?.time;return `<tr><th>第${period}节${time?`<small>${safe(time)}</small>`:''}</th>${days.map(day=>`<td>${rows.filter(x=>Number(x.weekday)===day&&Number(x.period)===period).map(lesson).join('')||'<span class="roster-schedule-empty">—</span>'}</td>`).join('')}</tr>`;}).join('')}</tbody></table>${extra.length?`<div class="roster-extra-slots"><p>以下排期需要另行核对：</p>${extra.map(lesson).join('')}</div>`:''}</div><p class="roster-schedule-footnote">课表、当前教学评价和家长满意度分别保留期间及来源；不把课量直接解释为教学质量。</p>`;
  }
  async function open(id){
    const person=org.roster?.items?.find(x=>x.id===id),name=person?.name||'教师';
    const host=mount(name+' · 一周课表'),seq=sequence,who=state.actor;
    try{const result=await request('/development/'+encodeURIComponent(id));if(seq!==sequence||who!==state.actor||!host.isConnected)return;const p=result.teaching_profile;if(!p||p.weekly_load==null){host.querySelector('#teacherTimetableBody').innerHTML='<p class="roster-schedule-note">当前周课表尚未补充，不能按零课量判断。</p>';return;}host.querySelector('#teacherTimetableBody').innerHTML=timetable(p,result.teacher_name||name);}catch(error){if(seq===sequence&&who===state.actor&&host.isConnected)host.querySelector('#teacherTimetableBody').innerHTML=`<p class="roster-schedule-note">${safe(error.message)}</p>`;}
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-roster-close]')||event.target.matches('[data-roster-backdrop]')){event.preventDefault();event.stopImmediatePropagation();close();return;}const button=event.target.closest('[data-roster-schedule]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();open(button.dataset.rosterSchedule);},true);
  document.addEventListener('change',event=>{if(event.target.id==='actorSelect')close();},true);
  window.addEventListener('hashchange',close);
  document.addEventListener('keydown',event=>{const modal=document.getElementById('teacherTimetableOverlay');if(!modal)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}if(event.key==='Tab'){const buttons=[...modal.querySelectorAll('button:not(:disabled),a[href],input,select,textarea')].filter(x=>x.offsetParent!==null),first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}},true);
  if(state.data)render();
})();
