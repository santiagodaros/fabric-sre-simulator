
// ════════════════════════════════════════
// TABS
// ════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
}

// ════════════════════════════════════════
// FULLSCREEN / FOCUS MODE
// ════════════════════════════════════════
let focusMode = false;
function toggleFullscreen() {
  focusMode = !focusMode;
  document.getElementById('app').classList.toggle('focus-mode', focusMode);
  const icon = document.getElementById('fs-icon');
  icon.className = focusMode ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
  if (focusMode) {
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  } else {
    document.fullscreenElement && document.exitFullscreen && document.exitFullscreen();
  }
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && focusMode) {
    focusMode = false;
    document.getElementById('app').classList.remove('focus-mode');
    document.getElementById('fs-icon').className = 'fa-solid fa-expand';
  }
});

// ════════════════════════════════════════
// PRESENTER PANEL
// ════════════════════════════════════════
let presenterOpen = false;
function togglePresenter() {
  presenterOpen = !presenterOpen;
  document.getElementById('presenter-panel').classList.toggle('open', presenterOpen);
}
function toggleStep(el) {
  el.classList.toggle('done');
  const check = el.querySelector('.pp-check i');
  check.style.display = el.classList.contains('done') ? '' : 'none';
}

// ════════════════════════════════════════
// MODULE 1 — CAPACITY & SMOOTHING (real metrics + live chart)
// ════════════════════════════════════════
const HIST = 60;
let interactiveBase = 15;
let backgroundBase  = 8;
let currentDebt     = 0;
let sparkSpikeVal   = 0;
let sparkRunning    = false;
let debtInterval    = null;

const chartBuf = {
  interactive: Array.from({length: HIST}, () => 15 + (Math.random()-0.5)*3),
  background:  Array.from({length: HIST}, () =>  8 + (Math.random()-0.5)*2),
  debt:        new Array(HIST).fill(0),
};

// ── Ambient tick — runs every second ──
function tickAmbient() {
  const noise = r => (Math.random()-0.5)*r;
  const iDisp = Math.min(105, Math.max(0, interactiveBase + noise(4)));
  const bDisp = Math.min(105, Math.max(0, backgroundBase + noise(2) + sparkSpikeVal));
  if (sparkSpikeVal > 0) sparkSpikeVal = Math.max(0, sparkSpikeVal - 25);

  chartBuf.interactive.push(iDisp); chartBuf.interactive.shift();
  chartBuf.background.push(bDisp);  chartBuf.background.shift();
  chartBuf.debt.push(currentDebt);  chartBuf.debt.shift();

  // Update metric cards
  const setM = (id, val, color) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.style.color = color; }
  };
  let iCol = 'var(--cyan)';
  if (interactiveBase > 60) iCol = 'var(--yellow)';
  if (interactiveBase > 80) iCol = 'var(--orange)';
  if (interactiveBase > 95) iCol = 'var(--red)';
  setM('metric-interactive', toCU(iDisp), iCol);
  setM('metric-background',  toCU(bDisp), 'var(--lime)');
  setM('metric-debt', currentDebt > 0 ? toCU(currentDebt) : '0.0 / 64 CU',
       currentDebt > 0 ? 'var(--yellow)' : 'var(--text-dim)');

  const p95El = document.getElementById('metric-p95');
  if (p95El) {
    if      (interactiveBase > 95) { p95El.textContent = '∞ timeout';                                   p95El.style.color = 'var(--red)'; }
    else if (interactiveBase > 80) { p95El.textContent = Math.round(3000+Math.random()*9000)+'ms';           p95El.style.color = 'var(--orange)'; }
    else if (interactiveBase > 60) { p95El.textContent = Math.round(800+Math.random()*1600)+'ms';            p95El.style.color = 'var(--yellow)'; }
    else                           { p95El.textContent = Math.round(105+Math.random()*50+interactiveBase*.4)+'ms'; p95El.style.color = 'var(--lime)'; }
  }
  renderChart();
}

function toCU(pct) { return ((Math.min(100,pct)/100)*64).toFixed(1)+' / 64 CU'; }

// ── Chart ──
function resizeChart() {
  const c = document.getElementById('cu-chart');
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.width  = c.offsetWidth  * dpr;
  c.height = c.offsetHeight * dpr;
  renderChart();
}

