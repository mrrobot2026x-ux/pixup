const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'pixup-secret', resave: false, saveUninitialized: false }));

// Data save karne ke liye temporary memory
let uploadsDB = [];
let adsDB = {
    header: { type: 'html', code: '', active: false },
    top_banner: { type: 'html', code: '', active: false },
    mid_banner: { type: 'html', code: '', active: false },
    result_banner: { type: 'html', code: '', active: false },
    footer_banner: { type: 'html', code: '', active: false },
    popunder: { type: 'html', code: '', active: false }
};

// Password hash (Password hai: admin123)
const ADMIN_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// APIs
app.post('/api/login', (req, res) => {
    if (req.body.username === 'admin' && bcrypt.compareSync(req.body.password, ADMIN_HASH)) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Galat password' });
});

app.get('/api/ads', (req, res) => res.json(adsDB));

app.post('/api/admin/ads', (req, res) => {
    if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
    adsDB[req.body.slot] = { type: req.body.type, code: req.body.code, active: req.body.active };
    res.json({ success: true });
});

app.post('/api/save-upload', (req, res) => {
    uploadsDB.unshift({ url: req.body.url, time: new Date() });
    res.json({ success: true });
});

app.get('/api/admin/uploads', (req, res) => {
    if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
    res.json(uploadsDB);
});

// USER PANEL (Frontend)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>PixUp</title>
    <style>body{font-family:sans-serif;background:#0a0a0f;color:#fff;text-align:center;padding:20px}.box{background:#1a1a2e;padding:20px;border-radius:12px;max-width:400px;margin:auto;border:1px solid #333}.btn{background:#6366f1;color:#fff;padding:12px 20px;border:none;border-radius:8px;cursor:pointer;margin-top:10px;width:100%}input[type="file"]{display:none}.ad-box{margin:15px auto;min-height:60px;max-width:400px;background:#131320;border-radius:8px;display:flex;justify-content:center;align-items:center;font-size:12px;color:#555}#result{display:none;margin-top:15px}</style></head>
    <body><h1>🖼️ PixUp</h1><p>Image to URL</p><div class="ad-box" id="top_ad"></div>
    <div class="box"><label for="file" class="btn">Select Image</label><input type="file" id="file" accept="image/*" onchange="document.getElementById('name').innerText=this.files[0].name;document.getElementById('upBtn').style.display='block'"><p id="name"></p><button id="upBtn" class="btn" style="display:none;background:#10b981" onclick="upload()">Upload Now</button>
    <div id="result"><p style="color:#aaa;font-size:12px">Direct URL:</p><input type="text" id="url" style="width:100%;padding:10px;background:#000;color:#fff;border:1px solid #333;border-radius:5px;text-align:center" readonly><button class="btn" style="background:#3b82f6" onclick="navigator.clipboard.writeText(document.getElementById('url').value);alert('Copied!')">Copy URL</button></div></div>
    <div class="ad-box" id="mid_ad"></div>
    <script>
    async function loadAds(){try{const res=await fetch('/api/ads');const ads=await res.json();['top_banner','mid_banner'].forEach(s=>{if(ads[s].active && ads[s].code){document.getElementById(s.split('_')[0]+'_ad').innerHTML=ads[s].code;}});}catch(e){}}
    async function upload(){const file=document.getElementById('file').files[0];if(!file)return;const btn=document.getElementById('upBtn');btn.innerText='Uploading...';const fd=new FormData();fd.append('image',file);try{const res=await fetch('https://api.imgbb.com/1/upload?key=eade6a2977f7885a895468ffeee4d5a0',{method:'POST',body:fd});const data=await res.json();if(data.success){const url=data.data.display_url;document.getElementById('url').value=url;document.getElementById('result').style.display='block';btn.style.display='none';fetch('/api/save-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});}else{alert('Error');btn.innerText='Upload Now';}}catch(e){alert(e.message);btn.innerText='Upload Now';}}
    loadAds();
    </script></body></html>
    `);
});

// ADMIN PANEL (Frontend)
app.get('/admin', (req, res) => {
    if (!req.session.isAdmin) {
        return res.send(`
        <body style="background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <div style="background:#1a1a2e;padding:30px;border-radius:12px;width:300px;border:1px solid #333;text-align:center">
        <h2>Admin Login</h2><input type="password" id="p" placeholder="Password (admin123)" style="width:100%;padding:10px;margin:10px 0;background:#000;color:#fff;border:1px solid #333;border-radius:5px">
        <button onclick="login()" style="width:100%;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:5px;cursor:pointer">Login</button></div>
        <script>async function login(){const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:document.getElementById('p').value})});if(res.ok)location.reload();else alert('Galat Password');}</script></body>
        `);
    }

    res.send(`
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin Dashboard</title>
    <style>body{font-family:sans-serif;background:#0a0a0f;color:#fff;padding:20px}.card{background:#1a1a2e;padding:20px;border-radius:12px;margin-bottom:20px;border:1px solid #333}textarea{width:100%;height:100px;background:#000;color:#fff;border:1px solid #333;padding:10px;border-radius:5px;box-sizing:border-box;margin-top:5px}button{background:#10b981;color:#fff;border:none;padding:10px;border-radius:5px;cursor:pointer;margin-top:10px;width:100%}</style></head>
    <body><h1>Admin Panel</h1>
    <div id="ads"></div>
    <div class="card"><h3>Uploads History</h3><div id="history" style="max-height:200px;overflow-y:auto;font-size:12px"></div></div>
    <script>
    const slots=['header','top_banner','mid_banner','result_banner','footer_banner','popunder'];
    async function load(){const res=await fetch('/api/ads');const ads=await res.json();
    document.getElementById('ads').innerHTML=slots.map(s=>\`<div class="card"><b>\${s.toUpperCase()}</b><br>
    <label><input type="checkbox" id="act_\${s}" \${ads[s].active?'checked':''}> Active</label>
    <select id="type_\${s}" style="background:#000;color:#fff;padding:5px;margin-left:10px"><option value="html" \${ads[s].type==='html'?'selected':''}>HTML</option><option value="url" \${ads[s].type==='url'?'selected':''}>URL</option></select>
    <textarea id="code_\${s}">\${ads[s].code}</textarea>
    <button onclick="save('\${s}')">Save Ad</button></div>\`).join('');
    const hRes=await fetch('/api/admin/uploads');const hist=await hRes.json();
    document.getElementById('history').innerHTML=hist.map(h=>\`<div style="border-bottom:1px solid #333;padding:5px 0"><a href="\${h.url}" target="_blank" style="color:#6366f1;word-break:break-all">\${h.url}</a></div>\`).join('');}
    async function save(slot){const type=document.getElementById('type_'+slot).value;const code=document.getElementById('code_'+slot).value;const active=document.getElementById('act_'+slot).checked;await fetch('/api/admin/ads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot,type,code,active})});alert('Ad Saved!');}
    load();
    </script></body></html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
