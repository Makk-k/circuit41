#!/usr/bin/env node
/**
 * Circuit41 App Store Screenshot Generator
 * Outputs: app-store-assets/iphone-6-9/  (1320 × 2868 px, PNG)
 * Run:     node scripts/generate-screenshots.js
 */

const puppeteer = require('puppeteer-core');
const path      = require('path');
const fs        = require('fs');

const CHROME  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = path.join(__dirname, '..', 'app-store-assets', 'iphone-6-9');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Colour tokens (3× scale values baked in) ────────────────────────────────
const C = {
  bg:     '#F7F6F0',
  card:   '#FFFFFF',
  border: '#E2E0DA',
  text:   '#1A1A1A',
  sec:    '#6B6B6B',
  muted:  '#A0A0A0',
  accent: '#C10F1D',
  tab:    '#222221',
  // status badge pairs
  transit:   { bg: '#DBEAFE', fg: '#1E40AF' },
  arrived:   { bg: '#DCFCE7', fg: '#15803D' },
  received:  { bg: '#FEF3C7', fg: '#92400E' },
  delivered: { bg: '#D1FAE5', fg: '#065F46' },
  paid:      { bg: '#DCFCE7', fg: '#15803D' },
};

// ─── Shared base HTML wrapper ─────────────────────────────────────────────────
function page(phoneContent, headline, sub = '') {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:1320px;height:2868px;overflow:hidden}
body{
  font-family:'Plus Jakarta Sans',-apple-system,sans-serif;
  background: radial-gradient(ellipse 120% 60% at 50% 20%, #161620 0%, #09090E 55%, #0B0B14 100%);
  position:relative;
}
body::after{
  content:'';position:absolute;inset:0;pointer-events:none;
  background: radial-gradient(ellipse 80% 40% at 50% 105%, rgba(193,15,29,0.08) 0%, transparent 70%);
}

/* ── phone frame ── */
.ph-outer{
  position:absolute;top:54px;left:50%;transform:translateX(-50%);
  width:1218px;height:2172px;
  background:#1A1A1E;
  border-radius:132px;
  padding:12px;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.10),
    0 0 0 1px rgba(0,0,0,0.7),
    0 48px 130px rgba(0,0,0,0.90),
    0 90px 220px rgba(0,0,0,0.55);
}
.ph-screen{
  width:1194px;height:2148px;
  background:${C.bg};border-radius:120px;
  overflow:hidden;position:relative;
}

/* dynamic island */
.dyn{
  position:absolute;top:30px;left:50%;transform:translateX(-50%);
  width:336px;height:84px;
  background:#09090E;border-radius:57px;z-index:50;
}

/* status bar */
.sbar{
  position:absolute;top:0;left:0;right:0;height:144px;
  display:flex;align-items:flex-end;padding:0 54px 18px;
  background:${C.bg};z-index:40;
}
.sbar-time{font-size:42px;font-weight:700;color:${C.text};letter-spacing:-0.5px}
.sbar-icons{margin-left:auto;display:flex;align-items:center;gap:18px;opacity:.85}

/* content well */
.cwell{
  position:absolute;top:144px;bottom:174px;left:0;right:0;
  overflow:hidden;
}

/* tab bar */
.tbar{
  position:absolute;bottom:0;left:0;right:0;height:174px;
  background:${C.tab};
  display:flex;align-items:flex-start;justify-content:space-around;
  padding-top:27px;
}

/* ── marketing text ── */
.mkt{
  position:absolute;bottom:0;left:0;right:0;height:588px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:0 96px;gap:27px;
}
.mkt-h{
  font-size:87px;font-weight:800;color:#FFF;
  text-align:center;line-height:1.08;letter-spacing:-1.5px;
}
.mkt-h em{color:${C.accent};font-style:normal}
.mkt-s{
  font-size:39px;font-weight:400;
  color:rgba(255,255,255,.40);
  text-align:center;line-height:1.45;
}

