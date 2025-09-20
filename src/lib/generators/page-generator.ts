import * as path from 'path';
import { config } from '../../config.js';
import {
  TemplateEngine,
  PostData,
  PaginationData,
} from '../../template-engine.js';
import { Post } from '../processors/post-processor.js';
import { AssetManager } from '../managers/asset-manager.js';
import { Utils } from '../utils.js';

export interface WriteOperation {
  path: string;
  content: string;
}

export type RouteType = 'post' | 'home' | 'page' | 'category';

export interface RouteInfo {
  type: RouteType;
  slug?: string;
  page?: number;
}

interface SEOOptions {
  title: string;
  description: string;
  url: string;
  type: 'website' | 'article';
  publishedTime?: string;
}

interface PaginationOptions {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  pathPrefix?: string;
}

export class PageGenerator {
  private readonly postsPerPage = 20;
  private assetManager = new AssetManager();

  async generateAllPages(posts: Post[]): Promise<WriteOperation[]> {
    console.log('📝 Generating pages...');

    const [postOps, paginatedOps, categoryOps] = await Promise.all([
      this.generatePostPages(posts),
      this.generatePaginatedPages(posts),
      this.generateCategoryPages(posts),
    ]);

    const totalOps = postOps.length + paginatedOps.length + categoryOps.length;
    console.log(
      `✅ Generated ${totalOps} pages (${postOps.length} posts, ${paginatedOps.length} paginated, ${categoryOps.length} categories)`,
    );

    return [...postOps, ...paginatedOps, ...categoryOps];
  }

  private preparePostData(post: Post): PostData {
    const categories = post.categories.map(
      (cat) =>
        `<a class="category-tag" href="${
          config.baseUrl
        }/categories/${Utils.slugify(cat)}/">${cat}</a>`,
    );

    return {
      title: post.title,
      slug: post.slug,
      url: `${config.baseUrl}/posts/${post.slug}/`,
      description: post.description,
      date: post.date,
      formattedDate: Utils.formatDate(post.date),
      categoriesHtml: categories.join(' '),
      content: post.htmlContent,
    };
  }

  private generateSEOMeta(options: SEOOptions): string {
    const metaTags = [
      `<meta name="description" content="${options.description}">`,
      `<link rel="canonical" href="${options.url}">`,
      `<meta property="og:title" content="${options.title}">`,
      `<meta property="og:description" content="${options.description}">`,
      `<meta property="og:url" content="${options.url}">`,
      `<meta property="og:type" content="${options.type}">`,
      `<meta property="og:site_name" content="${config.siteTitle}">`,
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${options.title}">`,
      `<meta name="twitter:description" content="${options.description}">`,
    ];

    if (options.publishedTime) {
      metaTags.push(
        `<meta property="article:published_time" content="${options.publishedTime}">`,
      );
    }

    return metaTags.join('\n    ');
  }

  private getCSSPath(): string {
    return `${config.baseUrl}/styles/main.css`;
  }

  private generatePaginationUrls(options: PaginationOptions): PaginationData {
    const { currentPage, totalPages, baseUrl, pathPrefix = '' } = options;

    const getPageUrl = (page: number): string => {
      if (page === 1) {
        return pathPrefix ? `${baseUrl}/${pathPrefix}/` : baseUrl;
      }
      return pathPrefix
        ? `${baseUrl}/${pathPrefix}/page/${page}/`
        : `${baseUrl}/page/${page}/`;
    };

    return {
      currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      nextUrl:
        currentPage < totalPages ? getPageUrl(currentPage + 1) : undefined,
      prevUrl: currentPage > 1 ? getPageUrl(currentPage - 1) : undefined,
    };
  }

  private renderPostsHtml(posts: Post[]): string {
    return posts
      .map((post) => {
        const postData = this.preparePostData(post);
        return TemplateEngine.render(
          TemplateEngine.loadPartial('post-preview'),
          postData,
        );
      })
      .join('');
  }

  private renderPaginationHtml(pagination: PaginationData): string {
    if (pagination.totalPages <= 1) return '';

    const prevElement = pagination.hasPrev
      ? `<a class="pagination__link" href="${pagination.prevUrl}">← Previous</a>`
      : `<span class="pagination__link pagination__link--disabled" aria-disabled="true">← Previous</span>`;

    const nextElement = pagination.hasNext
      ? `<a class="pagination__link" href="${pagination.nextUrl}">Next →</a>`
      : `<span class="pagination__link pagination__link--disabled" aria-disabled="true">Next →</span>`;

    return TemplateEngine.render(TemplateEngine.loadPartial('pagination'), {
      ...pagination,
      prevElement,
      nextElement,
    });
  }

  private async generatePostPages(posts: Post[]): Promise<WriteOperation[]> {
    const pagePromises = posts.map(async (post) => {
      const postDir = path.join(config.distDir, 'posts', post.slug);
      await this.assetManager.ensureDirectory(postDir);

      const seoMeta = this.generateSEOMeta({
        title: `${post.title} - ${config.siteTitle}`,
        description: post.description,
        url: `${config.baseUrl}/posts/${post.slug}/`,
        type: 'article',
        publishedTime: post.date,
      });

      const postData = this.preparePostData(post);
      const cssPath = this.getCSSPath();

      const html = TemplateEngine.renderPage('post', {
        route: 'post',
        pageTitle: `${post.title} - ${config.siteTitle}`,
        siteTitle: config.siteTitle,
        baseUrl: config.baseUrl,
        cssPath,
        seoMeta,
        ...postData,
      });

      return {
        path: path.join(postDir, 'index.html'),
        content: html,
      };
    });

    return Promise.all(pagePromises);
  }