function renderChart() {
  const canvas = document.getElementById('cu-chart');
  if (!canvas || !canvas.offsetWidth) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const PAD = 30;

  ctx.fillStyle = '#000c1a';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.lineWidth = 1;
  ctx.font = '7px monospace';
  [25,50,75,100].forEach(pct => {
    const y = H - (pct/100)*H;
    ctx.strokeStyle = 'rgba(255,255,255,.03)';
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillStyle = 'rgba(100,116,139,.3)';
    ctx.fillText(pct+'%', 2, y+3);
  });

  // Threshold dashes
  [{pct:95,color:'rgba(255,74,74,.55)',label:'Rechazo Batch'},
   {pct:80,color:'rgba(255,140,0,.5)', label:'Rechazo Interac.'},
   {pct:60,color:'rgba(255,215,0,.45)',label:'Latencia'}
  ].forEach(({pct,color,label}) => {
    const y = H-(pct/100)*H;
    ctx.setLineDash([3,5]); ctx.strokeStyle=color; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(W,y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=color; ctx.font='7px monospace';
    ctx.fillText(label, PAD+4, y-2);
  });

  // Series (debt, background, interactive — in draw order)
  [{data:chartBuf.debt,       stroke:'#ffd700',fill:'rgba(255,215,0,',  fa:.13},
   {data:chartBuf.background, stroke:'#dcfd8b',fill:'rgba(220,253,139,',fa:.09},
   {data:chartBuf.interactive,stroke:'#00f0ff',fill:'rgba(0,240,255,',  fa:.12},
  ].forEach(({data,stroke,fill,fa}) => {
    const pts = data.map((v,i)=>({
      x: PAD+((i/(HIST-1))*(W-PAD-2)),
      y: H-(Math.min(105,Math.max(0,v))/100)*H,
    }));
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,fill+fa+')'); grad.addColorStop(1,fill+'0)');
    ctx.beginPath(); ctx.moveTo(pts[0].x,H);
    pts.forEach(p=>ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts[pts.length-1].x,H); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.strokeStyle=stroke; ctx.lineWidth=1.5; ctx.stroke();
  });

  // Legend
  [['Interactivo','#00f0ff'],['Background','#dcfd8b'],['Deuda','#ffd700']].forEach(([l,c],i)=>{
    ctx.fillStyle=c; ctx.font='8px monospace'; ctx.fillText('● '+l, W-80, 11+i*12);
  });
  ctx.fillStyle='rgba(100,116,139,.35)'; ctx.font='7px monospace';
  ctx.fillText('-60s',PAD+2,H-2); ctx.fillText('now',W-20,H-2);
}

// ── Helpers ──
function capLog(msg, cls = 'log-info') {
  const c = document.getElementById('cap-console');
  const line = document.createElement('div');
  line.className = 'log-line ' + cls + ' animate-in';
  line.textContent = msg;
  c.appendChild(line);
  c.scrollTop = c.scrollHeight;
}

function updateCapStatus() {
  const el = document.getElementById('cap-status');
  const txt = document.getElementById('cap-status-text');
  el.className = 'status-badge';
  if      (interactiveBase <= 60) { el.classList.add('status-healthy');   txt.textContent = 'Saludable'; }
  else if (interactiveBase <= 80) { el.classList.add('status-latency');   txt.textContent = 'Latencia Alta'; }
  else if (interactiveBase <= 95) { el.classList.add('status-throttled'); txt.textContent = 'Rechazo Interactivo'; }
  else                            { el.classList.add('status-blocked');   txt.textContent = 'Rechazo Batch'; }
  updateImpactPanel();
}

// ── Demo actions ──
function launchSpark() {
  if (sparkRunning) return;
  sparkRunning = true;
  document.getElementById('btn-spark').disabled = true;
  sparkSpikeVal = 185;
  capLog('[' + ts() + '] Job Spark iniciado: consume 500% CU (background window: 24h)', 'log-info');
  capLog('[' + ts() + '] Smoothing activo: distribuyendo deuda a lo largo de 24 horas...', 'log-warn');
  document.getElementById('smoothing-label').textContent = '⟳ Amortizando: 24h';
  let debt = 0; const target = 74; let i = 0;
  const iv = setInterval(() => {
    debt = Math.min(target, debt + target/30); currentDebt = debt; i++;
    if (i >= 30) {
      clearInterval(iv);
      capLog('[' + ts() + '] Deuda distribuida: ' + Math.round(target) + '% amortizado — SALUDABLE ✓', 'log-ok');
      debtInterval = setInterval(() => {
        debt = Math.max(0, debt - 0.6); currentDebt = debt;
        if (debt <= 0) {
          clearInterval(debtInterval); currentDebt = 0;
          document.getElementById('smoothing-label').textContent = '';
          capLog('[' + ts() + '] Deuda completamente saldada. Capacidad liberada.', 'log-ok');
          document.getElementById('btn-spark').disabled = false;
          sparkRunning = false;
        }
      }, 350);
    }
  }, 75);
}

