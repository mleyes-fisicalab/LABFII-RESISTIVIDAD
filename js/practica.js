/* ==========================================================================
   Cuaderno interactivo · Informe 6 · Resistividad eléctrica
   ========================================================================== */
const L_WIRE = 1.0, R_SERIE = 0.18; // m, Ω (cables + amperímetro)
const MAT = {
  K: { name: "Konstantan", es: "constantán (Cu-Ni)", rho: 4.90e-7, ref: 4.9e-7, alpha: 2e-5, col: "--konst" },
  M: { name: "Messing", es: "latón (Cu-Zn)", rho: 6.6e-8, ref: 7.0e-8, alpha: 1.5e-3, col: "--brass" }
};
const WIRES = [
  { k: "K1", mat: "K", d: 1.00, A: 0.785, dd: 0.006, th: 6, tabla: 1, V: [0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5] },
  { k: "K05", mat: "K", d: 0.50, A: 0.196, dd: -0.012, th: 11, tabla: 2, V: [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8] },
  { k: "K07", mat: "K", d: 0.70, A: 0.385, dd: 0.009, th: 8, tabla: 3, V: [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1] },
  { k: "K035", mat: "K", d: 0.35, A: 0.096, dd: -0.022, th: 15, tabla: 4, V: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5] },
  { k: "M05", mat: "M", d: 0.50, A: 0.196, dd: 0.004, th: 11, tabla: 5, V: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4] }];
WIRES.forEach((w, i) => { w.name = `${MAT[w.mat].name} ∅ ${fmt(w.d, w.d === 0.35 ? 2 : w.d === 1 ? 0 : 1)}`; w.color = "--c" + (i + 1); });
const W = k => WIRES.find(w => w.k === k);

/* ---------- datos ---------- */
function data() {
  const d = Store.get("data", {}); let ch = false;
  WIRES.forEach(w => { if (!d[w.k]) { d[w.k] = w.V.map(vf => ({ vf, r: [null, null, null] })); ch = true; } });
  if (ch) Store.set("data", d); return d;
}
function saveData(d) { Store.set("data", d); }
function rhoPre(w) { const p = Store.get("rhoPre", {}); return p[w.k] != null ? p[w.k] : MAT[w.mat].ref; }

/* modelo físico: hilo de 1 m, resistencia en serie y calentamiento por efecto Joule */
function physics(w, vf) {
  const m = MAT[w.mat], d = w.d * (1 + w.dd) * 1e-3, A = Math.PI * d * d / 4, R0 = m.rho * L_WIRE / A;
  let R = R0, I = 0; for (let k = 0; k < 6; k++) { I = vf / (R + R_SERIE); R = R0 * (1 + m.alpha * w.th * I * I * R); }
  return { R, I, V: I * R, P: I * I * R, dT: w.th * I * I * R };
}
function reading(w, vf) {
  const f = vf * (1 + 0.002 * gauss()); const p = physics(w, f);
  const V = Math.round(p.V * (1 + 0.0007 * gauss()) * 1000) / 1000;
  const step = p.I < 1 ? 0.005 : 0.01; const I = Math.round(p.I * (1 + 0.004 * gauss()) / step) * step;
  return [V, +I.toFixed(3)];
}
function avgRows(w) { return data()[w.k].map(row => { const rr = row.r.filter(Boolean); return { vf: row.vf, V: mean(rr.map(x => x[0])), I: mean(rr.map(x => x[1])), n: rr.length }; }); }
function fit(w) { return linreg(avgRows(w).filter(r => r.n).map(r => [r.I, r.V])); }
function results() {
  return WIRES.map(w => { const f = fit(w); const R = f ? f.m : NaN; const rho = R * w.A * 1e-6 / L_WIRE; const pre = rhoPre(w); return { w, f, R, rho, pre, er: Math.abs(pre - rho) / pre * 100 }; });
}

