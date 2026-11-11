#!/usr/bin/env python3
"""final.json -> data/words.js (window.BOOK). usage: build_data.py final.json data/words.js"""
import json, re, sys
d = json.load(open(sys.argv[1]))
for L in d:
    for i, w in enumerate(L['words']):
        w['id'] = f"{L['lesson']}-{i+1}"
    for t in L['tests']:
        m = re.search(r'The (?:word|phrase)s? (.+?) in the passage', t['prompt'])
        t['target'] = m.group(1) if m else ''
out = {'title': "Barron's Essential Words for the TOEFL", 'lessons': d}
open(sys.argv[2], 'w', encoding='utf-8').write('window.BOOK=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(sum(len(l['words']) for l in d), 'words')
