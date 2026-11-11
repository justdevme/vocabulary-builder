#!/usr/bin/env python3
"""Inline css/js/data into one HTML fragment for the Artifact tool. usage: build_artifact.py out.html"""
import re, sys
r = lambda p: open(p, encoding='utf-8').read()
idx = r('index.html')
header = re.search(r'<header.*?</header>', idx, re.S).group(0)
out = ('<title>TOEFL ITP Vocab</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n' + r('css/style.css') + '</style>\n'
       + header + '\n<main id="app" aria-live="polite"></main>\n<script>\n' + r('data/words.js') + '</script>\n<script>\n' + r('js/app.js') + '</script>\n')
assert out.count('</script>') == 2
open(sys.argv[1], 'w', encoding='utf-8').write(out)
