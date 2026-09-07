// ═══════════════════════════════════════════
// SUPABASE WEB BACKEND
// ═══════════════════════════════════════════
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
let currentUser = null

function usernameToEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@kantin-uimsya.local`
}

async function requireSession() {
  const { data, error } = await supabaseClient.auth.getSession()
  if (error || !data.session) {
    window.location.replace('login.html')
    throw new Error('AUTH_REQUIRED')
  }
  currentUser = data.session.user
  return currentUser
}

async function loadRemoteData() {
  const { data, error } = await supabaseClient
    .from('finance_data')
    .select('data')
    .eq('user_id', currentUser.id)
    .maybeSingle()
  if (error) throw error
  return data?.data || { harian:{}, pengeluaran:[], penarikan:[] }
}

async function persistRemoteData(payload) {
  const { error } = await supabaseClient
    .from('finance_data')
    .upsert({ user_id: currentUser.id, data: payload, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' })
  if (error) throw error
}

function downloadText(filename, content, mime='text/csv;charset=utf-8') {
  const blob = new Blob([content], {type:mime})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

'use strict'

// ═══════════════════════════════════════════
// KONSTANTA
// ═══════════════════════════════════════════
const HARI_ID  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember']
const NAMA_TOKO   = 'KANTIN UIMSYA PUTRA'
const ALAMAT_TOKO = 'Sumberkembang, Banyuwangi'

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
// db.harian    = { [YYYY-MM-DD]: { pendapatan1, pendapatan2, titipan1..3, tabungan } }
// db.pengeluaran = [ { id, tgl, keterangan, total } ]
// db.penarikan   = [ { id, tgl, keterangan, jumlah } ]
let db = { harian:{}, pengeluaran:[], penarikan:[] }
let activeBulan = new Date().getMonth() + 1
let activeTahun = new Date().getFullYear()
let activePeriod = 12
let chartD1, chartD2, chartK1, chartK2, chartK3

// ═══════════════════════════════════════════
// FORMAT
// ═══════════════════════════════════════════
const fmt  = v => v ? 'Rp' + Math.abs(Math.round(Number(v))).toLocaleString('id-ID') : 'Rp0'
// Format singkat untuk grafik: >= 1jt pakai JT, >= 1rb pakai rb
function fmtGrafik(v) {
  const n = Math.abs(Math.round(Number(v)))
  if (n >= 1000000) return 'Rp' + (n/1000000).toLocaleString('id-ID', {maximumFractionDigits:1}) + ' JT'
  if (n >= 1000)    return 'Rp' + Math.round(n/1000) + 'rb'
  return 'Rp' + n
}
const num  = v => parseFloat(v) || 0
const isJumat = tgl => new Date(tgl+'T00:00:00').getDay() === 5
const namaHari = tgl => HARI_ID[new Date(tgl+'T00:00:00').getDay()]

function labelTgl(tgl) {
  const d = new Date(tgl+'T00:00:00')
  return `${HARI_ID[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`
}
function labelBulan(b, t) { return `${BULAN_ID[b-1]} ${t}` }
function jumlahHariDlm(b, t) { return new Date(t, b, 0).getDate() }
function semuaHari(b, t) {
  const arr=[], n=jumlahHariDlm(b,t)
  for(let d=1;d<=n;d++) arr.push(`${t}-${String(b).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  return arr
}
function hitungTotal(row) {
  if(!row) return 0
  return num(row.pendapatan1)+num(row.pendapatan2)-num(row.titipan1)-num(row.titipan2)-num(row.titipan3)-num(row.tabungan)
}

// ═══════════════════════════════════════════
// DATA HELPERS
// ═══════════════════════════════════════════
function getHarianBulan(b,t) {
  b=b||activeBulan; t=t||activeTahun
  return semuaHari(b,t).map(tgl=>({tgl, row:db.harian[tgl]||null}))
}
function getPengeluaranBulan(b,t) {
  b=b||activeBulan; t=t||activeTahun
  const pref=`${t}-${String(b).padStart(2,'0')}`
  return (db.pengeluaran||[]).filter(p=>p.tgl&&p.tgl.startsWith(pref)).sort((a,b2)=>a.tgl.localeCompare(b2.tgl))
}
function getTotalTabungan() {
  const setor  = Object.values(db.harian).reduce((s,r)=>s+num(r.tabungan),0)
  const tarik  = (db.penarikan||[]).reduce((s,p)=>s+num(p.jumlah),0)
  return { setor, tarik, saldo: setor-tarik }
}
// Rekap per bulan: { 'YYYY-MM': { pendapatan, titipan, pengeluaran, tabungan, bersih } }
function getRekapBulanan() {
  const map={}
  // Dari data harian
  Object.entries(db.harian).forEach(([tgl,row])=>{
    const key=tgl.slice(0,7)
    if(!map[key]) map[key]={pendapatan:0,titipan:0,pengeluaran:0,tabungan:0,bersih:0}
    if(!isJumat(tgl)){
      map[key].pendapatan += num(row.pendapatan1)+num(row.pendapatan2)
      map[key].titipan    += num(row.titipan1)+num(row.titipan2)+num(row.titipan3)
      map[key].tabungan   += num(row.tabungan)
      map[key].bersih     += hitungTotal(row)
    }
  })
  // Dari pengeluaran
  ;(db.pengeluaran||[]).forEach(p=>{
    const key=p.tgl.slice(0,7)
    if(!map[key]) map[key]={pendapatan:0,titipan:0,pengeluaran:0,tabungan:0,bersih:0,penarikan:0}
    map[key].pengeluaran += num(p.total)
  })
  // Dari penarikan tabungan
  ;(db.penarikan||[]).forEach(p=>{
    const key=p.tgl.slice(0,7)
    if(!map[key]) map[key]={pendapatan:0,titipan:0,pengeluaran:0,tabungan:0,bersih:0,penarikan:0}
    map[key].penarikan += num(p.jumlah)
  })
  return map
}
// N bulan terakhir dari sekarang
function getBulanRange(n) {
  const result=[]
  const now=new Date()
  for(let i=n-1;i>=0;i--){
    const d=new Date(now.getFullYear(), now.getMonth()-i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return result
}

async function saveDB() {
  try {
    await persistRemoteData(db)
    const el=document.getElementById('save-indicator')
    if(el){el.textContent='✓ Tersimpan di Cloud';el.style.color='#059669'}
  } catch(e){
    console.error('Gagal simpan Supabase:',e)
    const el=document.getElementById('save-indicator')
    if(el){el.textContent='⚠ Gagal tersimpan';el.style.color='#dc2626'}
    alert('Data gagal disimpan ke Supabase. Periksa koneksi internet dan konfigurasi Supabase.')
  }
}

// ═══════════════════════════════════════════
// AKUN
// ═══════════════════════════════════════════
async function doLogout() {
  if(!confirm('Keluar dari aplikasi?')) return
  await supabaseClient.auth.signOut()
  window.location.replace('login.html')
}

function showModalGantiPass() {
  document.getElementById('modal-title').textContent='Ganti Password'; document.getElementById('modal-body').innerHTML=`
    <div class="form-group"><label>Password Lama</label><input id="gp-lama" type="password" autocomplete="current-password"></div>
    <div class="form-group"><label>Password Baru</label><input id="gp-baru" type="password" autocomplete="new-password"></div>
    <div class="form-group"><label>Ulangi Password Baru</label><input id="gp-ulangi" type="password" autocomplete="new-password"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-success" onclick="gantiPassword()">Simpan Password</button>
    </div>
  `
  openModal()
}

async function gantiPassword() {
  const lama=document.getElementById('gp-lama').value
  const baru=document.getElementById('gp-baru').value
  const ulang=document.getElementById('gp-ulangi').value
  if(!baru || baru.length<6) return alert('Password baru minimal 6 karakter.')
  if(baru!==ulang) return alert('Konfirmasi password tidak sama.')
  const { error } = await supabaseClient.auth.signInWithPassword({email: currentUser.email, password: lama})
  if(error) return alert('Password lama salah.')
  const { error: updateError } = await supabaseClient.auth.updateUser({password: baru})
  if(updateError) return alert('Gagal mengganti password: '+updateError.message)
  closeModal()
  alert('✅ Password berhasil diganti.')
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function init() {
  await requireSession()
  try {
    const loaded=await loadRemoteData()
    if(loaded&&typeof loaded==='object'){
      db.harian      = loaded.harian      || {}
      db.pengeluaran = loaded.pengeluaran || []
      db.penarikan   = loaded.penarikan   || []
    }
  } catch(e){ console.error('Gagal memuat data:', e); alert('Gagal memuat data dari Supabase.') }

  document.getElementById('tgl-display').textContent =
    new Date().toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'})

  isiSel()

  document.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click',()=>{
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'))
      el.classList.add('active')
      showTab(el.dataset.tab)
    })
  })


  updateLabel()
  renderHarian()
}

// ═══════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('pinned')
}

