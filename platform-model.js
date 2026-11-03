/* Read-only static projections; source was already reduced by server scope. */
(function(root){'use strict';
const PERIOD='2026-fall',AS_OF='2026-10-30',PAY_VERSION='pay-demo-2026-11-v1';
const clone=v=>JSON.parse(JSON.stringify(v)),sum=(a,f)=>a.reduce((n,x)=>n+f(x),0),pct=(n,d)=>d?Math.floor(n*10000/d+.5)/100:null;
function error(code,message){const e=new Error(message);e.code=code;throw e;}
function base(source,q={}){
 if((q.period===undefined?PERIOD:q.period)!==PERIOD)error('invalid_platform_period','请选择2026年秋季学期。');
 const origin=source.scope||{},campus=q.campus||origin.campus||'',department=q.department||origin.department||'';
 const people=(source.people||[]).filter(p=>(!campus||p.campus===campus)&&(!department||(p.department||'待分学部')===department));
 if((campus||department)&&!people.length)error('outside_scope','组织不在当前授权范围。');
 return [{scope:{campus,department,label:[campus,department].filter(Boolean).join(' · ')||'集团全景'},period:PERIOD,period_label:'2026年秋季学期',as_of:AS_OF,read_only:true},people];
}
function select(source,q={}){const [result,people]=base(source,q),s=result.scope;return [result,people,clone((source.teaching_units||[]).filter(x=>(!s.campus||x.campus===s.campus)&&(!s.department||x.department===s.department)&&['subject','grade','class_id'].every(k=>!q[k]||x[k]===q[k])))];}
function teaching(source,q={}){
 const [result,,rows]=select(source,q),classes=new Map(rows.map(r=>[r.class_id,r.students]));
 const first=Object.fromEntries(['expected','determined','achieved','unknown'].map(k=>[k,sum(rows,r=>r.first[k])]));first.rate=pct(first.achieved,first.determined);first.coverage=pct(first.determined,first.expected);
 const retest={participants:sum(rows,r=>r.retest.participants),mastered:sum(rows,r=>r.retest.mastered)};retest.rate=pct(retest.mastered,retest.participants);
 const exam=Object.fromEntries(['target','actual','total'].map(k=>[k,sum(rows,r=>r.exam[k])]));exam.gap=sum(rows,r=>Math.max(0,r.exam.target-r.exam.actual));exam.net_gap=Math.max(0,exam.target-exam.actual);exam.surplus=sum(rows,r=>Math.max(0,r.exam.actual-r.exam.target));exam.rate=pct(exam.actual,exam.total);
 const summary={classes:classes.size,students:sum([...classes.values()],x=>x),units:rows.length,plan_points:sum(rows,r=>r.plan_points),taught_points:sum(rows,r=>r.taught_points),mastered_points:sum(rows,r=>r.mastered_points),first,retest,exam,sample_label:'教学样本 · 不代表全校学籍人数'};
 const groups=new Map();for(const r of rows){const a=r.ability;if(!groups.has(a.label))groups.set(a.label,{label:a.label,demonstrated:0,total:0,rubric:a.rubric});const g=groups.get(a.label);g.demonstrated+=a.demonstrated;g.total+=a.total;}
 const capacity=[...groups.values()].map(a=>({...a,rate:pct(a.demonstrated,a.total)})),comparable=rows.filter(r=>r.historical.comparable);
 const history=[{key:'baseline',label:'本届9月起点',first_rate:pct(sum(rows,r=>r.baseline.first_achieved),sum(rows,r=>r.baseline.first_determined)),sample_units:rows.length,note:'同一组班级的同口径首次独立作业。'},{key:'current',label:'本届10月当前',first_rate:first.rate,sample_units:rows.length,note:'与起点比较；复测单独列示。'},{key:'historical',label:'历届同期参考',first_rate:pct(sum(comparable,r=>r.historical.first_achieved),sum(comparable,r=>r.historical.first_determined)),sample_units:comparable.length,excluded_units:rows.length-comparable.length,note:'只汇总课型、范围及起点接近的样本；其余不直接同比。'}];
 const scenarios=[['conservative','保守情景',0,'后续保持当前表现，支持措施尚未产生新增变化。','先落实困难知识点支持。'],['baseline','基准情景',2,'完成本月共备与专项反馈，示例按每班科新增2位达线学生估计。','每周检查专项任务与首次反馈。'],['positive','积极情景',4,'支持全部兑现且练习能迁移，示例按每班科新增4位达线学生估计。','增加迁移任务并复看实际考试。']].map(([key,label,extra,assumptions,action])=>{const estimates=rows.map(r=>Math.min(r.exam.total,r.exam.actual+extra)),n=sum(estimates,x=>x),gap=sum(rows,(r)=>Math.max(0,r.exam.target-Math.min(r.exam.total,r.exam.actual+extra)));return {key,label,target_students:exam.target,estimated_students:n,gap,net_gap:Math.max(0,exam.target-n),assumptions,action,estimated:true,unit:'班科达线人次',note:'演示估计，不是考试预测结论。'};});
 return {...result,rows,summary,history,capacity,scenarios,filters:{subjects:[...new Set(rows.map(r=>r.subject))].sort(),grades:[...new Set(rows.map(r=>r.grade))].sort()},comparison_notes:['计划、实际教学和学生掌握分别记录；教完不等于学会。','堂堂清按首次独立作业原始人数判断；有缺交的课次保留待补齐，复测不覆盖首次。','本届起点变化与历届同期分开；不同试卷不直接用原始分数判断进退步。','能力任务按具体任务要求观察，不换算成考试分数或教师总分。','课堂与目标为独立教学规划样本，不改写个人档案已有的正式评价。']};
}
function research(source,q={}){
 const [result]=base(source,q),s=result.scope,matches=x=>(!s.campus||x.campus===s.campus)&&(!s.department||x.department===s.department)&&(!q.subject||x.subject===q.subject);
 let projects=clone((source.projects||[]).filter(matches)),ids=new Set(projects.map(x=>x.id));
 const applications=clone((source.applications||[]).filter(x=>ids.has(x.project_id)&&matches(x)&&(!q.class_id||x.class_id===q.class_id)&&(!q.grade||x.grade===q.grade)));
 if(q.class_id||q.grade){ids=new Set(applications.map(x=>x.project_id));projects=projects.filter(x=>ids.has(x.id));}
 const ai=new Set(projects.flatMap(p=>p.artifact_ids)),artifacts=clone((source.artifacts||[]).filter(x=>ai.has(x.id))),campuses=new Set(s.campus?[s.campus]:projects.map(p=>p.campus)),classes=new Map(applications.map(x=>[x.class_id,x.students]));
 return {...result,projects,artifacts,applications,programs:clone(source.programs||[]),summary:{projects:projects.length,artifacts:ai.size,applications:applications.length,classes:classes.size,students:sum([...classes.values()],x=>x),original_artifacts:sum(artifacts,x=>campuses.has(x.campus)?1:0)},note:'同一作品跨校区使用仍按1件作品统计，课堂应用按实际班级与日期分别记录；示例变化不代表因果结论。'};
}
function salary(source,q={}){
 const [result,people]=base(source,q);if(!source.capabilities?.view_salary_simulation)error('salary_forbidden','本身份没有薪酬方案查看权限。');
 const params={version:PAY_VERSION,personal_bonus:800,team_bonus:400,budget_per_person:0};
 for(const key of ['personal_bonus','team_bonus','budget_per_person']){const value=q[key]??params[key],n=Number(value);if(typeof value==='boolean'||value===null||value===''||!Number.isFinite(n)||n<0||!Number.isInteger(n)||n>50000)error('invalid_salary_parameter','薪酬模拟参数须为0至50000的整数。');params[key]=n;}
 const ids=new Set(people.filter(p=>p.teaching).map(p=>p.id)),rows=clone((source.salary_rows||[]).filter(x=>ids.has(x.teacher_id)));
 for(const r of rows){r.personal_incentive=r.personal_units*params.personal_bonus;r.team_incentive=r.team_units*params.team_bonus;r.protected=r.current+r.personal_incentive+r.team_incentive;}
 const current=sum(rows,r=>r.current),bonus=sum(rows,r=>r.personal_incentive+r.team_incentive),budget=params.budget_per_person?params.budget_per_person*rows.length:current;
 if(bonus>budget)error('salary_budget_exceeded','专项激励超过本次模拟预算，请降低单项金额或调整预算。');
 const remaining=budget-bonus;let allocated=0;rows.forEach((r,i)=>{const amount=i===rows.length-1?remaining-allocated:current?Math.floor(remaining*r.current/current):0;allocated+=amount;r.restructured=amount+r.personal_incentive+r.team_incentive;r.change_protected=r.protected-r.current;r.change_restructured=r.restructured-r.current;});
 const totals=Object.fromEntries(['current','protected','restructured','personal_incentive','team_incentive'].map(k=>[k,sum(rows,r=>r[k])]));
 return {...result,allowed:true,params,rows,totals,scenarios:[{key:'protected',label:'保留现有收入＋增加激励',total:totals.protected,difference:totals.protected-current},{key:'restructured',label:'总预算内重构',total:totals.restructured,difference:totals.restructured-current}],approval_note:'全部金额为示例参数，仅用于方案比较；本人贡献与团队成果分别展示，实际工资及调整须按学校制度审批。预算人均填0时沿用本范围当前示例总预算。',rules_version:PAY_VERSION};
}
function data_center(source,q={}){
 const [result,people]=base(source,q),rows=people.slice(0,5).map((p,i)=>{const joined=p.houwai_joined_on||null,issue=i===3?'入职日期晚于离职日期':i===4?'同一人员编号重复，请保留有效记录':'';return {row_number:i+2,employee_no:i===4?people[0].id:p.id,name:p.name,campus:p.campus,department:p.department||'校园保障',houwai_joined_on:joined,left_on:i===3&&joined?(Number(joined.slice(0,4))-1)+'-08-31':'',status:issue?'需调整':'可导入',errors:issue?[issue]:[],error:issue};}),sample={rows,valid_rows:rows.filter(r=>!r.errors.length).length,error_rows:rows.filter(r=>r.errors.length).length,issues:rows.filter(r=>r.errors.length).map(r=>({row_number:r.row_number,message:r.error})),note:'预置导入示例，不读取或上传真实人事资料。'};
 return {...result,fields:clone(source.hr_template),template_csv:source.template_csv,sample_preview:sample,reconciliation:{expected:people.length,matched:sample.valid_rows,new:0,errors:sample.error_rows,preview_rows:sample.rows.length,write_enabled:false},sources:clone(source.sources),rules:clone(source.rules),mapping_note:'人员、班级、学科、任教起止日期、考试、知识点和作品使用稳定编号对接；不按姓名或显示班名直接关联。',write_enabled:false};
}
function overview(source,q={}){
 const [result,people]=base(source,q),t=teaching(source,q),r=research(source,q),counts={staff:people.length,teaching:sum(people,p=>p.teaching?1:0),reserve:sum(people,p=>!p.teaching&&!p.additional?1:0),support_staff:sum(people,p=>p.additional?1:0),classes:t.summary.classes,students:t.summary.students,projects:r.summary.projects,artifacts:r.summary.artifacts,applications:r.summary.applications,estimated_target_gap:t.summary.exam.gap},organizations=[];
 const groups=new Map();for(const p of people){const key=p.campus+'|'+(p.department||'');if(!groups.has(key))groups.set(key,[p.campus,p.department]);}
 for(const [campus,department] of groups.values()){const ps=people.filter(p=>p.campus===campus&&p.department===department),units=t.rows.filter(x=>x.campus===campus&&x.department===department),classes=new Map(units.map(x=>[x.class_id,x.students]));organizations.push({campus,department,label:campus+' · '+(department||'校园保障'),staff:ps.length,teaching:sum(ps,p=>p.teaching?1:0),classes:classes.size,students:sum([...classes.values()],x=>x),projects:sum(r.projects,p=>p.campus===campus&&p.department===department?1:0)});}
 const compare=(a,b)=>Number(!a.priority)-Number(!b.priority)||(a.campus<b.campus?-1:a.campus>b.campus?1:0)||(a.id<b.id?-1:a.id>b.id?1:0);
 const actions=[...r.projects].sort(compare).slice(0,3).map(p=>({id:p.id,title:p.next_action,reason:p.problem,owner_name:p.owner_name,due_date:p.due_date,target:'research'}));
 return {...result,title:result.scope.label,judgment:{summary:'教研已有作品与课堂应用，下一步把学生变化和教师支持连起来回看。',strengths:'初中英语、地理、历史先行；其他学部保留各自项目与接入入口。',difficulties:'不同班级的掌握程度与进度存在差异，需要按学科落实支持。',focus:'优先兑现共备时间，回看首次学习反馈，并明确下一轮复评。'},counts,actions,organizations,sample_note:'班级与学生数字为教学样本；人员按当前组织名册统计。',capabilities:clone(source.capabilities)};
}
const api={overview,teaching,research,salary,data_center};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HouwaiPlatform=api;
})(typeof window==='undefined'?globalThis:window);
