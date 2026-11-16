export const STYLES = `
:host { display:block; width:100%; height:100%; color:inherit; font:inherit; }
* { box-sizing:border-box; }
.wakeword { width:100%; height:100%; min-height:0; display:flex; flex-direction:column; padding:var(--wakeword-padding, 16px); background:transparent; color:inherit; font:inherit; text-align:inherit; overflow:auto; }
.wakeword.with-chat { overflow:hidden; }
.top { position:relative; display:flex; align-items:center; gap:16px; }
.mic { width:64px; height:64px; border:0; border-radius:50%; background:color-mix(in srgb, currentColor 12%, transparent); color:inherit; font:inherit; cursor:pointer; display:grid; place-items:center; flex:none; }
.mic.on { background:var(--wake-accent, var(--iob-primary, #2563eb)); color:var(--iob-primary-contrast, #fff); box-shadow:0 0 0 5px color-mix(in srgb, var(--wake-accent, var(--iob-primary, #2563eb)) 18%, transparent); }
.mic:disabled { opacity:.55; cursor:default; }
.mic svg { width:34px; height:34px; fill:currentColor; }
.status { display:flex; flex-direction:column; gap:4px; min-width:0; }
.status strong { font-weight:inherit; }
.status small { opacity:.7; }
.meter { height:5px; background:color-mix(in srgb,currentColor 15%,transparent); border-radius:99px; margin-top:16px; overflow:hidden; }
.meter span { display:block; height:100%; background:var(--wake-accent, var(--iob-primary, #2563eb)); transition:width .1s linear; }
.voice-settings { margin-left:auto; flex:none; }
.voice-settings summary { display:grid; place-items:center; width:34px; height:34px; list-style:none; border:1px solid var(--iob-divider, rgba(128,128,128,.25)); border-radius:var(--iob-border-radius, 6px); cursor:pointer; }
.voice-settings summary::-webkit-details-marker { display:none; }
.voice-settings summary:focus-visible { outline:2px solid var(--wake-accent, var(--iob-primary, #2563eb)); outline-offset:2px; }
.voice-settings summary svg { width:21px; height:21px; fill:currentColor; }
.voice-panel { position:absolute; z-index:10; top:100%; right:0; width:min(290px, 100%); padding:10px; background:var(--iob-paper, var(--iob-background, #fff)); border:1px solid var(--iob-divider, rgba(128,128,128,.25)); border-radius:var(--iob-border-radius, 6px); box-shadow:0 4px 16px rgba(0,0,0,.2); }
.voice-picker { display:flex; flex-direction:column; align-items:stretch; gap:6px; min-width:0; }
.voice-picker select { width:100%; min-width:0; padding:4px; color:inherit; background:var(--iob-paper, var(--iob-background, #fff)); border:1px solid var(--iob-divider, rgba(128,128,128,.25)); border-radius:var(--iob-border-radius, 6px); font:inherit; }
.voice-picker small { font-size:.8em; }
.text { margin:14px 0 0; overflow-wrap:anywhere; }
.with-chat .text { max-height:3em; overflow-y:auto; }
.error { color:var(--iob-error, #dc2626); margin:12px 0 0; }
.chat { flex:1 1 0; min-height:0; margin-top:12px; padding:8px; overflow-y:auto; overscroll-behavior:contain; border:1px solid var(--iob-divider, rgba(128,128,128,.25)); border-radius:var(--iob-border-radius, 6px); }
.chat-content { min-height:100%; }
.chat-entry { max-width:90%; margin:0 0 10px; padding:6px 9px; border-radius:var(--iob-border-radius, 6px); background:var(--iob-paper, rgba(128,128,128,.08)); overflow-wrap:anywhere; }
.chat-entry.user { margin-left:auto; background:color-mix(in srgb, var(--wake-accent, var(--iob-primary, #2563eb)) 14%, transparent); }
.chat-entry.error { color:var(--iob-error, #dc2626); }
.chat-entry p { margin:3px 0 0; white-space:pre-wrap; }
.chat-source { font-size:.8em; opacity:.7; }
.chat-empty { margin:0; opacity:.65; }
.actions { display:flex; gap:8px; margin-top:14px; }
.actions button { border:1px solid var(--wake-accent, var(--iob-primary, #2563eb)); color:var(--wake-accent, var(--iob-primary, #2563eb)); background:transparent; border-radius:var(--iob-border-radius, 6px); padding:6px 12px; cursor:pointer; font:inherit; }
.actions button:disabled { opacity:.5; }
.compact { padding:var(--wakeword-padding, 8px); }
.compact .mic { width:42px; height:42px; }
.compact .mic svg { width:25px; height:25px; }
.compact .meter { margin-top:8px; }
@media (prefers-reduced-motion:reduce) { .meter span { transition:none; } }
`;
