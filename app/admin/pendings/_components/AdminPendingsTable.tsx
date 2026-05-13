"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  deletePending,
  togglePendingStatus,
  updatePending,
  type AllPendingsByDashboard,
} from "@/lib/superadminPendings";
import type { SuperadminPending } from "@/db/schema";

type Tab = "pending" | "done";

export default function AdminPendingsTable({
  data,
}: {
  data: AllPendingsByDashboard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
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
      await updatePending(id, { title: t, description: d });
      cancelEdit();
    });
  }

  const totalPending = data.reduce((sum, g) => sum + g.pending.length, 0);
  const totalDone = data.reduce((sum, g) => sum + g.done.length, 0);

  // Only include groups that have items for the active tab
  const visibleGroups = data.filter((g) =>
    tab === "pending" ? g.pending.length > 0 : g.done.length > 0,
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-3">
          <p className="font-sans text-sm text-[#ED75A0]">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
          <p className="font-sans text-xs text-[#666666]">Pendientes</p>
          <p className="mt-1 font-display text-3xl font-bold text-[#333333]">
            {totalPending}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
          <p className="font-sans text-xs text-[#666666]">Completados</p>
          <p className="mt-1 font-display text-3xl font-bold text-[#333333]">
            {totalDone}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#E5E5E5] bg-white overflow-hidden">
        <div className="flex border-b border-[#E5E5E5] px-6">
          <TabButton
            active={tab === "pending"}
            onClick={() => { setTab("pending"); cancelEdit(); }}
            label="Pendientes"
            count={totalPending}
          />
          <TabButton
            active={tab === "done"}
            onClick={() => { setTab("done"); cancelEdit(); }}
            label="Listos"
            count={totalDone}
          />
        </div>

        {visibleGroups.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-sans text-sm text-[#999999]">
              {tab === "pending"
                ? "Sin pendientes. Crea uno desde un dashboard."
                : "Aún no hay pendientes completados."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E5]">
            {visibleGroups.map((group) => (
              <div key={group.dashboardKey}>
                <div className="bg-[#FAFAFA] px-6 py-2">
                  <span className="font-sans text-xs font-medium text-[#666666]">
                    {group.dashboardLabel}
                  </span>
                </div>

                <div className="divide-y divide-[#E5E5E5]">
                  {tab === "pending"
                    ? group.pending.map((item) => (
                        <PendingRow
                          key={item.id}
                          item={item}
                          isEditing={editingId === item.id}
                          editTitle={editTitle}
                          editDescription={editDescription}
                          onStartEdit={() => startEdit(item)}
                          onCancelEdit={cancelEdit}
                          onSaveEdit={() => saveEdit(item.id)}
                          onEditTitleChange={setEditTitle}
                          onEditDescriptionChange={setEditDescription}
                          onToggle={() => run(() => togglePendingStatus(item.id))}
                          onDelete={() => run(() => deletePending(item.id))}
                          isPending={isPending}
                        />
                      ))
                    : group.done.map((item) => (
                        <DoneRow
                          key={item.id}
                          item={item}
                          onReopen={() => run(() => togglePendingStatus(item.id))}
                          onDelete={() => run(() => deletePending(item.id))}
                          isPending={isPending}
                        />
                      ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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

function PendingRow({
  item,
  isEditing,
  editTitle,
  editDescription,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTitleChange,
  onEditDescriptionChange,
  onToggle,
  onDelete,
  isPending,
}: {
  item: SuperadminPending;
  isEditing: boolean;
  editTitle: string;
  editDescription: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditTitleChange: (v: string) => void;
  onEditDescriptionChange: (v: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 px-6 py-4">
        <input
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          disabled={isPending}
        />
        <textarea
          value={editDescription}
          onChange={(e) => onEditDescriptionChange(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full resize-none rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          disabled={isPending}
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={isPending}
            className="rounded-lg px-3 py-1.5 font-sans text-sm font-medium text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={isPending || !editTitle.trim()}
            className="rounded-lg bg-[#9F99F8] px-3 py-1.5 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 px-6 py-3 transition-colors hover:bg-[#FAFAFA]">
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#E5E5E5] bg-white transition-colors hover:border-[#9F99F8]"
        aria-label="Marcar como listo"
      />
      <div className="min-w-0 flex-1">
        <p className="font-sans text-sm font-medium text-[#333333]">{item.title}</p>
        {item.description && (
          <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-[#666666]">
            {item.description}
          </p>
        )}
        <p className="mt-1 font-sans text-xs text-[#999999]">
          {formatDate(item.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onStartEdit}
          disabled={isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
          aria-label="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#ED75A0]"
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DoneRow({
  item,
  onReopen,
  onDelete,
  isPending,
}: {
  item: SuperadminPending;
  onReopen: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  return (
    <div className="group flex items-start gap-3 px-6 py-3 transition-colors hover:bg-[#FAFAFA]">
      <div className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#9F99F8] bg-[#9F99F8]">
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-sm font-medium text-[#999999] line-through">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-1 whitespace-pre-wrap font-sans text-sm text-[#999999]">
            {item.description}
          </p>
        )}
        <p className="mt-1 font-sans text-xs text-[#999999]">
          {item.completedAt
            ? `Completado ${formatDate(item.completedAt)}`
            : formatDate(item.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onReopen}
          disabled={isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
          aria-label="Reabrir"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#ED75A0]"
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
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
