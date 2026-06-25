// Normalized Petri-net domain model — the single source of truth.
// React Flow nodes/edges and the live simulation marking are derived from this.

/** A 2D point. Used for positions, label offsets, and arc waypoints. */
export interface Vec2 {
  x: number;
  y: number;
}

/** A place: holds tokens (its `tokens` value is the initial marking M0). */
export interface Place {
  id: string;
  name: string;
  tokens: number;
  position: Vec2;
  /** Relative offset of the name label from the node center. Absent => default offset. */
  labelPosition?: Vec2;
  /** Unknown `.npn` fields preserved verbatim for forward-compatible round-tripping. */
  _extra?: Record<string, unknown>;
}

/** A transition: fires to move tokens. Carries no tokens itself. */
export interface Transition {
  id: string;
  name: string;
  position: Vec2;
  labelPosition?: Vec2;
  /** GUI-only presentation state. `rotation` is in degrees; absent when unrotated. */
  gui?: { rotation: number };
  _extra?: Record<string, unknown>;
}

/**
 * A directed, weighted arc. Strictly bipartite: `source`/`target` is a
 * place→transition or transition→place pair (flattened from the nested `.npn` map).
 */
export interface Arc {
  id: string;
  source: string;
  target: string;
  /** Endpoint follows the node border when magnetic; stays at its stored point when free. */
  srcMagnetic: boolean;
  destMagnetic: boolean;
  /** Arc weight. */
  multiplicity: number;
  /** Full polyline including both endpoints; interior entries are waypoints. */
  points: Vec2[];
  /** Position of the weight label; shown only when `multiplicity > 1`. */
  labelPosition?: Vec2;
  /** Reserved hook for future arc kinds; v1 treats every arc as "normal" and never serializes this. */
  type?: "normal";
  _extra?: Record<string, unknown>;
}

export interface PetriNet {
  places: Place[];
  transitions: Transition[];
  arcs: Arc[];
}

/** A marking maps each place id to its current token count. */
export type Marking = Record<string, number>;