function saturate() {
  interactiveBase = Math.min(108, interactiveBase + 18);
  updateCapStatus();
  if (interactiveBase > 60 && interactiveBase <= 80) {
    capLog('[' + ts() + '] WARNING: Latencia alta — Fabric estira queries interactivas +2.4s', 'log-warn');
    capLog('[' + ts() + '] Capacity Metrics App: alerta temprana enviada al equipo SRE', 'log-warn');
  } else if (interactiveBase > 80 && interactiveBase <= 95) {
    capLog('[' + ts() + '] ALERT: Rechazo Interactivo — el dashboard de Power BI fue bloqueado', 'log-error');
    capLog('[' + ts() + '] El gerente de finanzas no puede ver su reporte. Prioridad: pagar deuda.', 'log-error');
  } else if (interactiveBase > 95) {
    const el = document.getElementById('cap-console');
    el.classList.add('flash-red');
    setTimeout(() => el.classList.remove('flash-red'), 1200);
    capLog('[' + ts() + '] ► Capacity Metrics App: QUIEBRE DE UMBRAL — CU Interactivo > 95%', 'log-error');
    setTimeout(() => {
      capLog('[' + ts() + '] ► Alerta disparada → equipo SRE notificado [URGENTE]', 'log-error');
      setTimeout(() => {
        capLog('[' + ts() + '] ══════════════════════', 'log-error');
        capLog('[' + ts() + '] ✖  RECHAZO BATCH ACTIVADO — ningún pipeline ejecuta', 'log-error');
        capLog('[' + ts() + '] ✖  ENTORNO CONGELADO — intervención manual requerida', 'log-error');
        capLog('[' + ts() + '] ══════════════════════', 'log-error');
      }, 600);
    }, 400);
  }
}

function resetCapacity() {
  sparkRunning = false; interactiveBase = 15; currentDebt = 0; sparkSpikeVal = 0;
  if (debtInterval) clearInterval(debtInterval);
  chartBuf.interactive = Array.from({length:HIST},()=>15+(Math.random()-.5)*3);
  chartBuf.background  = Array.from({length:HIST},()=> 8+(Math.random()-.5)*2);
  chartBuf.debt        = new Array(HIST).fill(0);
  document.getElementById('smoothing-label').textContent = '';
  document.getElementById('cap-status').className = 'status-badge status-healthy';
  document.getElementById('cap-status-text').textContent = 'Saludable';
  document.getElementById('cap-console').innerHTML =
    '<div class="log-line log-dim">// Capacity Metrics App — monitoreo proactivo activo</div>' +
    '<div class="log-line log-dim">// Umbrales: Latencia &gt;60% | Rechazo Interactivo &gt;80% | Rechazo Batch &gt;95%</div>';
  document.getElementById('btn-spark').disabled = false;
  renderChart();
  updateImpactPanel();
}

function ts() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Start ambient + resize handler ──
window.addEventListener('resize', resizeChart);
setTimeout(() => { resizeChart(); setInterval(tickAmbient, 1000); }, 100);

// ════════════════════════════════════════
// BUSINESS IMPACT PANEL
// ════════════════════════════════════════
function updateImpactPanel() {
  const panel = document.getElementById('impact-panel');
  const text  = document.getElementById('impact-text');
  if (!panel) return;
  panel.className = 'impact-panel';
  if (interactiveBase > 95) {
    panel.classList.add('impact-catastrophe');
    text.textContent = 'CATASTROPHE: Pipeline de Cierre Contable detenido. Reporte consolidado fuera de SLA. Intervención SRE requerida inmediatamente.';
  } else if (interactiveBase > 80) {
    panel.classList.add('impact-critical');
    text.textContent = 'CRITICAL: Power BI Bloqueado para el sector Financiero. Pérdida estimada de productividad: $5,000 USD/hora.';
  } else if (interactiveBase > 60) {
    panel.classList.add('impact-warning');
    text.textContent = 'SLA Warning: Reportes demorados +2.4s. Degradación leve en la experiencia de usuario.';
  } else {
    panel.classList.add('impact-healthy');
    text.textContent = 'SLA de Negocio: 100% compliant. Sin impacto operativo.';
  }
}

// ════════════════════════════════════════
// SRE GIFT MODAL
// ════════════════════════════════════════
const CL_ITEMS = [
  'Activar monitoreo en la Capacity Metrics App de Fabric',
  'Definir alerta para umbral de Latencia (CU > 70%)',
  'Definir alerta para Rechazo Interactivo (CU > 80%)',
  'Definir alerta para Rechazo Batch (CU > 95%)',
  'Configurar Geo-Redundancia GRS en OneLake subyacente',
  'Integrar Workspace con Azure DevOps (Git integration)',
  'Configurar Deployment Rules para separación DEV / STG / PROD',
  'Mapear secretos de AWS S3 con Managed Identities en Azure',
  'Documentar y probar Runbook de Failover (RTO target < 45 min)',
  'Realizar simulacro de Disaster Recovery cada trimestre',
  'Habilitar Audit Logs en el Workspace de Fabric',
  'Configurar retención de datos según política de compliance',
  'Establecer proceso de PR Reviews para pipelines en Git',
  'Definir ventanas de mantenimiento y comunicación al negocio',
];

