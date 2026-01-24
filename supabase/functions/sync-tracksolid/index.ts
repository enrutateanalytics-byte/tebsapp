import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tracksolid API base URL - Regional endpoints:
// HK/SG: https://hk-open.tracksolidpro.com/route/rest
// EU: https://eu-open.tracksolidpro.com/route/rest  
// US: https://us-open.tracksolidpro.com/route/rest
// China: http://open.10000track.com/route/rest
const TRACKSOLID_API_URL = 'https://hk-open.tracksolidpro.com/route/rest'

interface TracksolidTokenResponse {
  code: number
  message: string
  data?: {
    access_token: string
    expires_in: number
  }
}

interface DeviceLocation {
  imei: string
  deviceName: string
  lat: number
  lng: number
  speed: number
  direction: number
  gpsTime: string
  positionTime: string
}

interface TracksolidLocationResponse {
  code: number
  message: string
  data?: DeviceLocation[]
}

// Generate MD5 hash using Web Crypto API with fallback
async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  
  // Use Web Crypto API with SHA-256 and take first 16 bytes to simulate MD5-like behavior
  // For actual MD5, we need to implement it manually since Deno doesn't support MD5 in subtle
  const md5Impl = (str: string): string => {
    // Simple MD5 implementation
    const rotateLeft = (x: number, n: number) => (x << n) | (x >>> (32 - n))
    
    const addUnsigned = (x: number, y: number) => {
      const lsw = (x & 0xFFFF) + (y & 0xFFFF)
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
      return (msw << 16) | (lsw & 0xFFFF)
    }
    
    const F = (x: number, y: number, z: number) => (x & y) | (~x & z)
    const G = (x: number, y: number, z: number) => (x & z) | (y & ~z)
    const H = (x: number, y: number, z: number) => x ^ y ^ z
    const I = (x: number, y: number, z: number) => y ^ (x | ~z)
    
    const FF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }
    
    const GG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }
    
    const HH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }
    
    const II = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }
    
    const convertToWordArray = (str: string) => {
      const lWordCount = (((str.length + 8) - ((str.length + 8) % 64)) / 64 + 1) * 16
      const lWordArray = new Array(lWordCount - 1).fill(0)
      let lByteCount = 0
      let lBytePosition = 0
      while (lByteCount < str.length) {
        const lWordPosition = (lByteCount - (lByteCount % 4)) / 4
        lBytePosition = (lByteCount % 4) * 8
        lWordArray[lWordPosition] = lWordArray[lWordPosition] | (str.charCodeAt(lByteCount) << lBytePosition)
        lByteCount++
      }
      const lWordPosition = (lByteCount - (lByteCount % 4)) / 4
      lBytePosition = (lByteCount % 4) * 8
      lWordArray[lWordPosition] = lWordArray[lWordPosition] | (0x80 << lBytePosition)
      lWordArray[lWordCount - 2] = str.length << 3
      lWordArray[lWordCount - 1] = str.length >>> 29
      return lWordArray
    }
    
    const wordToHex = (value: number) => {
      let hex = ''
      for (let i = 0; i <= 3; i++) {
        const byte = (value >>> (i * 8)) & 255
        hex += ('0' + byte.toString(16)).slice(-2)
      }
      return hex
    }
    
    const x = convertToWordArray(str)
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476
    
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21
    
    for (let k = 0; k < x.length; k += 16) {
      const AA = a, BB = b, CC = c, DD = d
      
      a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478)
      d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756)
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB)
      b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE)
      a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF)
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A)
      c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613)
      b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501)
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8)
      d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF)
      c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1)
      b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE)
      a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122)
      d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193)
      c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E)
      b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821)
      
      a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562)
      d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340)
      c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51)
      b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA)
      a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D)
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453)
      c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681)
      b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8)
      a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6)
      d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6)
      c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87)
      b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED)
      a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905)
      d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8)
      c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9)
      b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A)
      
      a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942)
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681)
      c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122)
      b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C)
      a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44)
      d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9)
      c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60)
      b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70)
      a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6)
      d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA)
      c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085)
      b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05)
      a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039)
      d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5)
      c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8)
      b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665)
      
      a = II(a, b, c, d, x[k + 0], S41, 0xF4292244)
      d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97)
      c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7)
      b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039)
      a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3)
      d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92)
      c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D)
      b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1)
      a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F)
      d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0)
      c = II(c, d, a, b, x[k + 6], S43, 0xA3014314)
      b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1)
      a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82)
      d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235)
      c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB)
      b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391)
      
      a = addUnsigned(a, AA)
      b = addUnsigned(b, BB)
      c = addUnsigned(c, CC)
      d = addUnsigned(d, DD)
    }
    
    return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)
  }
  
  return md5Impl(message)
}

