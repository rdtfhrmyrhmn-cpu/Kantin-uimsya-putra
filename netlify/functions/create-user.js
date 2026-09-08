const { createClient } = require('@supabase/supabase-js')
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  const authHeader = event.headers.authorization || event.headers.Authorization
  if (!authHeader?.startsWith('Bearer ')) return { statusCode: 401, body: JSON.stringify({ error: 'Token tidak ditemukan.' }) }
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceKey) return { statusCode: 500, body: JSON.stringify({ error: 'Environment Supabase belum dikonfigurasi di Netlify.' }) }
  const token = authHeader.slice(7)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user }, error: userError } = await userClient.auth.getUser(token)
  if (userError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Sesi login tidak valid.' }) }
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError || profile?.role !== 'admin') return { statusCode: 403, body: JSON.stringify({ error: 'Hanya admin yang boleh membuat akun.' }) }
  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Format data tidak valid.' }) } }
  const username = String(body.username || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { statusCode: 400, body: JSON.stringify({ error: 'Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.' }) }
  if (password.length < 6) return { statusCode: 400, body: JSON.stringify({ error: 'Password minimal 6 karakter.' }) }
  const email = `${username}@kantinuimsya.com`
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } })
  if (createError) return { statusCode: 400, body: JSON.stringify({ error: createError.message }) }
  const { error: profileUpsertError } = await admin.from('profiles').upsert({ id: created.user.id, username, role: 'user' }, { onConflict: 'id' })
  if (profileUpsertError) { await admin.auth.admin.deleteUser(created.user.id); return { statusCode: 500, body: JSON.stringify({ error: 'Akun dibuat tetapi profil gagal disimpan. Silakan ulangi.' }) } }
  return { statusCode: 200, body: JSON.stringify({ ok: true, username }) }
}
