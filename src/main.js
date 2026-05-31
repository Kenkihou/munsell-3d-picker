import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// npmモジュールの仕様の違いを安全に吸収するための両構えインポート
import * as munsellModule from 'munsell';
import munsellDefault from 'munsell';

// --- 1. CSSスタイルの動的注入 ---
const style = document.createElement('style');
style.textContent = `
    body { margin: 0; overflow: hidden; background-color: #1a1a1a; font-family: sans-serif; color: white; }
    
    /* --- 3D描画領域（画面上半分） --- */
    #canvas-wrapper {
        position: absolute; top: 0; left: 0; width: 100vw; height: 50vh; z-index: 1;
    }
    #canvas-container {
        width: 100%; height: 100%;
    }

    /* --- 画面下部のUI全体をまとめるラッパー（明確な3列構成） --- */
    #bottom-ui-wrapper {
        position: absolute; bottom: 30px; left: 0; width: 100vw;
        display: flex; justify-content: center; align-items: flex-end; gap: 40px;
        z-index: 10; pointer-events: none;
    }

    /* --- 第1列（左）：情報パネル、手入力、建材色 --- */
    #col-info {
        display: flex; flex-direction: column; gap: 15px;
        pointer-events: auto; width: 250px; 
    }

    /* --- 第2列（中央）：色相ダイヤル --- */
    #col-wheel {
        position: relative; pointer-events: auto;
        display: flex; justify-content: center; align-items: center;
        width: 200px;
        padding-bottom: 50px;
    }

    /* --- 第3列（右）：カラーパレット --- */
    #col-palette {
        position: relative; pointer-events: none;
        margin-left: 60px; 
    }

    /* --- 共通ツールチップ（ふきだし）スタイル --- */
    .tooltip-box {
        position: absolute;
        background: rgba(30, 30, 30, 0.95); border: 1px solid #777; padding: 8px 12px; border-radius: 6px;
        font-size: 13px; color: #eee; white-space: nowrap; opacity: 0; visibility: hidden;
        transition: all 0.2s ease; pointer-events: none; z-index: 100; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    }
    .tooltip-box::after {
        content: ''; position: absolute; border-style: solid;
    }

    /* キャンバス用ツールチップ（画面右上隅に固定） */
    .canvas-tooltip {
        top: 20px; right: 20px; left: auto; transform: translateY(-10px);
    }
    .canvas-tooltip::after {
        bottom: 100%; right: 20px;
        border-width: 6px; border-color: transparent transparent #777 transparent;
    }
    #canvas-wrapper:hover .canvas-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }

    /* ダイヤル用ツールチップ */
    .wheel-tooltip {
        bottom: calc(100% + 15px); left: 50%; transform: translateX(-50%) translateY(5px);
    }
    .wheel-tooltip::after {
        top: 100%; left: 50%; transform: translateX(-50%);
        border-width: 6px; border-color: #777 transparent transparent transparent;
    }
    #col-wheel:hover .wheel-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }

    /* フォーム用ツールチップ */
    .manual-tooltip {
        bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(5px); font-size: 12px;
    }
    .manual-tooltip::after {
        top: 100%; left: 50%; transform: translateX(-50%);
        border-width: 6px; border-color: #777 transparent transparent transparent;
    }
    .manual-controls:hover .manual-tooltip { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }

    /* ★ 新設：画面右下のホバーメッセージボックス */
    #hover-message-box {
        position: absolute;
        bottom: 30px;
        right: 30px;
        background: rgba(20, 20, 20, 0.95);
        border: 1px solid #555;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 15px;
        color: #deff9a;
        font-weight: bold;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 100;
        box-shadow: 0 4px 15px rgba(0,0,0,0.7);
        pointer-events: none;
    }

    /* --- 個別コンポーネントスタイル --- */
    /* 1. ダイヤル */
    #wheel-container {
        position: relative; width: 180px; height: 180px; border-radius: 50%;
        background: conic-gradient(from 0deg, #e41a25 0%, #ff7521 10%, #f8be00 20%, #a5c000 30%, #009173 40%, #008177 50%, #0e88a0 60%, #0054a7 70%, #9b56b0 80%, #c935ba 90%, #e41a25 100%);
        box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 4px solid #333; touch-action: none; cursor: grab;
    }
    #wheel-container:active { cursor: grabbing; }
    #wheel-center {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 110px; height: 110px; background: #1a1a1a; border-radius: 50%; border: 4px solid #333;
        display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: none; 
    }
    #wheel-knob-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    #wheel-knob { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 18px; height: 18px; background: #fff; border-radius: 50%; box-shadow: 0 0 5px rgba(0,0,0,0.8); border: 2px solid #222; }
    #hue-display { color: #deff9a; font-size: 22px; font-weight: bold; margin-top: 2px; }
    .hue-label { font-size: 13px; color: #aaa; }

    /* 2. 情報パネル */
    #color-info-panel {
        background: rgba(0, 0, 0, 0.85); padding: 14px 16px; border-radius: 12px;
        border: 1px solid #444; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .info-row { font-size: 13px; margin-bottom: 6px; color: #ccc; }
    .info-val { color: #fff; font-weight: bold; margin-left: 6px; }
    #selected-color-box { width: 100%; height: 35px; margin-top: 10px; border: 1px solid #555; border-radius: 6px; transition: background-color 0.2s; }

    /* 3. 手入力フォーム */
    #manual-input-panel {
        position: relative; background: rgba(0, 0, 0, 0.85); padding: 14px 16px; border-radius: 12px;
        border: 1px solid #444; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; gap: 8px;
    }
    .manual-title { font-size: 13px; color: #aaa; margin-bottom: 2px; font-weight: bold; } 
    .manual-controls { display: flex; justify-content: space-between; align-items: center; width: 100%; position: relative; }
    .manual-input { background: #111; color: #fff; border: 1px solid #555; border-radius: 4px; padding: 6px; font-size: 14px; text-align: center; }
    #in-h-val { width: 44px; } #in-h-type { width: 54px; cursor: pointer; } #in-v { width: 44px; } #in-c { width: 44px; }
    .manual-input:focus { border-color: #deff9a; outline: none; }

    /* 4. 建材色パネル */
    #preset-panel {
        background: rgba(0, 0, 0, 0.85); padding: 14px 16px; border-radius: 12px;
        border: 1px solid #444; width: 100%; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; gap: 8px;
    }
    #preset-select {
        background: #111; color: #fff; border: 1px solid #555; border-radius: 4px;
        padding: 6px; font-size: 14px; cursor: pointer; width: 100%; text-align: center;
    }
    #preset-select:focus { border-color: #deff9a; outline: none; }

    /* --- パレット --- */
    #palette-container { position: relative; width: 580px; height: 450px; pointer-events: none; }
    .color-chip { position: absolute; width: 40px; height: 40px; border-radius: 6px; cursor: pointer; pointer-events: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); transition: transform 0.1s, border 0.1s; }
    .color-chip:hover { transform: scale(1.15); z-index: 20; border: 1px solid #fff; }
    .axis-label { position: absolute; color: #aaa; font-size: 13px; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; pointer-events: none; }
    .axis-title { position: absolute; color: #deff9a; font-size: 14px; font-weight: bold; pointer-events: none; }
    .vertical-title { writing-mode: vertical-rl; letter-spacing: 2px; }

    /* ロード画面 */
    #loading-screen { position: absolute; top:0; left:0; width:100vw; height:100vh; background:#111; z-index:100; display:flex; flex-direction:column; justify-content:center; align-items:center; font-size:20px; transition: opacity 0.3s; }
    #error-message { color: #ff5555; font-size: 16px; margin-top: 20px; text-align: center; max-width: 80%; }
`;
document.head.appendChild(style);