/* ── reusable app components ── */
.px60{padding-left:60px;padding-right:60px}
.slabel{
  font-size:30px;font-weight:600;color:${C.muted};
  letter-spacing:3.6px;text-transform:uppercase;
  padding:0 60px;
}
.card{
  background:${C.card};border:3px solid ${C.border};
  border-radius:42px;overflow:hidden;
}
.badge{
  display:inline-flex;align-items:center;
  padding:9px 24px;border-radius:60px;
  font-size:30px;font-weight:600;white-space:nowrap;
}
.div3{height:3px;background:${C.border};margin:0 48px}
.row{
  display:flex;align-items:center;justify-content:space-between;
  padding:39px 48px;
}
</style>
</head>
<body>
<div style="width:1320px;height:2868px;position:relative">
  <div class="ph-outer">
    <div class="ph-screen">
      ${phoneContent}
    </div>
  </div>
  <div class="mkt">
    <div class="mkt-h">${headline}</div>
    ${sub ? `<div class="mkt-s">${sub}</div>` : ''}
  </div>
</div>
</body></html>`;
}

// ─── Shared: status bar icons (SVG, inline) ───────────────────────────────────
const SBAR_ICONS = `
<svg width="57" height="30" viewBox="0 0 19 10">
  <rect x="0" y="7" width="3" height="3" rx=".6" fill="#1A1A1A"/>
  <rect x="4" y="5" width="3" height="5" rx=".6" fill="#1A1A1A"/>
  <rect x="8" y="2.5" width="3" height="7.5" rx=".6" fill="#1A1A1A"/>
  <rect x="12" y="0" width="3" height="10" rx=".6" fill="#1A1A1A"/>
</svg>
<svg width="48" height="30" viewBox="0 0 16 11">
  <circle cx="8" cy="9.5" r="1.8" fill="#1A1A1A"/>
  <path d="M4.5 6a5 5 0 0 1 7 0" stroke="#1A1A1A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M1.5 3a9.5 9.5 0 0 1 13 0" stroke="#1A1A1A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>
<svg width="78" height="30" viewBox="0 0 26 11">
  <rect x="0" y="2" width="21" height="8" rx="2.5" stroke="#1A1A1A" stroke-width="1.2" fill="none"/>
  <rect x="1.5" y="3.5" width="15" height="5" rx="1.5" fill="#1A1A1A"/>
  <path d="M22.5 4.5v2.5a1.75 1.75 0 0 0 0-2.5z" fill="#1A1A1A"/>
