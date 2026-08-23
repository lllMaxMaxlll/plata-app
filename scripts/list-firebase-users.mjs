import { initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { readFileSync } from "node:fs"

initializeApp({ credential: cert(JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"))) })
const { users } = await getAuth().listUsers(50)
for (const u of users) {
  const providers = u.providerData.map((p) => p.providerId).join(",") || "none"
  console.log([
    u.uid,
    u.email ?? "(sin email)",
    u.emailVerified ? "verificado" : "sin verificar",
    providers,
    "creado " + new Date(u.metadata.creationTime).toISOString().slice(0, 10),
    "último login " + (u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString().slice(0, 10) : "nunca"),
  ].join("  |  "))
}
console.log(`\ntotal: ${users.length}`)
