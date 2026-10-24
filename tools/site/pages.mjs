#!/usr/bin/env node
// Writes the use-case pages and the Niagara VFX store page from the content in this file, then
// run build.mjs to fill their media and facts:
//
//   node tools/site/pages.mjs && node tools/site/build.mjs && node tools/site/verify.mjs
//
// These pages are generated: edit the content here, never the HTML they produce. Every product
// claim must trace to facts.json / the 3.6 claims sheet; the store comes from data/products.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'facts.json'), 'utf8'));
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const SITE = 'https://uedevlabs.github.io/';
const PRODUCT = 'unreal-engine-3d-pathfinding/';
const FAB = facts.product.fab;
const DOCS = facts.product.docs;
const UPDATED = facts.updated;
const V = '?v=20261024';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const pic = (slug, sizes = '(min-width:860px) 52vw, 100vw', extra = '') => `<!-- @picture slug="${slug}" sizes="${sizes}"${extra} -->\n<!-- /@picture -->`;
const vid = (slug, extra = '') => `<!-- @loop slug="${slug}"${extra} -->\n<!-- /@loop -->`;
const still = (slug) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'media', 'media.json'), 'utf8')).stills.find((s) => s.slug === slug);

// The moving-obstacle diagram (also on the 3D pathfinding page).
const PREDICT_SVG = `<svg class="xpredict" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Diagram: a drone predicts when a moving gate will open, waits at the gate, then flies through the gap.">
  <g class="grid"><line x1="0" y1="60" x2="640" y2="60"/><line x1="0" y1="120" x2="640" y2="120"/><line x1="0" y1="180" x2="640" y2="180"/><line x1="0" y1="240" x2="640" y2="240"/><line x1="0" y1="300" x2="640" y2="300"/><line x1="80" y1="0" x2="80" y2="360"/><line x1="160" y1="0" x2="160" y2="360"/><line x1="240" y1="0" x2="240" y2="360"/><line x1="320" y1="0" x2="320" y2="360"/><line x1="400" y1="0" x2="400" y2="360"/><line x1="480" y1="0" x2="480" y2="360"/><line x1="560" y1="0" x2="560" y2="360"/></g>
  <line class="path" x1="60" y1="180" x2="600" y2="180"/>
  <circle class="tick" cx="140" cy="180" r="2.5"/><circle class="tick" cx="220" cy="180" r="2.5"/><circle class="tick" cx="440" cy="180" r="2.5"/><circle class="tick" cx="520" cy="180" r="2.5"/>
  <rect class="ghost" x="330" y="38" width="30" height="100" rx="3"/>
  <rect class="door" x="330" y="130" width="30" height="100" rx="3"/>
  <rect class="wall" x="326" y="0" width="38" height="130" rx="3"/>
  <rect class="wall" x="326" y="230" width="38" height="130" rx="3"/>
  <g class="drone"><circle class="halo" cx="60" cy="180" r="18"/><circle class="core" cx="60" cy="180" r="6"/></g>
  <text class="label label--hot" x="374" y="92">predicted gap</text>
  <text class="label" x="374" y="296">gate cycle · learned</text>
  <text class="label" x="40" y="330">fly to · avoid moving obstacles</text>
</svg>`;

/* ------------------------------------------------------------------ */
/* Use-case pages                                                      */
/* ------------------------------------------------------------------ */