// ═══════════════════════════════════════════
// SELECTOR BULAN/TAHUN
// ═══════════════════════════════════════════
function isiSel() {
  const tahunNow=new Date().getFullYear()
  ;[['sel-bulan','sel-tahun'],['exp-bulan','exp-tahun']].forEach(([sbId,stId])=>{
    const sb=document.getElementById(sbId), st=document.getElementById(stId)
    if(!sb||!st) return
    sb.innerHTML=BULAN_ID.map((nm,i)=>`<option value="${i+1}" ${i+1===activeBulan?'selected':''}>${nm}</option>`).join('')
    st.innerHTML=[tahunNow-2,tahunNow-1,tahunNow,tahunNow+1].map(y=>`<option value="${y}" ${y===activeTahun?'selected':''}>${y}</option>`).join('')
  })
}

function onBulanChange() {
  activeBulan=parseInt(document.getElementById('sel-bulan').value)
  activeTahun=parseInt(document.getElementById('sel-tahun').value)
  const eb=document.getElementById('exp-bulan'), et=document.getElementById('exp-tahun')
  if(eb) eb.value=activeBulan; if(et) et.value=activeTahun
  updateLabel()
  const aktif=document.querySelector('.tab-section.active')
  if(aktif) showTab(aktif.id.replace('tab-',''))
}

function updateLabel() {
  const lbl=labelBulan(activeBulan,activeTahun)
  const sb=document.getElementById('sb-bulan-aktif')
  const jh=document.getElementById('judul-harian')
  const jp=document.getElementById('judul-pengeluaran')
  if(sb) sb.textContent=lbl
  if(jh) jh.textContent=`Laporan Harian — ${lbl}`
  if(jp) jp.textContent=`Pengeluaran — ${lbl}`
}

// ═══════════════════════════════════════════
// NAVIGASI
// ═══════════════════════════════════════════
const TAB_NAMES={
  harian:'Laporan Harian', pengeluaran:'Pengeluaran', tabungan:'Tabungan',
  dashboard:'Dashboard Bulanan', 'dashboard-kompleks':'Dashboard Kompleks', ekspor:'Ekspor & Cetak'
}
function showTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s=>s.classList.remove('active'))
  const el=document.getElementById('tab-'+tab)
  if(el) el.classList.add('active')
  const tt=document.getElementById('topbar-title')
  if(tt) tt.textContent=TAB_NAMES[tab]||tab
  if(tab==='harian')              renderHarian()
  if(tab==='pengeluaran')         renderPengeluaran()
  if(tab==='tabungan')            renderTabungan()
  if(tab==='dashboard')           renderDashboard()
  if(tab==='dashboard-kompleks')  renderDashboardKompleks()
  if(tab==='ekspor')              renderEkspor()
}

// ═══════════════════════════════════════════
// RENDER HARIAN
// ═══════════════════════════════════════════
function renderHarian() {
  const days=getHarianBulan()
  const tbody=document.getElementById('tbody-harian')
  const tfoot=document.getElementById('tfoot-harian')
  if(!tbody||!tfoot) return
  let tP1=0,tP2=0,tT1=0,tT2=0,tT3=0,tTab=0,tTotal=0

  tbody.innerHTML=days.map(({tgl,row})=>{
    if(isJumat(tgl)) return `<tr class="row-jumat"><td class="td-tgl">${labelTgl(tgl)}</td><td colspan="7" style="text-align:center">— LIBUR JUMAT —</td><td></td></tr>`
    if(!row) return `<tr class="row-kosong"><td class="td-tgl">${labelTgl(tgl)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="td-total">—</td><td><button class="btn btn-outline btn-sm" onclick="showModalEdit('${tgl}')">✎</button></td></tr>`
    const total=hitungTotal(row)
    tP1+=num(row.pendapatan1); tP2+=num(row.pendapatan2)
    tT1+=num(row.titipan1); tT2+=num(row.titipan2); tT3+=num(row.titipan3)
    tTab+=num(row.tabungan); tTotal+=total
    return `<tr>
      <td class="td-tgl">${labelTgl(tgl)}</td>
      <td>${row.pendapatan1?fmt(row.pendapatan1):'—'}</td>
      <td>${row.pendapatan2?fmt(row.pendapatan2):'—'}</td>
      <td>${row.titipan1?fmt(row.titipan1):'—'}</td>
      <td>${row.titipan2?fmt(row.titipan2):'—'}</td>
      <td>${row.titipan3?fmt(row.titipan3):'—'}</td>
      <td>${row.tabungan?fmt(row.tabungan):'—'}</td>
      <td class="td-total" style="color:${total>=0?'#166534':'#dc2626'}">${fmt(total)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showModalEdit('${tgl}')">✎</button></td>
    </tr>`
  }).join('')
  tfoot.innerHTML=`<tr><td>TOTAL</td><td>${fmt(tP1)}</td><td>${fmt(tP2)}</td><td>${fmt(tT1)}</td><td>${fmt(tT2)}</td><td>${fmt(tT3)}</td><td>${fmt(tTab)}</td><td class="td-total-foot">${fmt(tTotal)}</td><td></td></tr>`
}

