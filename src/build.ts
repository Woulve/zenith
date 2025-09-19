import { promises as fs } from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import matter from 'gray-matter';
import * as sass from 'sass';
import chokidar from 'chokidar';
import { config } from './config.js';
import { TemplateEngine } from './template-engine.js';
import { FrontmatterValidator, PostMetadata } from './frontmatter-validator.js';
import { FeedGenerator } from './feed-generator.js';

interface Post extends PostMetadata {
  content: string;
  htmlContent: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextUrl?: string;
  prevUrl?: string;
}

interface WriteOperation {
  path: string;
  content: string;
}

class BlogGenerator {
  private scssModTime: number = 0;
  private cssModTime: number = 0;
  private buildTimeout: NodeJS.Timeout | null = null;
  private isBuilding: boolean = false;
  private readonly postsPerPage = 5;

  async build() {
    if (this.isBuilding) {
      return;
    }

    this.isBuilding = true;
    console.log('🚀 Starting blog build...');

    try {
      await this.ensureDirectories();
      await this.copyPublicAssets();
      await this.compileStylesIfNeeded();
      const posts = await this.loadPosts();
      const writeOps = await this.generateAllPages(posts);
      await this.batchWrite(writeOps);
      await this.generateSitemap(posts);
      await this.generateFeeds(posts);

      console.log('✅ Blog build completed!');
    } finally {
      this.isBuilding = false;
    }
  }

  async watch() {
    console.log('👀 Starting file watcher...');

    const watcher = chokidar.watch(
      [config.postsDir, config.templatesDir, config.stylesDir],
      {
        ignored: /(^|[/\\])\../,
        persistent: true,
        ignoreInitial: true,
      },
    );

    const debouncedBuild = (filePath: string, eventType: string) => {
      console.log(`${eventType} ${filePath}`);

      if (this.buildTimeout) {
        clearTimeout(this.buildTimeout);
      }

      this.buildTimeout = setTimeout(async () => {
        if (!this.isBuilding) {
          await this.build();
        }
      }, 100);
    };

    watcher.on('change', (filePath) => {
      debouncedBuild(filePath, '📝 File changed:');
    });

    watcher.on('add', (filePath) => {
      debouncedBuild(filePath, '➕ File added:');
    });

    watcher.on('unlink', (filePath) => {
      debouncedBuild(filePath, '🗑️ File removed:');
    });

    console.log('✅ File watcher started. Press Ctrl+C to stop.');

    await this.build();
  }

  private async ensureDirectories() {
    const dirs = [
      config.distDir,
      path.join(config.distDir, 'posts'),
      path.join(config.distDir, 'styles'),
      path.join(config.distDir, 'categories'),
      path.join(config.distDir, 'page'),
    ];

    await Promise.all(
      dirs.map(async (dir) => {
        try {
          await fs.access(dir);
        } catch {
          await fs.mkdir(dir, { recursive: true });
        }
      }),
    );
  }