function renderChecklist() {
  const grid = document.getElementById('cl-grid');
  if (!grid || grid.children.length > 0) return;
  CL_ITEMS.forEach((label, i) => {
    const id = 'cl-' + i;
    const div = document.createElement('div');
    div.className = 'cl-item';
    div.innerHTML = `<input type="checkbox" id="${id}" onchange="this.closest('.cl-item').classList.toggle('checked',this.checked)"><label for="${id}">${label}</label>`;
    grid.appendChild(div);
  });
}

function toggleGift() {
  renderChecklist();
  document.getElementById('modal-overlay').classList.toggle('open');
}

const RUNBOOK_MD = `# SRE Runbook — Microsoft Fabric BCDR
_Fabric Day 2026 · Santiago Da Ros_

## Pre-requisitos
- Azure DevOps repo configurado con Git integration en el Workspace
- F64 SKU disponible en región primaria (East US) y secundaria (West US 2)
- Managed Identities configuradas en Microsoft Entra ID
- Capacity Metrics App habilitada con alertas en Azure Monitor

## Pasos de Failover Automatizado

1. **Validar caída de región** — Confirmar en Azure Service Health Dashboard
2. **Sincronizar Metadata (Git)**
   \`\`\`bash
   git pull origin main --rebase
   \`\`\`
3. **Activar Geo-Redundancia GRS** — Promover réplica de OneLake en West US 2
4. **Cross-Region Restore F-SKU**
   \`\`\`powershell
   ./scripts/restore-fsku.ps1 -Region "westus2" -SKU "F64"
   \`\`\`
5. **Reapuntar Managed Identity** — Actualizar DNS + endpoints en Entra ID
6. **Validar estado** — Capacity Metrics App en región secundaria
7. **Notificar al negocio** — RTO logrado: < 40 minutos

## Umbrales de Alerta (F64 SKU)
| Estado | Umbral CU | Acción |
|--------|-----------|--------|
| Warning | > 70% | Notificar SRE |
| Rechazo Interactivo | > 80% | Escalar urgente |
| Rechazo Batch | > 95% | Activar Runbook |

## Contactos SRE
- On-Call: sre-oncall@contoso.com
- Escalation: fabric-platform@contoso.com

---
_Generated by Microsoft Fabric SRE Simulator — Fabric Day 2026_`;

async function copyRunbook() {
  const btn = document.getElementById('copy-runbook-btn');
  try {
    await navigator.clipboard.writeText(RUNBOOK_MD);
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado al portapapeles!';
    btn.style.color = 'var(--lime)';
    btn.style.borderColor = 'rgba(220,253,139,.5)';
  } catch {
    btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Usar Ctrl+C manualmente';
  }
  setTimeout(() => {
    btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Runbook SRE (Markdown)';
    btn.style.color = ''; btn.style.borderColor = '';
  }, 2800);
}

// ════════════════════════════════════════
// MODULE 2 — BCDR FAILOVER
// ════════════════════════════════════════
let rtoInterval = null;
let rtoSeconds = 0;
let regionDown = false;
let failoverRunning = false;

function setDataLayerState(state) {
  // state: 'normal' | 'dead' | 'recovered'
  const nodes = ['dl-s3', 'dl-onelake', 'dl-adls'];
  const lines = ['dl-line-left', 'dl-line-right'];
  const lbls  = ['dl-lbl-left', 'dl-lbl-right'];

  if (state === 'dead') {
    document.getElementById('dl-onelake').classList.add('dead-node');
    lines.forEach(id => document.getElementById(id).classList.add('dead-line'));
    lbls.forEach(id => { document.getElementById(id).classList.add('dead-lbl'); document.getElementById(id).textContent = 'offline'; });
  } else {
    document.getElementById('dl-onelake').classList.remove('dead-node');
    lines.forEach(id => document.getElementById(id).classList.remove('dead-line'));
    lbls.forEach(id => { document.getElementById(id).classList.remove('dead-lbl'); document.getElementById(id).textContent = state === 'recovered' ? 'zero-copy ✓' : 'zero-copy shortcut'; });
  }
}

