// Produces .secrets/market-vapid.env once, without logging private keys.
import { mkdir, writeFile } from 'node:fs/promises'
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
await mkdir('.secrets', { recursive: true, mode: 0o700 })
await writeFile('.secrets/market-vapid.env', `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateJwk.d}\n`, { mode: 0o600, flag: 'wx' })
console.log('Claves guardadas en .secrets/market-vapid.env (ignorado por Git). No las regeneres después de suscribir dispositivos.')
