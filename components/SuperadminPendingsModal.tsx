"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { DashboardCatalogEntry } from "@/lib/dashboards-catalog";
import {
  createPending,
  deletePending,
  togglePendingStatus,
  updatePending,
  type PendingLists,
} from "@/lib/superadminPendings";
import type { SuperadminPending } from "@/db/schema";

type Tab = "pending" | "done";

export default function SuperadminPendingsModal({
  dashboard,
  lists,
  onChange,
  onClose,
}: {
  dashboard: DashboardCatalogEntry;
  lists: PendingLists;
  onChange: (lists: PendingLists) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("pending");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function run(fn: () => Promise<PendingLists>) {
    setError(null);
    startTransition(async () => {
      try {
        const next = await fn();
        onChange(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title;
    const d = description;
    run(async () => {
      const next = await createPending(dashboard.key, t, d || undefined);
      setTitle("");
      setDescription("");
      return next;
    });
  }

  function startEdit(item: SuperadminPending) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  }

  function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    const t = editTitle;
    const d = editDescription;
    run(async () => {
      const next = await updatePending(id, { title: t, description: d });
      cancelEdit();
      return next;
    });
  }

  const items = tab === "pending" ? lists.pending : lists.done;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Pendientes ${dashboard.label}`}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="my-auto w-full max-w-2xl rounded-lg border border-[#E5E5E5] bg-white shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#E5E5E5] px-6 py-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#333333]">
                Pendientes
              </h2>
              <p className="font-sans text-sm text-[#666666]">
                {dashboard.label}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex border-b border-[#E5E5E5] px-6">
            <TabButton
              active={tab === "pending"}
              onClick={() => setTab("pending")}
              label="Pendientes"
              count={lists.pending.length}
            />
            <TabButton
              active={tab === "done"}
              onClick={() => setTab("done")}
              label="Listos"
              count={lists.done.length}
            />
          </div>

          {tab === "pending" && (
            <form
              onSubmit={handleCreate}
              className="border-b border-[#E5E5E5] bg-[#FAFAFA] px-6 py-4"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del pendiente"
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={2}
                className="mt-2 w-full resize-none rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isPending || !title.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="border-b border-[#E5E5E5] bg-white px-6 py-3">
              <p className="font-sans text-sm text-[#ED75A0]">{error}</p>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <p className="py-8 text-center font-sans text-sm text-[#999999]">
                {tab === "pending"
                  ? "Sin pendientes. Agrega uno arriba."
                  : "Aún no hay pendientes completados."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="group rounded-lg border border-[#E5E5E5] bg-white p-3 transition-colors hover:bg-[#FAFAFA]"
                  >
                    {editingId === item.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                        />
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descripción (opcional)"
                          rows={2}
                          className="w-full resize-none rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isPending}
                            className="rounded-lg px-3 py-1.5 font-sans text-sm font-medium text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(item.id)}
                            disabled={isPending || !editTitle.trim()}
                            className="rounded-lg bg-[#9F99F8] px-3 py-1.5 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            run(() => togglePendingStatus(item.id))
                          }
                          disabled={isPending}
                          aria-label={
                            item.status === "pending"
                              ? "Marcar como listo"
                              : "Reabrir"
                          }
                          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            item.status === "done"
                              ? "border-[#9F99F8] bg-[#9F99F8] text-white"
                              : "border-[#E5E5E5] bg-white hover:border-[#9F99F8]"
                          }`}
                        >
                          {item.status === "done" && (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-sans text-sm font-medium ${
                              item.status === "done"
                                ? "text-[#999999] line-through"
                                : "text-[#333333]"
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.description && (
                            <p
                              className={`mt-1 whitespace-pre-wrap font-sans text-sm ${
                                item.status === "done"
                                  ? "text-[#999999]"
                                  : "text-[#666666]"
                              }`}
                            >
                              {item.description}
                            </p>
                          )}
                          <p className="mt-1 font-sans text-xs text-[#999999]">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          {item.status === "done" && (
                            <button
                              type="button"
                              onClick={() =>
                                run(() => togglePendingStatus(item.id))
                              }
                              disabled={isPending}
                              aria-label="Reabrir"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {item.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              disabled={isPending}
                              aria-label="Editar"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => run(() => deletePending(item.id))}
                            disabled={isPending}
                            aria-label="Eliminar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#ED75A0]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-3 font-sans text-sm transition-colors ${
        active
          ? "border-[#9F99F8] text-[#333333]"
          : "border-transparent text-[#666666] hover:text-[#333333]"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 font-sans text-xs ${
          active ? "text-[#9F99F8]" : "text-[#999999]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
