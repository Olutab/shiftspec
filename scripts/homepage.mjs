import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

const home = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShiftSpec — Premium Nurse Brain Sheets</title>
<meta name="description" content="Hyper-specific, fully editable nurse brain sheets for float pool, travel, and night-shift nurses. Blueprint-grade templates that fit your assignment, not generic PDFs.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://shiftspec.vercel.app/">
<meta property="og:title" content="ShiftSpec — Premium Nurse Brain Sheets">
<meta property="og:description" content="Blueprint-grade brain sheets that fit your assignment. Editable, specific, built for real shifts.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://shiftspec.vercel.app/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<style>
.hero{background:linear-gradient(135deg,#182430 0%,#0B5FA5 100%);color:#E8EEF4;padding:4rem 1rem;text-align:center;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,0.03) 40px,rgba(255,255,255,0.03) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,0.03) 40px,rgba(255,255,255,0.03) 41px);animation:gridMove 20s linear infinite}
@keyframes gridMove{from{transform:translateY(0)}to{transform:translateY(40px)}}
.hero h1{font-size:clamp(2rem,5vw,3.5rem);margin:0 0 1rem;font-weight:700;position:relative;z-index:1}
.hero p{font-size:1.2rem;max-width:600px;margin:0 auto 2rem;opacity:.9;position:relative;z-index:1}
.hero-cta{display:inline-block;background:#7FB4E8;color:#182430;padding:1rem 2rem;font-weight:700;text-decoration:none;border-radius:8px;transition:all .2s;position:relative;z-index:1}
.hero-cta:hover{background:#E8EEF4;transform:translateY(-2px);box-shadow:0 8px 16px rgba(0,0,0,.2)}
.featured{padding:3rem 1rem;max-width:1200px;margin:0 auto}
.featured h2{font-size:2rem;margin:0 0 2rem;text-align:center}
.featured-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
.featured-card{background:var(--surface);border:2px solid var(--rule);border-radius:12px;padding:1.5rem;transition:all .3s;position:relative;overflow:hidden}
.featured-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#0B5FA5,#7FB4E8)}
.featured-card:hover{transform:translateY(-4px);border-color:#0B5FA5;box-shadow:0 12px 24px rgba(11,95,165,.15)}
.featured-card h3{margin:0 0 .5rem;font-size:1.3rem}
.featured-card p{margin:0 0 1rem;opacity:.8;font-size:.95rem}
.badge{display:inline-block;background:#0B5FA5;color:#fff;padding:.25rem .75rem;border-radius:999px;font-size:.75rem;font-weight:700;margin-bottom:.5rem}
.trust{background:var(--surface);padding:3rem 1rem;text-align:center}
.trust-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2rem;max-width:1000px;margin:0 auto}
.trust-item{padding:1.5rem}
.trust-item h3{margin:0 0 .5rem;font-size:1.1rem}
.trust-item p{margin:0;opacity:.7;font-size:.9rem}
.shop-preview{padding:3rem 1rem;background:#F3F5F7}
.shop-preview-inner{max-width:1200px;margin:0 auto;text-align:center}
.shop-preview h2{font-size:2rem;margin:0 0 1rem}
.shop-preview p{margin:0 0 2rem;opacity:.8}
.shop-preview .btn{display:inline-block;background:#0B5FA5;color:#fff;padding:1rem 2.5rem;text-decoration:none;border-radius:8px;font-weight:700;transition:all .2s}
.shop-preview .btn:hover{background:#182430;transform:translateY(-2px)}
</style>
</head>
<body>
<header class="site"><a class="brand" href="/"><svg viewBox="0 0 32 32" class="logo" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="3" class="lg-frame"/><line x1="16" y1="3" x2="16" y2="29" class="lg-line"/><line x1="3" y1="16" x2="29" y2="16" class="lg-line"/><rect x="18" y="18" width="9" height="9" class="lg-fill"/></svg>ShiftSpec</a><nav><a href="/">Home</a><a href="/shop/">Shop</a><a href="/tool/">Finder</a><a href="/about/">About</a><a href="/faq/">FAQ</a></nav></header>

<section class="hero">
<h1>Brain Sheets That Fit Your Assignment</h1>
<p>Blueprint-grade templates for float pool, travel, and night-shift nurses. Editable, specific, built for real shifts — not generic PDFs that don't work.</p>
<a href="/shop/" class="hero-cta">Browse All Templates →</a>
</section>

<section class="featured">
<h2>Featured Templates</h2>
<div class="featured-grid">
<div class="featured-card">
<span class="badge">Best Seller</span>
<h3>ICU 2-Patient Brain Sheet</h3>
<p>Deep-detail layout with 74 fillable fields, systems report rows, and drip/vent tracking. For critical care assignments that need room, not lanes.</p>
<a href="/sheets/icu-2-patient-brain-sheet-fillable-pdf/">View Template →</a>
</div>
<div class="featured-card">
<span class="badge">Night Shift</span>
<h3>Med-Surg 5-Patient Night Sheet</h3>
<p>Task-grid layout with pending list first. 62 editable cells for 5-patient night assignments. Built for quiet hours and solo coverage.</p>
<a href="/sheets/med-surg-5-patient-night-brain-sheet-excel/">View Template →</a>
</div>
<div class="featured-card">
<span class="badge">Travel Week 1</span>
<h3>Float-Pool Week-1 Orientation</h3>
<p>All 6 orientation boxes: phone tree, unit map, code cart, supply notes, charge nurse, preceptor questions. For first week on a new unit.</p>
<a href="/sheets/float-pool-week-1-brain-sheet-goodnotes/">View Template →</a>
</div>
</div>
</section>

<section class="trust">
<div class="trust-grid">
<div class="trust-item">
<h3>⚡ Fully Editable</h3>
<p>PDF, Excel, Sheets, GoodNotes — fill it your way, save changes, print clean.</p>
</div>
<div class="trust-item">
<h3>🎯 Assignment-Specific</h3>
<p>Every template sized for 1-8 patients. No more generic grids that waste space.</p>
</div>
<div class="trust-item">
<h3>📋 SBAR-Ready</h3>
<p>Handoff strips follow AHRQ TeamSTEPPS structure. Report faster at shift change.</p>
</div>
<div class="trust-item">
<h3>🔒 No Locked PDFs</h3>
<p>Every field is editable. Buy once, use forever, customize for your unit.</p>
</div>
</div>
</section>

<section class="shop-preview">
<div class="shop-preview-inner">
<h2>Browse All 40 Templates</h2>
<p>10 units, 5 formats, 3 tiers. Paginated 30 per page so you can find what fits.</p>
<a href="/shop/" class="btn">Shop All Templates →</a>
</div>
</section>

<footer class="site"><p>ShiftSpec — hyper-specific, fully editable nurse brain-sheet specs. Organization aids, not clinical guidance; follow your facility's policy.</p><p><a href="/about/">About</a> · <a href="/contact/">Contact</a> · <a href="/privacy/">Privacy</a> · <a href="/faq/">FAQ</a> · <a href="/changelog/">Changelog</a></p></footer>
</body>
</html>`;

writeFileSync("dist/index.html", home);
console.log("✓ Premium homepage created");