(function(root){'use strict';const clone=x=>JSON.parse(JSON.stringify(x));
function error(code,message,status){const e=new Error(message);e.code=code;e.status=status;throw e;}
function catalog(source,q={}){const origin=source.scope||{},campus=q.campus||origin.campus||'',department=q.department||origin.department||'',provider=q.provider||'';
 if(provider&&!['schoolis','iflytek'].includes(provider))error('invalid_provider','请选择校宝智慧校园或科大讯飞。',400);
 const entries=clone(source.entries).filter(x=>(!campus||x.campus===campus)&&(!department||x.department===department)&&(!provider||x.provider_key===provider));
 if((campus||department)&&!entries.length)error('outside_scope','数据源不在当前授权组织范围。',403);
 const result=clone(source);if(provider)for(const key of ['providers','portals','products','dataset_groups','datasets','source_notes'])result[key]=result[key].filter(x=>x.provider_key===provider);
 return {...result,scope:{campus,department,label:[campus,department].filter(Boolean).join(' · ')||origin.label||'集团'},entries,provider};}
function entry(source,id){const result=source.entries.find(x=>x.id===id);if(!result)error('outside_scope','数据源不在当前授权组织范围。',403);return clone(result);}
function capabilities(source,id){const item=entry(source,id);return {entry:item,datasets:clone(source.datasets.filter(x=>x.provider_key===item.provider_key)),connected:false,vendor_api_verified:false,notice:'厚外预留的适配能力，需逐项与供应商确认。',read_only:true};}
function fetch(source,id,dataset){const item=entry(source,id);if(typeof dataset!=='string'||!source.datasets.some(x=>x.provider_key===item.provider_key&&x.key===dataset))error('invalid_dataset','请选择当前数据源已列出的数据类型。',400);error('provider_not_connected','该数据接口已预留，尚未取得供应商授权并接通；没有返回真实数据。',501);}
const api={catalog,entry,capabilities,fetch};root.HouwaiLearningSources=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