// --- 2. HTML要素の動的生成 ---
document.body.innerHTML = `
    <div id="loading-screen">
        <div>Munsell 限界形状データを生成中...</div>
        <div id="error-message"></div>
    </div>
    
    <div id="canvas-wrapper">
        <div id="canvas-container"></div>
        <div class="tooltip-box canvas-tooltip">🖱️ 立方体の面をクリックして色を変える面を選択、関係ないところをクリックで選択解除</div>
    </div>

    <div id="bottom-ui-wrapper">
        
        <div id="col-info">
            <div id="color-info-panel">
                <div class="info-row">Munsell:<span id="info-munsell" class="info-val">-</span></div>
                <div class="info-row">HEX:<span id="info-hex" class="info-val">-</span></div>
                <div class="info-row">RGB:<span id="info-rgb" class="info-val">-</span></div>
                <div id="selected-color-box"></div>
            </div>

            <div id="manual-input-panel">
                <div class="manual-title">手入力 (Munsell)</div>
                <div class="manual-controls">
                    <div class="tooltip-box manual-tooltip">🖱️ フォームをクリック後、手入力、▲▼のクリック、<br>マウスホイールのどれでも入力可能</div>
                    <input type="number" id="in-h-val" class="manual-input" placeholder="2.5" step="0.1" min="0" max="10">
                    <select id="in-h-type" class="manual-input">
                        <option value="R">R</option><option value="YR">YR</option>
                        <option value="Y">Y</option><option value="GY">GY</option>
                        <option value="G">G</option><option value="BG">BG</option>
                        <option value="B">B</option><option value="PB">PB</option>
                        <option value="P">P</option><option value="RP">RP</option>
                    </select>
                    <input type="number" id="in-v" class="manual-input" placeholder="V" step="0.1" min="0" max="10">
                    <input type="number" id="in-c" class="manual-input" placeholder="C" step="0.1" min="0">
                </div>
            </div>

            <div id="preset-panel">
                <div class="manual-title">建材色 (定番サンプリング)</div>
                <select id="preset-select">
                    <option value="">-- 色を選択してください --</option>
                    <option value="N 4">いぶし銀</option>
                    <option value="N 2">ギングロ</option>
                    <option value="5Y 6.5/1">シャイングレー</option>
                    <option value="7.5YR 5.5/1">ステンカラー</option>
                    <option value="N 1.5">ブラック</option>
                </select>
            </div>
        </div>

        <div id="col-wheel">
            <div class="tooltip-box wheel-tooltip">🖱️ ドラッグ操作で色相を調整</div>
            <div id="wheel-container">
                <div id="wheel-knob-container">
                    <div id="wheel-knob"></div>
                </div>
                <div id="wheel-center">
                    <div class="hue-label">色相 (Hue)</div>
                    <div id="hue-display">-</div>
                </div>
            </div>
        </div>

        <div id="col-palette">
            <div id="palette-container"></div>
        </div>

    </div>

    <div id="hover-message-box"></div>
`;