  private async generatePaginatedPages(
    posts: Post[],
  ): Promise<WriteOperation[]> {
    const totalPages = Math.ceil(posts.length / this.postsPerPage);

    const pagePromises = Array.from({ length: totalPages }, async (_, i) => {
      const page = i + 1;
      const startIndex = (page - 1) * this.postsPerPage;
      const endIndex = startIndex + this.postsPerPage;
      const pagePosts = posts.slice(startIndex, endIndex);

      const pagination = this.generatePaginationUrls({
        currentPage: page,
        totalPages,
        baseUrl: config.baseUrl,
      });

      const postsHtml = this.renderPostsHtml(pagePosts);
      const paginationHtml = this.renderPaginationHtml(pagination);

      const seoMeta = this.generateSEOMeta({
        title:
          page === 1 ? config.siteTitle : `${config.siteTitle} - Page ${page}`,
        description: config.siteDescription,
        url: page === 1 ? config.baseUrl : `${config.baseUrl}/page/${page}/`,
        type: 'website',
      });

      const cssPath = this.getCSSPath();

      const html = TemplateEngine.renderPage('list', {
        route: 'home',
        pageTitle:
          page === 1 ? config.siteTitle : `${config.siteTitle} - Page ${page}`,
        siteTitle: config.siteTitle,
        baseUrl: config.baseUrl,
        cssPath,
        seoMeta,
        postsHtml,
        paginationHtml,
      });

      if (page === 1) {
        return {
          path: path.join(config.distDir, 'index.html'),
          content: html,
        };
      } else {
        const pageDir = path.join(config.distDir, 'page', page.toString());
        await this.assetManager.ensureDirectory(pageDir);
        return {
          path: path.join(pageDir, 'index.html'),
          content: html,
        };
      }
    });

    const results = await Promise.all(pagePromises);
    return results;
  }

  private async generateCategoryPages(
    posts: Post[],
  ): Promise<WriteOperation[]> {
    const postsByCategory = this.groupPostsByCategory(posts);

    const categoryPromises = Array.from(postsByCategory.entries()).map(
      async ([categorySlug, categoryPosts]) => {
        const categoryName = this.getCategoryName(categoryPosts, categorySlug);
        const totalPages = Math.ceil(categoryPosts.length / this.postsPerPage);

        const pagePromises = Array.from(
          { length: totalPages },
          async (_, i) => {
            const page = i + 1;
            const startIndex = (page - 1) * this.postsPerPage;
            const endIndex = startIndex + this.postsPerPage;
            const pagePosts = categoryPosts.slice(startIndex, endIndex);

            const pagination = this.generatePaginationUrls({
              currentPage: page,
              totalPages,
              baseUrl: config.baseUrl,
              pathPrefix: `categories/${categorySlug}`,
            });

            const postsHtml = this.renderPostsHtml(pagePosts);
            const paginationHtml = this.renderPaginationHtml(pagination);

            const seoMeta = this.generateSEOMeta({
              title: `${categoryName} - ${config.siteTitle}${
                page > 1 ? ` - Page ${page}` : ''
              }`,
              description: `Posts in ${categoryName} category${
                page > 1 ? ` - Page ${page}` : ''
              }`,
              url:
                page === 1
                  ? `${config.baseUrl}/categories/${categorySlug}/`
                  : `${config.baseUrl}/categories/${categorySlug}/page/${page}/`,
              type: 'website',
            });

            const cssPath = this.getCSSPath();

            const html = TemplateEngine.renderPage('list', {
              route: 'category',
              pageTitle: `${categoryName} - ${config.siteTitle}${
                page > 1 ? ` - Page ${page}` : ''
              }`,
              siteTitle: config.siteTitle,
              baseUrl: config.baseUrl,
              cssPath,
              seoMeta,
              postsHtml,
              paginationHtml,
            });

            if (page === 1) {
              const categoryDir = path.join(
                config.distDir,
                'categories',
                categorySlug,
              );
              await this.assetManager.ensureDirectory(categoryDir);
              return {
                path: path.join(categoryDir, 'index.html'),
                content: html,
              };
            } else {
              const pageDir = path.join(
                config.distDir,
                'categories',
                categorySlug,
                'page',
                page.toString(),
              );
              await this.assetManager.ensureDirectory(pageDir);
              return {
                path: path.join(pageDir, 'index.html'),
                content: html,
              };
            }
          },
        );

        return Promise.all(pagePromises);
      },
    );

    const results = await Promise.all(categoryPromises);
    return results.flat();
  }

  private groupPostsByCategory(posts: Post[]): Map<string, Post[]> {
    const postsByCategory = new Map<string, Post[]>();

    posts.forEach((post) => {
      post.categories.forEach((category) => {
        const categorySlug = Utils.slugify(category);
        if (!postsByCategory.has(categorySlug)) {
          postsByCategory.set(categorySlug, []);
        }
        postsByCategory.get(categorySlug)!.push(post);
      });
    });

    return postsByCategory;
  }

  private getCategoryName(categoryPosts: Post[], categorySlug: string): string {
    return (
      categoryPosts[0].categories.find(
        (cat) => Utils.slugify(cat) === categorySlug,
      ) || categorySlug
    );
  }
}
