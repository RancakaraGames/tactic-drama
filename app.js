const demoDramas=[
 {id:"demo-1",title:"Rahasia Hati",genre:"Romantis • Drama pilihan",description:"Sebuah pertemuan tak terduga mengubah segalanya.",colors:["#79324d","#242b50"],episodes:[]},
 {id:"demo-2",title:"Takdir Kedua",genre:"Drama • Drama pilihan",description:"Kesempatan kedua datang saat semua terasa terlambat.",colors:["#81522c","#342448"],episodes:[]},
 {id:"demo-3",title:"Janji Senja",genre:"Keluarga • Drama pilihan",description:"Janji lama yang kembali menguji sebuah keluarga.",colors:["#a64c3d","#30233b"],episodes:[]},
 {id:"demo-4",title:"Cinta Terlarang",genre:"Romantis • Drama pilihan",description:"Dua hati terjebak di antara cinta dan rahasia.",colors:["#61365f","#1d3450"],episodes:[]}
];
let dramas=[...demoDramas],activeDrama=null,activeEpisodeIndex=0,supa=null,activeTab="home";
let searchQuery="";
let favoriteIds=new Set();try{favoriteIds=new Set(JSON.parse(localStorage.getItem("tactic-favorites")||"[]"))}catch{}
let watchHistory={};try{watchHistory=JSON.parse(localStorage.getItem("tactic-watch-history")||"{}")||{}}catch{}
let lastHistoryPersist=0;
const grid=document.querySelector("#dramaGrid"),player=document.querySelector("#playerDialog"),admin=document.querySelector("#adminDialog"),video=document.querySelector("#videoPlayer");
const $=s=>document.querySelector(s);
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatPlaybackTime(seconds=0){const n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),sec=n%60;return h?[h,m,sec].map(v=>String(v).padStart(2,"0")).join(":"):[m,sec].map(v=>String(v).padStart(2,"0")).join(":")}
function render(){grid.innerHTML="";let visible=activeTab==="saved"?dramas.filter(d=>favoriteIds.has(d.id)):activeTab==="history"?dramas.filter(d=>watchHistory[d.id]).sort((a,b)=>new Date(watchHistory[b.id]?.watched_at||0)-new Date(watchHistory[a.id]?.watched_at||0)):dramas;if(searchQuery)visible=visible.filter(d=>(String(d.title||"")+" "+String(d.description||"")+" "+String(d.genre||"")).toLocaleLowerCase("id").includes(searchQuery));if(activeTab!=="history"){const mode=$("#dramaSort")?.value||"newest";if(mode==="az")visible.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"id"));else if(mode==="za")visible.sort((a,b)=>String(b.title||"").localeCompare(String(a.title||""),"id"));}if(!visible.length){grid.innerHTML=`<p class="empty-state">${searchQuery?"Drama tidak ditemukan. Coba kata kunci lain.":activeTab==="saved"?"Belum ada drama favorit. Tekan ikon ♡ pada poster drama untuk menyimpannya.":activeTab==="history"?"Riwayat tontonanmu masih kosong. Putar drama untuk menyimpannya di sini.":"Belum ada drama. Drama yang diunggah admin akan muncul di sini."}</p>`;return}visible.forEach(d=>{const card=document.createElement("article");card.className="drama-card";const historyEntry=activeTab==="history"?watchHistory[d.id]:null;const historyLabel=historyEntry?"Lanjutkan · Episode "+historyEntry.episode_number+(Number(historyEntry.position_seconds)>0?" · "+formatPlaybackTime(historyEntry.position_seconds):""):"";card.innerHTML=`<div class="poster" role="button" tabindex="0" style="background:linear-gradient(145deg,${d.colors?.[0]||"#61365f"},${d.colors?.[1]||"#20243a"})"><span class="tag">${historyLabel?escapeHtml(historyLabel):"DRAMA PENDEK"}</span><span class="poster-title">${escapeHtml(d.title)}</span><button class="favorite-btn ${favoriteIds.has(d.id)?"is-favorite":""}" type="button" aria-label="${favoriteIds.has(d.id)?"Hapus dari":"Tambah ke"} favorit">${favoriteIds.has(d.id)?"♥":"♡"}</button></div><div class="card-meta"><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.genre||((d.episodes||[]).length+" episode"))}</span></div>`;const poster=card.querySelector(".poster");const openCardDrama=()=>{const saved=activeTab==="history"?watchHistory[d.id]:null;const resumeNumber=saved?.episode_number??null,resumeSeconds=Number(saved?.position_seconds||0);openDrama(d);if(resumeNumber!=null){const resumeIndex=(d.episodes||[]).findIndex(ep=>Number(ep.episode_number)===Number(resumeNumber));if(resumeIndex>=0)playEpisode(resumeIndex,false,resumeSeconds)}};poster.addEventListener("click",openCardDrama);poster.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCardDrama()}});if(d.poster_url){const art=document.createElement("img");art.className="poster-art";art.src=d.poster_url;art.alt="Poster "+d.title;art.loading="lazy";poster.prepend(art)}card.querySelector(".favorite-btn").addEventListener("click",e=>{e.stopPropagation();if(favoriteIds.has(d.id))favoriteIds.delete(d.id);else favoriteIds.add(d.id);try{localStorage.setItem("tactic-favorites",JSON.stringify([...favoriteIds]))}catch{}render()});grid.append(card)})}
function getVideoUrl(path){return supa.storage.from("drama-videos").getPublicUrl(path).data.publicUrl}
function saveWatchHistory(ep,positionSeconds=0){if(!activeDrama||!ep?.id||String(activeDrama.id).startsWith("demo-"))return;watchHistory[activeDrama.id]={episode_number:ep.episode_number,episode_title:ep.title||"",position_seconds:Math.max(0,Math.floor(Number(positionSeconds)||0)),watched_at:new Date().toISOString()};try{localStorage.setItem("tactic-watch-history",JSON.stringify(watchHistory))}catch{}}
function playEpisode(index,autoplay=true,resumeSeconds=0){const eps=activeDrama?.episodes||[];if(index<0||index>=eps.length)return;activeEpisodeIndex=index;const ep=eps[index],list=$("#episodeList");list.querySelectorAll("button").forEach((b,i)=>{b.classList.toggle("active",i===index)});const prev=$("#prevEpisode"),next=$("#nextEpisode");if(prev)prev.disabled=index===0;if(next){next.disabled=index===eps.length-1;next.textContent=index===eps.length-1?"Episode terakhir":"Episode berikutnya →"}$("#playerDescription").textContent="Episode "+ep.episode_number+(ep.title?" — "+ep.title:"")+" · "+(index<eps.length-1?"Lanjut otomatis ke episode berikutnya":"Ini episode terbaru");if(resumeSeconds>0){video.addEventListener("loadedmetadata",()=>{if(Number.isFinite(video.duration)&&resumeSeconds<video.duration-2)video.currentTime=resumeSeconds},{once:true})}video.src=getVideoUrl(ep.video_path);video.load();saveWatchHistory(ep,resumeSeconds);recordEpisodeView(ep);if(autoplay)video.play().catch(()=>{});}
function openDrama(d){activeDrama=d;activeEpisodeIndex=0;$("#playerSeries").textContent=d.genre||"TAC TIC DRAMA";$("#playerTitle").textContent=d.title;$("#playerDescription").textContent=d.description||"Nikmati episode drama ini.";const list=$("#episodeList");list.innerHTML="";const eps=[...(d.episodes||[])].sort((a,b)=>a.episode_number-b.episode_number);d.episodes=eps;if(!eps.length){list.textContent="Episode belum tersedia.";video.pause();video.removeAttribute("src")}eps.forEach((ep,i)=>{const b=document.createElement("button");b.textContent="Episode "+ep.episode_number+(ep.title?" · "+ep.title:"");b.addEventListener("click",()=>playEpisode(i));list.append(b)});if(eps.length)playEpisode(0,false);loadComments(d.id);loadDramaLikeState(d.id);player.showModal()}
async function loadCatalog(){const status=$("#catalogStatus");if(!supa){if(status)status.textContent="Katalog online belum tersambung.";return}if(status)status.textContent="Memuat katalog drama…";try{const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,episodes(id,episode_number,title,video_path,status)").eq("status","approved").eq("episodes.status","approved").order("created_at",{ascending:false});if(error)throw error;if(data){dramas=data.map(d=>({...d,genre:(d.episodes||[]).length+" episode",colors:["#71324e","#252344"]}));render();if(status)status.textContent=data.length?data.length+" drama tersedia. Katalog berhasil diperbarui.":"Belum ada drama yang diterbitkan."}}catch(e){console.warn("Catalog online belum dapat dimuat:",e.message);if(status)status.textContent="Katalog gagal dimuat. Periksa koneksi lalu coba muat ulang."}}
function setStatus(id,msg){$(id).textContent=msg}
async function loadComments(dramaId){
 const list=$("#commentList");list.innerHTML="";
 if(!supa||String(dramaId).startsWith("demo-")){setStatus("#commentStatus","Komentar online aktif setelah Supabase tersambung.");return}
 setStatus("#commentStatus","Memuat komentar...");
 const result=await supa.from("comments").select("id,display_name,body,created_at").eq("drama_id",dramaId).order("created_at",{ascending:false}).limit(50);
 if(result.error){setStatus("#commentStatus","Komentar belum bisa dimuat. Jalankan pembaruan schema Supabase.");return}
 if(!result.data.length){setStatus("#commentStatus","Belum ada komentar. Jadilah yang pertama!");return}
 setStatus("#commentStatus",result.data.length+" komentar terbaru");
 result.data.forEach(item=>{const el=document.createElement("article");el.className="comment-item";const who=document.createElement("strong");who.textContent=item.display_name;const body=document.createElement("p");body.textContent=item.body;const time=document.createElement("small");time.textContent=new Date(item.created_at).toLocaleString("id-ID");el.append(who,body,time);list.append(el)})
}
$("#commentForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa||!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#commentStatus","Komentar belum aktif. Sambungkan Supabase dan gunakan drama dari katalog online.");return}
 const form=e.currentTarget,fd=new FormData(form),display_name=String(fd.get("displayName")||"").trim(),body=String(fd.get("body")||"").trim(),btn=form.querySelector("button[type=submit]");
 if(!display_name||!body){setStatus("#commentStatus","Isi nama dan komentar terlebih dahulu.");return}
 btn.disabled=true;setStatus("#commentStatus","Mengirim komentar...");
 try{const result=await supa.from("comments").insert({drama_id:activeDrama.id,display_name,body});if(result.error)throw result.error;form.elements.displayName.value=display_name;form.elements.body.value="";await loadComments(activeDrama.id)}
 catch(err){setStatus("#commentStatus","Gagal mengirim komentar: "+err.message)}
 finally{btn.disabled=false}
});

