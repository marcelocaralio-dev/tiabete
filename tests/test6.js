// Ícone das notificações: gota oficial, máscara branca/transparente, configurado para o Capacitor.
const fs = require('fs'), path = require('path'); let ok = true; const chk = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) ok = false; };
const root = path.join(__dirname, '..'), cfg = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
chk(cfg.plugins && cfg.plugins.LocalNotifications && cfg.plugins.LocalNotifications.smallIcon === 'ic_stat_tiabete', 'smallIcon configurado');
chk(/^#FF2E3E$/i.test(cfg.plugins.LocalNotifications.iconColor), 'cor de destaque = vermelho da gota oficial');
const sizes = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };
for (const [d, s] of Object.entries(sizes)) {
  const b = fs.readFileSync(path.join(root, 'assets', 'notification', `ic_stat_tiabete-${d}.png`));
  chk(b.slice(1, 4).toString() === 'PNG' && b.readUInt32BE(16) === s && b.readUInt32BE(20) === s && b[25] === 6, `${d}: PNG RGBA ${s}x${s}`);
}
const patch = fs.readFileSync(path.join(root, 'scripts', 'patch-android.js'), 'utf8');
chk(/ic_stat_tiabete/.test(patch) && /drawable-/.test(patch), 'patch-android instala os ícones');
const svg = fs.readFileSync(path.join(root, 'assets', 'tiabete-icone.svg'), 'utf8');
chk(svg.includes('M50 4 C50 4 14 44 14 66 A36 36 0 0 0 86 66 C86 44 50 4 50 4 Z'), 'gota oficial presente no SVG de referência');
const js = fs.readFileSync(path.join(root, 'native', 'native.js'), 'utf8');
chk(!/smallIcon\s*:/.test(js), 'nenhuma notificação define outro ícone (todas usam o padrão da gota)');
console.log(ok ? 'tudo certo' : 'HÁ FALHAS'); process.exit(ok ? 0 : 1);
