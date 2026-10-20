const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const config = require('./config');

const app = express();
const db = new Database('database.sqlite');

db.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_url TEXT NOT NULL,
        user_ip TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ads (
        slot TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'html',
        code TEXT,
        is_active INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

const adSlots = ['header', 'top_banner', 'mid_banner', 'result_banner', 'footer_banner', 'popunder'];
const insertAd = db.prepare(`INSERT OR IGNORE INTO ads (slot, type, code, is_active) VALUES (?, 'html', '', 0)`);
adSlots.forEach(slot => insertAd.run(slot));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function isAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
    return res.redirect('/admin');
}

app.get('/admin', (req, res) => {
    if (req.session.isAdmin) return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === config.ADMIN_USERNAME && bcrypt.compareSync(password, config.ADMIN_PASSWORD_HASH)) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, error: 'Invalid username or password' });
});

app.post('/api/admin/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/admin/ads', isAdmin, (req, res) => {
    const ads = db.prepare('SELECT * FROM ads').all();
    const map = {}; ads.forEach(a => map[a.slot] = a); res.json(map);
});

app.post('/api/admin/ads/:slot', isAdmin, (req, res) => {
    const { slot } = req.params;
    const { type, code, is_active } = req.body;
    if (!adSlots.includes(slot) || !['script', 'url', 'html'].includes(type)) return res.status(400).json({ error: 'Invalid' });
    db.prepare(`UPDATE ads SET type = ?, code = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE slot = ?`)
      .run(type, code || '', is_active ? 1 : 0, slot);
    res.json({ success: true });
});

app.get('/api/admin/uploads', isAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM uploads ORDER BY created_at DESC LIMIT 500').all());
});

app.delete('/api/admin/uploads/:id', isAdmin, (req, res) => {
    db.prepare('DELETE FROM uploads WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.get('/api/ads', (req, res) => {
    const ads = db.prepare('SELECT slot, type, code FROM ads WHERE is_active = 1 AND code != ""').all();
    const map = {}; ads.forEach(a => map[a.slot] = { type: a.type, code: a.code }); res.json(map);
});

app.post('/api/save-upload', (req, res) => {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'URL required' });
    db.prepare('INSERT INTO uploads (image_url, user_ip, user_agent) VALUES (?, ?, ?)')
      .run(image_url, req.ip, req.headers['user-agent'] || '');
    res.json({ success: true });
});

app.get('/api/admin/stats', isAdmin, (req, res) => {
    const totalUploads = db.prepare('SELECT COUNT(*) as c FROM uploads').get().c;
    const todayUploads = db.prepare("SELECT COUNT(*) as c FROM uploads WHERE DATE(created_at) = DATE('now')").get().c;
    const activeAds = db.prepare('SELECT COUNT(*) as c FROM ads WHERE is_active = 1 AND code != ""').get().c;
    res.json({ totalUploads, todayUploads, activeAds });
});

app.listen(3000, () => {
    console.log('\n✅ Server running!\n🌐 User Panel: http://localhost:3000\n🔐 Admin: http://localhost:3000/admin\n');
});