function simulateRegionDown() {
  if (regionDown) return;
  regionDown = true;
  document.getElementById('btn-region-down').disabled = true;

  setDataLayerState('dead');

  const primary = document.getElementById('region-primary');
  primary.className = 'region-card dead-region';
  document.getElementById('primary-title').innerHTML =
    '<i class="fa-solid fa-circle-xmark" style="font-size:9px;color:var(--red)"></i> Región Principal &nbsp;<span style="color:var(--red);font-weight:400;font-size:9px">East US — OFFLINE</span>';
  document.getElementById('primary-services').innerHTML = `
    <div class="svc-row"><div class="svc-icon svc-off"><i class="fa-brands fa-git-alt"></i></div><div style="color:var(--red)"><div>Metadata (Azure DevOps)</div><div style="font-size:8.5px">DOWN</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-off"><i class="fa-solid fa-database"></i></div><div style="color:var(--red)"><div>OneLake Storage (GRS)</div><div style="font-size:8.5px">DOWN</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-off"><i class="fa-solid fa-microchip"></i></div><div style="color:var(--red)"><div>F64 SKU — Cómputo</div><div style="font-size:8.5px">DOWN</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-off"><i class="fa-solid fa-id-badge"></i></div><div style="color:var(--red)"><div>Managed Identity</div><div style="font-size:8.5px">Entra ID — sin acceso</div></div></div>
  `;

  rtoSeconds = 0;
  const rtoEl = document.getElementById('rto-counter');
  rtoEl.style.display = 'flex';
  rtoInterval = setInterval(() => {
    rtoSeconds++;
    document.getElementById('rto-time').textContent =
      String(Math.floor(rtoSeconds / 60)).padStart(2, '0') + ':' + String(rtoSeconds % 60).padStart(2, '0');
  }, 1000);

  document.getElementById('btn-failover').disabled = false;
}

function executeFailover() {
  if (failoverRunning) return;
  failoverRunning = true;
  document.getElementById('btn-failover').disabled = true;
  document.getElementById('failover-steps').style.display = 'flex';

  const runStep = (n, dur, label) => new Promise(resolve => {
    const bar  = document.getElementById('step-' + n + '-bar');
    const icon = document.getElementById('step-' + n + '-icon');
    const lbl  = document.getElementById('step-' + n + '-label');
    lbl.style.color = 'var(--text)';
    icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--yellow);font-size:9px"></i>';
    let w = 0;
    const iv = setInterval(() => {
      w = Math.min(100, w + 100 / (dur / 45));
      bar.style.width = w + '%';
      if (w >= 100) {
        clearInterval(iv);
        icon.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--lime);font-size:11px"></i>';
        lbl.style.color = 'var(--lime)';
        resolve();
      }
    }, 45);
  });

  (async () => {
    await runStep(1, 1800, '');
    await runStep(2, 2200, '');
    await runStep(3, 2800, '');
    await runStep(4, 1500, '');

    clearInterval(rtoInterval);
    document.getElementById('rto-counter').style.display = 'none';
    setDataLayerState('recovered');

    const sec = document.getElementById('region-secondary');
    sec.className = 'region-card online-region';
    document.getElementById('secondary-title').innerHTML =
      '<i class="fa-solid fa-circle-check" style="font-size:9px;color:var(--lime)"></i> Región Secundaria &nbsp;<span style="color:var(--lime);font-size:9px">West US 2 — ACTIVA</span>';
    document.getElementById('secondary-services').innerHTML = `
      <div class="svc-row"><div class="svc-icon svc-ok"><i class="fa-brands fa-git-alt"></i></div><div style="color:var(--lime)"><div>Metadata (Azure DevOps)</div><div style="font-size:8.5px">sync completado ✓</div></div></div>
      <div class="svc-row"><div class="svc-icon svc-cyan"><i class="fa-solid fa-database"></i></div><div style="color:var(--cyan)"><div>OneLake GRS — Promovido</div><div style="font-size:8.5px">read/write activo ✓</div></div></div>
      <div class="svc-row"><div class="svc-icon svc-ok"><i class="fa-solid fa-microchip"></i></div><div style="color:var(--lime)"><div>F64 SKU — Restaurado</div><div style="font-size:8.5px">Cross-Region Restore ✓</div></div></div>
      <div class="svc-row"><div class="svc-icon svc-ok"><i class="fa-solid fa-id-badge"></i></div><div style="color:var(--lime)"><div>Managed Identity</div><div style="font-size:8.5px">Entra ID reapuntado ✓</div></div></div>
    `;

    document.getElementById('rto-comparison').classList.add('visible');
  })();
}

