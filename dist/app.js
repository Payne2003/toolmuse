import {parsePrompts, planQueue} from './queue-core.js';
const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const STORAGE = 'huy-studio-v1';
const modes = {text:'Prompt → Video','generate-image':'Tạo ảnh',image:'Ảnh → Video',affiliate:'Link sản phẩm'};
const modeIcons = {text:'spark','generate-image':'image',image:'image',affiliate:'link'};
const languages = {en:'Tiếng Anh',vi:'Tiếng Việt',none:'Không thoại'};
let state, mode = 'text', filter = 'all', view = 'list', selected = new Set(), editId = null, rename = false;
let stagedImage = null, stagedUrl = null, videoJobId = null, toastTimer, undoAction, persistenceWarning = false;
let renderVersion = 0, assetUrls = new Map();
const freshState = () => { const id=uid(); return {version:1,active:id,email:'',projects:[{id,name:'Dự án đầu tiên',jobs:[],draft:{}}]}; };
try {
  const raw=JSON.parse(localStorage.getItem(STORAGE));
  if(!raw || raw.version!==1 || !Array.isArray(raw.projects) || !raw.projects.length || raw.projects.some(p=>!p.id || typeof p.name!=='string' || !Array.isArray(p.jobs))) throw new Error();
  state=raw;
  if(!state.projects.some(p=>p.id===state.active)) state.active=state.projects[0].id;
} catch { state=freshState(); }
state.accounts=Array.isArray(state.accounts)?state.accounts:[];
const hasResult=j=>Boolean(j.video||j.outputImage);
const project = () => state.projects.find(p=>p.id===state.active);
const jobById = id => project().jobs.find(j=>j.id===id);
function toast(message,undo){
  clearTimeout(toastTimer); $('toastText').textContent=message; $('toast').hidden=false;
  undoAction=undo; $('undoBtn').hidden=!undo;
  toastTimer=setTimeout(()=>{$('toast').hidden=true;undoAction=null;},undo?12000:4500);
}
$('undoBtn').onclick=()=>{if(undoAction) undoAction(); $('toast').hidden=true;undoAction=null;};
function save(){
  try {localStorage.setItem(STORAGE,JSON.stringify(state));$('saveStatus').innerHTML='<i></i>Đã lưu trên thiết bị';persistenceWarning=false;return true;}
  catch { $('saveStatus').textContent='Chưa lưu — hãy xuất dự án'; if(!persistenceWarning)toast('Không thể lưu trên trình duyệt. Hãy xuất dự án để giữ dữ liệu.');persistenceWarning=true;return false; }
}
const dbReady = new Promise((resolve,reject)=>{
  const request=indexedDB.open('huy-studio-media',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
// A rejected database is handled on each media action; prompts remain usable.
dbReady.catch(()=>{});
async function putFile(file){
  const db=await dbReady; const id=uid();
  await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id,file});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  return {id,name:file.name,type:file.type,size:file.size};
}
async function getFile(ref){
  if(!ref)return null;const db=await dbReady;
  return new Promise((resolve,reject)=>{const req=db.transaction('files').objectStore('files').get(ref.id);req.onsuccess=()=>resolve(req.result?.file||null);req.onerror=()=>reject(req.error);});
}
async function fileUrl(ref){
  if(!ref)return null;if(assetUrls.has(ref.id))return assetUrls.get(ref.id);
  const file=await getFile(ref);if(!file)return null;const url=URL.createObjectURL(file);assetUrls.set(ref.id,url);return url;
}
async function pruneFiles(){
  try {
    const refs=new Set(state.projects.flatMap(p=>p.jobs.flatMap(j=>[j.image?.id,j.video?.id,j.outputImage?.id]).filter(Boolean)));
    const db=await dbReady;const tx=db.transaction('files','readwrite');const request=tx.objectStore('files').openCursor();
    request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(!refs.has(cursor.key))cursor.delete();cursor.continue();};
  } catch { /* Media will report its own availability when accessed. */ }
}
function splitPrompts(value){return parsePrompts(value,$('separatorMode').value,$('customSeparator').value);}
function rememberDraft(){
  project().draft={mode,prompt:$('promptInput').value,common:$('commonInput').value,links:$('linksInput').value,duration:$('duration').value,ratio:$('ratio').value,language:$('language').value,separator:$('separatorMode').value,delimiter:$('customSeparator').value};save();
}
function updateCounter(){
  const value=$('promptInput').value,count=splitPrompts(value).length;
  $('charCount').textContent=`${value.length.toLocaleString('vi-VN')} ký tự · ${count} cảnh`;
  $('addCount').textContent=count;$('addJobs').disabled=count===0;
}
function chooseMode(next,persist=true){
  mode=Object.hasOwn(modes,next)?next:'text';
  document.querySelectorAll('.mode-tab').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-selected',String(b.dataset.mode===mode));});
  $('imageArea').hidden=mode!=='image';$('linkArea').hidden=mode!=='affiliate';
  $('promptLabel').textContent=mode==='generate-image'?'Nhập prompt tạo ảnh':'Nhập prompt tạo video';
  $('duration').closest('label').hidden=mode==='generate-image';$('language').closest('label').hidden=mode==='generate-image';
  if(persist)rememberDraft();
}
function loadDraft(){
  const d=project().draft||{};$('promptInput').value=d.prompt||'';$('commonInput').value=d.common||'';$('linksInput').value=d.links||'';
  $('duration').value=['8','10','15'].includes(String(d.duration))?d.duration:'8';
  $('ratio').value=['16:9','9:16','1:1'].includes(d.ratio)?d.ratio:'16:9';
  $('language').value=Object.hasOwn(languages,d.language)?d.language:'en';$('separatorMode').value=['line','blank','custom'].includes(d.separator)?d.separator:'line';$('customSeparator').value=d.delimiter||'---';$('customSeparator').hidden=$('separatorMode').value!=='custom';chooseMode(d.mode||'text',false);clearStagedImage();updateCounter();
}
function renderSidebar(){
  $('projectCount').textContent=state.projects.length;$('projectTitle').textContent=project().name;
  $('projectList').innerHTML=state.projects.map(p=>`<button class="project-item ${p.id===state.active?'active':''}" data-project="${esc(p.id)}">${icon('folder')}<span>${esc(p.name)}</span><small>${p.jobs.length||''}</small></button>`).join('');
  $('mediaCount').textContent=project().jobs.reduce((n,j)=>n+Boolean(j.image)+Boolean(j.video)+Boolean(j.outputImage),0);
}
function actionButton(name,label,action,id){return `<button class="icon-btn" title="${label}" aria-label="${label}" data-action="${action}" data-id="${esc(id)}">${icon(name)}</button>`;}
function jobActions(j){return actionButton('copy','Sao chép prompt','copy',j.id)+actionButton('plus','Nhân bản cảnh','duplicate',j.id)+actionButton('edit','Sửa cảnh','edit',j.id)+(hasResult(j)?actionButton('down','Tải kết quả đã nhập','download',j.id):actionButton('up',j.mode==='generate-image'?'Nhập ảnh đã có':'Nhập video đã có','import',j.id))+actionButton('trash','Xóa cảnh','delete',j.id);}
function thumb(j,grid=false){return `<button class="${grid?'grid-media':'media-thumb'}" data-action="media" data-id="${esc(j.id)}" aria-label="Xem media cảnh">${(j.outputImage||j.image)?`<img data-media="${esc((j.outputImage||j.image).id)}" alt="Ảnh tham chiếu" hidden>`:''}<span class="thumb-fallback">${icon(j.video?'play':(j.outputImage||j.image||j.mode==='generate-image')?'image':'film')}</span></button>`;}
// Trạng thái chạy do người dùng cập nhật (tool không tự gửi lên Muse). Có file kết quả = Xong.
const RUN={waiting:'Chờ',running:'Đang chạy',done:'Xong',error:'Lỗi'};
const runStatus=j=>hasResult(j)?'done':Object.hasOwn(RUN,j.runStatus||'')?j.runStatus:(j.sent?'running':'waiting');
function setRunStatus(j,value){j.runStatus=value;j.sent=value!=='waiting';if(value==='waiting')j.sentAt=null;else if(!j.sentAt)j.sentAt=new Date().toISOString();}
const STATUS_CLASS={done:'imported',running:'sent',error:'error',waiting:''};
function statusBadge(j){const st=runStatus(j),label=st==='waiting'&&!j.assignment?'Bản nháp':RUN[st];return `<span class="row-status ${STATUS_CLASS[st]}"><i></i>${label}</span>`;}
function renderQueue(){
  const version=++renderVersion,jobs=project().jobs,q=$('searchInput').value.toLocaleLowerCase('vi');
  const shown=jobs.filter(j=>(filter==='all'||(filter==='imported'?hasResult(j):!hasResult(j)))&&`${j.prompt} ${j.common||''}`.toLocaleLowerCase('vi').includes(q));
  $('totalCount').textContent=jobs.length;$('countAll').textContent=jobs.length;$('countDraft').textContent=jobs.filter(j=>!hasResult(j)).length;$('countImported').textContent=jobs.filter(j=>hasResult(j)).length;
  selected=new Set([...selected].filter(id=>jobs.some(j=>j.id===id)));$('selectionBar').hidden=selected.size===0;$('selectionCount').textContent=`Đã chọn ${selected.size} cảnh`;
  $('deleteSelected').textContent='Xóa cảnh đã chọn';
  $('queueSummary').textContent=jobs.length?`${shown.length}/${jobs.length} cảnh · ${jobs.reduce((n,j)=>n+Number(j.duration||0),0)} giây dự kiến`:'Chưa có cảnh nào trong dự án';
  if(!shown.length){
    $('queueContent').innerHTML=`<div class="empty-state"><div class="empty-illustration">${icon(jobs.length?'search':'film')}</div><h3>${jobs.length?'Không tìm thấy cảnh phù hợp':'Câu chuyện của bạn bắt đầu ở đây'}</h3><p>${jobs.length?'Thử một từ khóa khác hoặc chọn bộ lọc Tất cả.':'Thêm prompt đầu tiên để bắt đầu sắp xếp các cảnh trong video của bạn.'}</p><button id="emptyAction">${jobs.length?'Xóa bộ lọc':'Viết prompt đầu tiên'}${icon('arrow')}</button></div>`;
    $('emptyAction').onclick=()=>{if(jobs.length){filter='all';$('searchInput').value='';syncFilters();renderQueue();}else{$('promptInput').focus();$('promptInput').scrollIntoView({block:'center',behavior:'smooth'});}};
  } else if(view==='list'){
    $('queueContent').innerHTML=`<div class="table-wrap"><table class="jobs-table"><thead><tr><th><input id="selectAll" type="checkbox" aria-label="Chọn tất cả cảnh hiển thị" ${shown.every(j=>selected.has(j.id))?'checked':''}></th><th>STT</th><th>MEDIA</th><th>PROMPT</th><th>TÀI KHOẢN</th><th>THÔNG SỐ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>${shown.map(j=>`<tr><td><input type="checkbox" data-select="${esc(j.id)}" aria-label="Chọn cảnh ${jobs.indexOf(j)+1}" ${selected.has(j.id)?'checked':''}></td><td class="row-number">${String(jobs.indexOf(j)+1).padStart(2,'0')}</td><td>${thumb(j)}</td><td><div class="row-prompt">${esc(j.prompt)}</div><div class="row-meta">${esc(languages[j.language]||languages.en)}${j.links?.length?` · ${j.links.length} link sản phẩm`:''}${j.image?` · ${esc(j.image.name)}`:''}</div></td><td>${accountBadge(j)}</td><td><span class="mode-badge">${icon(modeIcons[j.mode]||'film')}${esc(modes[j.mode]||modes.text)}</span><div class="row-meta">${esc(j.ratio)}${j.mode==='generate-image'?'':` · ${esc(j.duration)} giây`}</div></td><td>${statusBadge(j)}</td><td><div class="row-actions">${jobActions(j)}</div></td></tr>`).join('')}</tbody></table></div>`;
    $('selectAll').onchange=e=>{for(const j of shown)e.target.checked?selected.add(j.id):selected.delete(j.id);renderQueue();};
    document.querySelectorAll('[data-select]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);renderQueue();});
  }else{
    $('queueContent').innerHTML=`<div class="grid-jobs">${shown.map(j=>`<article class="job-card">${thumb(j,true)}<span class="row-number">CẢNH ${String(jobs.indexOf(j)+1).padStart(2,'0')}</span>${statusBadge(j)}<div class="row-prompt">${esc(j.prompt)}</div><div class="row-meta">${esc(modes[j.mode])} · ${esc(j.ratio)}${j.mode==='generate-image'?'':` · ${esc(j.duration)} giây`}</div><div class="row-actions">${jobActions(j)}</div></article>`).join('')}</div>`;
  }
  for(const j of shown){const imageRef=j.outputImage||j.image;if(imageRef)fileUrl(imageRef).then(url=>{if(!url||version!==renderVersion)return;document.querySelectorAll(`[data-media="${CSS.escape(imageRef.id)}"]`).forEach(img=>{img.src=url;img.hidden=false;img.nextElementSibling.hidden=true;});}).catch(()=>{});}
  renderSidebar();renderLanes();
  if($('boardDialog').open)renderBoard();
}
function syncFilters(){document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));}
function openAccount(){renderAccounts();$('accountsDialog').showModal();}
for(const id of ['accountBtn','connectSide','noticeConnect'])$(id).onclick=openAccount;
$('accountForm').onsubmit=e=>{e.preventDefault();state.email=$('accountEmail').value.trim();if(save())toast(state.email?'Đã lưu email trên thiết bị. Muse vẫn chưa được kết nối.':'Đã xóa email đã lưu.');};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('playerDialog').addEventListener('close',()=>{$('playerContent').querySelector('video')?.pause();$('playerContent').innerHTML='';});
$('helpBtn').onclick=()=>$('helpDialog').showModal();
$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
document.addEventListener('click',e=>{if(!$('sidebar').contains(e.target)&&!$('menuBtn').contains(e.target))$('sidebar').classList.remove('open');});
$('studioNav').onclick=()=>{$('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});};
function openProjectForm(isRename=false){rename=isRename;$('projectDialogTitle').textContent=rename?'Đổi tên dự án':'Tạo dự án';$('projectName').value=rename?project().name:'';$('projectDialog').showModal();$('projectName').focus();}
$('newProject').onclick=()=>openProjectForm();$('newProjectIcon').onclick=()=>openProjectForm();$('renameProject').onclick=()=>openProjectForm(true);
$('projectForm').onsubmit=e=>{e.preventDefault();const name=$('projectName').value.trim();if(!name)return;rememberDraft();if(rename)project().name=name;else{const p={id:uid(),name,jobs:[],draft:{}};state.projects.push(p);state.active=p.id;selected.clear();loadDraft();}save();renderQueue();$('projectDialog').close();toast(rename?'Đã đổi tên dự án':'Đã tạo dự án mới');};
$('projectList').onclick=e=>{const b=e.target.closest('[data-project]');if(!b||b.dataset.project===state.active)return;rememberDraft();state.active=b.dataset.project;selected.clear();filter='all';$('searchInput').value='';loadDraft();syncFilters();save();renderQueue();$('sidebar').classList.remove('open');};
document.querySelectorAll('.mode-tab').forEach(b=>b.onclick=()=>chooseMode(b.dataset.mode));
for(const id of ['promptInput','commonInput','linksInput','customSeparator'])$(id).addEventListener('input',()=>{updateCounter();rememberDraft();});
for(const id of ['duration','ratio','language'])$(id).onchange=rememberDraft;
$('separatorMode').onchange=()=>{$('customSeparator').hidden=$('separatorMode').value!=='custom';rememberDraft();updateCounter();};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!document.querySelector('dialog[open]')){e.preventDefault();$('addJobs').click();}});
function clearStagedImage(){stagedImage=null;if(stagedUrl)URL.revokeObjectURL(stagedUrl);stagedUrl=null;$('attachedImage').hidden=true;$('dropzone').hidden=false;$('imageInput').value='';}
async function stageImage(file){
  if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))return toast('Hãy chọn ảnh JPG, PNG hoặc WebP.');if(file.size>10*1024*1024)return toast('Ảnh tối đa 10 MB.');
  try {const bitmap=await createImageBitmap(file);bitmap.close();}catch{return toast('Không đọc được ảnh. Hãy chọn một file ảnh hợp lệ.');}
  clearStagedImage();stagedImage=file;stagedUrl=URL.createObjectURL(file);$('dropzone').hidden=true;$('attachedImage').hidden=false;
  $('attachedImage').innerHTML=`<img src="${stagedUrl}" alt="Ảnh tham chiếu đã chọn"><span>${esc(file.name)}<small class="row-meta" style="display:block">Sẽ được lưu cùng các cảnh bạn thêm</small></span><button class="icon-btn" id="removeImage" aria-label="Bỏ ảnh">${icon('close')}</button>`;$('removeImage').onclick=clearStagedImage;
}
$('imageInput').onchange=e=>stageImage(e.target.files[0]);
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('over');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('over');if(event==='drop')stageImage(e.dataTransfer.files[0]);});
function validLink(s){try{const u=new URL(s);return u.protocol==='https:'||u.protocol==='http:';}catch{return false;}}
let adding=false;
$('addJobs').onclick=async()=>{
  if(adding)return;const prompts=splitPrompts($('promptInput').value);if(!prompts.length)return toast('Hãy nhập ít nhất một prompt.');if(prompts.length>100)return toast('Mỗi lần thêm tối đa 100 cảnh.');
  if(project().jobs.length+prompts.length>1000)return toast('Mỗi dự án hỗ trợ tối đa 1.000 cảnh.');
  if(mode==='image'&&!stagedImage)return toast('Hãy thêm ảnh tham chiếu trước.');
  const links=mode==='affiliate'?$('linksInput').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean):[];
  if(mode==='affiliate'&&(!links.length||links.some(l=>!validLink(l))))return toast('Hãy nhập link http/https hợp lệ, mỗi dòng một link.');
  const target=project(), config={mode,duration:mode==='generate-image'?0:Number($('duration').value),ratio:$('ratio').value,language:$('language').value,common:$('commonInput').value.trim(),links};
  adding=true;$('addJobs').disabled=true;
  try {
    const image=mode==='image'?await putFile(stagedImage):null;
    target.jobs.push(...prompts.map(prompt=>({id:uid(),prompt,...config,image,video:null,outputImage:null,assignment:null,createdAt:new Date().toISOString()})));
    $('promptInput').value='';clearStagedImage();rememberDraft();filter='all';$('searchInput').value='';syncFilters();updateCounter();renderQueue();toast(`Đã thêm ${prompts.length} cảnh nháp. Chưa gửi sang Muse.`);
  }catch{toast('Không lưu được ảnh trên thiết bị. Hãy kiểm tra dung lượng trình duyệt.');}
  finally{adding=false;updateCounter();}
};
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;syncFilters();renderQueue();});
$('searchInput').oninput=renderQueue;
function setView(next){view=next;selected.clear();for(const id of ['listView','gridView']){const active=id===(next==='list'?'listView':'gridView');$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}renderQueue();}
$('listView').onclick=()=>setView('list');$('gridView').onclick=()=>setView('grid');
const fullPrompt=j=>[j.prompt,j.common].filter(Boolean).join('\n\n');
async function copyPrompt(j){try{await navigator.clipboard.writeText(fullPrompt(j));toast('Đã sao chép prompt.');}catch{showEdit(j);toast('Trình duyệt chặn sao chép. Bạn có thể chọn và sao chép prompt trong cửa sổ này.');}}
function showEdit(j){editId=j.id;$('editPrompt').value=j.prompt;$('editCommon').value=j.common||'';$('editDialog').showModal();}
function deleteJobs(ids){
  const p=project(),before=p.jobs.slice(),removed=before.filter(j=>ids.has(j.id));if(!removed.length)return;
  p.jobs=p.jobs.filter(j=>!ids.has(j.id));selected.clear();save();renderQueue();
  toast(`Đã xóa ${removed.length} cảnh.`,()=>{for(const j of removed){const i=before.indexOf(j);if(!p.jobs.some(x=>x.id===j.id))p.jobs.splice(Math.min(i,p.jobs.length),0,j);}save();renderQueue();});
}
async function showMedia(j){
  const ref=j.video||j.outputImage||j.image;if(!ref)return toast('Cảnh này chưa có media. Dùng nút nhập để thêm kết quả đã có.');
  try{const url=await fileUrl(ref);if(!url)return toast('Không còn file media trên trình duyệt này. Hãy nhập lại file.');
    $('playerTitle').textContent=j.video?'Video đã nhập':j.outputImage?'Ảnh đã nhập':'Ảnh tham chiếu';$('playerCaption').textContent=ref.name;
    $('playerContent').innerHTML=j.video?`<video controls playsinline src="${url}"></video>`:`<img alt="Ảnh tham chiếu" src="${url}">`;$('playerDialog').showModal();
  }catch{toast('Không mở được media trên trình duyệt này.');}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const safeFilename=value=>value.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').slice(0,80)||'du-an';
$('queueContent').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const j=jobById(b.dataset.id);if(!j)return;switch(b.dataset.action){
  case 'copy':await copyPrompt(j);break;
  case 'duplicate':{if(project().jobs.length>=1000)return toast('Dự án đã đạt giới hạn 1.000 cảnh.');const duplicate={...structuredClone(j),id:uid(),video:null,outputImage:null,assignment:null,sent:false,runStatus:null,sentAt:null,createdAt:new Date().toISOString()};project().jobs.splice(project().jobs.indexOf(j)+1,0,duplicate);save();renderQueue();toast('Đã nhân bản cảnh thành bản nháp.');break;}
  case 'edit':showEdit(j);break;
  case 'delete':deleteJobs(new Set([j.id]));break;
  case 'media':await showMedia(j);break;
  case 'import':videoJobId=j.id;{const input=$(j.mode==='generate-image'?'resultImageFile':'videoFile');input.value='';input.click();}break;
  case 'download':try{const ref=j.video||j.outputImage;const f=await getFile(ref);if(!f)return toast('Không tìm thấy file kết quả.');download(f,ref.name);}catch{toast('Không đọc được file video.');}break;
}};
$('editForm').onsubmit=e=>{e.preventDefault();const j=jobById(editId),prompt=$('editPrompt').value.trim();if(!j||!prompt)return;j.prompt=prompt;j.common=$('editCommon').value.trim();save();renderQueue();$('editDialog').close();toast('Đã lưu chỉnh sửa.');};
$('deleteSelected').onclick=()=>deleteJobs(new Set(selected));
$('exportSelected').onclick=()=>{const jobs=project().jobs.filter(j=>selected.has(j.id));if(!jobs.length)return;download(new Blob([jobs.map(j=>fullPrompt(j)).join('\n\n---\n\n')],{type:'text/plain;charset=utf-8'}),safeFilename(project().name)+'-prompts.txt');toast('Đã xuất prompt của các cảnh đã chọn.');};
$('videoFile').onchange=async e=>{
  const file=e.target.files[0],target=project(),j=target.jobs.find(j=>j.id===videoJobId);if(!file||!j)return;
  if(!['video/mp4','video/webm','video/quicktime'].includes(file.type))return toast('Hãy chọn video MP4, WebM hoặc MOV.');if(file.size>250*1024*1024)return toast('Mỗi video tối đa 250 MB.');
  try{j.video=await putFile(file);setRunStatus(j,'done');save();renderQueue();toast('Đã nhập video có sẵn. Đây không phải video được tool tạo.');}catch{toast('Không lưu được video. Trình duyệt có thể đã hết dung lượng.');}
};
$('importPrompts').onclick=()=>{$('textFile').value='';$('textFile').click();};
$('textFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>200000)return toast('File prompt tối đa 200 KB.');const t=await f.text();if(t.length>50000)return toast('Tối đa 50.000 ký tự mỗi lần nhập.');$('promptInput').value=t;rememberDraft();updateCounter();toast('Đã nhập nội dung file. Kiểm tra rồi thêm vào hàng đợi.');};
$('exportBtn').onclick=()=>{
  const p=project(), payload={format:'huy-studio-project',version:1,name:p.name,exportedAt:new Date().toISOString(),mediaIncluded:false,jobs:p.jobs.map(j=>({...j,image:j.image?{name:j.image.name,type:j.image.type,size:j.image.size}:null,video:j.video?{name:j.video.name,type:j.video.type,size:j.video.size}:null,outputImage:j.outputImage?{name:j.outputImage.name,type:j.outputImage.type,size:j.outputImage.size}:null,assignment:null,sent:false,runStatus:null,sentAt:null}))};
  download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),safeFilename(p.name)+'.json');toast('Đã xuất prompt và thông số. File JSON không chứa ảnh/video.');
};
$('importProject').onclick=()=>{$('jsonFile').value='';$('jsonFile').click();};
$('jsonFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;if(f.size>10*1024*1024)return toast('File dự án tối đa 10 MB.');
  try{
    const raw=JSON.parse(await f.text());if(raw.format!=='huy-studio-project'||raw.version!==1||!Array.isArray(raw.jobs)||raw.jobs.length>1000)throw new Error();
    const jobs=raw.jobs.map(j=>{if(typeof j.prompt!=='string'||!j.prompt.trim()||j.prompt.length>50000)throw new Error();return {id:uid(),prompt:j.prompt,common:typeof j.common==='string'?j.common.slice(0,10000):'',mode:Object.hasOwn(modes,j.mode)?j.mode:'text',duration:j.mode==='generate-image'?0:[8,10,15].includes(j.duration)?j.duration:8,ratio:['16:9','9:16','1:1'].includes(j.ratio)?j.ratio:'16:9',language:Object.hasOwn(languages,j.language)?j.language:'en',links:Array.isArray(j.links)?j.links.filter(x=>typeof x==='string'&&validLink(x)).slice(0,100):[],image:null,video:null,outputImage:null,assignment:null,createdAt:new Date().toISOString()};});
    rememberDraft();const p={id:uid(),name:typeof raw.name==='string'?raw.name.slice(0,80)||'Dự án đã nhập':'Dự án đã nhập',jobs,draft:{}};state.projects.push(p);state.active=p.id;selected.clear();filter='all';$('searchInput').value='';loadDraft();syncFilters();save();renderQueue();toast('Đã nhập dự án. Ảnh và video cần được nhập lại từ file gốc.');
  }catch{toast('File JSON không hợp lệ hoặc không phải dự án Muse Studio.');}
};
$('assetsNav').onclick=async()=>{
  const jobs=project().jobs.filter(j=>j.image||j.video||j.outputImage);if(!jobs.length)return toast('Dự án chưa có media. Thêm ảnh tham chiếu hoặc nhập video vào một cảnh.');
  $('playerTitle').textContent='Media của dự án';$('playerCaption').textContent='Media được lưu trên trình duyệt này.';
  $('playerContent').innerHTML=`<div class="asset-grid">${jobs.map(j=>`<button data-asset-job="${esc(j.id)}">${j.video?`<div class="asset-video">${icon('play')}</div>`:`<img data-asset-image="${esc((j.outputImage||j.image).id)}" alt="Ảnh tham chiếu" hidden>`}<span>${esc((j.video||j.outputImage||j.image).name)}</span></button>`).join('')}</div>`;
  $('playerDialog').showModal();
  $('playerContent').querySelectorAll('[data-asset-job]').forEach(b=>b.onclick=()=>{const j=jobById(b.dataset.assetJob);$('playerDialog').close();if(j)showMedia(j);});
  for(const j of jobs){if(!j.video&&(j.outputImage||j.image))try{const ref=j.outputImage||j.image;const url=await fileUrl(ref);if(url)document.querySelectorAll(`[data-asset-image="${CSS.escape(ref.id)}"]`).forEach(img=>{img.src=url;img.hidden=false;});}catch{}}
};
function accountBadge(job){
  const assignment=job.assignment,account=assignment&&state.accounts.find(a=>a.id===assignment.accountId);
  if(!account)return '<span class="unassigned">Chưa phân</span>';
  return `<span class="account-badge" title="${esc(account.email)}">TK ${state.accounts.indexOf(account)+1}</span><div class="row-meta">Luồng ${assignment.lane} · lượt ${assignment.position}</div>`;
}
// Jobs already sent on Muse (or finished) keep their account; only pending drafts are re-planned.
const keepsAssignment=j=>(j.sent||hasResult(j))&&state.accounts.some(a=>a.id===j.assignment?.accountId);
function invalidatePlan(){for(const p of state.projects)for(const j of p.jobs)if(!keepsAssignment(j)){j.assignment=null;j.sent=false;j.runStatus=null;j.sentAt=null;}}
function renderLanes(){
  $('accountCount').textContent=state.accounts.length;
  const planned=project().jobs.filter(j=>j.assignment&&!hasResult(j));
  if(!state.accounts.length){$('laneStrip').innerHTML=`<button id="addPoolHint">${icon('user')}<span>Thêm tài khoản để lập kế hoạch phân luồng</span>${icon('plus')}</button>`;$('addPoolHint').onclick=openAccount;return;}
  $('laneStrip').innerHTML=state.accounts.map((a,i)=>{const count=planned.filter(j=>j.assignment.accountId===a.id).length;return `<button class="lane-chip ${!a.enabled?'off':''}" data-open-pool title="${esc(a.email)}"><span class="lane-avatar">${i+1}</span><span><b>Tài khoản ${i+1}</b><small>${a.enabled?(a.credits===null?'Chưa biết credit':`${a.credits} credit nhập tay`):'Đã tắt'}</small></span><span class="lane-total">${a.concurrency} luồng<small>${count} tác vụ dự kiến</small></span></button>`;}).join('');
  $('laneStrip').querySelectorAll('[data-open-pool]').forEach(b=>b.onclick=openAccount);
}
function renderAccounts(){
  $('costPerJob').value=state.costPerJob||'';$('downloadPath').value=state.downloadPath||'';
  $('accountList').innerHTML=state.accounts.length?state.accounts.map((a,i)=>`<div class="pool-account" data-pool-id="${esc(a.id)}"><div class="pool-account-heading"><span class="lane-avatar">${i+1}</span><span class="pool-email"><strong>${esc(a.email)}</strong><small>Cửa sổ riêng: MO_TAI_KHOAN.cmd → chọn số ${i+1}</small></span><label class="account-toggle"><input type="checkbox" data-pool-enable ${a.enabled?'checked':''} aria-label="Bật tài khoản ${i+1}">Dùng</label><button class="icon-btn" data-pool-delete aria-label="Xóa tài khoản ${i+1}">${icon('trash')}</button></div><div class="pool-account-settings"><label>Credit nhập tay<input data-pool-credits type="number" min="0" step="0.01" value="${a.credits??''}" placeholder="Chưa biết" aria-label="Credit tài khoản ${i+1}"></label><label>Số luồng dự kiến<select data-pool-threads aria-label="Luồng tài khoản ${i+1}">${[1,2,3,4].map(n=>`<option value="${n}" ${a.concurrency===n?'selected':''}>${n} luồng</option>`).join('')}</select></label><label class="pool-link">Link hộp thư lấy mã<input data-pool-link type="url" maxlength="2000" value="${esc(a.mailLink||'')}" placeholder="https://… (không bắt buộc)" aria-label="Link lấy mã tài khoản ${i+1}"></label></div></div>`).join(''):'<div class="empty-pool">Chưa có tài khoản. Thêm email đầu tiên bên dưới.</div>';
  $('accountList').querySelectorAll('[data-pool-id]').forEach(row=>{
    const a=state.accounts.find(x=>x.id===row.dataset.poolId);
    row.querySelector('[data-pool-enable]').onchange=e=>{a.enabled=e.target.checked;invalidatePlan();save();renderQueue();};
    row.querySelector('[data-pool-credits]').onchange=e=>{const raw=e.target.value,value=raw===''?null:Number(raw);if(value!==null&&(!Number.isFinite(value)||value<0)){e.target.value=a.credits??'';return toast('Credit phải là số không âm.');}a.credits=value;invalidatePlan();save();renderQueue();};
    row.querySelector('[data-pool-threads]').onchange=e=>{a.concurrency=Number(e.target.value);invalidatePlan();save();renderQueue();};
    row.querySelector('[data-pool-link]').onchange=e=>{const v=e.target.value.trim();if(v&&!validLink(v)){e.target.value=a.mailLink||'';return toast('Link phải bắt đầu bằng http:// hoặc https://');}a.mailLink=v;save();toast(v?'Đã lưu link lấy mã. Tải lại danh sách cho MO_TAI_KHOAN.cmd để cập nhật.':'Đã xóa link lấy mã.');};
    row.querySelector('[data-pool-delete]').onclick=()=>{const index=state.accounts.indexOf(a);state.accounts.splice(index,1);invalidatePlan();save();renderAccounts();renderQueue();toast('Đã bỏ tài khoản khỏi kế hoạch.',()=>{state.accounts.splice(index,0,a);save();renderAccounts();renderQueue();});};
  });
}
$('downloadPath').onchange=()=>{const v=$('downloadPath').value.trim().replace(/[\\/]+$/,'');if(v&&!/^([A-Za-z]:\\|\\\\)[^<>"|?*]*$/.test(v)){$('downloadPath').value=state.downloadPath||'';return toast('Nhập đường dẫn đầy đủ trên Windows, ví dụ D:\\Video Muse');}state.downloadPath=v;$('downloadPath').value=v;save();toast(v?'Đã lưu. Bấm “Tải danh sách cho MO_TAI_KHOAN.cmd” để cập nhật cho các cửa sổ.':'Đã bỏ thư mục tải về.');};
$('poolForm').onsubmit=e=>{
  e.preventDefault();const email=$('poolEmail').value.trim().toLowerCase();if(state.accounts.some(a=>a.email.toLowerCase()===email))return toast('Email này đã có trong danh sách.');
  if(state.accounts.length>=20)return toast('Bản thử hỗ trợ tối đa 20 tài khoản.');
  const raw=$('poolCredits').value,credits=raw===''?null:Number(raw);if(credits!==null&&(!Number.isFinite(credits)||credits<0))return toast('Credit phải là số không âm.');
  state.accounts.push({id:uid(),email,credits,concurrency:Number($('poolThreads').value),enabled:true});invalidatePlan();save();$('poolForm').reset();renderAccounts();renderQueue();toast('Đã thêm email vào kế hoạch. Tài khoản chưa đăng nhập vào tool.');
};
$('poolLoginHelp').onclick=()=>{$('accountsDialog').close();$('accountEmail').value=state.email||'';$('accountDialog').showModal();};
$('costPerJob').onchange=()=>{const raw=$('costPerJob').value,value=raw===''?null:Number(raw);if(value!==null&&(!Number.isFinite(value)||value<=0)){return toast('Nhập số credit lớn hơn 0.');}state.costPerJob=value;invalidatePlan();save();renderQueue();};
function planCurrent(){
  if(!project().jobs.some(j=>!hasResult(j)&&!j.sent)){toast('Không còn cảnh nháp nào cần xếp luồng.');return false;}
  if(!state.accounts.length||!state.costPerJob){openAccount();toast('Thêm tài khoản, số dư và chi phí dự kiến để xếp luồng.');return false;}
  try{
    const result=planQueue(project().jobs,state.accounts,state.costPerJob),assignmentByJob=new Map(result.assignments.map(a=>[a.jobId,a]));
    for(const job of project().jobs)if(!keepsAssignment(job))job.assignment=assignmentByJob.get(job.id)||null;
    save();renderQueue();toast(`Đã xếp ${result.assignments.length} tác vụ; ${result.unassigned.length} tác vụ thiếu credit dự kiến.`);return true;
  }catch(e){toast(e.message);}
  return false;
}
$('planJobs').onclick=()=>planCurrent();
$('addAndPlan').onclick=async()=>{const p=project(),before=p.jobs.length;await $('addJobs').onclick();if(p.jobs.length>before)planCurrent();};
$('resultImageFile').onchange=async e=>{
  const file=e.target.files[0],j=jobById(videoJobId);if(!file||!j)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)return toast('Chọn ảnh PNG/JPG/WebP tối đa 10 MB.');
  try{const bitmap=await createImageBitmap(file);bitmap.close();j.outputImage=await putFile(file);setRunStatus(j,'done');save();renderQueue();toast('Đã nhập ảnh có sẵn, chưa có tác vụ tạo ảnh trên Muse.');}catch{toast('Không đọc hoặc lưu được ảnh.');}
};
// ---- Danh sách cho MO_TAI_KHOAN.cmd: số thứ tự trùng với "Tài khoản N" trong tool ----
$('exportProfiles').onclick=()=>{
  if(!state.accounts.length)return toast('Thêm ít nhất một tài khoản trước.');
  const lines=['# Danh sach cho MO_TAI_KHOAN.cmd - tao tu Muse Studio '+new Date().toLocaleString('vi-VN'),'# Moi dong: email [link lay ma]. So thu tu = "Tai khoan N" trong Muse Studio.',...(state.downloadPath?['# Video cua tai khoan N tu luu vao <thu-muc>\\TKN','thu-muc='+state.downloadPath]:[]),...state.accounts.map(a=>[a.email,a.mailLink||''].filter(Boolean).join('\t'))];
  download(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/plain;charset=utf-8'}),'tai-khoan.txt');
  toast('Đã tải tai-khoan.txt. Chạy MO_TAI_KHOAN.cmd — script tự tìm file trong Downloads.');
};
// ---- Bảng điều phối: người dùng tự dán prompt và bấm tạo trong cửa sổ riêng của từng tài khoản ----
const sceneNo=j=>String(project().jobs.indexOf(j)+1).padStart(2,'0');
const accountNo=a=>state.accounts.indexOf(a)+1;
function boardGroups(){
  const jobs=project().jobs,groups=state.accounts.map(a=>({account:a,jobs:jobs.filter(j=>j.assignment?.accountId===a.id).sort((x,y)=>x.assignment.lane-y.assignment.lane||x.assignment.position-y.assignment.position)})).filter(g=>g.jobs.length);
  return {groups,unassigned:jobs.filter(j=>!j.assignment&&!hasResult(j))};
}
const countRun=jobs=>{const c={waiting:0,running:0,done:0,error:0};for(const j of jobs)c[runStatus(j)]++;return c;};
function renderBoard(){
  renderFolder();
  const {groups,unassigned}=boardGroups(),c=countRun(groups.flatMap(g=>g.jobs));
  $('boardSummary').innerHTML=`<span class="st-waiting"><b>${c.waiting}</b> Chờ</span><span class="st-running"><b>${c.running}</b> Đang chạy</span><span class="st-done"><b>${c.done}</b> Xong</span><span class="st-error"><b>${c.error}</b> Lỗi</span><span class="${unassigned.length?'warn':''}"><b>${unassigned.length}</b> chưa phân</span>`;
  if(!groups.length){$('boardContent').innerHTML=`<div class="empty-pool">Chưa có cảnh nào được phân cho tài khoản. Bấm <b>Xếp lại luồng</b> (cần tài khoản, credit và chi phí mỗi tác vụ).</div>`;return;}
  $('boardContent').innerHTML=groups.map(({account:a,jobs})=>{
    const n=accountNo(a),k=countRun(jobs);
    return `<section class="board-account"><header><span class="lane-avatar">${n}</span><div class="board-account-name"><strong>Tài khoản ${n}</strong><small>${esc(a.email)}</small><small>Cửa sổ: MO_TAI_KHOAN.cmd → số ${n}${state.downloadPath?` · tải về: ${esc(state.downloadPath)}\\TK${n}`:''}</small></div><div class="board-progress">${k.waiting} chờ · ${k.running} đang chạy · <b>${k.done}</b> xong${k.error?` · <span class="err">${k.error} lỗi</span>`:''}</div></header>
    <div class="board-account-actions"><button class="button" data-board-email="${esc(a.id)}">${icon('copy')}Sao chép email</button>${a.mailLink?`<a class="button" href="${esc(a.mailLink)}" target="_blank" rel="noopener noreferrer">${icon('external')}Mở link lấy mã</a>`:''}<button class="button primary" data-board-next="${esc(a.id)}" ${k.waiting?'':'disabled'} title="Sao chép prompt đang Chờ đầu tiên và chuyển nó sang Đang chạy">${icon('copy')}Sao chép prompt kế tiếp</button></div>
    <ol class="board-jobs">${jobs.map(j=>{const st=runStatus(j);return `<li class="board-job st-${st}"><span class="row-number">#${sceneNo(j)}</span><span class="board-lane" title="Luồng ${j.assignment.lane}, lượt ${j.assignment.position}">L${j.assignment.lane}·${j.assignment.position}</span><div class="board-prompt">${esc(j.prompt)}${j.common?`<small>+ quy tắc chung</small>`:''}</div><div class="board-job-actions"><button class="icon-btn" data-board-copy="${esc(j.id)}" title="Sao chép prompt" aria-label="Sao chép prompt cảnh ${sceneNo(j)}">${icon('copy')}</button>${hasResult(j)?`<button class="icon-btn" data-board-media="${esc(j.id)}" title="Xem kết quả" aria-label="Xem kết quả cảnh ${sceneNo(j)}">${icon('play')}</button><span class="row-status imported"><i></i>Xong</span>`:`<select class="run-select st-${st}" data-board-status="${esc(j.id)}" aria-label="Trạng thái cảnh ${sceneNo(j)}">${Object.entries(RUN).map(([v,l])=>`<option value="${v}" ${v===st?'selected':''}>${l}</option>`).join('')}</select><button class="icon-btn" data-board-import="${esc(j.id)}" title="Nhập kết quả bằng tay" aria-label="Nhập kết quả cảnh ${sceneNo(j)}">${icon('up')}</button>`}</div></li>`;}).join('')}</ol></section>`;
  }).join('')+(unassigned.length?`<div class="account-note">${icon('info')}<p>${unassigned.length} cảnh chưa được phân (thiếu credit dự kiến hoặc chưa xếp luồng). Cập nhật credit rồi bấm <b>Xếp lại luồng</b>.</p></div>`:'');
}
async function copyFromBoard(j){
  const a=state.accounts.find(x=>x.id===j.assignment?.accountId);
  try{await navigator.clipboard.writeText(fullPrompt(j));return a?accountNo(a):'?';}
  catch{toast('Trình duyệt chặn sao chép. Mở cảnh bằng nút Sửa trong hàng đợi để chọn và sao chép.');return null;}
}
$('boardContent').onclick=async e=>{
  const t=e.target.closest('[data-board-copy],[data-board-next],[data-board-email],[data-board-import],[data-board-media]');if(!t)return;
  if(t.dataset.boardEmail){const a=state.accounts.find(x=>x.id===t.dataset.boardEmail);if(!a)return;try{await navigator.clipboard.writeText(a.email);toast('Đã sao chép email. Dán vào trang đăng nhập Muse.');}catch{toast(a.email);}return;}
  if(t.dataset.boardNext){
    const g=boardGroups().groups.find(x=>x.account.id===t.dataset.boardNext),j=g?.jobs.find(x=>runStatus(x)==='waiting');if(!j)return;
    const n=await copyFromBoard(j);if(n===null)return;
    setRunStatus(j,'running');save();renderQueue();toast(`Đã sao chép cảnh ${sceneNo(j)} → dán vào cửa sổ Tài khoản ${n} và bấm tạo. Trạng thái: Đang chạy.`);return;
  }
  const j=jobById(t.dataset.boardCopy||t.dataset.boardImport||t.dataset.boardMedia);if(!j)return;
  if(t.dataset.boardCopy){const n=await copyFromBoard(j);if(n!==null)toast(`Đã sao chép cảnh ${sceneNo(j)} — dán vào cửa sổ Tài khoản ${n}.`);return;}
  if(t.dataset.boardMedia)return showMedia(j);
  videoJobId=j.id;const input=$(j.mode==='generate-image'?'resultImageFile':'videoFile');input.value='';input.click();
};
$('boardContent').onchange=e=>{const sel=e.target.closest('[data-board-status]');if(!sel)return;const j=jobById(sel.dataset.boardStatus);if(!j)return;setRunStatus(j,sel.value);save();renderQueue();};
function openBoard(){renderBoard();if(!$('boardDialog').open)$('boardDialog').showModal();}
$('runJobs').onclick=()=>{
  if(!state.accounts.length)return openAccount();
  if(!project().jobs.some(j=>j.assignment)&&!planCurrent())return;
  openBoard();
};
$('boardReplan').onclick=()=>{planCurrent();if(!$('accountsDialog').open)renderBoard();};
$('boardAccounts').onclick=()=>{$('boardDialog').close();openAccount();};

// ---- Thư mục tải về: chọn thư mục, quét video mới, gắn vào cảnh, xuất tất cả ----
// Dùng File System Access API (Chrome/Edge). Handle được lưu trong IndexedDB riêng để giữ qua các lần mở.
const settingsDb=new Promise((resolve,reject)=>{const r=indexedDB.open('huy-studio-settings',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
settingsDb.catch(()=>{});
async function kv(key,value){const db=await settingsDb;return new Promise((resolve,reject)=>{const tx=db.transaction('kv',value===undefined?'readonly':'readwrite'),store=tx.objectStore('kv');const req=value===undefined?store.get(key):store.put(value,key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
let dirHandle=null,scanItems=[];
kv('downloadDir').then(h=>{dirHandle=h||null;renderFolder();}).catch(()=>{});
const VIDEO_EXT={mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'},IMAGE_EXT={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
const extOf=name=>(name.split('.').pop()||'').toLowerCase();
function renderFolder(){
  $('folderName').textContent=dirHandle?(dirHandle.name||'Đã chọn'):'Chưa chọn — bấm Chọn thư mục';
  for(const id of ['scanFolder','exportVideos'])$(id).disabled=!dirHandle;
}
async function folderAllowed(mode){
  if(!dirHandle)return false;
  try{if(await dirHandle.queryPermission({mode})==='granted')return true;return await dirHandle.requestPermission({mode})==='granted';}catch{return false;}
}
$('pickFolder').onclick=async()=>{
  if(!window.showDirectoryPicker)return toast('Trình duyệt này không hỗ trợ chọn thư mục. Hãy mở tool bằng Chrome hoặc Edge.');
  try{dirHandle=await window.showDirectoryPicker({id:'muse-downloads',mode:'readwrite'});await kv('downloadDir',dirHandle);renderFolder();toast(`Đã chọn thư mục “${dirHandle.name}”. Đặt cùng đường dẫn đó trong Tài khoản để cửa sổ Muse tự lưu vào đây.`);}
  catch(e){if(e?.name!=='AbortError')toast('Không chọn được thư mục này. Hãy chọn thư mục khác (không phải thư mục hệ thống).');}
};
async function collectFiles(dir,prefix='',depth=0,out=[]){
  for await(const [name,h] of dir.entries()){
    if(h.kind==='directory'){if(depth<1&&!name.startsWith('_')&&!name.startsWith('.'))await collectFiles(h,prefix+name+'/',depth+1,out);continue;}
    const ext=extOf(name);if(!VIDEO_EXT[ext]&&!IMAGE_EXT[ext])continue;
    if(name.endsWith('.crdownload')||name.endsWith('.tmp'))continue;
    out.push({path:prefix+name,handle:h,folder:prefix.split('/')[0]||'',isVideo:Boolean(VIDEO_EXT[ext])});
  }
  return out;
}
const fileKey=(item,f)=>`${item.path}|${f.size}|${f.lastModified}`;
const fitsJob=(item,j)=>item.isVideo?j.mode!=='generate-image':j.mode==='generate-image';
$('scanFolder').onclick=async()=>{
  if(!await folderAllowed('read'))return toast('Cần cho phép tool đọc thư mục. Bấm Quét lại và chọn “Cho phép”.');
  const seen=new Set(state.importedFiles||[]);let items;
  try{items=await collectFiles(dirHandle);}catch{return toast('Không đọc được thư mục. Hãy chọn lại thư mục.');}
  for(const it of items){const f=await it.handle.getFile();it.file=f;it.key=fileKey(it,f);}
  items=items.filter(it=>!seen.has(it.key)).sort((a,b)=>a.file.lastModified-b.file.lastModified);
  // Gợi ý: file trong thư mục con TKn gắn vào cảnh Đang chạy sớm nhất của tài khoản n; file ở thư mục gốc gắn theo thứ tự gửi.
  const taken=new Set(),open=project().jobs.filter(j=>!hasResult(j)&&['running','error'].includes(runStatus(j))).sort((a,b)=>(runStatus(a)==='running'?0:1)-(runStatus(b)==='running'?0:1)||String(a.sentAt||'').localeCompare(String(b.sentAt||'')));
  for(const it of items){
    const m=/^tk(\d+)$/i.exec(it.folder),acc=m?state.accounts[Number(m[1])-1]:null;
    const j=open.find(j=>!taken.has(j.id)&&fitsJob(it,j)&&(!m||j.assignment?.accountId===acc?.id));
    it.target=j?.id||'';if(j)taken.add(j.id);
  }
  scanItems=items;renderScan();
  toast(items.length?`Tìm thấy ${items.length} file mới. Kiểm tra cảnh được gợi ý rồi bấm Gắn.`:'Không có file mới trong thư mục.');
};
function renderScan(){
  if(!scanItems.length){$('scanResults').innerHTML='';return;}
  const candidates=project().jobs.filter(j=>!hasResult(j));
  const label=j=>{const a=state.accounts.find(x=>x.id===j.assignment?.accountId);return `#${sceneNo(j)}${a?` · TK${accountNo(a)}`:''} · ${RUN[runStatus(j)]} · ${j.prompt.slice(0,40)}`;};
  $('scanResults').innerHTML=`<div class="scan-list">${scanItems.map((it,i)=>`<div class="scan-item"><span class="scan-file" title="${esc(it.path)}">${icon(it.isVideo?'play':'image')}${esc(it.path)}<small>${(it.file.size/1048576).toFixed(1)} MB · ${new Date(it.file.lastModified).toLocaleString('vi-VN')}</small></span><select data-scan="${i}" aria-label="Gắn ${esc(it.path)} vào cảnh"><option value="">— Bỏ qua —</option>${candidates.filter(j=>fitsJob(it,j)).map(j=>`<option value="${esc(j.id)}" ${j.id===it.target?'selected':''}>${esc(label(j))}</option>`).join('')}</select></div>`).join('')}</div><div class="scan-actions"><button class="button" id="scanIgnore">Bỏ qua tất cả lần sau</button><button class="button primary" id="scanAttach">${icon('check')}Gắn các file đã chọn</button></div>`;
  $('scanResults').querySelectorAll('[data-scan]').forEach(s=>s.onchange=()=>{scanItems[Number(s.dataset.scan)].target=s.value;});
  $('scanIgnore').onclick=()=>{rememberFiles(scanItems.map(it=>it.key));scanItems=[];renderScan();toast('Các file này sẽ không hiện lại khi quét.');};
  $('scanAttach').onclick=attachScanned;
}
function rememberFiles(keys){state.importedFiles=[...(state.importedFiles||[]),...keys].slice(-3000);save();}
async function attachScanned(){
  const chosen=scanItems.filter(it=>it.target),used=new Set();
  if(new Set(chosen.map(it=>it.target)).size!==chosen.length)return toast('Có hai file cùng gắn vào một cảnh. Hãy chọn lại.');
  let ok=0;
  for(const it of chosen){
    const j=jobById(it.target);if(!j||hasResult(j))continue;
    const ext=extOf(it.file.name),type=it.file.type||VIDEO_EXT[ext]||IMAGE_EXT[ext];
    if(it.file.size>(it.isVideo?250:10)*1024*1024){toast(`${it.path} quá lớn để lưu trong trình duyệt.`);continue;}
    try{const ref=await putFile(new File([it.file],it.file.name,{type,lastModified:it.file.lastModified}));if(it.isVideo)j.video=ref;else j.outputImage=ref;setRunStatus(j,'done');used.add(it.key);ok++;}
    catch{toast('Trình duyệt hết dung lượng lưu. Hãy xuất video rồi xóa bớt cảnh cũ.');break;}
  }
  rememberFiles([...used]);scanItems=scanItems.filter(it=>!used.has(it.key));save();renderQueue();renderScan();
  toast(`Đã gắn ${ok} file vào cảnh. Trạng thái: Xong.`);
}
$('exportVideos').onclick=async()=>{
  const jobs=project().jobs.filter(hasResult);if(!jobs.length)return toast('Chưa có cảnh nào có kết quả để xuất.');
  if(!await folderAllowed('readwrite'))return toast('Cần cho phép tool ghi vào thư mục. Bấm lại và chọn “Cho phép”.');
  try{
    const out=await (await dirHandle.getDirectoryHandle('_xuat-video',{create:true})).getDirectoryHandle(safeFilename(project().name),{create:true});let n=0;
    for(const j of jobs){const ref=j.video||j.outputImage,f=await getFile(ref);if(!f)continue;const w=await (await out.getFileHandle(`canh-${sceneNo(j)}.${extOf(ref.name)||'mp4'}`,{create:true})).createWritable();await w.write(f);await w.close();n++;}
    toast(`Đã xuất ${n} file vào ${dirHandle.name}\\_xuat-video\\${safeFilename(project().name)}`);
  }catch{toast('Không ghi được vào thư mục. Kiểm tra quyền hoặc dung lượng ổ đĩa.');}
};
window.addEventListener('beforeunload',()=>{if(stagedUrl)URL.revokeObjectURL(stagedUrl);for(const url of assetUrls.values())URL.revokeObjectURL(url);});
// Remove orphaned local media from previously deleted scenes on the next launch.
pruneFiles();loadDraft();renderQueue();
