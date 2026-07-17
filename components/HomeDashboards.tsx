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
  Calculator,
  CalendarRange,
  FileText,
  UtensilsCrossed,
  Wallet,
  Zap,
  Target,
  Truck,
  Sandwich,
  Folder,
  Pencil,
  GripVertical,
  Check,
  ChevronRight,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  ViewTransition,
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
import { NAV_FORWARD } from "@/lib/dashboard-groups";

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
  calculator: Calculator,
  wallet: Wallet,
  "calendar-range": CalendarRange,
  "file-text": FileText,
  zap: Zap,
  target: Target,
  truck: Truck,
  sandwich: Sandwich,
  folder: Folder,
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
  /** Si está, la cabecera (icono+título) hace morph con este nombre. */
  vtName?: string;
  /** Tipo de view transition al hacer click (dirección del slide). */
  transitionType?: string;
}

interface HomeGroup {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  accentClass: string;
  accentText: string;
  vtName: string;
  memberKeys: string[];
}

interface HomeDashboardsProps {
  sections: Section[];
  groups: HomeGroup[];
  isSuperadmin: boolean;
}

const MAX_COLS = 4;

export default function HomeDashboards({
  sections,
  groups,
  isSuperadmin,
}: HomeDashboardsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // El banner se deriva del query param en el primer render (la home es
  // dinámica, así que el SSR ya ve el param → sin mismatch de hidratación).
  const [showBanner, setShowBanner] = useState(
    () => searchParams.get("unauthorized") === "1",
  );

  // Limpiamos el ?unauthorized=1 de la URL. Es un efecto externo (navegación),
  // no un setState, así que no dispara renders en cascada.
  useEffect(() => {
    if (searchParams.get("unauthorized") === "1") {
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

  // En vista, los dashboards de un grupo se colapsan en una sola card (que
  // lleva al hub) y todas las cards se ordenan alfabéticamente por título. En
  // edición se muestran individuales y en el orden de la DB, para que el
  // superadmin pueda reordenarlos/editarlos como siempre.
  const collapsedSections = useMemo(() => {
    const collapse = (): Section[] => {
      if (groups.length === 0) return sections;
      const groupByMember = new Map<string, HomeGroup>();
      for (const g of groups) {
        for (const k of g.memberKeys) groupByMember.set(k, g);
      }
      const out: Section[] = [];
      const seen = new Set<string>();
      for (const s of sections) {
        const g = groupByMember.get(s.key);
        if (!g) {
          out.push(s);
          continue;
        }
        // La card del grupo reemplaza a sus miembros; solo se emite una vez.
        if (seen.has(g.key)) continue;
        seen.add(g.key);
        out.push({
          key: `group:${g.key}`,
          title: g.title,
          description: g.description,
          href: g.href,
          icon: g.icon,
          accentClass: g.accentClass,
          accentText: g.accentText,
          vtName: g.vtName,
          transitionType: NAV_FORWARD,
        });
      }
      return out;
    };
    return [...collapse()].sort((a, b) =>
      a.title.localeCompare(b.title, "es", { sensitivity: "base" }),
    );
  }, [sections, groups]);

  const list = mode === "edit" ? draft : collapsedSections;

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 py-16">
      {/* Edit-mode toolbar */}
      <AnimatePresence>
        {mode === "edit" && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 border-b border-[#E5E5E5] bg-white px-6 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F0EFFE] px-3 py-1.5 font-sans text-xs font-medium text-[#9F99F8]">
                <Pencil size={14} strokeWidth={2} />
                Modo edición
              </span>
              <span className="hidden font-sans text-xs text-[#999999] sm:inline">
                Click en título/descripción para editar · Arrastrá para
                reordenar
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={pending}
                className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={pending || !isDirty}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
              >
                <Check size={14} strokeWidth={2.5} />
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
            className="fixed right-6 top-20 z-50 inline-flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 font-sans text-sm font-medium text-[#333333] shadow-md"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                toast.kind === "ok" ? "bg-[#B1D750]" : "bg-[#ED75A0]"
              }`}
            />
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
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-[#E5E5E5] bg-white px-5 py-3 shadow-md"
          >
            <AlertCircle
              size={18}
              strokeWidth={2}
              className="shrink-0 text-[#ED75A0]"
            />
            <span className="font-sans text-sm text-[#333333]">
              No tienes acceso a ese dashboard
            </span>
            <button
              onClick={() => setShowBanner(false)}
              aria-label="Cerrar aviso"
              className="ml-2 shrink-0 text-[#999999] transition-colors hover:text-[#333333]"
            >
              <X size={16} strokeWidth={2} />
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
          className="h-14 w-auto sm:h-16"
        />
      </motion.div>

      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="font-display text-5xl font-bold tracking-tight text-[#333333] sm:text-6xl"
      >
        Data Glovox
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mt-3 font-sans text-sm text-[#666666]"
      >
        Dashboards internos de datos
      </motion.p>

      {/* Dashboard grid or empty state */}
      {list.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="mt-16 flex max-w-md flex-col items-center gap-6 rounded-lg border border-[#E5E5E5] bg-white p-10 text-center shadow-sm"
        >
          <div className="inline-flex items-center justify-center rounded-full bg-[#F0EFFE] p-4">
            <Lock size={28} className="text-[#9F99F8]" strokeWidth={2} />
          </div>
          <div>
            <p className="font-display text-xl font-bold tracking-tight text-[#333333]">
              Sin acceso a dashboards
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-[#666666]">
              Consigue un permiso escribiendo a{" "}
              <a
                href="mailto:maximiliano@glovox.cl"
                className="text-[#9F99F8] underline decoration-1 underline-offset-2 hover:text-[#8780F0]"
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
              className={`mt-16 grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 ${lgGridCols[cols] ?? "lg:grid-cols-4"}`}
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
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-5 py-3 font-sans text-sm font-medium text-white shadow-md transition-colors hover:bg-[#8780F0]"
        >
          <Pencil size={16} strokeWidth={2} />
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 + index * 0.06 }}
      className="relative h-full"
    >
      {mode === "edit" && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Mover tarjeta"
          className="absolute -left-3 -top-3 z-10 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#666666] shadow-sm transition-colors hover:text-[#333333] active:cursor-grabbing"
        >
          <GripVertical size={16} strokeWidth={2} />
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

  const headerBlock = (
    <div className="mb-4 flex items-center gap-4">
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-lg p-3 ${section.accentClass}`}
      >
        <Icon size={22} className={section.accentText} strokeWidth={2} />
      </div>
      {mode === "edit" ? (
        <EditableTitle
          value={section.title}
          onChange={(v) => onChange({ title: v })}
        />
      ) : (
        <h2 className="min-w-0 font-display text-lg font-bold leading-tight tracking-tight text-[#333333]">
          {section.title}
        </h2>
      )}
    </div>
  );

  const inner = (
    <>
      {section.vtName ? (
        <ViewTransition name={section.vtName} share="morph" default="none">
          {headerBlock}
        </ViewTransition>
      ) : (
        headerBlock
      )}

      {mode === "edit" ? (
        <EditableDescription
          value={section.description}
          onChange={(v) => onChange({ description: v })}
        />
      ) : (
        <p className="mt-1 grow font-sans text-sm leading-relaxed text-[#666666]">
          {section.description}
        </p>
      )}

      <div
        className={`mt-5 inline-flex items-center gap-1.5 self-start rounded-lg bg-[#F0EFFE] px-3 py-1.5 font-sans text-sm font-medium text-[#9F99F8] ${
          mode === "view"
            ? "transition-colors group-hover:bg-[#9F99F8] group-hover:text-white"
            : ""
        }`}
      >
        Abrir dashboard
        <ChevronRight
          size={15}
          strokeWidth={2.5}
          className={
            mode === "view"
              ? "transition-transform group-hover:translate-x-0.5"
              : ""
          }
        />
      </div>
    </>
  );

  const shellClass = `flex h-full flex-col rounded-lg border border-[#E5E5E5] bg-white p-6 ${
    dragging
      ? "shadow-lg"
      : "shadow-sm"
  } ${
    mode === "view"
      ? "group transition-all duration-150 hover:-translate-y-px hover:shadow-md"
      : ""
  }`;

  if (mode === "edit") {
    return <div className={shellClass}>{inner}</div>;
  }

  return (
    <Link
      href={section.href}
      transitionTypes={
        section.transitionType ? [section.transitionType] : undefined
      }
      className={shellClass}
    >
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
          className="w-full rounded-lg border border-[#E5E5E5] bg-white px-2 py-1 font-display text-lg font-bold leading-tight tracking-tight text-[#333333] outline-none focus:border-[#9F99F8] focus:ring-1 focus:ring-[#9F99F8]"
        />
        <span className="pointer-events-none absolute -bottom-4 right-0 font-sans text-[10px] text-[#999999]">
          {local.length}/{TITLE_MAX}
        </span>
      </div>
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      className="min-w-0 flex-1 cursor-text rounded-md font-display text-lg font-bold leading-tight tracking-tight text-[#333333] outline-dashed outline-1 outline-offset-4 outline-[#E5E5E5] hover:outline-[#9F99F8]"
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
      <div className="relative mt-1 grow">
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
          className="w-full resize-none rounded-lg border border-[#E5E5E5] bg-white p-2 font-sans text-sm leading-relaxed text-[#666666] outline-none focus:border-[#9F99F8] focus:ring-1 focus:ring-[#9F99F8]"
        />
        <span className="pointer-events-none absolute -bottom-4 right-0 font-sans text-[10px] text-[#999999]">
          {local.length}/{DESCRIPTION_MAX}
        </span>
      </div>
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      className="mt-1 grow cursor-text rounded-md font-sans text-sm leading-relaxed text-[#666666] outline-dashed outline-1 outline-offset-4 outline-[#E5E5E5] hover:outline-[#9F99F8]"
      title="Click para editar"
    >
      {value || "Sin descripción — click para escribir"}
    </p>
  );
}