$("#reportDrama").addEventListener("click",async()=>{if(!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#reportStatus","Laporan tersedia untuk drama dari katalog online.");return}if(!supa){setStatus("#reportStatus","Backend belum tersambung.");return}const {data}=await supa.auth.getSession();if(!data.session){setStatus("#reportStatus","Masuk atau daftar akun untuk melaporkan video.");admin.showModal();return}const reason=window.prompt("Apa alasan laporan? Contoh: hak cipta, kekerasan, spam, atau konten tidak pantas.");if(!reason)return;if(reason.trim().length<3){setStatus("#reportStatus","Alasan laporan minimal 3 karakter.");return}const details=window.prompt("Keterangan tambahan (opsional):")||"";const {error}=await supa.from("video_reports").insert({drama_id:activeDrama.id,reporter_id:data.session.user.id,reason:reason.trim().slice(0,80),details:details.trim().slice(0,1000)});if(error){setStatus("#reportStatus","Gagal mengirim laporan: "+error.message);return}setStatus("#reportStatus","Terima kasih. Laporan sudah dikirim ke tim admin.")});
video.addEventListener("ended",()=>{if(activeDrama&&activeEpisodeIndex<(activeDrama.episodes||[]).length-1)playEpisode(activeEpisodeIndex+1);else setStatus("#playerDescription","Kamu sudah menyelesaikan episode terbaru. Pilih drama lain atau tonton ulang episode ini.");});
$("#prevEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex-1));
$("#nextEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex+1));
let swipeStartY=null;video.addEventListener("touchstart",e=>{swipeStartY=e.changedTouches[0].clientY},{passive:true});video.addEventListener("touchend",e=>{if(swipeStartY===null)return;const delta=swipeStartY-e.changedTouches[0].clientY;swipeStartY=null;if(Math.abs(delta)>55)playEpisode(activeEpisodeIndex+(delta>0?1:-1))},{passive:true});
player.addEventListener("keydown",e=>{if(e.key==="ArrowUp"){e.preventDefault();playEpisode(activeEpisodeIndex+1)}else if(e.key==="ArrowDown"){e.preventDefault();playEpisode(activeEpisodeIndex-1)}});

function persistCurrentPlayback(){if(!activeDrama||!video.currentTime||!Number.isFinite(video.currentTime))return;const ep=activeDrama.episodes?.[activeEpisodeIndex];if(ep?.id){saveWatchHistory(ep,video.currentTime);lastHistoryPersist=Date.now()}}
video.addEventListener("timeupdate",()=>{if(Date.now()-lastHistoryPersist<5000)return;persistCurrentPlayback()});
video.addEventListener("pause",persistCurrentPlayback);
window.addEventListener("pagehide",persistCurrentPlayback);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persistCurrentPlayback()});

function getViewerKey(){
 const keyName="tactic-drama-viewer-key";
 try{let key=localStorage.getItem(keyName);if(!key){key=crypto.randomUUID();localStorage.setItem(keyName,key)}return key}catch{return crypto.randomUUID()}
}
async function recordEpisodeView(ep){
 if(!supa||!activeDrama||String(activeDrama.id).startsWith("demo-")||!ep?.id)return;
 try{const {error}=await supa.from("drama_views").insert({drama_id:activeDrama.id,episode_id:ep.id,viewer_key:getViewerKey()});if(error&&error.code!=="23505")console.warn("Pencatatan penayangan gagal:",error.message)}catch(err){console.warn("Pencatatan penayangan gagal:",err?.message||err)}
}
async function loadDramaLikeState(dramaId){
 const btn=$("#likeDrama");if(!btn)return;
 if(!supa||String(dramaId).startsWith("demo-")){btn.hidden=true;return}
 btn.hidden=false;btn.disabled=true;
 try{
  const countResult=await supa.from("drama_like_counts").select("like_count").eq("drama_id",dramaId).maybeSingle();
  if(countResult.error)throw countResult.error;
  const {data:sessionData}=await supa.auth.getSession(),user=sessionData.session?.user;
  let liked=false;
  if(user){const own=await supa.from("drama_likes").select("drama_id").eq("drama_id",dramaId).eq("user_id",user.id).maybeSingle();if(own.error)throw own.error;liked=Boolean(own.data)}
  btn.dataset.liked=liked?"true":"false";btn.setAttribute("aria-pressed",String(liked));
  btn.textContent=(liked?"♥ Disukai · ":"♡ Suka · ")+Number(countResult.data?.like_count||0);
 }catch(err){btn.textContent="♡ Suka";console.warn("Jumlah suka belum dapat dimuat:",err?.message||err)}
 finally{btn.disabled=false}
}
async function loadCreatorStats(userId){
 const status=$("#creatorStatsStatus");if(!supa||!userId)return;
 status.textContent="Memuat statistik kreator...";
 try{
  const {data,error}=await supa.from("dramas").select("id,episodes(id)").eq("uploader_id",userId);
  if(error)throw error;
  const ids=(data||[]).map(d=>d.id),episodeCount=(data||[]).reduce((sum,d)=>sum+(d.episodes||[]).length,0);
  let views=0,likes=0;
  if(ids.length){
   const v=await supa.from("drama_views").select("id",{count:"exact",head:true}).in("drama_id",ids);if(v.error)throw v.error;views=v.count||0;
   const l=await supa.from("drama_like_counts").select("like_count").in("drama_id",ids);if(l.error)throw l.error;likes=(l.data||[]).reduce((sum,row)=>sum+Number(row.like_count||0),0);
  }
  $("#statDrama").textContent=String(ids.length);$("#statEpisode").textContent=String(episodeCount);
  $("#statViews").textContent=views.toLocaleString("id-ID");$("#statLikes").textContent=likes.toLocaleString("id-ID");
  status.textContent="Statistik akun diperbarui.";
 }catch(err){status.textContent="Statistik belum dapat dimuat: "+(err?.message||String(err))}
}

function renderCreatorProfile(user){
 const meta=user?.user_metadata||{},name=String(meta.display_name||"").trim()||"Kreator TacTic";
 $("#creatorDisplayName").textContent=name;$("#creatorEmail").textContent=user?.email||"";
 $("#creatorProfileForm").elements.displayName.value=String(meta.display_name||"");
 const avatar=$("#creatorAvatar");avatar.src=meta.avatar_url||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='50' fill='%23251e2b'/%3E%3Ctext x='50' y='63' text-anchor='middle' font-size='42' fill='%23e9c58a'%3E"+encodeURIComponent(name.charAt(0).toUpperCase())+"%3C/text%3E%3C/svg%3E";
}
$("#creatorProfileForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!supa)return;const form=e.currentTarget,fd=new FormData(form),name=String(fd.get("displayName")||"").trim(),file=fd.get("avatar"),btn=form.querySelector("button[type=submit]");
 if(!name){setStatus("#profileStatus","Nama tampilan wajib diisi.");return}
 if(file&&file.size>2*1024*1024){setStatus("#profileStatus","Foto profil maksimal 2 MB.");return}
 if(file&&file.size&&!["image/jpeg","image/png","image/webp"].includes(file.type)){setStatus("#profileStatus","Foto harus JPG, PNG, atau WebP.");return}
 btn.disabled=true;setStatus("#profileStatus","Menyimpan profil...");
 try{
  const {data:sessionData}=await supa.auth.getSession(),user=sessionData.session?.user;if(!user)throw new Error("Sesi login berakhir. Silakan masuk kembali.");
  const oldAvatar=user.user_metadata?.avatar_url||null;let avatarUrl=oldAvatar;
  if(file&&file.size){
   const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[file.type],path=user.id+"/avatar-"+crypto.randomUUID()+"."+ext;
   const uploaded=await supa.storage.from("drama-posters").upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error)throw uploaded.error;
   avatarUrl=supa.storage.from("drama-posters").getPublicUrl(path).data.publicUrl;
  }
  const updated=await supa.auth.updateUser({data:{display_name:name.slice(0,40),avatar_url:avatarUrl}});if(updated.error)throw updated.error;
  if(oldAvatar&&avatarUrl!==oldAvatar){const oldPath=storagePathFromPublicUrl(oldAvatar,"drama-posters");if(oldPath&&oldPath.startsWith(user.id+"/"))await removeOwnedStorageFiles("drama-posters",[oldPath])}
  renderCreatorProfile(updated.data.user||user);setStatus("#profileStatus","Profil kreator berhasil disimpan.");
 }catch(err){setStatus("#profileStatus","Gagal menyimpan profil: "+(err?.message||String(err)))}
 finally{btn.disabled=false}
});
async function verifySession(session){$("#uploadSection").hidden=true;$("#loginForm").hidden=false;$("#signupForm").hidden=false;$("#moderationSection").hidden=true;if(!session||!supa)return;const {data,error}=await supa.from("user_roles").select("role").eq("user_id",session.user.id).maybeSingle();if(error){setStatus("#loginStatus","Gagal memeriksa akun: "+error.message);return}const isAdmin=data?.role==="admin";renderCreatorProfile(session.user);$("#uploadSection").hidden=false;$("#loginForm").hidden=true;$("#signupForm").hidden=true;$("#adminIdentity").textContent=(isAdmin?"Admin masuk sebagai ":"Masuk sebagai ")+session.user.email;setStatus("#loginStatus",isAdmin?"Login admin berhasil.":"Login berhasil. Kamu bisa langsung mengunggah dan menerbitkan drama.");loadMyDramas(session.user.id);if(isAdmin){$("#moderationSection").hidden=false;loadModeration()}}
async function editCreatorDrama(drama,userId){const title=window.prompt("Ubah judul drama:",drama.title);if(title===null)return;if(!title.trim()){setStatus("#loginStatus","Judul drama tidak boleh kosong.");return}const description=window.prompt("Ubah deskripsi drama:",drama.description||"");if(description===null)return;const {data,error}=await supa.from("dramas").update({title:title.trim().slice(0,120),description:description.trim().slice(0,2000)}).eq("id",drama.id).eq("uploader_id",userId).select("id").maybeSingle();if(error){setStatus("#loginStatus","Gagal mengubah drama: "+error.message);return}if(!data){setStatus("#loginStatus","Drama tidak berubah. Pastikan akun memiliki akses edit.");return}setStatus("#loginStatus","Judul dan deskripsi drama berhasil diperbarui.");await loadMyDramas(userId);await loadCatalog()}
$("#openAdmin").addEventListener("click",()=>admin.showModal());
function storagePathFromPublicUrl(url,bucket){if(!url)return null;try{const u=new URL(url);const marker="/storage/v1/object/public/"+bucket+"/";const at=u.pathname.indexOf(marker);return at<0?null:decodeURIComponent(u.pathname.slice(at+marker.length))}catch{return null}}
async function removeOwnedStorageFiles(bucket,paths){const clean=[...new Set(paths.filter(Boolean))];if(!clean.length)return;const {error}=await supa.storage.from(bucket).remove(clean);if(error)throw error}
async function editCreatorEpisode(drama,ep,userId){
 const numberInput=window.prompt("Ubah nomor episode:",String(ep.episode_number));if(numberInput===null)return;
 const episodeNumber=Number(numberInput);if(!Number.isInteger(episodeNumber)||episodeNumber<1){setStatus("#uploadStatus","Nomor episode harus bilangan bulat positif.");return}
 const title=window.prompt("Ubah judul episode:",ep.title||"");if(title===null)return;
 try{
  const duplicate=await supa.from("episodes").select("id").eq("drama_id",drama.id).eq("episode_number",episodeNumber).neq("id",ep.id).maybeSingle();
  if(duplicate.error)throw duplicate.error;if(duplicate.data){setStatus("#uploadStatus","Nomor episode tersebut sudah dipakai.");return}
  const result=await supa.from("episodes").update({episode_number:episodeNumber,title:title.trim().slice(0,120)}).eq("id",ep.id).eq("uploader_id",userId).select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data)throw new Error("Akun ini tidak memiliki izin mengubah episode tersebut.");
  setStatus("#uploadStatus","Episode berhasil diperbarui.");await loadCatalog();await loadMyDramas(userId)
 }catch(err){setStatus("#uploadStatus","Gagal mengubah episode: "+(err?.message||String(err)))}
}
async function deleteCreatorEpisode(drama,ep,userId){if(!confirm("Hapus episode "+ep.episode_number+" dari drama "+drama.title+"? Video episode ini juga akan dihapus permanen."))return;try{await removeOwnedStorageFiles("drama-videos",[ep.video_path]);const {error}=await supa.from("episodes").delete().eq("id",ep.id).eq("drama_id",drama.id).eq("uploader_id",userId);if(error)throw error;setStatus("#uploadStatus","Episode "+ep.episode_number+" berhasil dihapus.");await loadCatalog();await loadMyDramas(userId)}catch(err){setStatus("#uploadStatus","Episode belum berhasil dihapus: "+(err?.message||String(err)))}}
async function deleteCreatorDrama(drama,userId){const eps=drama.episodes||[];if(!confirm("Hapus drama “"+drama.title+"” beserta "+eps.length+" episode? Tindakan ini permanen."))return;try{await removeOwnedStorageFiles("drama-videos",eps.map(ep=>ep.video_path));const posterPath=storagePathFromPublicUrl(drama.poster_url,"drama-posters");await removeOwnedStorageFiles("drama-posters",[posterPath]);const {error}=await supa.from("dramas").delete().eq("id",drama.id).eq("uploader_id",userId);if(error)throw error;setStatus("#uploadStatus","Drama dan seluruh episode berhasil dihapus.");if(activeDrama?.id===drama.id){video.pause();video.removeAttribute("src");player.close();activeDrama=null}await loadCatalog();await loadMyDramas(userId)}catch(err){setStatus("#uploadStatus","Drama belum berhasil dihapus: "+(err?.message||String(err))+". Jika file sudah terhapus, muat ulang daftar dan coba periksa kembali.")}}
async function loadMyDramas(userId){const list=$("#myDramaList"),count=$("#creatorCount"),target=$("#targetDrama");if(!list||!supa)return;list.textContent="Memuat drama...";const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,status,created_at,episodes(id,episode_number,title,video_path,status)").eq("uploader_id",userId).order("created_at",{ascending:false});if(error){list.textContent="Daftar drama belum dapat dimuat: "+error.message;count.textContent="—";return}count.textContent=(data?.length||0)+" drama";await loadCreatorStats(userId);if(target){const selected=target.value;target.innerHTML='<option value="">Buat drama baru</option>';(data||[]).filter(d=>d.status==="approved").forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=d.title;target.append(o)});target.value=selected}list.innerHTML="";if(!data?.length){list.innerHTML='<p class="notice">Kamu belum mengunggah drama. Gunakan formulir unggah di bawah untuk mulai menerbitkan.</p>';return}for(const d of data){const card=document.createElement("article");card.className="creator-item";const info=document.createElement("div");info.className="creator-item-info";const title=document.createElement("strong");title.textContent=d.title;const meta=document.createElement("span");const eps=d.episodes||[];meta.textContent=eps.length+" episode · "+(d.status==="approved"?"Tayang":d.status==="rejected"?"Disembunyikan":"Status: "+d.status);const date=document.createElement("small");date.textContent=d.created_at?new Date(d.created_at).toLocaleDateString("id-ID"):"";info.append(title,meta,date);card.append(info);const edit=document.createElement("button");edit.className="secondary-btn";edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>editCreatorDrama(d,userId));card.append(edit);if(d.status==="approved"&&eps.some(ep=>ep.status==="approved")){const open=document.createElement("button");open.className="secondary-btn";open.type="button";open.textContent="Lihat";open.addEventListener("click",()=>{const published={...d,episodes:eps.filter(ep=>ep.status==="approved"),genre:eps.length+" episode"};admin.close();openDrama(published)});card.append(open)}const remove=document.createElement("button");remove.className="danger-btn";remove.type="button";remove.textContent="Hapus drama";remove.addEventListener("click",()=>deleteCreatorDrama(d,userId));card.append(remove);if(eps.length){const details=document.createElement("details");details.className="creator-episodes";const summary=document.createElement("summary");summary.textContent="Kelola "+eps.length+" episode";details.append(summary);for(const ep of [...eps].sort((x,y)=>x.episode_number-y.episode_number)){const row=document.createElement("div");row.className="creator-episode-row";const label=document.createElement("span");label.textContent="Episode "+ep.episode_number+(ep.title?" · "+ep.title:"");const del=document.createElement("button");del.className="danger-btn";del.type="button";del.textContent="Hapus";del.addEventListener("click",()=>deleteCreatorEpisode(d,ep,userId));const edit=document.createElement("button");edit.className="secondary-btn";edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>editCreatorEpisode(d,ep,userId));row.append(label,edit,del);details.append(row)}card.append(details)}list.append(card)}} 
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.close==="playerDialog"){persistCurrentPlayback();video.pause()}document.getElementById(b.dataset.close).close()}));
player.addEventListener("cancel",()=>{persistCurrentPlayback();video.pause()});
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const f=new FormData(e.currentTarget);setStatus("#loginStatus","Memeriksa akun...");const {data,error}=await supa.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){setStatus("#loginStatus","Login gagal: "+error.message);return}await verifySession(data.session)});
$("#signupForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const f=new FormData(e.currentTarget);setStatus("#loginStatus","Mendaftarkan akun...");const {data,error}=await supa.auth.signUp({email:f.get("email"),password:f.get("password"),options:{emailRedirectTo:location.origin+location.pathname}});if(error){setStatus("#loginStatus","Pendaftaran gagal: "+error.message);return}if(data.session){await verifySession(data.session)}else{setStatus("#loginStatus","Pendaftaran berhasil. Buka email untuk konfirmasi akun, lalu masuk di sini.")}});
$("#logoutBtn").addEventListener("click",async()=>{if(supa)await supa.auth.signOut();$("#uploadSection").hidden=true;$("#loginForm").hidden=false;$("#signupForm").hidden=false;setStatus("#loginStatus","Kamu sudah keluar.")});
async function loadModeration(){const list=$("#moderationList");if(!list||!supa)return;list.textContent="Memuat laporan...";const {data,error}=await supa.from("video_reports").select("id,drama_id,reason,details,status,created_at").eq("status","open").order("created_at",{ascending:false}).limit(50);if(error){list.textContent="Gagal memuat laporan: "+error.message;return}list.innerHTML="";if(!data?.length){list.textContent="Belum ada laporan video.";return}for(const report of data){const card=document.createElement("article");card.className="comment-item";const title=document.createElement("strong");title.textContent="Alasan: "+report.reason;const detail=document.createElement("p");detail.textContent=report.details||"Tidak ada keterangan tambahan.";const date=document.createElement("small");date.textContent=new Date(report.created_at).toLocaleString("id-ID");const review=document.createElement("button");review.className="secondary-btn";review.textContent="Tandai ditinjau";review.addEventListener("click",()=>updateReport(report.id,"reviewed"));const hide=document.createElement("button");hide.className="primary-btn";hide.textContent="Sembunyikan drama";hide.addEventListener("click",()=>hideReportedDrama(report.id,report.drama_id));card.append(title,detail,date,review,hide);list.append(card)}}
async function updateReport(id,status){const {error}=await supa.from("video_reports").update({status}).eq("id",id);if(error){setStatus("#loginStatus","Gagal memperbarui laporan: "+error.message);return}await loadModeration()}
async function hideReportedDrama(reportId,dramaId){const ep=await supa.from("episodes").update({status:"rejected"}).eq("drama_id",dramaId);if(ep.error){setStatus("#loginStatus","Gagal menyembunyikan episode: "+ep.error.message);return}const d=await supa.from("dramas").update({status:"rejected"}).eq("id",dramaId);if(d.error){setStatus("#loginStatus","Gagal menyembunyikan drama: "+d.error.message);return}const r=await supa.from("video_reports").update({status:"actioned"}).eq("id",reportId);if(r.error){setStatus("#loginStatus","Drama disembunyikan, tetapi status laporan gagal diperbarui: "+r.error.message);return}setStatus("#loginStatus","Drama dan episode sudah disembunyikan dari katalog.");await loadModeration();await loadCatalog()}
async function moderateDrama(id,status){const ep=await supa.from("episodes").update({status}).eq("drama_id",id);if(ep.error){setStatus("#loginStatus","Gagal memperbarui episode: "+ep.error.message);return}const result=await supa.from("dramas").update({status}).eq("id",id);if(result.error){setStatus("#loginStatus","Gagal memperbarui drama: "+result.error.message);return}setStatus("#loginStatus",status==="approved"?"Drama disetujui dan tampil untuk semua penonton.":"Kiriman ditolak.");await loadModeration();await loadCatalog()}
function loadTusLibrary(){
 if(window.tus?.Upload)return Promise.resolve(window.tus);
 return new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-tus-client="true"]');
  if(existing){existing.addEventListener("load",()=>resolve(window.tus),{once:true});existing.addEventListener("error",()=>reject(new Error("Library upload resumable gagal dimuat.")),{once:true});return}
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js";script.async=true;script.dataset.tusClient="true";
  script.onload=()=>window.tus?.Upload?resolve(window.tus):reject(new Error("Library upload tidak tersedia."));
  script.onerror=()=>reject(new Error("Tidak bisa memuat fitur upload resumable. Periksa koneksi internet."));
  document.head.append(script);
 });
}
function uploadVideoResumable(file,path,session,onProgress){
 return loadTusLibrary().then(tus=>new Promise((resolve,reject)=>{
  const projectRef=(cfg.url||"").replace(/^https:\/\//,"").split(".")[0];
  const upload=new tus.Upload(file,{
   endpoint:"https://"+projectRef+".storage.supabase.co/storage/v1/upload/resumable",
   retryDelays:[0,3000,5000,10000,20000],
   headers:{authorization:"Bearer "+session.access_token},
   metadata:{bucketName:"drama-videos",objectName:path,contentType:file.type||"application/octet-stream",cacheControl:"3600"},
   chunkSize:6*1024*1024,
   uploadDataDuringCreation:true,
   removeFingerprintOnSuccess:true,
   onError:error=>reject(error),
   onProgress:(sent,total)=>onProgress(Math.round(sent/total*100)),
   onSuccess:()=>resolve()
  });
  // Unique object paths must never resume another upload with the same filename.
  upload.start();
 }));
}
$("#uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa){setStatus("#uploadStatus","Backend belum dikonfigurasi.");return}
 const {data:sessionData}=await supa.auth.getSession(),session=sessionData.session,user=session?.user;
 if(!user){setStatus("#uploadStatus","Masuk ke akun terlebih dahulu.");return}
 const f=e.currentTarget,data=new FormData(f),file=data.get("video"),targetDrama=String(data.get("targetDrama")||""),posterFile=targetDrama?null:data.get("poster"),title=String(data.get("title")||"").trim(),episode=Number(data.get("episode"));
 if(!targetDrama&&!title){setStatus("#uploadStatus","Isi judul drama terlebih dahulu.");return}
 if(!Number.isInteger(episode)||episode<1){setStatus("#uploadStatus","Nomor episode harus bilangan positif.");return}
 if(posterFile&&posterFile.size>10*1024*1024){setStatus("#uploadStatus","Ukuran poster maksimal 10 MB.");return}
 if(posterFile&&!["image/jpeg","image/png","image/webp"].includes(posterFile.type)){setStatus("#uploadStatus","Poster harus JPG, PNG, atau WebP.");return}
 if(!file||!["video/mp4","video/webm","video/quicktime"].includes(file.type)){setStatus("#uploadStatus","Pilih video MP4, WebM, atau MOV.");return}
 if(file.size===0){setStatus("#uploadStatus","File video kosong. Pilih video lain.");return}
 if(file.size>500*1024*1024){setStatus("#uploadStatus","Ukuran video maksimal 500 MB.");return}
 if(targetDrama){
  setStatus("#uploadStatus","Memeriksa drama dan nomor episode...");
  const exists=await supa.from("dramas").select("id").eq("id",targetDrama).eq("uploader_id",user.id).eq("status","approved").maybeSingle();
  if(exists.error){setStatus("#uploadStatus","Gagal memeriksa drama tujuan: "+exists.error.message);return}
  if(!exists.data){setStatus("#uploadStatus","Drama tujuan tidak ditemukan atau bukan milik akun ini.");return}
  const duplicate=await supa.from("episodes").select("id").eq("drama_id",targetDrama).eq("episode_number",episode).maybeSingle();
  if(duplicate.error){setStatus("#uploadStatus","Gagal memeriksa nomor episode: "+duplicate.error.message);return}
  if(duplicate.data){setStatus("#uploadStatus","Nomor episode tersebut sudah ada. Ubah nomor sebelum mengunggah.");return}
 }
 const btn=f.querySelector('button[type="submit"]');btn.disabled=true;
 let dramaId=targetDrama||null,createdDrama=false,videoPath=null,posterPath=null;
 setStatus("#uploadStatus","Menyiapkan unggahan video...");
 try{
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  videoPath=user.id+"/"+crypto.randomUUID()+"-"+safeName;
  if(posterFile&&posterFile.size){
   posterPath=user.id+"/"+crypto.randomUUID()+"-"+posterFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const posterUpload=await supa.storage.from("drama-posters").upload(posterPath,posterFile,{contentType:posterFile.type,upsert:false});
   if(posterUpload.error)throw posterUpload.error;
  }
  await uploadVideoResumable(file,videoPath,session,pct=>setStatus("#uploadStatus","Mengunggah video... "+pct+"% (jangan tutup halaman)."));
  setStatus("#uploadStatus","Video selesai diunggah. Menyimpan episode...");
  if(!dramaId){const created=await supa.from("dramas").insert({title,description:String(data.get("description")||""),poster_url:posterPath?supa.storage.from("drama-posters").getPublicUrl(posterPath).data.publicUrl:null,uploader_id:user.id,status:"approved"}).select("id").single();if(created.error)throw created.error;dramaId=created.data.id;createdDrama=true;}else{/* Drama and episode were checked before uploading; keep DB insert as final race-safe validation. */}
  const saved=await supa.from("episodes").insert({drama_id:dramaId,episode_number:episode,title:String(data.get("episodeTitle")||""),video_path:videoPath,uploader_id:user.id,status:"approved"});
  if(saved.error)throw saved.error;
  setStatus("#uploadStatus",createdDrama?"Berhasil! Drama baru dan episode sudah langsung diterbitkan.":"Berhasil! Episode baru sudah ditambahkan ke drama pilihan.");
  f.reset();syncTargetForm();await loadCatalog();await loadMyDramas(user.id);
 }catch(err){
  if(dramaId&&createdDrama){
   const rollback=await supa.from("dramas").delete().eq("id",dramaId).eq("uploader_id",user.id);
   if(rollback.error)console.warn("Pembersihan data drama gagal:",rollback.error.message);
  }
  const cleanup=[];
  if(videoPath)cleanup.push(supa.storage.from("drama-videos").remove([videoPath]));
  if(posterPath)cleanup.push(supa.storage.from("drama-posters").remove([posterPath]));
  const cleanupResults=await Promise.allSettled(cleanup);
  cleanupResults.forEach(result=>{if(result.status==="rejected")console.warn("Pembersihan file unggahan gagal:",result.reason)});
  setStatus("#uploadStatus","Gagal menerbitkan drama: "+(err?.message||String(err))+". File sementara yang sudah terkirim akan dibersihkan jika izin penyimpanan mengizinkan. Periksa koneksi lalu coba lagi.");
 }finally{btn.disabled=false}
});
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeTab=b.dataset.tab;const historyTools=$("#historyTools");if(historyTools)historyTools.hidden=activeTab!=="history";if(activeTab==="profile"){admin.showModal();return}render()}));
$("#clearHistory").addEventListener("click",()=>{if(!Object.keys(watchHistory).length)return;if(!window.confirm("Hapus seluruh riwayat tontonan di perangkat ini?"))return;watchHistory={};try{localStorage.removeItem("tactic-watch-history")}catch{}render()});

