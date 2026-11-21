const demoDramas=[
 {id:"demo-1",title:"Rahasia Hati",genre:"Romantis • Drama pilihan",description:"Sebuah pertemuan tak terduga mengubah segalanya.",colors:["#79324d","#242b50"],episodes:[]},
 {id:"demo-2",title:"Takdir Kedua",genre:"Drama • Drama pilihan",description:"Kesempatan kedua datang saat semua terasa terlambat.",colors:["#81522c","#342448"],episodes:[]},
 {id:"demo-3",title:"Janji Senja",genre:"Keluarga • Drama pilihan",description:"Janji lama yang kembali menguji sebuah keluarga.",colors:["#a64c3d","#30233b"],episodes:[]},
 {id:"demo-4",title:"Cinta Terlarang",genre:"Romantis • Drama pilihan",description:"Dua hati terjebak di antara cinta dan rahasia.",colors:["#61365f","#1d3450"],episodes:[]}
];
let dramas=[...demoDramas],activeDrama=null,activeEpisodeIndex=0,supa=null,activeTab="home",sharedDramaOpened=false;
let autoNextEnabled=true;try{autoNextEnabled=localStorage.getItem("tactic-auto-next")!=="false"}catch{}
let searchQuery="";
let favoriteIds=new Set();try{favoriteIds=new Set(JSON.parse(localStorage.getItem("tactic-favorites")||"[]"))}catch{}
let watchHistory={};try{watchHistory=JSON.parse(localStorage.getItem("tactic-watch-history")||"{}")||{}}catch{}
let lastHistoryPersist=0;
let episodeProgress={};try{episodeProgress=JSON.parse(localStorage.getItem("tactic-episode-progress")||"{}")||{}}catch{}
let lastEpisodeProgressPersist=0;
const grid=document.querySelector("#dramaGrid"),player=document.querySelector("#playerDialog"),admin=document.querySelector("#adminDialog"),video=document.querySelector("#videoPlayer");
const $=s=>document.querySelector(s);
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatPlaybackTime(seconds=0){const n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),sec=n%60;return h?[h,m,sec].map(v=>String(v).padStart(2,"0")).join(":"):[m,sec].map(v=>String(v).padStart(2,"0")).join(":")}
function render(){grid.innerHTML="";let visible=activeTab==="saved"?dramas.filter(d=>favoriteIds.has(d.id)):activeTab==="history"?dramas.filter(d=>watchHistory[d.id]).sort((a,b)=>new Date(watchHistory[b.id]?.watched_at||0)-new Date(watchHistory[a.id]?.watched_at||0)):dramas;if(searchQuery)visible=visible.filter(d=>(String(d.title||"")+" "+String(d.description||"")+" "+String(d.genre||"")).toLocaleLowerCase("id").includes(searchQuery));if(activeTab!=="history"){const mode=$("#dramaSort")?.value||"newest";if(mode==="popular")visible.sort((a,b)=>Number(b.like_count||0)-Number(a.like_count||0)||String(a.title||"").localeCompare(String(b.title||""),"id"));else if(mode==="az")visible.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"id"));else if(mode==="za")visible.sort((a,b)=>String(b.title||"").localeCompare(String(a.title||""),"id"));}const countLabel=$("#catalogCount");if(countLabel)countLabel.textContent=searchQuery?visible.length+" hasil pencarian":visible.length+" drama ditampilkan";const clearSearch=$("#clearSearch");if(clearSearch)clearSearch.hidden=!searchQuery;renderContinueWatching();if(!visible.length){grid.innerHTML=`<p class="empty-state">${searchQuery?"Drama tidak ditemukan. Coba kata kunci lain atau hapus pencarian.":activeTab==="saved"?"Belum ada drama favorit. Tekan ikon ♡ pada poster drama untuk menyimpannya.":activeTab==="history"?"Riwayat tontonanmu masih kosong. Putar drama untuk menyimpannya di sini.":"Belum ada drama. Drama yang diunggah admin akan muncul di sini."}</p>`;return}visible.forEach(d=>{const card=document.createElement("article");card.className="drama-card";const historyEntry=activeTab==="history"?watchHistory[d.id]:null;const historyLabel=historyEntry?"Lanjutkan · Episode "+historyEntry.episode_number+(Number(historyEntry.position_seconds)>0?" · "+formatPlaybackTime(historyEntry.position_seconds):""):"";card.innerHTML=`<div class="poster" role="button" tabindex="0" style="background:linear-gradient(145deg,${d.colors?.[0]||"#61365f"},${d.colors?.[1]||"#20243a"})"><span class="tag">${historyLabel?escapeHtml(historyLabel):"DRAMA PENDEK"}</span><span class="poster-title">${escapeHtml(d.title)}</span><button class="favorite-btn ${favoriteIds.has(d.id)?"is-favorite":""}" type="button" aria-label="${favoriteIds.has(d.id)?"Hapus dari":"Tambah ke"} favorit">${favoriteIds.has(d.id)?"♥":"♡"}</button></div><div class="card-meta"><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.genre||((d.episodes||[]).length+" episode"))}</span><span class="card-likes">♥ ${Number(d.like_count||0).toLocaleString("id-ID")} suka</span></div>`;const poster=card.querySelector(".poster");const openCardDrama=()=>{const saved=activeTab==="history"?watchHistory[d.id]:null;const resumeNumber=saved?.episode_number??null,resumeSeconds=Number(saved?.position_seconds||0);openDrama(d);if(resumeNumber!=null){const resumeIndex=(d.episodes||[]).findIndex(ep=>Number(ep.episode_number)===Number(resumeNumber));if(resumeIndex>=0)playEpisode(resumeIndex,false,resumeSeconds)}};poster.addEventListener("click",openCardDrama);poster.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCardDrama()}});if(d.poster_url){const art=document.createElement("img");art.className="poster-art";art.src=d.poster_url;art.alt="Poster "+d.title;art.loading="lazy";poster.prepend(art)}card.querySelector(".favorite-btn").addEventListener("click",e=>{e.stopPropagation();if(favoriteIds.has(d.id))favoriteIds.delete(d.id);else favoriteIds.add(d.id);try{localStorage.setItem("tactic-favorites",JSON.stringify([...favoriteIds]))}catch{}render()});grid.append(card)})}
function renderContinueWatching(){
 const section=$("#continueSection"),list=$("#continueGrid");
 if(!section||!list)return;
 const entries=Object.entries(watchHistory).map(([id,entry])=>({drama:dramas.find(item=>String(item.id)===String(id)),entry})).filter(item=>item.drama).sort((a,b)=>new Date(b.entry.watched_at||0)-new Date(a.entry.watched_at||0)).slice(0,3);
 const visible=activeTab==="home"&&!searchQuery&&entries.length>0;
 section.hidden=!visible;
 if(!visible)return;
 list.innerHTML="";
 entries.forEach(({drama,entry})=>{
  const episode=(drama.episodes||[]).find(item=>Number(item.episode_number)===Number(entry.episode_number));
  if(!episode)return;
  const key=String(drama.id)+":"+String(episode.id||"");
  const progress=episodeProgress[key]?.percent||0;
  const card=document.createElement("article");card.className="continue-card";
  const info=document.createElement("div");info.className="continue-card-info";
  const title=document.createElement("strong");title.textContent=drama.title;
  const meta=document.createElement("span");meta.textContent="Episode "+entry.episode_number+(entry.episode_title?" · "+entry.episode_title:"");
  const time=document.createElement("small");time.textContent=progress>=95?"Episode selesai":progress>0?"Progres "+progress+"% · "+formatPlaybackTime(entry.position_seconds):"Mulai menonton";
  info.append(title,meta,time);
  const button=document.createElement("button");button.type="button";button.className="continue-play-btn";button.textContent="Lanjutkan →";
  button.addEventListener("click",()=>{openDrama(drama);const index=(drama.episodes||[]).findIndex(item=>Number(item.episode_number)===Number(entry.episode_number));if(index>=0)playEpisode(index,true,Number(entry.position_seconds)||0)});
  card.append(info,button);
  const track=document.createElement("span");track.className="continue-progress-track";const fill=document.createElement("span");fill.style.width=Math.min(100,Number(progress)||0)+"%";track.append(fill);card.append(track);
  list.append(card);
 });
}
function getVideoUrl(path){return supa.storage.from("drama-videos").getPublicUrl(path).data.publicUrl}
function saveWatchHistory(ep,positionSeconds=0){if(!activeDrama||!ep?.id||String(activeDrama.id).startsWith("demo-"))return;watchHistory[activeDrama.id]={episode_number:ep.episode_number,episode_title:ep.title||"",position_seconds:Math.max(0,Math.floor(Number(positionSeconds)||0)),watched_at:new Date().toISOString()};try{localStorage.setItem("tactic-watch-history",JSON.stringify(watchHistory))}catch{}renderContinueWatching()}
function episodeProgressKey(ep){return String(activeDrama?.id||"")+":"+String(ep?.id||"")}
function saveEpisodeProgress(force=false){
 if(!activeDrama||!Number.isFinite(video.duration)||video.duration<=0)return;
 const now=Date.now();if(!force&&now-lastEpisodeProgressPersist<5000)return;lastEpisodeProgressPersist=now;
 const ep=activeDrama.episodes?.[activeEpisodeIndex];if(!ep?.id||String(activeDrama.id).startsWith("demo-"))return;
 const key=episodeProgressKey(ep),seconds=Math.max(0,Math.floor(video.currentTime||0)),duration=Math.floor(video.duration);
 episodeProgress[key]={seconds,duration,percent:Math.min(100,Math.floor(seconds/duration*100)),updated_at:new Date().toISOString()};
 try{localStorage.setItem("tactic-episode-progress",JSON.stringify(episodeProgress))}catch{}
 renderEpisodeProgress(ep);
}
function formatEpisodeTime(seconds){const value=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(value/60)+":"+String(value%60).padStart(2,"0")}
function renderEpisodeProgress(ep){
 const key=episodeProgressKey(ep),data=episodeProgress[key],button=[...$("#episodeList").querySelectorAll("button")].find(item=>item.dataset.progressKey===key);
 if(!button)return;
 const fill=button.querySelector(".episode-progress-fill"),label=button.querySelector(".episode-progress-label"),percent=data?.percent||0;
 if(fill)fill.style.width=percent+"%";
 if(label)label.textContent=percent>=95?"Selesai":percent>0?"Lanjutkan · "+formatEpisodeTime(data.seconds)+" · "+percent+"%":"Belum ditonton";
}
function syncEpisodeDeepLink(drama,episode){
 if(!drama||String(drama.id).startsWith("demo-"))return;
 const url=new URL(location.href);
 url.searchParams.set("drama",String(drama.id));
 if(episode?.episode_number)url.searchParams.set("episode",String(episode.episode_number));
 try{history.replaceState(history.state,"",url.toString())}catch{}
 document.title=drama.title+(episode?.episode_number?" · Episode "+episode.episode_number:"")+" | TacTic Drama";
}
function playEpisode(index,autoplay=true,resumeSeconds=0){const eps=activeDrama?.episodes||[];if(index<0||index>=eps.length)return;activeEpisodeIndex=index;const ep=eps[index];syncEpisodeDeepLink(activeDrama,ep);const list=$("#episodeList");list.querySelectorAll("button").forEach((b,i)=>{b.classList.toggle("active",i===index)});const prev=$("#prevEpisode"),next=$("#nextEpisode");if(prev)prev.disabled=index===0;if(next){next.disabled=index===eps.length-1;next.textContent=index===eps.length-1?"Episode terakhir":"Episode berikutnya →"}$("#playerDescription").textContent="Episode "+ep.episode_number+(ep.title?" — "+ep.title:"")+" · "+(index<eps.length-1?(autoNextEnabled?"Putar otomatis aktif":"Putar otomatis nonaktif"):"Ini episode terbaru");if(resumeSeconds>0){video.addEventListener("loadedmetadata",()=>{if(Number.isFinite(video.duration)&&resumeSeconds<video.duration-2)video.currentTime=resumeSeconds},{once:true})}applyPlaybackPreferences();video.querySelectorAll("track[data-episode-subtitle]").forEach(track=>track.remove());if(ep.subtitle_path){const track=document.createElement("track");track.kind="captions";track.label="Bahasa Indonesia";track.srclang="id";track.src=supa.storage.from("drama-videos").getPublicUrl(ep.subtitle_path).data.publicUrl;track.default=true;track.dataset.episodeSubtitle="true";video.append(track)}video.src=getVideoUrl(ep.video_path);video.load();saveWatchHistory(ep,resumeSeconds);recordEpisodeView(ep);if(autoplay)video.play().catch(()=>{});}
function openDrama(d){activeDrama=d;activeEpisodeIndex=0;$("#playerSeries").textContent=d.genre||"TAC TIC DRAMA";$("#playerTitle").textContent=d.title;$("#playerDescription").textContent=d.description||"Nikmati episode drama ini.";const list=$("#episodeList");list.innerHTML="";const eps=[...(d.episodes||[])].sort((a,b)=>a.episode_number-b.episode_number);d.episodes=eps;if(!eps.length){list.textContent="Episode belum tersedia.";video.pause();video.removeAttribute("src")}eps.forEach((ep,i)=>{const b=document.createElement("button");b.dataset.progressKey=String(d.id)+":"+String(ep.id||"");const title=document.createElement("span");title.className="episode-button-title";title.textContent="Episode "+ep.episode_number+(ep.title?" · "+ep.title:"");const meta=document.createElement("small");meta.className="episode-progress-label";const saved=episodeProgress[b.dataset.progressKey];meta.textContent=saved?.percent>=95?"Selesai":saved?.percent>0?"Lanjutkan · "+formatEpisodeTime(saved.seconds)+" · "+saved.percent+"%":"Belum ditonton";const track=document.createElement("span");track.className="episode-progress-track";const fill=document.createElement("span");fill.className="episode-progress-fill";fill.style.width=Math.min(100,Number(saved?.percent)||0)+"%";track.append(fill);b.append(title,meta,track);b.addEventListener("click",()=>{const saved=episodeProgress[b.dataset.progressKey],resume=saved&&saved.percent>0&&saved.percent<95?Math.max(0,Number(saved.seconds)||0):0;playEpisode(i,true,resume)});list.append(b)});if(eps.length)playEpisode(0,false);loadComments(d.id);loadDramaLikeState(d.id);player.showModal()}
async function loadCatalog(){const status=$("#catalogStatus"),reload=$("#reloadCatalog"),grid=$("#dramaGrid");if(!supa){if(status)status.textContent="Katalog online belum tersambung.";return}if(status)status.textContent="Menyiapkan pilihan drama…";if(reload){reload.disabled=true;reload.textContent="Memuat…"}if(grid){grid.classList.add("is-loading");grid.innerHTML=Array.from({length:4},()=>'<article class="skeleton-card" aria-hidden="true"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></article>').join("")}try{const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,episodes(id,episode_number,title,video_path,subtitle_path,status)").eq("status","approved").eq("episodes.status","approved").order("created_at",{ascending:false});if(error)throw error;if(data){const likesResult=await supa.from("drama_like_counts").select("drama_id,like_count");const likesByDrama=new Map((likesResult.data||[]).map(row=>[String(row.drama_id),Number(row.like_count||0)]));if(likesResult.error)console.warn("Jumlah suka katalog belum dapat dimuat:",likesResult.error.message);dramas=data.map(d=>({...d,like_count:likesByDrama.get(String(d.id))||0,genre:(d.episodes||[]).length+" episode",colors:["#71324e","#252344"]}));render();const sharedId=new URLSearchParams(location.search).get("drama");if(sharedId&&!sharedDramaOpened){const sharedDrama=dramas.find(item=>String(item.id)===sharedId);if(sharedDrama){sharedDramaOpened=true;openDrama(sharedDrama);const sharedEpisode=Number(new URLSearchParams(location.search).get("episode"));if(Number.isInteger(sharedEpisode)&&sharedEpisode>0){const episodeIndex=(sharedDrama.episodes||[]).findIndex(ep=>Number(ep.episode_number)===sharedEpisode);if(episodeIndex>=0)playEpisode(episodeIndex,false)}}}if(status)status.textContent=data.length?data.length+" drama tersedia. Katalog berhasil diperbarui.":"Belum ada drama yang diterbitkan."}}catch(e){console.warn("Catalog online belum dapat dimuat:",e.message);render();if(status)status.textContent="Katalog gagal dimuat. Periksa koneksi lalu coba muat ulang."}finally{grid?.classList.remove("is-loading");if(reload){reload.disabled=false;reload.textContent="↻ Muat ulang"}}}
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
function updateCommentCounters(){
 const form=$("#commentForm");if(!form)return;
 const name=form.elements.displayName,body=form.elements.body;
 const nameCount=$("#commentNameCount"),bodyCount=$("#commentBodyCount");
 if(nameCount)nameCount.textContent=name.value.length+"/40 karakter";
 if(bodyCount)bodyCount.textContent=body.value.length.toLocaleString("id-ID")+"/1.000 karakter";
}
$("#commentForm").elements.displayName.addEventListener("input",updateCommentCounters);
$("#commentForm").elements.body.addEventListener("input",updateCommentCounters);
$("#commentForm").addEventListener("reset",()=>setTimeout(updateCommentCounters,0));
updateCommentCounters();
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

$("#reportDrama").addEventListener("click",async()=>{if(!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#reportStatus","Laporan tersedia untuk drama dari katalog online.");return}if(!supa){setStatus("#reportStatus","Backend belum tersambung.");return}const {data}=await supa.auth.getSession();if(!data.session){setStatus("#reportStatus","Masuk atau daftar akun untuk melaporkan video.");admin.showModal();return}$("#reportForm").reset();$("#reportDialog").showModal()});
$("#reportForm").addEventListener("submit",async event=>{event.preventDefault();if(!activeDrama||!supa)return;const {data}=await supa.auth.getSession();if(!data.session){$("#reportDialog").close();setStatus("#reportStatus","Sesi akun berakhir. Masuk kembali untuk melaporkan video.");admin.showModal();return}const form=event.currentTarget,values=new FormData(form),reason=String(values.get("reason")||"").trim(),details=String(values.get("details")||"").trim(),button=form.querySelector('button[type="submit"]');if(!reason){setStatus("#reportFormStatus","Pilih alasan laporan terlebih dahulu.");return}button.disabled=true;setStatus("#reportFormStatus","Mengirim laporan…");try{const {error}=await supa.from("video_reports").insert({drama_id:activeDrama.id,reporter_id:data.session.user.id,reason,details:details.slice(0,1000)});if(error)throw error;$("#reportDialog").close();setStatus("#reportStatus","Terima kasih. Laporan sudah dikirim ke tim admin.");}catch(error){setStatus("#reportFormStatus","Gagal mengirim laporan: "+error.message)}finally{button.disabled=false}});

function setVideoStatus(message="",retry=false){
 const panel=$("#videoStatus"),label=$("#videoStatusText"),button=$("#retryVideo");
 if(!panel||!label||!button)return;
 panel.hidden=!message;label.textContent=message;button.hidden=!retry;
}
video.addEventListener("loadstart",()=>setVideoStatus("Menghubungkan ke video…"));
video.addEventListener("waiting",()=>setVideoStatus("Video sedang memuat. Periksa koneksi jika terlalu lama."));
video.addEventListener("canplay",()=>setVideoStatus(""));
video.addEventListener("playing",()=>setVideoStatus(""));
video.addEventListener("error",()=>{
 const messages={1:"Pemutaran video dibatalkan.",2:"Koneksi terputus saat memuat video.",3:"Format atau data video tidak dapat diproses.",4:"Video tidak tersedia atau formatnya tidak didukung."};
 const code=video.error?.code;
 setVideoStatus(messages[code]||"Video gagal diputar. Periksa koneksi lalu coba lagi.",true);
});
$("#retryVideo").addEventListener("click",()=>{
 if(!video.src)return;
 setVideoStatus("Mencoba memuat ulang video…");
 video.load();
 video.play().catch(()=>setVideoStatus("Tekan tombol putar pada video untuk melanjutkan.",true));
});
video.addEventListener("ended",()=>{saveEpisodeProgress(true);if(activeDrama&&activeEpisodeIndex<(activeDrama.episodes||[]).length-1){if(autoNextEnabled)playEpisode(activeEpisodeIndex+1);else setStatus("#playerDescription","Episode selesai. Putar otomatis nonaktif — pilih episode berikutnya jika ingin lanjut.")}else setStatus("#playerDescription","Kamu sudah menyelesaikan episode terbaru. Pilih drama lain atau tonton ulang episode ini.");});

function seekVideoBy(seconds){
 if(!Number.isFinite(video.duration)||!Number.isFinite(video.currentTime))return;
 video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+seconds));
 updateSeekTime();
}
function updateSeekTime(){
 const current=formatPlaybackTime(video.currentTime||0);
 const duration=Number.isFinite(video.duration)?formatPlaybackTime(video.duration):"--:--";
 const label=$("#seekTime");if(label)label.textContent=current+" / "+duration;
}
$("#seekBack").addEventListener("click",()=>seekVideoBy(-10));
$("#seekForward").addEventListener("click",()=>seekVideoBy(10));
document.addEventListener("keydown",event=>{
 if(!player.open||event.altKey||event.ctrlKey||event.metaKey)return;
 const target=event.target;
 if(target instanceof HTMLElement&&(target.isContentEditable||["INPUT","TEXTAREA","SELECT","BUTTON"].includes(target.tagName)))return;
 let handled=true;
 switch(event.key){
  case " ":case "k":case "K":
   if(video.paused)video.play().catch(()=>setVideoStatus("Tekan tombol putar untuk melanjutkan.",true));else video.pause();
   break;
  case "ArrowLeft":seekVideoBy(-10);break;
  case "ArrowRight":seekVideoBy(10);break;
  case "ArrowUp":video.volume=Math.min(1,Math.round((video.volume+0.05)*100)/100);video.muted=false;break;
  case "ArrowDown":video.volume=Math.max(0,Math.round((video.volume-0.05)*100)/100);break;
  case "m":case "M":video.muted=!video.muted;break;
  default:handled=false;
 }
 if(handled)event.preventDefault();
});

function updateFullscreenButton(){const btn=$("#fullscreenVideo");if(!btn)return;const active=Boolean(document.fullscreenElement||video.webkitDisplayingFullscreen);btn.textContent=active?"⤢ Keluar layar penuh":"⛶ Layar penuh";btn.setAttribute("aria-pressed",String(active));btn.setAttribute("aria-label",active?"Keluar dari layar penuh":"Tampilkan video layar penuh")}
$("#fullscreenVideo").addEventListener("click",async()=>{try{if(document.fullscreenElement){await document.exitFullscreen()}else if(video.webkitDisplayingFullscreen&&video.webkitExitFullscreen){video.webkitExitFullscreen()}else if(video.requestFullscreen){await video.requestFullscreen()}else if(video.webkitEnterFullscreen){video.webkitEnterFullscreen()}else{setStatus("#shareStatus","Mode layar penuh tidak didukung browser ini.")}}catch(err){setStatus("#shareStatus","Tidak dapat membuka layar penuh: "+(err?.message||"coba lagi"))}updateFullscreenButton()});
document.addEventListener("fullscreenchange",updateFullscreenButton);
video.addEventListener("webkitbeginfullscreen",updateFullscreenButton);
video.addEventListener("webkitendfullscreen",updateFullscreenButton);
function supportsPictureInPicture(){return Boolean((document.pictureInPictureEnabled&&!video.disablePictureInPicture)||typeof video.webkitSetPresentationMode==="function")}
function updatePipButton(){const btn=$("#pipVideo");if(!btn)return;const active=document.pictureInPictureElement===video||video.webkitPresentationMode==="picture-in-picture";btn.hidden=!supportsPictureInPicture();btn.textContent=active?"▣ Tutup video mengambang":"▣ Video mengambang";btn.setAttribute("aria-pressed",String(active));btn.setAttribute("aria-label",active?"Keluar dari video mengambang":"Aktifkan video mengambang")}
$("#pipVideo").addEventListener("click",async()=>{try{if(document.pictureInPictureElement===video){await document.exitPictureInPicture()}else if(video.webkitPresentationMode==="picture-in-picture"){video.webkitSetPresentationMode("inline")}else if(document.pictureInPictureEnabled&&video.requestPictureInPicture){await video.requestPictureInPicture()}else if(typeof video.webkitSetPresentationMode==="function"){video.webkitSetPresentationMode("picture-in-picture")}else{setStatus("#shareStatus","Video mengambang tidak didukung browser ini.")}}catch(err){setStatus("#shareStatus","Tidak dapat mengaktifkan video mengambang: "+(err?.message||"coba lagi"))}updatePipButton()});
video.addEventListener("enterpictureinpicture",updatePipButton);
video.addEventListener("leavepictureinpicture",updatePipButton);
video.addEventListener("webkitpresentationmodechanged",updatePipButton);
updatePipButton();

video.addEventListener("timeupdate",updateSeekTime);
video.addEventListener("timeupdate",()=>saveEpisodeProgress());
video.addEventListener("pause",()=>saveEpisodeProgress(true));
window.addEventListener("pagehide",()=>saveEpisodeProgress(true));
video.addEventListener("loadedmetadata",updateSeekTime);
video.addEventListener("durationchange",updateSeekTime);
$("#prevEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex-1));
function readPlaybackPreferences(){
 const prefs={rate:1,volume:1,muted:false};
 try{
  const rate=Number(localStorage.getItem("tactic-playback-rate"));
  const volume=Number(localStorage.getItem("tactic-playback-volume"));
  if([0.75,1,1.25,1.5,2].includes(rate))prefs.rate=rate;
  if(Number.isFinite(volume)&&volume>=0&&volume<=1)prefs.volume=volume;
  prefs.muted=localStorage.getItem("tactic-playback-muted")==="true";
 }catch{}
 return prefs;
}
function applyPlaybackPreferences(){
 const prefs=readPlaybackPreferences();
 video.playbackRate=prefs.rate;
 video.volume=prefs.volume;
 video.muted=prefs.muted;
 const selector=$("#playbackSpeed");
 if(selector)selector.value=String(prefs.rate);
}
function updateAutoNextButton(){const btn=$("#autoNextToggle");if(!btn)return;btn.textContent="Putar otomatis: "+(autoNextEnabled?"Aktif":"Nonaktif");btn.setAttribute("aria-pressed",String(autoNextEnabled))}
$("#autoNextToggle").addEventListener("click",()=>{autoNextEnabled=!autoNextEnabled;try{localStorage.setItem("tactic-auto-next",String(autoNextEnabled))}catch{}updateAutoNextButton();if(activeDrama)$("#playerDescription").textContent="Episode "+(activeDrama.episodes?.[activeEpisodeIndex]?.episode_number||"")+" · "+(activeEpisodeIndex<(activeDrama.episodes||[]).length-1?(autoNextEnabled?"Putar otomatis aktif":"Putar otomatis nonaktif"):"Ini episode terbaru")});
const playbackSpeed=$("#playbackSpeed");
if(playbackSpeed)playbackSpeed.addEventListener("change",()=>{const rate=Number(playbackSpeed.value);if(![0.75,1,1.25,1.5,2].includes(rate))return;video.playbackRate=rate;try{localStorage.setItem("tactic-playback-rate",String(rate))}catch{}});
video.addEventListener("volumechange",()=>{try{localStorage.setItem("tactic-playback-volume",String(video.volume));localStorage.setItem("tactic-playback-muted",String(video.muted))}catch{}});
applyPlaybackPreferences();
updateAutoNextButton();
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
  const likeCount=Number(countResult.data?.like_count||0);
  btn.dataset.liked=liked?"true":"false";btn.setAttribute("aria-pressed",String(liked));
  btn.textContent=(liked?"♥ Disukai · ":"♡ Suka · ")+likeCount;
  const catalogDrama=dramas.find(item=>String(item.id)===String(dramaId));
  if(catalogDrama&&Number(catalogDrama.like_count||0)!==likeCount){catalogDrama.like_count=likeCount;render()}
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
 $("#creatorProfileForm").elements.displayName.value=String(meta.display_name||"");$("#displayNameCount").textContent=$("#creatorProfileForm").elements.displayName.value.length+"/40 karakter";
 const avatar=$("#creatorAvatar");avatar.src=meta.avatar_url||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='50' fill='%23251e2b'/%3E%3Ctext x='50' y='63' text-anchor='middle' font-size='42' fill='%23e9c58a'%3E"+encodeURIComponent(name.charAt(0).toUpperCase())+"%3C/text%3E%3C/svg%3E";
}
const profileNameInput=$("#creatorProfileForm").elements.displayName,nameCount=$("#displayNameCount"),avatarInput=$("#creatorAvatarInput"),avatarPreviewWrap=$("#avatarPreviewWrap"),avatarPreview=$("#avatarPreview");
profileNameInput.addEventListener("input",()=>{nameCount.textContent=profileNameInput.value.length+"/40 karakter"});
avatarInput.addEventListener("change",()=>{const file=avatarInput.files?.[0];if(!file){avatarPreviewWrap.hidden=true;avatarPreview.removeAttribute("src");return}if(file.size>2*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){avatarPreviewWrap.hidden=true;setStatus("#profileStatus",file.size>2*1024*1024?"Foto profil maksimal 2 MB.":"Foto harus JPG, PNG, atau WebP.");avatarInput.value="";return}avatarPreview.src=URL.createObjectURL(file);avatarPreviewWrap.hidden=false;setStatus("#profileStatus","Pratinjau foto siap. Tekan Simpan profil untuk menerapkan.")});
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
  renderCreatorProfile(updated.data.user||user);avatarPreviewWrap.hidden=true;avatarPreview.removeAttribute("src");form.reset();nameCount.textContent="0/40 karakter";setStatus("#profileStatus","Profil kreator berhasil disimpan.");
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
async function deleteCreatorEpisode(drama,ep,userId){if(!confirm("Hapus episode "+ep.episode_number+" dari drama "+drama.title+"? Video episode ini juga akan dihapus permanen."))return;try{await removeOwnedStorageFiles("drama-videos",[ep.video_path,ep.subtitle_path]);const {error}=await supa.from("episodes").delete().eq("id",ep.id).eq("drama_id",drama.id).eq("uploader_id",userId);if(error)throw error;setStatus("#uploadStatus","Episode "+ep.episode_number+" berhasil dihapus.");await loadCatalog();await loadMyDramas(userId)}catch(err){setStatus("#uploadStatus","Episode belum berhasil dihapus: "+(err?.message||String(err)))}}
async function deleteCreatorDrama(drama,userId){const eps=drama.episodes||[];if(!confirm("Hapus drama “"+drama.title+"” beserta "+eps.length+" episode? Tindakan ini permanen."))return;try{await removeOwnedStorageFiles("drama-videos",eps.flatMap(ep=>[ep.video_path,ep.subtitle_path]));const posterPath=storagePathFromPublicUrl(drama.poster_url,"drama-posters");await removeOwnedStorageFiles("drama-posters",[posterPath]);const {error}=await supa.from("dramas").delete().eq("id",drama.id).eq("uploader_id",userId);if(error)throw error;setStatus("#uploadStatus","Drama dan seluruh episode berhasil dihapus.");if(activeDrama?.id===drama.id){video.pause();video.removeAttribute("src");player.close();activeDrama=null}await loadCatalog();await loadMyDramas(userId)}catch(err){setStatus("#uploadStatus","Drama belum berhasil dihapus: "+(err?.message||String(err))+". Jika file sudah terhapus, muat ulang daftar dan coba periksa kembali.")}}
async function loadMyDramas(userId){const list=$("#myDramaList"),count=$("#creatorCount"),target=$("#targetDrama");if(!list||!supa)return;list.textContent="Memuat drama...";const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,status,created_at,episodes(id,episode_number,title,video_path,subtitle_path,status)").eq("uploader_id",userId).order("created_at",{ascending:false});if(error){list.textContent="Daftar drama belum dapat dimuat: "+error.message;count.textContent="—";return}count.textContent=(data?.length||0)+" drama";await loadCreatorStats(userId);if(target){const selected=target.value;target.innerHTML='<option value="">Buat drama baru</option>';(data||[]).filter(d=>d.status==="approved").forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=d.title;target.append(o)});target.value=selected}list.innerHTML="";if(!data?.length){list.innerHTML='<p class="notice">Kamu belum mengunggah drama. Gunakan formulir unggah di bawah untuk mulai menerbitkan.</p>';return}for(const d of data){const card=document.createElement("article");card.className="creator-item";const info=document.createElement("div");info.className="creator-item-info";const title=document.createElement("strong");title.textContent=d.title;const meta=document.createElement("span");const eps=d.episodes||[];meta.textContent=eps.length+" episode · "+(d.status==="approved"?"Tayang":d.status==="rejected"?"Disembunyikan":"Status: "+d.status);const date=document.createElement("small");date.textContent=d.created_at?new Date(d.created_at).toLocaleDateString("id-ID"):"";info.append(title,meta,date);card.append(info);const edit=document.createElement("button");edit.className="secondary-btn";edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>editCreatorDrama(d,userId));card.append(edit);if(d.status==="approved"&&eps.some(ep=>ep.status==="approved")){const open=document.createElement("button");open.className="secondary-btn";open.type="button";open.textContent="Lihat";open.addEventListener("click",()=>{const published={...d,episodes:eps.filter(ep=>ep.status==="approved"),genre:eps.length+" episode"};admin.close();openDrama(published)});card.append(open)}const remove=document.createElement("button");remove.className="danger-btn";remove.type="button";remove.textContent="Hapus drama";remove.addEventListener("click",()=>deleteCreatorDrama(d,userId));card.append(remove);if(eps.length){const details=document.createElement("details");details.className="creator-episodes";const summary=document.createElement("summary");summary.textContent="Kelola "+eps.length+" episode";details.append(summary);for(const ep of [...eps].sort((x,y)=>x.episode_number-y.episode_number)){const row=document.createElement("div");row.className="creator-episode-row";const label=document.createElement("span");label.textContent="Episode "+ep.episode_number+(ep.title?" · "+ep.title:"");const del=document.createElement("button");del.className="danger-btn";del.type="button";del.textContent="Hapus";del.addEventListener("click",()=>deleteCreatorEpisode(d,ep,userId));const edit=document.createElement("button");edit.className="secondary-btn";edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>editCreatorEpisode(d,ep,userId));row.append(label,edit,del);details.append(row)}card.append(details)}list.append(card)}} 
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.close==="playerDialog"){persistCurrentPlayback();video.pause()}document.getElementById(b.dataset.close).close()}));
player.addEventListener("cancel",()=>{persistCurrentPlayback();video.pause()});
// Password visibility controls for mobile sign-in and registration.
document.querySelectorAll('#adminDialog input[type="password"]').forEach(input=>{
 const wrapper=document.createElement("div");wrapper.className="password-input-wrap";
 input.parentNode.insertBefore(wrapper,input);wrapper.append(input);
 const toggle=document.createElement("button");toggle.type="button";toggle.className="password-toggle";
 toggle.textContent="Tampilkan";toggle.setAttribute("aria-label","Tampilkan password");toggle.setAttribute("aria-pressed","false");
 toggle.addEventListener("click",()=>{
  const visible=input.type==="password";input.type=visible?"text":"password";
  toggle.textContent=visible?"Sembunyikan":"Tampilkan";
  toggle.setAttribute("aria-label",visible?"Sembunyikan password":"Tampilkan password");
  toggle.setAttribute("aria-pressed",String(visible));
 });
 wrapper.append(toggle);
});
$("#resetPasswordForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const form=e.currentTarget,values=new FormData(form),password=String(values.get("password")||""),confirm=String(values.get("confirmPassword")||"");if(password.length<6){setStatus("#loginStatus","Password minimal 6 karakter.");return}if(password!==confirm){setStatus("#loginStatus","Konfirmasi password belum sama.");return}const btn=form.querySelector('button[type="submit"]');btn.disabled=true;setStatus("#loginStatus","Menyimpan password baru...");try{const {data,error}=await supa.auth.updateUser({password});if(error)throw error;form.reset();form.hidden=true;$("#forgotPasswordBtn").hidden=false;setStatus("#loginStatus","Password berhasil diperbarui. Kamu sudah masuk.");await verifySession((await supa.auth.getSession()).data.session)}catch(err){setStatus("#loginStatus","Gagal memperbarui password: "+(err?.message||String(err)))}finally{btn.disabled=false}});
$("#forgotPasswordBtn").addEventListener("click",async()=>{if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const email=$("#loginForm input[name=email]").value.trim();if(!email){setStatus("#loginStatus","Masukkan email pada kolom login terlebih dahulu.");$("#loginForm input[name=email]").focus();return}const btn=$("#forgotPasswordBtn");btn.disabled=true;setStatus("#loginStatus","Mengirim tautan pemulihan password...");try{const {error}=await supa.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;setStatus("#loginStatus","Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam.")}catch(err){setStatus("#loginStatus","Gagal mengirim tautan pemulihan: "+(err?.message||String(err)))}finally{btn.disabled=false}});
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
function updateUploadProgress(percent,visible=true){
 const wrap=$("#uploadProgressWrap"),bar=$("#uploadProgressBar"),label=$("#uploadProgressLabel");
 if(!wrap||!bar||!label)return;
 wrap.hidden=!visible;
 const value=Math.max(0,Math.min(100,Math.round(Number(percent)||0)));
 bar.value=value;bar.setAttribute("aria-valuenow",String(value));label.textContent=value+"%";
}
$("#uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa){setStatus("#uploadStatus","Backend belum dikonfigurasi.");return}
 const {data:sessionData}=await supa.auth.getSession(),session=sessionData.session,user=session?.user;
 if(!user){setStatus("#uploadStatus","Masuk ke akun terlebih dahulu.");return}
 const f=e.currentTarget,data=new FormData(f),file=data.get("video"),subtitleFile=data.get("subtitle"),targetDrama=String(data.get("targetDrama")||""),posterFile=targetDrama?null:data.get("poster"),title=String(data.get("title")||"").trim(),episode=Number(data.get("episode"));
 if(!targetDrama&&!title){setStatus("#uploadStatus","Isi judul drama terlebih dahulu.");return}
 if(!Number.isInteger(episode)||episode<1){setStatus("#uploadStatus","Nomor episode harus bilangan positif.");return}
 if(posterFile&&posterFile.size>10*1024*1024){setStatus("#uploadStatus","Ukuran poster maksimal 10 MB.");return}
 if(posterFile&&!["image/jpeg","image/png","image/webp"].includes(posterFile.type)){setStatus("#uploadStatus","Poster harus JPG, PNG, atau WebP.");return}
 if(!file||!["video/mp4","video/webm","video/quicktime"].includes(file.type)){setStatus("#uploadStatus","Pilih video MP4, WebM, atau MOV.");return}
 if(file.size===0){setStatus("#uploadStatus","File video kosong. Pilih video lain.");return}
 if(file.size>500*1024*1024){setStatus("#uploadStatus","Ukuran video maksimal 500 MB.");return}
 if(subtitleFile&&subtitleFile.size){if(subtitleFile.size>1024*1024){setStatus("#uploadStatus","Ukuran subtitle maksimal 1 MB.");return}if(!/\.vtt$/i.test(subtitleFile.name)){setStatus("#uploadStatus","Subtitle harus menggunakan format .VTT.");return}const subtitleText=await subtitleFile.text();if(!/^WEBVTT(?:\s|$)/.test(subtitleText.replace(/^\uFEFF/,""))){setStatus("#uploadStatus","File subtitle tidak valid. Gunakan format WebVTT yang diawali WEBVTT.");return}}
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
 let dramaId=targetDrama||null,createdDrama=false,videoPath=null,posterPath=null,subtitlePath=null;
 setStatus("#uploadStatus","Menyiapkan unggahan video...");
 try{
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  videoPath=user.id+"/"+crypto.randomUUID()+"-"+safeName;
  if(posterFile&&posterFile.size){
   posterPath=user.id+"/"+crypto.randomUUID()+"-"+posterFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const posterUpload=await supa.storage.from("drama-posters").upload(posterPath,posterFile,{contentType:posterFile.type,upsert:false});
   if(posterUpload.error)throw posterUpload.error;
  }
  updateUploadProgress(0);await uploadVideoResumable(file,videoPath,session,pct=>{updateUploadProgress(pct);setStatus("#uploadStatus","Mengunggah video... "+pct+"% (jangan tutup halaman).")});updateUploadProgress(100);
  if(subtitleFile&&subtitleFile.size){subtitlePath=user.id+"/"+crypto.randomUUID()+"-subtitle.vtt";const subtitleUpload=await supa.storage.from("drama-videos").upload(subtitlePath,subtitleFile,{contentType:"text/vtt",upsert:false});if(subtitleUpload.error)throw subtitleUpload.error}
  setStatus("#uploadStatus","Video selesai diunggah. Menyimpan episode...");
  if(!dramaId){const created=await supa.from("dramas").insert({title,description:String(data.get("description")||""),poster_url:posterPath?supa.storage.from("drama-posters").getPublicUrl(posterPath).data.publicUrl:null,uploader_id:user.id,status:"approved"}).select("id").single();if(created.error)throw created.error;dramaId=created.data.id;createdDrama=true;}else{/* Drama and episode were checked before uploading; keep DB insert as final race-safe validation. */}
  const saved=await supa.from("episodes").insert({drama_id:dramaId,episode_number:episode,title:String(data.get("episodeTitle")||""),video_path:videoPath,subtitle_path:subtitlePath,uploader_id:user.id,status:"approved"});
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
  if(subtitlePath)cleanup.push(supa.storage.from("drama-videos").remove([subtitlePath]));
  if(posterPath)cleanup.push(supa.storage.from("drama-posters").remove([posterPath]));
  const cleanupResults=await Promise.allSettled(cleanup);
  cleanupResults.forEach(result=>{if(result.status==="rejected")console.warn("Pembersihan file unggahan gagal:",result.reason)});
  setStatus("#uploadStatus","Gagal menerbitkan drama: "+(err?.message||String(err))+". File sementara yang sudah terkirim akan dibersihkan jika izin penyimpanan mengizinkan. Periksa koneksi lalu coba lagi.");
 }finally{btn.disabled=false}
});
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(x=>{x.classList.remove("active");x.removeAttribute("aria-current")});b.classList.add("active");b.setAttribute("aria-current","page");activeTab=b.dataset.tab;const historyTools=$("#historyTools");if(historyTools)historyTools.hidden=activeTab!=="history";if(activeTab==="profile"){admin.showModal();return}render();window.scrollTo({top:0,behavior:"smooth"})}));
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