// --- 3. 境界線（デコボコ）の型枠データの定義 ---
const principalBounds = [
    [2, 4, 8, 14, 14, 14, 10, 8, 4],   // 0: 5R
    [2, 4, 6, 10, 12, 14, 12, 10, 6],  // 1: 5YR
    [2, 4, 4, 6, 8, 10, 12, 14, 10],   // 2: 5Y
    [2, 4, 6, 8, 10, 12, 12, 12, 6],   // 3: 5GY
    [2, 4, 6, 8, 10, 10, 10, 8, 4],    // 4: 5G
    [2, 4, 6, 8, 8, 10, 8, 6, 4],      // 5: 5BG
    [2, 4, 6, 8, 8, 8, 8, 6, 4],       // 6: 5B
    [2, 6, 12, 12, 10, 8, 8, 6, 4],    // 7: 5PB
    [2, 6, 12, 12, 12, 12, 10, 6, 4],  // 8: 5P
    [2, 4, 10, 12, 14, 14, 12, 8, 4]   // 9: 5RP
];

function getMaxChroma(hueIndex, v) {
    const vIdx = v - 1;
    let leftP = Math.floor((hueIndex - 1) / 4);
    if (hueIndex === 0) leftP = 9;
    let rightP = (leftP + 1) % 10;
    let distFromLeft = hueIndex - (leftP * 4 + 1);
    if (distFromLeft < 0) distFromLeft += 40;
    const ratio = distFromLeft / 4;
    const c1 = principalBounds[leftP][vIdx];
    const c2 = principalBounds[rightP][vIdx];
    let maxC = Math.round((c1 * (1 - ratio) + c2 * ratio) / 2) * 2;
    return Math.max(2, maxC);
}

