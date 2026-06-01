const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join("/tmp", "uploads");
const OUTPUTS_DIR = path.join("/tmp", "outputs");
[UPLOADS_DIR, OUTPUTS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/outputs", express.static(OUTPUTS_DIR));

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /\.(glb|usdz)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(new Error("Only .glb and .usdz files are allowed"));
  },
});

// ── AR page builder ───────────────────────────────────────────────────────────
function buildARPage(slug, brand, label) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${brand}</title>
  <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --amber: #C8873A; --bg: #111009; --surface: #1A1812;
      --border: rgba(200,135,58,0.15); --border-dim: rgba(255,255,255,0.06);
      --text: #F2EDE4; --muted: rgba(242,237,228,0.45); --cream: #F2EDE4;
    }
    html, body { height: 100%; width: 100%; overflow: hidden; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
    model-viewer { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; top: 0; left: 0; }
    .page { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; padding: max(env(safe-area-inset-top),22px) 28px max(env(safe-area-inset-bottom),30px); }
    .top-label { display: flex; align-items: center; gap: 10px; animation: fadeDown .6s ease both; }
    .top-line { flex: 1; height: 1px; max-width: 40px; background: var(--border); }
    .top-text { font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: var(--amber); opacity: .85; }
    .title-block { text-align: center; margin-top: 16px; animation: fadeDown .6s .1s ease both; }
    .dish-name { font-family: 'Cormorant Garamond', serif; font-size: clamp(44px,13vw,62px); font-weight: 600; line-height: 1; color: var(--cream); }
    .dish-sub { font-size: 12.5px; color: var(--muted); margin-top: 8px; letter-spacing: .04em; }
    .center-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
    .tap-hint { font-size: 11px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin-bottom: 24px; animation: fadeIn .8s .5s ease both; }
    .ar-circle-btn { position: relative; width: min(66vw,270px); height: min(66vw,270px); border-radius: 50%; background: none; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent; display: flex; align-items: center; justify-content: center; animation: fadeIn .7s .2s ease both; }
    .ring-slow { position: absolute; inset: -18px; border-radius: 50%; border: 1px solid rgba(200,135,58,.12); animation: breathe-ring 4s ease-in-out infinite; }
    .ring-slow-2 { position: absolute; inset: -36px; border-radius: 50%; border: 1px solid rgba(200,135,58,.06); animation: breathe-ring 4s .8s ease-in-out infinite; }
    .circle-face { position: relative; width: 100%; height: 100%; border-radius: 50%; border: 1px solid var(--border); background: radial-gradient(circle at 38% 32%,rgba(200,135,58,.1) 0%,transparent 55%),radial-gradient(circle at 65% 72%,rgba(200,135,58,.05) 0%,transparent 45%),var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; overflow: hidden; transition: transform .18s ease,border-color .18s ease; animation: plate-breathe 4s ease-in-out infinite; }
    .ar-circle-btn:active .circle-face { transform: scale(.96); border-color: rgba(200,135,58,.5); }
    .circle-face::after { content: ''; position: absolute; top: -40%; left: -50%; width: 35%; height: 180%; background: linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent); transform: skewX(-15deg); animation: soft-sweep 5s ease-in-out infinite; }
    .plate-rim { position: absolute; inset: 14px; border-radius: 50%; border: 1px solid rgba(200,135,58,.12); pointer-events: none; }
    .brand-area { display: flex; flex-direction: column; align-items: center; gap: 6px; z-index: 1; }
    .brand-name { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 600; letter-spacing: .18em; color: var(--cream); line-height: 1; opacity: .92; }
    .brand-divider { width: 32px; height: 1px; background: var(--border); }
    .brand-sub { font-size: 9.5px; font-weight: 600; letter-spacing: .25em; text-transform: uppercase; color: var(--amber); opacity: .8; }
    .steps { display: flex; align-items: flex-start; gap: 8px; margin-top: 32px; animation: fadeUp .6s .45s ease both; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 72px; }
    .step-num { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--amber); }
    .step-label { font-size: 10.5px; color: var(--muted); text-align: center; line-height: 1.4; }
    .step-line { width: 16px; height: 1px; background: var(--border-dim); margin-top: 12px; flex-shrink: 0; }
    .compat { margin-top: 20px; display: flex; align-items: center; gap: 12px; font-size: 10.5px; color: var(--muted); animation: fadeUp .6s .55s ease both; }
    .compat-sep { width: 2px; height: 2px; border-radius: 50%; background: var(--border); }
    @keyframes fadeDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
    @keyframes breathe-ring { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.03)} }
    @keyframes plate-breathe { 0%,100%{box-shadow:0 4px 40px rgba(200,135,58,.08)} 50%{box-shadow:0 4px 70px rgba(200,135,58,.18)} }
    @keyframes soft-sweep { 0%{left:-50%;opacity:0} 20%{opacity:1} 60%{left:130%;opacity:0} 100%{left:130%;opacity:0} }
  </style>