  private async copyPublicAssets() {
    console.log('📁 Copying public assets...');

    try {
      await fs.access(config.publicDir);
    } catch {
      console.log('⏭️ No public directory found, skipping asset copying');
      return;
    }

    const copyRecursive = async (srcDir: string, destDir: string) => {
      const entries = await fs.readdir(srcDir, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await copyRecursive(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    };

    await copyRecursive(config.publicDir, config.distDir);
    console.log('✅ Public assets copied successfully');
  }

  private async compileStylesIfNeeded() {
    const scssFile = path.join(config.stylesDir, 'main.scss');
    const cssFile = path.join(config.distDir, 'styles', 'main.css');

    try {
      const scssFiles = await fs.readdir(config.stylesDir);
      const scssFilePaths = scssFiles
        .filter((file) => file.endsWith('.scss'))
        .map((file) => path.join(config.stylesDir, file));

      let latestScssModTime = 0;
      for (const filePath of scssFilePaths) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs > latestScssModTime) {
            latestScssModTime = stats.mtimeMs;
          }
        } catch {
          continue;
        }
      }

      this.scssModTime = latestScssModTime;

      try {
        const cssStats = await fs.stat(cssFile);
        this.cssModTime = cssStats.mtimeMs;
      } catch {
        this.cssModTime = 0;
      }

      if (this.scssModTime > this.cssModTime) {
        console.log('📦 Compiling SCSS...');
        const result = sass.compile(scssFile);
        await fs.writeFile(cssFile, result.css);
      } else {
        console.log('⏭️ SCSS compilation skipped (no changes)');
      }
    } catch {
      console.warn('⚠️ SCSS file not found, skipping compilation');
    }
  }

  private async loadPosts(): Promise<Post[]> {
    console.log('📄 Loading posts...');

    try {
      await fs.access(config.postsDir);
    } catch {
      console.warn('⚠️ Posts directory not found');
      return [];
    }

    const files = await fs.readdir(config.postsDir);
    const postFiles = files.filter((file) => file.endsWith('.md'));

    const posts = await Promise.all(
      postFiles.map(async (file) => {
        const filePath = path.join(config.postsDir, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const { data, content } = matter(fileContent);

        const validation = FrontmatterValidator.validate(data, file);

        validation.warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));

        if (!validation.isValid) {
          console.error(`❌ Skipping ${file} due to validation errors`);
          return null;
        }

        const htmlContent = await marked(content);

        return {
          ...validation.metadata,
          content,
          htmlContent,
        } as Post;
      }),
    );

    const validPosts = posts.filter((post): post is Post => post !== null);

    return validPosts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  private async generateAllPages(posts: Post[]): Promise<WriteOperation[]> {
    console.log('📝 Generating pages...');

    const operations: WriteOperation[] = [];

    operations.push(...(await this.generatePostPages(posts)));
    operations.push(...(await this.generatePaginatedPages(posts)));
    operations.push(...(await this.generateCategoryPages(posts)));

    return operations;
  }

  private async generatePostPages(posts: Post[]): Promise<WriteOperation[]> {
    const operations: WriteOperation[] = [];
    const postTemplate = await this.loadTemplate('post.html');

    for (const post of posts) {
      const postDir = path.join(config.distDir, 'posts', post.slug);
      await this.ensureDirectory(postDir);

      const seoMeta = this.generateSEOMeta({
        title: `${post.title} - ${config.siteTitle}`,
        description: post.description,
        url: `${config.baseUrl}/posts/${post.slug}/`,
        type: 'article',
        publishedTime: post.date,
      });

      const categoriesHtml = post.categories
        .map(
          (cat) =>
            `<a href="/categories/${this.slugify(
              cat,
            )}/" class="category-tag">${cat}</a>`,
        )
        .join(' ');

      const html = TemplateEngine.renderUnsafe(postTemplate, {
        title: post.title,
        date: this.formatDate(post.date),
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
    const indexTemplate = await this.loadTemplate('index.html');
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
        .map((post) => this.generatePostPreview(post))
        .join('');

      const paginationHtml = this.generatePaginationHtml(pagination);

      const seoMeta = this.generateSEOMeta({
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
        await this.ensureDirectory(pageDir);
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
    const categoryTemplate = await this.loadTemplate('category.html');

    const postsByCategory = new Map<string, Post[]>();

    posts.forEach((post) => {
      post.categories.forEach((category) => {
        const categorySlug = this.slugify(category);
        if (!postsByCategory.has(categorySlug)) {
          postsByCategory.set(categorySlug, []);
        }
        postsByCategory.get(categorySlug)!.push(post);
      });
    });

    for (const [categorySlug, categoryPosts] of postsByCategory) {
      const categoryName =
        categoryPosts[0].categories.find(
          (cat) => this.slugify(cat) === categorySlug,
        ) || categorySlug;
      const categoryDir = path.join(config.distDir, 'categories', categorySlug);
      await this.ensureDirectory(categoryDir);

      const postListHtml = categoryPosts
        .map((post) => this.generatePostPreview(post))
        .join('');

      const seoMeta = this.generateSEOMeta({
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

  private generatePostPreview(post: Post): string {
    const categoriesHtml = post.categories
      .map(
        (cat) =>
          `<a href="/categories/${this.slugify(
            cat,
          )}/" class="category-tag">${cat}</a>`,
      )
      .join(' ');

    return `
      <article class="post-preview">
        <h2><a href="/posts/${post.slug}/">${post.title}</a></h2>
        <div class="post-meta">
          <time datetime="${post.date}">${this.formatDate(post.date)}</time>
          <div class="post-categories">${categoriesHtml}</div>
        </div>
        <p class="post-description">${post.description}</p>
      </article>
    `;
  }

  private generatePaginationHtml(pagination: PaginationInfo): string {
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

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async batchWrite(operations: WriteOperation[]) {
    console.log(`💾 Writing ${operations.length} files...`);

    await Promise.all(
      operations.map(async (op) => {
        await fs.writeFile(op.path, op.content);
      }),
    );
  }

  private async generateSitemap(posts: Post[]) {
    console.log('🗺️ Generating sitemap...');

    const urls = [
      {
        loc: config.baseUrl,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '1.0',
      },
      ...posts.map((post) => ({
        loc: `${config.baseUrl}/posts/${post.slug}/`,
        lastmod: post.date,
        changefreq: 'monthly',
        priority: '0.8',
      })),
    ];

    const totalPages = Math.ceil(posts.length / this.postsPerPage);
    for (let page = 2; page <= totalPages; page++) {
      urls.push({
        loc: `${config.baseUrl}/page/${page}/`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.7',
      });
    }

    const categories = new Set<string>();
    posts.forEach((post) => {
      post.categories.forEach((category) => {
        categories.add(this.slugify(category));
      });
    });

    categories.forEach((categorySlug) => {
      urls.push({
        loc: `${config.baseUrl}/categories/${categorySlug}/`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.6',
      });
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

    await fs.writeFile(path.join(config.distDir, 'sitemap.xml'), sitemap);
  }

  private async generateFeeds(posts: Post[]) {
    console.log('📡 Generating RSS and Atom feeds...');

    const rssContent = FeedGenerator.generateRSS(posts);
    const atomContent = FeedGenerator.generateAtom(posts);

    await Promise.all([
      fs.writeFile(path.join(config.distDir, 'feed.xml'), rssContent),
      fs.writeFile(path.join(config.distDir, 'atom.xml'), atomContent),
    ]);
  }

  private generateSEOMeta(options: {
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

  private async ensureDirectory(dir: string) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async loadTemplate(templateName: string): Promise<string> {
    const templatePath = path.join(config.templatesDir, templateName);
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

const args = process.argv.slice(2);
const generator = new BlogGenerator();

if (args.includes('--watch') || args.includes('-w')) {
  generator.watch().catch(console.error);
} else {
  generator.build().catch(console.error);
}