const neutralHexLut = { 
    1: "#1f1f1f", 2: "#323232", 3: "#484848", 4: "#5e5e5e", 5: "#767676", 
    6: "#8f8f8f", 7: "#a9a9a9", 8: "#c4c4c4", 9: "#e0e0e0" 
};

// --- 4. 40色相マスタの構築 ---
const huePrefixes = ["R", "YR", "Y", "GY", "G", "BG", "B", "PB", "P", "RP"];
const hueSteps = [2.5, 5, 7.5, 10];
const allHues = [];
huePrefixes.forEach(prefix => hueSteps.forEach(step => allHues.push(`${step}${prefix}`)));

const munsellTreeCache = {};
let loadError = null;

function getMunsellHexSafe(munsellStr) {
    const obj = munsellModule || munsellDefault;
    let res = null;

    if (obj && typeof obj.munsellToRgb255 === 'function') res = obj.munsellToRgb255(munsellStr);
    else if (obj && typeof obj.munsellToHex === 'function') res = obj.munsellToHex(munsellStr);
    else if (typeof munsellDefault === 'function') res = munsellDefault(munsellStr);

    if (Array.isArray(res) && res.length >= 3) {
        return "#" + res.slice(0, 3).map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
    } else if (typeof res === 'string' && res.startsWith('#')) return res;
    return null;
}

try {
    allHues.forEach((hue, hueIndex) => {
        munsellTreeCache[hue] = {};
        for (let v = 1; v <= 9; v++) {
            const maxC = getMaxChroma(hueIndex, v);
            for (let c = 1; c <= maxC; c++) {
                const hexColor = getMunsellHexSafe(`${hue} ${v}/${c}`);
                if (hexColor) {
                    if (!munsellTreeCache[hue][v]) munsellTreeCache[hue][v] = {};
                    munsellTreeCache[hue][v][c] = hexColor;
                }
            }
        }
    });
} catch (err) {
    loadError = err.message;
    console.error(err);
}

const loader = document.getElementById('loading-screen');
if (loadError) {
    document.getElementById('error-message').textContent = `エラー: ${loadError}`;
} else {
    if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 300); }
}

// --- 5. Three.js 環境の構築（空と雲の追加） ---
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();