/* ---------- tablas ---------- */
function rawTableHTML(w) {
  const rows = data()[w.k];
  const cell = (i, j, q) => { const v = rows[i].r[j]?.[q]; return `<input data-w="${w.k}" data-i="${i}" data-j="${j}" data-q="${q}" value="${v != null && isFinite(v) ? fmt(v, 3) : ""}" inputmode="decimal" aria-label="${q ? "I" : "V"} lectura ${j + 1} fila ${i + 1}">`; };
  return tableHTML({
    id: "raw-" + w.k, caption: `Tabla ${w.tabla}. ${w.name}: voltaje del conductor y corriente (3 lecturas)`,
    head: ["V fuente (V)", "V cond.₁ (V)", "I₁ (A)", "V cond.₂ (V)", "I₂ (A)", "V cond.₃ (V)", "I₃ (A)"],
    rows: rows.map((r, i) => [fmt(r.vf, 1), ...[0, 1, 2].flatMap(j => [{ v: cell(i, j, 0) }, { v: cell(i, j, 1) }])])
  });
}
function avgTableHTML(w) {
  const a = avgRows(w);
  return tableHTML({ id: "avg-" + w.k, caption: `Tabla ${w.tabla + 5}. ${w.name}: promedios`, head: ["", ...a.map((_, i) => i + 1)],
    rows: [[{ v: "V (V)", cls: "lbl" }, ...a.map(r => r.n ? fmt(r.V, 3) : "—")], [{ v: "I (A)", cls: "lbl" }, ...a.map(r => r.n ? fmt(r.I, 3) : "—")]] });
}
function t11HTML() {
  return tableHTML({ id: "t11", caption: "Tabla 11. Ecuaciones de las gráficas V = f(I)", head: ["Tabla", "Material", "Ecuación", "R²"],
    rows: WIRES.map(w => { const f = fit(w); return [w.tabla + 5, { v: w.name, cls: "lbl" }, f ? eqStr(f, "I", "V", 4) : "—", f ? fmt(f.r2, 4) : "—"]; }) });
}
function t12HTML() {
  return tableHTML({ id: "t12", caption: "Tabla 12. Resistencia y resistividad calculada", head: ["Material", "L (m)", "Diámetro (mm)", "Área (mm²)", "R (Ω)", "ρ calculado (Ω·m)"],
    rows: results().map(r => [{ v: r.w.name, cls: "lbl" }, fmt(L_WIRE, 1), fmt(r.w.d, 2), fmt(r.w.A, 3), fmtS(r.R, 4), sciT(r.rho, 3)]) });
}
function t13HTML(editable = true) {
  return tableHTML({ id: "t13", caption: "Tabla 13. Error porcentual de la resistividad", head: ["Material", "ρ preinforme (Ω·m)", "ρ calculado (Ω·m)", "Eᵣ (%)"],
    rows: results().map(r => [{ v: r.w.name, cls: "lbl" }, editable ? { v: `<input data-pre="${r.w.k}" value="${r.pre.toExponential(2).replace(".", ",")}" aria-label="Resistividad del preinforme para ${r.w.name}" style="width:110px">` } : sciT(r.pre, 3), sciT(r.rho, 3), fmt(r.er, 2)]) });
}

