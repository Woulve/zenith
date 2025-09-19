export interface TemplateContext {
  [key: string]: string | undefined;
}

export class TemplateEngine {
  private static readonly PLACEHOLDER_REGEX =
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

  static render(template: string, context: TemplateContext): string {
    return template.replace(this.PLACEHOLDER_REGEX, (match, key) => {
      const value = context[key];
      if (value === undefined) {
        console.warn(
          `Template warning: Placeholder '${key}' not found in context`,
        );
        return match;
      }
      return this.escapeHtml(value);
    });
  }

  static renderUnsafe(template: string, context: TemplateContext): string {
    return template.replace(this.PLACEHOLDER_REGEX, (match, key) => {
      const value = context[key];
      if (value === undefined) {
        console.warn(
          `Template warning: Placeholder '${key}' not found in context`,
        );
        return match;
      }
      return value;
    });
  }

  private static escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
  }
}
