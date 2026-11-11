#!/usr/bin/env python3
"""Infer answers for matching/MCQ from the entries' synonyms, output unresolved ones. usage: solve_answers.py raw.json out.json"""
import json, re, sys
d = json.load(open(sys.argv[1]))
norm = lambda x: re.sub(r'[^a-z ]', '', x.lower()).strip()
def stem(x):
    x = norm(x)
    for suf in ('ing','ed','es','ly','s','e'):
        if x.endswith(suf) and len(x) - len(suf) >= 4: return x[:-len(suf)]
    return x
unres = []
ALL = [e for L in d for e in L['words']]
def cands_for(key, local_first=None):
    """candidate correct strings for a tested word: search all entries."""
    sk = stem(key); out = set()
    for e in (local_first or []) + ALL:
        forms = {norm(e['word'])} | {norm(f['word']) for f in e['forms']}
        syns = {norm(x) for x in e['synonyms']}
        if key in forms or sk in {stem(f) for f in forms}:
            out |= syns | {stem(x) for x in syns}
        elif key in syns or sk in {stem(x) for x in syns}:
            out |= forms | syns | {stem(x) for x in forms | syns}
    out.discard(key); out.discard(sk)
    return out
def pick(options, cands, key):
    return [i for i, o in enumerate(options) if (norm(o) in cands or stem(o) in cands) and norm(o) != key and stem(o) != stem(key)]
for L in d:
    ents = L['words']
    by_word = {norm(e['word']): e for e in ents}
    for q in L['matching']:
        key = norm(q['word']); cands = set()
        e = by_word.get(key)
        if e:
            cands = {norm(s) for s in e['synonyms']}
        else:
            # key is a synonym or a derived form -> answer is entry word / its forms
            for e2 in ents:
                forms = {norm(e2['word'])} | {norm(f['word']) for f in e2['forms']}
                syns = {norm(s) for s in e2['synonyms']}
                if key in syns or key in forms or stem(key) in {stem(s) for s in syns}:
                    cands |= forms | syns
        hits = [i for i, o in enumerate(q['options']) if norm(o) in cands or stem(o) in {stem(c) for c in cands}]
        # drop self-matches
        hits = [i for i in hits if norm(q['options'][i]) != key]
        if len(hits) != 1:
            h2 = pick(q['options'], cands_for(key), key)
            if len(h2) == 1: hits = h2
        q['answer'] = hits[0] if len(hits) == 1 else None
        if q['answer'] is None: unres.append(('M', L['lesson'], q['n'], q['word'], q['options'], hits))
    for t in L['tests']:
        m = re.search(r'The (?:word|phrase)s? (.+?) in the passage', t['prompt'])
        t['answer'] = None
        if m:
            h2 = pick(t['options'], cands_for(norm(m.group(1))), norm(m.group(1)))
            if len(h2) == 1: t['answer'] = h2[0]
        if m and t['answer'] is None:
            key = norm(m.group(1)); e = by_word.get(key)
            if e:
                cands = {norm(s) for s in e['synonyms']}
                hits = [i for i, o in enumerate(t['options']) if norm(o) in cands or stem(o) in {stem(c) for c in cands}]
                if len(hits) == 1: t['answer'] = hits[0]
        if t['answer'] is None: unres.append(('T', L['lesson'], t['n'], t['prompt'], t['options'], []))
json.dump(d, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(unres), 'unresolved')
for u in unres: print(u)