function resetBCDR() {
  regionDown = false; failoverRunning = false;
  clearInterval(rtoInterval);
  document.getElementById('rto-counter').style.display = 'none';
  document.getElementById('rto-time').textContent = '00:00';
  document.getElementById('rto-comparison').classList.remove('visible');
  document.getElementById('failover-steps').style.display = 'none';
  document.getElementById('btn-region-down').disabled = false;
  document.getElementById('btn-failover').disabled = true;
  setDataLayerState('normal');

  for (let i = 1; i <= 4; i++) {
    document.getElementById('step-' + i + '-bar').style.width = '0%';
    document.getElementById('step-' + i + '-icon').innerHTML = '<i class="fa-solid fa-circle" style="color:#1e3040;font-size:9px"></i>';
    document.getElementById('step-' + i + '-label').style.color = 'var(--text-dim)';
  }

  document.getElementById('region-primary').className = 'region-card active-region';
  document.getElementById('primary-title').innerHTML =
    '<i class="fa-solid fa-circle-check" style="font-size:9px"></i> Región Principal &nbsp;<span style="color:var(--text-dim);font-weight:400;font-size:9px">East US</span>';
  document.getElementById('primary-services').innerHTML = `
    <div class="svc-row"><div class="svc-icon svc-ok"><i class="fa-brands fa-git-alt"></i></div><div><div>Metadata (Azure DevOps)</div><div style="font-size:8.5px;color:#475569">Git sync — activo</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-cyan"><i class="fa-solid fa-database"></i></div><div><div>OneLake Storage (GRS)</div><div style="font-size:8.5px;color:#475569">Active-Active</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-ok"><i class="fa-solid fa-microchip"></i></div><div><div>F64 SKU — Cómputo</div><div style="font-size:8.5px;color:#475569">Primary active</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-ok"><i class="fa-solid fa-id-badge"></i></div><div><div>Managed Identity</div><div style="font-size:8.5px;color:#475569">Entra ID — vinculado</div></div></div>
  `;

  document.getElementById('region-secondary').className = 'region-card';
  document.getElementById('secondary-title').innerHTML =
    '<i class="fa-solid fa-circle" style="font-size:9px;color:#1e3040"></i> Región Secundaria &nbsp;<span style="font-weight:400;font-size:9px">West US 2</span>';
  document.getElementById('secondary-services').innerHTML = `
    <div class="svc-row"><div class="svc-icon svc-dim"><i class="fa-brands fa-git-alt"></i></div><div style="color:#475569"><div>Metadata (Azure DevOps)</div><div style="font-size:8.5px">standby</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-dim"><i class="fa-solid fa-database"></i></div><div style="color:#475569"><div>OneLake GRS Replica</div><div style="font-size:8.5px">passive / warm</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-dim"><i class="fa-solid fa-microchip"></i></div><div style="color:#475569"><div>F64 SKU — Cold Standby</div><div style="font-size:8.5px">no activo</div></div></div>
    <div class="svc-row"><div class="svc-icon svc-dim"><i class="fa-solid fa-id-badge"></i></div><div style="color:#475569"><div>Managed Identity</div><div style="font-size:8.5px">Entra ID — standby</div></div></div>
  `;
}

// ════════════════════════════════════════
// MODULE 3 — DRIFT DETECTOR
// ════════════════════════════════════════
let driftActive = false;