// ═══════════════════════════════════════════
// RENDER PENGELUARAN
// ═══════════════════════════════════════════
function renderPengeluaran() {
  const list=getPengeluaranBulan()
  const tbody=document.getElementById('tbody-pengeluaran')
  const tfoot=document.getElementById('tfoot-pengeluaran')
  if(!tbody||!tfoot) return
  const total=list.reduce((s,p)=>s+num(p.total),0)
  tbody.innerHTML=!list.length
    ?`<tr><td colspan="4" class="empty">Belum ada pengeluaran bulan ini</td></tr>`
    :list.map(p=>`<tr><td class="td-tgl">${labelTgl(p.tgl)}</td><td class="td-ket">${p.keterangan}</td><td class="td-total" style="color:#dc2626">${fmt(p.total)}</td><td><button class="btn btn-outline btn-sm" onclick="hapusPengeluaran('${p.id}')">🗑</button></td></tr>`).join('')
  tfoot.innerHTML=`<tr><td colspan="2">TOTAL PENGELUARAN</td><td class="td-total-foot">${fmt(total)}</td><td></td></tr>`
}

// ═══════════════════════════════════════════
// RENDER TABUNGAN + PENARIKAN
// ═══════════════════════════════════════════
function renderTabungan() {
  const {setor,tarik,saldo}=getTotalTabungan()
  const sv=document.getElementById('tab-saldo-val')
  const ttr=document.getElementById('tab-tarik-val')
  if(sv) sv.textContent=fmt(saldo)
  if(ttr) ttr.textContent=fmt(tarik)

  // Rekap per bulan
  const rekapBulan={}
  Object.entries(db.harian).forEach(([tgl,row])=>{
    const tab=num(row.tabungan); if(!tab) return
    const key=tgl.slice(0,7)
    rekapBulan[key]=(rekapBulan[key]||0)+tab
  })
  const rekapEl=document.getElementById('tabungan-rekap')
  if(rekapEl){
    const sorted=Object.entries(rekapBulan).sort().reverse()
    const totalSetor=sorted.reduce((s,[,v])=>s+v,0)
    rekapEl.innerHTML=sorted.length
      ?sorted.map(([key,val])=>{
          const [y,m]=key.split('-')
          return `<div class="rata-item"><span>${BULAN_ID[parseInt(m)-1]} ${y}</span><span class="rata-val c-blue">${fmt(val)}</span></div>`
        }).join('')+`<div class="rata-item" style="font-weight:700;border-top:2px solid #e5e7eb;padding-top:10px;margin-top:4px;"><span>Saldo Aktif</span><span class="c-blue">${fmt(getTotalTabungan().saldo)}</span></div>`
      :'<div class="empty">Belum ada tabungan</div>'
  }

  // Riwayat penarikan
  const penarikanList=document.getElementById('penarikan-list')
  if(penarikanList){
    const sorted=(db.penarikan||[]).slice().sort((a,b)=>b.tgl.localeCompare(a.tgl))
    penarikanList.innerHTML=!sorted.length
      ?'<div class="empty">Belum ada penarikan</div>'
      :sorted.map(p=>`<div class="penarikan-item">
          <div><div class="penarikan-ket">${p.keterangan}</div><div class="penarikan-tgl">${labelTgl(p.tgl)}</div></div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="penarikan-val">−${fmt(p.jumlah)}</span>
            <button class="penarikan-del" onclick="hapusPenarikan('${p.id}')">✕</button>
          </div>
        </div>`).join('')
  }

  // Detail harian bulan aktif — gabungkan setoran & penarikan, sort per tanggal
  const days=getHarianBulan()
  const prefBulan=`${activeTahun}-${String(activeBulan).padStart(2,'0')}`

  // Akumulasi dari bulan-bulan sebelumnya (setoran - penarikan)
  let akum=0
  Object.entries(db.harian)
    .filter(([tgl])=>tgl<prefBulan+'-01')
    .forEach(([,row])=>{akum+=num(row.tabungan)})
  ;(db.penarikan||[]).filter(p=>p.tgl<prefBulan+'-01').forEach(p=>{akum-=num(p.jumlah)})

  // Kumpulkan semua event tabungan bulan ini (setoran + penarikan), sort tgl
  const events=[]
  days.forEach(({tgl,row})=>{ if(row&&num(row.tabungan)>0) events.push({tgl,tipe:'setor',jumlah:num(row.tabungan),ket:'Tabungan harian'}) })
  ;(db.penarikan||[]).filter(p=>p.tgl.startsWith(prefBulan)).forEach(p=>{ events.push({tgl:p.tgl,tipe:'tarik',jumlah:num(p.jumlah),ket:p.keterangan}) })
  events.sort((a,b)=>a.tgl.localeCompare(b.tgl))

  const tbody=document.getElementById('tbody-tabungan')
  if(!tbody) return
  if(!events.length){
    tbody.innerHTML=`<tr><td colspan="5" class="empty">Tidak ada transaksi tabungan bulan ini</td></tr>`
    return
  }
  tbody.innerHTML=events.map(ev=>{
    if(ev.tipe==='setor') akum+=ev.jumlah
    else akum-=ev.jumlah
    const warna=ev.tipe==='setor'?'#166534':'#dc2626'
    const tanda=ev.tipe==='setor'?'+':'-'
    const badge=ev.tipe==='setor'
      ?`<span style="background:#dbeafe;color:#166534;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">SETOR</span>`
      :`<span style="background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">TARIK</span>`
    return `<tr>
      <td class="td-tgl">${ev.tgl}</td>
      <td class="td-ket">${namaHari(ev.tgl)}</td>
      <td class="td-ket">${ev.ket} ${badge}</td>
      <td style="text-align:right;color:${warna};font-weight:700">${tanda}${fmt(ev.jumlah)}</td>
      <td class="td-total" style="color:${akum>=0?'#166534':'#dc2626'}">${fmt(akum)}</td>
    </tr>`
  }).join('')
}