$("#likeDrama").addEventListener("click",async()=>{
 if(!activeDrama||String(activeDrama.id).startsWith("demo-"))return;
 const {data:sessionData}=await supa.auth.getSession(),user=sessionData.session?.user;
 if(!user){setStatus("#reportStatus","Masuk ke akun untuk memberi suka.");admin.showModal();return}
 const btn=$("#likeDrama"),liked=btn.dataset.liked==="true";btn.disabled=true;
 try{
  const result=liked
   ?await supa.from("drama_likes").delete().eq("drama_id",activeDrama.id).eq("user_id",user.id)
   :await supa.from("drama_likes").insert({drama_id:activeDrama.id});
  if(result.error)throw result.error;
  await loadDramaLikeState(activeDrama.id);
 }catch(err){setStatus("#reportStatus","Gagal memperbarui suka: "+(err?.message||String(err)));btn.disabled=false}
});

$("#shareDrama").addEventListener("click",async()=>{if(!activeDrama)return;const shareData={title:activeDrama.title,text:"Tonton "+activeDrama.title+" di TacTic Drama",url:location.href};try{if(navigator.share)await navigator.share(shareData);else if(navigator.clipboard){await navigator.clipboard.writeText(shareData.text+" — "+shareData.url);setStatus("#shareStatus","Link berhasil disalin.")}else setStatus("#shareStatus","Bagikan: "+shareData.url)}catch(e){if(e.name!=="AbortError")setStatus("#shareStatus","Belum bisa membagikan link dari perangkat ini.")}});
const targetSelect=$("#targetDrama");function syncTargetForm(){const existing=Boolean(targetSelect?.value);$("#posterField").hidden=existing;$("#uploadForm [name=title]").disabled=existing;$("#uploadForm [name=description]").disabled=existing}targetSelect?.addEventListener("change",syncTargetForm);syncTargetForm();
 const uploadForm=$("#uploadForm");
 let posterPreviewUrl=null;
 function formatUploadSize(bytes){if(!Number.isFinite(bytes)||bytes<0)return "";const units=["B","KB","MB","GB"];let value=bytes,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return value.toFixed(index===0?0:1)+" "+units[index]}
 function updateUploadPreview(){
  const poster=uploadForm?.elements.poster?.files?.[0],videoFile=uploadForm?.elements.video?.files?.[0],preview=$("#uploadPreview"),image=$("#uploadPosterPreview"),name=$("#uploadVideoName"),size=$("#uploadVideoSize");
  if(posterPreviewUrl){URL.revokeObjectURL(posterPreviewUrl);posterPreviewUrl=null}
  if(poster){posterPreviewUrl=URL.createObjectURL(poster);image.src=posterPreviewUrl;image.hidden=false}else{image.removeAttribute("src");image.hidden=true}
  name.textContent=videoFile?videoFile.name:"Pilih file video dari galeri";
  size.textContent=videoFile?formatUploadSize(videoFile.size)+" · "+(videoFile.type||"Format tidak diketahui"):"";
  preview.hidden=!poster&&!videoFile;
 }
 uploadForm?.elements.poster?.addEventListener("change",updateUploadPreview);
 uploadForm?.elements.video?.addEventListener("change",updateUploadPreview);
 uploadForm?.addEventListener("reset",()=>{setTimeout(updateUploadPreview,0)});
 const searchBox=$("#dramaSearch");searchBox.addEventListener("input",()=>{searchQuery=searchBox.value.trim().toLocaleLowerCase("id");render()});
