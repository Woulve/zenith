import { Post } from '../processors/post-processor.js';
import { Utils } from '../utils.js';

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextUrl?: string;
  prevUrl?: string;
}

export class HtmlGenerator {
  static generatePostPreview(post: Post): string {
    const baseUrl = process.env.NODE_ENV === 'production' ? '/zenith' : '';
    const categoriesHtml = post.categories
      .map(
        (cat) =>
          `<a href="${baseUrl}/categories/${Utils.slugify(
            cat,
          )}/" class="category-tag">${cat}</a>`,
      )
      .join(' ');

    return `
      <article class="post-preview">
        <h2><a href="${baseUrl}/posts/${post.slug}/">${post.title}</a></h2>
        <div class="post-meta">
          <time datetime="${post.date}">${Utils.formatDate(post.date)}</time>
          <div class="post-categories">${categoriesHtml}</div>
        </div>
        <p class="post-description">${post.description}</p>
      </article>
    `;
  }

  static generatePaginationHtml(pagination: PaginationInfo): string {
    if (pagination.totalPages <= 1) return '';

    let html = '<nav class="pagination">';

    if (pagination.hasPrev) {
      html += `<a href="${pagination.prevUrl}" class="pagination-prev">← Previous</a>`;
    }

    html += `<span class="pagination-info">Page ${pagination.currentPage} of ${pagination.totalPages}</span>`;

    if (pagination.hasNext) {
      html += `<a href="${pagination.nextUrl}" class="pagination-next">Next →</a>`;
    }

    html += '</nav>';
    return html;
  }

  static generateSEOMeta(options: {
    title: string;
    description: string;
    url: string;
    type: 'website' | 'article';
    author?: string;
    publishedTime?: string;
  }): string {
    const meta = [
      `<meta name="description" content="${options.description}">`,
      `<meta property="og:title" content="${options.title}">`,
      `<meta property="og:description" content="${options.description}">`,
      `<meta property="og:url" content="${options.url}">`,
      `<meta property="og:type" content="${options.type}">`,
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${options.title}">`,
      `<meta name="twitter:description" content="${options.description}">`,
    ];

    if (options.author) {
      meta.push(`<meta name="author" content="${options.author}">`);
    }

    if (options.publishedTime) {
      meta.push(
        `<meta property="article:published_time" content="${options.publishedTime}">`,
      );
    }

    return meta.join('\n    ');
  }

  static generateCategoriesHtml(categories: string[]): string {
    const baseUrl = process.env.NODE_ENV === 'production' ? '/zenith' : '';
    return categories
      .map(
        (cat) =>
          `<a href="${baseUrl}/categories/${Utils.slugify(
            cat,
          )}/" class="category-tag">${cat}</a>`,
      )
      .join(' ');
  }
}