// ═══════════════════════════════════════════
// RENDER DASHBOARD BULANAN
// ═══════════════════════════════════════════
function renderDashboard() {
  const days=getHarianBulan()
  const peng=getPengeluaranBulan()
  let tKotor=0,tBersih=0,tTab=0,hKerja=0

  days.forEach(({tgl,row})=>{
    if(isJumat(tgl)||!row) return
    hKerja++
    tKotor+=num(row.pendapatan1)+num(row.pendapatan2)
    tTab+=num(row.tabungan)
    tBersih+=hitungTotal(row)
  })
  // tPendHarian = jumlah TOTAL bersih harian (hasil rumus P1+P2-T1-T2-T3-Tab)
  const tPendHarian = tBersih
  const tPeng=peng.reduce((s,p)=>s+num(p.total),0)
  const laba=tBersih-tPeng
  const rataP=hKerja?Math.round(tPendHarian/hKerja):0
  const rataK=peng.length?Math.round(tPeng/peng.length):0

  const mc=document.getElementById('metric-cards')
  if(mc) mc.innerHTML=`
    <div class="metric"><div class="metric-label">💰 Total Pendapatan Harian</div><div class="metric-value c-green">${fmt(tPendHarian)}</div><div class="metric-delta">${hKerja} hari kerja</div></div>
    <div class="metric"><div class="metric-label">📤 Pengeluaran</div><div class="metric-value c-red">${fmt(tPeng)}</div><div class="metric-delta">${peng.length} item</div></div>
    <div class="metric"><div class="metric-label">📈 Laba Bersih</div><div class="metric-value ${laba>=0?'c-blue':'c-red'}">${fmt(laba)}</div><div class="metric-delta">Setelah pengeluaran</div></div>
    <div class="metric"><div class="metric-label">🏦 Tabungan</div><div class="metric-value c-navy">${fmt(tTab)}</div><div class="metric-delta">Bulan ini</div></div>`

  renderDashChart()

  // Rata-rata pendapatan harian per kategori
  const byHari={} // { 'YYYY-MM-DD': total }
  days.forEach(({tgl,row})=>{
    if(isJumat(tgl)||!row) return
    byHari[tgl]=(byHari[tgl]||0)+hitungTotal(row)
  })
  const nilaiHari=Object.values(byHari)
  const tertinggiP=nilaiHari.length?Math.max(...nilaiHari):0
  const terendahP=nilaiHari.length?Math.min(...nilaiHari):0

  const rataP_el=document.getElementById('rata-pendapatan')
  if(rataP_el) rataP_el.innerHTML=`
    <div class="rata-item"><span>Rata-rata per hari</span><span class="rata-val c-green">${fmt(rataP)}</span></div>
    <div class="rata-item"><span>Hari tertinggi</span><span class="rata-val c-green">${fmt(tertinggiP)}</span></div>
    <div class="rata-item"><span>Hari terendah</span><span class="rata-val c-red">${fmt(terendahP)}</span></div>
    <div class="rata-item"><span>Total hari tercatat</span><span class="rata-val">${nilaiHari.length} hari</span></div>
    <div class="rata-item"><span>Total pendapatan harian</span><span class="rata-val c-green">${fmt(tPendHarian)}</span></div>`

  // Rata-rata pengeluaran
  const nilaiPeng=peng.map(p=>num(p.total))
  const tertinggiK=nilaiPeng.length?Math.max(...nilaiPeng):0
  const terendahK=nilaiPeng.length?Math.min(...nilaiPeng):0

  const rataK_el=document.getElementById('rata-pengeluaran')
  if(rataK_el) rataK_el.innerHTML=`
    <div class="rata-item"><span>Rata-rata per transaksi</span><span class="rata-val c-red">${fmt(rataK)}</span></div>
    <div class="rata-item"><span>Pengeluaran tertinggi</span><span class="rata-val c-red">${fmt(tertinggiK)}</span></div>
    <div class="rata-item"><span>Pengeluaran terendah</span><span class="rata-val c-orange">${fmt(terendahK)}</span></div>
    <div class="rata-item"><span>Total transaksi</span><span class="rata-val">${peng.length} item</span></div>
    <div class="rata-item"><span>Total pengeluaran bulan ini</span><span class="rata-val c-red">${fmt(tPeng)}</span></div>`
}