async function copyShareText(text){
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}
 const field=document.createElement("textarea");field.value=text;field.setAttribute("readonly","");field.style.position="fixed";field.style.opacity="0";field.style.pointerEvents="none";document.body.append(field);field.select();field.setSelectionRange(0,field.value.length);let copied=false;try{copied=document.execCommand("copy")}catch{}field.remove();return copied;
}
$("#shareDrama").addEventListener("click",async()=>{if(!activeDrama)return;const shareUrl=new URL(location.href);shareUrl.searchParams.set("drama",String(activeDrama.id));const currentEpisode=activeDrama.episodes?.[activeEpisodeIndex];if(currentEpisode)shareUrl.searchParams.set("episode",String(currentEpisode.episode_number));const shareData={title:activeDrama.title+(currentEpisode?" · Episode "+currentEpisode.episode_number:""),text:"Tonton "+activeDrama.title+(currentEpisode?" episode "+currentEpisode.episode_number:"")+" di TacTic Drama",url:shareUrl.toString()};const copyText=shareData.text+" — "+shareData.url;try{if(navigator.share){await navigator.share(shareData);setStatus("#shareStatus","Menu berbagi berhasil dibuka.")}else if(await copyShareText(copyText))setStatus("#shareStatus","Link episode berhasil disalin. Siap dibagikan!");else setStatus("#shareStatus","Salin link ini secara manual: "+shareData.url)}catch(error){if(error.name==="AbortError")return;if(await copyShareText(copyText))setStatus("#shareStatus","Link episode berhasil disalin sebagai alternatif.");else setStatus("#shareStatus","Link episode: "+shareData.url)}});
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
 uploadForm?.addEventListener("reset",()=>{setTimeout(()=>{updateUploadPreview();updateUploadProgress(0,false)},0)});
 const searchBox=$("#dramaSearch");searchBox.addEventListener("input",()=>{searchQuery=searchBox.value.trim().toLocaleLowerCase("id");render()});$("#clearSearch")?.addEventListener("click",()=>{searchBox.value="";searchQuery="";render();searchBox.focus()});
