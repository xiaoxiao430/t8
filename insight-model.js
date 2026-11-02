/* Pure synthetic management guidance; no model API, personnel score or penalty decision. */
(function (root) {
  'use strict';
  const AS_OF = '2026-10-30';
  const SOURCE = 'synthetic-duty-ledger';
  const definitions = [['follow_up','重点跟进'],['praise','建议表扬'],['support','优先支持'],['review','奖惩复核']];
  const array = value => Array.isArray(value) ? value : [];
  const validNumber = value => typeof value === 'number' && Number.isFinite(value);
  const identity = row => row && (row.teacher_id || row.id);
  const scoped = (row, scope) => (!scope.campus || row.campus === scope.campus) && (!scope.department || row.department === scope.department);
  const evidence = row => [...new Set(array(row.evidence_ids).filter(x => typeof x === 'string' && x))];
  const complete = row => {
    const m = row.mastery || {};
    return validNumber(m.expected) && m.expected > 0 && m.determined === m.expected && m.unknown === 0 && m.coverage === 100;
  };
  const known = new Set(['stable','improving','persistent','missing','unsupported','exam_gap']);
  function build(records, cases, scope) {
    scope = scope && typeof scope === 'object' ? scope : {};
    const groups = definitions.map(([key,label]) => ({key,label,items:[],count:0}));
    const byKey = Object.fromEntries(groups.map(g => [g.key,g]));
    const seenRows = new Set(), dataTasks = [];
    const nonTeachingIds = new Set(array(records).filter(row => row && row.teaching === false).map(identity));
    const rows = array(records).filter(row => row && typeof row === 'object' && identity(row) && scoped(row,scope))
      .slice().sort((a,b) => String(identity(a)).localeCompare(String(identity(b))));
    function add(key, row, detail) {
      const teacherId = identity(row), group = byKey[key];
      if (group.items.some(item => item.teacher_id === teacherId)) return;
      const item = {
        id: key+':'+teacherId, teacher_id: teacherId, name: row.name || '演示教师',
        campus: row.campus || '', department: row.department || '', subject: row.subject || '',
        reason: '', action: '', owner_name: row.owner_name || ''+(row.campus || '')+(row.department || '')+'校长',
        due_date: row.due_date || '2026-11-03', profile_tab: 'growth',
        evidence_ids: evidence(row), case_id: null, priority: 0,
        source_note: '教学过程规则演示，截至2026-10-30；非教师评分，不改写春季正式分类。',
        review_status:'pending_confirmation', verification_owner_name:row.verification_owner_name || row.owner_name || ''+(row.department || '')+'学部校长',
        evidence_limitations:row.evidence_limitations || '规则提示仅辅助核验，须结合原始记录、班情、人工观察及教师说明；不直接形成正式档次。',
        issue_type:key==='review'?'responsibility':key==='support'&&row.support_status==='overdue'?'school':'teaching',
        ...detail
      };
      group.items.push(item);
    }
    for (const row of rows) {
      const id = identity(row);
      if (seenRows.has(id)) continue;
      seenRows.add(id);
      if (nonTeachingIds.has(id) || !known.has(row.scenario)) continue;
      const pending = row.evidence_usability === 'pending';
      const full = complete(row) && !pending, hasEvidence = evidence(row).length > 0;
      if(pending) dataTasks.push({teacher_id:id,name:row.name,campus:row.campus,department:row.department,issue_type:'data',reason:row.data_issue_reason || '身份、采集或口径存在待核事项，暂不由此推断教学表现。',owner_name:row.data_owner_name || ''+(row.campus || '')+'信息人员',due_date:row.data_due_date || '2026-11-03',review_status:'pending_verification'});
      const m = row.mastery || {};
      const schoolOverdue = row.scenario === 'unsupported' && row.support_status === 'overdue';
      const exam = row.exam || {};
      const examGap = !pending && row.scenario === 'exam_gap' && exam.status === 'not_achieved' && validNumber(exam.target) && exam.target > 0 && validNumber(exam.actual) && exam.actual >= 0 && exam.actual < exam.target;
      const persistentSignal = validNumber(m.achieved) && m.achieved >= 0 && m.determined-m.achieved >= 3 && validNumber(m.rate) && m.rate < 90;
      if (['persistent','unsupported'].includes(row.scenario) && full && hasEvidence && persistentSignal) {
        add('follow_up',row,{
          reason: '同班科完整课次呈现持续未达标信号，需回到首次作业与课堂解释支架复核。'+(schoolOverdue ? '学校支持尚未兑现，先落实支持再复评。' : ''),
          action: '与教师、导师核对连续课次，调整解释支架与课末反馈；11月13日复评首次作业。',
          profile_tab:'classroom', priority:85
        });
      }
      const trend = array(row.trend), previous = trend[trend.length-2], latest = trend[trend.length-1];
      const recentPositive = latest && latest.label === '10月' && validNumber(latest.rate) && latest.rate >= 90;
      const positive = row.scenario === 'stable' ? row.mastery?.rate === 100 && m.achieved === m.determined : row.scenario === 'improving' && previous && validNumber(previous.rate) && latest?.rate > previous.rate;
      if (['stable','improving'].includes(row.scenario) && full && hasEvidence && recentPositive && positive) {
        add('praise',row,{
          reason: row.scenario === 'improving'
            ? `首次作业实现率由${previous.rate}%提高至10月${latest.rate}%，近期课次支持改进反馈实践。`
            : '完整课次首次作业持续达标，10月近期依据支持肯定学生解释与课末反馈实践。',
          action:'核对近期课次，与教师确认可分享的解释支架和课末反馈做法，在学部共备中具体表扬并继续观察。',
          profile_tab:'classroom', priority:65,
          source_note:'课堂示例与首次作业过程依据；建议肯定具体实践和进步，秋季调研预演不形成正式优秀结论。'
        });
      }
      if (schoolOverdue || examGap || (row.scenario === 'persistent' && full && hasEvidence && persistentSignal)) {
        const school = schoolOverdue;
        add('support',row,{
          reason:school ? '学校承诺的导师共备与示范课支持已逾期未兑现，落实责任在学校。'
            : row.scenario === 'exam_gap' ? '同口径考试实际与考前约定目标有差距，需核对班级起点并安排专项支持。'
              : '持续教学改进需要导师共备、示范观课和复评支持。',
          action:school ? '由校长补排导师共备时段与示范课，11月3日前确认资源到位，再与教师约定复评。'
            : row.scenario === 'exam_gap' ? '与教师核对考前目标及原始结果，安排薄弱知识专项共备，11月13日复核。'
              : '校长安排导师共同备课与一次示范观课，确认支持到位后复评同班科首次作业。',
          due_date:school ? '2026-11-03' : row.due_date || '2026-11-06',
          profile_tab:'support', priority:school ? 100 : 75
        });
      }
    }
    for (const record of array(cases).slice().sort((a,b) => String(a?.id || '').localeCompare(String(b?.id || '')))) {
      if (!record || !record.id || !record.teacher_id || record.teaching === false || nonTeachingIds.has(record.teacher_id) || !scoped(record,scope) || record.source !== SOURCE || !['pending_review','fact_checked'].includes(record.status)) continue;
      const facts = array(record.facts).filter(f => f && f.id && f.text && f.source === SOURCE && /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.date <= AS_OF);
      if (!facts.length || !record.occurred_at || record.occurred_at > AS_OF) continue;
      add('review',record,{
        reason:(record.title || '独立职责台账待核')+'；'+(record.status === 'fact_checked' ? '事实记录已核对，仍须听取教师说明并核查学校支持，是否进入评议由校方决定。' : '责任未定，先听取教师说明并核查课务和学校支持。'),
        action:'核对原约定、原始记录、学校支持与教师说明；由校方决定是否进入奖惩评议，不生成处罚决定。',
        evidence_ids:facts.map(f => f.id), case_id:record.id, profile_tab:'growth', priority:60,
        source_note:'独立职责台账（synthetic-duty-ledger），全部事实为模拟；仅进入人工核验，不由教学低分、资料缺失、机器分析或家长投诉推导处分。'
      });
    }
    for (const group of groups) {
      group.items.sort((a,b) => b.priority-a.priority || a.due_date.localeCompare(b.due_date) || String(a.teacher_id).localeCompare(String(b.teacher_id)));
      group.count = group.items.length;
    }
    // Reserve a place for concrete praise and persistent teaching needs when all
    // categories exist. An unresolved case does not outrank those teaching facts.
    const priorities = [], selected = new Set();
    for (const key of ['support','follow_up','praise','review']) {
      if (priorities.length === 3) break;
      const item = byKey[key].items.find(x => !selected.has(x.teacher_id));
      if (item) {priorities.push({...item,evidence_ids:item.evidence_ids.slice()}); selected.add(item.teacher_id);}
    }
    const counts = groups.map(g => g.label+g.count+'人').join('；');
    const summary = counts+'。'+(priorities.length ? '先落实学校支持、核对连续教学信号并肯定具体进步；按责任人与期限开展行动。' : '当前范围暂无可行动事项，资料待补齐不推断表现。')+' 各类可重叠，不相加为总人数；职责线索先核验、责任未定。';
    return {groups,priorities,summary,as_of:AS_OF,data_tasks:dataTasks};
  }
  root.HouwaiInsights = {build};
})(typeof window !== 'undefined' ? window : globalThis);