function renderDashChart() {
  const days=getHarianBulan()
  const peng=getPengeluaranBulan()
  const type=document.getElementById('dash-chart-type')?.value||'bar'
  const labels=[], vals=[]
  days.forEach(({tgl,row})=>{
    if(isJumat(tgl)) return
    labels.push(new Date(tgl+'T00:00:00').getDate())
    vals.push(row?hitungTotal(row):0)
  })

  const ctx1=document.getElementById('dashChart')
  if(ctx1){
    if(chartD1) chartD1.destroy()
    chartD1=new Chart(ctx1,{type,
      data:{labels,datasets:[{label:'Bersih Harian',data:vals,
        borderColor:'#166534',backgroundColor:type==='line'?'rgba(34,197,94,0.07)':'rgba(22,101,52,0.75)',
        tension:.3,fill:type==='line',pointRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{ticks:{font:{size:10}}},y:{ticks:{callback:v=>fmtGrafik(v),font:{size:10}}}}}})
  }

  const tK=days.reduce((s,{tgl,row})=>{if(!row||isJumat(tgl))return s;return s+num(row.pendapatan1)+num(row.pendapatan2)},0)
  const tP=peng.reduce((s,p)=>s+num(p.total),0)
  const ctx2=document.getElementById('dashChart2')
  if(ctx2){
    if(chartD2) chartD2.destroy()
    chartD2=new Chart(ctx2,{type:'bar',
      data:{labels:['Pend. Kotor','Pengeluaran'],datasets:[{data:[tK,tP],
        backgroundColor:['rgba(22,101,52,0.8)','rgba(220,38,38,0.75)'],borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{y:{ticks:{callback:v=>fmtGrafik(v),font:{size:10}}}}}})
  }
}

// ═══════════════════════════════════════════
// RENDER DASHBOARD KOMPLEKS
// ═══════════════════════════════════════════
function setPeriod(n) {
  activePeriod=n
  document.querySelectorAll('.btn-period').forEach(b=>b.classList.remove('active-period'))
  const el=document.getElementById('p-'+n)
  if(el) el.classList.add('active-period')
  renderDashboardKompleks()
}

function renderDashboardKompleks() {
  const bulanRange=getBulanRange(activePeriod)
  const rekap=getRekapBulanan()

  const labels=bulanRange.map(key=>{
    const[y,m]=key.split('-')
    return `${BULAN_ID[parseInt(m)-1].slice(0,3)} '${y.slice(2)}`
  })
  const dataPend  = bulanRange.map(k=>(rekap[k]||{}).bersih||0)  // Total pendapatan harian (bersih dari rumus)
  const dataPeng  = bulanRange.map(k=>(rekap[k]||{}).pengeluaran||0)
  const dataTab   = bulanRange.map(k=>(rekap[k]||{}).tabungan||0)
  const dataLaba  = bulanRange.map(k=>((rekap[k]||{}).bersih||0)-((rekap[k]||{}).pengeluaran||0))

  // Chart 1: Pendapatan vs Pengeluaran (main)
  const ctx1=document.getElementById('kompChart1')
  if(ctx1){
    if(chartK1) chartK1.destroy()
    chartK1=new Chart(ctx1,{type:'bar',
      data:{labels,datasets:[
        {label:'Total Pend. Harian',data:dataPend,backgroundColor:'rgba(5,150,105,0.75)',borderRadius:4},
        {label:'Pengeluaran',data:dataPeng,backgroundColor:'rgba(220,38,38,0.7)',borderRadius:4},
        {label:'Laba Bersih',data:dataLaba,type:'line',borderColor:'#166534',backgroundColor:'rgba(34,197,94,0.12)',tension:.4,fill:true,pointRadius:4,yAxisID:'y'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{font:{size:11},boxWidth:12}}},
        scales:{x:{ticks:{font:{size:10},maxRotation:45}},y:{ticks:{callback:v=>fmtGrafik(v),font:{size:10}}}}}})
  }

  // Chart 2: Laba/Rugi per bulan (bar merah/hijau)
  const ctx2=document.getElementById('kompChart2')
  if(ctx2){
    if(chartK2) chartK2.destroy()
    chartK2=new Chart(ctx2,{type:'bar',
      data:{labels,datasets:[{label:'Laba Bersih',data:dataLaba,
        backgroundColor:dataLaba.map(v=>v>=0?'rgba(5,150,105,0.8)':'rgba(220,38,38,0.75)'),borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{ticks:{font:{size:10},maxRotation:45}},y:{ticks:{callback:v=>fmtGrafik(v),font:{size:10}}}}}})
  }

  // Chart 3: Tren tabungan (area)
  let cumTab=0
  const dataTabCum=bulanRange.map(k=>{ cumTab+=(rekap[k]||{}).tabungan||0; return cumTab })
  const ctx3=document.getElementById('kompChart3')
  if(ctx3){
    if(chartK3) chartK3.destroy()
    chartK3=new Chart(ctx3,{type:'line',
      data:{labels,datasets:[
        {label:'Tab. Bulanan',data:dataTab,borderColor:'#166534',backgroundColor:'rgba(34,197,94,0.08)',tension:.3,fill:true,pointRadius:3},
        {label:'Akumulasi',data:dataTabCum,borderColor:'#059669',backgroundColor:'rgba(5,150,105,0.06)',tension:.3,fill:true,pointRadius:3}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:11},boxWidth:10}}},
        scales:{x:{ticks:{font:{size:10},maxRotation:45}},y:{ticks:{callback:v=>fmtGrafik(v),font:{size:10}}}}}})
  }

  // Metrics total periode
  const totPend=dataPend.reduce((s,v)=>s+v,0)
  const totPeng=dataPeng.reduce((s,v)=>s+v,0)
  const totLaba=dataLaba.reduce((s,v)=>s+v,0)
  const totTab2=dataTab.reduce((s,v)=>s+v,0)
  const km=document.getElementById('komp-metrics')
  if(km){
    km.style.gridTemplateColumns='repeat(4,1fr)'
    km.innerHTML=`
    <div class="metric"><div class="metric-label">💰 Total Pend. Harian</div><div class="metric-value c-green">${fmt(totPend)}</div><div class="metric-delta">${activePeriod} bulan</div></div>
    <div class="metric"><div class="metric-label">📤 Total Pengeluaran</div><div class="metric-value c-red">${fmt(totPeng)}</div><div class="metric-delta">${activePeriod} bulan</div></div>
    <div class="metric"><div class="metric-label">📈 Total Laba Bersih</div><div class="metric-value ${totLaba>=0?'c-blue':'c-red'}">${fmt(totLaba)}</div><div class="metric-delta">${activePeriod} bulan</div></div>
    <div class="metric"><div class="metric-label">🏦 Total Tabungan</div><div class="metric-value c-navy">${fmt(totTab2)}</div><div class="metric-delta">${activePeriod} bulan</div></div>`
  }

  // Tabel rekap bulanan
  const tbody=document.getElementById('tbody-komp')
  const tfoot=document.getElementById('tfoot-komp')
  if(tbody) tbody.innerHTML=bulanRange.map(key=>{
    const r=rekap[key]||{pendapatan:0,titipan:0,pengeluaran:0,tabungan:0,bersih:0,penarikan:0}
    const laba2=r.bersih-r.pengeluaran
    const tabAktif=r.tabungan-r.penarikan
    const[y,m]=key.split('-')
    return `<tr>
      <td class="td-tgl" style="text-align:left;padding-left:12px">${BULAN_ID[parseInt(m)-1]} ${y}</td>
      <td class="td-total" style="color:#059669">${fmt(r.bersih)}</td>
      <td style="text-align:right;color:#dc2626">${fmt(r.pengeluaran)}</td>
      <td style="text-align:right;color:#166534">${fmt(tabAktif>=0?tabAktif:0)}</td>
      <td class="td-total" style="color:${laba2>=0?'#166534':'#dc2626'}">${fmt(laba2)}</td>
    </tr>`
  }).join('')
  const totTabAktif=bulanRange.reduce((s,k)=>{ const r=rekap[k]||{}; return s+(r.tabungan||0)-(r.penarikan||0) },0)
  if(tfoot) tfoot.innerHTML=`<tr>
    <td style="text-align:left">TOTAL ${activePeriod} BULAN</td>
    <td class="td-total-foot" style="color:#86efac">${fmt(totPend)}</td>
    <td style="text-align:right;color:#fca5a5">${fmt(totPeng)}</td>
    <td style="text-align:right;color:#86efac">${fmt(totTabAktif>=0?totTabAktif:0)}</td>
    <td class="td-total-foot">${fmt(totLaba)}</td>
  </tr>`
}

// ═══════════════════════════════════════════
// RENDER EKSPOR
// ═══════════════════════════════════════════
function renderEkspor() {
  const eb=document.getElementById('exp-bulan'), et=document.getElementById('exp-tahun')
  if(eb) eb.value=activeBulan; if(et) et.value=activeTahun
  const b=activeBulan, t=activeTahun
  const days=getHarianBulan(b,t), peng=getPengeluaranBulan(b,t)
  let tK=0,tB=0
  days.forEach(({tgl,row})=>{ if(!row||isJumat(tgl))return; tK+=num(row.pendapatan1)+num(row.pendapatan2); tB+=hitungTotal(row) })
  const tP=peng.reduce((s,p)=>s+num(p.total),0)
  const lbl=labelBulan(b,t)
  const ci1=document.getElementById('cetak-info-p')
  if(ci1) ci1.innerHTML=`<b>Periode:</b> ${lbl}<br>Pend. Kotor: <b>${fmt(tK)}</b> | Bersih: <b>${fmt(tB)}</b>`
  const ci2=document.getElementById('cetak-info-k')
  if(ci2) ci2.innerHTML=`<b>Periode:</b> ${lbl}<br>${peng.length} item | Total: <b>${fmt(tP)}</b>`
  renderDataInfo()
}

function renderDataInfo() {
  const el=document.getElementById('data-info')
  if(el) el.textContent=`${Object.keys(db.harian).length} hari tercatat, ${(db.pengeluaran||[]).length} pengeluaran, ${(db.penarikan||[]).length} penarikan tabungan tersimpan.`
}

// ═══════════════════════════════════════════
// MODAL TAMBAH
// ═══════════════════════════════════════════
function showModalTambah() {
  document.getElementById('modal-title').textContent='Tambah Data'
  document.getElementById('modal-body').innerHTML=`
    <div class="form-group" style="margin-bottom:14px;">
      <label>Jenis Data</label>
      <select id="m-tipe" onchange="renderModalForm()" style="padding:8px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;background:#fff;color:#111827;">
        <option value="harian">Data Harian (Pendapatan)</option>
        <option value="pengeluaran">Pengeluaran</option>
        <option value="penarikan">Penarikan Tabungan</option>
      </select>
    </div>
    <div id="m-form"></div>`
  openModal()
  renderModalForm()
}

function showModalEdit(tgl) {
  document.getElementById('modal-title').textContent=`Edit — ${labelTgl(tgl)}`
  document.getElementById('modal-body').innerHTML=`<div id="m-form"></div>`
  openModal()
  renderFormHarian(tgl,true)
}

function showModalTarik() {
  document.getElementById('modal-title').textContent='Penarikan Tabungan'
  const {saldo}=getTotalTabungan()
  document.getElementById('modal-body').innerHTML=`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:13px;">
      Saldo tabungan saat ini: <b style="color:#166534">${fmt(saldo)}</b>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Tanggal Penarikan</label><input type="date" id="m-tarik-tgl" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div class="form-group"><label>Jumlah Penarikan (Rp)</label><input type="number" id="m-tarik-jml" placeholder="0" min="0"/></div>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Keterangan</label>
      <input type="text" id="m-tarik-ket" placeholder="Contoh: Belanja bulanan, Keperluan sekolah..."/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPenarikan()">✓ Simpan Penarikan</button>
    </div>`
  openModal()
}

function renderModalForm() {
  const tipe=document.getElementById('m-tipe')?.value||'harian'
  if(tipe==='harian')      renderFormHarian(null,false)
  else if(tipe==='pengeluaran') renderFormPengeluaran()
  else if(tipe==='penarikan')   renderFormPenarikan()
}

function renderFormHarian(fixedTgl,isEdit) {
  const today=new Date().toISOString().slice(0,10)
  const tgl=fixedTgl||today
  const row=db.harian[tgl]||{}
  const jumat=isJumat(tgl)
  const area=document.getElementById('m-form')
  if(!area) return
  area.innerHTML=`
    ${!fixedTgl?`<div class="form-group" style="margin-bottom:12px;"><label>Tanggal</label><input type="date" id="m-tgl" value="${today}" onchange="onGantiTgl(this.value)"/></div>`:''}
    ${jumat
      ?`<div style="text-align:center;padding:18px;background:#fef9c3;border-radius:8px;color:#854d0e;font-weight:600;">⚠️ Hari Jumat adalah hari libur</div>`
      :`<div class="form-note">Total = (Pend. I + Pend. II) − Titipan I − Titipan II − Titipan III − Tabungan</div>
        <div class="form-grid">
          <div class="form-group"><label>Pendapatan I (Rp)</label><input type="number" id="m-p1" placeholder="0" min="0" value="${row.pendapatan1||''}" oninput="updatePreview()"/></div>
          <div class="form-group"><label>Pendapatan II (Rp)</label><input type="number" id="m-p2" placeholder="0" min="0" value="${row.pendapatan2||''}" oninput="updatePreview()"/></div>
          <div class="form-group"><label>Titipan I (Rp)</label><input type="number" id="m-t1" placeholder="0" min="0" value="${row.titipan1||''}" oninput="updatePreview()"/></div>
          <div class="form-group"><label>Titipan II (Rp)</label><input type="number" id="m-t2" placeholder="0" min="0" value="${row.titipan2||''}" oninput="updatePreview()"/></div>
          <div class="form-group"><label>Titipan III (Rp)</label><input type="number" id="m-t3" placeholder="0" min="0" value="${row.titipan3||''}" oninput="updatePreview()"/></div>
          <div class="form-group"><label>Tabungan Harian (Rp)</label><input type="number" id="m-tab" placeholder="0" min="0" value="${row.tabungan||''}" oninput="updatePreview()"/></div>
        </div>
        <div class="preview-total" id="m-preview">Total Bersih: —</div>
        <div class="modal-footer">
          ${isEdit&&db.harian[tgl]?`<button class="btn btn-danger" onclick="hapusHarian('${tgl}')">🗑 Hapus</button>`:''}
          <button class="btn btn-outline" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="simpanHarian('${fixedTgl||''}')">💾 Simpan</button>
        </div>`
    }`
  if(!jumat) updatePreview()
}

function onGantiTgl(tgl) {
  if(!tgl) return
  const row=db.harian[tgl]||{}
  const keys=['pendapatan1','pendapatan2','titipan1','titipan2','titipan3','tabungan']
  const ids=['m-p1','m-p2','m-t1','m-t2','m-t3','m-tab']
  ids.forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.value=row[keys[i]]||'' })
  updatePreview()
}

