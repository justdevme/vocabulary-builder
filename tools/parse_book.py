#!/usr/bin/env python3
"""Parse text extracted (pdftotext -layout) from Barron's Essential Words for the TOEFL into JSON.
usage: python3 -I parse_book.py book.txt out.json"""
import re, json, sys

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding='utf-8').read().replace('\f', '\n').split('\n')

hdr = [i for i, l in enumerate(lines) if re.fullmatch(r'\s*LESSON (\d+)\s*', l)]
POS = re.compile(r'^\s*(ph\. v|ph|v|n|adj|adv|conj|prep|pron|interj|art|det)\.\s+(.*)$')
bounds = hdr + [len(lines)]
lessons = []
issues = []

def clean(s):
    return re.sub(r'\s+', ' ', s).strip()

for bi, start in enumerate(hdr):
    num = int(re.search(r'\d+', lines[start]).group())
    block = lines[start + 1:bounds[bi + 1]]
    # split sections
    m_idx = next(i for i, l in enumerate(block) if l.strip() == 'MATCHING')
    t_idx = next(i for i, l in enumerate(block) if re.match(r'\s*LESSON \d+\s*—\s*MULTIPLE', l))
    head, match_b, test_b = block[:m_idx], block[m_idx:t_idx], block[t_idx + 1:]
    # word list (first bullets)
    words = []
    li = 0
    while li < len(head) and head[li].strip().startswith('•'):
        words += [clean(w) for w in re.findall(r'•\s*([^•]+?)(?=\s{2,}•|\s*$)', head[li])]
        li += 1
    # entries
    # skip until first word line
    entries = []
    rest = head[li:]
    # reorder: word list columns are read row-wise; entries follow alphabetical order of list
    order = sorted(words, key=lambda w: w.lower())
    pos_ = 0
    cur = None
    for l in rest:
        s = l.strip()
        if pos_ < len(words):
            nxt = [w for w in words if w not in [e['word'] for e in entries]]
        if s and not POS.match(l) and not s.startswith('syn.') and (cur is None or cur['_stage'] == 'ex') \
                and s in words and s not in [e['word'] for e in entries]:
            cur = {'word': s, 'forms': [], 'def_lines': [], 'syn': '', 'examples_raw': [], '_stage': 'pos', '_cur': None}
            entries.append(cur); continue
        if cur is None or not s:
            continue
        if cur['_stage'] == 'pos':
            if s.startswith('syn.'):
                cur['syn'] = clean(s[4:]); cur['_stage'] = 'syn'; continue
            pm = POS.match(l)
            if pm:
                cur['forms'].append([pm.group(1), clean(pm.group(2))]); cur['_cur'] = cur['forms'][-1]
            else:
                if cur['_cur'] is None: print('ODD', num, cur['word'], repr(s)); continue
                cur['_cur'][1] += ' ' + clean(s)
        elif cur['_stage'] == 'syn':
            # continuation of syn? examples start with capital letter after syn; syn continuation is lowercase
            if re.match(r'^[a-z]', s) and not cur['examples_raw']:
                cur['syn'] += ' ' + clean(s); continue
            cur['examples_raw'].append(clean(s)); cur['_stage'] = 'ex'
        else:
            cur['examples_raw'].append(clean(s))
    for e in entries:
        f = e.pop('forms')
        d = f[-1]
        e['pos'] = d[0]; e['definition'] = d[1]
        e['forms'] = [{'pos': a, 'word': b} for a, b in f[:-1]]
        e['synonyms'] = [x.strip() for x in e.pop('syn').split(';') if x.strip()]
        # group example sentences
        ex, buf = [], ''
        for ln in e.pop('examples_raw'):
            buf = (buf + ' ' + ln).strip()
            if re.search(r'[.?!]["”]?$', buf):
                ex.append(buf); buf = ''
        if buf: ex.append(buf)
        e['examples'] = ex
        e.pop('_stage'); e.pop('_cur')
        e['lesson'] = num
    if len(entries) != len(words):
        issues.append(f'L{num}: {len(entries)} entries vs {len(words)} words: missing {set(words)-{e["word"] for e in entries}}')

    # matching
    matching = []
    cur = None
    for l in match_b[1:]:
        s = l.strip()
        m = re.match(r'^(\d+)\.\s+(.+)$', s)
        if m and not s.startswith('('):
            cur = {'n': int(m.group(1)), 'word': m.group(2).strip(), 'options': []}; matching.append(cur); continue
        mo = re.match(r'^\(([A-D])\)\s*(.+)$', s)
        if mo and cur:
            cur['options'].append(mo.group(2).strip())
    for q in matching:
        if len(q['options']) != 4: issues.append(f'L{num} match {q["n"]} has {len(q["options"])} options')
    if len(matching) != 10: issues.append(f'L{num}: {len(matching)} matching qs')

    # tests
    tests = []
    cur = None
    for l in test_b:
        m = re.match(r'^\s{0,6}(\d{1,2})\.\s+(\S.*)$', l)
        if m and int(m.group(1)) == len(tests) + 1:
            cur = {'n': int(m.group(1)), 'lines': [m.group(2)], 'opts': [], 'raw': [m.group(2)]}; tests.append(cur); continue
        if cur is None or not l.strip(): continue
        indent = len(l) - len(l.lstrip())
        cur['raw'].append(l.strip())
        if indent >= 14:
            cur['opts'].append(l.strip())
        else:
            cur['lines'].append(l.strip())
    for t in tests:
        if len(t['opts']) != 4:
            # page breaks drop indentation: take the last 4 lines as options
            allv = t['lines'] + t['opts']
            # lines list preserves original order only for non-option lines; rebuild from raw order
            t['opts'] = t['raw'][-4:]
            t['lines'] = t.pop('raw')[:-4]; t.pop('rawtext', None)
        else:
            t.pop('raw')
        txt = clean(' '.join(t['lines']))
        ms = list(re.finditer(r'(The (?:word|phrase)s?\b|In (?:saying|stating|referring|discussing)\b)', txt))
        if ms:
            k = ms[-1].start(); t['passage'] = txt[:k].strip(); t['prompt'] = txt[k:].strip()
        else:
            t['passage'] = txt; t['prompt'] = ''; issues.append(f'L{num} test {t["n"]}: no prompt')
        t['options'] = t.pop('opts'); t.pop('lines')
        if len(t['options']) != 4: issues.append(f'L{num} test {t["n"]}: {len(t["options"])} options {t["options"]}')
    if len(tests) != 10: issues.append(f'L{num}: {len(tests)} tests')
    lessons.append({'lesson': num, 'words': entries, 'matching': matching, 'tests': tests})

json.dump(lessons, open(out, 'w'), ensure_ascii=False, indent=1)
print('lessons', len(lessons), 'words', sum(len(l['words']) for l in lessons))
print('\n'.join(issues) or 'no issues')