$("#dramaSort")?.addEventListener("change",render);
$("#reloadCatalog")?.addEventListener("click",()=>loadCatalog());
function updateNetworkStatus(){const el=$("#networkStatus");if(!el)return;const online=navigator.onLine;el.textContent=online?"● Online":"● Offline";el.classList.toggle("is-offline",!online)}
window.addEventListener("online",()=>{updateNetworkStatus();loadCatalog()});window.addEventListener("offline",updateNetworkStatus);updateNetworkStatus();
render();
const cfg=window.TACTIC_SUPABASE_CONFIG||{};
if(window.supabase?.createClient&&cfg.url?.startsWith("https://")&&!cfg.url.includes("YOUR-PROJECT")&&cfg.anonKey&&!cfg.anonKey.includes("YOUR-SUPABASE")){supa=window.supabase.createClient(cfg.url,cfg.anonKey);$("#backendNotice").textContent="Daftar akun untuk mengirim video. Email perlu dikonfirmasi sebelum login jika verifikasi email aktif.";loadCatalog();supa.auth.getSession().then(({data})=>verifySession(data.session));supa.auth.onAuthStateChange((_event,session)=>{verifySession(session)})}else{$("#backendNotice").textContent="Koneksi backend belum diisi. Website dan katalog contoh tetap bisa dibuka; upload online aktif setelah konfigurasi Supabase."}
let installPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;const btn=$("#installBtn");btn.hidden=false;btn.addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;btn.hidden=true},{once:true})});
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
