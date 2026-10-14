"""Genera src/locale/messages.en.xlf a partir de messages.xlf (la fuente está en español).

Uso (desde apps/web):  npm run i18n   →  ng extract-i18n + este script.
Los textos en inglés viven en EN; los marcadores {0}, {1}… se sustituyen por los <x/> de la fuente.
"""
import re
import sys

EN = {
    'shell.skip': 'Skip to content',
    'shell.brand': 'Pokémon Explorer',
    'shell.language': 'Language',
    'shell.offline': 'You are offline. Showing saved data.',
    'shell.updateReady': 'A new version is available.',
    'shell.update': 'Update',
    'shell.footer': 'Data from {0}PokéAPI{1}. Demo project, not affiliated with Nintendo or The Pokémon Company.',
    'catalog.heading': 'Pokémon catalog',
    'filters.search': 'Search by name',
    'filters.searchPlaceholder': 'Pikachu, char…',
    'filters.type': 'Type',
    'filters.all': 'All',
    'filters.generation': 'Generation',
    'filters.allFem': 'All',
    'filters.clear': 'Clear filters',
    'catalog.count': '{VAR_PLURAL, plural, =0 {No results} =1 {1 result} other {{0} results}}',
    'catalog.loading': 'Loading…',
    'catalog.searching': 'Searching…',
    'catalog.fuzzy': 'No exact matches for «{0}»: showing similar names.',
    'filters.searchHint': 'Type at least 2 characters',
    'catalog.error.title': "We couldn't load the Pokémon",
    'catalog.error.description': "The service didn't respond. Check your connection and try again.",
    'common.retry': 'Try again',
    'evolution.more': '+{0} more',
    'evolution.less': 'Hide',
    'detail.evolution.error': "We couldn't load the evolution.",
    'catalog.pageOutOfRange.title': "This page doesn't exist",
    'catalog.pageOutOfRange.action': 'Go to the first page',
    'catalog.empty.title': 'No results',
    'catalog.empty.description': 'Try another name or remove a filter.',
    'catalog.title': 'Pokémon Explorer',
    'catalog.description': 'Explore the Pokémon catalog, search by name and filter by type or generation.',
    'evolution.evolvesTo': 'Evolves into {0}:',
    'detail.back': 'Back to catalog',
    'detail.notFound.title': 'Pokémon not found',
    'detail.notFound.description': 'No Pokémon exists with that name or number.',
    'detail.notFound.action': 'Go to the catalog',
    'detail.error.title': "We couldn't load this Pokémon",
    'detail.error.description': "The service didn't respond. Check your connection and try again.",
    'detail.legendary': 'Legendary',
    'detail.mythical': 'Mythical',
    'detail.about': 'About',
    'detail.height': 'Height',
    'detail.weight': 'Weight',
    'detail.abilities': 'Abilities',
    'stats.tier.low': 'low',
    'stats.tier.mid': 'medium',
    'stats.tier.high': 'high',
    'stats.tier.top': 'exceptional',
    'detail.hiddenAbility': 'hidden ability',
    'detail.stats': 'Base stats',
    'detail.total': 'Total',
    'detail.evolution': 'Evolution',
    'detail.noEvolution': 'This Pokémon does not evolve.',
    'detail.title.notFound': 'Pokémon not found · Pokémon Explorer',
    'detail.title.error': 'Error · Pokémon Explorer',
    'detail.title.suffix': 'Pokémon Explorer',
    'pager.label': 'Pagination',
    'pager.previous': 'Previous',
    'pager.status': 'Page {0} of {1}',
    'pager.next': 'Next',
    'notFound.title': 'Page not found',
    'notFound.description': "The address you're looking for doesn't exist.",
    'notFound.documentTitle': 'Page not found · Pokémon Explorer',
}

src = open('src/locale/messages.xlf', encoding='utf-8').read()
placeholders = re.compile(r'<x [^>]*/>')
missing = []


def add_target(match: re.Match) -> str:
    """Le agrega a una unidad de traducción su `<target>` en inglés (sacado de `EN`); si falta, la deja anotada."""
    unit = match.group(0)
    unit_id = re.search(r'id="([^"]+)"', unit).group(1)
    if unit_id not in EN:
        missing.append(unit_id)
        return unit
    source = re.search(r'<source>(.*?)</source>', unit, re.S).group(1)
    xs = placeholders.findall(source)
    text = EN[unit_id].replace('&', '&amp;') if '<' not in EN[unit_id] else EN[unit_id]
    # «{VAR_PLURAL, plural, …}» usa llaves propias: solo se sustituyen los marcadores numéricos {0}, {1}…
    text = re.sub(r'\{(\d+)\}', lambda m: xs[int(m.group(1))], text)
    return unit.replace('</source>', f'</source>\n        <target>{text}</target>', 1)


out = re.sub(r'<trans-unit .*?</trans-unit>', add_target, src, flags=re.S)
out = out.replace('<file source-language="es"', '<file source-language="es" target-language="en"', 1)
if missing:
    sys.exit(f'Faltan traducciones EN para: {", ".join(missing)}')
open('src/locale/messages.en.xlf', 'w', encoding='utf-8').write(out)
print(f'messages.en.xlf: {len(EN)} mensajes')