const USE_CASES = [
  {
    slug: 'unreal-engine-flying-ai',
    nav: 'Flying AI',
    title: 'Drone & Flying AI for UE5 — LCM 3D Navigation AI',
    description: 'Flying AI and drone AI for Unreal Engine 5: true 3D routes, 6-DOF flight, landing on moving decks, perching birds and combat drones that hunt and engage.',
    kicker: 'Use case · Flying AI',
    h1: 'Flying AI and <em>drones</em> for Unreal Engine 5',
    lede: 'Drones that bank into their turns, land on a rolling ship\'s deck and hunt through city streets — and birds that glide in to perch on a cliff ledge. LCM 3D Navigation AI gives every flying agent a real route through the air, a 6-DOF body that flies it, and a library of ready-made behaviours, from one hero drone to a Mass Entity flock.',
    hero: { loop: 'loop-harbour-ship-landing', still: 'harbour-drone-lands-moving-ship' },
    glance: [['4', 'Flight archetypes'], ['<span data-fact="ai.aiNodesTotal">85</span>', 'BT, StateTree &amp; Mass nodes'], ['10,000+', 'Mass Entity agents'], ['<span data-fact="compatibility.engineRange">5.2–5.8</span>', 'Unreal Engine']],
    sections: [
      { media: pic('city-open-world-drone-routes'), cap: 'Drones and their planned routes over a streamed city',
        kicker: 'Routes', h2: 'A route through the air, not along a floor',
        body: `<p>Unreal's Recast navmesh describes where a character can stand. A drone needs to know where there is empty air, so LCM 3D Navigation AI carves the level into a Sparse Voxel Octree of navigable volume and plans through it in full 3D — up, down and diagonally through shafts, under bridges and between towers.</p>
<p>Theta* and Lazy Theta* give any-angle routes that cut the corners a grid would force, and every smoothed path is checked against the level's geometry, so a drone never cuts through a wall to reach its goal.</p>` },
      { media: pic('harbour-drone-quay-closeup'), cap: 'A multirotor drone over the harbour quay',
        kicker: 'Flight', h2: 'A body that flies like the real thing',
        body: `<p>Navigation gives guidance; <code>LcmFlightMovementComponent</code> turns it into flight. Four archetypes each bank, climb, glide and stop differently: <strong>Multirotor drone</strong> (tilt-to-translate), <strong>Jet / Fixed-Wing</strong>, <strong>Bird</strong> (flap-glide) and <strong>Fish</strong>. Thrust, lift, drag and an attitude PID drive the body, with inertia, turn-rate limits and arrival deceleration, and an animation-drive struct feeds your blendspaces.</p>
<p>Flight follows the level's gravity (World Settings or a Physics Volume), and Max Pitch, Flare Pitch and Leg Friction are set per bird in its Flight Config.</p>` },
      { media: vid('loop-gulls-perch'), cap: 'Gulls sweep in and one settles on the sea stack',
        kicker: 'Take off, land, perch', h2: 'Landing — even on a moving deck',
        body: `<p>The <strong>Land</strong> task finds its own landing point and flies the approach relative to the deck, so a courier drone can put down on a moving, rolling ship or a moving lorry and take off again with the deck's velocity. Drones descend vertically; birds glide in with a braking flare. EQS generators and tests find landing sites for flying agents.</p>
<p><strong>Perch</strong> lands on tagged ledges and pads, and agents in a crowd share the work: no two take the same perch. Since 3.6 drones no longer bob over a perch or a landing pad, and gliding birds land from where they are.</p>` },
      { media: pic('hunter-drones-container-stacks'), cap: 'Hunter drones weave between container stacks',
        kicker: 'Combat AI', h2: 'Drones that hunt, engage and search',
        body: `<p><strong>Engage Target</strong> finds a firing position, keeps line of sight and fires only on a clean shot. In 3.6 it holds that position until the target leaves it, flies to it in formation and leads a crossing target. <strong>Investigate</strong> searches around a last-known position, hunters remember what they lose sight of, <strong>Flee</strong> breaks line of sight and hides, and <strong>Scan Area</strong> sweeps a volume.</p>
<p>Sentries can see only through Unreal's AI Perception sight cones, and Engage can take its sightings from AI Perception.</p>` },
      { media: pic('node-fly-to-location', '(min-width:860px) 52vw, 100vw'), cap: 'The Fly To Location node in the Feature Examples hall',
        kicker: 'Authoring', h2: 'Behaviour Tree, StateTree — or one Blueprint node',
        body: `<p>Author the same flight in the system your team already uses: 21 Behaviour Tree tasks, 5 decorators and 5 services; 25 StateTree tasks, 8 conditions and 8 evaluators at full parity; or Mass StateTree for crowds. For the simplest case, the <code>Fly To Location</code> latent node flies any pawn to a point or an actor with no Behaviour Tree, StateTree or AI Controller, and Unreal's own Move To and EQS can plan through the octree too.</p>` },
    ],
    demos: [
      { name: 'Harbour', still: 'harbour-drone-lands-moving-ship', text: 'A courier drone lands on a moving, rolling ship and a moving lorry.', chips: ['Land', 'Take Off', 'BT · StateTree'] },
      { name: 'Hunter Drone', still: 'hunter-drone-closeup', text: 'A gunner drone hunts a runner through the streets; Hunter Pack in Mass.', chips: ['Engage Target', 'BT · ST · Mass'] },
      { name: 'Sentry Drones', still: 'sentry-drones-depot-octree', text: 'Sentries see only through AI Perception, take EQS firing positions and land.', chips: ['AI Perception', 'BT · ST · Mass'] },
      { name: 'Warehouse', still: 'warehouse-drone-aisle', text: 'A security drone perches, sweeps the hall, engages a thief and searches.', chips: ['Perch', 'Investigate', 'BT · ST · Mass'] },
      { name: 'Sea Cliffs', still: 'gull-sea-cliffs', text: 'A colony of 6-DOF gulls perch, ride an updraft and scatter.', chips: ['Perch', 'Orbit', 'BT · StateTree'] },
      { name: 'City', still: 'mass-swarm-over-skyline', text: 'Streamed open world with rooftop gaps and street canyons.', chips: ['Open world', 'BT · ST · Mass'] },
    ],
    faq: [
      ['How do I make a drone fly to a location in Unreal Engine 5?', 'Place one LcmNavigationManagerSVO in the level so it builds the navigation octree, add LcmFlightMovementComponent to the drone pawn with the Multirotor archetype, then use the Fly To task in a Behaviour Tree or StateTree. For a one-off move, the Fly To Location Blueprint node flies the pawn with no AI Controller at all.'],
      ['Can a drone land on a moving ship or vehicle?', 'Yes. The Land task finds its own landing point and flies the approach relative to the deck, so a drone can land on a moving, rolling ship or a moving lorry and take off again with the deck\'s velocity. The Harbour demo shows both.'],
      ['Which flight models are included?', 'Four 6-DOF archetypes: Multirotor drone (tilt-to-translate), Jet / Fixed-Wing, Bird (flap-glide) and Fish (undulatory), each with its own banking, climb and turn character and tuned per agent.'],
      ['Can flying AI and ground AI share a level?', 'Yes. Run hybrid levels where walking agents use Unreal\'s Recast navmesh and flying agents use the volumetric octree; the Crowd Avoidance Bridge lets Detour steer Recast agents around flying pawns.'],
    ],
    docs: [['Your first flying agent', 'your-first-flying-agent.html'], ['Flight and locomotion', 'flight-locomotion.html'], ['Fly To Location node', 'fly-to-location.html'], ['AI perception', 'ai-perception.html'], ['Tactical EQS', 'tactical-eqs.html']],
    related: ['unreal-engine-moving-obstacle-avoidance', 'unreal-engine-space-combat-ai', 'unreal-engine-mass-entity-crowds'],
  },

  {
    slug: 'unreal-engine-underwater-ai',
    nav: 'Underwater',
    title: 'Fish & Underwater AI for UE5 — LCM 3D Navigation AI',
    description: 'Underwater and fish AI for Unreal Engine 5: schooling, true 3D swim navigation through the whole water column, Mass Entity schools and 1 cm aquariums.',
    kicker: 'Use case · Underwater AI',
    h1: 'Underwater and <em>fish AI</em> for Unreal Engine 5',
    lede: 'Schools that hold their depth, part round a predator and turn off the glass before they reach it; an ROV that surveys a reef; turtles that settle on the seabed. Swimming agents use the whole water column on true 3D routes — from an open reef to a 120&nbsp;cm aquarium navigated at 1&nbsp;cm.',
    hero: { loop: 'loop-reef-school', still: 'reef-school-mass' },
    glance: [['0.5<small>cm</small>', 'Smallest voxel'], ['1<small>cm</small>', 'Fish Tank demo voxels'], ['10,000+', 'Mass Entity agents'], ['3.6', 'New swim model']],
    sections: [
      { media: pic('coral-reef-fish'), cap: 'Fish over the coral in the Coral Reef demo',
        kicker: 'Volume', h2: 'The whole water column',
        body: `<p>A navmesh with a depth offset is a floor plan. LCM 3D Navigation AI routes swimming agents through the full volume — over reefs, under structures and through arches — on genuine 3D paths. Fish inside a Water Volume never swim out of it, and since 3.6 water volumes and overlap-only triggers no longer read as solid to the agents' own checks, so fish find cover and turtles find the seabed.</p>` },
      { media: pic('coral-reef-angelfish'), cap: 'Angelfish above the reef',
        kicker: 'New in 3.6', h2: 'Fish that swim like fish',
        body: `<p>Fish keep their depth by pointing the nose instead of sliding up and down, swim upright, school side by side and in layers, and turn away from walls at once. The tail beats with the swimming speed (Tail Beat From Speed in the Flight Config) and a skeletal fish's swim animation plays at the same rate.</p>
<p>A fish slows down so its turning circle fits the way onto its target instead of circling it, and keeps its personal space even with schooling off. Its body size is measured from its meshes.</p>` },
      { media: pic('reef-school-crowd'), cap: 'A Mass school turning together over the reef',
        kicker: 'Schooling', h2: 'Schooling, for one pawn or a Mass crowd',
        body: `<p>Turn on Schooling on a Mass crowd or on a pawn's Flight Movement component and it steers as a school: personal space, collision anticipation, heading matching, and turning away from rocks and glass before reaching them. A few informed fish lead the rest, a predator sets off a fountain escape that spreads through the school, and fish swim in bursts and glides. Distances are in body lengths, so it works at any scale.</p>` },
      { media: pic('fish-tank-realtime'), cap: 'The 1 cm fish tank, captured in real time',
        kicker: 'Small worlds', h2: 'An aquarium at 1&nbsp;cm',
        body: `<p>Voxels go down to 0.5&nbsp;cm, and a World Scale profile handles centimetre-scale worlds. The Fish Tank demo navigates a 120&nbsp;cm aquarium at 1&nbsp;cm: 8&nbsp;cm fish through a rock arch and round a predator's lair, in Behaviour Tree, StateTree and Mass editions.</p>` },
      { media: pic('fish-tank-closeup'), cap: '8 cm fish at small-world scale',
        kicker: 'Behaviours', h2: 'Behaviours under water',
        body: `<p>The same behaviour library works for swimmers. In the Coral Reef demo an ROV surveys the reef with <strong>Scan Area</strong>, the school darts into the coral out of its sight with <strong>Flee</strong>, groupers turn to watch it with <strong>Look At</strong>, and turtles settle on the seabed with <strong>Perch</strong>.</p>` },
    ],
    demos: [
      { name: 'Coral Reef', still: 'coral-reef-fish', text: 'An ROV surveys a reef; the school hides in the coral; turtles settle on the seabed.', chips: ['Scan Area', 'Flee', 'BT · StateTree'] },
      { name: 'Reef School', still: 'reef-school-mass', text: 'A Mass school of forty follows its lead fish round the reef on the flow field.', chips: ['Mass', 'Schooling'] },
      { name: 'Fish Tank', still: 'fish-tank-120cm', text: 'A 120 cm aquarium navigated at 1 cm, round a hunting predator.', chips: ['1 cm voxels', 'BT · ST · Mass'] },
    ],
    faq: [
      ['How do I make fish AI swim in Unreal Engine 5?', 'Add LcmFlightMovementComponent to the fish pawn with the Fish archetype, place an LcmNavigationManagerSVO so the water volume is navigable in 3D, and drive it with the Fly To task in a Behaviour Tree or StateTree, or with a Mass trait for a school.'],
      ['Does it support fish schooling?', 'Yes, for single pawns and for Mass Entity crowds: personal space, collision anticipation, heading matching, informed leaders, predator escape and burst-and-glide swimming, with distances in body lengths.'],
      ['Can it navigate a small aquarium?', 'Yes. Voxels go down to 0.5 cm and a World Scale profile handles centimetre-scale worlds; the Fish Tank demo navigates a 120 cm aquarium at 1 cm.'],
      ['Do fish stay inside a Water Volume?', 'Yes. Fish inside a Water Volume never swim out of it, and water volumes and overlap-only triggers are not treated as walls by the agents\' own checks.'],
    ],
    docs: [['Small worlds', 'small-worlds.html'], ['Flight and locomotion', 'flight-locomotion.html'], ['Mass Entity crowds', 'mass-entity-crowds.html']],
    related: ['unreal-engine-mass-entity-crowds', 'unreal-engine-flying-ai', 'unreal-engine-open-world-navigation'],
  },

  {
    slug: 'unreal-engine-space-combat-ai',
    nav: 'Space',
    title: 'Space Combat & Dogfight AI for UE5 — LCM 3D Navigation AI',
    description: 'Space combat and dogfight AI for Unreal Engine 5: 6-DOF fighters that chase, lead and re-plan through streamed asteroid belts, and Mass Entity raider swarms.',
    kicker: 'Use case · Space combat',
    h1: 'Space combat and <em>dogfight AI</em> for Unreal Engine 5',
    lede: 'No floor, no up, no walls. Fighters chase a target through a streamed asteroid belt, lead it with fire and re-plan through the octree as it breaks — while a Mass raider swarm closes round whatever it sees.',
    hero: { loop: 'loop-space-dogfight', still: 'space-dogfight-lasers' },
    glance: [['6-DOF', 'Full pitch and roll'], ['18', 'Raiders in the Mass swarm'], ['∞', 'Streamed asteroid belt'], ['<span data-fact="ai.aiNodesTotal">85</span>', 'AI nodes']],
    sections: [
      { media: pic('space-fleet-asteroid-field'), cap: 'A fleet through the Deep Space asteroid field',
        kicker: 'Free-floating', h2: 'Navigation with nothing to stand on',
        body: `<p>A surface navmesh has nothing to project onto in space. The octree treats a debris field, an asteroid belt or a station interior as ordinary navigable volume, so routes go over, under and between rocks in any direction. Flight takes its gravity from the level (World Settings or a Physics Volume) instead of a fixed value.</p>` },
      { media: pic('dogfight-lead-intercept'), cap: 'A fighter leads its target between asteroids',
        kicker: 'Chase', h2: 'Chase, intercept, re-plan',
        body: `<p>In the Space Dogfight demo, Fly To in chase mode follows a target that breaks, jinks behind rocks and turns back for head-on passes, re-planning through the octree as it moves while both squads trade fire. Engage Target leads a crossing target and holds a firing position until the target leaves it.</p>` },
      { media: pic('dogfight-pursuit-asteroids'), cap: 'Pursuit past bright asteroids in a streamed level',
        kicker: 'Streaming', h2: 'A belt with no edge',
        body: `<p>The asteroid belt is an infinite world: navigation chunks stream in around the fighters and are discarded behind them, so memory stays flat however far the fight drifts. Long routes solve coarsely across chunks and finely within the current one.</p>` },
      { media: pic('space-dogfight-lasers'), cap: 'Starfighters trading laser fire',
        kicker: 'Swarms', h2: 'Raider swarms on Mass Entity',
        body: `<p>The Raider Swarm demo runs a Mass swarm of eighteen raiders that sweeps the belt and closes round any fighter it sees, sharing the positions round it, while six fighters hunt them one by one with Fly To in chase mode. Fighters use the Jet / Fixed-Wing archetype: a thrust body with banking, inertia and turn-rate limits.</p>` },
    ],
    demos: [
      { name: 'Space Dogfight', still: 'dogfight-pursuit-asteroids', text: 'Fighters hunt raiders through a streamed asteroid belt.', chips: ['Fly To chase', 'BT · StateTree'] },
      { name: 'Raider Swarm', still: 'space-dogfight-lasers', text: 'A Mass swarm of eighteen raiders against six hunting fighters.', chips: ['Mass StateTree', 'Engage'] },
      { name: 'Deep Space', still: 'space-fleet-asteroid-field', text: 'A drifting asteroid field streamed around the fleet.', chips: ['Open world', 'BT · ST · Mass'] },
    ],
    faq: [
      ['How do I make spaceship AI in Unreal Engine 5?', 'Place an LcmNavigationManagerSVO (in infinite mode for a large or unbounded space), give the ship LcmFlightMovementComponent with the Jet / Fixed-Wing archetype, and drive it with the Fly To task in a Behaviour Tree or StateTree; Fly To has a chase mode for moving targets.'],
      ['Does it need a floor or gravity?', 'No. The octree stores navigable volume in every direction, and flight takes its gravity from the level rather than a fixed value.'],
      ['Can it handle an asteroid field that streams in?', 'Yes. In infinite mode navigation chunks stream in around agents and unload behind them, and the Space Dogfight and Deep Space demos both run in streamed asteroid fields.'],
    ],
    docs: [['Core concepts', 'core-concepts.html'], ['Flight and locomotion', 'flight-locomotion.html'], ['Mass Entity crowds', 'mass-entity-crowds.html']],
    related: ['unreal-engine-open-world-navigation', 'unreal-engine-flying-ai', 'unreal-engine-mass-entity-crowds'],
  },

  {
    slug: 'unreal-engine-open-world-navigation',
    nav: 'Open worlds',
    title: 'Open-World 3D Navigation for UE5 — LCM 3D Navigation AI',
    description: 'Open-world 3D navigation for Unreal Engine 5: chunks stream around your agents with no bounds volume, a long-range graph, pre-baked chunks and GPU builds.',
    kicker: 'Use case · Open worlds',
    h1: 'Open-world 3D navigation for <em>Unreal Engine 5</em>',
    lede: 'Most volumetric navigation starts by asking for a bounds volume, and navigation simply ends at its edge. Infinite mode removes the box: navigation streams in around your agents and is discarded behind them, so memory stays flat however far the map runs.',
    hero: { loop: 'loop-city-routes', still: 'city-open-world-drone-routes' },
    glance: [['0', 'Bounds volumes needed'], ['GPU', 'Built chunk octrees'], ['3', 'Streamed demo worlds'], ['<span data-fact="compatibility.engineRange">5.2–5.8</span>', 'Unreal Engine']],
    sections: [
      { media: pic('octree-routes-city-debug'), cap: 'The streamed octree and routes over the city, chunk by chunk',
        kicker: 'Streaming', h2: 'No bounds volume, no edge',
        body: `<p>A bounds volume has to contain everywhere an agent may ever fly, and memory scales with that box whether or not anything is happening inside it. In infinite mode, navigation chunks are generated around the agents as they travel and discarded behind them — the same reason you stream level geometry rather than loading a continent.</p>
<p>For an arena or a level-sized map, finite mode builds once at <code>BeginPlay</code> or bakes to an asset, with the lowest overhead.</p>` },
      { media: pic('city-open-world-drone-routes'), cap: 'Drones on long routes across the city',
        kicker: 'Long routes', h2: 'Planning beyond what has loaded',
        body: `<p>Long routes use macro/micro routing: the path solves coarsely across chunks and finely within the chunk the agent is in, so a cross-map flight never pays full-resolution search cost end to end. A persistent long-range graph keeps planning through geometry that has not streamed in yet.</p>
<p><code>Find Path Detailed</code> tells a complete route from one that stops short of the goal in a streamed world, and the query option Require Complete Path makes a partial route fail instead.</p>` },
      { media: pic('forest-open-world-routes'), cap: 'Routes over the forest canopy to the rocky massif',
        kicker: 'Bake or stream', h2: 'Pre-baked where you want it, streamed everywhere else',
        body: `<p>Bake the authored parts of a world ahead of time and stream the rest: streamed worlds can use pre-baked chunks, and navigation rebuilds automatically when levels stream in. Moving obstacles are cheap in streamed worlds too.</p>` },
      { media: pic('cost-areas-streamed-chunks'), cap: 'Cost areas priced across streamed chunk seams',
        kicker: 'GPU-built', h2: 'Chunks built on the GPU — and checked',
        body: `<p>Each streamed chunk's voxels, octree and links are built on the GPU on D3D12, D3D11 and Vulkan. Each machine's GPU proves its voxels before it builds navigation, and the GPU build checks its own output word by word and rebuilds what it cannot repair. Cost areas — storms, no-fly zones, toll gates — are priced across chunk seams.</p>` },
    ],
    demos: [
      { name: 'City', still: 'city-open-world-drone-routes', text: 'Dense blocks, rooftop gaps and street canyons, streamed around the agents.', chips: ['BT · ST · Mass'] },
      { name: 'Forest', still: 'forest-open-world-routes', text: 'Canopy, clearings and a rocky massif with tunnels bored through it.', chips: ['BT · ST · Mass'] },
      { name: 'Deep Space', still: 'space-fleet-asteroid-field', text: 'A drifting asteroid field: no floor, no up, no walls.', chips: ['BT · ST · Mass'] },
    ],
    faq: [
      ['Does it work with World Partition and open worlds?', 'Yes. In infinite mode navigation chunks stream in around agents and unload behind them, so 3D pathfinding keeps working across an open-world or World Partition project rather than only inside a hand-placed box.'],
      ['What happens when a route reaches past the loaded area?', 'A persistent long-range graph keeps planning beyond loaded geometry, and Find Path Detailed reports whether a route is complete or stops short of the goal; Require Complete Path makes a partial route fail instead.'],
      ['Can I pre-bake parts of an open world?', 'Yes. Finite levels can be baked to an asset, and streamed worlds can use pre-baked chunks alongside chunks generated at runtime.'],
    ],
    docs: [['Core concepts', 'core-concepts.html'], ['Settings reference', 'settings.html'], ['Editor tools', 'editor-tools.html']],
    related: ['unreal-engine-space-combat-ai', 'unreal-engine-mass-entity-crowds', 'unreal-engine-flying-ai'],
  },

  {
    slug: 'unreal-engine-mass-entity-crowds',
    nav: 'Crowds',
    title: 'Mass Entity Flying Crowds for UE5 — LCM 3D Navigation AI',
    description: '3D Mass Entity crowds for Unreal Engine 5: 10,000+ flying and swimming agents on per-agent paths or a shared flow field, with Mass StateTree behaviours.',
    kicker: 'Use case · Mass crowds',
    h1: 'Mass Entity <em>flying crowds</em> for Unreal Engine 5',
    lede: 'Drone swarms, bird flocks and fish schools in true 3D through Unreal\'s Mass ECS — 10,000+ agents on per-agent paths or one shared flow field, with crowds that perch, scan, engage, investigate and flee.',
    hero: { loop: 'loop-drone-swarm-city', still: 'drone-swarm-city-towers' },
    glance: [['10,000+', 'Mass Entity agents'], ['8', 'Mass traits'], ['13', 'Mass StateTree nodes'], ['O(1)', 'Flow-field sampling']],
    sections: [
      { media: pic('mass-swarm-over-skyline'), cap: 'One shared flow field carries the swarm over the skyline',
        kicker: 'Two modes', h2: 'Per-agent paths or one shared flow field',
        body: `<p>Crowds heading the same way sample one shared CPU flow field in constant time, while the agents that matter get their own asynchronous paths. Auto-registered processors handle request, solve and steer, so you never call the solver yourself. A crowd's first flow field is built off the game thread, so a crowd spawning into a streamed world does not cost one long frame.</p>` },
      { media: pic('drone-swarm-close-fly-through'), cap: 'Close fly-through of the swarm',
        kicker: 'Behaviours', h2: 'Crowds that behave, not just move',
        body: `<p>Ten Mass StateTree tasks and three evaluators let crowds perch, scan, engage, investigate and flee. Agents in a crowd share the work: they sweep an area sharing the viewpoints, close round an intruder the moment any of them sees it, and no two take the same perch, cover or vantage point.</p>` },
      { media: pic('reef-school-crowd'), cap: 'A school turning together without overlapping',
        kicker: 'Density', h2: 'Dense crowds that do not overlap',
        body: `<p>Hold Avoidance Between Scans keeps separation on every frame, and Contact Push pushes apart bodies that overlap — including agents that have arrived — so a crowd no longer piles onto its goal. A crowd agent pushed off the flow field's covered space steers back instead of freezing, and schooling works for Mass crowds as well as pawns.</p>` },
      { media: pic('mass-swarm-rising-skyscraper'), cap: 'A swarm climbing through a tower interior',
        kicker: 'Setup', h2: 'One trait, no code',
        body: `<p>Add a trait to a Mass Entity Config and the crowd navigates in full 3D, with no per-agent controller and no tick function. Eight traits cover movement, guidance, goals, perception, behaviour status and rendering, and an editor validator flags illegal combinations — the one rule is exactly one movement trait per agent. Crowds render through instanced meshes with LOD representation.</p>` },
    ],
    demos: [
      { name: 'Hunter Pack', still: 'hunter-drones-container-stacks', text: 'Five Mass drones hunt as a pack through the container terminal.', chips: ['Mass StateTree', 'Engage'] },
      { name: 'Reef School', still: 'reef-school-mass', text: 'A school of forty follows its lead fish on the flow field.', chips: ['Schooling'] },
      { name: 'Sentry Swarm', still: 'sentry-drones-depot-octree', text: 'Six Mass drones guard a depot as one, then rest on the pads.', chips: ['Scan Area', 'Perch'] },
      { name: 'Warehouse Security', still: 'warehouse-archive-hall', text: 'Four Mass security drones watch, sweep, engage and search.', chips: ['Investigate'] },
      { name: 'Raider Swarm', still: 'space-dogfight-lasers', text: 'Eighteen raiders sweep the asteroid belt and close round fighters.', chips: ['Engage'] },
      { name: 'Vertical Skyscraper', still: 'mass-swarm-rising-skyscraper', text: 'A crowd threading a tower interior, floor by floor.', chips: ['Flow field'] },
    ],
    faq: [
      ['How many agents can navigate in 3D through Mass Entity?', '10,000 or more. Crowds can use per-agent asynchronous paths or one shared flow field that the whole swarm samples in constant time, and they render through instanced meshes with LOD.'],
      ['Do I need C++ to use Mass crowds?', 'No. Add the traits to a Mass Entity Config; an editor validator flags illegal trait combinations, and Mass StateTree tasks drive the behaviour.'],
      ['Can crowds use behaviours like perch and engage?', 'Yes. Ten Mass StateTree tasks and three evaluators let crowds perch, scan, engage, investigate and flee, and agents share viewpoints, perches and cover so no two take the same one.'],
    ],
    docs: [['Mass Entity crowds', 'mass-entity-crowds.html'], ['Mass traits reference', 'mass-traits.html'], ['Gameplay Debugger', 'gameplay-debugger.html']],
    related: ['unreal-engine-underwater-ai', 'unreal-engine-flying-ai', 'unreal-engine-space-combat-ai'],
  },

  {
    slug: 'unreal-engine-moving-obstacle-avoidance',
    nav: 'Moving obstacles',
    title: 'Moving Obstacle Avoidance for UE5 AI — LCM 3D Navigation AI',
    description: 'Moving obstacle avoidance for Unreal Engine 5 AI: Fly To predicts gates, pistons and sweepers and times its pass, and moving geometry restamps the octree.',
    kicker: 'Use case · New in 3.6',
    h1: 'Moving obstacle avoidance for <em>Unreal Engine 5</em> AI',
    lede: 'Re-planning around a door after it closes is too late for a drone at speed. Since 3.6, Fly To predicts where every moving obstacle will be and times its pass — and the octree still restamps itself as the world moves, so routes stay true.',
    hero: { still: 'harbour-drone-lands-moving-lorry' },
    glance: [['42', 'Movers in the Gauntlet'], ['370<small>m</small>', 'Gauntlet hall'], ['200', 'Agent Mass edition'], ['3', 'Prediction settings']],
    sections: [
      { media: PREDICT_SVG, raw: true, cap: 'A drone waits for the gate it predicted, then takes the gap',
        kicker: 'Prediction', h2: 'Predict, don\'t just react',
        body: `<p>Fly To predicts where every moving obstacle — any actor with an LCM Dynamic Obstacle component — will be, and times its pass. It learns a gate's or a piston's cycle and replays it, turns a spinning blade with it, eases off, waits for a gap or takes a detour, and dodges what it cannot outrun.</p>
<p>It is on by default in the Behaviour Tree and StateTree Fly To, controlled by three settings: <strong>Avoid Moving Obstacles</strong>, <strong>Moving Obstacle Look-Ahead</strong> and <strong>Moving Obstacle Margin</strong>.</p>` },
      { media: pic('node-land-moving-platform'), cap: 'Land on a moving platform in the Feature Examples hall',
        kicker: 'Live octree', h2: 'The octree moves with the world',
        body: `<p>Moving geometry writes its own footprint back into the octree as it travels, so doors, lifts, moving platforms, destructible cover and patrolling ships change routing live — and in multiplayer the change is multicast to every peer. A mover put back to the start of its track is treated as a jump, not a very fast move, so the space it left is freed.</p>
<p>In streamed worlds a moving obstacle's update next to a 168k-triangle room costs about 1&nbsp;ms, down from 20&nbsp;ms.</p>` },
      { media: pic('drone-swarm-close-fly-through'), cap: 'Agents keeping apart in a dense swarm',
        kicker: 'Each other', h2: 'Avoiding each other, too',
        body: `<p>Agents avoid each other with Reactive (boids), Predictive (ORCA) or Context-Based Steering, chosen per agent. Fly To's wall-avoidance whiskers ignore other agents and leave them to agent avoidance, and Mass crowds keep apart with Hold Avoidance and Contact Push.</p>` },
    ],
    zones: ['Fast gates', 'Crossing traffic', 'Windmills and sweepers', 'Pistons', 'Head-on blocks', 'Bouncers'],
    demos: [
      { name: 'Dynamic Obstacles', still: 'node-land-moving-platform', text: 'Moving gates seal and open corridors while agents re-route live; 200 flow-field agents in Mass.', chips: ['BT · ST · Mass'] },
      { name: 'Harbour', still: 'harbour-drone-lands-moving-ship', text: 'Landing on a moving, rolling ship and a moving lorry.', chips: ['Land', 'BT · StateTree'] },
      { name: 'Hunter Drone', still: 'hunter-engagement-path', text: 'A hunter re-plans round container stacks as its target runs.', chips: ['Engage', 'BT · ST · Mass'] },
    ],
    faq: [
      ['How do AI agents avoid moving obstacles in Unreal Engine 5?', 'Give the moving actor an LCM Dynamic Obstacle component. Its footprint restamps the navigation octree as it moves, and since 3.6 the Fly To task predicts its motion and times its pass — waiting for a gap, taking a detour or dodging.'],
      ['Does it work with doors, lifts and moving platforms?', 'Yes. Any moving actor with a Dynamic Obstacle component updates the octree live, agents re-route around it, and the change replicates to clients in multiplayer.'],
      ['Which settings control moving-obstacle prediction?', 'Avoid Moving Obstacles turns it on (it is on by default), Moving Obstacle Look-Ahead sets how far ahead Fly To predicts, and Moving Obstacle Margin sets the clearance it keeps.'],
    ],
    docs: [['Dynamic obstacles', 'dynamic-obstacles.html'], ['Settings reference', 'settings.html'], ['Troubleshooting', 'troubleshooting.html']],
    related: ['unreal-engine-flying-ai', 'unreal-engine-mass-entity-crowds', 'unreal-engine-open-world-navigation'],
  },
];