/* ---------- dibujo del montaje ---------- */
const WY = [70, 112, 154, 196, 238], X0 = 92, X1 = 548;
function stageSVG() {
  return `<svg viewBox="0 0 640 380" role="img" aria-label="Montaje de la Figura 1: tablero de conductores con fuente, amperímetro y voltímetro">
  <rect class="board" x="40" y="44" width="560" height="220" rx="10"/>
  ${WIRES.map((w, i) => `<g data-wire="${w.k}"><line x1="${X0}" y1="${WY[i]}" x2="${X1}" y2="${WY[i]}" stroke="var(${MAT[w.mat].col})" stroke-width="${1 + w.d * 4}" stroke-linecap="round"/>
    <circle class="term" cx="${X0 - 14}" cy="${WY[i]}" r="7"/><circle class="term" cx="${X1 + 14}" cy="${WY[i]}" r="7"/>
    <text x="${X0 + 6}" y="${WY[i] - 8}">${w.name}</text></g>`).join("")}
  <rect x="300" y="52" width="46" height="206" rx="4" fill="#2a63c8" opacity=".85"/>
  <line id="hot" x1="${X0}" y1="70" x2="${X1}" y2="70" stroke="#ff7a3a" stroke-width="6" stroke-linecap="round" opacity="0"/>
  <path id="flow" class="flowdots" d=""/>
  <rect class="box" x="70" y="290" width="120" height="66" rx="8"/><text x="130" y="312" text-anchor="middle" class="lb">Fuente</text><text id="sv" x="130" y="338" text-anchor="middle" style="font-size:16px;fill:var(--gold)">0,0 V</text>
  <rect class="box" x="260" y="290" width="120" height="66" rx="8"/><text x="320" y="312" text-anchor="middle" class="lb">Voltímetro</text><text id="svv" x="320" y="338" text-anchor="middle" style="font-size:16px;fill:var(--gold)">0,000 V</text>
  <rect class="box" x="450" y="290" width="120" height="66" rx="8"/><text x="510" y="312" text-anchor="middle" class="lb">Amperímetro</text><text id="sva" x="510" y="338" text-anchor="middle" style="font-size:16px;fill:var(--gold)">0,00 A</text>
  <path id="cA" class="cable" stroke="#e14b4b" d=""/><path id="cB" class="cable" stroke="#e14b4b" d=""/><path id="cC" class="cable" stroke="#3a3a3a" d=""/>
  <path id="vA" class="cable" stroke="#e14b4b" stroke-dasharray="6 4" stroke-width="2" d=""/><path id="vB" class="cable" stroke="#555" stroke-dasharray="6 4" stroke-width="2" d=""/></svg>`;
}
function ammSVG() {
  return `<svg viewBox="0 0 240 140" role="img" aria-label="Amperímetro analógico"><rect x="4" y="4" width="232" height="132" rx="12" fill="var(--glass2)" stroke="var(--line2)"/><g id="ascale"></g>
  <text x="120" y="104" text-anchor="middle" style="font:11px var(--f-mono);fill:var(--fg2)" id="arng">A</text>
  <line id="aneedle" x1="120" y1="128" x2="120" y2="40" stroke="var(--bad)" stroke-width="2.2" stroke-linecap="round"/><circle cx="120" cy="128" r="6" fill="var(--fg2)"/></svg>`;
}
function ammScale(rng) { // 3 A: 30 divisiones de 0,1 A; 1 A: 20 divisiones de 0,05 A
  const n = rng === 3 ? 30 : 20, maj = rng === 3 ? 5 : 4, t = [];
  for (let k = 0; k <= n; k++) {
    const a = (-45 + 90 * k / n) * Math.PI / 180, M = k % maj === 0, r2 = M ? 78 : 85;
    t.push(`<line x1="${120 + 92 * Math.sin(a)}" y1="${128 - 92 * Math.cos(a)}" x2="${120 + r2 * Math.sin(a)}" y2="${128 - r2 * Math.cos(a)}" stroke="var(--fg2)" stroke-width="${M ? 1.4 : 1}"/>`);
    if (M) t.push(`<text x="${120 + 67 * Math.sin(a)}" y="${131 - 67 * Math.cos(a)}" text-anchor="middle" style="font:9px var(--f-mono);fill:var(--fg3)">${fmt(k / n * rng, 1)}</text>`);
  }
  return t.join("");
}
/* ---------- páginas ---------- */
const PAGES = [
{
  id: "portada", cover: true, group: "Inicio", nav: "Portada", html: () => coverHTML()
},
{
  id: "introduccion", group: "Inicio", nav: "Objetivos y materiales",
  eyebrow: "Introducción", title: "Objetivos, materiales y ruta de trabajo",
  html: () => `<div class="grid2"><div class="card"><h3>Objetivos</h3><ul class="clean">
    <li>Obtener la curva V–I de conductores de constantán y latón y verificar la ley de Ohm.</li>
    <li>Determinar la resistencia de cada hilo como la pendiente de su gráfica.</li>
    <li>Calcular la resistividad con $\\rho = RA/L$ y compararla con el valor del preinforme.</li>
    <li>Analizar cómo influyen el diámetro y el material en la resistencia.</li></ul></div>
  <div class="card"><h3>Materiales</h3><ul class="clean"><li>Tablero de resistencias con hilos de 1,0 m: Konstantan ∅ 1; 0,7; 0,5 y 0,35 mm, y Messing ∅ 0,5 mm</li>
    <li>Fuente de alimentación DC regulable</li><li>Multímetro digital como voltímetro</li><li>Amperímetro analógico</li><li>Cables de conexión</li></ul>
    <p class="small" style="margin-top:8px">Konstantan es el nombre comercial del constantán (aleación Cu-Ni). Messing significa latón (Cu-Zn).</p></div></div>
  <div class="stack"><h2>Ruta del cuaderno</h2><div class="steps">
    <div><b>Marco teórico</b><br><span class="small">Ley de Ohm, resistividad y valores del preinforme.</span></div>
    <div><b>Datos experimentales</b><br><span class="small">Tablas 1 a 5 con tres lecturas por punto.</span></div>
    <div><b>Análisis</b><br><span class="small">Promedios, gráficas V–I, R y ρ (Tablas 6 a 13).</span></div>
    <div><b>Preguntas y conclusiones</b><br><span class="small">Respuestas, autoevaluación e informe final.</span></div></div></div>
  <div class="callout acc"><b>Tus datos se quedan en este navegador.</b> Si trabajas en el laboratorio físico, escribe tus propias lecturas en las Tablas 1 a 5: el análisis se recalcula solo.</div>`
},
{
  id: "teoria", group: "Marco teórico", nav: "Resistencia y resistividad",
  eyebrow: "1 · Marco teórico", title: "Resistencia, resistividad y ley de Ohm",
  html: () => `
  <p class="lead">La resistencia de un conductor depende de dos cosas distintas: de qué está hecho y qué forma tiene. La resistividad separa la primera de la segunda.</p>
  <div class="grid2">
    <div class="card stack"><h3>Ley de Ohm</h3><p>En un conductor óhmico a temperatura constante, el voltaje entre sus extremos es proporcional a la corriente:</p>
      <div class="eq">$$V = R\\,I$$</div><p>Por eso la gráfica de V en función de I es una recta que pasa por el origen y su <b>pendiente es la resistencia</b> R.</p></div>
    <div class="card stack"><h3>Resistencia de un hilo uniforme</h3><p>Para un hilo de longitud L y sección transversal de área A:</p>
      <div class="eq">$$R=\\rho\\,\\frac{L}{A},\\qquad A=\\frac{\\pi d^{2}}{4}\\qquad\\Longrightarrow\\qquad \\rho=\\frac{R\\,A}{L}$$</div>
      <p>ρ es la resistividad, en Ω·m. Es una propiedad del material: no cambia si el hilo es más largo o más grueso.</p></div>
  </div>
  <div class="grid2">
    <div class="card stack"><h3>Dependencia con la temperatura</h3><div class="eq">$$\\rho(T)=\\rho_0\\left[1+\\alpha\\,(T-T_0)\\right]$$</div>
      <p>Al pasar corriente, el hilo disipa $P=I^2R$ y se calienta. Si α es grande, R aumenta durante la medida y la gráfica V–I se curva. El constantán se usa en resistencias de precisión justamente porque su α es casi cero.</p></div>
    <div class="card stack"><h3>Cómo se mide aquí</h3><p>El voltímetro se conecta directamente en los extremos del hilo y el amperímetro en serie. Así la caída de voltaje en cables y amperímetro no entra en la lectura de V.</p>
      <p class="small">Por eso <b>V conductor</b> es algo menor que <b>V fuente</b>: parte del voltaje de la fuente se queda en los cables y el amperímetro.</p></div>
  </div>
  <div class="card stack"><h3>Valores de referencia a 20 °C</h3>
  ${tableHTML({ caption: "Valores típicos de tablas; pueden variar según la aleación exacta", head: ["Material", "ρ (Ω·m)", "α (1/°C)"], rows: [["Cobre", "1,7 × 10⁻⁸", "3,9 × 10⁻³"], ["Aluminio", "2,8 × 10⁻⁸", "3,9 × 10⁻³"], ["Latón (Messing)", "6 a 8 × 10⁻⁸", "1,5 × 10⁻³"], ["Constantán (Konstantan)", "4,9 × 10⁻⁷", "≈ 1 × 10⁻⁵"], ["Nicromo", "1,1 × 10⁻⁶", "4 × 10⁻⁴"]].map(r => [{ v: r[0], cls: "lbl" }, r[1], r[2]]) })}</div>`
},
{
  id: "preinforme", group: "Marco teórico", nav: "Valores del preinforme",
  eyebrow: "1 · Marco teórico", title: "Resistividad del preinforme",
  html: () => `<p class="lead">Escribe la resistividad que consultaste en el preinforme para cada conductor. Estos valores se usan en la Tabla 13 para calcular el error porcentual.</p>
  <div class="card stack"><div class="grid2">${WIRES.map(w => `<label class="f">${w.name} · ρ (Ω·m)<input type="text" id="pre-${w.k}" value="${rhoPre(w).toExponential(2).replace(".", ",")}"></label>`).join("")}</div>
  <p class="small">Puedes escribir 4,9e-7 o 0,00000049. Vienen precargados con los valores de referencia de la tabla anterior.</p></div>
  <div class="card stack"><h3>Predicción antes de medir</h3><p>Con tus valores del preinforme y $L = 1{,}0$ m, la resistencia esperada de cada hilo es:</p><div id="pred"></div></div>`,
  mount(el) {
    const draw = () => $("#pred", el).innerHTML = tableHTML({ caption: "Resistencia esperada con R = ρL/A", head: ["Conductor", "Área (mm²)", "ρ preinforme (Ω·m)", "R esperada (Ω)"], rows: WIRES.map(w => [{ v: w.name, cls: "lbl" }, fmt(w.A, 3), sciT(rhoPre(w), 3), fmtS(rhoPre(w) * L_WIRE / (w.A * 1e-6), 3)]) });
    WIRES.forEach(w => $("#pre-" + w.k, el).oninput = e => { const v = num(e.target.value); if (isFinite(v) && v > 0) { const p = Store.get("rhoPre", {}); p[w.k] = v; Store.set("rhoPre", p); draw(); } });
    draw();
  }
},
{
  id: "laboratorio", group: "Datos experimentales", nav: "Laboratorio virtual",
  eyebrow: "2 · Datos experimentales", title: "Medición de voltaje y corriente en cada conductor",
  html: () => `<p class="lead">Selecciona el conductor, ajusta en la fuente cada voltaje de la tabla y toma tres lecturas de voltaje y corriente. Apaga la fuente antes de cambiar los cables a otro hilo.</p>
  <div class="bench"><div class="stage">${stageSVG()}</div>
    <div class="ctrls">
      <div class="card tight stack"><div class="meterlbl">Conductor</div><div class="seg" id="wseg">${WIRES.map(w => `<button data-w="${w.k}" aria-pressed="false">${w.name.replace("Konstantan", "K").replace("Messing", "M")}</button>`).join("")}</div></div>
      <div class="card tight stack"><div class="row" style="justify-content:space-between"><div class="meterlbl" style="margin:0">Voltaje de la fuente</div><button class="btn sm" id="off">Apagar fuente</button></div><div class="vchips" id="vch"></div></div>
      <div class="card tight grid2" style="gap:10px"><div><div class="meterlbl">Voltímetro</div><div class="meter" id="mV">0,000<small>V</small></div></div>
        <div><div class="meterlbl">Temperatura del hilo</div><div class="meter" id="mT">+0<small>°C</small></div></div></div>
    </div></div>
  <div class="grid2"><div class="card tight stack amm"><div class="meterlbl">Amperímetro analógico</div>${ammSVG()}<div class="small" id="aread"></div></div>
    <div class="card tight stack"><button class="btn pri" id="take">Tomar lectura</button><button class="btn" id="take3">Tomar las 3 lecturas de este voltaje</button>
      <button class="btn" id="sweep">Medir toda la tabla de este conductor</button><p class="small" id="hint"></p></div></div>
  <div class="stack"><div class="row" style="justify-content:space-between"><h2 id="tt"></h2><div class="row"><span id="cpb"></span><button class="btn sm" id="clr">Borrar esta tabla</button></div></div>
    <div class="wtabs" id="wtabs"></div><div id="raw"></div><p class="small">Puedes escribir o corregir cualquier lectura. Las celdas vacías no entran en los promedios.</p></div>`,
  mount(el) {
    let s = Object.assign({ w: "K1", vf: 0 }, Store.get("lab", {})); const amm = { th: 0, v: 0 }; let off = 0; let cur = null;
    const set = () => { Store.set("lab", s); paint(); };
    const paint = () => {
      const w = W(s.w), i = WIRES.indexOf(w), y = WY[i];
      $$("#wseg button", el).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.w === s.w)));
      const d = data()[w.k];
      $("#vch", el).innerHTML = w.V.map((v, k) => { const n = d[k].r.filter(Boolean).length; return `<button data-v="${v}" aria-pressed="${v === s.vf}">${fmt(v, 1)} V${n ? `<span class="c">${n}</span>` : ""}</button>`; }).join("");
      $$("#vch button", el).forEach(b => b.onclick = () => { s.vf = +b.dataset.v; set(); });
      cur = s.vf ? physics(w, s.vf) : { V: 0, I: 0, dT: 0, P: 0 };
      $("#mV", el).innerHTML = fmt(cur.V, 3) + "<small>V</small>"; $("#mT", el).innerHTML = "+" + fmt(cur.dT, 0) + "<small>°C</small>";
      $("#sv", el).textContent = fmt(s.vf, 1) + " V"; $("#svv", el).textContent = fmt(cur.V, 3) + " V"; $("#sva", el).textContent = fmt(cur.I, 2) + " A";
      const rng = cur.I < 1 ? 1 : 3; $("#arng", el).textContent = `A · escala 0–${rng}`; $("#ascale", el).innerHTML = ammScale(rng);
      $("#aread", el).textContent = s.vf ? `Escala de ${rng} A: lee con resolución de ${rng === 1 ? "0,005" : "0,01"} A.` : "Fuente apagada.";
      // cables hacia el hilo seleccionado
      $("#cA", el).setAttribute("d", `M110,290 V276 H${X0 - 30} V${y} H${X0 - 20}`);
      $("#cB", el).setAttribute("d", `M${X1 + 20},${y} H${X1 + 52} V276 H530 V290`);
      $("#cC", el).setAttribute("d", `M490,356 V368 H150 V356`);
      $("#vA", el).setAttribute("d", `M${X0 - 14},${y + 7} C${X0 - 14},270 280,262 290,290`);
      $("#vB", el).setAttribute("d", `M${X1 + 14},${y + 7} C${X1 + 14},270 360,262 350,290`);
      $("#hot", el).setAttribute("y1", y); $("#hot", el).setAttribute("y2", y); $("#hot", el).style.opacity = clamp(cur.dT / 40, 0, .85);
      $("#flow", el).setAttribute("d", `M${X0 - 14},${y} H${X1 + 14}`); $("#flow", el).style.opacity = cur.I > 0 ? 1 : 0;
      $("#hint", el).textContent = s.vf ? `Lecturas registradas para ${fmt(s.vf, 1)} V: ${d[w.V.indexOf(s.vf)]?.r.filter(Boolean).length ?? 0} de 3.` : "Elige un voltaje de la fuente para empezar.";
      $("#tt", el).textContent = `Tabla ${w.tabla} · ${w.name}`; $("#cpb", el).innerHTML = copyBtn("#raw-" + w.k);
      $("#wtabs", el).innerHTML = WIRES.map(x => `<button class="btn sm" data-tab="${x.k}" ${x.k === w.k ? 'style="border-color:var(--gold)"' : ""}>Tabla ${x.tabla}</button>`).join("");
      $$("[data-tab]", el).forEach(b => b.onclick = () => { s.w = b.dataset.tab; s.vf = 0; set(); });
      $("#raw", el).innerHTML = rawTableHTML(w);
      $$("#raw input", el).forEach(inp => inp.onchange = () => {
        const dd = data(), row = dd[inp.dataset.w][+inp.dataset.i], j = +inp.dataset.j, q = +inp.dataset.q, v = num(inp.value);
        let r = row.r[j] || [NaN, NaN]; r = [...r]; r[q] = isFinite(v) ? v : NaN; row.r[j] = (isFinite(r[0]) || isFinite(r[1])) ? r : null; saveData(dd); paint();
      });
    };
    const take = (n = 1) => {
      const w = W(s.w); if (!s.vf) { toast("Primero ajusta un voltaje en la fuente"); return; }
      const dd = data(), row = dd[w.k][w.V.indexOf(s.vf)]; let k = 0;
      for (let j = 0; j < 3 && k < n; j++) if (!row.r[j]) { row.r[j] = reading(w, s.vf); k++; }
      if (!k) toast("Ya hay 3 lecturas para este voltaje"); else { saveData(dd); toast(k === 1 ? "Lectura registrada" : `${k} lecturas registradas`); }
      paint();
    };
    $$("#wseg button", el).forEach(b => b.onclick = () => { s.w = b.dataset.w; s.vf = 0; set(); });
    $("#off", el).onclick = () => { s.vf = 0; set(); };
    $("#take", el).onclick = () => take(1); $("#take3", el).onclick = () => take(3);
    $("#sweep", el).onclick = () => { const w = W(s.w), dd = data(); dd[w.k].forEach(row => { for (let j = 0; j < 3; j++) if (!row.r[j]) row.r[j] = reading(w, row.vf); }); saveData(dd); toast(`Tabla ${w.tabla} completa`); paint(); };
    $("#clr", el).onclick = () => { const w = W(s.w), dd = data(); dd[w.k] = w.V.map(vf => ({ vf, r: [null, null, null] })); saveData(dd); toast(`Tabla ${w.tabla} borrada`); paint(); };
    paint();
    let last = performance.now();
    NB.raf(t => {
      const dt = Math.min(.05, (t - last) / 1000); last = t; if (!cur) return;
      const rng = cur.I < 1 ? 1 : 3, tgt = clamp(cur.I / rng, 0, 1.04);
      amm.v += (60 * (tgt - amm.th) - 10 * amm.v) * dt; amm.th += amm.v * dt;
      const a = (-45 + 90 * amm.th) * Math.PI / 180, nd = $("#aneedle", el); if (nd) { nd.setAttribute("x2", 120 + 86 * Math.sin(a)); nd.setAttribute("y2", 128 - 86 * Math.cos(a)); }
      off -= cur.I * 40 * dt; const f = $("#flow", el); if (f) f.style.strokeDashoffset = off;
    });
  }
},
{
  id: "graficas", group: "Análisis", nav: "Promedios y gráficas V–I",
  eyebrow: "3 · Análisis", title: "Promedios y gráficas de V en función de I",
  html: () => `<p class="lead">Se promedian las tres lecturas de cada punto (Tablas 6 a 10) y se grafica V en función de I. La ecuación de cada recta se obtiene por mínimos cuadrados, igual que la línea de tendencia de Excel.</p>
  <div class="card stack"><div id="vi"></div><p class="small">Usa la paleta del plano para cambiar colores o esconder conductores. Arrastra un eje para estirarlo.</p></div>
  <div class="stack"><div class="row" style="justify-content:space-between"><h2>Tabla 11</h2>${copyBtn("#t11")}</div>${t11HTML()}</div>
  <h2>Tablas 6 a 10</h2><div class="stack">${WIRES.map(w => avgTableHTML(w)).join("")}</div>`,
  mount(el) {
    const P = new CartesianPlane($("#vi", el), { id: "vi", height: 420, xLabel: "I (A)", yLabel: "V (V)" });
    const ser = [];
    WIRES.forEach(w => { const a = avgRows(w).filter(r => r.n), f = fit(w);
      ser.push({ id: "p" + w.k, type: "points", data: a.map(r => [r.I, r.V]), label: w.name, color: w.color, fmtX: v => fmt(v, 3) + " A", fmtY: v => fmt(v, 3) + " V" });
      if (f) ser.push({ id: "f" + w.k, type: "fn", f: x => f.m * x + f.b, label: "Ajuste " + w.name, color: w.color, width: 1.5, noLegend: true }); });
    P.setSeries(ser, true); if (!ser.some(s => s.data?.length)) P.setView({ xmin: -0.2, xmax: 3, ymin: -0.2, ymax: 3.5 });
  }
},
{
  id: "resistividad", group: "Análisis", nav: "Resistencia y resistividad",
  eyebrow: "3 · Análisis", title: "Resistencia, resistividad y error porcentual",
  html: () => `<div class="grid2"><div class="card"><div class="eq">$$\\rho_{\\text{calculado}}=\\frac{R\\,A}{L}$$</div><p class="small">R es la pendiente de V = f(I). A en m² (1 mm² = 10⁻⁶ m²) y L = 1,0 m.</p></div>
    <div class="card"><div class="eq">$$E_r=\\frac{\\left|\\rho_{\\text{preinforme}}-\\rho_{\\text{calculado}}\\right|}{\\rho_{\\text{preinforme}}}\\times100\\,\\%$$</div></div></div>
  <div class="stack"><div class="row" style="justify-content:space-between"><h2>Tabla 12</h2>${copyBtn("#t12")}</div>${t12HTML()}</div>
  <div class="stack"><div class="row" style="justify-content:space-between"><h2>Tabla 13</h2>${copyBtn("#t13")}</div><div id="t13w">${t13HTML()}</div></div>
  <div class="card stack"><h3>Análisis adicional: R en función de 1/A para el constantán</h3>
    <p>Si la resistividad es la misma en los cuatro hilos de constantán, R debe ser proporcional a 1/A y la pendiente de esa recta vale ρL.</p><div id="ra"></div><div id="rainfo" class="callout acc"></div></div>`,
  mount(el) {
    const bindPre = () => $$("#t13w input", el).forEach(inp => inp.onchange = () => { const v = num(inp.value); if (isFinite(v) && v > 0) { const p = Store.get("rhoPre", {}); p[inp.dataset.pre] = v; Store.set("rhoPre", p); } $("#t13w", el).innerHTML = t13HTML(); bindPre(); });
    bindPre();
    const pts = results().filter(r => r.w.mat === "K" && isFinite(r.R)).map(r => [1 / r.w.A, r.R]);
    const f = linreg(pts);
    const P = new CartesianPlane($("#ra", el), { id: "ra", height: 330, xLabel: "1/A (mm⁻²)", yLabel: "R (Ω)" });
    P.setSeries([{ id: "pts", type: "points", data: pts, label: "Konstantan", color: "--c2", fmtX: v => fmt(v, 2) + " mm⁻²", fmtY: v => fmt(v, 3) + " Ω" }, ...(f ? [{ id: "fit", type: "fn", f: x => f.m * x + f.b, label: "Ajuste lineal", color: "--c1", dash: "dash" }] : [])], true);
    if (!pts.length) P.setView({ xmin: -1, xmax: 12, ymin: -0.5, ymax: 6 });
    $("#rainfo", el).innerHTML = f && pts.length >= 2 ? `Ecuación: <b class="mono">${eqStr(f, "·(1/A)", "R", 4)}</b>, R² = ${fmt(f.r2, 4)}. La pendiente da $\\rho = m\\cdot 10^{-6}/L$ = <b class="mono">${sciT(f.m * 1e-6 / L_WIRE, 3)} Ω·m</b>.` : "Completa al menos dos tablas de constantán para ver este análisis.";
    NB.typeset($("#rainfo", el));
  }
},
{ id: "preguntas", group: "Preguntas", nav: "Preguntas del informe", eyebrow: "4 · Preguntas", title: "Preguntas",
  html: () => questionsHTML([
    ["p1", "¿Cómo influye el diámetro del conductor en su resistencia eléctrica? Explique.", "Compara las resistencias de los cuatro hilos de constantán en la Tabla 12. Como $A = \\pi d^2/4$, al reducir el diámetro a la mitad el área queda en la cuarta parte. Revisa si tus resistencias siguen esa proporción."],
    ["p2", "¿La resistividad eléctrica cambia al variar el diámetro del conductor? Explique.", "Mira la columna ρ de los cuatro hilos de constantán. Si las diferencias son pequeñas comparadas con la incertidumbre de la medida, la resistividad es una propiedad del material y no de la geometría. Piensa también en la tolerancia de fabricación del diámetro de los hilos más delgados."],
    ["p3", "Analice los errores porcentuales obtenidos en la Tabla 13. ¿Qué material presentó el mayor error y qué factores experimentales o propiedades del material podrían explicarlo?", "Considera el calentamiento por efecto Joule y el coeficiente de temperatura α de cada material, la composición exacta de la aleación (el latón no tiene una sola resistividad), la tolerancia del diámetro, la resolución del amperímetro y la resistencia de contacto en los bornes."]]) },
{ id: "conclusiones", group: "Conclusiones", nav: "Conclusiones y autoevaluación", eyebrow: "5 · Conclusiones", title: "Conclusiones y autoevaluación",
  html: conclusionsHTML,
  mount(el) {
    quiz($("#quiz", el), "q6", [
      { q: "En una gráfica de V en función de I para un conductor óhmico, la pendiente representa:", o: ["La resistividad", "La resistencia", "La conductancia", "La potencia"], a: 1, why: "De $V = RI$, la pendiente de V contra I es R." },
      { q: "Si el diámetro de un hilo se reduce a la mitad, manteniendo material y longitud, su resistencia:", o: ["Se reduce a la mitad", "Se duplica", "Se cuadruplica", "No cambia"], a: 2, why: "$A \\propto d^2$: con la mitad del diámetro el área es la cuarta parte y $R = \\rho L/A$ es cuatro veces mayor." },
      { q: "¿Qué hilo de 1 m tiene mayor resistencia?", o: ["Konstantan ∅ 1 mm", "Konstantan ∅ 0,35 mm", "Messing ∅ 0,5 mm", "Konstantan ∅ 0,7 mm"], a: 1, why: "Tiene la menor área y un material con resistividad unas siete veces mayor que la del latón." },
      { q: "¿Por qué el constantán se usa para fabricar resistencias patrón?", o: ["Porque conduce mejor que el cobre", "Porque su resistividad casi no cambia con la temperatura", "Porque es muy barato", "Porque no se calienta"], a: 1, why: "Su coeficiente α es del orden de 10⁻⁵ 1/°C: aunque se caliente, su resistencia se mantiene." },
      { q: "Un hilo de 1,0 m y 0,196 mm² tiene R = 2,50 Ω. Su resistividad es:", o: ["4,90 × 10⁻⁷ Ω·m", "4,90 × 10⁻¹ Ω·m", "1,28 × 10⁻² Ω·m", "2,50 × 10⁻⁶ Ω·m"], a: 0, why: "$\\rho = RA/L = 2{,}50 \\times 0{,}196\\times10^{-6}/1{,}0 = 4{,}90\\times10^{-7}\\ \\Omega\\cdot$m." }]);
  } },
{ id: "informe", group: "Cierre", nav: "Mi informe", eyebrow: "Cierre", title: "Mi informe",
  html: () => reportHTML(WIRES.map(w => rawTableHTML(w)).join("").replace(/<input[^>]*value="([^"]*)"[^>]*>/g, "$1") + t11HTML() + t12HTML() + t13HTML(false), ["p1", "p2", "p3"]),
  mount(el) { bindReport(el, "INFORME 6 · RESISTIVIDAD ELÉCTRICA", ["p1", "p2", "p3"]); } }
];
NB.init({ storeKey: "utp-lab2-resistividad", numero: 6, practica: "Resistividad eléctrica", illustration: illResistividad(), pages: PAGES });
