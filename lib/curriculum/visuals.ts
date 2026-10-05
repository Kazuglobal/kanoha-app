import { resolveVisualTemplate } from "./grade2Math";
import { resolveSubject } from "./subjects";

/**
 * 「えで おしえて」のテンプレ図解(public/visuals/*.svg)を教科つきで解決する。
 * テンプレは算数の単元にしか無いので、国語・英語は必ず null(算数の絵を出さない)。
 */
export function visualTemplateFor(unit: string, subject?: string | null): string | null {
  if (resolveSubject(subject, unit) !== "math") return null;
  return resolveVisualTemplate(unit);
}

export const visualTemplateUrl = (template: string) => `/visuals/${template}.svg`;