// Format date to Tracksolid format: yyyy-MM-dd HH:mm:ss (UTC)
function formatTimestamp(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const hours = String(now.getUTCHours()).padStart(2, '0')
  const minutes = String(now.getUTCMinutes()).padStart(2, '0')
  const seconds = String(now.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// Generate signature for Tracksolid API
async function generateSign(params: Record<string, string>, appSecret: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort()
  let signString = appSecret
  for (const key of sortedKeys) {
    signString += key + params[key]
  }
  signString += appSecret
  const hash = await md5(signString)
  return hash.toUpperCase()
}

// Get access token from Tracksolid
async function getAccessToken(
  appKey: string, 
  appSecret: string, 
  userId: string, 
  userPassword: string
): Promise<string> {
  const timestamp = formatTimestamp()
  const passwordMd5 = await md5(userPassword)
  
  console.log('Auth params - timestamp:', timestamp, 'user_id:', userId)
  
  const params: Record<string, string> = {
    method: 'jimi.oauth.token.get',
    app_key: appKey,
    timestamp: timestamp,
    v: '1.0',
    format: 'json',
    sign_method: 'md5',
    user_id: userId,
    user_pwd_md5: passwordMd5.toLowerCase(),
    expires_in: '7200'
  }
  
  const sign = await generateSign(params, appSecret)
  params.sign = sign
  
  console.log('Requesting access token from Tracksolid...')
  
  const response = await fetch(TRACKSOLID_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  
  const result = await response.json()
  console.log('Token response:', JSON.stringify(result))
  
  if (result.code !== 0) {
    throw new Error(`Failed to get access token: ${result.message || result.msg || 'Unknown error'}`)
  }
  
  // Tracksolid returns result.accessToken (where result is an object inside the response)
  const accessToken = result.result?.accessToken
  if (!accessToken) {
    throw new Error(`No access token in response: ${JSON.stringify(result)}`)
  }
  
  console.log('Access token obtained successfully')
  return accessToken
}

// Get device locations from Tracksolid
async function getDeviceLocations(
  appKey: string,
  appSecret: string,
  accessToken: string,
  imeis: string[]
): Promise<DeviceLocation[]> {
  if (imeis.length === 0) {
    console.log('No IMEIs to query')
    return []
  }
  
  const timestamp = formatTimestamp()
  
  const params: Record<string, string> = {
    method: 'jimi.device.location.list',
    app_key: appKey,
    timestamp: timestamp,
    v: '1.0',
    format: 'json',
    sign_method: 'md5',
    access_token: accessToken,
    imeis: imeis.join(','),
    map_type: 'GOOGLE'
  }
  
  const sign = await generateSign(params, appSecret)
  params.sign = sign
  
  console.log(`Requesting locations for ${imeis.length} devices...`)
  
  const response = await fetch(TRACKSOLID_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  
  const result: TracksolidLocationResponse = await response.json()
  console.log('Location response code:', result.code)
  
  if (result.code !== 0) {
    throw new Error(`Failed to get locations: ${result.message}`)
  }
  
  return result.data || []
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const appKey = Deno.env.get('TRACKSOLID_APP_KEY')
    const appSecret = Deno.env.get('TRACKSOLID_APP_SECRET')
    const userId = Deno.env.get('TRACKSOLID_USER_ID')
    const userPassword = Deno.env.get('TRACKSOLID_USER_PASSWORD')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!appKey || !appSecret || !userId || !userPassword) {
      throw new Error('Missing Tracksolid credentials in environment variables')
    }
    
    console.log('Starting Tracksolid sync...')
    
    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all units with IMEI configured
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, imei, plate_number')
      .not('imei', 'is', null)
      .eq('is_active', true)
    
    if (unitsError) {
      throw new Error(`Failed to fetch units: ${unitsError.message}`)
    }
    
    if (!units || units.length === 0) {
      console.log('No units with IMEI configured')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay unidades con IMEI configurado',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Found ${units.length} units with IMEI`)
    
    // Get access token
    const accessToken = await getAccessToken(appKey, appSecret, userId, userPassword)
    console.log('Access token obtained successfully')
    
    // Get locations for all IMEIs
    const imeis = units.map(u => u.imei).filter(Boolean) as string[]
    const locations = await getDeviceLocations(appKey, appSecret, accessToken, imeis)
    
    console.log(`Received ${locations.length} locations from Tracksolid`)
    
    // Create a map of IMEI to unit_id
    const imeiToUnitId = new Map<string, string>()
    for (const unit of units) {
      if (unit.imei) {
        imeiToUnitId.set(unit.imei, unit.id)
      }
    }
    
    // Insert new positions
    let syncedCount = 0
    for (const location of locations) {
      const unitId = imeiToUnitId.get(location.imei)
      
      if (!unitId) {
        console.log(`No unit found for IMEI ${location.imei}`)
        continue
      }
      
      // Check if we already have this position (to avoid duplicates)
      const recordedAt = new Date(location.gpsTime || location.positionTime).toISOString()
      
      const { data: existingPosition } = await supabase
        .from('gps_positions')
        .select('id')
        .eq('unit_id', unitId)
        .eq('recorded_at', recordedAt)
        .maybeSingle()
      
      if (existingPosition) {
        console.log(`Position already exists for unit ${unitId} at ${recordedAt}`)
        continue
      }
      
      // Insert new position
      const { error: insertError } = await supabase
        .from('gps_positions')
        .insert({
          unit_id: unitId,
          latitude: location.lat,
          longitude: location.lng,
          speed: location.speed || null,
          heading: location.direction || null,
          recorded_at: recordedAt
        })
      
      if (insertError) {
        console.error(`Failed to insert position for unit ${unitId}:`, insertError.message)
      } else {
        syncedCount++
        console.log(`Synced position for unit ${unitId}: ${location.lat}, ${location.lng}`)
      }
    }
    
    console.log(`Sync completed. Synced ${syncedCount} new positions.`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronización completada`,
        synced: syncedCount,
        total_units: units.length,
        locations_received: locations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Sync error:', errorMessage)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