function updatePreview() {
  const p1=num(document.getElementById('m-p1')?.value)
  const p2=num(document.getElementById('m-p2')?.value)
  const t1=num(document.getElementById('m-t1')?.value)
  const t2=num(document.getElementById('m-t2')?.value)
  const t3=num(document.getElementById('m-t3')?.value)
  const tab=num(document.getElementById('m-tab')?.value)
  const total=(p1+p2)-t1-t2-t3-tab
  const el=document.getElementById('m-preview')
  if(el) el.textContent=`Total Bersih: ${fmt(total)}${total<0?' ⚠️ minus':''}`
}

function renderFormPengeluaran() {
  const today=new Date().toISOString().slice(0,10)
  const area=document.getElementById('m-form')
  if(!area) return
  area.innerHTML=`
    <div class="form-grid">
      <div class="form-group"><label>Tanggal</label><input type="date" id="m-tgl-p" value="${today}"/></div>
      <div class="form-group"><label>Total (Rp)</label><input type="number" id="m-tot-p" placeholder="0" min="0"/></div>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Keterangan</label>
      <input type="text" id="m-ket-p" placeholder="Contoh: Tinta Epson, Kresek, Gaji..."/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPengeluaran()">💾 Simpan</button>
    </div>`
}

function renderFormPenarikan() {
  const today=new Date().toISOString().slice(0,10)
  const {saldo}=getTotalTabungan()
  const area=document.getElementById('m-form')
  if(!area) return
  area.innerHTML=`
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:11px 14px;margin-bottom:12px;font-size:13px;">
      Saldo tabungan saat ini: <b style="color:#166534">${fmt(saldo)}</b>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Tanggal Penarikan</label><input type="date" id="m-tarik-tgl" value="${today}"/></div>
      <div class="form-group"><label>Jumlah Penarikan (Rp)</label><input type="number" id="m-tarik-jml" placeholder="0" min="0"/></div>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label>Keterangan</label>
      <input type="text" id="m-tarik-ket" placeholder="Contoh: Belanja bulanan, Keperluan sekolah..."/>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPenarikan()">✓ Simpan Penarikan</button>
    </div>`
}