const BY_SLUG = new Map(USE_CASES.map((u) => [u.slug, u]));

/* ------------------------------------------------------------------ */
/* Shared layout                                                       */
/* ------------------------------------------------------------------ */

function head({ slug, title, description, image, imageAlt, ld }) {
  const url = SITE + slug + '/';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<!-- Generated by tools/site/pages.mjs: edit the content there, not this file. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="author" content="L. Charitha Madhushanka" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta name="theme-color" content="#050705" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg" />
<link rel="apple-touch-icon" href="../assets/og-company.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="UEDEV" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1280" />
<meta property="og:image:height" content="720" />
<meta property="og:image:alt" content="${esc(imageAlt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${image}" />
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }, null, 2)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="../assets/company.css${V}" />
<link rel="stylesheet" href="../assets/upgrade.css${V}" />
<link rel="stylesheet" href="../assets/nav3d.css${V}" />
<script>document.documentElement.classList.add('js')</script>
</head>`;
}

function nav(active) {
  const items = [
    [PRODUCT, '3D Pathfinding'],
    ['unreal-engine-flying-ai/', 'Flying AI'],
    ['unreal-engine-underwater-ai/', 'Underwater', 'nav__opt'],
    ['unreal-engine-space-combat-ai/', 'Space', 'nav__opt'],
    ['unreal-engine-moving-obstacle-avoidance/', 'Moving obstacles'],
    ['unreal-engine-niagara-vfx/', 'Niagara VFX'],
  ];
  return `<header class="nav" id="nav">
  <div class="nav__in">
    <a href="../" class="brand"><span class="brand__mark"><i></i><b>U</b></span><span>UE<b>DEV</b></span></a>
    <nav class="nav__links" aria-label="Site">