</svg>`;

// ─── Shared: tab bar ──────────────────────────────────────────────────────────
function tabBar(active) {
  const col = (name) => active === name ? '#FFFFFF' : '#888884';
  return `
  <div class="tbar">
    <div style="display:flex;flex-direction:column;align-items:center">
      <svg width="60" height="60" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="2" fill="${col('Tools')}"/>
        <rect x="14" y="3" width="7" height="7" rx="2" fill="${col('Tools')}"/>
        <rect x="3" y="14" width="7" height="7" rx="2" fill="${col('Tools')}"/>
        <rect x="14" y="14" width="7" height="7" rx="2" fill="${col('Tools')}"/>
      </svg>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center">
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="${col('Shipments')}"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="${col('Shipments')}" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center">
      <svg width="72" height="72" viewBox="0 0 24 24">
        <path d="M12 3L4 9.5V20a1 1 0 001 1h4.5v-5.5a1 1 0 011-1h3a1 1 0 011 1V21H19a1 1 0 001-1V9.5L12 3z" fill="${col('Home')}"/>
      </svg>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center">
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.9 6.3 6.8.8-5 4.9 1.3 6.8L12 17.7l-6 3.1 1.3-6.8-5-4.9 6.8-.8L12 2z"
          stroke="${col('Actions')}" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center">
      <svg width="60" height="60" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill="${col('Profile')}"/>
        <path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6" fill="none" stroke="${col('Profile')}" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
  </div>`;
}

// ─── Screen 1: Dashboard ──────────────────────────────────────────────────────
function s1_dashboard() {
  const content = `
  <div class="dyn"></div>
  <div class="sbar">
    <span class="sbar-time">9:41</span>
    <div class="sbar-icons">${SBAR_ICONS}</div>
  </div>

  <div class="cwell">
    <!-- header greeting -->
    <div style="padding:36px 60px 30px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:33px;font-weight:400;color:${C.sec}">Wednesday, 15 January</div>
        <div style="font-size:63px;font-weight:700;color:${C.text};margin-top:9px;line-height:1.08">Good morning,</div>
        <div style="font-size:63px;font-weight:700;color:${C.text};line-height:1.08">Abdullah &#x1F44B;</div>
      </div>
      <div style="width:126px;height:126px;background:${C.accent};border-radius:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- active shipments -->
    <div class="slabel" style="margin-bottom:21px">ACTIVE SHIPMENTS
      <span style="background:${C.accent};color:#fff;border-radius:30px;padding:3px 18px;font-size:27px;margin-left:18px">2</span>
    </div>

    <!-- card 1 -->
    <div style="margin:0 60px 18px">
      <div class="card" style="padding:42px 48px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:21px">
          <div>
            <div style="font-size:39px;font-weight:700;color:${C.text}">London &#x2192; Lagos</div>
            <div style="font-size:30px;color:${C.sec};margin-top:9px">Shipment #8F2A1C9B &nbsp;·&nbsp; 14.5 kg</div>
          </div>
          <span class="badge" style="background:${C.transit.bg};color:${C.transit.fg}">In Transit</span>
        </div>
        <div style="height:3px;background:#F0EEE8;margin-bottom:21px"></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:15px">
            <div style="width:21px;height:21px;background:${C.transit.bg};border-radius:50%;display:flex;align-items:center;justify-content:center">
              <div style="width:10px;height:10px;background:${C.transit.fg};border-radius:50%"></div>
            </div>
            <span style="font-size:30px;color:${C.sec}">Est. arrival 26 Jan</span>
          </div>
          <span style="font-size:39px;font-weight:700;color:${C.text}">&#xA3;65.25</span>
        </div>
      </div>
    </div>

    <!-- card 2 -->
    <div style="margin:0 60px 30px">
      <div class="card" style="padding:42px 48px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:21px">
          <div>
            <div style="font-size:39px;font-weight:700;color:${C.text}">London &#x2192; Guangzhou</div>
            <div style="font-size:30px;color:${C.sec};margin-top:9px">Shipment #3D7E4A12 &nbsp;·&nbsp; Awaiting weighing</div>
          </div>
          <span class="badge" style="background:${C.received.bg};color:${C.received.fg}">Received</span>
        </div>
        <div style="height:3px;background:#F0EEE8;margin-bottom:21px"></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:15px">
            <div style="width:21px;height:21px;background:${C.received.bg};border-radius:50%;display:flex;align-items:center;justify-content:center">
              <div style="width:10px;height:10px;background:${C.received.fg};border-radius:50%"></div>
            </div>
            <span style="font-size:30px;color:${C.sec}">Cost pending weighing</span>
          </div>
          <span style="font-size:39px;font-weight:700;color:${C.muted}">&#xA3; TBC</span>
        </div>
      </div>
    </div>

    <!-- recent activity -->
    <div class="slabel" style="margin-bottom:21px">RECENT ACTIVITY</div>
    <div style="margin:0 60px">
      <div class="card">
        <div class="row">
          <div>
            <div style="font-size:33px;font-weight:600;color:${C.text}">Parcel marked arrived</div>
            <div style="font-size:27px;color:${C.sec};margin-top:9px">Shipment #8F2A1C9B &nbsp;·&nbsp; 2 hours ago</div>
          </div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="div3"></div>
        <div class="row">
          <div>
            <div style="font-size:33px;font-weight:600;color:${C.text}">Payment confirmed</div>
            <div style="font-size:27px;color:${C.sec};margin-top:9px">Shipment #C9B3F7E1 &nbsp;·&nbsp; Yesterday</div>
          </div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="div3"></div>
        <div class="row">
          <div>
            <div style="font-size:33px;font-weight:600;color:${C.text}">Shipment dispatched</div>
            <div style="font-size:27px;color:${C.sec};margin-top:9px">Shipment #8F2A1C9B &nbsp;·&nbsp; 20 Jan</div>
          </div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  </div>

  ${tabBar('Home')}`;

  return page(content,
    'Manage shipments<br><em>from one place</em>',
    'Full visibility across every active shipment.');
}

// ─── Screen 2: Shipment Tracking ──────────────────────────────────────────────
function s2_tracking() {
  function stage(done, active, label, date, last = false) {
    const circleBg  = done ? C.accent : active ? C.accent : C.card;
    const circleBdr = done ? C.accent : active ? C.accent : C.border;
    const lineColor = done ? C.accent : '#E2E0DA';
    return `
    <div style="display:flex;gap:39px;align-items:flex-start;${last ? '' : 'margin-bottom:0'}">
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
        <div style="width:54px;height:54px;border-radius:50%;border:3px solid ${circleBdr};background:${circleBg};
          display:flex;align-items:center;justify-content:center;position:relative;z-index:1">
          ${done ? `<svg width="27" height="27" viewBox="0 0 24 24" fill="none">
            <polyline points="20 6 9 17 4 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>` : active ? `<div style="width:18px;height:18px;background:white;border-radius:50%"></div>` : ''}
        </div>
        ${!last ? `<div style="width:3px;flex:1;min-height:57px;background:${lineColor};margin:3px 0"></div>` : ''}
      </div>
      <div style="padding-top:9px;${last ? '' : 'padding-bottom:57px'}">
        <div style="font-size:${active ? '36px' : '33px'};font-weight:${active ? '700' : '500'};color:${active ? C.text : done ? C.text : C.muted}">${label}</div>
        ${date ? `<div style="font-size:27px;color:${done || active ? C.sec : C.muted};margin-top:6px">${date}</div>` : ''}
        ${active ? `<span class="badge" style="background:${C.transit.bg};color:${C.transit.fg};margin-top:12px;font-size:27px">In transit</span>` : ''}
      </div>
    </div>`;
  }

  const content = `
  <div class="dyn"></div>
  <div class="sbar" style="background:${C.bg}">
    <span class="sbar-time">9:41</span>
    <div class="sbar-icons">${SBAR_ICONS}</div>
  </div>

  <div class="cwell">
    <!-- header -->
    <div style="padding:27px 60px 24px;display:flex;align-items:center;gap:21px">
      <div style="width:72px;height:72px;background:rgba(0,0,0,0.06);border-radius:36px;display:flex;align-items:center;justify-content:center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="${C.text}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div style="font-size:45px;font-weight:700;color:${C.text}">Shipment #8F2A1C9B</div>
        <div style="font-size:30px;color:${C.sec};margin-top:6px">DHL Express &nbsp;·&nbsp; Tracking 1234 5678 90</div>
      </div>
    </div>

    <!-- route banner -->
    <div style="margin:0 60px 30px">
      <div style="background:${C.card};border:3px solid ${C.border};border-radius:42px;padding:30px 48px;
        display:flex;align-items:center;justify-content:space-between">
        <div style="text-align:center">
          <div style="font-size:48px">&#x1F1EC;&#x1F1E7;</div>
          <div style="font-size:33px;font-weight:700;color:${C.text};margin-top:9px">London</div>
          <div style="font-size:27px;color:${C.sec}">United Kingdom</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:9px">
          <div style="font-size:27px;color:${C.muted}">14.5 kg</div>
          <div style="width:180px;height:3px;background:linear-gradient(to right, ${C.accent}, #FF6B6B, ${C.accent});border-radius:3px"></div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M14 7l5 5-5 5" stroke="${C.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div style="text-align:center">
          <div style="font-size:48px">&#x1F1F3;&#x1F1EC;</div>
          <div style="font-size:33px;font-weight:700;color:${C.text};margin-top:9px">Lagos</div>
          <div style="font-size:27px;color:${C.sec}">Nigeria</div>
        </div>
      </div>
    </div>

    <!-- timeline heading -->
    <div class="slabel" style="margin-bottom:27px">TRACKING TIMELINE</div>

    <!-- timeline -->
    <div style="padding:0 60px">
      <div class="card" style="padding:48px 48px 39px">
        ${stage(true,  false, 'Shipment created',            'Wed, 15 January')}
        ${stage(true,  false, 'Items received at warehouse', 'Sat, 18 January')}
        ${stage(true,  false, 'Departed origin',             'Mon, 20 January')}
        ${stage(false, true,  'In transit to destination',   'Since Tue, 21 January')}
        ${stage(false, false, 'Arriving destination port',   'Est. Sun, 26 January')}
        ${stage(false, false, 'Out for delivery',            '')}
        ${stage(false, false, 'Delivered',                   '', true)}
      </div>
    </div>
  </div>

  ${tabBar('Shipments')}`;

  return page(content,
    'Track every<br><em>shipment stage</em>',
    'Real-time visibility from warehouse to door.');
}

// ─── Screen 3: Parcels arrived / Workspace ────────────────────────────────────
function s3_parcels() {
  function parcelCard(name, ref, weight, status, statusStyle) {
    return `
    <div class="card" style="margin:0 60px 18px;padding:39px 48px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
        <div>
          <div style="font-size:36px;font-weight:700;color:${C.text}">${name}</div>
          <div style="font-size:27px;color:${C.accent};margin-top:6px;font-weight:500;text-decoration:underline">${ref}</div>
        </div>
        <span class="badge" style="background:${statusStyle.bg};color:${statusStyle.fg}">${status}</span>
      </div>
      <div style="height:3px;background:#F0EEE8;margin-bottom:18px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:27px;color:${C.sec}">Weight: ${weight} kg</span>
        <span style="font-size:27px;color:${C.arrived.fg};font-weight:600">&#x2713; At warehouse</span>
      </div>
    </div>`;
  }

  const content = `
  <div class="dyn"></div>
  <div class="sbar">
    <span class="sbar-time">9:41</span>
    <div class="sbar-icons">${SBAR_ICONS}</div>
  </div>

  <div class="cwell">
    <!-- header -->
    <div style="padding:27px 60px 6px">
      <div style="display:flex;align-items:center;gap:15px;margin-bottom:9px">
        <div style="font-size:45px;font-weight:700;color:${C.text}">Shipment #8F2A1C9B</div>
        <span class="badge" style="background:#FEF3C7;color:#B45309;font-size:27px">In progress</span>
      </div>
      <div style="font-size:30px;color:${C.sec}">Started 15 Jan &nbsp;·&nbsp; &#xA3;4.50/kg slot</div>
    </div>

    <!-- drop-off -->
    <div class="slabel" style="margin-top:27px;margin-bottom:18px">DROP-OFF ADDRESS</div>
    <div style="margin:0 60px 27px">
      <div class="card" style="padding:36px 48px">
        <div style="font-size:33px;font-weight:500;color:${C.text};line-height:1.5">Unit 4, Meridian Trading Estate,<br>Bugsby Way, London SE7 7SJ</div>
        <div style="font-size:27px;color:${C.sec};margin-top:9px">Send your items to this address</div>
        <div style="display:inline-flex;align-items:center;gap:12px;margin-top:18px;
          border:2px solid ${C.border};border-radius:24px;padding:9px 24px;background:${C.bg}">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="${C.text}" stroke-width="1.8"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="${C.text}" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <span style="font-size:30px;font-weight:600;color:${C.text}">Copy address</span>
        </div>
      </div>
    </div>

    <!-- parcels section -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0 60px;margin-bottom:18px">
      <div class="slabel" style="padding:0">PARCELS (3)</div>
      <span style="font-size:30px;color:${C.sec}">Total: 24.0 kg</span>
    </div>

    ${parcelCard('Samsung Smart TV', 'REF-TX4A1', '12.5', 'Arrived', C.arrived)}
    ${parcelCard('Laptops × 2', 'REF-MB29X', '4.8', 'Arrived', C.arrived)}
    ${parcelCard('Winter Clothing Pack', 'REF-CL77Z', '6.7', 'Arrived', C.arrived)}

    <!-- ready button -->
    <div style="padding:27px 60px 0;text-align:center">
      <div style="background:${C.accent};border-radius:42px;padding:45px;text-align:center">
        <span style="font-size:42px;font-weight:700;color:#fff">Ready to ship &#x2192;</span>
      </div>
      <div style="font-size:30px;color:${C.muted};margin-top:18px">All items arrived? Proceed to delivery and payment</div>
    </div>
  </div>

  ${tabBar('Shipments')}`;

  return page(content,
    'Release payments only<br>when <em>parcels arrive</em>',
    'Every item verified before a penny is charged.');
}

// ─── Screen 4: Checkout ───────────────────────────────────────────────────────
function s4_checkout() {
  const content = `
  <div class="dyn"></div>
  <div class="sbar">
    <span class="sbar-time">9:41</span>
    <div class="sbar-icons">${SBAR_ICONS}</div>
  </div>

  <div class="cwell">
    <!-- header -->
    <div style="padding:27px 60px 24px;display:flex;align-items:center;gap:21px">
      <div style="width:72px;height:72px;background:rgba(0,0,0,0.06);border-radius:36px;display:flex;align-items:center;justify-content:center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="${C.text}" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div style="font-size:51px;font-weight:700;color:${C.text}">Complete your shipment</div>
    </div>

    <!-- address section -->
    <div class="slabel" style="margin-bottom:18px">DELIVERY ADDRESS</div>
    <div style="margin:0 60px 30px">
      <div style="background:${C.card};border:3px solid ${C.accent};border-radius:36px;
        padding:33px 48px;display:flex;align-items:center;gap:24px">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" stroke="${C.text}" stroke-width="1.5"/>
          <circle cx="12" cy="10" r="3" stroke="${C.text}" stroke-width="1.5"/>
        </svg>
        <div style="flex:1">
          <div style="font-size:36px;font-weight:600;color:${C.text}">14 Apapa Road, Lagos Island</div>
          <div style="font-size:27px;color:${C.sec};margin-top:6px">Lagos, Nigeria</div>
        </div>
        <div style="width:54px;height:54px;background:#DCFCE7;border-radius:50%;display:flex;align-items:center;justify-content:center">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
            <polyline points="20 6 9 17 4 12" stroke="#15803D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- cost breakdown -->
    <div class="slabel" style="margin-bottom:18px">COST BREAKDOWN</div>
    <div style="margin:0 60px 30px">
      <div class="card" style="padding:36px 48px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:21px">
          <span style="font-size:33px;color:${C.sec}">Total weight</span>
          <span style="font-size:33px;font-weight:500;color:${C.text}">24.0 kg</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:21px">
          <span style="font-size:33px;color:${C.sec}">Rate per kg</span>
          <span style="font-size:33px;font-weight:500;color:${C.text}">&#xA3;4.50/kg</span>
        </div>
        <div style="height:3px;background:${C.border};margin:18px 0"></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:39px;font-weight:700;color:${C.text}">Amount due</span>
          <span style="font-size:45px;font-weight:700;color:${C.text}">&#xA3;108.00</span>
        </div>
      </div>
    </div>

    <!-- payment section -->
    <div class="slabel" style="margin-bottom:18px">PAYMENT</div>

    <!-- card option (selected) -->
    <div style="margin:0 60px 0">
      <div style="background:${C.card};border:4.5px solid ${C.accent};border-radius:36px;
        padding:33px 48px;display:flex;align-items:center;gap:24px;margin-bottom:18px">
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="${C.sec}" stroke-width="1.5"/>
          <path d="M2 10h20" stroke="${C.sec}" stroke-width="1.5"/>
        </svg>
        <span style="font-size:42px;font-weight:600;color:${C.text};flex:1">Pay by card</span>
        <div style="width:27px;height:27px;border-radius:50%;background:${C.accent}"></div>
      </div>

      <!-- saved card row -->
      <div style="background:#F7F6F0;border-radius:24px;padding:30px 48px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:21px;
          border-bottom:1.5px solid #E2E0DA">
          <span style="font-size:36px;color:${C.text};font-weight:500">VISA &nbsp;&#x2022;&#x2022;&#x2022;&#x2022; 4242 &nbsp;
            <span style="font-size:30px;color:${C.sec};font-weight:400">05/27</span>
          </span>
          <div style="width:54px;height:54px;border-radius:50%;background:${C.accent};
            display:flex;align-items:center;justify-content:center">
            <div style="width:18px;height:18px;background:#fff;border-radius:50%"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:21px">
          <span style="font-size:36px;color:${C.text};font-weight:500">Use a different card</span>
          <div style="width:54px;height:54px;border-radius:50%;border:4.5px solid #D4D2CC"></div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="margin:24px 60px 0">
      <div style="background:${C.accent};border-radius:42px;padding:48px;text-align:center">
        <span style="font-size:42px;font-weight:700;color:#fff">Confirm and pay</span>
      </div>
    </div>
  </div>

  ${tabBar('Shipments')}`;

  return page(content,
    'Fast checkout with<br><em>saved details</em>',
    'Saved addresses and cards — one tap to pay.');
}

// ─── Screen 5: Profile & Security ────────────────────────────────────────────
function s5_profile() {
  const content = `
  <div class="dyn"></div>
  <div class="sbar">
    <span class="sbar-time">9:41</span>
    <div class="sbar-icons">${SBAR_ICONS}</div>
  </div>

  <!-- avatar section (full-width, own background) -->
  <div style="background:${C.bg};padding:42px 60px 36px;text-align:center">
    <div style="width:168px;height:168px;border-radius:84px;background:#ECEAE4;
      display:flex;align-items:center;justify-content:center;margin:0 auto 27px">
      <span style="font-size:63px;font-weight:700;color:${C.sec}">AM</span>
    </div>
    <div style="font-size:51px;font-weight:700;color:${C.text}">Abdullah Mahmoud</div>
  </div>

  <div class="cwell" style="top:375px">
    <!-- personal info -->
    <div style="padding:0 60px;margin-top:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <div class="slabel" style="padding:0">PERSONAL INFORMATION</div>
        <svg width="39" height="39" viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="${C.muted}" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" stroke="${C.muted}" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="card">
        <div class="row">
          <span style="font-size:36px;color:${C.sec}">First Name</span>
          <span style="font-size:36px;font-weight:500;color:${C.text}">Abdullah</span>
        </div>
        <div class="div3"></div>
        <div class="row">
          <span style="font-size:36px;color:${C.sec}">Last Name</span>
          <span style="font-size:36px;font-weight:500;color:${C.text}">Mahmoud</span>
        </div>
        <div class="div3"></div>
        <div class="row">
          <span style="font-size:36px;color:${C.sec}">Email</span>
          <div style="display:flex;align-items:center;gap:15px">
            <span style="font-size:30px;font-weight:500;color:${C.text}">a.mahmoud@gmail.com</span>
            <span style="background:#DCFCE7;color:#15803D;border-radius:30px;padding:6px 18px;font-size:27px;font-weight:600">Verified</span>
          </div>
        </div>
        <div class="div3"></div>
        <div class="row">
          <span style="font-size:36px;color:${C.sec}">Phone</span>
          <span style="font-size:36px;font-weight:500;color:${C.text}">+44 7700 900 142</span>
        </div>
      </div>
    </div>

    <!-- payment methods -->
    <div style="padding:0 60px;margin-top:30px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <div class="slabel" style="padding:0">PAYMENT METHODS</div>
        <svg width="39" height="39" viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="${C.muted}" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" stroke="${C.muted}" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="card">
        <div class="row">
          <span style="font-size:36px;font-weight:500;color:${C.sec}">1 card saved</span>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- sign out + help -->
    <div style="padding:0 60px;margin-top:30px">
      <div class="card">
        <div class="row">
          <span style="font-size:36px;font-weight:600;color:${C.accent}">Sign out</span>
        </div>
        <div class="div3"></div>
        <div class="row">
          <span style="font-size:36px;color:${C.sec}">Help improve the app</span>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="${C.sec}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- legal links -->
    <div style="display:flex;justify-content:center;align-items:center;gap:24px;margin-top:30px">
      <span style="font-size:30px;color:${C.muted}">Terms of Service</span>
      <div style="width:9px;height:9px;border-radius:50%;background:#C0BDBB"></div>
      <span style="font-size:30px;color:${C.muted}">Privacy Policy</span>
    </div>
  </div>

  ${tabBar('Profile')}`;

  return page(content,
    'Built for secure<br><em>shipment coordination</em>',
    'Your account and data, protected end-to-end.');
}

// ─── Runner ───────────────────────────────────────────────────────────────────
async function run() {
  console.log('Launching Chrome…');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const screenshots = [
    { file: '01-dashboard.png',  html: s1_dashboard() },
    { file: '02-tracking.png',   html: s2_tracking()  },
    { file: '03-parcels.png',    html: s3_parcels()   },
    { file: '04-checkout.png',   html: s4_checkout()  },
    { file: '05-profile.png',    html: s5_profile()   },
  ];

  for (const s of screenshots) {
    const outPath = path.join(OUT_DIR, s.file);
    const page    = await browser.newPage();

    await page.setViewport({ width: 1320, height: 2868, deviceScaleFactor: 1 });
    await page.setContent(s.html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: outPath, type: 'png', fullPage: false });
    await page.close();

    const { size } = fs.statSync(outPath);
    console.log(`  ✓  ${s.file}  (${(size / 1024).toFixed(0)} KB)`);
  }

  await browser.close();
  console.log(`\nDone — saved to: ${OUT_DIR}`);
}

run().catch(err => { console.error(err); process.exit(1); });