function openModal()  { document.getElementById('modal').classList.add('open'); document.getElementById('modal-overlay').classList.add('open') }
function closeModal() { document.getElementById('modal').classList.remove('open'); document.getElementById('modal-overlay').classList.remove('open') }

// ═══════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════
async function simpanHarian(fixedTgl) {
  const tgl=fixedTgl||document.getElementById('m-tgl')?.value
  if(!tgl){alert('Pilih tanggal.');return}
  if(isJumat(tgl)){alert('Hari Jumat libur.');return}
  db.harian[tgl]={
    pendapatan1:num(document.getElementById('m-p1')?.value),
    pendapatan2:num(document.getElementById('m-p2')?.value),
    titipan1:num(document.getElementById('m-t1')?.value),
    titipan2:num(document.getElementById('m-t2')?.value),
    titipan3:num(document.getElementById('m-t3')?.value),
    tabungan:num(document.getElementById('m-tab')?.value),
  }
  await saveDB(); closeModal(); renderHarian()
}

async function hapusHarian(tgl) {
  const ok=window.confirm(`Hapus data ${labelTgl(tgl)}?`)
  if(!ok) return
  delete db.harian[tgl]; await saveDB(); closeModal(); renderHarian()
}

async function simpanPengeluaran() {
  const tgl=document.getElementById('m-tgl-p')?.value
  const tot=num(document.getElementById('m-tot-p')?.value)
  const ket=document.getElementById('m-ket-p')?.value.trim()
  if(!tgl||!ket||tot<=0){alert('Isi tanggal, keterangan, dan total.');return}
  if(!db.pengeluaran) db.pengeluaran=[]
  db.pengeluaran.push({id:Date.now().toString(),tgl,keterangan:ket,total:tot})
  db.pengeluaran.sort((a,b)=>a.tgl.localeCompare(b.tgl))
  await saveDB(); closeModal(); renderPengeluaran()
}

async function hapusPengeluaran(id) {
  const ok=window.confirm('Hapus pengeluaran ini?')
  if(!ok) return
  db.pengeluaran=(db.pengeluaran||[]).filter(p=>p.id!==id)
  await saveDB(); renderPengeluaran()
}

async function simpanPenarikan() {
  const tgl=document.getElementById('m-tarik-tgl')?.value
  const jml=num(document.getElementById('m-tarik-jml')?.value)
  const ket=document.getElementById('m-tarik-ket')?.value.trim()
  if(!tgl||!ket||jml<=0){alert('Isi tanggal, keterangan, dan jumlah.');return}
  const {saldo}=getTotalTabungan()
  if(jml>saldo){alert(`Saldo tidak cukup! Saldo: ${fmt(saldo)}`);return}
  if(!db.penarikan) db.penarikan=[]
  db.penarikan.push({id:Date.now().toString(),tgl,keterangan:ket,jumlah:jml})
  db.penarikan.sort((a,b)=>a.tgl.localeCompare(b.tgl))
  await saveDB(); closeModal(); renderTabungan()
}

async function hapusPenarikan(id) {
  const ok=window.confirm('Hapus riwayat penarikan ini?')
  if(!ok) return
  db.penarikan=(db.penarikan||[]).filter(p=>p.id!==id)
  await saveDB(); renderTabungan()
}

// ═══════════════════════════════════════════
// EKSPOR CSV
// ═══════════════════════════════════════════
async function eksporHarianCSV(fromEkspor) {
  const b=fromEkspor?parseInt(document.getElementById('exp-bulan').value):activeBulan
  const t=fromEkspor?parseInt(document.getElementById('exp-tahun').value):activeTahun
  const days=getHarianBulan(b,t)
  let csv='Tanggal,Hari,Pendapatan I,Pendapatan II,Titipan I,Titipan II,Titipan III,Tabungan,TOTAL\n'
  days.forEach(({tgl,row})=>{
    if(isJumat(tgl)){csv+=`"${labelTgl(tgl)}",Jumat,LIBUR,,,,,,\n`;return}
    if(!row){csv+=`"${labelTgl(tgl)}",${namaHari(tgl)},,,,,,,\n`;return}
    csv+=`"${labelTgl(tgl)}",${namaHari(tgl)},${num(row.pendapatan1)},${num(row.pendapatan2)},${num(row.titipan1)},${num(row.titipan2)},${num(row.titipan3)},${num(row.tabungan)},${hitungTotal(row)}\n`
  })
  downloadText(`laporan_pendapatan_${b}_${t}.csv`, csv)
  alert('✅ CSV berhasil diunduh.')
}

async function eksporPengeluaranCSV(fromEkspor) {
  const b=fromEkspor?parseInt(document.getElementById('exp-bulan').value):activeBulan
  const t=fromEkspor?parseInt(document.getElementById('exp-tahun').value):activeTahun
  const list=getPengeluaranBulan(b,t)
  let csv='Tanggal,Hari,Keterangan,Total\n'
  list.forEach(p=>{csv+=`"${labelTgl(p.tgl)}",${namaHari(p.tgl)},"${p.keterangan}",${num(p.total)}\n`})
  csv+=`,,TOTAL,${list.reduce((s,p)=>s+num(p.total),0)}\n`
  downloadText(`pengeluaran_${b}_${t}.csv`, csv)
  alert('✅ CSV berhasil diunduh.')
}

