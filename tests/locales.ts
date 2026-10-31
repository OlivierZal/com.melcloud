import arLocale from '../.homeycompose/locales/ar.json' with { type: 'json' }
import daLocale from '../.homeycompose/locales/da.json' with { type: 'json' }
import deLocale from '../.homeycompose/locales/de.json' with { type: 'json' }
import enLocale from '../.homeycompose/locales/en.json' with { type: 'json' }
import esLocale from '../.homeycompose/locales/es.json' with { type: 'json' }
import frLocale from '../.homeycompose/locales/fr.json' with { type: 'json' }
import itLocale from '../.homeycompose/locales/it.json' with { type: 'json' }
import koLocale from '../.homeycompose/locales/ko.json' with { type: 'json' }
import nlLocale from '../.homeycompose/locales/nl.json' with { type: 'json' }
import noLocale from '../.homeycompose/locales/no.json' with { type: 'json' }
import plLocale from '../.homeycompose/locales/pl.json' with { type: 'json' }
import ruLocale from '../.homeycompose/locales/ru.json' with { type: 'json' }
import svLocale from '../.homeycompose/locales/sv.json' with { type: 'json' }

// The 13 locale sources, for the suites that pin a wording across every
// language: the language-neutral tokens a hint names ("Home", "Classic",
// the "[Home]"/"[Classic]" driver prefixes) must be spelled verbatim in
// each of them. Typed after the English source, so a key one language
// lacks fails to compile.
export const locales: Readonly<Record<string, typeof enLocale>> = {
  ar: arLocale,
  da: daLocale,
  de: deLocale,
  en: enLocale,
  es: esLocale,
  fr: frLocale,
  it: itLocale,
  ko: koLocale,
  nl: nlLocale,
  no: noLocale,
  pl: plLocale,
  ru: ruLocale,
  sv: svLocale,
}
