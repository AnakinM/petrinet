import { type JSX, type Ref, useEffect, useRef, useState } from "react";
import { NetOps, type NodeKind } from "@/domain/netOps";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";
import { HistoryList } from "@/ui/HistoryList";

/** Contextual editor for the current single selection (place / transition / arc). */
export function PropertiesPanel(): JSX.Element {
  const net = useNetStore((s) => s.net);
  const selection = useNetStore((s) => s.selection);
  const simulating = useNetStore((s) => s.mode === "simulate");
  const count = selection.nodes.length + selection.edges.length;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto border-slate-200 border-t p-3">
      <h2 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
        {simulating ? "History" : "Properties"}
      </h2>
      {simulating ? <HistoryList /> : renderBody(net, selection, count)}
    </section>
  );
}

function renderBody(
  net: PetriNet,
  selection: { nodes: string[]; edges: string[] },
  count: number,
): JSX.Element {
  if (count === 0) return <Hint>Select an element to edit it.</Hint>;
  if (count > 1) return <Hint>{count} elements selected.</Hint>;

  if (selection.nodes.length === 1) {
    const id = selection.nodes[0];
    const place = net.places.find((p) => p.id === id);
    if (place) return <PlaceEditor key={id} place={place} />;
    const transition = net.transitions.find((t) => t.id === id);
    if (transition) return <TransitionEditor key={id} transition={transition} />;
  } else {
    const arc = net.arcs.find((a) => a.id === selection.edges[0]);
    if (arc) return <ArcEditor key={arc.id} arc={arc} />;
  }
  return <Hint>Select an element to edit it.</Hint>;
}

// --- editors ----------------------------------------------------------------

function PlaceEditor({ place }: { place: Place }): JSX.Element {
  const setTokens = (n: number): void => useNetStore.getState().setTokens(place.id, n);
  return (
    <div className="flex flex-col gap-3">
      <Kind>Place</Kind>
      <NameField id={place.id} name={place.name} kind="place" />
      <div>
        <FieldLabel>Tokens</FieldLabel>
        <div className="flex items-center gap-2">
          <StepButton label="−" onClick={() => setTokens(place.tokens - 1)} />
          <CommitField
            key={`tok-${place.tokens}`}
            type="number"
            defaultValue={place.tokens}
            onCommit={(raw) => commitNumber(raw, setTokens)}
          />
          <StepButton label="+" onClick={() => setTokens(place.tokens + 1)} />
        </div>
      </div>
      <DeleteButton id={place.id} />
    </div>
  );
}

function TransitionEditor({ transition }: { transition: Transition }): JSX.Element {
  const rotation = transition.gui?.rotation ?? 0;
  const rotate = (deg: number): void => useNetStore.getState().rotateTransition(transition.id, deg);
  return (
    <div className="flex flex-col gap-3">
      <Kind>Transition</Kind>
      <NameField id={transition.id} name={transition.name} kind="transition" />
      <div>
        <FieldLabel>Rotation (°)</FieldLabel>
        <div className="flex items-center gap-2">
          <StepButton label="−" onClick={() => rotate(rotation - 90)} />
          <CommitField
            key={`rot-${rotation}`}
            type="number"
            defaultValue={rotation}
            onCommit={(raw) => commitNumber(raw, rotate)}
          />
          <StepButton label="+" onClick={() => rotate(rotation + 90)} />
        </div>
      </div>
      <DeleteButton id={transition.id} />
    </div>
  );
}

function ArcEditor({ arc }: { arc: Arc }): JSX.Element {
  const setMultiplicity = (n: number): void => useNetStore.getState().setMultiplicity(arc.id, n);
  return (
    <div className="flex flex-col gap-3">
      <Kind>Arc</Kind>
      <div>
        <FieldLabel>Weight</FieldLabel>
        <CommitField
          key={`mul-${arc.multiplicity}`}
          type="number"
          defaultValue={arc.multiplicity}
          onCommit={(raw) => commitNumber(raw, setMultiplicity)}
        />
      </div>
      <DeleteButton id={arc.id} />
    </div>
  );
}

// --- shared fields ----------------------------------------------------------

/**
 * Name editor that keeps names unique within the node's {@link NodeKind}. A duplicate commit is
 * rejected inline (error shown, field keeps the typed value to correct) rather than reverted, and
 * the domain {@link NetOps.rename} stays total. Empty input is ignored, matching the other fields.
 */
function NameField({ id, name, kind }: { id: string; name: string; kind: NodeKind }): JSX.Element {
  const net = useNetStore((s) => s.net);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusRequested = useBuildStore((s) => s.nameFocusRequested);
  // Enter-to-rename: when the App keydown handler raises the one-shot request, take focus and
  // select all (so typing replaces the name), then consume the request.
  useEffect(() => {
    if (!focusRequested) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    useBuildStore.getState().consumeNameFocus();
  }, [focusRequested]);
  return (
    <div>
      <FieldLabel>Name</FieldLabel>
      <CommitField
        key={`name-${name}`}
        inputRef={inputRef}
        defaultValue={name}
        invalid={error !== null}
        onCommit={(raw) => {
          const trimmed = raw.trim();
          if (!trimmed) {
            setError(null);
            return;
          }
          if (NetOps.isNameTaken(net, kind, trimmed, id)) {
            setError(`A ${kind} named "${trimmed}" already exists.`);
            return;
          }
          setError(null);
          useNetStore.getState().rename(id, trimmed);
        }}
      />
      {error && <span className="mt-1 block text-red-600 text-xs">{error}</span>}
    </div>
  );
}

/**
 * Uncontrolled text/number field that commits on blur or Enter and reverts on Escape.
 * Keyed by its committed value at the call site so external changes (+/-, undo/redo) remount
 * it, while free typing stays local until commit — keeping one history entry per edit.
 */
function CommitField({
  defaultValue,
  onCommit,
  type = "text",
  invalid = false,
  inputRef,
}: {
  defaultValue: string | number;
  onCommit: (raw: string) => void;
  type?: "text" | "number";
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}): JSX.Element {
  return (
    <input
      ref={inputRef}
      type={type}
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          e.currentTarget.value = String(defaultValue);
          e.currentTarget.blur();
        }
      }}
      className={`w-full rounded border px-2 py-1 text-slate-800 text-sm ${
        invalid ? "border-red-400" : "border-slate-300"
      }`}
    />
  );
}

function DeleteButton({ id }: { id: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => useNetStore.getState().remove([id])}
      className="mt-1 w-1/2 self-center rounded border border-red-200 bg-white px-2.5 py-1 text-red-600 text-sm shadow-sm hover:bg-red-50"
    >
      Delete
    </button>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 w-7 shrink-0 rounded border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: string }): JSX.Element {
  return <span className="mb-1 block text-slate-500 text-xs">{children}</span>;
}

function Kind({ children }: { children: string }): JSX.Element {
  return <span className="font-semibold text-slate-800 text-sm">{children}</span>;
}

function Hint({ children }: { children: string | (string | number)[] }): JSX.Element {
  return <p className="text-slate-400 text-sm">{children}</p>;
}

// --- helpers ----------------------------------------------------------------

function commitNumber(raw: string, apply: (n: number) => void): void {
  const n = Number(raw);
  if (raw.trim() !== "" && Number.isFinite(n)) apply(n);
}
