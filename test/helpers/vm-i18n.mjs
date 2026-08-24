// Load src/i18n.js into a vm context and pin a locale.
// Existing UI tests keep Japanese assertions by defaulting to ja.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const I18N_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'i18n.js');

export function loadI18n(context, locale = 'ja') {
  vm.runInContext(readFileSync(I18N_SRC, 'utf8'), context);
  if (locale) vm.runInContext(`CB_I18N.setLocale(${JSON.stringify(locale)})`, context);
  return vm.runInContext('CB_I18N', context);
}
