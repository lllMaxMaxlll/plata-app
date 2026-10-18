import { redirect } from "next/navigation"

// "Más" ya no existe: lo que colgaba de ahí vive en Plata, Agenda y Yo. Quien
// tenga la ruta guardada termina en Yo, que es lo más parecido.
export default function MorePage() {
  redirect("/profile")
}
