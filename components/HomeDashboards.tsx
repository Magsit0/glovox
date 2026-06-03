"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Database,
  Megaphone,
  HeartHandshake,
  Ticket,
  Gift,
  Globe,
  Lock,
  AlertCircle,
  X,
  BottleWine,
  Briefcase,
  CalendarRange,
  FileText,
  UtensilsCrossed,
  Wallet,
  Zap,
  Pencil,
  GripVertical,
  Check,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveDashboardEditsAction } from "@/app/admin/dashboards/actions";

const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  database: Database,
  megaphone: Megaphone,
  heart: HeartHandshake,
  ticket: Ticket,
  gift: Gift,
  globe: Globe,
  BottleWine: BottleWine,
  "utensils-crossed": UtensilsCrossed,
  briefcase: Briefcase,
  wallet: Wallet,
  "calendar-range": CalendarRange,
  "file-text": FileText,
  zap: Zap,
};

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 240;

interface Section {
  key: string;
  title: string;
  description: string;
  href: string;
  accentClass: string;
  accentText: string;
  icon: string;
}

interface HomeDashboardsProps {
  sections: Section[];
  isSuperadmin: boolean;
}

const MAX_COLS = 4;

export default function HomeDashboards({
  sections,
  isSuperadmin,
}: HomeDashboardsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("unauthorized") === "1") {
      setShowBanner(true);
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  // ---- edit mode state -----------------------------------------------------
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<Section[]>(sections);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "ok" | "err";
    msg: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  // Si el server entrega nuevas secciones (revalidate), resetea el draft
  // siempre que estemos en modo vista. Patrón render-phase update.
  const [sectionsSnap, setSectionsSnap] = useState(sections);
  if (mode === "view" && sectionsSnap !== sections) {
    setSectionsSnap(sections);
    setDraft(sections);
  }

  const isDirty = useMemo(() => {
    if (draft.length !== sections.length) return true;
    for (let i = 0; i < draft.length; i++) {
      const a = draft[i];
      const b = sections[i];
      if (
        a.key !== b.key ||
        a.title !== b.title ||
        a.description !== b.description
      ) {
        return true;
      }
    }
    return false;
  }, [draft, sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const enterEdit = () => {
    setDraft(sections);
    setMode("edit");
  };

  const cancelEdit = () => {
    if (isDirty) {
      const ok = window.confirm("Descartar cambios?");
      if (!ok) return;
    }
    setDraft(sections);
    setMode("view");
  };

  const saveEdit = () => {
    startTransition(async () => {
      const res = await saveDashboardEditsAction({
        updates: draft.map((s) => ({
          key: s.key,
          title: s.title,
          description: s.description,
        })),
        order: draft.map((s) => s.key),
      });
      if (res.ok) {
        setMode("view");
        setToast({ kind: "ok", msg: "Cambios guardados" });
        router.refresh();
      } else {
        setToast({ kind: "err", msg: res.error });
      }
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveKey(String(e.active.id));
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveKey(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDraft((prev) => {
      const oldIndex = prev.findIndex((s) => s.key === active.id);
      const newIndex = prev.findIndex((s) => s.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const list = mode === "edit" ? draft : sections;

  const numRows = list.length > 0 ? Math.ceil(list.length / MAX_COLS) : 1;
  const cols = list.length > 0 ? Math.ceil(list.length / numRows) : 1;
  const lgGridCols: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  };

  const activeSection =
    activeKey != null ? draft.find((s) => s.key === activeKey) ?? null : null;

  const updateDraft = (key: string, patch: Partial<Section>) => {
    setDraft((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16">
      {/* Edit-mode toolbar */}
      <AnimatePresence>
        {mode === "edit" && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 border-b-4 border-black bg-white px-6 py-3 shadow-[0_4px_0px_#000000]"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 border-2 border-black bg-[#FFFF00] px-3 py-1.5 font-mono-data text-xs font-bold uppercase tracking-wide text-black">
                <Pencil size={14} strokeWidth={2.5} />
                Modo edición
              </span>
              <span className="hidden font-mono-data text-[10px] uppercase tracking-widest text-black/60 sm:inline">
                Click en título/descripción para editar · Arrastrá para
                reordenar
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={pending}
                className="border-2 border-black bg-white px-4 py-2 font-mono-data text-xs font-bold uppercase text-black transition-colors hover:bg-black hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={pending || !isDirty}
                className="inline-flex items-center gap-2 border-2 border-black bg-black px-4 py-2 font-mono-data text-xs font-bold uppercase text-[#FFFF00] shadow-[3px_3px_0px_#FFFF00] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#FFFF00] disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                <Check size={14} strokeWidth={3} />
                {pending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className={`fixed right-6 top-20 z-50 border-4 border-black px-4 py-3 font-mono-data text-xs font-bold uppercase shadow-[4px_4px_0px_#000000] ${
              toast.kind === "ok"
                ? "bg-[#B1D750] text-black"
                : "bg-[#ED75A0] text-black"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unauthorized banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-3 border-4 border-black bg-[#FFFF00] px-5 py-3 shadow-[4px_4px_0px_#000000]"
          >
            <AlertCircle
              size={18}
              strokeWidth={2.5}
              className="shrink-0 text-black"
            />
            <span className="font-mono-data text-xs font-bold uppercase tracking-wide text-black">
              No tienes acceso a ese dashboard
            </span>
            <button
              onClick={() => setShowBanner(false)}
              aria-label="Cerrar aviso"
              className="ml-2 shrink-0 text-black hover:opacity-60"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <Image
          src="/glovox_logo_gvx_black.svg"
          alt="Glovox"
          width={200}
          height={72}
          priority
          className="h-16 w-auto sm:h-20"
        />
      </motion.div>

      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="font-display text-7xl font-black uppercase leading-none tracking-tight text-black sm:text-8xl md:text-9xl"
      >
        DATA GLOVOX
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mt-4 font-mono-data text-xs uppercase tracking-widest text-black"
      >
        Internal Data Dashboards
      </motion.p>

      {/* Dashboard grid or empty state */}
      {list.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="mt-16 flex max-w-md flex-col items-center gap-6 border-4 border-black bg-white p-10 text-center shadow-[6px_6px_0px_#000000]"
        >
          <div className="inline-flex items-center justify-center border-2 border-black bg-black p-4">
            <Lock size={32} className="text-[#FFFF00]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-xl font-black uppercase tracking-tight text-black">
              Sin acceso a dashboards
            </p>
            <p className="mt-3 font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black">
              Consigue un permiso escribiendo a{" "}
              <a
                href="mailto:maximiliano@glovox.cl"
                className="underline decoration-2 underline-offset-2 hover:opacity-60"
              >
                maximiliano@glovox.cl
              </a>{" "}
              para ver dashboards.
            </p>
          </div>
        </motion.div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={list.map((s) => s.key)}
            strategy={rectSortingStrategy}
            disabled={mode !== "edit"}
          >
            <div
              className={`mt-16 grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 ${lgGridCols[cols] ?? "lg:grid-cols-4"}`}
            >
              {list.map((section, i) => (
                <CardItem
                  key={section.key}
                  section={section}
                  index={i}
                  mode={mode}
                  onChange={(patch) => updateDraft(section.key, patch)}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeSection ? (
              <CardSurface
                section={activeSection}
                mode="edit"
                dragging
                onChange={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Floating edit button */}
      {isSuperadmin && mode === "view" && (
        <motion.button
          type="button"
          onClick={enterEdit}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 border-4 border-black bg-[#FFFF00] px-5 py-3 font-mono-data text-xs font-bold uppercase tracking-wide text-black shadow-[4px_4px_0px_#000000] hover:bg-black hover:text-[#FFFF00]"
        >
          <Pencil size={16} strokeWidth={2.5} />
          Editar
        </motion.button>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

interface CardItemProps {
  section: Section;
  index: number;
  mode: "view" | "edit";
  onChange: (patch: Partial<Section>) => void;
}

function CardItem({ section, index, mode, onChange }: CardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.key, disabled: mode !== "edit" });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 + index * 0.05 }}
      className="relative h-full"
    >
      {mode === "edit" && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Mover tarjeta"
          className="absolute -left-3 -top-3 z-10 inline-flex h-8 w-8 cursor-grab items-center justify-center border-2 border-black bg-[#FFFF00] text-black shadow-[2px_2px_0px_#000000] active:cursor-grabbing"
        >
          <GripVertical size={16} strokeWidth={2.5} />
        </button>
      )}
      <CardSurface section={section} mode={mode} onChange={onChange} />
    </motion.div>
  );
}

interface CardSurfaceProps {
  section: Section;
  mode: "view" | "edit";
  dragging?: boolean;
  onChange: (patch: Partial<Section>) => void;
}

function CardSurface({ section, mode, dragging, onChange }: CardSurfaceProps) {
  const Icon = ICON_MAP[section.icon] ?? Ticket;

  const inner = (
    <>
      <div className="mb-4 flex items-center gap-4">
        <div
          className={`inline-flex shrink-0 items-center justify-center border-2 border-black p-3 ${section.accentClass}`}
        >
          <Icon size={24} className={section.accentText} strokeWidth={2.5} />
        </div>
        {mode === "edit" ? (
          <EditableTitle
            value={section.title}
            onChange={(v) => onChange({ title: v })}
          />
        ) : (
          <h2 className="min-w-0 font-display text-xl font-black uppercase leading-none tracking-tight text-black">
            {section.title}
          </h2>
        )}
      </div>

      {mode === "edit" ? (
        <EditableDescription
          value={section.description}
          onChange={(v) => onChange({ description: v })}
        />
      ) : (
        <p className="mt-3 grow text-justify font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black">
          {section.description}
        </p>
      )}

      <div
        className={`mt-5 inline-block border-2 border-black bg-[#FFFF00] px-4 py-2 font-mono-data text-xs font-bold uppercase text-black ${
          mode === "view"
            ? "transition-colors group-hover:bg-black group-hover:text-[#FFFF00]"
            : ""
        }`}
      >
        Open Dashboard
      </div>
    </>
  );

  const shellClass = `flex h-full flex-col border-4 border-black bg-white p-6 ${
    dragging
      ? "shadow-[8px_8px_0px_#000000] scale-[1.03] rotate-[-1deg]"
      : "shadow-[4px_4px_0px_#000000]"
  } ${
    mode === "view"
      ? "group transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000000]"
      : ""
  }`;

  if (mode === "edit") {
    return <div className={shellClass}>{inner}</div>;
  }

  return (
    <Link href={section.href} className={shellClass}>
      {inner}
    </Link>
  );
}

// ---------------------------------------------------------------------------

interface EditableTitleProps {
  value: string;
  onChange: (v: string) => void;
}

function EditableTitle({ value, onChange }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setLocal(value);
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = local.trim();
    if (next.length > 0) onChange(next);
    else setLocal(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          value={local}
          maxLength={TITLE_MAX}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setLocal(value);
              setEditing(false);
            }
          }}
          className="w-full border-2 border-black bg-[#FFFF00] px-2 py-1 font-display text-xl font-black uppercase leading-none tracking-tight text-black outline-none ring-2 ring-black sm:text-2xl"
        />
        <span className="pointer-events-none absolute -bottom-4 right-0 font-mono-data text-[9px] uppercase tracking-wide text-black/60">
          {local.length}/{TITLE_MAX}
        </span>
      </div>
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      className="min-w-0 flex-1 cursor-text rounded-sm font-display text-xl font-black uppercase leading-none tracking-tight text-black outline-dashed outline-2 outline-offset-4 outline-black/20 hover:outline-black sm:text-2xl"
      title="Click para editar"
    >
      {value}
    </h2>
  );
}

interface EditableDescriptionProps {
  value: string;
  onChange: (v: string) => void;
}

function EditableDescription({ value, onChange }: EditableDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setLocal(value);
  }

  useEffect(() => {
    if (editing) {
      const el = textareaRef.current;
      el?.focus();
      el?.select();
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }
  }, [editing]);

  const commit = () => {
    onChange(local.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative mt-3 grow">
        <textarea
          ref={textareaRef}
          value={local}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => {
            setLocal(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setLocal(value);
              setEditing(false);
            }
          }}
          rows={3}
          className="w-full resize-none border-2 border-black bg-[#FFFF00] p-2 text-justify font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black outline-none ring-2 ring-black"
        />
        <span className="pointer-events-none absolute -bottom-4 right-0 font-mono-data text-[9px] uppercase tracking-wide text-black/60">
          {local.length}/{DESCRIPTION_MAX}
        </span>
      </div>
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className="mt-3 grow cursor-text rounded-sm text-justify font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black outline-dashed outline-2 outline-offset-4 outline-black/20 hover:outline-black"
      title="Click para editar"
    >
      {value || "Sin descripción — click para escribir"}
    </p>
  );
}
