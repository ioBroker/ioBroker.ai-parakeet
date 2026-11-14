import { createRoot as e, memo as t, useLayoutEffect as n, useRef as r, jsx as i, jsxs as a } from "../../../lib/esm/react-19.js";
// \0rolldown/runtime.js
var o = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
}), s = "iob-dialog-close";
function c(e) {
	return !!e.form;
}
// ../node_modules/@iobroker/web-components/build/manifest.js
var l = [
	"header",
	"staticText",
	"divider"
];
function u(e, t) {
	return e == null ? "" : typeof e == "object" ? e[t] || e.en || Object.values(e).find((e) => !!e) || "" : String(e);
}
// ../node_modules/@iobroker/web-components/build/settings.js
function d(e) {
	let t = {};
	for (let [n, r] of Object.entries(e.items || {})) r && !l.includes(r.type) && (t[n] = r.type);
	return t;
}
function f(e) {
	return typeof e == "string" ? e : typeof e == "number" || typeof e == "boolean" ? e.toString() : JSON.stringify(e);
}
function p(e, t) {
	if (t != null) switch (e) {
		case "number":
		case "slider": {
			if (typeof t == "number") return Number.isFinite(t) ? t : void 0;
			let e = f(t).trim().replace(",", ".");
			if (!e) return;
			let n = Number(e);
			return Number.isFinite(n) ? n : void 0;
		}
		case "checkbox": return t === !0 || t === "true" || t === 1 || t === "1";
		default: return f(t);
	}
}
function m(e, t) {
	let n = {};
	for (let [r, i] of Object.entries(e)) {
		let e = p(i, t[r]);
		e !== void 0 && (n[r] = e);
	}
	return n;
}
// ../node_modules/@iobroker/web-components/build/theme.js
var h = "\"Roboto\", \"Helvetica\", \"Arial\", sans-serif", g = Object.freeze({
	type: "light",
	primary: "#3399CC",
	primaryContrast: "#FFFFFF",
	secondary: "#164477",
	secondaryContrast: "#FFFFFF",
	background: "#FFFFFF",
	paper: "#FFFFFF",
	text: "rgba(0, 0, 0, 0.87)",
	textSecondary: "rgba(0, 0, 0, 0.6)",
	divider: "rgba(0, 0, 0, 0.12)",
	error: "#D32F2F",
	warning: "#ED6C02",
	info: "#0288D1",
	success: "#2E7D32",
	fontFamily: h,
	fontSize: 14,
	borderRadius: 4
}), _ = Object.freeze({
	type: "dark",
	primary: "#4DABF5",
	primaryContrast: "rgba(0, 0, 0, 0.87)",
	secondary: "#436A93",
	secondaryContrast: "#FFFFFF",
	background: "#121212",
	paper: "#121212",
	text: "#FFFFFF",
	textSecondary: "rgba(255, 255, 255, 0.7)",
	divider: "rgba(255, 255, 255, 0.12)",
	error: "#F44336",
	warning: "#FFA726",
	info: "#29B6F6",
	success: "#66BB6A",
	fontFamily: h,
	fontSize: 14,
	borderRadius: 4
}), v = [
	"primary",
	"primaryContrast",
	"secondary",
	"secondaryContrast",
	"background",
	"paper",
	"text",
	"textSecondary",
	"divider",
	"error",
	"warning",
	"info",
	"success",
	"fontFamily"
], y = ["fontSize", "borderRadius"];
function ee(e) {
	return { ...e === "dark" ? _ : g };
}
function b(e) {
	if (!e || typeof e != "object") return ee(typeof e == "string" ? e : "light");
	let t = e, n = ee(typeof t.type == "string" ? t.type : "light");
	for (let e of v) {
		let r = t[e];
		typeof r == "string" && r.trim() && (n[e] = r.trim());
	}
	for (let e of y) {
		let r = t[e], i = typeof r == "string" ? parseFloat(r) : r;
		typeof i == "number" && Number.isFinite(i) && i >= 0 && (n[e] = i);
	}
	return n;
}
function te(e, t) {
	return e.type === t.type && v.every((n) => e[n] === t[n]) && y.every((n) => e[n] === t[n]);
}
function ne(e) {
	return `--iob-${e.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`)}`;
}
function x(e) {
	let t = {};
	for (let n of v) t[ne(n)] = e[n];
	for (let n of y) t[ne(n)] = `${e[n]}px`;
	return t["color-scheme"] = e.type, t;
}
// ../node_modules/@iobroker/web-components/build/nativeDialog.js
var re = {
	ok: {
		en: "OK",
		"zh-cn": "确定"
	},
	cancel: {
		en: "Cancel",
		de: "Abbrechen",
		ru: "Отмена",
		pt: "Cancelar",
		nl: "Annuleren",
		fr: "Annuler",
		it: "Annulla",
		es: "Cancelar",
		pl: "Anuluj",
		uk: "Скасувати",
		"zh-cn": "取消"
	},
	close: {
		en: "Close",
		de: "Schließen",
		ru: "Закрыть",
		pt: "Fechar",
		nl: "Sluiten",
		fr: "Fermer",
		it: "Chiudi",
		es: "Cerrar",
		pl: "Zamknij",
		uk: "Закрити",
		"zh-cn": "关闭"
	}
}, ie = "\ndialog {\n    box-sizing: border-box;\n    width: 480px;\n    max-width: calc(100vw - 32px);\n    max-height: calc(100vh - 32px);\n    padding: 0;\n    border: 0;\n    border-radius: calc(var(--iob-border-radius) * 2);\n    background: var(--iob-paper);\n    color: var(--iob-text);\n    font-family: var(--iob-font-family);\n    font-size: var(--iob-font-size);\n    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);\n}\n/* as the dialogs of MUI: a dark paper gets lighter the higher it lies */\ndialog.dark { background-image: linear-gradient(rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.16)); }\ndialog::backdrop { background: rgba(0, 0, 0, 0.5); }\ndialog:focus { outline: none; }\nform { display: flex; flex-direction: column; height: 100%; max-height: inherit; margin: 0; }\nheader { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; font-size: 1.15em; font-weight: 500; }\nheader span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.body { flex: 1; min-height: 0; padding: 0 16px 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }\nfooter { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }\nbutton { font: inherit; padding: 6px 16px; border-radius: var(--iob-border-radius); border: 1px solid var(--iob-primary); background: transparent; color: var(--iob-primary); cursor: pointer; }\nbutton.primary { background: var(--iob-primary); color: var(--iob-primary-contrast); }\nbutton.close { border: 0; padding: 2px 8px; font-size: 1.4em; line-height: 1; color: var(--iob-text-secondary); }\nlabel { display: flex; flex-direction: column; gap: 4px; }\nlabel.check { flex-direction: row; align-items: center; gap: 8px; }\ninput, select, textarea { font: inherit; accent-color: var(--iob-primary); }\n.help { color: var(--iob-text-secondary); font-size: 0.85em; }\nh3 { margin: 4px 0 0; font-size: 1em; }\np { margin: 0; }\nhr { width: 100%; border: 0; border-top: 1px solid var(--iob-divider); margin: 0; }\n[hidden] { display: none !important; }\n";
function ae(e) {
	if (!e) return null;
	try {
		let t = Function("data", `return (${e});`);
		return (e) => {
			try {
				return !!t(e);
			} catch {
				return !1;
			}
		};
	} catch {
		return null;
	}
}
function oe(e) {
	return typeof e == "string" ? e : typeof e == "number" || typeof e == "boolean" ? String(e) : "";
}
function se(e) {
	let { input: t, setting: n } = e;
	if (t) return t instanceof HTMLInputElement && t.type === "checkbox" ? t.checked : t instanceof HTMLSelectElement ? n.options?.[t.selectedIndex]?.value : t.value;
}
function ce(e, t, n, r, i) {
	let a = {
		name: t,
		setting: n,
		box: e.createElement("div"),
		hidden: ae(n.hidden),
		disabled: ae(n.disabled)
	}, o = u(n.label, i);
	switch (n.type) {
		case "header": return a.box = e.createElement("h3"), a.box.textContent = u(n.text, i) || o, a;
		case "staticText": return a.box = e.createElement("p"), a.box.textContent = u(n.text, i) || o, a;
		case "divider": return a.box = e.createElement("hr"), a;
	}
	let s = e.createElement("label");
	a.box = s;
	let c = e.createElement("span");
	if (c.textContent = o || t, n.type === "checkbox") {
		let t = e.createElement("input");
		t.type = "checkbox", t.checked = r === !0 || r === "true", s.className = "check", s.append(t, c), a.input = t;
	} else if (n.type === "select") {
		let t = e.createElement("select");
		for (let r of n.options || []) {
			let n = e.createElement("option");
			n.textContent = u(r.label, i), t.append(n);
		}
		let o = (n.options || []).findIndex((e) => String(e.value) === oe(r));
		t.selectedIndex = o === -1 ? 0 : o, s.append(c, t), a.input = t;
	} else if (n.type === "text" && (n.minRows || 1) > 1) {
		let t = e.createElement("textarea");
		t.rows = n.minRows || 2, t.value = oe(r), s.append(c, t), a.input = t;
	} else {
		let t = e.createElement("input"), i = oe(r);
		switch (n.type) {
			case "number":
			case "slider":
				t.type = n.type === "slider" ? "range" : "number", n.min !== void 0 && (t.min = String(n.min)), n.max !== void 0 && (t.max = String(n.max)), t.step = n.step === void 0 ? "any" : String(n.step);
				break;
			case "password":
				t.type = "password";
				break;
			case "color":
				t.type = !i || /^#[0-9a-f]{6}$/i.test(i) ? "color" : "text";
				break;
			default: t.type = "text";
		}
		if (t.value = i, t.type === "range") {
			let n = e.createElement("output");
			n.textContent = t.value, t.addEventListener("input", () => n.textContent = t.value), c.append(": ", n);
		}
		s.append(c, t), a.input = t;
	}
	if (n.help) {
		let t = e.createElement("span");
		t.className = "help", t.textContent = u(n.help, i), s.append(t);
	}
	return a;
}
function le(e, t = {}) {
	let n = t.lang || "en", r = document, i = (e) => re[e][n] || re[e].en || e, a = r.createElement("div");
	a.setAttribute("data-iob-dialog", "");
	let o = a.attachShadow({ mode: "open" }), l = r.createElement("style");
	l.textContent = ie;
	let f = r.createElement("dialog"), p = b(t.theme);
	f.className = p.type === "dark" ? "dark" : "";
	for (let [e, t] of Object.entries(x(p))) f.style.setProperty(e, t);
	e.width && (f.style.width = `${e.width}px`), e.height && (f.style.height = `${e.height}px`);
	let h = r.createElement("form"), g = r.createElement("header"), _ = r.createElement("span");
	_.textContent = u(e.title, n);
	let v = r.createElement("button");
	v.type = "button", v.className = "close", v.title = i("close"), v.setAttribute("aria-label", i("close")), v.textContent = "×", g.append(_, v);
	let y = r.createElement("div");
	return y.className = "body", h.append(g, y), f.append(h), o.append(l, f), new Promise((t) => {
		let l = !1, p = (e) => {
			l || (l = !0, f.open && f.close(), a.remove(), t(e));
		};
		if (v.addEventListener("click", () => p(null)), f.addEventListener("close", () => p(null)), h.addEventListener("submit", (e) => e.preventDefault()), c(e)) {
			let t = {}, a = [];
			for (let [t, i] of Object.entries(e.form.items || {})) {
				let o = e.data?.[t] ?? i.default, s = ce(r, t, i, o, n);
				a.push(s), y.append(s.box);
			}
			let o = () => {
				for (let e of a) e.input && (t[e.name] = se(e));
				return t;
			}, s = () => {
				let e = o();
				for (let t of a) t.box.hidden = t.hidden ? t.hidden(e) : !1, t.input && (t.input.disabled = t.disabled ? t.disabled(e) : !1);
			};
			h.addEventListener("input", s), h.addEventListener("change", s), s();
			let c = a.find((e) => e.input && !e.box.hidden && !e.input.disabled);
			c?.input && (c.input.autofocus = !0);
			let l = r.createElement("footer"), f = r.createElement("button");
			f.type = "button", f.textContent = u(e.cancel, n) || i("cancel"), f.addEventListener("click", () => p(null));
			let g = r.createElement("button");
			g.type = "submit", g.className = "primary", g.textContent = u(e.ok, n) || i("ok"), l.append(f, g), h.append(l), h.addEventListener("submit", () => p(m(d(e.form), o())));
		} else y.append(e.element), f.addEventListener(s, (e) => p(e.detail ?? null));
		r.body.append(a), f.showModal(), o.activeElement && o.activeElement !== v || (f.tabIndex = -1, f.focus());
	});
}
// ../node_modules/@iobroker/web-components/build/element.js
function ue(e) {
	return [...new Set(e.filter((e) => typeof e == "string" && !!e))];
}
var de = [
	"socket",
	"dialogs",
	"theme",
	"editMode",
	"settings",
	"value"
], fe = class extends HTMLElement {
	states = {};
	objects = {};
	#e = null;
	#t = {};
	#n = b("light");
	#r = !1;
	#i = null;
	#a = void 0;
	#o = null;
	#s = !1;
	#c = (e, t) => {
		this.#o?.states.includes(e) && (this.states[e] = t || null, this.#_());
	};
	#l = (e, t) => {
		this.#o?.objects.includes(e) && (this.objects[e] = t || null, this.#d());
	};
	get socket() {
		return this.#e;
	}
	set socket(e) {
		this.#e = e || null, this.#d();
	}
	get settings() {
		return this.#t;
	}
	set settings(e) {
		this.#t = e || {}, this.#d();
	}
	get theme() {
		return this.#n;
	}
	set theme(e) {
		let t = b(e);
		te(t, this.#n) || (this.#n = t, this.#u(), this.#_());
	}
	get editMode() {
		return this.#r;
	}
	set editMode(e) {
		let t = !!e;
		t !== this.#r && (this.#r = t, this.#_());
	}
	get dialogs() {
		return this.#i;
	}
	set dialogs(e) {
		this.#i = e || null;
	}
	get value() {
		return this.#a;
	}
	set value(e) {
		e !== this.#a && (this.#a = e, this.#_());
	}
	connectedCallback() {
		for (let e of de) if (Object.prototype.hasOwnProperty.call(this, e)) {
			let t = this[e];
			delete this[e], this[e] = t;
		}
		this.#u(), this.#d();
	}
	disconnectedCallback() {
		this.#g();
	}
	getStateIds(e) {
		return [];
	}
	getObjectIds(e) {
		return [];
	}
	get systemLang() {
		return this.#e?.systemLang || "en";
	}
	text(e) {
		return u(e, this.systemLang);
	}
	setState(e, t) {
		return this.#e && !this.#r ? this.#e.setState(e, t) : Promise.resolve();
	}
	changeValue(e) {
		return this.#r || this.emit("iob-change", e) ? !1 : (this.value = e, !0);
	}
	emit(e, t) {
		return this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0,
			cancelable: !0
		}));
	}
	async openDialog(e) {
		if (this.#r) return null;
		let t = this.#i ? await this.#i.open(e) : await le(e, {
			lang: this.systemLang,
			theme: this.#n
		});
		return c(e) ? t && typeof t == "object" ? m(d(e.form), t) : null : t ?? null;
	}
	#u() {
		for (let [e, t] of Object.entries(x(this.#n))) this.style.setProperty(e, t);
	}
	#d() {
		if (!this.isConnected) return;
		let e = this.#e, t = e ? ue(this.getStateIds(this.#t)) : [], n = e ? ue(this.getObjectIds(this.#t)) : [];
		this.#o && this.#o.socket !== e && this.#g();
		let r = this.#o?.states || [], i = this.#o?.objects || [], a = r.filter((e) => !t.includes(e)), o = i.filter((e) => !n.includes(e)), s = t.filter((e) => !r.includes(e)), c = n.filter((e) => !i.includes(e));
		e && a.length && e.unsubscribeState(a, this.#c), e && o.length && this.#h(e, o);
		for (let e of a) delete this.states[e];
		for (let e of [...a, ...o]) !t.includes(e) && !n.includes(e) && delete this.objects[e];
		this.#o = e && (t.length || n.length) ? {
			socket: e,
			states: t,
			objects: n
		} : null, e && s.length && this.#p(e, s), e && c.length && this.#m(e, c), this.#_();
	}
	#f(e, t, n) {
		return this.#o?.socket === e && this.#o[t].includes(n);
	}
	#p(e, t) {
		e.subscribeState(t, this.#c).catch((e) => console.warn(`<${this.localName}>: cannot subscribe ${t.join(", ")}: ${e}`));
		for (let n of t) e.getState(n).then((t) => {
			this.#f(e, "states", n) && this.states[n] === void 0 && (this.states[n] = t || null, this.#_());
		}).catch(() => {}), e.getObject(n).then((t) => {
			this.#f(e, "states", n) && !this.#f(e, "objects", n) && (this.objects[n] = t || null, this.#_());
		}).catch(() => {});
	}
	#m(e, t) {
		e.subscribeObject(t, this.#l).catch((e) => console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(", ")}: ${e}`));
		for (let n of t) e.getObject(n).then((t) => {
			this.#f(e, "objects", n) && (this.objects[n] = t || null, this.#d());
		}).catch(() => {});
	}
	#h(e, t) {
		e.unsubscribeObject(t, this.#l).catch(() => {});
	}
	#g() {
		if (this.#o) {
			let { socket: e, states: t, objects: n } = this.#o;
			t.length && e.unsubscribeState(t, this.#c), n.length && this.#h(e, n), this.#o = null;
		}
		this.states = {}, this.objects = {};
	}
	#_() {
		this.#s || (this.#s = !0, queueMicrotask(() => {
			this.#s = !1, this.isConnected && this.render();
		}));
	}
};
function pe(e, t) {
	let n = typeof e == "string" ? e : e.tag;
	customElements.get(n) || customElements.define(n, t);
}
// src/WakewordView.tsx
var me = "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3m5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z", he = {
	de: {
		disabled: "Mikrofon aus",
		initializing: "Initialisierung…",
		listening: "Warte auf Aktivierungswort",
		activated: "Aktiviert",
		recording: "Aufnahme läuft",
		processing: "Verarbeitung…",
		result: "Ergebnis",
		error: "Fehler",
		on: "Mikrofon deaktivieren",
		off: "Mikrofon aktivieren",
		ptt: "Sprechen",
		stop: "Aufnahme beenden",
		editor: "Mikrofon im Editor deaktiviert",
		chat: "Gesprächsverlauf",
		you: "Du",
		pending: "Antwort wird verarbeitet…",
		empty: "Noch keine erkannten Texte"
	},
	en: {
		disabled: "Microphone off",
		initializing: "Initializing…",
		listening: "Waiting for wake word",
		activated: "Activated",
		recording: "Recording",
		processing: "Processing…",
		result: "Result",
		error: "Error",
		on: "Disable microphone",
		off: "Enable microphone",
		ptt: "Speak",
		stop: "Finish recording",
		editor: "Microphone disabled in editor",
		chat: "Conversation",
		you: "You",
		pending: "Processing reply…",
		empty: "No recognized text yet"
	}
}, ge = t(function({ messages: e, language: t, maxMessages: o }) {
	let s = r(null), c = r(null), l = () => {
		s.current && (s.current.scrollTop = s.current.scrollHeight);
	};
	n(l, [e, o]), n(() => {
		if (!s.current || !c.current || typeof ResizeObserver > "u") return;
		let e = new ResizeObserver(l);
		e.observe(s.current), e.observe(c.current);
		let t = s.current.getRootNode(), n = t instanceof ShadowRoot ? t.host.closest(".vis-widget") : null, r = n ? new MutationObserver(l) : null;
		return n && r && r.observe(n, {
			attributes: !0,
			attributeFilter: ["style", "class"]
		}), () => {
			e.disconnect(), r?.disconnect();
		};
	}, []);
	let u = he[t];
	return /* @__PURE__ */ i("section", {
		part: "chat",
		className: "chat",
		"aria-label": u.chat,
		role: "log",
		ref: s,
		children: /* @__PURE__ */ i("div", {
			className: "chat-content",
			ref: c,
			children: e.length ? e.slice(-o).map((e) => /* @__PURE__ */ a("div", {
				part: e.role === "user" ? "chat-user" : "chat-reply",
				className: `chat-entry ${e.role} ${e.status || ""}`,
				children: [/* @__PURE__ */ i("span", {
					className: "chat-source",
					children: e.role === "user" ? u.you : e.source || "smart-text2command"
				}), /* @__PURE__ */ i("p", { children: e.status === "pending" ? u.pending : e.text })]
			}, e.id)) : /* @__PURE__ */ i("p", {
				className: "chat-empty",
				children: u.empty
			})
		})
	});
});
function _e(e) {
	let { snapshot: t } = e, n = he[e.language], r = t.enabled;
	return /* @__PURE__ */ a("div", {
		part: "content",
		className: `wakeword ${e.compact ? "compact" : ""} ${e.showChat ? "with-chat" : ""}`,
		style: {
			...e.accentColor ? { "--wake-accent": e.accentColor } : {},
			...e.fontSize ? { fontSize: e.fontSize } : {}
		},
		children: [
			/* @__PURE__ */ a("div", {
				className: "top",
				children: [/* @__PURE__ */ i("button", {
					type: "button",
					part: "microphone",
					className: `mic ${r ? "on" : ""}`,
					"aria-pressed": r,
					"aria-label": r ? n.on : n.off,
					title: r ? n.on : n.off,
					disabled: e.editMode || t.phase === "initializing",
					onClick: e.onToggle,
					children: /* @__PURE__ */ i("svg", {
						viewBox: "0 0 24 24",
						"aria-hidden": "true",
						children: /* @__PURE__ */ i("path", { d: me })
					})
				}), /* @__PURE__ */ a("div", {
					part: "status",
					className: "status",
					children: [/* @__PURE__ */ i("strong", { children: e.editMode ? n.editor : n[t.phase] }), t.wakeword && !e.compact ? /* @__PURE__ */ i("small", { children: t.wakeword }) : null]
				})]
			}),
			/* @__PURE__ */ i("div", {
				part: "meter",
				className: "meter",
				role: "meter",
				"aria-label": "Microphone level",
				"aria-valuenow": Math.round(t.level * 100),
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				children: /* @__PURE__ */ i("span", { style: { width: `${Math.round(t.level * 100)}%` } })
			}),
			e.showText && t.text && !e.compact && (!e.showChat || t.phase !== "result") ? /* @__PURE__ */ i("p", {
				part: "transcript",
				className: "text",
				children: t.text
			}) : null,
			t.error && !e.compact ? /* @__PURE__ */ i("p", {
				className: "error",
				role: "alert",
				children: t.error
			}) : null,
			e.showChat ? /* @__PURE__ */ i(ge, {
				messages: t.chat,
				language: e.language,
				maxMessages: e.maxChatMessages
			}) : null,
			(e.mode === "ptt" || e.mode === "combined") && !e.editMode ? /* @__PURE__ */ a("div", {
				className: "actions",
				children: [/* @__PURE__ */ i("button", {
					type: "button",
					onClick: e.onPtt,
					disabled: t.phase === "initializing" || t.phase === "processing" || t.phase === "recording",
					children: n.ptt
				}), t.phase === "recording" ? /* @__PURE__ */ i("button", {
					type: "button",
					onClick: e.onStop,
					children: n.stop
				}) : null]
			}) : null
		]
	});
}
// src/audio.ts
var ve = 16e3;
function ye(e) {
	let t = new Uint8Array(e.length * 2), n = new DataView(t.buffer);
	for (let t = 0; t < e.length; t++) {
		let r = Math.max(-1, Math.min(1, e[t]));
		n.setInt16(t * 2, Math.round(r < 0 ? r * 32768 : r * 32767), !0);
	}
	let r = "";
	for (let e = 0; e < t.length; e += 32768) r += String.fromCharCode(...t.subarray(e, e + 32768));
	return btoa(r);
}
function be(e) {
	if (!e.length) return 0;
	let t = 0;
	for (let n of e) t += n * n;
	return Math.sqrt(t / e.length);
}
var xe = class {
	maxSamples;
	chunks = [];
	count = 0;
	constructor(e) {
		this.maxSamples = e;
	}
	push(e) {
		for (this.chunks.push(e.slice()), this.count += e.length; this.count > this.maxSamples && this.chunks.length;) {
			let e = this.count - this.maxSamples, t = this.chunks[0];
			t.length <= e ? (this.chunks.shift(), this.count -= t.length) : (this.chunks[0] = t.slice(e), this.count -= e);
		}
	}
	snapshot() {
		let e = new Float32Array(this.count), t = 0;
		for (let n of this.chunks) e.set(n, t), t += n.length;
		return e;
	}
	clear() {
		this.chunks = [], this.count = 0;
	}
}, Se = class {
	options;
	elapsed = 0;
	speechMs = 0;
	silence = 0;
	constructor(e) {
		this.options = e;
	}
	push(e) {
		let t = e.length / ve * 1e3;
		return this.elapsed += t, be(e) >= this.options.threshold ? (this.speechMs += t, this.silence = 0) : this.speechMs >= this.options.minSpeechMs && (this.silence += t), this.elapsed >= this.options.maxRecordMs || this.speechMs >= this.options.minSpeechMs && this.silence >= this.options.silenceMs ? "done" : this.speechMs < this.options.minSpeechMs && this.elapsed >= this.options.noSpeechMs ? "no-speech" : "continue";
	}
}, Ce = class {
	call;
	onEvent;
	onFailure;
	id = "";
	seq = 0;
	queue = [];
	queuedSamples = 0;
	timer;
	busy = !1;
	stopping = !1;
	stopSent = !1;
	finished = !1;
	lastCall = 0;
	constructor(e, t, n) {
		this.call = e, this.onEvent = t, this.onFailure = n;
	}
	get sessionId() {
		return this.id;
	}
	async start() {
		let e = await this.request({ action: "start" });
		if (!e.id || e.sampleRate !== 16e3) throw Error("Invalid Parakeet live start response");
		this.id = e.id, this.timer = window.setInterval(() => void this.tick(), 200);
	}
	push(e) {
		!this.id || this.stopping || this.finished || (this.queue.push(e.slice()), this.queuedSamples += e.length, this.queuedSamples > 128e3 && this.fail(/* @__PURE__ */ Error("Audio connection is too slow")));
	}
	stop() {
		this.stopping = !0, this.tick();
	}
	async cancel() {
		this.finished = !0, this.timer && window.clearInterval(this.timer), this.queue = [], this.id && await this.request({
			action: "cancel",
			id: this.id
		}).catch(() => {});
	}
	async request(e) {
		let t;
		try {
			let n = await Promise.race([this.call(e), new Promise((e, n) => {
				t = setTimeout(() => n(/* @__PURE__ */ Error("Parakeet timeout")), 15e3);
			})]);
			if (!n || n.error) throw Error(n?.error || "Empty Parakeet response");
			return n;
		} finally {
			t && clearTimeout(t);
		}
	}
	async tick() {
		if (!this.id || this.busy || this.finished) return;
		let e;
		if (this.queue.length) {
			let t = new Float32Array(this.queuedSamples), n = 0;
			for (let e of this.queue) t.set(e, n), n += e.length;
			this.queue = [], this.queuedSamples = 0, e = {
				action: "audio",
				id: this.id,
				seq: ++this.seq,
				pcm: ye(t)
			};
		} else this.stopping && !this.stopSent ? (this.stopSent = !0, e = {
			action: "stop",
			id: this.id,
			seq: ++this.seq
		}) : Date.now() - this.lastCall >= 400 && (e = {
			action: "poll",
			id: this.id
		});
		if (e) {
			this.busy = !0;
			try {
				let t = await this.request(e);
				this.lastCall = Date.now();
				for (let e of t.events || []) if (this.onEvent(e), e.type === "done" && (this.finished = !0, this.timer && clearInterval(this.timer)), e.type === "error") throw Error(e.message || "Parakeet error");
			} catch (e) {
				this.fail(e);
			} finally {
				this.busy = !1;
			}
		}
	}
	fail(e) {
		this.finished || (this.finished = !0, this.timer && clearInterval(this.timer), this.onFailure(e), this.id && this.request({
			action: "cancel",
			id: this.id
		}).catch(() => {}));
	}
}, we = Object.defineProperty, Te = Object.getOwnPropertyDescriptor, Ee = Object.getOwnPropertyNames, De = Object.prototype.hasOwnProperty, Oe = ((e) => typeof o < "u" ? o : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof o < "u" ? o : e)[t] }) : e)(function(e) {
	if (typeof o < "u") return o.apply(this, arguments);
	throw Error("Dynamic require of \"" + e + "\" is not supported");
}), S = (e, t, n) => () => {
	if (n) throw n[0];
	try {
		return e && (t = e(e = 0)), t;
	} catch (e) {
		throw n = [e], e;
	}
}, ke = (e, t) => {
	for (var n in t) we(e, n, {
		get: t[n],
		enumerable: !0
	});
}, Ae = (e, t, n, r) => {
	if (t && typeof t == "object" || typeof t == "function") for (let i of Ee(t)) !De.call(e, i) && i !== n && we(e, i, {
		get: () => t[i],
		enumerable: !(r = Te(t, i)) || r.enumerable
	});
	return e;
}, je = (e) => Ae(we({}, "__esModule", { value: !0 }), e), C, w, Me, Ne, Pe, Fe, Ie, Le = S(() => {
	C = /* @__PURE__ */ new Map(), w = [], Me = /* @__PURE__ */ new WeakMap(), Ne = (e, t, n) => {
		if (t && typeof t.init == "function" && typeof t.createInferenceSessionHandler == "function") {
			let r = C.get(e);
			if (r === void 0) C.set(e, {
				backend: t,
				priority: n
			});
			else {
				if (r.priority > n) return;
				if (r.priority === n && r.backend !== t) throw Error(`cannot register backend "${e}" using priority ${n}`);
			}
			if (n >= 0) {
				let t = w.indexOf(e);
				t !== -1 && w.splice(t, 1);
				for (let t = 0; t < w.length; t++) if (C.get(w[t]).priority <= n) {
					w.splice(t, 0, e);
					return;
				}
				w.push(e);
			}
		} else throw TypeError("not a valid backend");
	}, Pe = async (e) => {
		let t = C.get(e);
		if (!t) return "backend not found.";
		if (t.initialized) return t.backend;
		if (t.aborted) return t.error;
		{
			let n = !!t.initPromise;
			try {
				if (!n) {
					let n = t.backend, r = Me.get(n);
					t.initPromise = r ? r.then(async () => n.init(e), async () => n.init(e)) : n.init(e), Me.set(n, t.initPromise);
				}
				return await t.initPromise, t.initialized = !0, t.backend;
			} catch (e) {
				return n || (t.error = `${e}`, t.aborted = !0), t.error;
			} finally {
				delete t.initPromise;
			}
		}
	}, Fe = async (e) => {
		let t = e.executionProviders || [], n = t.map((e) => typeof e == "string" ? e : e.name), r = n.length === 0 ? w : n, i, a = [], o = /* @__PURE__ */ new Set();
		for (let e of r) {
			let t = await Pe(e);
			typeof t == "string" ? a.push({
				name: e,
				err: t
			}) : (i ||= t, i === t && o.add(e));
		}
		if (!i) throw Error(`no available backend found. ERR: ${a.map((e) => `[${e.name}] ${e.err}`).join(", ")}`);
		for (let { name: e, err: t } of a) n.includes(e) && console.warn(`removing requested execution provider "${e}" from session options because it is not available: ${t}`);
		let s = t.filter((e) => o.has(typeof e == "string" ? e : e.name));
		return [i, new Proxy(e, { get: (e, t) => t === "executionProviders" ? s : Reflect.get(e, t) })];
	}, Ie = async () => {
		let e = [];
		for (let t of w) {
			if (typeof C.get(t).backend.createLoraAdapterHandler != "function") continue;
			let n = await Pe(t);
			if (typeof n != "string") return n;
			e.push({
				name: t,
				err: n
			});
		}
		let t = e.length === 0 ? "" : ` ERR: ${e.map((e) => `[${e.name}] ${e.err}`).join(", ")}`;
		throw Error(`no available backend supports LoRA adapters.${t}`);
	};
}), Re = S(() => {
	Le();
}), ze, Be = S(() => {
	ze = "1.31.1";
}), Ve, T, He = S(() => {
	Be(), Ve = "warning", T = {
		wasm: {},
		webgl: {},
		webgpu: {},
		versions: { common: ze },
		set logLevel(e) {
			if (e !== void 0) {
				if (typeof e != "string" || [
					"verbose",
					"info",
					"warning",
					"error",
					"fatal"
				].indexOf(e) === -1) throw Error(`Unsupported logging level: ${e}`);
				Ve = e;
			}
		},
		get logLevel() {
			return Ve;
		}
	}, Object.defineProperty(T, "logLevel", { enumerable: !0 });
}), E, Ue = S(() => {
	He(), E = T;
}), We, Ge, D, O, k, A, Ke = S(() => {
	He(), We = (e, t) => {
		(typeof T.trace > "u" ? !T.wasm.trace : !T.trace) || console.timeStamp(`${e}::ORT::${t}`);
	}, Ge = (e, t) => {
		let n = (/* @__PURE__ */ Error()).stack?.split(/\r\n|\r|\n/g) || [], r = !1;
		for (let i = 0; i < n.length; i++) {
			if (r && !n[i].includes("TRACE_FUNC")) {
				let r = `FUNC_${e}::${n[i].trim().split(" ")[1]}`;
				t && (r += `::${t}`), We("CPU", r);
				return;
			}
			n[i].includes("TRACE_FUNC") && (r = !0);
		}
	}, D = (e) => {
		(typeof T.trace > "u" ? !T.wasm.trace : !T.trace) || Ge("BEGIN", e);
	}, O = (e) => {
		(typeof T.trace > "u" ? !T.wasm.trace : !T.trace) || Ge("END", e);
	}, k = (e) => {
		(typeof T.trace > "u" ? !T.wasm.trace : !T.trace) || console.time(`ORT::${e}`);
	}, A = (e) => {
		(typeof T.trace > "u" ? !T.wasm.trace : !T.trace) || console.timeEnd(`ORT::${e}`);
	};
}), qe, Je = S(() => {
	Le(), Ke(), qe = class e {
		constructor(e, t) {
			this.backend = e, this.handler = t;
		}
		static async create(t) {
			if (D(), typeof t != "string" && !(t instanceof Uint8Array)) throw TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
			let n = await Ie(), r = await n.createLoraAdapterHandler(t);
			return O(), new e(n, r);
		}
		async release() {
			return this.handler.dispose();
		}
	};
}), Ye, Xe, Ze = S(() => {
	Ye = (e, t) => {
		let n = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
		n.width = e.dims[3], n.height = e.dims[2];
		let r = n.getContext("2d");
		if (r != null) {
			let i, a;
			t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (i = e.dims[2], a = e.dims[3]) : (i = e.dims[3], a = e.dims[2]);
			let o = t?.format === void 0 ? "RGB" : t.format, s = t?.norm, c, l;
			s === void 0 || s.mean === void 0 ? c = [
				255,
				255,
				255,
				255
			] : typeof s.mean == "number" ? c = [
				s.mean,
				s.mean,
				s.mean,
				s.mean
			] : (c = [
				s.mean[0],
				s.mean[1],
				s.mean[2],
				0
			], s.mean[3] !== void 0 && (c[3] = s.mean[3])), s === void 0 || s.bias === void 0 ? l = [
				0,
				0,
				0,
				0
			] : typeof s.bias == "number" ? l = [
				s.bias,
				s.bias,
				s.bias,
				s.bias
			] : (l = [
				s.bias[0],
				s.bias[1],
				s.bias[2],
				0
			], s.bias[3] !== void 0 && (l[3] = s.bias[3]));
			let u = a * i, d = 0, f = u, p = u * 2, m = -1;
			o === "RGBA" ? (d = 0, f = u, p = u * 2, m = u * 3) : o === "RGB" ? (d = 0, f = u, p = u * 2) : o === "RBG" && (d = 0, p = u, f = u * 2);
			for (let t = 0; t < a; t++) for (let n = 0; n < i; n++) {
				let i = (e.data[d++] - l[0]) * c[0], a = (e.data[f++] - l[1]) * c[1], o = (e.data[p++] - l[2]) * c[2], s = m === -1 ? 255 : (e.data[m++] - l[3]) * c[3];
				r.fillStyle = "rgba(" + i + "," + a + "," + o + "," + s + ")", r.fillRect(n, t, 1, 1);
			}
			if ("toDataURL" in n) return n.toDataURL();
			throw Error("toDataURL is not supported");
		}
		throw Error("Can not access image data");
	}, Xe = (e, t) => {
		let n = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d"), r;
		if (n != null) {
			let i, a, o;
			t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (i = e.dims[2], a = e.dims[1], o = e.dims[3]) : (i = e.dims[3], a = e.dims[2], o = e.dims[1]);
			let s = t !== void 0 && t.format !== void 0 ? t.format : "RGB", c = t?.norm, l, u;
			c === void 0 || c.mean === void 0 ? l = [
				255,
				255,
				255,
				255
			] : typeof c.mean == "number" ? l = [
				c.mean,
				c.mean,
				c.mean,
				c.mean
			] : (l = [
				c.mean[0],
				c.mean[1],
				c.mean[2],
				255
			], c.mean[3] !== void 0 && (l[3] = c.mean[3])), c === void 0 || c.bias === void 0 ? u = [
				0,
				0,
				0,
				0
			] : typeof c.bias == "number" ? u = [
				c.bias,
				c.bias,
				c.bias,
				c.bias
			] : (u = [
				c.bias[0],
				c.bias[1],
				c.bias[2],
				0
			], c.bias[3] !== void 0 && (u[3] = c.bias[3]));
			let d = a * i;
			if (t !== void 0 && (t.format !== void 0 && o === 4 && t.format !== "RGBA" || o === 3 && t.format !== "RGB" && t.format !== "BGR")) throw Error("Tensor format doesn't match input tensor dims");
			let f = 0, p = 1, m = 2, h = 3, g = 0, _ = d, v = d * 2, y = -1;
			s === "RGBA" ? (g = 0, _ = d, v = d * 2, y = d * 3) : s === "RGB" ? (g = 0, _ = d, v = d * 2) : s === "RBG" && (g = 0, v = d, _ = d * 2), r = n.createImageData(i, a);
			for (let t = 0; t < a * i; f += 4, p += 4, m += 4, h += 4, t++) r.data[f] = (e.data[g++] - u[0]) * l[0], r.data[p] = (e.data[_++] - u[1]) * l[1], r.data[m] = (e.data[v++] - u[2]) * l[2], r.data[h] = y === -1 ? 255 : (e.data[y++] - u[3]) * l[3];
		} else throw Error("Can not access image data");
		return r;
	};
}), Qe, $e, et, tt, nt, rt, it = S(() => {
	ft(), Qe = (e, t) => {
		if (e === void 0) throw Error("Image buffer must be defined");
		if (t.height === void 0 || t.width === void 0) throw Error("Image height and width must be defined");
		if (t.tensorLayout === "NHWC") throw Error("NHWC Tensor layout is not supported yet");
		let { height: n, width: r } = t, i = t.norm ?? {
			mean: 255,
			bias: 0
		}, a, o;
		a = typeof i.mean == "number" ? [
			i.mean,
			i.mean,
			i.mean,
			i.mean
		] : [
			i.mean[0],
			i.mean[1],
			i.mean[2],
			i.mean[3] ?? 255
		], o = typeof i.bias == "number" ? [
			i.bias,
			i.bias,
			i.bias,
			i.bias
		] : [
			i.bias[0],
			i.bias[1],
			i.bias[2],
			i.bias[3] ?? 0
		];
		let s = t.format === void 0 ? "RGBA" : t.format, c = t.tensorFormat !== void 0 && t.tensorFormat !== void 0 ? t.tensorFormat : "RGB", l = n * r, u = c === "RGBA" ? new Float32Array(l * 4) : new Float32Array(l * 3), d = 4, f = 0, p = 1, m = 2, h = 3, g = 0, _ = l, v = l * 2, y = -1;
		s === "RGB" && (d = 3, f = 0, p = 1, m = 2, h = -1), c === "RGBA" ? y = l * 3 : c === "RBG" ? (g = 0, v = l, _ = l * 2) : c === "BGR" && (v = 0, _ = l, g = l * 2);
		for (let t = 0; t < l; t++, f += d, m += d, p += d, h += d) u[g++] = (e[f] + o[0]) / a[0], u[_++] = (e[p] + o[1]) / a[1], u[v++] = (e[m] + o[2]) / a[2], y !== -1 && h !== -1 && (u[y++] = (e[h] + o[3]) / a[3]);
		return c === "RGBA" ? new M("float32", u, [
			1,
			4,
			n,
			r
		]) : new M("float32", u, [
			1,
			3,
			n,
			r
		]);
	}, $e = async (e, t) => {
		let n = typeof HTMLImageElement < "u" && e instanceof HTMLImageElement, r = typeof ImageData < "u" && e instanceof ImageData, i = typeof ImageBitmap < "u" && e instanceof ImageBitmap, a = typeof e == "string", o, s = t ?? {}, c = () => {
			if (typeof document < "u") return document.createElement("canvas");
			if (typeof OffscreenCanvas < "u") return new OffscreenCanvas(1, 1);
			throw Error("Canvas is not supported");
		}, l = (e) => typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || e instanceof OffscreenCanvas ? e.getContext("2d") : null;
		if (n) {
			let n = c();
			n.width = e.width, n.height = e.height;
			let r = l(n);
			if (r != null) {
				let n = e.height, i = e.width;
				if (t !== void 0 && t.resizedHeight !== void 0 && t.resizedWidth !== void 0 && (n = t.resizedHeight, i = t.resizedWidth), t !== void 0) {
					if (s = t, t.tensorFormat !== void 0) throw Error("Image input config format must be RGBA for HTMLImageElement");
					s.tensorFormat = "RGBA", s.height = n, s.width = i;
				} else s.tensorFormat = "RGBA", s.height = n, s.width = i;
				r.drawImage(e, 0, 0), o = r.getImageData(0, 0, i, n).data;
			} else throw Error("Can not access image data");
		} else if (r) {
			let n, r;
			if (t !== void 0 && t.resizedWidth !== void 0 && t.resizedHeight !== void 0 ? (n = t.resizedHeight, r = t.resizedWidth) : (n = e.height, r = e.width), t !== void 0 && (s = t), s.format = "RGBA", s.height = n, s.width = r, t !== void 0) {
				let t = c();
				t.width = r, t.height = n;
				let i = l(t);
				if (i != null) i.putImageData(e, 0, 0), o = i.getImageData(0, 0, r, n).data;
				else throw Error("Can not access image data");
			} else o = e.data;
		} else if (i) {
			if (t === void 0) throw Error("Please provide image config with format for Imagebitmap");
			let n = c();
			n.width = e.width, n.height = e.height;
			let r = l(n);
			if (r != null) {
				let t = e.height, n = e.width;
				return r.drawImage(e, 0, 0, n, t), o = r.getImageData(0, 0, n, t).data, s.height = t, s.width = n, Qe(o, s);
			}
			throw Error("Can not access image data");
		} else {
			if (a) return new Promise((t, n) => {
				let r = c(), i = l(r);
				if (!e || !i) return n();
				let a = new Image();
				a.crossOrigin = "Anonymous", a.src = e, a.onload = () => {
					r.width = a.width, r.height = a.height, i.drawImage(a, 0, 0, r.width, r.height);
					let e = i.getImageData(0, 0, r.width, r.height);
					s.height = r.height, s.width = r.width, t(Qe(e.data, s));
				};
			});
			throw Error("Input data provided is not supported - aborted tensor creation");
		}
		if (o !== void 0) return Qe(o, s);
		throw Error("Input data provided is not supported - aborted tensor creation");
	}, et = (e, t) => {
		let { width: n, height: r, download: i, dispose: a } = t;
		return new M({
			location: "texture",
			type: "float32",
			texture: e,
			dims: [
				1,
				r,
				n,
				4
			],
			download: i,
			dispose: a
		});
	}, tt = (e, t) => {
		let { dataType: n, dims: r, download: i, dispose: a } = t;
		return new M({
			location: "gpu-buffer",
			type: n ?? "float32",
			gpuBuffer: e,
			dims: r,
			download: i,
			dispose: a
		});
	}, nt = (e, t) => {
		let { dataType: n, dims: r, download: i, dispose: a } = t;
		return new M({
			location: "ml-tensor",
			type: n ?? "float32",
			mlTensor: e,
			dims: r,
			download: i,
			dispose: a
		});
	}, rt = (e, t, n) => new M({
		location: "cpu-pinned",
		type: e,
		data: t,
		dims: n ?? [t.length]
	});
}), j, at, ot, st, ct = S(() => {
	j = /* @__PURE__ */ new Map([
		["float32", Float32Array],
		["uint8", Uint8Array],
		["int8", Int8Array],
		["uint16", Uint16Array],
		["int16", Int16Array],
		["int32", Int32Array],
		["bool", Uint8Array],
		["float64", Float64Array],
		["uint32", Uint32Array],
		["int4", Uint8Array],
		["uint4", Uint8Array]
	]), at = /* @__PURE__ */ new Map([
		[Float32Array, "float32"],
		[Uint8Array, "uint8"],
		[Int8Array, "int8"],
		[Uint16Array, "uint16"],
		[Int16Array, "int16"],
		[Int32Array, "int32"],
		[Float64Array, "float64"],
		[Uint32Array, "uint32"]
	]), ot = !1, st = () => {
		if (!ot) {
			ot = !0;
			let e = typeof BigInt64Array < "u" && BigInt64Array.from, t = typeof BigUint64Array < "u" && BigUint64Array.from, n = globalThis.Float16Array, r = typeof n < "u" && n.from;
			e && (j.set("int64", BigInt64Array), at.set(BigInt64Array, "int64")), t && (j.set("uint64", BigUint64Array), at.set(BigUint64Array, "uint64")), r ? (j.set("float16", n), at.set(n, "float16")) : j.set("float16", Uint16Array);
		}
	};
}), lt, ut, dt = S(() => {
	ft(), lt = (e) => {
		let t = 1;
		for (let n = 0; n < e.length; n++) {
			let r = e[n];
			if (typeof r != "number" || !Number.isSafeInteger(r)) throw TypeError(`dims[${n}] must be an integer, got: ${r}`);
			if (r < 0) throw RangeError(`dims[${n}] must be a non-negative integer, got: ${r}`);
			t *= r;
		}
		return t;
	}, ut = (e, t) => {
		switch (e.location) {
			case "cpu": return new M(e.type, e.data, t);
			case "cpu-pinned": return new M({
				location: "cpu-pinned",
				data: e.data,
				type: e.type,
				dims: t
			});
			case "texture": return new M({
				location: "texture",
				texture: e.texture,
				type: e.type,
				dims: t
			});
			case "gpu-buffer": return new M({
				location: "gpu-buffer",
				gpuBuffer: e.gpuBuffer,
				type: e.type,
				dims: t
			});
			case "ml-tensor": return new M({
				location: "ml-tensor",
				mlTensor: e.mlTensor,
				type: e.type,
				dims: t
			});
			default: throw Error(`tensorReshape: tensor location ${e.location} is not supported`);
		}
	};
}), M, ft = S(() => {
	Ze(), it(), ct(), dt(), M = class {
		constructor(e, t, n) {
			st();
			let r, i;
			if (typeof e == "object" && "location" in e) switch (this.dataLocation = e.location, r = e.type, i = e.dims, e.location) {
				case "cpu-pinned": {
					let t = j.get(r);
					if (!t) throw TypeError(`unsupported type "${r}" to create tensor from pinned buffer`);
					if (!(e.data instanceof t)) throw TypeError(`buffer should be of type ${t.name}`);
					this.cpuData = e.data;
					break;
				}
				case "texture":
					if (r !== "float32") throw TypeError(`unsupported type "${r}" to create tensor from texture`);
					this.gpuTextureData = e.texture, this.downloader = e.download, this.disposer = e.dispose;
					break;
				case "gpu-buffer":
					if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw TypeError(`unsupported type "${r}" to create tensor from gpu buffer`);
					this.gpuBufferData = e.gpuBuffer, this.downloader = e.download, this.disposer = e.dispose;
					break;
				case "ml-tensor":
					if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint64" && r !== "int8" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw TypeError(`unsupported type "${r}" to create tensor from MLTensor`);
					this.mlTensorData = e.mlTensor, this.downloader = e.download, this.disposer = e.dispose;
					break;
				default: throw Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
			}
			else {
				let a, o;
				if (typeof e == "string") {
					if (r = e, o = n, e === "string") {
						if (!Array.isArray(t)) throw TypeError("A string tensor's data must be a string array.");
						a = t;
					} else {
						let n = j.get(e);
						if (n === void 0) throw TypeError(`Unsupported tensor type: ${e}.`);
						if (Array.isArray(t)) {
							if (e === "float16" && n === Uint16Array || e === "uint4" || e === "int4") throw TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${n.name} as data.`);
							a = e === "uint64" || e === "int64" ? n.from(t, BigInt) : n.from(t);
						} else if (t instanceof n) a = t;
						else if (t instanceof Uint8ClampedArray) {
							if (e === "uint8") a = Uint8Array.from(t);
							else throw TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
						} else if (e === "float16" && t instanceof Uint16Array && n !== Uint16Array) a = new globalThis.Float16Array(t.buffer, t.byteOffset, t.length);
						else throw TypeError(`A ${r} tensor's data must be type of ${n}`);
					}
				} else if (o = t, Array.isArray(e)) {
					if (e.length === 0) throw TypeError("Tensor type cannot be inferred from an empty array.");
					let t = typeof e[0];
					if (t === "string") r = "string", a = e;
					else if (t === "boolean") r = "bool", a = Uint8Array.from(e);
					else throw TypeError(`Invalid element type of data array: ${t}.`);
				} else if (e instanceof Uint8ClampedArray) r = "uint8", a = Uint8Array.from(e);
				else {
					let t = at.get(e.constructor);
					if (t === void 0) throw TypeError(`Unsupported type for tensor data: ${e.constructor}.`);
					r = t, a = e;
				}
				if (o === void 0) o = [a.length];
				else if (!Array.isArray(o)) throw TypeError("A tensor's dims must be a number array");
				i = o, this.cpuData = a, this.dataLocation = "cpu";
			}
			let a = lt(i);
			if (this.cpuData && a !== this.cpuData.length && (r !== "uint4" && r !== "int4" || Math.ceil(a / 2) !== this.cpuData.length)) throw Error(`Tensor's size(${a}) does not match data length(${this.cpuData.length}).`);
			this.type = r, this.dims = i, this.size = a;
		}
		static async fromImage(e, t) {
			return $e(e, t);
		}
		static fromTexture(e, t) {
			return et(e, t);
		}
		static fromGpuBuffer(e, t) {
			return tt(e, t);
		}
		static fromMLTensor(e, t) {
			return nt(e, t);
		}
		static fromPinnedBuffer(e, t, n) {
			return rt(e, t, n);
		}
		toDataURL(e) {
			return Ye(this, e);
		}
		toImageData(e) {
			return Xe(this, e);
		}
		get data() {
			if (this.ensureValid(), !this.cpuData) throw Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
			return this.cpuData;
		}
		get location() {
			return this.dataLocation;
		}
		get texture() {
			if (this.ensureValid(), !this.gpuTextureData) throw Error("The data is not stored as a WebGL texture.");
			return this.gpuTextureData;
		}
		get gpuBuffer() {
			if (this.ensureValid(), !this.gpuBufferData) throw Error("The data is not stored as a WebGPU buffer.");
			return this.gpuBufferData;
		}
		get mlTensor() {
			if (this.ensureValid(), !this.mlTensorData) throw Error("The data is not stored as a WebNN MLTensor.");
			return this.mlTensorData;
		}
		async getData(e) {
			switch (this.ensureValid(), this.dataLocation) {
				case "cpu":
				case "cpu-pinned": return this.data;
				case "texture":
				case "gpu-buffer":
				case "ml-tensor":
					if (!this.downloader) throw Error("The current tensor is not created with a specified data downloader.");
					if (this.isDownloading) throw Error("The current tensor is being downloaded.");
					try {
						this.isDownloading = !0;
						let t = await this.downloader();
						return this.downloader = void 0, this.dataLocation = "cpu", this.cpuData = t, e && this.disposer && (this.disposer(), this.disposer = void 0), t;
					} finally {
						this.isDownloading = !1;
					}
				default: throw Error(`cannot get data from location: ${this.dataLocation}`);
			}
		}
		dispose() {
			if (this.isDownloading) throw Error("The current tensor is being downloaded.");
			this.disposer &&= (this.disposer(), void 0), this.cpuData = void 0, this.gpuTextureData = void 0, this.gpuBufferData = void 0, this.mlTensorData = void 0, this.downloader = void 0, this.isDownloading = void 0, this.dataLocation = "none";
		}
		ensureValid() {
			if (this.dataLocation === "none") throw Error("The tensor is disposed.");
		}
		reshape(e) {
			if (this.ensureValid(), this.downloader || this.disposer) throw Error("Cannot reshape a tensor that owns GPU resource.");
			return ut(this, e);
		}
	};
}), N, pt = S(() => {
	ft(), N = M;
}), mt, ht = S(() => {
	Le(), Je(), pt(), Ke(), mt = class e {
		constructor(e, t) {
			this.handler = e, this.backend = t;
		}
		async run(e, t, n) {
			D(), k("InferenceSession.run");
			let r = {}, i = {};
			if (typeof e != "object" || !e || e instanceof N || Array.isArray(e)) throw TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
			let a = !0;
			if (typeof t == "object") {
				if (t === null) throw TypeError("Unexpected argument[1]: cannot be null.");
				if (t instanceof N) throw TypeError("'fetches' cannot be a Tensor");
				if (Array.isArray(t)) {
					if (t.length === 0) throw TypeError("'fetches' cannot be an empty array.");
					a = !1;
					for (let e of t) {
						if (typeof e != "string") throw TypeError("'fetches' must be a string array or an object.");
						if (this.outputNames.indexOf(e) === -1) throw RangeError(`'fetches' contains invalid output name: ${e}.`);
						r[e] = null;
					}
					if (typeof n == "object" && n) i = n;
					else if (typeof n < "u") throw TypeError("'options' must be an object.");
				} else {
					let e = !1, o = Object.getOwnPropertyNames(t);
					for (let n of this.outputNames) if (o.indexOf(n) !== -1) {
						let i = t[n];
						(i === null || i instanceof N) && (e = !0, a = !1, r[n] = i);
					}
					if (e) {
						if (typeof n == "object" && n) i = n;
						else if (typeof n < "u") throw TypeError("'options' must be an object.");
					} else i = t;
				}
			} else if (typeof t < "u") throw TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
			for (let t of this.inputNames) if (typeof e[t] > "u") throw Error(`input '${t}' is missing in 'feeds'.`);
			if (a) for (let e of this.outputNames) r[e] = null;
			let o;
			if (i.activeLoraAdapters !== void 0) {
				if (!Array.isArray(i.activeLoraAdapters)) throw TypeError("'activeLoraAdapters' must be an array.");
				o = i.activeLoraAdapters.map((e) => {
					if (!(e instanceof qe)) throw TypeError("'activeLoraAdapters' must be an array of LoraAdapter objects.");
					if (e.backend !== this.backend) throw Error("LoRA adapter was created by a different backend than the session.");
					return e.handler;
				});
			}
			let s = await this.handler.run(e, r, i, o), c = {};
			for (let e in s) if (Object.hasOwnProperty.call(s, e)) {
				let t = s[e];
				c[e] = t instanceof N ? t : new N(t.type, t.data, t.dims);
			}
			return A("InferenceSession.run"), O(), c;
		}
		async release() {
			return this.handler.dispose();
		}
		static async create(t, n, r, i) {
			D(), k("InferenceSession.create");
			let a, o = {};
			if (typeof t == "string") {
				if (a = t, typeof n == "object" && n) o = n;
				else if (typeof n < "u") throw TypeError("'options' must be an object.");
			} else if (t instanceof Uint8Array) {
				if (a = t, typeof n == "object" && n) o = n;
				else if (typeof n < "u") throw TypeError("'options' must be an object.");
			} else if (t instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && t instanceof SharedArrayBuffer) {
				let e = t, s = 0, c = t.byteLength;
				if (typeof n == "object" && n) o = n;
				else if (typeof n == "number") {
					if (s = n, !Number.isSafeInteger(s)) throw RangeError("'byteOffset' must be an integer.");
					if (s < 0 || s >= e.byteLength) throw RangeError(`'byteOffset' is out of range [0, ${e.byteLength}).`);
					if (c = t.byteLength - s, typeof r == "number") {
						if (c = r, !Number.isSafeInteger(c)) throw RangeError("'byteLength' must be an integer.");
						if (c <= 0 || s + c > e.byteLength) throw RangeError(`'byteLength' is out of range (0, ${e.byteLength - s}].`);
						if (typeof i == "object" && i) o = i;
						else if (typeof i < "u") throw TypeError("'options' must be an object.");
					} else if (typeof r < "u") throw TypeError("'byteLength' must be a number.");
				} else if (typeof n < "u") throw TypeError("'options' must be an object.");
				a = new Uint8Array(e, s, c);
			} else throw TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
			let [s, c] = await Fe(o), l = await s.createInferenceSessionHandler(a, c);
			return A("InferenceSession.create"), O(), new e(l, s);
		}
		startProfiling() {
			this.handler.startProfiling();
		}
		endProfiling() {
			this.handler.endProfiling();
		}
		get inputNames() {
			return this.handler.inputNames;
		}
		get outputNames() {
			return this.handler.outputNames;
		}
		get inputMetadata() {
			return this.handler.inputMetadata;
		}
		get outputMetadata() {
			return this.handler.outputMetadata;
		}
	};
}), P, gt = S(() => {
	ht(), P = mt;
}), _t, vt = S(() => {
	Je(), _t = qe;
}), yt = S(() => {}), bt = S(() => {}), xt = S(() => {}), St = S(() => {});
ke({}, {
	InferenceSession: () => P,
	LoraAdapter: () => _t,
	TRACE: () => We,
	TRACE_EVENT_BEGIN: () => k,
	TRACE_EVENT_END: () => A,
	TRACE_FUNC_BEGIN: () => D,
	TRACE_FUNC_END: () => O,
	Tensor: () => N,
	env: () => E,
	registerBackend: () => Ne
});
var F = S(() => {
	Re(), Ue(), gt(), vt(), pt(), yt(), bt(), Ke(), xt(), St();
}), Ct = S(() => {}), wt = {};
ke(wt, { default: () => Dt });
var Tt, Et, Dt, Ot = S(() => {
	Nn(), R(), Ht(), Tt = "ort-wasm-proxy-worker", Et = globalThis.self?.name === Tt, Et && (self.onmessage = (e) => {
		let { type: t, in: n } = e.data;
		try {
			switch (t) {
				case "init-wasm":
					Xt(n.wasm).then(() => {
						vn(n).then(() => {
							postMessage({ type: t });
						}, (e) => {
							postMessage({
								type: t,
								err: e
							});
						});
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				case "init-ep": {
					let { epName: e, env: r } = n;
					yn(r, e).then(() => {
						postMessage({ type: t });
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				}
				case "copy-from": {
					let { buffer: e } = n, r = Sn(e);
					postMessage({
						type: t,
						out: r
					});
					break;
				}
				case "create": {
					let { model: e, options: r } = n;
					Cn(e, r).then((e) => {
						postMessage({
							type: t,
							out: e
						});
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				}
				case "release":
					wn(n), postMessage({ type: t });
					break;
				case "run": {
					let { sessionId: e, inputIndices: r, inputs: i, outputIndices: a, options: o } = n;
					An(e, r, i, a, Array(a.length).fill(null), o).then((e) => {
						e.some((e) => e[3] !== "cpu") ? postMessage({
							type: t,
							err: "Proxy does not support non-cpu tensor location."
						}) : postMessage({
							type: t,
							out: e
						}, Mn([...i, ...e]));
					}, (e) => {
						postMessage({
							type: t,
							err: e
						});
					});
					break;
				}
				case "end-profiling": jn(n), postMessage({ type: t });
			}
		} catch (e) {
			postMessage({
				type: t,
				err: e
			});
		}
	}), Dt = Et ? null : (e) => new Worker(e ?? I, {
		type: "module",
		name: Tt
	});
}), kt, At, jt, I, Mt, Nt, Pt, Ft, It, Lt, Rt, zt, Bt, Vt, Ht = S(() => {
	Ct(), kt = typeof location > "u" ? void 0 : location.origin, At = import.meta.url > "file:" && import.meta.url < "file;", jt = () => At ? new URL(new URL("ort.wasm.min.mjs", import.meta.url).href, kt).href : import.meta.url, I = jt(), Mt = () => {
		if (I && !I.startsWith("blob:")) return I.substring(0, I.lastIndexOf("/") + 1);
	}, Nt = (e, t) => {
		try {
			let n = t ?? I;
			return (n ? new URL(e, n) : new URL(e)).origin === kt;
		} catch {
			return !1;
		}
	}, Pt = (e, t) => {
		let n = t ?? I;
		try {
			return (n ? new URL(e, n) : new URL(e)).href;
		} catch {
			return;
		}
	}, Ft = (e, t) => `${t ?? "./"}${e}`, It = async (e) => {
		let t = await (await fetch(e, { credentials: "same-origin" })).blob();
		return URL.createObjectURL(t);
	}, Lt = async (e) => (await import(
		/*webpackIgnore:true*/
		/*@vite-ignore*/
		e
)).default, Rt = (Ot(), je(wt)).default, zt = async () => {
		if (!I) throw Error("Failed to load proxy worker: cannot determine the script source URL.");
		if (Nt(I)) return [void 0, Rt()];
		let e = await It(I);
		return [e, Rt(e)];
	}, Bt = void 0, Vt = async (e, t, n, r) => {
		let i = Bt && !(e || t);
		if (i) {
			if (I) i = Nt(I) || r && !n;
			else if (r && !n) i = !0;
			else throw Error("cannot determine the script source URL.");
		}
		if (i) return [void 0, Bt];
		{
			let r = "ort-wasm-simd-threaded.mjs", i = e ?? Pt(r, t), a = n && i && !Nt(i, t), o = a ? await It(i) : i ?? Ft(r, t);
			return [a ? o : void 0, await Lt(o)];
		}
	};
}), Ut, Wt, Gt, Kt, qt, Jt, Yt, Xt, L, R = S(() => {
	Ht(), Wt = !1, Gt = !1, Kt = !1, qt = () => {
		if (typeof SharedArrayBuffer > "u") return !1;
		try {
			return typeof MessageChannel < "u" && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WebAssembly.validate(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				4,
				1,
				96,
				0,
				0,
				3,
				2,
				1,
				0,
				5,
				4,
				1,
				3,
				1,
				1,
				10,
				11,
				1,
				9,
				0,
				65,
				0,
				254,
				16,
				2,
				0,
				26,
				11
			]));
		} catch {
			return !1;
		}
	}, Jt = () => {
		try {
			return WebAssembly.validate(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				4,
				1,
				96,
				0,
				0,
				3,
				2,
				1,
				0,
				10,
				30,
				1,
				28,
				0,
				65,
				0,
				253,
				15,
				253,
				12,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				253,
				186,
				1,
				26,
				11
			]));
		} catch {
			return !1;
		}
	}, Yt = () => {
		try {
			return WebAssembly.validate(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				5,
				1,
				96,
				0,
				1,
				123,
				3,
				2,
				1,
				0,
				10,
				19,
				1,
				17,
				0,
				65,
				1,
				253,
				15,
				65,
				2,
				253,
				15,
				65,
				3,
				253,
				15,
				253,
				147,
				2,
				11
			]));
		} catch {
			return !1;
		}
	}, Xt = async (e) => {
		if (Wt) return Promise.resolve();
		if (Gt) throw Error("multiple calls to 'initializeWebAssembly()' detected.");
		if (Kt) throw Error("previous call to 'initializeWebAssembly()' failed.");
		Gt = !0;
		let t = e.initTimeout, n = e.numThreads;
		if (e.simd !== !1) {
			if (e.simd === "relaxed") {
				if (!Yt()) throw Error("Relaxed WebAssembly SIMD is not supported in the current environment.");
			} else if (!Jt()) throw Error("WebAssembly SIMD is not supported in the current environment.");
		}
		let r = qt();
		n > 1 && !r && (typeof self < "u" && !self.crossOriginIsolated && console.warn("env.wasm.numThreads is set to " + n + ", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."), console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."), e.numThreads = n = 1);
		let i = e.wasmPaths, a = typeof i == "string" ? i : void 0, o = i?.mjs, s = o?.href ?? o, c = i?.wasm, l = c?.href ?? c, u = e.wasmBinary, [d, f] = await Vt(s, a, n > 1, !!u || !!l), p = !1, m = [];
		if (t > 0 && m.push(new Promise((e) => {
			setTimeout(() => {
				p = !0, e();
			}, t);
		})), m.push(new Promise((e, t) => {
			let r = { numThreads: n };
			if (u) r.wasmBinary = u, r.locateFile = (e) => e;
			else if (l || a) r.locateFile = (e) => l ?? a + e;
			else if (s && s.indexOf("blob:") !== 0) r.locateFile = (e) => new URL(e, s).href;
			else if (d) {
				let e = Mt();
				e && (r.locateFile = (t) => e + t);
			}
			f(r).then((t) => {
				Gt = !1, Wt = !0, Ut = t, e(), d && URL.revokeObjectURL(d);
			}, (e) => {
				Gt = !1, Kt = !0, t(e);
			});
		})), await Promise.race(m), p) throw Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`);
	}, L = () => {
		if (Wt && Ut) return Ut;
		throw Error("WebAssembly is not initialized yet.");
	};
}), z, Zt, B, Qt = S(() => {
	R(), z = (e, t) => {
		let n = L(), r = n.lengthBytesUTF8(e) + 1, i = n._malloc(r);
		return n.stringToUTF8(e, i, r), t.push(i), i;
	}, Zt = (e, t, n, r) => {
		if (typeof e == "object" && e) {
			if (n.has(e)) throw Error("Circular reference in options");
			n.add(e);
		}
		Object.entries(e).forEach(([e, i]) => {
			let a = t ? t + e : e;
			if (typeof i == "object") Zt(i, a + ".", n, r);
			else if (typeof i == "string" || typeof i == "number") r(a, i.toString());
			else if (typeof i == "boolean") r(a, i ? "1" : "0");
			else throw Error(`Can't handle extra config type: ${typeof i}`);
		});
	}, B = (e) => {
		let t = L(), n = t.stackSave();
		try {
			let n = t.PTR_SIZE, r = t.stackAlloc(2 * n);
			t._OrtGetLastError(r, r + n);
			let i = Number(t.getValue(r, n === 4 ? "i32" : "i64")), a = t.getValue(r + n, "*"), o = a ? t.UTF8ToString(a) : "";
			throw Error(`${e} ERROR_CODE: ${i}, ERROR_MESSAGE: ${o}`);
		} finally {
			t.stackRestore(n);
		}
	};
}), $t, en = S(() => {
	R(), Qt(), $t = (e, t) => {
		let n = L(), r = 0, i = [], a = e || {};
		try {
			if (e?.logSeverityLevel === void 0) a.logSeverityLevel = 2;
			else if (typeof e.logSeverityLevel != "number" || !Number.isInteger(e.logSeverityLevel) || e.logSeverityLevel < 0 || e.logSeverityLevel > 4) throw Error(`log severity level is not valid: ${e.logSeverityLevel}`);
			if (e?.logVerbosityLevel === void 0) a.logVerbosityLevel = 0;
			else if (typeof e.logVerbosityLevel != "number" || !Number.isInteger(e.logVerbosityLevel)) throw Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);
			e?.terminate === void 0 && (a.terminate = !1);
			let o = 0;
			e?.tag !== void 0 && (o = z(e.tag, i)), r = n._OrtCreateRunOptions(a.logSeverityLevel, a.logVerbosityLevel, !!a.terminate, o), r === 0 && B("Can't create run options."), e?.extra !== void 0 && Zt(e.extra, "", /* @__PURE__ */ new WeakSet(), (e, t) => {
				let a = z(e, i), o = z(t, i);
				n._OrtAddRunConfigEntry(r, a, o) !== 0 && B(`Can't set a run config entry: ${e} - ${t}.`);
			});
			for (let e of t) n._OrtRunOptionsAddActiveLoraAdapter(r, e) !== 0 && B("Can't add an active LoRA adapter.");
			return [r, i];
		} catch (e) {
			throw r !== 0 && n._OrtReleaseRunOptions(r), i.forEach((e) => n._free(e)), e;
		}
	};
}), tn, nn, rn, V, an, on, sn = S(() => {
	R(), Qt(), tn = (e) => {
		switch (e) {
			case "disabled": return 0;
			case "basic": return 1;
			case "extended": return 2;
			case "layout": return 3;
			case "all": return 99;
			default: throw Error(`unsupported graph optimization level: ${e}`);
		}
	}, nn = (e) => {
		switch (e) {
			case "sequential": return 0;
			case "parallel": return 1;
			default: throw Error(`unsupported execution mode: ${e}`);
		}
	}, rn = (e) => {
		e.extra ||= {}, e.extra.session || (e.extra.session = {});
		let t = e.extra.session;
		t.use_ort_model_bytes_directly ||= "1", e.executionProviders && e.executionProviders.some((e) => (typeof e == "string" ? e : e.name) === "webgpu") && (e.enableMemPattern = !1);
	}, V = (e, t, n, r) => {
		let i = z(t, r), a = z(n, r);
		L()._OrtAddSessionConfigEntry(e, i, a) !== 0 && B(`Can't set a session config entry: ${t} - ${n}.`);
	}, an = async (e, t, n) => {
		let r = t.executionProviders;
		for (let t of r) {
			let r = typeof t == "string" ? t : t.name, i = [];
			switch (r) {
				case "webnn":
					if (r = "WEBNN", V(e, "session.disable_quant_qdq", "1", n), V(e, "session.disable_qdq_constant_folding", "1", n), typeof t != "string") {
						let r = t?.deviceType;
						r && V(e, "deviceType", r, n);
					}
					break;
				case "webgpu":
					if (r = "JS", typeof t != "string") {
						let r = t;
						if (r?.preferredLayout) {
							if (r.preferredLayout !== "NCHW" && r.preferredLayout !== "NHWC") throw Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${r.preferredLayout}`);
							V(e, "preferredLayout", r.preferredLayout, n);
						}
					}
					break;
				case "wasm":
				case "cpu": continue;
				default: throw Error(`not supported execution provider: ${r}`);
			}
			let a = i.length, o = 0, s = 0;
			if (a > 0) {
				o = L()._malloc(a * L().PTR_SIZE), n.push(o), s = L()._malloc(a * L().PTR_SIZE), n.push(s);
				for (let e = 0; e < a; e++) L().setValue(o + e * L().PTR_SIZE, i[e][0], "*"), L().setValue(s + e * L().PTR_SIZE, i[e][1], "*");
			}
			let c;
			{
				let t = z(r, n);
				c = await L()._OrtAppendExecutionProvider(e, t, o, s, a);
			}
			c !== 0 && B(`Can't append execution provider: ${r}.`);
		}
	}, on = async (e) => {
		let t = L(), n = 0, r = [], i = e || {};
		rn(i);
		try {
			let e = tn(i.graphOptimizationLevel ?? "all"), a = nn(i.executionMode ?? "sequential"), o = typeof i.logId == "string" ? z(i.logId, r) : 0, s = i.logSeverityLevel ?? 2;
			if (!Number.isInteger(s) || s < 0 || s > 4) throw Error(`log severity level is not valid: ${s}`);
			let c = i.logVerbosityLevel ?? 0;
			if (!Number.isInteger(c) || c < 0 || c > 4) throw Error(`log verbosity level is not valid: ${c}`);
			let l = typeof i.optimizedModelFilePath == "string" ? z(i.optimizedModelFilePath, r) : 0;
			if (n = t._OrtCreateSessionOptions(e, !!i.enableCpuMemArena, !!i.enableMemPattern, a, !!i.enableProfiling, 0, o, s, c, l), n === 0 && B("Can't create session options."), i.executionProviders && await an(n, i, r), i.enableGraphCapture !== void 0) {
				if (typeof i.enableGraphCapture != "boolean") throw Error(`enableGraphCapture must be a boolean value: ${i.enableGraphCapture}`);
				V(n, "enableGraphCapture", i.enableGraphCapture.toString(), r);
			}
			if (i.freeDimensionOverrides) for (let [e, a] of Object.entries(i.freeDimensionOverrides)) {
				if (typeof e != "string") throw Error(`free dimension override name must be a string: ${e}`);
				if (typeof a != "number" || !Number.isInteger(a) || a < 0) throw Error(`free dimension override value must be a non-negative integer: ${a}`);
				let i = z(e, r);
				t._OrtAddFreeDimensionOverride(n, i, a) !== 0 && B(`Can't set a free dimension override: ${e} - ${a}.`);
			}
			return i.extra !== void 0 && Zt(i.extra, "", /* @__PURE__ */ new WeakSet(), (e, t) => {
				V(n, e, t, r);
			}), [n, r];
		} catch (e) {
			throw n !== 0 && t._OrtReleaseSessionOptions(n) !== 0 && B("Can't release session options."), r.forEach((e) => t._free(e)), e;
		}
	};
}), H, cn, U, ln, un, dn, fn, pn, mn = S(() => {
	H = (e) => {
		switch (e) {
			case "int8": return 3;
			case "uint8": return 2;
			case "bool": return 9;
			case "int16": return 5;
			case "uint16": return 4;
			case "int32": return 6;
			case "uint32": return 12;
			case "float16": return 10;
			case "float32": return 1;
			case "float64": return 11;
			case "string": return 8;
			case "int64": return 7;
			case "uint64": return 13;
			case "int4": return 22;
			case "uint4": return 21;
			default: throw Error(`unsupported data type: ${e}`);
		}
	}, cn = (e) => {
		switch (e) {
			case 3: return "int8";
			case 2: return "uint8";
			case 9: return "bool";
			case 5: return "int16";
			case 4: return "uint16";
			case 6: return "int32";
			case 12: return "uint32";
			case 10: return "float16";
			case 1: return "float32";
			case 11: return "float64";
			case 8: return "string";
			case 7: return "int64";
			case 13: return "uint64";
			case 22: return "int4";
			case 21: return "uint4";
			default: throw Error(`unsupported data type: ${e}`);
		}
	}, U = (e, t) => {
		let n = [
			-1,
			4,
			1,
			1,
			2,
			2,
			4,
			8,
			-1,
			1,
			2,
			8,
			4,
			8,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			-1,
			.5,
			.5
		][e], r = typeof t == "number" ? t : t.reduce((e, t) => e * t, 1);
		return n > 0 ? Math.ceil(r * n) : void 0;
	}, ln = (e) => {
		switch (e) {
			case "float16": return typeof Float16Array < "u" ? Float16Array : Uint16Array;
			case "float32": return Float32Array;
			case "uint8": return Uint8Array;
			case "int8": return Int8Array;
			case "uint16": return Uint16Array;
			case "int16": return Int16Array;
			case "int32": return Int32Array;
			case "bool": return Uint8Array;
			case "float64": return Float64Array;
			case "uint32": return Uint32Array;
			case "int64": return BigInt64Array;
			case "uint64": return BigUint64Array;
			default: throw Error(`unsupported type: ${e}`);
		}
	}, un = (e) => {
		switch (e) {
			case "verbose": return 0;
			case "info": return 1;
			case "warning": return 2;
			case "error": return 3;
			case "fatal": return 4;
			default: throw Error(`unsupported logging level: ${e}`);
		}
	}, dn = (e) => e === "float32" || e === "float16" || e === "int32" || e === "int64" || e === "uint32" || e === "uint8" || e === "bool" || e === "uint4" || e === "int4", fn = (e) => e === "float32" || e === "float16" || e === "int32" || e === "int64" || e === "uint32" || e === "uint64" || e === "int8" || e === "uint8" || e === "bool" || e === "uint4" || e === "int4", pn = (e) => {
		switch (e) {
			case "none": return 0;
			case "cpu": return 1;
			case "cpu-pinned": return 2;
			case "texture": return 3;
			case "gpu-buffer": return 4;
			case "ml-tensor": return 5;
			default: throw Error(`unsupported data location: ${e}`);
		}
	};
}), hn, gn = S(() => {
	Ct(), hn = async (e) => {
		if (typeof e == "string") {
			let t = await fetch(e);
			if (!t.ok) throw Error(`failed to load external data file: ${e}`);
			let n = t.headers.get("Content-Length"), r = n ? parseInt(n, 10) : 0;
			if (r < 1073741824) return new Uint8Array(await t.arrayBuffer());
			{
				if (!t.body) throw Error(`failed to load external data file: ${e}, no response body.`);
				let n = t.body.getReader(), i;
				try {
					i = new ArrayBuffer(r);
				} catch (e) {
					if (e instanceof RangeError) {
						let e = Math.ceil(r / 65536);
						i = new WebAssembly.Memory({
							initial: e,
							maximum: e
						}).buffer;
					} else throw e;
				}
				let a = 0;
				for (;;) {
					let { done: e, value: t } = await n.read();
					if (e) break;
					let r = t.byteLength;
					new Uint8Array(i, a, r).set(t), a += r;
				}
				return new Uint8Array(i, 0, r);
			}
		}
		return e instanceof Blob ? new Uint8Array(await e.arrayBuffer()) : e instanceof Uint8Array ? e : new Uint8Array(e);
	};
}), _n, vn, yn, W, bn, xn, Sn, Cn, wn, Tn, En, G, Dn, On, kn, An, jn, Mn, Nn = S(() => {
	F(), en(), sn(), mn(), R(), Qt(), gn(), _n = (e, t) => {
		L()._OrtInit(e, t) !== 0 && B("Can't initialize onnxruntime.");
	}, vn = async (e) => {
		_n(e.wasm.numThreads, un(e.logLevel));
	}, yn = async (e, t) => {
		L().asyncInit?.();
		let n = e.webgpu.adapter;
		if (t === "webgpu") {
			if (typeof navigator > "u" || !navigator.gpu) throw Error("WebGPU is not supported in current environment");
			if (n) {
				if (typeof n.limits != "object" || typeof n.features != "object" || typeof n.requestDevice != "function") throw Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.");
			} else {
				let t = e.webgpu.powerPreference;
				if (t !== void 0 && t !== "low-power" && t !== "high-performance") throw Error(`Invalid powerPreference setting: "${t}"`);
				let r = e.webgpu.forceFallbackAdapter;
				if (r !== void 0 && typeof r != "boolean") throw Error(`Invalid forceFallbackAdapter setting: "${r}"`);
				if (n = await navigator.gpu.requestAdapter({
					powerPreference: t,
					forceFallbackAdapter: r
				}), !n) throw Error("Failed to get GPU adapter. You may need to enable flag \"--enable-unsafe-webgpu\" if you are using Chrome.");
			}
		}
		if (t === "webnn" && (typeof navigator > "u" || !navigator.ml)) throw Error("WebNN is not supported in current environment");
	}, W = /* @__PURE__ */ new Map(), bn = (e) => {
		let t = L(), n = t.stackSave();
		try {
			let n = t.PTR_SIZE, r = t.stackAlloc(2 * n);
			t._OrtGetInputOutputCount(e, r, r + n) !== 0 && B("Can't get session input/output count.");
			let i = n === 4 ? "i32" : "i64";
			return [Number(t.getValue(r, i)), Number(t.getValue(r + n, i))];
		} finally {
			t.stackRestore(n);
		}
	}, xn = (e, t) => {
		let n = L(), r = n.stackSave(), i = 0;
		try {
			let r = n.PTR_SIZE, a = n.stackAlloc(2 * r);
			n._OrtGetInputOutputMetadata(e, t, a, a + r) !== 0 && B("Can't get session input/output metadata.");
			let o = Number(n.getValue(a, "*"));
			i = Number(n.getValue(a + r, "*"));
			let s = n.HEAP32[i / 4];
			if (s === 0) return [o, 0];
			let c = n.HEAPU32[i / 4 + 1], l = [];
			for (let e = 0; e < c; e++) {
				let t = Number(n.getValue(i + 8 + e * r, "*"));
				l.push(t === 0 ? Number(n.getValue(i + 8 + (e + c) * r, "*")) : n.UTF8ToString(t));
			}
			return [
				o,
				s,
				l
			];
		} finally {
			n.stackRestore(r), i !== 0 && n._OrtFree(i);
		}
	}, Sn = (e) => {
		let t = L(), n = t._malloc(e.byteLength);
		if (n === 0) throw Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);
		return t.HEAPU8.set(e, n), [n, e.byteLength];
	}, Cn = async (e, t) => {
		let n, r, i = L();
		Array.isArray(e) ? [n, r] = e : e.buffer === i.HEAPU8.buffer ? [n, r] = [e.byteOffset, e.byteLength] : [n, r] = Sn(e);
		let a = 0, o = 0, s = [], c = [], l = [];
		try {
			if ([o, s] = await on(t), t?.externalData && i.mountExternalData) {
				let e = [];
				for (let n of t.externalData) {
					let t = typeof n == "string" ? n : n.path, r = typeof n == "string" ? n : n.data;
					e.push(hn(r).then((e) => {
						i.mountExternalData(t, e);
					}));
				}
				await Promise.all(e);
			}
			for (let e of t?.executionProviders ?? []) if ((typeof e == "string" ? e : e.name) === "webnn") {
				if (i.shouldTransferToMLTensor = !1, typeof e != "string") {
					let t = e, n = t?.context, r = t?.gpuDevice, a = t?.deviceType, o = t?.powerPreference;
					i.currentContext = n || (r ? await i.webnnCreateMLContext(r) : await i.webnnCreateMLContext({
						deviceType: a,
						powerPreference: o
					}));
				} else i.currentContext = await i.webnnCreateMLContext();
				break;
			}
			a = await i._OrtCreateSession(n, r, o), i.webgpuOnCreateSession?.(a), a === 0 && B("Can't create a session."), i.jsepOnCreateSession?.(), i.currentContext && (i.webnnRegisterMLContext(a, i.currentContext), i.currentContext = void 0, i.shouldTransferToMLTensor = !0);
			let [e, u] = bn(a), d = !!t?.enableGraphCapture, f = [], p = [], m = [], h = [];
			for (let t = 0; t < e; t++) {
				let [e, n, r] = xn(a, t);
				e === 0 && B("Can't get an input name."), c.push(e);
				let o = i.UTF8ToString(e);
				f.push(o), m.push(n === 0 ? {
					name: o,
					isTensor: !1
				} : {
					name: o,
					isTensor: !0,
					type: cn(n),
					shape: r
				});
			}
			for (let t = 0; t < u; t++) {
				let [n, r, o] = xn(a, t + e);
				n === 0 && B("Can't get an output name."), l.push(n);
				let s = i.UTF8ToString(n);
				p.push(s), h.push(r === 0 ? {
					name: s,
					isTensor: !1
				} : {
					name: s,
					isTensor: !0,
					type: cn(r),
					shape: o
				});
			}
			return W.set(a, [
				a,
				c,
				l,
				null,
				d,
				!1
			]), [
				a,
				f,
				p,
				m,
				h
			];
		} catch (e) {
			throw c.forEach((e) => i._OrtFree(e)), l.forEach((e) => i._OrtFree(e)), a !== 0 && i._OrtReleaseSession(a) !== 0 && B("Can't release session."), e;
		} finally {
			i._free(n), o !== 0 && i._OrtReleaseSessionOptions(o) !== 0 && B("Can't release session options."), s.forEach((e) => i._free(e)), i.unmountExternalData?.();
		}
	}, wn = (e) => {
		let t = L(), n = W.get(e);
		if (!n) throw Error(`cannot release session. invalid session id: ${e}`);
		let [r, i, a, o, s] = n;
		o && (s && t._OrtClearBoundOutputs(o.handle) !== 0 && B("Can't clear bound outputs."), t._OrtReleaseBinding(o.handle) !== 0 && B("Can't release IO binding.")), t.jsepOnReleaseSession?.(e), t.webnnOnReleaseSession?.(e), t.webgpuOnReleaseSession?.(e), i.forEach((e) => t._OrtFree(e)), a.forEach((e) => t._OrtFree(e)), t._OrtReleaseSession(r) !== 0 && B("Can't release session."), W.delete(e);
	}, Tn = /* @__PURE__ */ new Map(), En = 1, G = /* @__PURE__ */ new Map(), Dn = (e) => {
		let t = L(), n = t._malloc(e.byteLength);
		if (n === 0) throw Error(`Can't create a LoRA adapter. failed to allocate a buffer of size ${e.byteLength}.`);
		try {
			t.HEAPU8.set(e, n);
			let r = t._OrtCreateLoraAdapter(n, e.byteLength);
			r === 0 && B("Can't create a LoRA adapter.");
			let i = En++;
			return Tn.set(i, r), i;
		} finally {
			t._free(n);
		}
	}, On = (e) => {
		let t = L(), n = Tn.get(e);
		if (n === void 0) throw Error(`cannot release LoRA adapter. invalid adapter id: ${e}`);
		if (G.has(e)) throw Error(`cannot release LoRA adapter. the adapter is used by a run in progress. adapter id: ${e}`);
		t._OrtReleaseLoraAdapter(n) !== 0 && B("Can't release LoRA adapter."), Tn.delete(e);
	}, kn = async (e, t, n, r, i, a, o = !1) => {
		if (!e) {
			t.push(0);
			return;
		}
		let s = L(), c = s.PTR_SIZE, l = e[0], u = e[1], d = e[3], f = d, p, m;
		if (l === "string" && (d === "gpu-buffer" || d === "ml-tensor")) throw Error("String tensor is not supported on GPU.");
		if (o && d !== "gpu-buffer") throw Error(`External buffer must be provided for input/output index ${a} when enableGraphCapture is true.`);
		if (d === "gpu-buffer") {
			let t = e[2].gpuBuffer;
			m = U(H(l), u);
			{
				let e = s.jsepRegisterBuffer;
				if (!e) throw Error("Tensor location \"gpu-buffer\" is not supported without using WebGPU.");
				p = e(r, a, t, m);
			}
		} else if (d === "ml-tensor") {
			let t = e[2].mlTensor;
			m = U(H(l), u);
			let n = s.webnnRegisterMLTensor;
			if (!n) throw Error("Tensor location \"ml-tensor\" is not supported without using WebNN.");
			p = n(r, t, H(l), u);
		} else {
			let t = e[2];
			if (Array.isArray(t)) {
				m = c * t.length, p = s._malloc(m), n.push(p);
				for (let e = 0; e < t.length; e++) {
					if (typeof t[e] != "string") throw TypeError(`tensor data at index ${e} is not a string`);
					s.setValue(p + e * c, z(t[e], n), "*");
				}
			} else {
				let e = s.webnnIsGraphInput, a = s.webnnIsGraphOutput;
				if (l !== "string" && e && a) {
					let o = s.UTF8ToString(i);
					if (e(r, o) || a(r, o)) {
						let e = H(l);
						m = U(e, u), f = "ml-tensor";
						let n = s.webnnCreateTemporaryTensor, i = s.webnnUploadTensor;
						if (!n || !i) throw Error("Tensor location \"ml-tensor\" is not supported without using WebNN.");
						let a = await n(r, e, u);
						i(a, new Uint8Array(t.buffer, t.byteOffset, t.byteLength)), p = a;
					} else m = t.byteLength, p = s._malloc(m), n.push(p), s.HEAPU8.set(new Uint8Array(t.buffer, t.byteOffset, m), p);
				} else m = t.byteLength, p = s._malloc(m), n.push(p), s.HEAPU8.set(new Uint8Array(t.buffer, t.byteOffset, m), p);
			}
		}
		let h = s.stackSave(), g = s.stackAlloc(4 * u.length);
		try {
			u.forEach((e, t) => s.setValue(g + t * c, e, c === 4 ? "i32" : "i64"));
			let e = s._OrtCreateTensor(H(l), p, m, g, u.length, pn(f));
			e === 0 && B(`Can't create tensor for input/output. session=${r}, index=${a}.`), t.push(e);
		} finally {
			s.stackRestore(h);
		}
	}, An = async (e, t, n, r, i, a, o = []) => {
		let s = L(), c = s.PTR_SIZE, l = W.get(e);
		if (!l) throw Error(`cannot run inference. invalid session id: ${e}`);
		let u = l[0], d = l[1], f = l[2], p = l[3], m = l[4];
		l[5];
		let h = [];
		if (o.length > 0) {
			if (p) throw Error("LoRA adapters are not supported for a session that uses IO binding, e.g. when an output is preferred to be on GPU, or when the WebNN execution provider produces an output.");
			for (let e of o) {
				let t = Tn.get(e);
				if (t === void 0) throw Error(`cannot run inference. invalid LoRA adapter id: ${e}`);
				h.push(t);
			}
		}
		let g = t.length, _ = r.length, v = 0, y = [], ee = [], b = [], te = [], ne = [], x = s.stackSave(), re = s.stackAlloc(g * c), ie = s.stackAlloc(g * c), ae = s.stackAlloc(_ * c), oe = s.stackAlloc(_ * c);
		try {
			for (let e of o) G.set(e, (G.get(e) ?? 0) + 1);
			[v, y] = $t(a, h), k("wasm prepareInputOutputTensor");
			for (let r = 0; r < g; r++) await kn(n[r], ee, te, e, d[t[r]], t[r], m);
			for (let t = 0; t < _; t++) await kn(i[t], b, te, e, f[r[t]], g + r[t], m);
			A("wasm prepareInputOutputTensor");
			for (let e = 0; e < g; e++) s.setValue(re + e * c, ee[e], "*"), s.setValue(ie + e * c, d[t[e]], "*");
			for (let e = 0; e < _; e++) s.setValue(ae + e * c, b[e], "*"), s.setValue(oe + e * c, f[r[e]], "*");
			s.jsepOnRunStart?.(u), s.webnnOnRunStart?.(u);
			let l;
			l = await s._OrtRun(u, ie, re, g, oe, _, ae, v), l !== 0 && B("failed to call OrtRun().");
			let x = [], se = [];
			k("wasm ProcessOutputTensor");
			for (let t = 0; t < _; t++) {
				let n = Number(s.getValue(ae + t * c, "*"));
				if (n === b[t] || ne.includes(b[t])) {
					x.push(i[t]), n !== b[t] && s._OrtReleaseTensor(n) !== 0 && B("Can't release tensor.");
					continue;
				}
				let a = s.stackSave(), o = s.stackAlloc(4 * c), l = !1, u, d = 0;
				try {
					s._OrtGetTensorData(n, o, o + c, o + 2 * c, o + 3 * c) !== 0 && B(`Can't access output tensor data on index ${t}.`);
					let i = c === 4 ? "i32" : "i64", a = Number(s.getValue(o, i));
					d = s.getValue(o + c, "*");
					let f = s.getValue(o + c * 2, "*"), m = Number(s.getValue(o + c * 3, i)), h = [];
					for (let e = 0; e < m; e++) h.push(Number(s.getValue(f + e * c, i)));
					s._OrtFree(f) !== 0 && B("Can't free memory for tensor dims.");
					let g = h.reduce((e, t) => e * t, 1);
					u = cn(a);
					let _ = p?.outputPreferredLocations[r[t]];
					if (u === "string") {
						if (_ === "gpu-buffer" || _ === "ml-tensor") throw Error("String tensor is not supported on GPU.");
						let e = [];
						for (let t = 0; t < g; t++) {
							let n = s.getValue(d + t * c, "*"), r = s.getValue(d + (t + 1) * c, "*"), i = t === g - 1 ? void 0 : r - n;
							e.push(s.UTF8ToString(n, i));
						}
						x.push([
							u,
							h,
							e,
							"cpu"
						]);
					} else if (_ === "gpu-buffer" && g > 0) {
						let e = s.jsepGetBuffer;
						if (!e) throw Error("preferredLocation \"gpu-buffer\" is not supported without using WebGPU.");
						let t = e(d), r = U(a, g);
						if (r === void 0 || !dn(u)) throw Error(`Unsupported data type: ${u}`);
						l = !0, x.push([
							u,
							h,
							{
								gpuBuffer: t,
								download: s.jsepCreateDownloader(t, r, u),
								dispose: () => {
									s._OrtReleaseTensor(n) !== 0 && B("Can't release tensor.");
								}
							},
							"gpu-buffer"
						]);
					} else if (_ === "ml-tensor" && g > 0) {
						let t = s.webnnEnsureTensor, r = s.webnnIsGraphInputOutputTypeSupported;
						if (!t || !r) throw Error("preferredLocation \"ml-tensor\" is not supported without using WebNN.");
						if (U(a, g) === void 0 || !fn(u)) throw Error(`Unsupported data type: ${u}`);
						if (!r(e, u, !1)) throw Error(`preferredLocation "ml-tensor" for ${u} output is not supported by current WebNN Context.`);
						let i = await t(e, d, a, h, !1);
						l = !0, x.push([
							u,
							h,
							{
								mlTensor: i,
								download: s.webnnCreateMLTensorDownloader(d, u),
								dispose: () => {
									s.webnnReleaseTensorId(d), s._OrtReleaseTensor(n);
								}
							},
							"ml-tensor"
						]);
					} else if (_ === "ml-tensor-cpu-output" && g > 0) {
						let e = s.webnnCreateMLTensorDownloader(d, u)(), t = x.length;
						l = !0, se.push((async () => {
							let r = [t, await e];
							return s.webnnReleaseTensorId(d), s._OrtReleaseTensor(n), r;
						})()), x.push([
							u,
							h,
							[],
							"cpu"
						]);
					} else {
						let e = new (ln(u))(g);
						new Uint8Array(e.buffer, e.byteOffset, e.byteLength).set(s.HEAPU8.subarray(d, d + e.byteLength)), x.push([
							u,
							h,
							e,
							"cpu"
						]);
					}
				} finally {
					s.stackRestore(a), u === "string" && d && s._free(d), l || s._OrtReleaseTensor(n);
				}
			}
			p && !m && (s._OrtClearBoundOutputs(p.handle) !== 0 && B("Can't clear bound outputs."), W.set(e, [
				u,
				d,
				f,
				p,
				m,
				!1
			]));
			for (let [e, t] of await Promise.all(se)) x[e][2] = t;
			return A("wasm ProcessOutputTensor"), x;
		} finally {
			s.webnnOnRunEnd?.(u), s.stackRestore(x), ee.forEach((e) => s._OrtReleaseTensor(e)), b.forEach((e) => s._OrtReleaseTensor(e)), te.forEach((e) => s._free(e)), v !== 0 && s._OrtReleaseRunOptions(v), y.forEach((e) => s._free(e));
			for (let e of o) {
				let t = G.get(e) - 1;
				t === 0 ? G.delete(e) : G.set(e, t);
			}
		}
	}, jn = (e) => {
		let t = L(), n = W.get(e);
		if (!n) throw Error("invalid session id");
		let r = n[0], i = t._OrtEndProfiling(r);
		i === 0 && B("Can't get an profile file name."), t._OrtFree(i);
	}, Mn = (e) => {
		let t = [];
		for (let n of e) {
			let e = n[2];
			!Array.isArray(e) && "buffer" in e && t.push(e.buffer);
		}
		return t;
	};
}), K, q, J, Pn, Fn, In, Ln, Rn, Y, X, zn, Bn, Vn, Hn, Un, Wn, Gn, Kn, qn, Jn, Yn = S(() => {
	F(), Nn(), R(), Ht(), gn(), K = () => !!E.wasm.proxy && typeof document < "u", J = !1, Pn = !1, Fn = !1, Rn = /* @__PURE__ */ new Map(), Y = (e, t) => {
		let n = Rn.get(e);
		n ? n.push(t) : Rn.set(e, [t]);
	}, X = () => {
		if (J || !Pn || Fn || !q) throw Error("worker not ready");
	}, zn = (e) => {
		switch (e.data.type) {
			case "init-wasm":
				J = !1, e.data.err ? (Fn = !0, Ln[1](e.data.err)) : (Pn = !0, Ln[0]()), In &&= (URL.revokeObjectURL(In), void 0);
				break;
			case "init-ep":
			case "copy-from":
			case "create":
			case "release":
			case "run":
			case "end-profiling": {
				let t = Rn.get(e.data.type);
				e.data.err ? t.shift()[1](e.data.err) : t.shift()[0](e.data.out);
				break;
			}
		}
	}, Bn = async () => {
		if (!Pn) {
			if (J) throw Error("multiple calls to 'initWasm()' detected.");
			if (Fn) throw Error("previous call to 'initWasm()' failed.");
			if (J = !0, K()) return new Promise((e, t) => {
				q?.terminate(), zt().then(([n, r]) => {
					try {
						q = r, q.onerror = (e) => t(e), q.onmessage = zn, Ln = [e, t];
						let i = {
							type: "init-wasm",
							in: E
						};
						if (!i.in.wasm.wasmPaths && n) {
							let e = Mt();
							e && (i.in.wasm.wasmPaths = e);
						}
						q.postMessage(i), In = n;
					} catch (e) {
						t(e);
					}
				}, t);
			});
			try {
				await Xt(E.wasm), await vn(E), Pn = !0;
			} catch (e) {
				throw Fn = !0, e;
			} finally {
				J = !1;
			}
		}
	}, Vn = async (e) => {
		if (K()) return X(), new Promise((t, n) => {
			Y("init-ep", [t, n]);
			let r = {
				type: "init-ep",
				in: {
					epName: e,
					env: E
				}
			};
			q.postMessage(r);
		});
		await yn(E, e);
	}, Hn = async (e) => K() ? (X(), new Promise((t, n) => {
		Y("copy-from", [t, n]);
		let r = {
			type: "copy-from",
			in: { buffer: e }
		};
		q.postMessage(r, [e.buffer]);
	})) : Sn(e), Un = async (e, t) => {
		if (K()) {
			if (t?.preferredOutputLocation) throw Error("session option \"preferredOutputLocation\" is not supported for proxy.");
			return X(), new Promise((n, r) => {
				Y("create", [n, r]);
				let i = {
					type: "create",
					in: {
						model: e,
						options: { ...t }
					}
				}, a = [];
				e instanceof Uint8Array && a.push(e.buffer), q.postMessage(i, a);
			});
		}
		return Cn(e, t);
	}, Wn = async (e) => {
		if (K()) return X(), new Promise((t, n) => {
			Y("release", [t, n]);
			let r = {
				type: "release",
				in: e
			};
			q.postMessage(r);
		});
		wn(e);
	}, Gn = async (e) => {
		if (K()) throw Error("LoRA adapter is not supported for proxy.");
		let t = typeof e == "string" ? await hn(e) : e;
		return Dn(t);
	}, Kn = async (e) => {
		if (K()) throw Error("LoRA adapter is not supported for proxy.");
		On(e);
	}, qn = async (e, t, n, r, i, a, o) => {
		if (K()) {
			if (o.length > 0) throw Error("LoRA adapter is not supported for proxy.");
			if (n.some((e) => e[3] !== "cpu")) throw Error("input tensor on GPU is not supported for proxy.");
			if (i.some((e) => e)) throw Error("pre-allocated output tensor is not supported for proxy.");
			return X(), new Promise((i, o) => {
				Y("run", [i, o]);
				let s = n, c = {
					type: "run",
					in: {
						sessionId: e,
						inputIndices: t,
						inputs: s,
						outputIndices: r,
						options: a
					}
				};
				q.postMessage(c, Mn(s));
			});
		}
		return An(e, t, n, r, i, a, o);
	}, Jn = async (e) => {
		if (K()) return X(), new Promise((t, n) => {
			Y("end-profiling", [t, n]);
			let r = {
				type: "end-profiling",
				in: e
			};
			q.postMessage(r);
		});
		jn(e);
	};
}), Xn, Zn = S(() => {
	F(), Yn(), Xn = class {
		async loadAdapter(e) {
			D(), this.adapterId = await Gn(e), O();
		}
		async dispose() {
			return Kn(this.adapterId);
		}
	};
}), Qn, $n, er, tr = S(() => {
	F(), Zn(), Yn(), mn(), Ct(), gn(), Qn = (e, t) => {
		switch (e.location) {
			case "cpu": return [
				e.type,
				e.dims,
				e.data,
				"cpu"
			];
			case "gpu-buffer": return [
				e.type,
				e.dims,
				{ gpuBuffer: e.gpuBuffer },
				"gpu-buffer"
			];
			case "ml-tensor": return [
				e.type,
				e.dims,
				{ mlTensor: e.mlTensor },
				"ml-tensor"
			];
			default: throw Error(`invalid data location: ${e.location} for ${t()}`);
		}
	}, $n = (e) => {
		switch (e[3]) {
			case "cpu": return new N(e[0], e[2], e[1]);
			case "gpu-buffer": {
				let t = e[0];
				if (!dn(t)) throw Error(`not supported data type: ${t} for deserializing GPU tensor`);
				let { gpuBuffer: n, download: r, dispose: i } = e[2];
				return N.fromGpuBuffer(n, {
					dataType: t,
					dims: e[1],
					download: r,
					dispose: i
				});
			}
			case "ml-tensor": {
				let t = e[0];
				if (!fn(t)) throw Error(`not supported data type: ${t} for deserializing MLTensor tensor`);
				let { mlTensor: n, download: r, dispose: i } = e[2];
				return N.fromMLTensor(n, {
					dataType: t,
					dims: e[1],
					download: r,
					dispose: i
				});
			}
			default: throw Error(`invalid data location: ${e[3]}`);
		}
	}, er = class {
		async fetchModelAndCopyToWasmMemory(e) {
			return Hn(await hn(e));
		}
		async loadModel(e, t) {
			D();
			let n;
			n = typeof e == "string" ? await this.fetchModelAndCopyToWasmMemory(e) : e, [this.sessionId, this.inputNames, this.outputNames, this.inputMetadata, this.outputMetadata] = await Un(n, t), O();
		}
		async dispose() {
			return Wn(this.sessionId);
		}
		async run(e, t, n, r = []) {
			D();
			let i = r.map((e) => {
				if (!(e instanceof Xn)) throw Error("LoRA adapter was not created by the WebAssembly backend.");
				return e.adapterId;
			}), a = [], o = [];
			Object.entries(e).forEach((e) => {
				let t = e[0], n = e[1], r = this.inputNames.indexOf(t);
				if (r === -1) throw Error(`invalid input '${t}'`);
				a.push(n), o.push(r);
			});
			let s = [], c = [];
			Object.entries(t).forEach((e) => {
				let t = e[0], n = e[1], r = this.outputNames.indexOf(t);
				if (r === -1) throw Error(`invalid output '${t}'`);
				s.push(n), c.push(r);
			});
			let l = a.map((e, t) => Qn(e, () => `input "${this.inputNames[o[t]]}"`)), u = s.map((e, t) => e ? Qn(e, () => `output "${this.outputNames[c[t]]}"`) : null), d = await qn(this.sessionId, o, l, c, u, n, i), f = {};
			for (let e = 0; e < d.length; e++) f[this.outputNames[c[e]]] = s[e] ?? $n(d[e]);
			return O(), f;
		}
		startProfiling() {}
		endProfiling() {
			Jn(this.sessionId);
		}
	};
}), nr, rr = S(() => {
	nr = (e) => {
		if (e?.epContextDataRead) throw Error("session option \"epContextDataRead\" is not supported by ONNX Runtime Web");
	};
}), ir = {};
ke(ir, {
	OnnxruntimeWebAssemblyBackend: () => or,
	initializeFlags: () => ar,
	wasmBackend: () => sr
});
var ar, or, sr, cr = S(() => {
	F(), Zn(), Yn(), tr(), rr(), ar = () => {
		(typeof E.wasm.initTimeout != "number" || E.wasm.initTimeout < 0) && (E.wasm.initTimeout = 0);
		let e = E.wasm.simd;
		if (typeof e != "boolean" && e !== void 0 && e !== "fixed" && e !== "relaxed" && (console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`), E.wasm.simd = !1), typeof E.wasm.proxy != "boolean" && (E.wasm.proxy = !1), typeof E.wasm.trace != "boolean" && (E.wasm.trace = !1), typeof E.wasm.numThreads != "number" || !Number.isInteger(E.wasm.numThreads) || E.wasm.numThreads <= 0) {
			if (typeof self < "u" && !self.crossOriginIsolated) E.wasm.numThreads = 1;
			else {
				let e = typeof navigator > "u" ? Oe("node:os").cpus().length : navigator.hardwareConcurrency;
				E.wasm.numThreads = Math.min(4, Math.ceil((e || 1) / 2));
			}
		}
	}, or = class {
		async init(e) {
			ar(), await Bn(), await Vn(e);
		}
		async createInferenceSessionHandler(e, t) {
			nr(t);
			let n = new er();
			return await n.loadModel(e, t), n;
		}
		async createLoraAdapterHandler(e) {
			let t = new Xn();
			return await t.loadAdapter(e), t;
		}
	}, sr = new or();
});
F(), F(), F();
var lr = "1.31.1";
{
	let e = (cr(), je(ir)).wasmBackend;
	Ne("cpu", e, 10), Ne("wasm", e, 10);
}
Object.defineProperty(E.versions, "web", {
	value: lr,
	enumerable: !0
});
// src/wakeword.ts
var ur = {
	io_broker: "io_broker.onnx",
	iobroker_new: "iobroker_new.onnx",
	hey_jarvis: "hey_jarvis_v0.1.onnx",
	alexa: "alexa_v0.1.onnx",
	hey_mycroft: "hey_mycroft_v0.1.onnx",
	hey_rhasspy: "hey_rhasspy_v0.1.onnx"
}, Z = 32, dr = 76, fr = 8, pr = 96, mr = 16, hr = class {
	mel;
	embedding;
	classifiers = [];
	melRows = [];
	melProcessed = 0;
	embeddings = [];
	threshold = .5;
	async initialize(e) {
		await this.dispose(), E.wasm.numThreads = 1, E.wasm.proxy = !1, E.wasm.wasmPaths = {
			mjs: new URL("wasm/ort-wasm-simd-threaded.mjs", e.assetBase).href,
			wasm: new URL("wasm/ort-wasm-simd-threaded.wasm", e.assetBase).href
		}, this.threshold = Math.max(.01, Math.min(1, e.threshold));
		let t = e.loadAsset || (async (t) => {
			let n = await fetch(new URL(`models/${t}`, e.assetBase));
			if (!n.ok) throw Error(`Could not load model ${t}: HTTP ${n.status}`);
			return new Uint8Array(await n.arrayBuffer());
		});
		try {
			this.mel = await P.create(await t("melspectrogram.onnx")), this.embedding = await P.create(await t("embedding_model.onnx"));
			for (let n of e.names) {
				let r = ur[n], i = r ? await P.create(await t(r)) : await P.create(await e.getUploadedModel(n));
				this.classifiers.push({
					name: n,
					session: i
				});
			}
			if (!this.classifiers.length) throw Error("No wake word model selected");
		} catch (e) {
			throw await this.dispose(), e;
		}
	}
	async processAudio(e) {
		if (!this.mel || !this.embedding || !this.classifiers.length) throw Error("Wake word engine not initialized");
		let t = Float32Array.from(e, (e) => Math.round(Math.max(-1, Math.min(1, e)) * 32767)), n = (await this.mel.run({ [this.mel.inputNames[0]]: new N("float32", t, [1, t.length]) }))[this.mel.outputNames[0]], r = n.data, i = Number(n.dims[2]);
		if (!Number.isInteger(i) || r.length < i * Z) throw Error("Unexpected mel model output");
		for (let e = 0; e < i; e++) {
			let t = new Float32Array(Z);
			for (let n = 0; n < Z; n++) t[n] = r[e * Z + n] / 10 + 2;
			this.melRows.push(t);
		}
		for (; this.melProcessed + dr <= this.melRows.length;) {
			let e = /* @__PURE__ */ new Float32Array(2432);
			for (let t = 0; t < dr; t++) e.set(this.melRows[this.melProcessed + t], t * Z);
			let t = (await this.embedding.run({ [this.embedding.inputNames[0]]: new N("float32", e, [
				1,
				dr,
				Z,
				1
			]) }))[this.embedding.outputNames[0]].data;
			if (t.length < pr) throw Error("Unexpected embedding model output");
			this.embeddings.push(t.slice(0, pr)), this.melProcessed += fr;
		}
		if (this.melProcessed > dr) {
			let e = this.melProcessed - dr;
			this.melRows.splice(0, e), this.melProcessed -= e;
		}
		if (this.embeddings.length > 64 && this.embeddings.splice(0, this.embeddings.length - 64), this.embeddings.length < mr) return {
			detected: !1,
			confidence: 0,
			timestamp: Date.now()
		};
		let a = /* @__PURE__ */ new Float32Array(1536);
		for (let e = 0; e < mr; e++) a.set(this.embeddings[this.embeddings.length - mr + e], e * pr);
		let o = {
			name: "",
			confidence: 0
		};
		for (let { name: e, session: t } of this.classifiers) {
			let n = await t.run({ [t.inputNames[0]]: new N("float32", a, [
				1,
				mr,
				pr
			]) }), r = Number(n[t.outputNames[0]].data[0]);
			r > o.confidence && (o = {
				name: e,
				confidence: r
			});
		}
		return {
			detected: o.confidence >= this.threshold,
			confidence: o.confidence,
			timestamp: Date.now(),
			name: o.name
		};
	}
	reset() {
		this.melRows = [], this.melProcessed = 0, this.embeddings = [];
	}
	async dispose() {
		let e = [
			this.mel,
			this.embedding,
			...this.classifiers.map((e) => e.session)
		];
		this.mel = void 0, this.embedding = void 0, this.classifiers = [], this.reset(), await Promise.all(e.filter((e) => !!e).map((e) => e.release()));
	}
}, gr = /* @__PURE__ */ new Set([
	"success",
	"clarification",
	"cancelled",
	"rejected",
	"error"
]);
function _r(e) {
	if (!e || typeof e != "object") throw Error("No response from smart-text2command");
	let t = e;
	return !("status" in t) && "message" in t && t.message && typeof t.message == "object" ? t.message : t;
}
var vr = class {
	transport;
	instance;
	mode;
	sessionId = crypto.randomUUID();
	clarificationId = "";
	pending = Promise.resolve();
	constructor(e, t, n) {
		if (this.transport = e, this.instance = t, this.mode = n, !/^smart-text2command\.\d+$/.test(t)) throw Error("Invalid smart-text2command instance");
	}
	process(e) {
		let t = this.pending.then(() => this.processOne(e));
		return this.pending = t.then(() => void 0, () => void 0), t;
	}
	async processOne(e) {
		let t = e.trim();
		if (!t || t.length > 1e3) throw Error("Recognized text must contain 1 to 1000 characters");
		let n = {
			requestId: crypto.randomUUID(),
			sessionId: this.sessionId,
			text: t,
			mode: this.mode
		};
		this.clarificationId && (n.clarificationId = this.clarificationId);
		let r, i;
		try {
			i = await Promise.race([this.transport.sendTo(this.instance, "processText", n), new Promise((e, t) => {
				r = setTimeout(() => t(/* @__PURE__ */ Error("smart-text2command timed out")), 3e4);
			})]);
		} catch (e) {
			throw this.clarificationId = "", e;
		} finally {
			r && clearTimeout(r);
		}
		let a;
		try {
			a = _r(i);
		} catch (e) {
			throw this.clarificationId = "", e;
		}
		if (typeof a.error == "string") throw this.clarificationId = "", Error(`smart-text2command: ${a.error}`);
		if (!gr.has(a.status) || typeof a.response != "string") throw this.clarificationId = "", Error("Invalid smart-text2command response");
		let o = a.status;
		if (o === "clarification" && typeof a.clarification?.id != "string") throw this.clarificationId = "", Error("Invalid smart-text2command clarification");
		return this.clarificationId = o === "clarification" && typeof a.clarification?.id == "string" ? a.clarification.id : "", {
			text: a.response,
			status: o
		};
	}
};
function yr(e, t, n, r) {
	if (e === "smart-text2command") return new vr(t, n, r);
}
// src/speech.ts
var br = () => window.speechSynthesis?.getVoices() || [], xr = class {
	utterance;
	activity;
	generation = 0;
	async speak(e, t, n, r = "") {
		let i = window.speechSynthesis;
		if (!e.trim() || !i || typeof SpeechSynthesisUtterance > "u") return "unavailable";
		this.cancel();
		let a = ++this.generation, o = t.toLowerCase(), s = o.split("-")[0], c = br();
		if (c.length || (await new Promise((e) => {
			let t = () => {
				clearTimeout(n), i.removeEventListener("voiceschanged", t), e();
			}, n = window.setTimeout(t, 1500);
			i.addEventListener("voiceschanged", t), i.getVoices().length && t();
		}), c = br()), a !== this.generation) return "cancelled";
		let l = r ? c.find((e) => e.voiceURI === r || e.name === r) : c.filter((e) => e.localService === !0).find((e) => e.lang.toLowerCase() === o) || c.filter((e) => e.localService === !0).find((e) => e.lang.toLowerCase().split("-")[0] === s);
		if (!l) return "unavailable";
		let u = new SpeechSynthesisUtterance(e);
		u.voice = l, u.lang = l.lang;
		let d = () => {
			a === this.generation && (this.utterance = void 0, this.activity = void 0, n(!1));
		};
		u.onend = d, u.onerror = d, this.utterance = u, this.activity = n, n(!0);
		try {
			return i.speak(u), "spoken";
		} catch {
			return d(), "unavailable";
		}
	}
	cancel() {
		++this.generation, this.utterance && (this.utterance.onend = null, this.utterance.onerror = null, this.utterance = void 0, this.activity?.(!1), this.activity = void 0, window.speechSynthesis?.cancel());
	}
}, Sr = (e) => {
	let t = Number(e);
	return Number.isFinite(t) ? Math.max(1, Math.min(200, Math.floor(t))) : 50;
}, Q = new class {
	createEngine;
	speech;
	listeners = /* @__PURE__ */ new Set();
	snapshot = {
		phase: "disabled",
		enabled: !1,
		level: 0,
		text: "",
		error: "",
		wakeword: "",
		chat: []
	};
	socket;
	options;
	context;
	stream;
	source;
	node;
	engine;
	ring;
	vad;
	client;
	wakeQueue = [];
	pumping = !1;
	afterWake = [];
	generation = 0;
	segments = /* @__PURE__ */ new Map();
	lastLevelAt = 0;
	activeAt = 0;
	processor;
	processorKey = "";
	speechActive = !1;
	constructor(e = () => new hr(), t = new xr()) {
		this.createEngine = e, this.speech = t;
	}
	subscribe(e) {
		return this.listeners.add(e), e(this.snapshot), () => {
			this.listeners.delete(e), this.listeners.size || this.disable();
		};
	}
	get state() {
		return this.snapshot;
	}
	updateDeliveryOptions(e) {
		this.options && this.snapshot.enabled && (this.options.speechEnabled && !e.speechEnabled && (this.speech.cancel(), this.speechActive = !1, this.wakeQueue = [], this.ring?.clear(), this.engine?.reset()), this.options = {
			...this.options,
			processorType: e.processorType,
			processorInstance: e.processorInstance,
			processorMode: e.processorMode,
			forwardInstance: e.forwardInstance,
			forwardCommand: e.forwardCommand,
			resultState: e.resultState,
			statusState: e.statusState,
			errorState: e.errorState,
			maxChatMessages: e.maxChatMessages,
			speechEnabled: e.speechEnabled,
			speechLanguage: e.speechLanguage,
			speechVoiceURI: e.speechVoiceURI
		}, this.trimChat());
	}
	setChatLimit(e) {
		this.chatRetentionLimit = Sr(e), this.trimChat();
	}
	chatRetentionLimit = 50;
	trimChat() {
		this.snapshot.chat.length > this.chatRetentionLimit && this.publish({ chat: this.snapshot.chat.slice(-this.chatRetentionLimit) });
	}
	publish(e) {
		this.snapshot = {
			...this.snapshot,
			...e
		};
		for (let e of this.listeners) e(this.snapshot);
		e.phase && this.options?.statusState && this.writeState(this.options.statusState, e.phase), e.error && this.options?.errorState && this.writeState(this.options.errorState, e.error);
	}
	async writeState(e, t) {
		try {
			await this.socket?.setState(e, {
				val: t,
				ack: !1
			});
		} catch {}
	}
	async enable(e, t) {
		if (this.snapshot.enabled || this.snapshot.phase === "initializing") return;
		let n = ++this.generation;
		e !== this.socket && (this.processor = void 0, this.processorKey = ""), this.socket = e, this.options = t, this.setChatLimit(t.maxChatMessages), this.publish({
			phase: "initializing",
			error: "",
			text: "",
			enabled: !1
		});
		try {
			if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw Error("A secure browser context with microphone and AudioWorklet is required");
			if (t.mode !== "ptt") {
				let r = await e.sendTo(t.parakeet, "getWakewordConfig", {});
				if (!r || r.error) throw Error(r?.error || "Parakeet adapter unavailable");
				let i = this.engine = this.createEngine(), a = import.meta.url.slice(0, import.meta.url.lastIndexOf("/") + 1);
				if (await i.initialize({
					names: r.names?.length ? r.names : ["io_broker"],
					threshold: r.threshold || .5,
					assetBase: a,
					getUploadedModel: async (n) => {
						let r = await e.sendTo(t.parakeet, "getWakewordModel", { name: n });
						if (!r?.base64) throw Error(r?.error || `Could not load ${n}`);
						let i = atob(r.base64);
						return Uint8Array.from(i, (e) => e.charCodeAt(0));
					}
				}), n !== this.generation) {
					await i.dispose();
					return;
				}
			}
			if (n !== this.generation) return;
			let r = new AudioContext({ sampleRate: ve });
			this.context = r, await r.resume();
			let i = await navigator.mediaDevices.getUserMedia({ audio: {
				deviceId: t.microphone ? { ideal: t.microphone } : void 0,
				channelCount: 1,
				echoCancellation: !0,
				noiseSuppression: !0,
				autoGainControl: !0
			} });
			if (this.stream = i, n !== this.generation) {
				i.getTracks().forEach((e) => e.stop()), await r.close();
				return;
			}
			let a;
			try {
				a = r.createMediaStreamSource(i);
			} catch {
				await r.close(), r = new AudioContext(), this.context = r, await r.resume(), a = r.createMediaStreamSource(i);
			}
			if (r.sampleRate < 16e3) throw Error("Microphone sample rate below 16 kHz is unsupported");
			let o = import.meta.url.slice(0, import.meta.url.lastIndexOf("/") + 1);
			if (await r.audioWorklet.addModule(new URL("wakeword-capture.js", o).href), n !== this.generation) {
				i.getTracks().forEach((e) => e.stop()), await r.close();
				return;
			}
			let s = new AudioWorkletNode(r, "wakeword-capture");
			s.port.onmessage = ({ data: e }) => {
				e.pcm && n === this.generation && this.onAudio(new Float32Array(e.pcm));
			}, a.connect(s), s.connect(r.destination), i.getAudioTracks().forEach((e) => {
				e.onended = () => void this.disable();
			}), this.context = r, this.stream = i, this.source = a, this.node = s, this.ring = new xe(Math.round(ve * t.ringBufferMs / 1e3)), this.publish({
				enabled: !0,
				phase: "listening"
			});
		} catch (e) {
			n === this.generation && (await this.release(), this.publish({
				enabled: !1,
				phase: "error",
				error: e.message
			}));
		}
	}
	async disable() {
		++this.generation, await this.release(), this.publish({
			enabled: !1,
			phase: "disabled",
			level: 0,
			wakeword: ""
		});
	}
	connectionLost(e) {
		(this.snapshot.enabled || this.snapshot.phase === "initializing") && this.fail(Error(e));
	}
	async release() {
		this.speech.cancel(), this.speechActive = !1, this.wakeQueue = [], this.afterWake = [];
		let e = this.client;
		this.client = void 0;
		let t = e?.cancel();
		this.stream?.getTracks().forEach((e) => e.stop()), this.stream = void 0, this.node?.port.postMessage("stop"), this.node?.disconnect(), this.node = void 0, this.source?.disconnect(), this.source = void 0;
		let n = this.context;
		this.context = void 0, n && n.state !== "closed" && await n.close().catch(() => {});
		let r = this.engine;
		this.engine = void 0, r && await r.dispose(), this.ring?.clear(), this.ring = void 0, this.vad = void 0, await t;
	}
	async pushToTalk(e, t) {
		this.snapshot.enabled || await this.enable(e, t), this.snapshot.phase === "listening" && this.activate("push-to-talk");
	}
	onAudio(e) {
		this.ring?.push(e);
		let t = Date.now();
		t - this.lastLevelAt >= 100 && (this.lastLevelAt = t, this.publish({ level: Math.min(1, Math.sqrt(Math.sqrt(e.reduce((e, t) => e + t * t, 0) / e.length)) * 2.5) }));
		let n = this.snapshot.phase;
		n === "listening" && this.speechActive ? this.ring?.clear() : n === "listening" && this.engine ? (this.wakeQueue.push(e), this.wakeQueue.length > 12 && this.wakeQueue.shift(), this.pumpWake()) : n === "activated" ? (this.afterWake.push(e), this.afterWake.length > 100 && this.fail(/* @__PURE__ */ Error("Audio start is too slow"))) : n === "recording" && this.record(e);
	}
	async pumpWake() {
		if (!this.pumping && this.engine) {
			this.pumping = !0;
			try {
				for (; this.wakeQueue.length && this.snapshot.phase === "listening";) {
					let e = await this.engine.processAudio(this.wakeQueue.shift());
					if (e.detected) {
						this.wakeQueue = [], this.activate(e.name || "wakeword");
						break;
					}
				}
			} catch (e) {
				this.fail(e);
			} finally {
				this.pumping = !1;
			}
		}
	}
	async activate(e) {
		let t = this.socket, n = this.options;
		if (!t || !n || this.snapshot.phase !== "listening") return;
		this.publish({
			phase: "activated",
			wakeword: e,
			text: ""
		}), n.activationTone && this.tone(880), this.activeAt = Date.now(), this.segments.clear();
		let r = this.generation, i = n.stripWakeword ? /* @__PURE__ */ new Float32Array() : this.ring?.snapshot() || /* @__PURE__ */ new Float32Array(), a = this.client = new Ce((e) => t.sendTo(n.parakeet, "live", e), (e) => this.onEvent(e), (e) => this.fail(e));
		try {
			if (await a.start(), r !== this.generation || this.client !== a) {
				await a.cancel();
				return;
			}
			this.vad = new Se(n), this.publish({ phase: "recording" }), i.length && a.push(i);
			let e = this.afterWake.splice(0);
			for (let t of e) this.record(t);
		} catch (e) {
			this.fail(e);
		}
	}
	record(e) {
		this.client?.push(e);
		let t = this.vad?.push(e);
		(t === "done" || t === "no-speech") && this.finishRecording();
	}
	finishRecording() {
		this.snapshot.phase === "recording" && (this.publish({ phase: "processing" }), this.options?.completionTone && this.tone(660), this.client?.stop());
	}
	tone(e) {
		let t = this.context;
		if (!t || t.state !== "running") return;
		let n = t.createOscillator(), r = t.createGain();
		n.type = "sine", n.frequency.value = e, r.gain.setValueAtTime(1e-4, t.currentTime), r.gain.exponentialRampToValueAtTime(.08, t.currentTime + .015), r.gain.exponentialRampToValueAtTime(1e-4, t.currentTime + .12), n.connect(r), r.connect(t.destination), n.onended = () => {
			n.disconnect(), r.disconnect();
		}, n.start(), n.stop(t.currentTime + .13);
	}
	onEvent(e) {
		if (e.type === "transcript" && typeof e.segment == "number") this.segments.get(e.segment)?.final || this.segments.set(e.segment, {
			text: e.correctedText || e.text || "",
			final: !!e.final
		}), (this.options?.showInterim || e.final) && this.publish({ text: this.joinText() });
		else if (e.type === "done") {
			let e = this.joinText();
			this.publish({
				phase: "result",
				text: e
			}), e && this.deliver(e, this.client?.sessionId || ""), this.client = void 0, this.vad = void 0, this.ring?.clear(), this.engine?.reset(), window.setTimeout(() => {
				this.snapshot.phase === "result" && this.publish({
					phase: "listening",
					wakeword: ""
				});
			}, 1200);
		} else e.type === "error" && this.fail(Error(e.message || "Parakeet error"));
	}
	joinText() {
		return [...this.segments].sort(([e], [t]) => e - t).map(([, e]) => e.text).filter(Boolean).join(" ").trim();
	}
	async deliver(e, t) {
		let n = this.socket, r = this.options;
		if (!n || !r) return;
		this.appendChat({
			role: "user",
			text: e,
			timestamp: this.activeAt
		});
		let i = {
			text: e,
			timestamp: this.activeAt,
			source: "ai-parakeet-wakeword",
			sessionId: t,
			final: !0
		};
		if (r.resultState && await this.writeState(r.resultState, e), r.processorType === "smart-text2command") {
			let t = this.appendChat({
				role: "processor",
				text: "",
				timestamp: Date.now(),
				status: "pending",
				source: r.processorInstance || "smart-text2command"
			});
			try {
				let i = `${r.processorType}/${r.processorInstance}/${r.processorMode}`;
				this.processorKey === i && this.processor || (this.processor = yr(r.processorType, n, r.processorInstance, r.processorMode), this.processorKey = i);
				let a = await this.processor.process(e);
				this.updateChat(t, {
					text: a.text,
					status: a.status
				});
				let o = this.options;
				o?.speechEnabled && this.snapshot.enabled && a.text.trim() && await this.speech.speak(a.text, o.speechLanguage, (e) => {
					this.speechActive = e, this.wakeQueue = [], this.ring?.clear(), this.engine?.reset();
				}, o.speechVoiceURI) === "unavailable" && this.snapshot.enabled && this.publish({ error: `Speech voice unavailable for ${o.speechVoiceURI || o.speechLanguage}` });
			} catch (e) {
				this.updateChat(t, {
					text: e.message,
					status: "error"
				}), this.publish({ error: e.message });
			}
		} else if (r.forwardInstance && r.forwardCommand) try {
			await n.sendTo(r.forwardInstance, r.forwardCommand, i);
		} catch (e) {
			this.publish({ error: e.message });
		}
	}
	appendChat(e) {
		let t = crypto.randomUUID();
		return this.publish({ chat: [...this.snapshot.chat, {
			id: t,
			...e
		}].slice(-this.chatRetentionLimit) }), t;
	}
	updateChat(e, t) {
		this.publish({ chat: this.snapshot.chat.map((n) => n.id === e ? {
			...n,
			...t
		} : n) });
	}
	fail(e) {
		this.publish({
			phase: "error",
			error: e.message
		}), this.disableAfterError();
	}
	async disableAfterError() {
		++this.generation, await this.release(), this.publish({
			enabled: !1,
			level: 0
		});
	}
}(), Cr = "\n:host { display:block; width:100%; height:100%; color:inherit; font:inherit; }\n* { box-sizing:border-box; }\n.wakeword { width:100%; height:100%; min-height:0; display:flex; flex-direction:column; padding:var(--wakeword-padding, 16px); background:transparent; color:inherit; font:inherit; text-align:inherit; overflow:auto; }\n.wakeword.with-chat { overflow:hidden; }\n.top { display:flex; align-items:center; gap:16px; }\n.mic { width:64px; height:64px; border:0; border-radius:50%; background:color-mix(in srgb, currentColor 12%, transparent); color:inherit; font:inherit; cursor:pointer; display:grid; place-items:center; flex:none; }\n.mic.on { background:var(--wake-accent, var(--iob-primary, #2563eb)); color:var(--iob-primary-contrast, #fff); box-shadow:0 0 0 5px color-mix(in srgb, var(--wake-accent, var(--iob-primary, #2563eb)) 18%, transparent); }\n.mic:disabled { opacity:.55; cursor:default; }\n.mic svg { width:34px; height:34px; fill:currentColor; }\n.status { display:flex; flex-direction:column; gap:4px; min-width:0; }\n.status strong { font-weight:inherit; }\n.status small { opacity:.7; }\n.meter { height:5px; background:color-mix(in srgb,currentColor 15%,transparent); border-radius:99px; margin-top:16px; overflow:hidden; }\n.meter span { display:block; height:100%; background:var(--wake-accent, var(--iob-primary, #2563eb)); transition:width .1s linear; }\n.text { margin:14px 0 0; overflow-wrap:anywhere; }\n.with-chat .text { max-height:3em; overflow-y:auto; }\n.error { color:var(--iob-error, #dc2626); margin:12px 0 0; }\n.chat { flex:1 1 0; min-height:0; margin-top:12px; padding:8px; overflow-y:auto; overscroll-behavior:contain; border:1px solid var(--iob-divider, rgba(128,128,128,.25)); border-radius:var(--iob-border-radius, 6px); }\n.chat-content { min-height:100%; }\n.chat-entry { max-width:90%; margin:0 0 10px; padding:6px 9px; border-radius:var(--iob-border-radius, 6px); background:var(--iob-paper, rgba(128,128,128,.08)); overflow-wrap:anywhere; }\n.chat-entry.user { margin-left:auto; background:color-mix(in srgb, var(--wake-accent, var(--iob-primary, #2563eb)) 14%, transparent); }\n.chat-entry.error { color:var(--iob-error, #dc2626); }\n.chat-entry p { margin:3px 0 0; white-space:pre-wrap; }\n.chat-source { font-size:.8em; opacity:.7; }\n.chat-empty { margin:0; opacity:.65; }\n.actions { display:flex; gap:8px; margin-top:14px; }\n.actions button { border:1px solid var(--wake-accent, var(--iob-primary, #2563eb)); color:var(--wake-accent, var(--iob-primary, #2563eb)); background:transparent; border-radius:var(--iob-border-radius, 6px); padding:6px 12px; cursor:pointer; font:inherit; }\n.actions button:disabled { opacity:.5; }\n.compact { padding:var(--wakeword-padding, 8px); }\n.compact .mic { width:42px; height:42px; }\n.compact .mic svg { width:25px; height:25px; }\n.compact .meter { margin-top:8px; }\n@media (prefers-reduced-motion:reduce) { .meter span { transition:none; } }\n", wr = (e, t) => {
	let n = (e || `${t}.0`).replace(/^system\.adapter\./, "");
	return RegExp(`^${t.replaceAll("-", "\\-")}\\.\\d+$`).test(n) ? n : `${t}.0`;
}, $ = (e, t) => Number.isFinite(Number(e)) ? Number(e) : t, Tr = (e) => {
	let t = (e || "").replace(/^system\.adapter\./, "");
	return /^smart-text2command\.\d+$/.test(t) ? t : "";
};
pe("iob-wakeword", class extends fe {
	#e;
	#t;
	#n = !1;
	#r = null;
	#i = Q.state;
	constructor() {
		super();
		let t = this.attachShadow({ mode: "open" }), n = document.createElement("style");
		n.textContent = Cr;
		let r = document.createElement("div");
		r.style.height = "100%", t.append(n, r), this.#e = e(r);
	}
	disconnectedCallback() {
		this.#t?.(), this.#t = void 0, this.#n = !1, this.#r = null, super.disconnectedCallback();
	}
	getStateIds(e) {
		return [`system.adapter.${wr(e.parakeet, "ai-parakeet")}.alive`];
	}
	render() {
		this.#t ||= Q.subscribe((e) => {
			this.#i = e, this.#s();
		}), Q.setChatLimit(this.settings.maxChatMessages ?? 50), this.editMode && Q.state.enabled && Q.disable(), !this.editMode && this.socket && Q.updateDeliveryOptions(this.#a());
		let e = wr(this.settings.parakeet, "ai-parakeet");
		if (this.states[`system.adapter.${e}.alive`]?.val === !1 && Q.connectionLost("Adapter is not running"), this.socket !== this.#r) {
			let e = this.#r;
			if (this.#r = this.socket, this.#n = !1, e && Q.state.enabled) {
				Q.disable().then(() => {
					this.isConnected && !this.editMode && this.settings.autoStart && this.socket && (this.#n = !0, Q.enable(this.socket, this.#a()));
				}), this.#s();
				return;
			}
		}
		!this.editMode && this.settings.autoStart && !this.#n && this.socket && (this.#n = !0, Q.enable(this.socket, this.#a())), this.#s();
	}
	#a() {
		let e = this.settings;
		return {
			parakeet: wr(e.parakeet, "ai-parakeet"),
			mode: e.mode || "wakeword",
			microphone: e.microphone || "",
			ringBufferMs: $(e.ringBufferMs, 1e3),
			stripWakeword: !!e.stripWakeword,
			threshold: $(e.threshold, .015),
			minSpeechMs: $(e.minSpeechMs, 250),
			silenceMs: $(e.silenceMs, 1200),
			noSpeechMs: $(e.noSpeechMs, 5e3),
			maxRecordMs: $(e.maxRecordMs, 15e3),
			showInterim: e.showInterim !== !1,
			activationTone: !!e.activationTone,
			completionTone: !!e.completionTone,
			resultState: e.resultState || "",
			statusState: e.statusState || "",
			errorState: e.errorState || "",
			processorType: e.processorType === "smart-text2command" ? "smart-text2command" : "none",
			processorInstance: Tr(e.processorInstance),
			processorMode: e.processorMode === "analyze" ? "analyze" : "execute",
			forwardInstance: e.forwardInstance || "",
			forwardCommand: e.forwardCommand || "",
			maxChatMessages: Sr(e.maxChatMessages),
			speechEnabled: !!e.speechEnabled,
			speechLanguage: this.#o(),
			speechVoiceURI: e.speechVoiceURI === "custom" ? (e.speechVoiceCustom || "").trim() || "(voice not specified)" : e.speechVoiceURI || ""
		};
	}
	#o() {
		return this.settings.language === "de" || this.settings.language === "en" ? this.settings.language : (this.systemLang || navigator.language).toLowerCase().startsWith("de") ? "de" : "en";
	}
	#s() {
		let e = this.closest(".vis-widget")?.style, t = $(this.settings.fontSize, 0), n = e?.fontSize || t === 16 ? void 0 : t || void 0, r = this.settings.accentColor === "#2563eb" ? void 0 : this.settings.accentColor;
		this.#e.render(/* @__PURE__ */ i(_e, {
			snapshot: this.#i,
			mode: this.settings.mode || "wakeword",
			language: this.#o(),
			compact: !!this.settings.compact,
			showText: this.settings.showText !== !1,
			showChat: !!this.settings.showChat,
			maxChatMessages: Sr(this.settings.maxChatMessages),
			accentColor: r,
			fontSize: n,
			editMode: this.editMode,
			onToggle: () => {
				Q.state.enabled ? Q.disable() : this.socket && Q.enable(this.socket, this.#a());
			},
			onPtt: () => {
				this.socket && Q.pushToTalk(this.socket, this.#a());
			},
			onStop: () => Q.finishRecording()
		}));
	}
});