${items.map(([href, label, cls]) => `      <a href="../${href}"${[cls, href === active ? 'active' : ''].filter(Boolean).length ? ` class="${[cls, href === active ? 'active' : ''].filter(Boolean).join(' ')}"` : ''}${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('\n')}
    </nav>
    <a href="${FAB}" target="_blank" rel="noopener" class="nav__cta">Get it on Fab ↗</a>
    <button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</header>`;
}

function footer() {
  const uc = USE_CASES.map((u) => `        <a href="../${u.slug}/">${u.nav === 'Crowds' ? 'Mass crowds' : u.nav}</a>`).join('\n');
  return `<footer class="footer">
  <div class="wrap">
    <div class="footer__in">
      <div class="footer__col" style="max-width:280px">
        <a href="../" class="brand" style="margin-bottom:14px"><span class="brand__mark"><i></i><b>U</b></span><span>UE<b>DEV</b></span></a>
        <p style="color:var(--faint);font-size:14px;line-height:1.6;margin:0">High-performance plugins, gameplay systems &amp; advanced VFX for Unreal Engine. Built and supported by a working game developer.</p>
      </div>
      <div class="footer__col">
        <h4>3D Navigation AI</h4>
        <a href="../${PRODUCT}">3D pathfinding for UE5</a>
        <a href="../${PRODUCT}#whats-new">What's new in <span data-fact="product.version">3.6.0</span></a>
${uc}
        <a href="${DOCS}" target="_blank" rel="noopener">Documentation</a>
      </div>
      <div class="footer__col">
        <h4>Store</h4>
        <a href="../unreal-engine-niagara-vfx/">Niagara VFX packs</a>
        <a href="${store.seller}" target="_blank" rel="noopener">Browse on Fab</a>
        <a href="${facts.product.freeDemo}" target="_blank" rel="noopener">Free demo</a>
        <a href="https://www.youtube.com/@experimentdev3935" target="_blank" rel="noopener">Video tutorials</a>
        <a href="${facts.product.discord}" target="_blank" rel="noopener">Discord support</a>
      </div>
      <div class="footer__col">
        <h4>Developer</h4>
        <a href="../">UEDEV home</a>
        <a href="../portfolio.html">Portfolio</a>
        <a href="../portfolio.html#contact">Contact</a>
      </div>
    </div>
    <div class="footer__bottom">
      <span>© 2018–2026 UEDEV · L. Charitha Madhushanka</span>
      <span class="mono">For AI agents: <a href="../llms.txt">llms.txt</a> · <a href="../facts.json">facts.json</a> · <a href="../sitemap.xml">sitemap</a></span>
    </div>
  </div>
</footer>

<script src="../assets/nav3d.js${V}" defer></script>
</body>
</html>
`;
}

const cta = (h2, p) => `<section class="cta wrap" id="cta">
  <h2>${h2}</h2>
  <p>${p}</p>
  <div class="hero__row">
    <a class="btn btn--primary" href="${FAB}" target="_blank" rel="noopener">Get it on Fab ↗</a>
    <a class="btn btn--ghost" href="../${PRODUCT}">Explore LCM 3D Navigation AI →</a>
  </div>
</section>`;

const crumbsLd = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) });

