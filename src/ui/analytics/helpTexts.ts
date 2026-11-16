/** One help text: what the term means, what it tells the student, and an example. */
export interface HelpText {
  meaning: string;
  tellsYou: string;
  example: string;
}

/** Every term that has a help card. The name is also the heading of its card. */
export type HelpTopic =
  | "Bounded"
  | "Safe"
  | "Conservative"
  | "Live"
  | "Reversible"
  | "Deadlock-free"
  | "Ordinary"
  | "State machine"
  | "Marked graph"
  | "Free choice"
  | "Place invariants"
  | "Transition invariants"
  | "Loops"
  | "Net facts"
  | "Reachability query"
  | "State table"
  | "Incidence matrix"
  | "Place bounds";

/**
 * The help texts of the Analysis panel, approved by the owner on 2026-11-16. They are kept word for
 * word in one place so the owner can review them together. Change them only with the owner's word.
 */
export const HELP_TEXTS: Record<HelpTopic, HelpText> = {
  Bounded: {
    meaning:
      "A net is bounded when no place can collect tokens without limit. There is a number k that no place ever exceeds.",
    tellsYou:
      "A bounded net has a finite number of states, so the full analysis can check every other property completely, up to 10,000 markings. For an unbounded net, Live and Reversible stay unknown. An unbounded place often stands for a buffer or a queue that can overflow. If every place belongs to a place invariant, the net stays bounded for any starting tokens. The card then says structurally bounded.",
    example:
      "A transition with no input place can fire forever. Each firing adds a token to its output place, so the net is unbounded.",
  },
  Safe: {
    meaning:
      "A net is safe when no place ever holds more than one token. It is the strictest kind of bounded net.",
    tellsYou:
      "In a safe net each place works like a condition that is true or false. Models of control logic often need this.",
    example:
      "A traffic light with one token that moves between Red, Green and Yellow is safe. With two tokens in Red it is not.",
  },
  Conservative: {
    meaning:
      "A net is conservative when a weighted count of all tokens never changes. Each place gets a positive weight, and every firing keeps the weighted total the same. It is strictly conservative when the plain number of tokens never changes.",
    tellsYou:
      "Tokens then behave like resources that move around. Counted with their weights, they are never created or destroyed. A conservative net is always bounded.",
    example:
      "A transition that takes one token and returns one token keeps the count. A transition that takes one token and produces two breaks strict conservation.",
  },
  Live: {
    meaning:
      "A net is live when every transition can always fire again at some later point, whatever has happened so far.",
    tellsYou:
      "No part of a live net stops working for good. If the net is not live, some transition can lose the ability to fire for ever. The card also names the transitions that never fire at all. A net in which every transition can fire at least once is called quasi-live.",
    example:
      "A transition that needs a token from a place that is filled only once can fire once. After that it is dead, so the net is not live.",
  },
  Reversible: {
    meaning:
      "A net is reversible when it can always get back to its initial marking, from every marking it can reach.",
    tellsYou:
      "A reversible system can always return to its starting state. Machines that work in cycles should have this property.",
    example:
      "A token that travels around a ring of places comes back to its start, so the net is reversible. A net that uses up its starting token for good is not.",
  },
  "Deadlock-free": {
    meaning:
      "A net is deadlock-free when it can never reach a marking in which no transition can fire.",
    tellsYou:
      "A deadlock means the whole system is stuck. The card shows each stuck marking that was found and a firing sequence that leads to it. Deadlock-free is weaker than live: the net keeps moving, but single transitions can still die.",
    example:
      "Two processes each hold one resource and wait for the other's resource. Neither can continue. That marking is a deadlock.",
  },
  Ordinary: {
    meaning: "A net is ordinary when every arc has weight 1.",
    tellsYou:
      "The other classes on this tab require an ordinary net, as in most textbooks, and many theorems assume one. The card counts the arcs with a higher weight and lists the places and transitions at their ends.",
    example:
      "An arc with weight 2 moves two tokens in one firing. One such arc makes the net non-ordinary.",
  },
  "State machine": {
    meaning:
      "A state machine is a net in which every transition has exactly one input place and exactly one output place, and every arc has weight 1.",
    tellsYou:
      "Such a net can model choices but no synchronisation, because a transition never splits or joins flows. With one token it behaves like a classic state diagram.",
    example:
      "A place with two outgoing transitions is allowed: that is a choice. A transition with two output places is not allowed.",
  },
  "Marked graph": {
    meaning:
      "A marked graph is a net in which every place has exactly one input transition and exactly one output transition, and every arc has weight 1.",
    tellsYou:
      "Such a net can model parallel activity and synchronisation but no choice, because a token never has two ways to go. It is the mirror image of a state machine.",
    example:
      "A transition that starts two parallel branches is allowed. A place from which two different transitions can take the token is not allowed.",
  },
  "Free choice": {
    meaning:
      "A net is free-choice when transitions that share an input place have no other input places, and every arc has weight 1.",
    tellsYou:
      "A choice between transitions then depends on one place only, and the rest of the net cannot influence it. Free-choice nets have strong theorems that make liveness easier to check.",
    example:
      "Place P feeds T1 and T2. If T2 also needs a token from place Q, the choice is not free.",
  },
  "Place invariants": {
    meaning:
      "A place invariant is a set of places, each with a positive whole-number weight. Every transition leaves their weighted token count unchanged when it fires, so the count is the same in every reachable marking. The panel lists the basic invariants. Every other one is a weighted sum of them.",
    tellsYou:
      'It is a conservation law of your model, such as "the machine is always either idle or busy". If every place belongs to some invariant, the net is bounded.',
    example:
      "If Idle + Busy = 1 is an invariant, exactly one of the two places holds a token at any time.",
  },
  "Transition invariants": {
    meaning:
      "A transition invariant is a collection of firings, each transition a given number of times, that brings the net back to the marking it started from. The panel lists the basic invariants. Every other one is a weighted sum of them.",
    tellsYou:
      "It describes a possible cycle of the system. It does not promise that the firings can really happen: that depends on the marking. In a net that is live and bounded, every transition belongs to some invariant. A net in which every transition belongs to some invariant is called consistent.",
    example:
      "Firing Start once and Finish once returns every token to its place, so Start and Finish together form a transition invariant.",
  },
  Loops: {
    meaning:
      "A loop is a group of places and transitions in which you can follow the arcs from any element to any other element of the group. Each group is as large as possible, so two cycles that share an element form one loop.",
    tellsYou:
      "Loops are the parts of the net where tokens can circulate. Click a loop to see it on the canvas.",
    example:
      "Place A feeds transition T, T feeds place B, and B leads back to A through transition U. The four elements form a loop.",
  },
  "Net facts": {
    meaning:
      "Basic facts about the shape of the net. Connected means that every element is linked to every other one by some chain of arcs, whatever their direction. A source has only outgoing arcs, a sink has only incoming arcs, and an isolated element has no arcs at all.",
    tellsYou:
      "These facts often reveal drawing mistakes. An isolated element or a second, separate part usually means a forgotten arc. A source transition can fire for ever, which makes the net unbounded.",
    example: "A place that only receives tokens and never gives them back is a sink place.",
  },
  "Reachability query": {
    meaning:
      "A marking is reachable when some sequence of firings leads from the initial marking to it. The query asks about one exact marking: every place must hold exactly the number you enter.",
    tellsYou:
      'Use the query to test a state that should happen, such as "both jobs done", or one that must never happen, such as "two trains on one track". A "no" covers only the exact numbers you entered.',
    example:
      "The fields start with the initial marking. Enter 0 for Ready and 4 for Done to ask whether all four jobs can finish.",
  },
  "State table": {
    meaning:
      "The table lists every marking the net can reach from the initial marking. For each one it shows the transitions that can fire and the marking each firing leads to. If the net is unbounded or has more than 10,000 markings, the table shows only the part that was explored.",
    tellsYou:
      "This is the reachability graph in table form. Each row is a node and each firing is an edge. Use it to draw the graph for your report.",
    example: 'Row M0 with "T1 to M1" means: firing T1 in the initial marking gives marking M1.',
  },
  "Incidence matrix": {
    meaning:
      "The incidence matrix has one row per place and one column per transition. Each entry says how many tokens one firing of the transition adds to the place (positive) or takes from it (negative).",
    tellsYou:
      "It is the net written as algebra. The invariants are computed from it. A transition that takes a token from a place and puts it back shows as 0.",
    example:
      "The entry -1 in row Ready and column Start means: firing Start removes one token from Ready.",
  },
  "Place bounds": {
    meaning:
      "The bound of a place is the largest number of tokens it holds in any reachable marking.",
    tellsYou:
      'It answers "how big must this buffer be?" for each place. A place with bound 1 is safe. A place with no bound makes the net unbounded. If the net is unbounded or has more than 10,000 markings, the numbers are only lower limits.',
    example: "If Buffer has bound 3, no firing sequence ever puts a fourth token into it.",
  },
};
