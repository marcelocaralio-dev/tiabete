#!/usr/bin/env python3
"""Registro rastreável da migração GLUXO: aponta os vermelhos INSTITUCIONAIS/FUNCIONAIS de interface para os tokens --brand*.
Só mexe nas linhas listadas (classificadas na auditoria). Vermelhos clínicos (glicemia, alertas de saúde, gráficos) não constam aqui.
Idempotente: rodar de novo não muda nada. Uso: python3 scripts/gluxo-repoint.py [--check]"""
import re, sys, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
MAP = [(r'var\(--red-d2', 'var(--brand-d2'), (r'var\(--red-d\b', 'var(--brand-d'), (r'var\(--red-rgb\)', 'var(--brand-rgb)'), (r'var\(--red-l\b', 'var(--brand-l'), (r'var\(--red-t\b', 'var(--brand-t'), (r'var\(--red\b', 'var(--brand')]
RGB = [(r'rgba\(var\(--red-rgb\)', 'rgba(var(--brand-rgb)')]
L = {
 'src/acchat.css': [4, 13, 17, 22, 23, 28, 29],
 'src/analise.css': [16],
 'src/bolus2.css': [5, 6, 46],
 'src/buttons.css': [19, 20, 23, 24, 30, 32, 37, 41, 44, 47, 49, 54, 55, 56, 57, 58, 59, 63, 64, 65, 80],
 'src/cards.css': [39, 59, 72, 78],
 'src/ds.css': [38, 50, 63, 68, 70, 79, 80, 81, 87, 100, 101, 129, 138, 161, 167, 172, 179, 180, 183, 190, 191, 195, 197, 210, 216, 227, 232, 245],
 'src/inicio.css': [8, 34],
 'src/layout.css': [19, 26],
 'src/metricas.css': [332, 335],
 'src/neon.css': [37, 40, 41],
 'src/premium.css': [20],
 'src/ptr.css': [8, 9],
 'src/readmore.css': [3, 6],
 'src/uipicker.css': [8, 14, 16, 34],
 'src/style.css': [39, 51, 52, 64, 73, 75, 98, 100, 101, 112, 119, 122, 124, 127, 191, 193, 206, 210, 239, 263, 301, 302, 342, 477, 622, 628, 629, 644, 645, 654, 661, 774, 776, 789, 815, 826, 925, 927, 928, 931, 941, 979, 983, 985, 996, 997, 1006, 1012, 1087, 1099, 1138, 1143, 1179],
}
# JS/CSS embutido (apenas elementos institucionais: IA, abertura, avatar padrão)
J = {'native/ai-ui.js': [272, 277, 281, 282, 286, 287, 292], 'native/login.js': [17], 'src/extras.js': [1295]}
def conv(line):
    o = line
    for a, b in MAP: line = re.sub(a, b, line)
    line = line.replace('--red-rgb', '--brand-rgb') if '--brand-rgb' in line or 'rgba(var(--red-rgb' in line else line
    return line
changed = 0
for tbl in (L, J):
    for f, nums in tbl.items():
        p = os.path.join(ROOT, f); lines = open(p, encoding='utf8').read().split('\n')
        for n in nums:
            new = conv(lines[n - 1])
            if new != lines[n - 1]:
                changed += 1
                if '--check' not in sys.argv: lines[n - 1] = new
        if '--check' not in sys.argv: open(p, 'w', encoding='utf8').write('\n'.join(lines))
print('linhas migradas:', changed)
