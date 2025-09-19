import * as path from 'path';
import { config } from '../../config.js';
import { TemplateEngine } from '../../template-engine.js';
import { Post, PostProcessor } from '../processors/post-processor.js';
import { HtmlGenerator, PaginationInfo } from './html-generator.js';
import { AssetManager } from '../managers/asset-manager.js';
import { Utils } from '../utils.js';

export interface WriteOperation {
  path: string;
  content: string;
}

export class PageGenerator {
  private readonly postsPerPage = 5;
  private postProcessor = new PostProcessor();
  private assetManager = new AssetManager();

  async generateAllPages(posts: Post[]): Promise<WriteOperation[]> {
    console.log('📝 Generating pages...');

    const operations: WriteOperation[] = [];

    operations.push(...(await this.generatePostPages(posts)));
    operations.push(...(await this.generatePaginatedPages(posts)));
    operations.push(...(await this.generateCategoryPages(posts)));

    return operations;
  }

  private async generatePostPages(posts: Post[]): Promise<WriteOperation[]> {
    const operations: WriteOperation[] = [];
    const postTemplate = await this.postProcessor.loadTemplate('post.html');

    for (const post of posts) {
      const postDir = path.join(config.distDir, 'posts', post.slug);
      await this.assetManager.ensureDirectory(postDir);

      const seoMeta = HtmlGenerator.generateSEOMeta({
        title: `${post.title} - ${config.siteTitle}`,
        description: post.description,
        url: `${config.baseUrl}/posts/${post.slug}/`,
        type: 'article',
        publishedTime: post.date,
      });

      const categoriesHtml = HtmlGenerator.generateCategoriesHtml(
        post.categories,
      );

      const html = TemplateEngine.renderUnsafe(postTemplate, {
        title: post.title,
        date: Utils.formatDate(post.date),
        description: post.description,
        content: post.htmlContent,
        categories: categoriesHtml,
        seoMeta,
        siteTitle: config.siteTitle,
      });

      operations.push({
        path: path.join(postDir, 'index.html'),
        content: html,
      });
    }

    return operations;
  }

  private async generatePaginatedPages(
    posts: Post[],
  ): Promise<WriteOperation[]> {
    const operations: WriteOperation[] = [];
    const indexTemplate = await this.postProcessor.loadTemplate('index.html');
    const totalPages = Math.ceil(posts.length / this.postsPerPage);

    for (let page = 1; page <= totalPages; page++) {
      const startIndex = (page - 1) * this.postsPerPage;
      const endIndex = startIndex + this.postsPerPage;
      const pagePosts = posts.slice(startIndex, endIndex);

      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextUrl:
          page < totalPages
            ? page === 1
              ? '/page/2/'
              : `/page/${page + 1}/`
            : undefined,
        prevUrl:
          page > 1 ? (page === 2 ? '/' : `/page/${page - 1}/`) : undefined,
      };

      const postListHtml = pagePosts
        .map((post) => HtmlGenerator.generatePostPreview(post))
        .join('');

      const paginationHtml = HtmlGenerator.generatePaginationHtml(pagination);

      const seoMeta = HtmlGenerator.generateSEOMeta({
        title:
          page === 1 ? config.siteTitle : `${config.siteTitle} - Page ${page}`,
        description: config.siteDescription,
        url: page === 1 ? config.baseUrl : `${config.baseUrl}/page/${page}/`,
        type: 'website',
      });

      const html = TemplateEngine.renderUnsafe(indexTemplate, {
        title:
          page === 1 ? config.siteTitle : `${config.siteTitle} - Page ${page}`,
        posts: postListHtml,
        pagination: paginationHtml,
        seoMeta,
        siteTitle: config.siteTitle,
      });

      if (page === 1) {
        operations.push({
          path: path.join(config.distDir, 'index.html'),
          content: html,
        });
      } else {
        const pageDir = path.join(config.distDir, 'page', page.toString());
        await this.assetManager.ensureDirectory(pageDir);
        operations.push({
          path: path.join(pageDir, 'index.html'),
          content: html,
        });
      }
    }

    return operations;
  }

  private async generateCategoryPages(
    posts: Post[],
  ): Promise<WriteOperation[]> {
    const operations: WriteOperation[] = [];
    const categoryTemplate = await this.postProcessor.loadTemplate(
      'category.html',
    );

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

    for (const [categorySlug, categoryPosts] of postsByCategory) {
      const categoryName =
        categoryPosts[0].categories.find(
          (cat) => Utils.slugify(cat) === categorySlug,
        ) || categorySlug;
      const categoryDir = path.join(config.distDir, 'categories', categorySlug);
      await this.assetManager.ensureDirectory(categoryDir);

      const postListHtml = categoryPosts
        .map((post) => HtmlGenerator.generatePostPreview(post))
        .join('');

      const seoMeta = HtmlGenerator.generateSEOMeta({
        title: `${categoryName} - ${config.siteTitle}`,
        description: `Posts in ${categoryName} category`,
        url: `${config.baseUrl}/categories/${categorySlug}/`,
        type: 'website',
      });

      const html = TemplateEngine.renderUnsafe(categoryTemplate, {
        title: `${categoryName} - ${config.siteTitle}`,
        posts: postListHtml,
        pagination: '',
        seoMeta,
        siteTitle: config.siteTitle,
      });

      operations.push({
        path: path.join(categoryDir, 'index.html'),
        content: html,
      });
    }

    return operations;
  }
}