function driftLog(html, color) {
  const c = document.getElementById('drift-console');
  const el = document.createElement('div');
  el.className = 'console-line animate-in';
  if (color) el.style.color = color;
  el.innerHTML = html;
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeLog(text, totalMs, color) {
  const c = document.getElementById('drift-console');
  const el = document.createElement('div');
  el.className = 'console-line';
  if (color) el.style.color = color;
  c.appendChild(el);
  const delay = totalMs / text.length;
  for (let i = 0; i <= text.length; i++) {
    el.innerHTML = text.slice(0, i) + (i < text.length ? '<span class="blink">_</span>' : '');
    c.scrollTop = c.scrollHeight;
    await sleep(delay);
  }
  el.textContent = text;
}

async function simulateClickOps() {
  driftActive = true;
  document.getElementById('btn-cicd').disabled = false;
  const dc = document.getElementById('drift-console');

  await typeLog('$ az fabric workspace pipeline show --workspace Finance_Prod', 280, 'var(--cyan)');
  await sleep(400);
  driftLog('&gt; State: Active | Pipeline: PL_Ingest_Sales_Data | Hash: <span style="color:var(--lime)">sha256:a3f9d1...</span>', 'var(--text-dim)');
  await sleep(500);
  driftLog('&gt; <span style="color:var(--orange)">[PORTAL EVENT] santi@contoso.com modificó pipeline manualmente — Azure Portal</span>', 'inherit');
  await sleep(400);

  const dc2 = document.getElementById('drift-console');
  for (let i = 0; i < 3; i++) {
    dc2.classList.add('flash-red');
    await sleep(350);
    dc2.classList.remove('flash-red');
    await sleep(150);
  }

  driftLog('&nbsp;');
  driftLog('<span style="color:var(--red);font-weight:700">[WARNING] Configuration Drift detected — Workspace: Finance_Prod</span>');
  driftLog('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Pipeline JSON hash mismatch:', 'var(--red)');
  driftLog(`&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Expected: <span style="color:var(--lime)">sha256:a3f9d1c8...</span>   Got: <span style="color:var(--red)">sha256:99c47e2b...</span>`);
  driftLog('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Source: <span style="color:var(--red)">ClickOps via Azure Portal — UNAUTHORIZED CHANGE</span>');
  driftLog('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style="color:var(--yellow)">→ Ejecutar pipeline CI/CD para restaurar source of truth (Git)</span>');
  driftLog('&nbsp;');
}

async function executeCICD() {
  document.getElementById('btn-cicd').disabled = true;
  driftActive = false;
  document.getElementById('drift-console').innerHTML = '';

  await typeLog('$ git pull origin main --rebase', 280, 'var(--cyan)');
  await sleep(350);
  driftLog('remote: Enumerating objects: 3, done.', 'var(--text-dim)');
  driftLog('remote: Counting objects: 100% (3/3), done.', 'var(--text-dim)');
  driftLog('Updating a3f9d1..a3f9d1 &nbsp;Fast-forward', 'var(--text-dim)');
  driftLog('&nbsp;');
  await typeLog('$ az fabric deploy --workspace Finance_Prod --pipeline PL_Ingest_Sales_Data', 420, 'var(--cyan)');
  await sleep(400);
  driftLog('&gt; Aplicando Deployment Rules desde Git source of truth...', 'var(--text-dim)');
  await sleep(300);
  driftLog('&gt; <span style="color:var(--lime)">[RULE]</span> Environment: PROD', 'var(--text-dim)');
  driftLog('&gt; <span style="color:var(--lime)">[RULE]</span> S3_Bucket: company-sales-data-prod ← inyectado automáticamente', 'var(--text-dim)');
  driftLog('&gt; <span style="color:var(--lime)">[RULE]</span> Target_Lakehouse_GUID: fe3b59-001a-42cd-90bc-prod01 ← inyectado', 'var(--text-dim)');
  await sleep(450);
  driftLog('&gt; Validando hash del pipeline...', 'var(--text-dim)');
  await sleep(400);
  driftLog('&gt; Hash match: <span style="color:var(--lime)">sha256:a3f9d1c8... ✓</span>');
  driftLog('&nbsp;');
  driftLog('<span style="font-weight:700;color:var(--lime)">✓ Pipeline desplegado exitosamente desde source of truth (Git)</span>');
  driftLog('<span style="color:var(--lime)">  ClickOps revertido. Configuration drift: RESOLVED</span>');
  driftLog('<span style="color:var(--lime)">  Workspace Finance_Prod — Estado: COMPLIANT ✓</span>');
}

function resetDrift() {
  driftActive = false;
  document.getElementById('btn-cicd').disabled = true;
  document.getElementById('drift-console').innerHTML = `
    <div class="console-line" style="color:#2a4060">Microsoft Fabric SRE — Drift Detector v2.4.1</div>
    <div class="console-line" style="color:#2a4060">Workspace: Finance_Prod | Git sync: <span style="color:var(--lime)">OK</span> | Estado: <span style="color:var(--lime)">COMPLIANT</span></div>
    <div class="console-line">&nbsp;</div>
  `;
}

// ════════════════════════════════════════
// TAB 2 — ENVIRONMENT SWITCHER
// ════════════════════════════════════════
const ENVS = {
  dev: {
    label: 'DEV',
    color: '#64d2ff',
    env: '"DEV"',
    bucket: '"company-sales-data-dev"',
    guid: '"fe3b59-001a-42cd-90bc-dev01"',
  },
  stg: {
    label: 'STG',
    color: 'var(--yellow)',
    env: '"STG"',
    bucket: '"company-sales-data-stg"',
    guid: '"fe3b59-001a-42cd-90bc-stg02"',
  },
  prod: {
    label: 'PROD',
    color: 'var(--lime)',
    env: '"PROD"',
    bucket: '"company-sales-data-prod"',
    guid: '"fe3b59-001a-42cd-90bc-prod01"',
  }
};
let currentEnv = 'dev';

function setEnv(env) {
  currentEnv = env;
  ['dev','stg','prod'].forEach(e => {
    document.getElementById('env-' + e).classList.toggle('active', e === env);
  });
  const cfg = ENVS[env];
  document.getElementById('env-badge-code').textContent = 'ENV: ' + cfg.label;
  document.getElementById('env-badge-code').style.color = cfg.color;
  buildCodePane(env);
}

function buildCodePane(env = 'dev') {
  const cfg = ENVS[env];
  const lines = [
    ['{'],
    ['  <k>"name"</k>: <s>"PL_Ingest_Sales_Data"</s>,'],
    ['  <k>"properties"</k>: {'],
    ['    <k>"description"</k>: <s>"Pipeline SRE optimizado con variables de entorno dinámicas"</s>,'],
    ['    <k>"activities"</k>: ['],
    ['      {'],
    ['        <k>"name"</k>: <s>"Lookup_Active_Shortcuts"</s>,'],
    ['        <k>"type"</k>: <s>"Lookup"</s>,'],
    ['        <k>"typeProperties"</k>: {'],
    ['          <k>"dataset"</k>: {'],
    ['            <k>"referenceName"</k>: <s>"DS_OneLake_Metadata"</s>,'],
    ['            <k>"type"</k>: <s>"DatasetReference"</s>'],
    ['          }'],
    ['        }'],
    ['      },'],
    ['      {'],
    ['        <k>"name"</k>: <s>"Copy_S3_to_Lakehouse"</s>,'],
    ['        <k>"type"</k>: <s>"Copy"</s>,'],
    ['        <k>"dependsOn"</k>: ['],
    ['          {'],
    ['            <k>"activity"</k>: <s>"Lookup_Active_Shortcuts"</s>,'],
    ['            <k>"dependencyConditions"</k>: [<s>"Succeeded"</s>]'],
    ['          }'],
    ['        ],'],
    ['        <k>"typeProperties"</k>: {'],
    ['          <k>"source"</k>: {'],
    ['            <k>"type"</k>: <s>"AmazonS3Source"</s>,'],
    ['            <k>"bucketName"</k>: <e>"@pipeline().parameters.DeploymentRules.S3_Bucket"</e>', 'hl-cyan'],
    ['          },'],
    ['          <k>"sink"</k>: {'],
    ['            <k>"type"</k>: <s>"LakehouseTableSink"</s>,'],
    ['            <k>"lakehouseId"</k>: <e>"@pipeline().parameters.DeploymentRules.Target_Lakehouse_GUID"</e>', 'hl-lime'],
    ['          }'],
    ['        }'],
    ['      }'],
    ['    ],'],
    ['    <k>"parameters"</k>: {'],
    ['      <k>"DeploymentRules"</k>: {'],
    ['        <k>"type"</k>: <s>"Object"</s>,'],
    ['        <k>"defaultValue"</k>: {'],
    ['          <k>"Environment"</k>: <m class="j-mut" id="mut-env">' + cfg.env + '</m>,', 'hl-env'],
    ['          <k>"S3_Bucket"</k>: <m class="j-mut" id="mut-bucket">' + cfg.bucket + '</m>,', 'hl-env'],
    ['          <k>"Target_Lakehouse_GUID"</k>: <m class="j-mut" id="mut-guid">' + cfg.guid + '</m>', 'hl-env'],
    ['        }'],
    ['      }'],
    ['    }'],
    ['  }'],
    ['}'],
  ];

  // Map env to highlight color
  const envColors = { dev: 'rgba(100,210,255,.06)', stg: 'rgba(255,215,0,.06)', prod: 'rgba(220,253,139,.06)' };
  const envBorder = { dev: '#64d2ff', stg: 'var(--yellow)', prod: 'var(--lime)' };

  let nums = '';
  let content = '';

  lines.forEach(([raw, hlClass], i) => {
    nums += (i + 1) + '\n';
    const rendered = raw
      .replace(/<k>(.*?)<\/k>/g, '<span class="j-key">$1</span>')
      .replace(/<s>(.*?)<\/s>/g, '<span class="j-str">$1</span>')
      .replace(/<e>(.*?)<\/e>/g, '<span class="j-expr">$1</span>')
      .replace(/<m([^>]*)>(.*?)<\/m>/g, '<span$1>$2</span>');

    if (hlClass === 'hl-cyan') {
      content += `<span class="hl-cyan">${rendered}</span>\n`;
    } else if (hlClass === 'hl-lime') {
      content += `<span class="hl-lime">${rendered}</span>\n`;
    } else if (hlClass === 'hl-env') {
      content += `<span style="display:block;background:${envColors[env]};border-left:2px solid ${envBorder[env]};padding-left:6px;margin-left:-6px">${rendered}</span>\n`;
    } else {
      content += rendered + '\n';
    }
  });

  document.getElementById('code-body').innerHTML =
    `<div class="line-numbers">${nums.trim()}</div>` +
    `<div class="code-content">${content.trim()}</div>`;

  // Animate mutable values
  ['mut-env','mut-bucket','mut-guid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.color = cfg.color;
      el.classList.add('env-flash');
      setTimeout(() => el.classList.remove('env-flash'), 600);
    }
  });
}

// Init code pane
buildCodePane('dev');

// ════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 's':
      if (!document.getElementById('btn-spark').disabled) launchSpark();
      break;
    case 't':
      saturate();
      break;
    case 'd':
      if (!regionDown) simulateRegionDown();
      break;
    case 'f':
      if (!document.getElementById('btn-failover').disabled && !failoverRunning) executeFailover();
      break;
    case 'c':
      simulateClickOps();
      break;
    case 'g':
      if (!document.getElementById('btn-cicd').disabled) executeCICD();
      break;
    case 'p':
      togglePresenter();
      break;
    case '`':
      toggleFullscreen();
      break;
    case '1':
      switchTab('code'); setEnv('dev');
      break;
    case '2':
      switchTab('code'); setEnv('stg');
      break;
    case '3':
      switchTab('code'); setEnv('prod');
      break;
    case 'escape':
      if (presenterOpen) togglePresenter();
      break;
  }
});