function createSkyBox() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0.0, "#2b6fb8"); 
    gradient.addColorStop(0.4, "#63a4ff"); 
    gradient.addColorStop(0.6, "#bce6ff"); 
    gradient.addColorStop(1.0, "#f0f9ff"); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawCloud = (x, y, s) => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.beginPath();
        ctx.arc(x, y, 40*s, 0, Math.PI*2);
        ctx.arc(x+50*s, y-20*s, 50*s, 0, Math.PI*2);
        ctx.arc(x+100*s, y, 40*s, 0, Math.PI*2);
        ctx.arc(x+50*s, y+10*s, 30*s, 0, Math.PI*2);
        ctx.fill();
    };

    for(let i=0; i<15; i++) {
        const cx = Math.random() * canvas.width;
        const cy = 250 + Math.random() * 300; 
        const scale = 0.5 + Math.random() * 1.5;
        drawCloud(cx, cy, scale);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const skyGeo = new THREE.SphereGeometry(80, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
    return new THREE.Mesh(skyGeo, skyMat);
}

scene.add(createSkyBox());

const renderWidth = window.innerWidth;
const renderHeight = window.innerHeight / 2;

const camera = new THREE.PerspectiveCamera(45, renderWidth / renderHeight, 0.1, 100);
// ★ カメラの初期アングルを調整（斜め上から均等に見下ろす角度へ）
camera.position.set(5.5, 4.5, 6.5); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(renderWidth, renderHeight);
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.addEventListener('change', requestRender);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const targetGeometry = new THREE.BoxGeometry(4, 4, 4);
const faceMaterials = Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
const targetCube = new THREE.Mesh(targetGeometry, faceMaterials);
scene.add(targetCube);

let activeMaterialIndex = null;

const indicatorGroup = new THREE.Group();
const coneGeo = new THREE.ConeGeometry(0.5, 1.2, 16);
coneGeo.rotateX(Math.PI / 2);
const coneMat = new THREE.MeshStandardMaterial({ color: 0xdeff9a, roughness: 0.2, emissive: 0x334400 });
const indicatorMesh = new THREE.Mesh(coneGeo, coneMat);
indicatorGroup.add(indicatorMesh);
indicatorGroup.visible = false;
scene.add(indicatorGroup);

let indicatorBasePos = new THREE.Vector3();
let indicatorNormal = new THREE.Vector3();
let indicatorTarget = new THREE.Vector3();

// --- UI一括更新 ---
function updateColorDisplay(munsellStr, hexColor) {
    document.getElementById('info-munsell').textContent = munsellStr;
    document.getElementById('info-hex').textContent = hexColor;
    
    if (hexColor && hexColor.length === 7) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        document.getElementById('info-rgb').textContent = `rgb(${r}, ${g}, ${b})`;
    } else {
        document.getElementById('info-rgb').textContent = "-";
    }

    document.getElementById('selected-color-box').style.backgroundColor = hexColor;
    
    if (activeMaterialIndex !== null) {
        targetCube.material[activeMaterialIndex].color.set(hexColor);
    }
    
    if (munsellStr.startsWith('N ')) {
        const v = munsellStr.split(' ')[1];
        const currentHueStr = allHues[currentHueIndex];
        const hMatch = currentHueStr.match(/^([0-9.]+)([a-zA-Z]+)$/);
        if (hMatch) {
            document.getElementById('in-h-val').value = hMatch[1];
            document.getElementById('in-h-type').value = hMatch[2];
        }
        document.getElementById('in-v').value = v;
        document.getElementById('in-c').value = '0';
        
    } else if (munsellStr !== "キューブから取得" && munsellStr !== "-") {
        const match = munsellStr.match(/^([0-9.]+)([a-zA-Z]+)\s+([0-9.]+)\/([0-9.]+)$/);
        if (match) {
            document.getElementById('in-h-val').value = match[1];
            document.getElementById('in-h-type').value = match[2];
            document.getElementById('in-v').value = match[3];
            document.getElementById('in-c').value = match[4];
        }
    }

    requestRender();
}

// --- 6. 2D座標軸パレット描画処理 ---
const paletteContainer = document.getElementById('palette-container');
const hoverMessageBox = document.getElementById('hover-message-box');
const CHIP_SIZE = 40;
const CHIP_GAP = 4;
const STEP = CHIP_SIZE + CHIP_GAP;

// ★ 新設：チップへのホバーイベントを一括登録するヘルパー関数
function addHoverMessageEvent(chip, munsellVal) {
    chip.addEventListener('mouseenter', () => {
        hoverMessageBox.textContent = `${munsellVal} で着色できます`;
        hoverMessageBox.style.opacity = '1';
        hoverMessageBox.style.visibility = 'visible';
    });
    chip.addEventListener('mouseleave', () => {
        hoverMessageBox.style.opacity = '0';
        hoverMessageBox.style.visibility = 'hidden';
    });
}

