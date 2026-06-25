"use client"

import { useState, useEffect } from "react"
import { Plus, X, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { DEFAULT_COLORS, type Category } from "@/lib/finance-data"
import { toast } from "sonner"

export function ManageCategoriesSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance()
  const [tab, setTab] = useState<"expense" | "income">("expense")
  
  // Form states
  const [name, setName] = useState("")
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0])
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Sync color with selection if editing
  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name)
      setSelectedColor(editingCategory.color)
    } else {
      setName("")
      setSelectedColor(DEFAULT_COLORS[0])
    }
  }, [editingCategory])

  // Filter categories by type
  const list = categories.filter((c) => c.type === tab)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      if (editingCategory) {
        // Edit mode
        await updateCategory(editingCategory.id, name.trim(), selectedColor)
        toast.success(`Categoría "${name.trim()}" modificada con éxito.`)
        setEditingCategory(null)
      } else {
        // Create mode
        await addCategory(name.trim(), tab, selectedColor)
        toast.success(`Categoría "${name.trim()}" creada con éxito.`)
      }
      setName("")
      setSelectedColor(DEFAULT_COLORS[0])
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar la categoría.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(cat: Category) {
    const confirmed = window.confirm(
      `¿Estás seguro de que querés eliminar la categoría "${cat.name}"?\n(Los movimientos registrados seguirán mostrando este nombre de categoría)`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteCategory(cat.id)
      toast.success(`Categoría "${cat.name}" eliminada.`)
      if (editingCategory?.id === cat.id) {
        setEditingCategory(null)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al eliminar la categoría.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Categorías"
      description="Gestioná tus categorías de ingresos y gastos."
    >
      <div className="mt-3 flex flex-col gap-5">
        {/* Type Tabs */}
        <div className="flex rounded-full bg-muted p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={submitting}
              onClick={() => {
                setTab(t)
                setEditingCategory(null)
              }}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              } disabled:opacity-50`}
            >
              {t === "expense" ? "Gastos" : "Ingresos"}
            </button>
          ))}
        </div>

        {/* Categories List */}
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto no-scrollbar">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Categorías registradas
          </p>
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No hay categorías de {tab === "expense" ? "gastos" : "ingresos"} creadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {list.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 p-3 hover:bg-card transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="size-3.5 rounded-full shrink-0"
                      style={{ background: cat.color }}
                    />
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setEditingCategory(cat)}
                      className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      title="Editar"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDelete(cat)}
                      className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Creator / Editor Form */}
        <div className="border-t border-border/40 pt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {editingCategory ? "Editar categoría" : "Nueva categoría"}
            </p>
            {editingCategory && (
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Nombre</p>
              <input
                value={name}
                disabled={submitting}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Gimnasio, Freelance"
                maxLength={25}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-50"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Color de categoría</p>
              <div className="flex flex-wrap gap-2.5 px-1 py-1">
                {DEFAULT_COLORS.map((c) => {
                  const active = selectedColor === c
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedColor(c)}
                      className={`size-6 rounded-full border border-black/25 relative transition-all active:scale-90 ${
                        active
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                          : "hover:scale-105"
                      }`}
                      style={{ background: c }}
                    />
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !name.trim()}
              className="h-12 w-full rounded-xl text-sm mt-1"
            >
              {submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : editingCategory ? (
                "Guardar cambios"
              ) : (
                <>
                  <Plus className="size-4 mr-1" />
                  Agregar categoría
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </BottomSheet>
  )
}