/* ------------------------------------------------------------------ */
/* Use-case page                                                       */
/* ------------------------------------------------------------------ */

function useCasePage(u) {
  const url = SITE + u.slug + '/';
  const heroStill = still(u.hero.still);
  const image = SITE + heroStill.jpg;
  const ld = [
    crumbsLd([['UEDEV', SITE], ['3D Navigation AI', SITE + PRODUCT], [text(u.h1), url]]),
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: u.title, description: u.description, inLanguage: 'en',
      isPartOf: { '@id': SITE + '#website' }, about: { '@id': SITE + PRODUCT + '#software' },
      primaryImageOfPage: { '@type': 'ImageObject', url: image, caption: heroStill.alt }, dateModified: UPDATED,
      author: { '@type': 'Person', name: 'L. Charitha Madhushanka', url: SITE + 'portfolio.html' } },
    { '@type': 'FAQPage', mainEntity: u.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];

  const heroMedia = u.hero.loop
    ? vid(u.hero.loop, ' class="xh__video" id="heroLoop" hero')
    : pic(u.hero.still, '100vw', ' loading="eager"');
  const pause = u.hero.loop ? `
    <button class="xplay" type="button" data-target="heroLoop" aria-pressed="false" aria-label="Pause background video">
      <svg class="i-pause" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
      <svg class="i-play" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>
    </button>` : '';

  const rows = u.sections.map((s, i) => `        <div class="xrow">
          <figure class="xm xm--16x9 xrow__media xr">
${s.raw ? s.media : s.media.split('\n').map((l) => '            ' + l).join('\n')}
            <figcaption><span>${s.cap}</span></figcaption>
          </figure>
          <div class="xrow__text xr">
            <span class="xn">${String(i + 1).padStart(2, '0')} · ${s.kicker}</span>
            <h2>${s.h2}</h2>
            ${s.body.replace(/\n/g, '\n            ')}
          </div>
        </div>`).join('\n');

  const zones = u.zones ? `
  <section id="gauntlet" class="xsec">
    <div class="wrap">
      <div class="xhead xr">
        <span class="kicker">New demo · 3.6</span>
        <h2>The Obstacle Gauntlet</h2>
        <p class="lede">A 370&nbsp;m hall of six zones with 42 movers driven by Unreal's own movement components. Twelve drones fly it end to end in the Behaviour Tree and StateTree editions; a crowd of 200 follows a beacon through it in the Mass edition. Open it from the demo menu.</p>
      </div>
      <ol class="xzones xr">
${u.zones.map((z, i) => `        <li><b>ZONE ${String(i + 1).padStart(2, '0')}</b><span>${z}</span></li>`).join('\n')}
      </ol>
    </div>
  </section>` : '';

  const demos = u.demos.map((d) => `        <article class="xw__card xr">
          ${pic(d.still, '(min-width:860px) 33vw, 100vw').replace('\n', '\n          ')}
          <div class="xw__body"><h3>${d.name}</h3><p>${d.text}</p><ul class="xchips">${d.chips.map((c) => `<li>${c}</li>`).join('')}</ul></div>
        </article>`).join('\n');

  const related = u.related.map((slug) => {
    const r = BY_SLUG.get(slug);
    return `        <a href="../${slug}/" class="xr"><div class="xm">${pic(r.hero.still, '(min-width:860px) 33vw, 100vw', ' alt=""')}</div><b>${text(r.h1)}</b><span>${r.description.split(':')[0]}.</span></a>`;
  }).join('\n');

  const body = `
<body>
<div class="aurora"></div>
<div class="grid-overlay"></div>

${nav(u.slug + '/')}

<main class="lp">
<article>
  <header class="xh xh--sub">
    <div class="xh__media" aria-hidden="true">
      ${heroMedia.replace('\n', '\n      ')}
    </div>
    <div class="xh__scrim"></div>
    <div class="wrap xh__in">
      <p class="crumb"><a href="../">UEDEV</a> &nbsp;/&nbsp; <a href="../${PRODUCT}">3D Navigation AI</a> &nbsp;/&nbsp; ${u.nav} &nbsp;·&nbsp; Updated <time datetime="${UPDATED}">24 October 2026</time></p>
      <p class="xh__chip"><b>v<span data-fact="product.version">3.6.0</span></b> ${u.kicker}</p>
      <h1>${u.h1}</h1>
      <p class="lede">${u.lede}</p>
      <div class="xh__cta">
        <a class="btn btn--glow" href="${FAB}" target="_blank" rel="noopener">Get it on Fab</a>
        <a class="btn btn--ghost" href="#demos">See the demo levels</a>
        <a class="btn btn--ghost" href="../${PRODUCT}#how">How it works</a>
      </div>
      <ul class="xh__proof">
        <li><a href="${FAB}?tab=reviews" target="_blank" rel="noopener"><span class="xstars" aria-hidden="true">★★★★★</span> <b><span data-fact="reviews.ratingDisplay">5.0</span> on Fab</b> · <span data-fact="reviews.ratingCount">3</span> ratings</a></li>
        <li>LCM 3D Navigation AI</li>
        <li>Unreal Engine <span data-fact="compatibility.engineRange">5.2–5.8</span></li>
      </ul>
    </div>${pause}
  </header>

  <div class="wrap">
    <dl class="xs xs--4 xr" aria-label="At a glance">
${u.glance.map(([v, l]) => `      <div><dt>${l}</dt><dd>${v}</dd></div>`).join('\n')}
    </dl>
  </div>

  <section id="features" class="xsec">
    <div class="wrap">
      <div class="xrows">
${rows}
      </div>
    </div>
  </section>
${zones}
  <section id="demos" class="xsec">
    <div class="wrap">
      <div class="xhead xr">
        <span class="kicker">Free demo levels</span>
        <h2>See it in the demo levels</h2>
        <p class="lede">These levels are part of the <span data-fact="content.demoLevels">57</span> free demo levels you download from inside the editor (LCM Nav3D menu › Get the Demo Levels).</p>
      </div>
      <div class="xw">
${demos}
      </div>
    </div>
  </section>

  <section id="faq" class="xsec">
    <div class="wrap">
      <div class="xhead xr">
        <span class="kicker">FAQ</span>
        <h2>Common questions</h2>
      </div>
      <div class="faq">
${u.faq.map(([q, a], i) => `        <details${i === 0 ? ' open' : ''}><summary>${q}</summary><div><p>${a}</p></div></details>`).join('\n')}
      </div>
      <p class="xr" style="margin-top:28px">Read more in the free documentation:</p>
      <ul class="xdocs">
${u.docs.map(([l, p]) => `        <li><a href="${DOCS}${p}" target="_blank" rel="noopener">${l} ↗</a></li>`).join('\n')}
      </ul>
    </div>
  </section>

  <section id="related" class="xsec">
    <div class="wrap">
      <div class="xhead xr">
        <span class="kicker">More use cases</span>
        <h2>What else it can fly</h2>
      </div>
      <div class="xrel">
${related}
      </div>
    </div>
  </section>
</article>
</main>

${cta('Give your AI the <span class="grad">whole sky.</span>', 'LCM 3D Navigation AI — true 3D pathfinding and volumetric navigation for Unreal Engine 5, built and supported by a working game developer.')}

${footer()}`;
  return head({ slug: u.slug, title: u.title, description: u.description, image, imageAlt: heroStill.alt, ld }) + body;
}

