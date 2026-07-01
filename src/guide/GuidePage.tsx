import { type JSX, type ReactNode, useEffect } from "react";
import { GuideNets } from "@/guide/exampleNets";
import { GuideDiagram } from "@/guide/GuideDiagram";
import { BugIcon, GitHubIcon } from "@/ui/icons";

const REPO_URL = "https://github.com/AnakinM/petrinet";
const NEW_ISSUE_URL = "https://github.com/AnakinM/petrinet/issues/new";

const CONTENTS: { id: string; label: string }[] = [
  { id: "what", label: "What is a Petri net?" },
  { id: "blocks", label: "The building blocks" },
  { id: "firing", label: "How firing works" },
  { id: "editor", label: "Using the editor" },
  { id: "first-net", label: "Building your first net" },
  { id: "simulate", label: "Running a simulation" },
  { id: "examples", label: "Example nets" },
  { id: "analytics", label: "Analysing a net" },
  { id: "io", label: "Importing and exporting" },
  { id: "controls", label: "Keyboard and mouse" },
  { id: "saving", label: "Saving your work" },
];

/**
 * The standalone `/guide` page: a "what is a Petri net" explainer plus a full how-to for the editor
 * and simulator. Every net diagram is rendered by the tool's own {@link GuideDiagram}, and
 * screenshots of the running app fill the {@link Screenshot} figures.
 */