function generateHTMLPalette(hueIndex) {
    if (loadError) return;

    paletteContainer.innerHTML = ''; 
    const hueStr = allHues[hueIndex];
    document.getElementById('hue-display').textContent = hueStr;

    // V軸（縦軸）
    const vTitle = document.createElement('div');
    vTitle.className = 'axis-title vertical-title';
    vTitle.textContent = 'Value（明度）';
    vTitle.style.left = `-70px`;
    vTitle.style.bottom = `${3.5 * STEP}px`;
    paletteContainer.appendChild(vTitle);

    for (let v = 1; v <= 9; v++) {
        const label = document.createElement('div');
        label.className = 'axis-label'; label.textContent = v; label.style.left = `-40px`; label.style.bottom = `${(v - 1) * STEP}px`;
        paletteContainer.appendChild(label);
    }

    const cTitle = document.createElement('div');
    cTitle.className = 'axis-title'; 
    cTitle.textContent = 'Chroma（彩度）'; 
    cTitle.style.left = `${STEP}px`; 
    cTitle.style.bottom = `${10 * STEP}px`;
    paletteContainer.appendChild(cTitle);

    const nLabel = document.createElement('div');
    nLabel.className = 'axis-label'; nLabel.textContent = 'N'; nLabel.style.left = `0px`; nLabel.style.bottom = `${9 * STEP}px`;
    paletteContainer.appendChild(nLabel);

    for (let c = 1; c <= 14; c++) {
        const label = document.createElement('div');
        label.className = 'axis-label'; label.textContent = c;
        label.style.left = `${c * STEP}px`; label.style.bottom = `${9 * STEP}px`;
        paletteContainer.appendChild(label);
    }

    for (let v = 1; v <= 9; v++) {
        const hexColor = neutralHexLut[v];
        const chip = document.createElement('div');
        chip.className = 'color-chip'; chip.style.backgroundColor = hexColor;
        chip.style.left = `0px`; chip.style.bottom = `${(v - 1) * STEP}px`;
        const munsellVal = `N ${v}`; chip.title = munsellVal;

        chip.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            updateColorDisplay(munsellVal, hexColor);
        });
        addHoverMessageEvent(chip, munsellVal); // ホバーイベント付与
        paletteContainer.appendChild(chip);
    }

    const hueData = munsellTreeCache[hueStr];
    if (hueData) {
        for (const vStr in hueData) {
            const v = parseInt(vStr);
            for (const cStr in hueData[v]) {
                const c = parseInt(cStr);
                if(c > 14) continue; 

                const hexColor = hueData[v][c];
                const chip = document.createElement('div');
                chip.className = 'color-chip'; chip.style.backgroundColor = hexColor;
                chip.style.left = `${c * STEP}px`; chip.style.bottom = `${(v - 1) * STEP}px`;
                const munsellVal = `${hueStr} ${v}/${c}`; chip.title = munsellVal;

                chip.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                    updateColorDisplay(munsellVal, hexColor);
                });
                addHoverMessageEvent(chip, munsellVal); // ホバーイベント付与
                paletteContainer.appendChild(chip);
            }
        }
    }
}

// --- 7. ダイヤル操作イベント ---
const wheelContainer = document.getElementById('wheel-container');
const wheelKnobContainer = document.getElementById('wheel-knob-container');
let isDraggingWheel = false;
let currentHueIndex = 0;

function updateWheelByMouse(e) {
    const rect = wheelContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let angleRad = Math.atan2(e.clientY - cy, e.clientX - cx);
    let angleDeg = angleRad * (180 / Math.PI) + 90;
    if (angleDeg < 0) angleDeg += 360;
    
    let step = Math.round(angleDeg / 9);
    if (step >= 40) step = 0;
    
    wheelKnobContainer.style.transform = `rotate(${step * 9}deg)`;
    if (currentHueIndex !== step) {
        currentHueIndex = step;
        generateHTMLPalette(step);
    }
}

wheelContainer.addEventListener('pointerdown', (e) => { isDraggingWheel = true; updateWheelByMouse(e); });
window.addEventListener('pointermove', (e) => { if (isDraggingWheel) { updateWheelByMouse(e); e.preventDefault(); } });
window.addEventListener('pointerup', () => { isDraggingWheel = false; });

generateHTMLPalette(currentHueIndex);

// --- 8. 手入力＆建材色パネルのイベント ---
const hTypeSelect = document.getElementById('in-h-type');
const presetSelect = document.getElementById('preset-select');

function applyManualInput() {
    const hVal = document.getElementById('in-h-val').value;
    const hType = hTypeSelect.value;
    const vVal = document.getElementById('in-v').value;
    const cVal = document.getElementById('in-c').value;

    if (hVal !== '' && vVal !== '' && cVal !== '') {
        const munsellStr = `${hVal}${hType} ${vVal}/${cVal}`;
        try {
            const hexColor = getMunsellHexSafe(munsellStr);
            if (hexColor) {
                document.getElementById('info-munsell').textContent = munsellStr;
                document.getElementById('info-hex').textContent = hexColor;
                if (hexColor && hexColor.length === 7) {
                    const r = parseInt(hexColor.slice(1, 3), 16);
                    const g = parseInt(hexColor.slice(3, 5), 16);
                    const b = parseInt(hexColor.slice(5, 7), 16);
                    document.getElementById('info-rgb').textContent = `rgb(${r}, ${g}, ${b})`;
                }
                document.getElementById('selected-color-box').style.backgroundColor = hexColor;
                if (activeMaterialIndex !== null) targetCube.material[activeMaterialIndex].color.set(hexColor);
                requestRender();
            }
        } catch (e) {}
    }
}