$("#dramaSort")?.addEventListener("change",render);
$("#reloadCatalog")?.addEventListener("click",()=>loadCatalog());
function updateNetworkStatus(){const el=$("#networkStatus");if(!el)return;const online=navigator.onLine;el.textContent=online?"● Online":"● Offline";el.classList.toggle("is-offline",!online)}
window.addEventListener("online",()=>{updateNetworkStatus();loadCatalog()});window.addEventListener("offline",updateNetworkStatus);updateNetworkStatus();
render();
const cfg=window.TACTIC_SUPABASE_CONFIG||{};
if(window.supabase?.createClient&&cfg.url?.startsWith("https://")&&!cfg.url.includes("YOUR-PROJECT")&&cfg.anonKey&&!cfg.anonKey.includes("YOUR-SUPABASE")){supa=window.supabase.createClient(cfg.url,cfg.anonKey);$("#backendNotice").textContent="Daftar akun untuk mengirim video. Email perlu dikonfirmasi sebelum login jika verifikasi email aktif.";loadCatalog();supa.auth.getSession().then(({data})=>verifySession(data.session));supa.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY"){$("#uploadSection").hidden=true;$("#loginForm").hidden=true;$("#signupForm").hidden=true;$("#forgotPasswordBtn").hidden=true;$("#resetPasswordForm").hidden=false;setStatus("#loginStatus","Tautan pemulihan valid. Silakan buat password baru.")}else{verifySession(session)}})}else{$("#backendNotice").textContent="Koneksi backend belum diisi. Website dan katalog contoh tetap bisa dibuka; upload online aktif setelah konfigurasi Supabase."}
const installBtn=$("#installBtn");
let installPrompt=null;
const isInstalled=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
if(isInstalled())installBtn.hidden=true;
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();installPrompt=event;installBtn.hidden=false;
 installBtn.title="Pasang TacTic Drama";installBtn.setAttribute("aria-label","Pasang TacTic Drama");
});
installBtn.addEventListener("click",async()=>{
 if(!installPrompt){setStatus("#catalogStatus","Untuk memasang aplikasi, buka menu Chrome ⋮ lalu pilih Tambahkan ke layar utama.");return}
 const promptEvent=installPrompt;installPrompt=null;
 try{await promptEvent.prompt();const choice=await promptEvent.userChoice;
  if(choice?.outcome==="accepted")setStatus("#catalogStatus","TacTic Drama sedang dipasang ke layar utama.");
  else setStatus("#catalogStatus","Pemasangan belum dilakukan. Kamu bisa mencoba lagi melalui menu Chrome.");
 }catch(error){setStatus("#catalogStatus","Tidak dapat membuka pemasangan. Gunakan menu Chrome ⋮ lalu Tambahkan ke layar utama.")}
 installBtn.hidden=true;
});
window.addEventListener("appinstalled",()=>{
 installPrompt=null;installBtn.hidden=true;
 setStatus("#catalogStatus","TacTic Drama berhasil dipasang di perangkat ini.");
});
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