// ═══════════════════════════════════════════
// CETAK
// ═══════════════════════════════════════════
function cetakHarian(fromEkspor) {
  const b=fromEkspor?parseInt(document.getElementById('exp-bulan').value):activeBulan
  const t=fromEkspor?parseInt(document.getElementById('exp-tahun').value):activeTahun
  const days=getHarianBulan(b,t), lbl=labelBulan(b,t)
  const tglCetak=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})
  let tP1=0,tP2=0,tT1=0,tT2=0,tT3=0,tTab=0,tTotal=0
  days.forEach(({tgl,row})=>{
    if(!row||isJumat(tgl)) return
    tP1+=num(row.pendapatan1);tP2+=num(row.pendapatan2);tT1+=num(row.titipan1);tT2+=num(row.titipan2);tT3+=num(row.titipan3);tTab+=num(row.tabungan);tTotal+=hitungTotal(row)
  })
  const baris=days.map(({tgl,row})=>{
    if(isJumat(tgl)) return `<tr class="tr-jumat"><td>${labelTgl(tgl)}</td><td colspan="7" style="text-align:center">— LIBUR JUMAT —</td></tr>`
    if(!row) return `<tr><td>${labelTgl(tgl)}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
    const total=hitungTotal(row)
    return `<tr><td>${labelTgl(tgl)}</td><td>${row.pendapatan1?fmt(row.pendapatan1):''}</td><td>${row.pendapatan2?fmt(row.pendapatan2):''}</td><td>${row.titipan1?fmt(row.titipan1):''}</td><td>${row.titipan2?fmt(row.titipan2):''}</td><td>${row.titipan3?fmt(row.titipan3):''}</td><td>${row.tabungan?fmt(row.tabungan):''}</td><td style="font-weight:700">${fmt(total)}</td></tr>`
  }).join('')
  document.getElementById('print-area').innerHTML=`
    <div class="kop"><div class="kop-nama">${NAMA_TOKO}</div><div class="kop-alamat">${ALAMAT_TOKO}</div></div>
    <div class="kop-garis"></div>
    <div class="kop-judul">LAPORAN PENDAPATAN HARIAN</div>
    <div class="kop-periode">Periode: ${lbl}</div>
    <div class="kop-cetak">Dicetak: ${tglCetak}</div>
    <div class="p-summary">
      <div class="p-sum-box"><div class="p-sum-val" style="color:#059669">${fmt(tTotal)}</div><div class="p-sum-lbl">Total Pend. Harian</div></div>
      <div class="p-sum-box"><div class="p-sum-val" style="color:#dc2626">${fmt(tT1+tT2+tT3)}</div><div class="p-sum-lbl">Total Titipan</div></div>
      <div class="p-sum-box"><div class="p-sum-val" style="color:#166534">${fmt(tTab)}</div><div class="p-sum-lbl">Tabungan</div></div>
      <div class="p-sum-box"><div class="p-sum-val" style="color:#14532d">${fmt(tTotal)}</div><div class="p-sum-lbl">Total Bersih</div></div>
    </div>
    <div class="p-section"><div class="p-section-title">Rincian Harian</div>
      <table class="p-table">
        <thead><tr><th style="text-align:left">Tanggal</th><th>Pend. I</th><th>Pend. II</th><th>Titipan I</th><th>Titipan II</th><th>Titipan III</th><th>Tabungan</th><th>TOTAL</th></tr></thead>
        <tbody>${baris}</tbody>
        <tfoot><tr class="tr-total"><td style="text-align:left">TOTAL</td><td>${fmt(tP1)}</td><td>${fmt(tP2)}</td><td>${fmt(tT1)}</td><td>${fmt(tT2)}</td><td>${fmt(tT3)}</td><td>${fmt(tTab)}</td><td class="td-total-col">${fmt(tTotal)}</td></tr></tfoot>
      </table>
    </div>
    <div class="p-footer">${NAMA_TOKO} — Laporan Pendapatan ${lbl} | Dicetak ${tglCetak}</div>`
  window.print()
}

function cetakPengeluaran(fromEkspor) {
  const b=fromEkspor?parseInt(document.getElementById('exp-bulan').value):activeBulan
  const t=fromEkspor?parseInt(document.getElementById('exp-tahun').value):activeTahun
  const list=getPengeluaranBulan(b,t), lbl=labelBulan(b,t)
  const tglCetak=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})
  const total=list.reduce((s,p)=>s+num(p.total),0)
  const baris=list.map(p=>`<tr><td>${labelTgl(p.tgl)}</td><td style="text-align:left">${p.keterangan}</td><td>${fmt(p.total)}</td></tr>`).join('')||`<tr><td colspan="3" style="text-align:center;padding:16px">Tidak ada pengeluaran</td></tr>`
  document.getElementById('print-area').innerHTML=`
    <div class="kop"><div class="kop-nama">${NAMA_TOKO}</div><div class="kop-alamat">${ALAMAT_TOKO}</div></div>
    <div class="kop-garis"></div>
    <div class="kop-judul">DAFTAR PENGELUARAN</div>
    <div class="kop-periode">Periode: ${lbl}</div>
    <div class="kop-cetak">Dicetak: ${tglCetak}</div>
    <div class="p-section" style="margin-top:12px;"><div class="p-section-title">Rincian Pengeluaran</div>
      <table class="p-table">
        <thead><tr><th style="text-align:left">Tanggal</th><th style="text-align:left">Keterangan</th><th>Total</th></tr></thead>
        <tbody>${baris}</tbody>
        <tfoot><tr class="tr-total"><td colspan="2" style="text-align:left">TOTAL PENGELUARAN</td><td class="td-total-col">${fmt(total)}</td></tr></tfoot>
      </table>
    </div>
    <div class="p-footer">${NAMA_TOKO} — Daftar Pengeluaran ${lbl} | Dicetak ${tglCetak}</div>`
  window.print()
}

// ═══════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════
async function resetData() {
  const ok=window.confirm('Hapus SEMUA data? Tidak bisa dibatalkan!')
  if(!ok) return
  db={harian:{},pengeluaran:[],penarikan:[]}
  await saveDB(); alert('✅ Semua data dihapus.'); renderHarian(); renderDataInfo()
}

// ═══════════════════════════════════════════
// START
// ═══════════════════════════════════════════
init()