hTypeSelect.addEventListener('wheel', (e) => {
    e.preventDefault(); 
    const options = Array.from(hTypeSelect.options);
    let currentIndex = hTypeSelect.selectedIndex;
    if (e.deltaY > 0) currentIndex = (currentIndex + 1) % options.length;
    else if (e.deltaY < 0) currentIndex = (currentIndex - 1 + options.length) % options.length;
    hTypeSelect.selectedIndex = currentIndex;
    applyManualInput(); 
});

['in-h-val', 'in-h-type', 'in-v', 'in-c'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyManualInput);
});

function applyPreset() {
    const munsellStr = presetSelect.value;
    if (!munsellStr) return; 
    const hexColor = getMunsellHexSafe(munsellStr);
    if (hexColor) {
        updateColorDisplay(munsellStr, hexColor);
    }
}

presetSelect.addEventListener('change', applyPreset);

presetSelect.addEventListener('wheel', (e) => {
    e.preventDefault();
    const options = Array.from(presetSelect.options);
    let currentIndex = presetSelect.selectedIndex;
    if (e.deltaY > 0) currentIndex = (currentIndex + 1) % options.length;
    else if (e.deltaY < 0) currentIndex = (currentIndex - 1 + options.length) % options.length;
    presetSelect.selectedIndex = currentIndex;
    applyPreset();
});


// --- 9. Three.js側のクリック判定 ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(targetCube);

    if (intersects.length > 0) {
        activeMaterialIndex = intersects[0].face.materialIndex;
        
        const normal = intersects[0].face.normal.clone();
        const faceCenter = normal.clone().multiplyScalar(2);
        
        indicatorBasePos.copy(faceCenter).add(normal.clone().multiplyScalar(2.5));
        indicatorNormal.copy(normal);
        indicatorTarget.copy(faceCenter);
        indicatorGroup.visible = true;

        const currentHex = "#" + targetCube.material[activeMaterialIndex].color.getHexString();
        
        document.getElementById('info-munsell').textContent = "キューブから取得";
        document.getElementById('info-hex').textContent = currentHex;
        if (currentHex && currentHex.length === 7) {
            const r = parseInt(currentHex.slice(1, 3), 16);
            const g = parseInt(currentHex.slice(3, 5), 16);
            const b = parseInt(currentHex.slice(5, 7), 16);
            document.getElementById('info-rgb').textContent = `rgb(${r}, ${g}, ${b})`;
        }
        document.getElementById('selected-color-box').style.backgroundColor = currentHex;
        requestRender();
        
    } else {
        activeMaterialIndex = null;
        indicatorGroup.visible = false;
        
        document.getElementById('info-munsell').textContent = "-";
        document.getElementById('info-hex').textContent = "-";
        document.getElementById('info-rgb').textContent = "-";
        document.getElementById('selected-color-box').style.backgroundColor = "transparent";
        
        requestRender(); 
    }
});

window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight / 2;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    requestRender(); 
});

// --- 10. オンデマンドレンダリング ---
let renderRequested = false;

function requestRender() {
    if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(renderLoop);
    }
}

function renderLoop(time) {
    renderRequested = false;
    let needsNextFrame = false;

    if (controls.update()) {
        needsNextFrame = true;
    }

    if (indicatorGroup.visible) {
        const bounce = Math.sin(time * 0.005) * 0.4;
        indicatorGroup.position.copy(indicatorBasePos).add(indicatorNormal.clone().multiplyScalar(bounce));
        indicatorGroup.lookAt(indicatorTarget);
        needsNextFrame = true;
    }

    renderer.render(scene, camera);

    if (needsNextFrame) {
        requestRender();
    }
}

requestRender();