const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url || !key) return {statusCode:500,body:JSON.stringify({error:'Environment SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur di Netlify.'})}
  let body; try{body=JSON.parse(event.body||'{}')}catch{return {statusCode:400,body:JSON.stringify({error:'Format data tidak valid.'})}}
  const username=String(body.username||'').trim().toLowerCase(), password=String(body.password||'')
  if(!/^[a-z0-9._-]{3,30}$/.test(username)) return {statusCode:400,body:JSON.stringify({error:'Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.'})}
  if(password.length<6) return {statusCode:400,body:JSON.stringify({error:'Password minimal 6 karakter.'})}
  const admin=createClient(url,key)
  const {count,error:countError}=await admin.from('profiles').select('id',{count:'exact',head:true})
  if(countError) return {statusCode:500,body:JSON.stringify({error:'Tabel profiles belum siap. Jalankan supabase.sql terlebih dahulu.'})}
  if((count||0)>0) return {statusCode:403,body:JSON.stringify({error:'Setup admin sudah pernah dilakukan. Gunakan akun admin yang ada untuk membuat akun baru.'})}
  const email=`${username}@kantinuimsya.com`
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}})
  if(error) return {statusCode:400,body:JSON.stringify({error:error.message})}
  const {error:pe}=await admin.from('profiles').upsert({id:data.user.id,username,role:'admin'},{onConflict:'id'})
  if(pe){await admin.auth.admin.deleteUser(data.user.id);return {statusCode:500,body:JSON.stringify({error:'Akun dibuat tetapi profil gagal disimpan: '+pe.message})}}
  return {statusCode:200,body:JSON.stringify({ok:true,username})}
}
