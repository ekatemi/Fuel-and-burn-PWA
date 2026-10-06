#!/usr/bin/env python3
"""Builds src/data/ciqual.json from the ANSES-CIQUAL 2020 food composition table.

Source: https://ciqual.anses.fr/ (Licence Ouverte / Etalab 2.0: free reuse with attribution).
Run from the app folder:  python3 scripts/build_ciqual.py

Output, kept small for the app bundle:
  {"source": ..., "groups": {code: name_en}, "foods": [[id, {lang: name}, group, kcal, protein, carbs, fat, fiber], ...]}
Values are per 100 g. Missing values are null; "traces" counts as 0 and "< x" as x / 2.
Where CIQUAL gives no energy value, it is calculated from protein, carbs, fat, fibre and alcohol
with the EU Regulation 1169/2011 factors (4, 4, 9, 2 and 7 kcal per g).
Names are stored per language, so Spanish ("es") or Russian ("ru") names can be merged in later.
"""
import html
import io
import json
import pathlib
import re
import urllib.request
import zipfile

URL = 'https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'data' / 'ciqual.json'

# CIQUAL constituent codes, per 100 g
ENERGY_KCAL = '328'           # Energy, Regulation EU No 1169/2011 (kcal/100g)
ENERGY_KCAL_FALLBACK = '333'  # Energy, N x Jones' factor, with fibres (kcal/100g)
NUTRIENTS = {'protein': '25000', 'carbs': '31000', 'fat': '40000', 'fiber': '34100'}
ALCOHOL = '60000'


def records(zf, prefix, tag):
    """Flat records of one file as dicts.

    The files aren't valid XML (values like "< 2,2" and names with a raw "<" or "&"),
    so the simple, flat records are read with a pattern instead of an XML parser.
    """
    name = next(n for n in zf.namelist() if n.startswith(prefix + '_2'))
    content = zf.read(name).decode('windows-1252')
    for body in re.findall(rf'<{tag}>(.*?)</{tag}>', content, re.S):
        yield {k: html.unescape(v.strip()) for k, v in re.findall(r'<(\w+)>(.*?)</\1>', body, re.S)}


def number(value):
    value = (value or '').strip()
    if value in ('', '-'):
        return None
    if value == 'traces':
        return 0
    below = value.startswith('<')
    try:
        n = float(value.lstrip('<').strip().replace(',', '.'))
    except ValueError:
        return None
    return n / 2 if below else n


def energy_from_macros(v):
    """kcal from the macronutrients, with the EU factors; None unless protein, carbs and fat are known."""
    protein, carbs, fat = (v.get(NUTRIENTS[k]) for k in ('protein', 'carbs', 'fat'))
    if None in (protein, carbs, fat):
        return None
    return 4 * protein + 4 * carbs + 9 * fat + 2 * (v.get(NUTRIENTS['fiber']) or 0) + 7 * (v.get(ALCOHOL) or 0)


def round1(x):
    return None if x is None else round(x, 1)


def main():
    print('Downloading', URL)
    zf = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(URL, timeout=120).read()))

    # Sub-group names give context in search results ("poultry", "fruits").
    groups = {}
    for r in records(zf, 'alim_grp', 'ALIM_GRP'):
        if r.get('alim_ssgrp_code') and r.get('alim_ssgrp_nom_eng', '-') != '-':
            groups[r['alim_ssgrp_code']] = r['alim_ssgrp_nom_eng']

    wanted = {ENERGY_KCAL, ENERGY_KCAL_FALLBACK, ALCOHOL, *NUTRIENTS.values()}
    values = {}
    for r in records(zf, 'compo', 'COMPO'):
        if r.get('const_code') in wanted:
            values.setdefault(r['alim_code'], {})[r['const_code']] = number(r.get('teneur'))

    foods = []
    for r in records(zf, 'alim', 'ALIM'):
        v = values.get(r['alim_code'], {})
        kcal = v.get(ENERGY_KCAL)
        if kcal is None:
            kcal = v.get(ENERGY_KCAL_FALLBACK)
        if kcal is None:
            kcal = energy_from_macros(v)
        if kcal is None or not r.get('alim_nom_eng'):
            continue  # without energy or a name the food is no use for logging
        foods.append([
            int(r['alim_code']),
            {'en': r['alim_nom_eng']},
            r.get('alim_ssgrp_code', ''),
            round(kcal),
            *[round1(v.get(NUTRIENTS[k])) for k in ('protein', 'carbs', 'fat', 'fiber')],
        ])

    foods.sort(key=lambda f: f[0])
    OUT.write_text(json.dumps({
        'source': 'ANSES-CIQUAL 2020, Licence Ouverte / Etalab 2.0 (https://ciqual.anses.fr/)',
        'groups': groups,
        'foods': foods,
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Wrote {len(foods)} foods to {OUT} ({OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
