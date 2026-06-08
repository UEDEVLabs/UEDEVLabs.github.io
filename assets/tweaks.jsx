/* Tweaks integration — mounts a React panel that drives the vanilla page's
   CSS variables / body classes. Panel stays hidden until the user turns
   Tweaks on (host protocol handled by tweaks-panel.jsx). */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ff8a3d",
  "bg": "charcoal",
  "heroImage": true,
  "embers": true,
  "grain": true
}/*EDITMODE-END*/;

const ACCENTS = {
  "#ff8a3d": ["#ff8a3d", "#ffb454"],
  "#ff4d57": ["#ff4d57", "#ff8a86"],
  "#36d4ff": ["#36d4ff", "#8be8ff"],
  "#c6ff3a": ["#c6ff3a", "#e0ff86"],
  "#9b6bff": ["#9b6bff", "#c2a3ff"]
};
const BGS = {
  charcoal: ["#070605", "#0c0a08", "#100d0a"],
  ink:      ["#040404", "#0a0a0a", "#101010"],
  warm:     ["#0b0705", "#150d08", "#1c120a"]
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => {
    const root = document.documentElement;
    const [a, a2] = ACCENTS[t.accent] || [t.accent, t.accent];
    root.style.setProperty('--accent', a);
    root.style.setProperty('--accent-2', a2);
    const [bg, bg2, panel] = BGS[t.bg] || BGS.charcoal;
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--bg2', bg2);
    root.style.setProperty('--panel', panel);
    document.body.classList.toggle('no-herobg', !t.heroImage);
    document.body.classList.toggle('no-embers', !t.embers);
    document.body.classList.toggle('no-grain', !t.grain);
  }, [t]);

  return (
    <TweaksPanel>
      <TweakSection label="Brand" />
      <TweakColor label="Accent color" value={t.accent}
        options={["#ff8a3d", "#ff4d57", "#36d4ff", "#c6ff3a", "#9b6bff"]}
        onChange={(v) => setTweak('accent', v)} />
      <TweakRadio label="Background" value={t.bg}
        options={["charcoal", "ink", "warm"]}
        onChange={(v) => setTweak('bg', v)} />
      <TweakSection label="Hero & FX" />
      <TweakToggle label="Game backdrop" value={t.heroImage}
        onChange={(v) => setTweak('heroImage', v)} />
      <TweakToggle label="Ember particles" value={t.embers}
        onChange={(v) => setTweak('embers', v)} />
      <TweakToggle label="Film grain" value={t.grain}
        onChange={(v) => setTweak('grain', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweak-root')).render(<App />);
