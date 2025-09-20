import { promises as fs } from 'fs';
import chokidar from 'chokidar';
import { config } from '../config.js';
import { AssetManager } from './managers/asset-manager.js';
import { StyleCompiler } from './processors/style-compiler.js';
import { PostProcessor, Post } from './processors/post-processor.js';
import { PageGenerator, WriteOperation } from './generators/page-generator.js';
import { SitemapGenerator } from './generators/sitemap-generator.js';
import { FeedGenerator } from '../feed-generator.js';

export class BuildOrchestrator {
  private isBuilding = false;
  private isInitialBuild = true;

  private assetManager = new AssetManager();
  private styleCompiler = new StyleCompiler();
  private postProcessor = new PostProcessor();
  private pageGenerator = new PageGenerator();
  private sitemapGenerator = new SitemapGenerator();

  async build(): Promise<void> {
    if (this.isBuilding) return;

    this.isBuilding = true;
    console.log('🚀 Starting build...');

    try {
      await this.assetManager.ensureDirectories();
      await Promise.all([
        this.assetManager.copyPublicAssets(),
        this.styleCompiler.compileIfNeeded(),
      ]);

      const posts = await this.postProcessor.loadPosts();
      const [pages, feeds, sitemap] = await Promise.all([
        this.pageGenerator.generateAllPages(posts),
        this.prepareFeedOperations(posts),
        this.prepareSitemapOperations(posts),
      ]);

      await this.batchWrite([...pages, ...feeds, ...sitemap]);

      console.log('✅ Build completed!');
      if (this.isInitialBuild) {
        this.isInitialBuild = false;
        console.log('🎯 Initial build complete - file watching active');
      }
    } finally {
      this.isBuilding = false;
    }
  }

  async watch(): Promise<void> {
    console.log('👀 Starting file watcher...');

    const watcher = chokidar.watch(
      [config.postsDir, config.templatesDir, config.stylesDir],
      { ignored: /(^|[/\\])\../, persistent: true, ignoreInitial: true },
    );

    const debouncedBuild = this.debounce(() => this.build(), 300);

    watcher
      .on('change', (f) => {
        console.log(`📝 File changed: ${f}`);
        debouncedBuild();
      })
      .on('add', (f) => {
        console.log(`➕ File added: ${f}`);
        debouncedBuild();
      })
      .on('unlink', (f) => {
        console.log(`🗑️ File removed: ${f}`);
        debouncedBuild();
      });

    console.log('✅ File watcher started. Press Ctrl+C to stop.');

    await this.build();
  }

  private async batchWrite(ops: WriteOperation[]): Promise<void> {
    if (!ops.length) {
      console.log('💾 No files need updating');
      return;
    }

    console.log(`💾 Writing ${ops.length} files...`);
    await Promise.all(ops.map((op) => fs.writeFile(op.path, op.content)));
  }

  private async prepareFeedOperations(
    posts: Post[],
  ): Promise<WriteOperation[]> {
    console.log('📡 Generating feeds...');
    return [
      {
        path: `${config.distDir}/feed.xml`,
        content: FeedGenerator.generateRSS(posts),
      },
      {
        path: `${config.distDir}/atom.xml`,
        content: FeedGenerator.generateAtom(posts),
      },
    ];
  }

  private async prepareSitemapOperations(
    posts: Post[],
  ): Promise<WriteOperation[]> {
    console.log('🗺️ Generating sitemap...');
    return [
      {
        path: `${config.distDir}/sitemap.xml`,
        content: await this.sitemapGenerator.generateContent(posts),
      },
    ];
  }

  private debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
}