/* ------------------------------------------------------------------ */
/* Store page                                                          */
/* ------------------------------------------------------------------ */

const CAT_COPY = {
  Weapons: ['Weapon VFX', 'Energy beams, laser beam weapons and muzzle flashes built in Niagara.'],
  Combat: ['Combat VFX', 'Explosions, slashes and trails, projectiles, shields, and scan and screen effects.'],
  Environment: ['Environmental VFX', 'Environmental Niagara systems, a tornado and portals.'],
  Character: ['Character VFX', 'Advanced overlays and Niagara effects for characters.'],
  Packs: ['Bundles', 'Essentials bundles: fire, impact, smoke, spark and explosion effects.'],
  Plugins: ['Plugins', 'C++ plugins for Unreal Engine.'],
};

function storePage() {
  const slug = 'unreal-engine-niagara-vfx';
  const url = SITE + slug + '/';
  const title = 'Niagara VFX Packs for Unreal Engine — UEDEV';
  const description = `${store.products.filter((p) => p.cat !== 'Plugins').length} Niagara VFX packs and plugins for Unreal Engine by UEDEV: weapon beams, explosions, shields, environmental and character effects, plus LCM 3D Navigation AI.`;
  const flag = store.products.find((p) => p.flagship);
  const image = SITE + still(flag.still).jpg;
  const vfx = store.products.filter((p) => !p.flagship);
  const ld = [
    crumbsLd([['UEDEV', SITE], ['Niagara VFX packs', url]]),
    { '@type': 'CollectionPage', '@id': url + '#webpage', url, name: title, description, inLanguage: 'en',
      isPartOf: { '@id': SITE + '#website' }, publisher: { '@id': SITE + '#organization' }, dateModified: store.checked },
    { '@type': 'ItemList', name: 'UEDEV products on Fab', numberOfItems: store.products.length,
      itemListElement: store.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: p.page ? SITE + p.page : store.listingBase + p.fab })) },
  ];
  const cats = ['Weapons', 'Combat', 'Environment', 'Character', 'Packs', 'Plugins'];
  const sections = cats.map((c) => `  <section id="${c.toLowerCase()}" class="xcat">
    <div class="wrap">
      <div class="xhead xr">
        <span class="kicker">${CAT_COPY[c][0]}</span>
        <h2>${CAT_COPY[c][0]} for Unreal Engine</h2>
        <p class="lede">${CAT_COPY[c][1]}</p>
      </div>
      <div class="prod-grid">
        <!-- @catalog cat="${c}" no-flagship -->
        <!-- /@catalog -->
      </div>
    </div>
  </section>`).join('\n\n');

  const body = `
<body>
<div class="aurora"></div>
<div class="grid-overlay"></div>

${nav('unreal-engine-niagara-vfx/')}

<main class="lp">
  <header class="xstore">
    <div class="wrap">
      <p class="crumb"><a href="../">UEDEV</a> &nbsp;/&nbsp; Niagara VFX packs &nbsp;·&nbsp; Prices checked <time datetime="${store.checked}">24 October 2026</time></p>
      <span class="kicker">The UEDEV store on Fab</span>
      <h1>Niagara VFX packs for <em>Unreal Engine</em></h1>
      <p class="lede">Production-grade Niagara effects built the same way as the plugins — profiled, documented and shipped in real games. Weapon beams, explosions, shields, portals, environmental systems and character overlays, alongside the C++ plugins.</p>
      <div class="xh__cta">
        <a class="btn btn--glow" href="${store.seller}" target="_blank" rel="noopener">Browse the store on Fab ↗</a>
        <a class="btn btn--ghost" href="#weapons">Jump to the packs</a>
      </div>
    </div>
    <div class="wrap" style="margin-top:44px">
      <dl class="xs xs--4 xr" aria-label="The store at a glance">
        <div><dt>Products on Fab</dt><dd data-fact="store.products">21</dd></div>
        <div><dt>Niagara VFX packs</dt><dd data-fact="store.vfx">19</dd></div>
        <div><dt>Ratings on Fab</dt><dd data-fact="store.ratings">47</dd></div>
        <div><dt>Average rating</dt><dd><span data-fact="store.average">4.5</span><small>★</small></dd></div>
      </dl>
    </div>
  </header>

  <section id="flagship" class="xcat">
    <div class="wrap">
      <article class="xflag xr">
        <div class="xm">
          ${vid('loop-drone-swarm-city').replace('\n', '\n          ')}
        </div>
        <div class="xflag__b">
          <span class="xtag">Flagship plugin · v<span data-fact="product.version">3.6.0</span></span>
          <h2>LCM 3D Navigation AI</h2>
          <p>True 3D pathfinding and volumetric navigation for Unreal Engine 5: flying, swimming and free-floating AI, <span data-fact="ai.aiNodesTotal">85</span> Behaviour Tree, StateTree and Mass nodes, 10,000+ agent crowds and infinite streaming worlds. <span class="xstars" aria-hidden="true">★★★★★</span> <span data-fact="reviews.ratingDisplay">5.0</span> on Fab.</p>
          <div class="xh__cta" style="margin-top:22px">
            <a class="btn btn--glow" href="../${PRODUCT}">Explore the plugin</a>
            <a class="btn btn--ghost" href="${FAB}" target="_blank" rel="noopener">View on Fab ↗</a>
          </div>
        </div>
      </article>
    </div>
  </section>

${sections}

  <section class="xcat">
    <div class="wrap">
      <p class="xnote">Prices and ratings as listed on Fab on 24 October 2026. Fab shows the current price, any sale and the supported engine versions on each listing.</p>
    </div>
  </section>
</main>

${cta('Need something <span class="grad">custom built?</span>', 'Bespoke effects, gameplay systems and plugins from the developer behind the packs.').replace(`<a class="btn btn--primary" href="${FAB}" target="_blank" rel="noopener">Get it on Fab ↗</a>`, `<a class="btn btn--primary" href="${store.seller}" target="_blank" rel="noopener">Browse on Fab ↗</a>`).replace(`<a class="btn btn--ghost" href="../${PRODUCT}">Explore LCM 3D Navigation AI →</a>`, '<a class="btn btn--ghost" href="../portfolio.html#contact">Contact the developer →</a>')}

${footer()}`;
  return head({ slug, title, description, image, imageAlt: 'UEDEV Niagara VFX packs and plugins for Unreal Engine', ld }) + body;
}

/* ------------------------------------------------------------------ */

let n = 0;
const write = (slug, html) => {
  const dir = path.join(ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'index.html');
  // Keep media markers' generated bodies if the page exists, so a rerun is quiet until build.mjs runs.
  fs.writeFileSync(file, html);
  n++;
  console.log(`  wrote ${slug}/index.html`);
};
for (const u of USE_CASES) write(u.slug, useCasePage(u));
write('unreal-engine-niagara-vfx', storePage());
console.log(`pages: ${n} page(s) written`);