</head>
<body>
  <model-viewer src="${slug}.glb" ios-src="${slug}.usdz" ar ar-modes="webxr scene-viewer quick-look">
    <button slot="ar-button" id="hidden-ar-trigger" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;"></button>
  </model-viewer>
  <div class="page">
    <div class="top-label">
      <div class="top-line"></div>
      <span class="top-text">${label}</span>
      <div class="top-line"></div>
    </div>
    <div class="title-block">
      <div class="dish-name">See it<br>on your table</div>
      <div class="dish-sub">Tap to bring this to life in your space</div>
    </div>
    <div class="center-wrap">
      <div class="tap-hint">Tap to preview</div>
      <button class="ar-circle-btn" onclick="launchAR()" aria-label="Preview in AR">
        <div class="ring-slow"></div><div class="ring-slow-2"></div>
        <div class="circle-face">
          <div class="plate-rim"></div>
          <div class="brand-area">
            <div class="brand-name">${brand}</div>
            <div class="brand-divider"></div>
            <div class="brand-sub">View in AR</div>
          </div>
        </div>
      </button>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><div class="step-label">Tap the circle</div></div>
        <div class="step-line"></div>
        <div class="step"><div class="step-num">2</div><div class="step-label">Point at surface</div></div>
        <div class="step-line"></div>
        <div class="step"><div class="step-num">3</div><div class="step-label">See it appear</div></div>
      </div>
    </div>
    <div class="compat">
      <span>Works on iPhone &amp; Android</span>
      <span class="compat-sep"></span>
      <span>No app needed</span>
    </div>
  </div>
  <script>
    function launchAR() {
      const mv = document.querySelector('model-viewer');
      if (mv && mv.canActivateAR) mv.activateAR();
      else document.getElementById('hidden-ar-trigger').click();
    }
  </script>
</body>
</html>`;
}

// ── Zip helper ────────────────────────────────────────────────────────────────
function zipFolder(sourceDir, destPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destPath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function cleanup(p) {
  try {
    if (!fs.existsSync(p)) return;
    fs.statSync(p).isDirectory()
      ? fs.rmSync(p, { recursive: true, force: true })
      : fs.unlinkSync(p);
  } catch (_) {}
}

// ── GitHub API helpers ────────────────────────────────────────────────────────
async function ghRequest(endpoint, method, token, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "ar-publisher",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub API error ${res.status}`);
  return data;
}

async function publishToGitHub(token, repoName, files) {
  // 1. Get authenticated user
  const user = await ghRequest("/user", "GET", token);
  const owner = user.login;

  // 2. Create repo
  await ghRequest("/user/repos", "POST", token, {
    name: repoName,
    description: "AR experience — auto-generated by AR Publisher",
    private: false,
    auto_init: false,
  });

  // 3. Push all files via contents API
  for (const { path: filePath, content } of files) {
    await ghRequest(`/repos/${owner}/${repoName}/contents/${filePath}`, "PUT", token, {
      message: `Add ${filePath}`,
      content: Buffer.from(content).toString("base64"),
    });
  }

  // 4. Enable GitHub Pages on main branch
  try {
    await ghRequest(`/repos/${owner}/${repoName}/pages`, "POST", token, {
      source: { branch: "main", path: "/" },
    });
  } catch (_) { /* Pages may take a moment — non-fatal */ }

  return { owner, repoName, url: `https://${owner}.github.io/${repoName}/` };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Validate GitHub token
app.post("/api/validate-token", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided." });
  try {
    const user = await ghRequest("/user", "GET", token);
    res.json({ ok: true, username: user.login, avatar: user.avatar_url });
  } catch (err) {
    res.status(401).json({ ok: false, error: err.message });
  }
});

// Build AR site — download ZIP and/or push to GitHub
app.post("/api/build", upload.fields([{ name: "glb", maxCount: 1 }, { name: "usdz", maxCount: 1 }]), async (req, res) => {
  const glbFile  = req.files?.glb?.[0];
  const usdzFile = req.files?.usdz?.[0];
  const slug     = (req.body.slug  || "model").replace(/[^a-zA-Z0-9_\-]/g, "-").toLowerCase();
  const brand    = req.body.brand  || "VIEW";
  const label    = req.body.label  || "On the menu";
  const token    = req.body.token  || "";
  const pushToGH = req.body.push === "true" && token;

  if (!glbFile || !usdzFile)
    return res.status(400).json({ error: "Both a .glb and a .usdz file are required." });

  const id      = uuidv4();
  const siteDir = path.join(OUTPUTS_DIR, `site_${id}`);
  fs.mkdirSync(siteDir, { recursive: true });

  try {
    const htmlContent = buildARPage(slug, brand, label);

    // Copy model files
    fs.copyFileSync(glbFile.path,  path.join(siteDir, `${slug}.glb`));
    fs.copyFileSync(usdzFile.path, path.join(siteDir, `${slug}.usdz`));
    fs.writeFileSync(path.join(siteDir, "index.html"), htmlContent, "utf8");

    // Build ZIP for download
    const zipPath = path.join(OUTPUTS_DIR, `${slug}_${id}.zip`);
    await zipFolder(siteDir, zipPath);

    let ghResult = null;

    if (pushToGH) {
      // Read files as buffers for GitHub API
      const glbBuf  = fs.readFileSync(path.join(siteDir, `${slug}.glb`));
      const usdzBuf = fs.readFileSync(path.join(siteDir, `${slug}.usdz`));
      const repoName = `ar-${slug}-${Date.now()}`;

      ghResult = await publishToGitHub(token, repoName, [
        { path: "index.html",    content: htmlContent },
        { path: `${slug}.glb`,   content: glbBuf },
        { path: `${slug}.usdz`,  content: usdzBuf },
      ]);
    }

    cleanup(siteDir);
    cleanup(glbFile.path);
    cleanup(usdzFile.path);

    res.json({
      zipPath: `/outputs/${slug}_${id}.zip`,
      zipName: `${slug}_ar_site.zip`,
      github: ghResult,
    });

  } catch (err) {
    cleanup(siteDir);
    res.status(500).json({ error: err.message });
  }
});

// Cleanup files older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  try {
    [UPLOADS_DIR, OUTPUTS_DIR].forEach(dir =>
      fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).mtimeMs < cutoff) cleanup(p);
      })
    );
  } catch (_) {}
}, 15 * 60 * 1000);

app.listen(PORT, () => console.log(`AR Publisher running on port ${PORT}`));
