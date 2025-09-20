import { TemplateEngine, CategoryValidationError } from './template-engine.js';

export interface PostMetadata {
  title: string;
  date: string;
  description: string;
  slug: string;
  categories: string[];
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  metadata: Partial<PostMetadata>;
}

export class FrontmatterValidator {
  private static readonly REQUIRED_FIELDS = ['title', 'date'] as const;
  private static readonly OPTIONAL_FIELDS = [
    'description',
    'slug',
    'categories',
  ] as const;

  static validate(
    data: Record<string, unknown>,
    filename: string,
  ): ValidationResult {
    const warnings: string[] = [];
    const metadata: Partial<PostMetadata> = {};

    for (const field of this.REQUIRED_FIELDS) {
      if (
        !data[field] ||
        typeof data[field] !== 'string' ||
        data[field].trim() === ''
      ) {
        warnings.push(
          `Missing or empty required field '${field}' in ${filename}`,
        );
      } else {
        metadata[field] = data[field].trim();
      }
    }

    for (const field of this.OPTIONAL_FIELDS) {
      if (field === 'categories') {
        if (data[field]) {
          if (Array.isArray(data[field])) {
            metadata.categories = (data[field] as string[])
              .filter((cat) => typeof cat === 'string' && cat.trim() !== '')
              .map((cat) => cat.trim());
          } else if (typeof data[field] === 'string') {
            metadata.categories = [data[field].trim()];
          }
        }
      } else if (data[field] && typeof data[field] === 'string') {
        metadata[field] = data[field].trim();
      }
    }

    if (metadata.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(metadata.date)) {
        warnings.push(
          `Invalid date format in ${filename}. Expected YYYY-MM-DD format.`,
        );
      } else {
        const parsedDate = new Date(metadata.date);
        if (isNaN(parsedDate.getTime())) {
          warnings.push(
            `Invalid date value in ${filename}. Date cannot be parsed.`,
          );
        }
      }
    }

    if (!metadata.slug && metadata.title) {
      metadata.slug = this.generateSlug(metadata.title);
      warnings.push(
        `Generated slug '${metadata.slug}' for ${filename} (no slug provided)`,
      );
    }

    if (!metadata.description) {
      warnings.push(
        `Missing description field in ${filename}. Consider adding for better SEO.`,
      );
      metadata.description = metadata.title || 'Blog post';
    }

    if (!metadata.categories || metadata.categories.length === 0) {
      metadata.categories = ['uncategorized'];
      warnings.push(
        `No categories specified in ${filename}. Using 'uncategorized'.`,
      );
    }

    // Validate categories
    try {
      TemplateEngine.validateCategories(metadata.categories, filename);
    } catch (error) {
      if (error instanceof CategoryValidationError) {
        warnings.push(`❌ ${error.message}`);
        return {
          isValid: false,
          warnings,
          metadata: metadata as PostMetadata,
        };
      }
      throw error;
    }

    const isValid = this.REQUIRED_FIELDS.every(
      (field) =>
        metadata[field] &&
        typeof metadata[field] === 'string' &&
        metadata[field]!.trim() !== '',
    );

    return {
      isValid,
      warnings,
      metadata: metadata as PostMetadata,
    };
  }

  private static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