export function GuidePage(): JSX.Element {
  useEffect(() => {
    document.title = "Guide to the PetriNet Editor and Simulator";
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <TopBar />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-10">
          <h1 className="font-bold text-3xl text-slate-900 tracking-tight">
            Guide to the PetriNet editor and simulator
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            This guide explains what a Petri net is and how to build, run, and analyse one with this
            editor. You do not need any prior background. Read it top to bottom the first time, or
            jump straight to the part you need from the contents below.
          </p>
        </header>

        <nav
          aria-label="Contents"
          className="mb-12 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="mb-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">
            On this page
          </h2>
          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {CONTENTS.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex gap-2 rounded px-1 py-1 text-slate-700 text-sm hover:bg-slate-100 hover:text-slate-900"
                >
                  <span className="text-slate-400 tabular-nums">{i + 1}.</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <WhatIsSection />
        <BlocksSection />
        <FiringSection />
        <EditorSection />
        <FirstNetSection />
        <SimulateSection />
        <ExamplesSection />
        <AnalyticsSection />
        <IoSection />
        <ControlsSection />
        <SavingSection />

        <div className="mt-14 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            That is everything you need to get started. The best way to learn is to open the editor
            and build a small net of your own.
          </p>
          <a
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-slate-900"
          >
            Open the editor
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// --- top bar and footer ------------------------------------------------------

function TopBar(): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-slate-200 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-3">
        <a href="/" className="flex items-center gap-2">
          <img src="/apple-touch-icon.png" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="font-semibold text-slate-800">PetriNet</span>
        </a>
        <span className="text-slate-400 text-sm">Guide</span>
        <a
          href="/"
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 text-sm shadow-sm hover:bg-slate-50"
        >
          Open the editor
        </a>
      </div>
    </header>
  );
}

function SiteFooter(): JSX.Element {
  return (
    <footer className="border-slate-200 border-t bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-slate-500 text-sm">
        <a href="/" className="hover:text-slate-800">
          Open the editor
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 hover:text-slate-800"
        >
          <GitHubIcon />
          GitHub
        </a>
        <a
          href={NEW_ISSUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 hover:text-slate-800"
        >
          <BugIcon />
          Report an issue
        </a>
      </div>
    </footer>
  );
}

// --- content sections --------------------------------------------------------

function WhatIsSection(): JSX.Element {
  return (
    <Section id="what" title="What is a Petri net?">
      <p>
        A Petri net is a way to draw and study systems where things happen in steps. It is
        especially good at describing processes that run in parallel, share resources, or wait on
        one another. People use Petri nets to model workflows, manufacturing lines, network
        protocols, and software behaviour, among many other things.
      </p>
      <p>
        A net is made of two kinds of shapes joined by arrows. Circles hold state, and bars make
        things happen. Small dots called tokens sit inside the circles and represent whatever the
        system is keeping track of, such as jobs, messages, or free slots. Running the net means
        moving those tokens around according to a simple and precise rule, which the next sections
        explain.
      </p>
      <p>
        The strength of a Petri net is that it is both a picture and a piece of mathematics. You can
        read it at a glance, and you can also reason about it exactly. That is why the same diagram
        can serve as documentation for a teammate and as input to an analysis that proves the system
        never deadlocks.
      </p>
    </Section>
  );
}

function BlocksSection(): JSX.Element {
  return (
    <Section id="blocks" title="The building blocks">
      <p>
        Every net in this editor is built from four things. Once you recognise them, you can read
        any Petri net.
      </p>
      <dl className="my-6 space-y-4">
        <Term name="Place">
          A circle that holds state. A place stands for a condition or a location, such as "job
          waiting" or "buffer slot free". Places are where tokens live.
        </Term>
        <Term name="Transition">
          A bar that represents an event or an action, such as "start job" or "send message". A
          transition is the only thing that can change the net, and it does so by firing.
        </Term>
        <Term name="Arc">
          An arrow that connects a place to a transition or a transition to a place. Arcs never join
          two places or two transitions. They show which places a transition reads from and which
          places it writes to.
        </Term>
        <Term name="Token">
          A dot inside a place. Tokens are the moving parts of the net. The number of tokens in each
          place is called the marking, and it is the current state of the whole system.
        </Term>
      </dl>
      <GuideDiagram
        net={GuideNets.anatomy()}
        caption="A place, a transition, and a place, joined by two arcs. P1 holds two tokens."
        className="my-8 max-w-md mx-auto"
      />
      <p>
        The arrangement of places, transitions, and arcs is the structure of the net, and it does
        not change while the net runs. The marking is what changes. When you save a net, the editor
        records the marking you set up as the starting point, which is known as the initial marking.
      </p>
      <p>
        A place can hold any number of tokens. The editor shows small counts as a cluster of dots
        and switches to a plain number once there are five or more, so a busy place stays easy to
        read.
      </p>
      <GuideDiagram
        net={GuideNets.tokenCounts()}
        caption="Three tokens are drawn as dots. Larger counts are shown as a number."
        className="my-8 max-w-xs mx-auto"
      />
    </Section>
  );
}

function FiringSection(): JSX.Element {
  return (
    <Section id="firing" title="How firing works">
      <p>
        Firing is the single rule that makes a net run. Everything a Petri net does comes from
        applying it over and over.
      </p>
      <p>
        A transition is called enabled when every place that feeds into it holds at least one token.
        An enabled transition may fire. When it fires, it takes one token from each of its input
        places and adds one token to each of its output places. Nothing else moves.
      </p>
      <p>
        In the net below, T1 is enabled because its input place P1 holds a token. Firing T1 removes
        that token from P1 and puts a token into P2.
      </p>
      <div className="my-8 grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
        <GuideDiagram net={GuideNets.firingBefore()} caption="Before: T1 is enabled." />
        <div aria-hidden className="text-center font-medium text-slate-400 text-sm">
          fire T1 →
        </div>
        <GuideDiagram net={GuideNets.firingAfter()} caption="After: the token has moved to P2." />
      </div>
      <p>
        Arcs can carry a weight, which is a number written next to the arrow. A weight says how many
        tokens that arc moves. A transition with a weighted input arc is only enabled when the input
        place holds at least that many tokens, and firing removes exactly that many. An arc with no
        number shown has a weight of one.
      </p>
      <p>
        In the next net the arc from P1 to T1 has a weight of two. T1 therefore needs two tokens in
        P1 before it can fire, and firing it removes two tokens from P1 and adds one to P2.
      </p>
      <GuideDiagram
        net={GuideNets.weighted()}
        caption="A weight of two on the input arc: T1 needs two tokens in P1 to fire."
        className="my-8 max-w-md mx-auto"
      />
      <p>
        This editor uses the classic place and transition rules described here. Weights are
        supported, and there is no upper limit on how many tokens a place may hold.
      </p>
    </Section>
  );
}

function EditorSection(): JSX.Element {
  return (
    <Section id="editor" title="Using the editor">
      <p>
        The editor has two modes, shown as a toggle at the top right. Build mode is for drawing and
        changing a net. Simulate mode is for running it. Build mode is where you spend most of your
        time, so start there.
      </p>
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">
        Placing places and transitions
      </h3>
      <p>
        The Palette in the left sidebar holds the tools for adding shapes. Choose Place or
        Transition, and a preview follows your cursor. Click anywhere on the canvas to drop a new
        shape there. The tool stays selected so you can add several in a row. Press Escape or
        right-click when you are done placing.
      </p>
      <Screenshot
        src="/guide/build-mode.png"
        alt="The PetriNet editor in Build mode, with the Palette and Properties panel on the left, the toolbar on top, and a net on the canvas."
        caption="The editor in Build mode. The Palette and Properties panel are on the left, the toolbar runs across the top, and the net sits on the canvas."
      />
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">Drawing arcs</h3>
      <p>
        To connect two shapes, move your cursor over a place or a transition. Two small round
        handles appear on its left and right edges. Press one handle and move toward the shape you
        want to reach, then click that shape to finish the arc. To bend an arc around something,
        click on empty canvas along the way to drop a corner, then carry on to the target.
      </p>
      <p>
        Remember that arcs are always between a place and a transition. The editor will not let you
        join two places or two transitions, because that is not a valid Petri net. Press Escape or
        right-click to cancel an arc you have started.
      </p>
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">Selecting and moving</h3>
      <p>
        Click a shape or an arc to select it. Drag a shape to move it, and any connected arcs follow
        along. To move several shapes at once, choose the Select tool and drag a box around them on
        empty canvas. Node positions snap to a grid so your net stays tidy, and light guides appear
        when a shape lines up with its neighbours. You can turn snapping off with the grid button in
        the toolbar.
      </p>
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">Adding tokens</h3>
      <p>
        Choose the Token tool from the Palette, then click a place to add a token to it. Hold Shift
        and click to remove one. This sets the initial marking, which is the starting state saved
        with your net. You can also set an exact token count in the Properties panel.
      </p>
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">Editing properties</h3>
      <p>
        Select a single element to edit it in the Properties panel on the left. A place lets you
        change its name and its token count. A transition lets you change its name and rotate it so
        the bar sits horizontally or vertically. An arc lets you set its weight. Each element has a
        Delete button, and pressing Delete or Backspace removes whatever is selected.
      </p>
    </Section>
  );
}

function FirstNetSection(): JSX.Element {
  return (
    <Section id="first-net" title="Building your first net">
      <p>
        Here is a short walkthrough that puts the tools together. It builds the simple net from the
        firing example above, where one token moves from one place to another.
      </p>
      <ol className="my-6 space-y-3">
        <Step n={1}>Make sure you are in Build mode using the toggle at the top right.</Step>
        <Step n={2}>
          Choose Place in the Palette and click the canvas to add a place. Click again a little to
          the right to add a second place. You now have P1 and P2.
        </Step>
        <Step n={3}>
          Choose Transition in the Palette and click between the two places to add a transition, T1.
          Press Escape to leave the placing tool.
        </Step>
        <Step n={4}>
          Hover over P1, press the round handle on its edge, move to T1, and click it. That draws an
          arc from P1 to T1. Do the same from T1 to P2.
        </Step>
        <Step n={5}>
          Choose the Token tool and click P1 once to give it a token. Your net is ready to run.
        </Step>
        <Step n={6}>
          Switch to Simulate mode. T1 should glow, which means it is enabled. Click it to fire, and
          watch the token move to P2.
        </Step>
      </ol>
      <p>
        That is the whole loop of using the tool: place shapes, connect them, add tokens, then
        switch to Simulate and fire. Everything else builds on these steps.
      </p>
    </Section>
  );
}

function SimulateSection(): JSX.Element {
  return (
    <Section id="simulate" title="Running a simulation">
      <p>
        Switch to Simulate mode using the toggle at the top right. The structure of the net locks so
        you cannot change it by accident, and the editor starts from the initial marking you set up
        in Build mode.
      </p>
      <p>
        Every transition that is currently enabled glows green. Click a glowing transition to fire
        it. Its tokens move along the arcs and the transition flashes briefly. Transitions that are
        not enabled stay grey and do nothing when clicked.
      </p>
      <Screenshot
        src="/guide/simulate-mode.png"
        alt="The editor in Simulate mode, with enabled transitions glowing green and the simulation controls in the left sidebar."
        caption="Simulate mode. Enabled transitions glow green on the canvas, and the simulation controls and history log sit in the left sidebar."
      />
      <p>
        The left sidebar holds the simulation controls. Use them to run the net without clicking
        each transition yourself.
      </p>
      <dl className="my-6 space-y-4">
        <Term name="Play and Pause">
          Play fires enabled transitions automatically, one after another, until nothing can fire.
          Pause stops the run so you can look at the current state.
        </Term>
        <Term name="Step">
          Fires a single enabled transition and then waits. This is the way to move through a net
          one event at a time.
        </Term>
        <Term name="Speed">
          Sets how many transitions fire each second while playing, from one up to ten.
        </Term>
        <Term name="Reset">
          Returns the net to its initial marking and clears the run, so you can start again.
        </Term>
      </dl>
      <p>
        When more than one transition is enabled at the same time, auto-run and Step pick one of
        them at random. The run stops on its own when the net reaches a state where no transition
        can fire.
      </p>
      <p>
        Below the controls, the History log lists every transition that has fired, starting from the
        initial marking. Click any row to jump back to that moment and see the marking as it was
        then. If you fire again from an earlier point, the steps that came after it are replaced by
        the new path.
      </p>
    </Section>
  );
}

function ExamplesSection(): JSX.Element {
  return (
    <Section id="examples" title="Example nets">
      <p>
        A couple of small examples show the kinds of behaviour Petri nets capture well. Try
        recreating them in the editor and running them.
      </p>
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">A traffic light</h3>
      <p>
        A single token moves around a loop, standing for the light that is currently lit. Each
        transition moves the token to the next colour. Because there is only ever one token, only
        one light is on at a time, and the net cycles forever.
      </p>
      <GuideDiagram
        net={GuideNets.trafficLight()}
        caption="One token cycles through Red, Green, and Yellow."
        className="my-8 max-w-md mx-auto"
      />
      <h3 className="mt-8 mb-3 font-semibold text-lg text-slate-900">Fork and join</h3>
      <p>
        This net shows work splitting into two parallel tasks and then coming back together. Firing
        Split puts a token into both Task A and Task B, so the two tasks can proceed at the same
        time. Join needs a token in both tasks before it can fire, so it waits until they are both
        finished. This pattern of splitting and synchronising is one of the things Petri nets are
        best known for.
      </p>
      <GuideDiagram
        net={GuideNets.forkJoin()}
        caption="Split starts two parallel tasks, and Join waits for both before continuing."
        className="my-8 max-w-lg mx-auto"
      />
    </Section>
  );
}

function AnalyticsSection(): JSX.Element {
  return (
    <Section id="analytics" title="Analysing a net">
      <p>
        Open the Analytics panel from the button in the top bar. It reads your net and reports on it
        without changing anything, so you can open it at any time. The panel is organised into tabs.
      </p>
      <dl className="my-6 space-y-4">
        <Term name="Properties">
          Checks behavioural properties of the net, such as whether it is bounded and whether it can
          reach a deadlock. Each result comes with the reasons behind it.
        </Term>
        <Term name="Invariants">
          Lists the place and transition invariants of the net. These are combinations that stay
          constant as the net runs, and they are a standard tool for reasoning about correctness.
        </Term>
        <Term name="Structure">
          Describes the shape of the net, including its strongly connected components and cycles. It
          also lets you ask whether a particular marking can be reached.
        </Term>
        <Term name="Classification">
          Tells you which well known family the net belongs to, such as a state machine, a marked
          graph, a free choice net, or an ordinary net, and points out the elements that break each
          rule.
        </Term>
      </dl>
      <p>
        Many results can be shown on the canvas. Clicking a finding highlights the places or
        transitions it refers to and brings them into view, which makes it easy to connect an
        analysis result back to the diagram.
      </p>
      <Screenshot
        src="/guide/analytics-panel.png"
        alt="The Analytics panel open beside the canvas, with several places highlighted on the net."
        caption="The Analytics panel open beside the canvas. Clicking a result highlights the elements it refers to and brings them into view."
      />
    </Section>
  );
}

function IoSection(): JSX.Element {
  return (
    <Section id="io" title="Importing and exporting">
      <p>
        The toolbar at the top has everything you need to start fresh, open a file, or save your
        work.
      </p>
      <dl className="my-6 space-y-4">
        <Term name="New">Clears the canvas so you can start a new net.</Term>
        <Term name="Import">
          Opens a saved net from a file. Both the tool's own .npn format and the standard .pnml
          format are accepted, and the editor detects which one you picked.
        </Term>
        <Term name="Export">
          Saves your net as a .npn file. This is the tool's own format, and it preserves your net
          exactly, so opening the file again gives you back what you had.
        </Term>
        <Term name="Export as">
          Offers other formats. PNML lets you exchange the net with other Petri net tools. PNG and
          SVG save a picture of the net for a report or a slide.
        </Term>
      </dl>
      <p>
        The picture you get from PNG or SVG matches what is on screen, so it includes the current
        tokens. Export a diagram from Simulate mode to capture a net in the middle of a run.
      </p>
    </Section>
  );
}

function ControlsSection(): JSX.Element {
  return (
    <Section id="controls" title="Keyboard and mouse">
      <p>
        These shortcuts speed up editing. They apply in Build mode, where you are changing the net.
      </p>
      <div className="my-6 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-200">
            <ShortcutRow action="Undo" keys={["Ctrl / Cmd", "Z"]} />
            <ShortcutRow action="Redo" keys={["Ctrl / Cmd", "Shift", "Z"]} />
            <ShortcutRow action="Copy the selection" keys={["Ctrl / Cmd", "C"]} />
            <ShortcutRow action="Paste" keys={["Ctrl / Cmd", "V"]} />
            <ShortcutRow action="Delete the selection" keys={["Delete"]} />
            <ShortcutRow action="Rename the selected shape" keys={["Enter"]} />
            <ShortcutRow action="Cancel or clear" keys={["Escape"]} />
          </tbody>
        </table>
      </div>
      <p>The mouse handles everything else. Here is what each gesture does on the canvas.</p>
      <dl className="my-6 space-y-4">
        <Term name="Move around">
          Drag an empty part of the canvas to pan, or scroll. Hold Ctrl or Cmd and scroll to zoom,
          use the controls at the bottom left, or double-click empty canvas to zoom in.
        </Term>
        <Term name="Select">
          Click a shape or an arc. With the Select tool, drag a box on empty canvas to select
          several shapes at once.
        </Term>
        <Term name="Right-click">
          Right-click is the general way to back out. It cancels an arc you are drawing, leaves a
          placing tool, removes a corner when you click near one on a selected arc, and otherwise
          clears the current selection.
        </Term>
      </dl>
    </Section>
  );
}

function SavingSection(): JSX.Element {
  return (
    <Section id="saving" title="Saving your work">
      <p>
        Your net and your current view are saved in your browser automatically as you work. When you
        come back to the page, your last net is waiting for you. Nothing is uploaded to a server,
        and there is no account to create, so your work stays on your own machine.
      </p>
      <p>
        Because the net lives in your browser, clearing your site data will remove it. To keep a
        permanent copy, or to move a net to another computer, use Export to save it as a file. You
        can open that file again at any time with Import.
      </p>
    </Section>
  );
}

// --- small building blocks ---------------------------------------------------

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="scroll-mt-20 border-slate-200 border-t py-10">
      <h2 className="mb-4 font-bold text-2xl text-slate-900 tracking-tight">{title}</h2>
      <div className="space-y-4 text-slate-700 leading-relaxed [&_p]:text-[15px]">{children}</div>
    </section>
  );
}

function Term({ name, children }: { name: string; children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="font-semibold text-slate-900">{name}</dt>
      <dd className="mt-1 text-slate-600 text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }): JSX.Element {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-white text-xs">
        {n}
      </span>
      <span className="text-slate-700">{children}</span>
    </li>
  );
}

function ShortcutRow({ action, keys }: { action: string; keys: string[] }): JSX.Element {
  return (
    <tr>
      <td className="px-4 py-2.5 text-slate-700">{action}</td>
      <td className="px-4 py-2.5 text-right">
        <span className="inline-flex flex-wrap justify-end gap-1">
          {keys.map((k, i) => (
            <span key={k} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-slate-400">+</span>}
              <Kbd>{k}</Kbd>
            </span>
          ))}
        </span>
      </td>
    </tr>
  );
}

function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return (
    <kbd className="rounded border border-slate-300 border-b-2 bg-slate-100 px-1.5 py-0.5 font-medium font-mono text-slate-700 text-xs">
      {children}
    </kbd>
  );
}

/**
 * A screenshot of the running app (the UI-chrome half of the hybrid visuals; the net diagrams are
 * tool-rendered). Lazy-loaded, framed to match the diagrams, with a caption below.
 */
function Screenshot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}): JSX.Element {
  return (
    <figure className="my-8">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-lg border border-slate-200 shadow-sm"
      />
      <figcaption className="mt-3 text-center text-slate-500 text-sm">{caption}</figcaption>
    </figure>
  );
}
