import { readFileSync } from 'fs';
import { join } from 'path';

export interface TemplateContext {
  [key: string]: string | number | boolean | object | undefined;
}

export class CategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryValidationError';
  }
}

export interface PostData extends TemplateContext {
  title: string;
  slug: string;
  url: string;
  description: string;
  date: string;
  formattedDate: string;
  categoriesHtml: string;
  content?: string;
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextUrl?: string;
  prevUrl?: string;
}

export class TemplateEngine {
  private static readonly PLACEHOLDER_REGEX =
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  private static readonly TEMPLATE_DIR = 'src/templates';

  private static readonly PREDEFINED_CATEGORIES = [
    'Web Development',
    'Privacy',
    'Tutorial',
    'Guide',
    'Review',
    'News',
    'Opinion',
    'Technology',
    'Programming',
    'Frontend',
    'Backend',
    'DevOps',
    'Design',
    'UX/UI',
    'Mobile',
    'Security',
    'Open Source',
    'Learning',
    'API',
    'Database',
    'Cloud',
    'Data Science',
    'Personal',
    'Tips & Tricks',
  ];

  static validateCategories(categories: string[], filename?: string): void {
    const invalidCategories = categories.filter(
      (category) => !this.PREDEFINED_CATEGORIES.includes(category),
    );

    if (invalidCategories.length > 0) {
      const fileInfo = filename ? ` in ${filename}` : '';
      const categoryList = invalidCategories
        .map((cat) => `'${cat}'`)
        .join(', ');
      const validCategoriesHint = this.PREDEFINED_CATEGORIES.slice(0, 10)
        .map((cat) => `'${cat}'`)
        .join(', ');

      throw new CategoryValidationError(
        `Invalid categories found${fileInfo}: ${categoryList}. ` +
          `Categories must be predefined. Valid categories include: ${validCategoriesHint}, etc. ` +
          `See TemplateEngine.PREDEFINED_CATEGORIES for the complete list.`,
      );
    }
  }

  static getPredefinedCategories(): readonly string[] {
    return this.PREDEFINED_CATEGORIES;
  }

  static render(template: string, context: TemplateContext): string {
    return template.replace(this.PLACEHOLDER_REGEX, (match, key) => {
      const value = context[key];
      if (value === undefined) {
        console.warn(
          `Template warning: Placeholder '${key}' not found in context`,
        );
        return match;
      }
      return String(value);
    });
  }

  static renderPage(
    pageType: 'post' | 'list',
    context: TemplateContext,
  ): string {
    const navigation = this.getNavigation(
      context.route as string,
      context.siteTitle as string,
      context.baseUrl as string,
    );

    const header = this.render(this.loadPartial('header'), { navigation });
    const footer = this.render(this.loadPartial('footer'), context);

    let content = '';
    if (pageType === 'post') {
      content = this.render(this.loadContent('post-detail'), context);
    } else {
      content = this.render(this.loadContent('post-list'), context);
    }

    const layout = this.loadLayout('base');
    return this.render(layout, {
      ...context,
      feedTitle: context.siteTitle,
      header,
      footer,
      content,
    });
  }

  static loadTemplate(templatePath: string): string {
    const fullPath = join(this.TEMPLATE_DIR, templatePath);
    return readFileSync(fullPath, 'utf-8');
  }

  static loadLayout(layoutName: string): string {
    return this.loadTemplate(`layouts/${layoutName}.html`);
  }

  static loadPartial(partialName: string): string {
    return this.loadTemplate(`partials/${partialName}.html`);
  }

  static loadContent(contentName: string): string {
    return this.loadTemplate(`content/${contentName}.html`);
  }

  private static getNavigation(
    route: string,
    siteTitle: string,
    baseUrl: string,
  ): string {
    return `<a href="${baseUrl}/">${siteTitle}</a>`;
  }
}
