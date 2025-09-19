import { promises as fs } from 'fs';
import chokidar from 'chokidar';
import { config } from '../config.js';
import { AssetManager } from './managers/asset-manager.js';
import { StyleCompiler } from './processors/style-compiler.js';
import { PostProcessor } from './processors/post-processor.js';
import { PageGenerator, WriteOperation } from './generators/page-generator.js';
import { SitemapGenerator } from './generators/sitemap-generator.js';
import { FeedGenerator } from '../feed-generator.js';

export class BuildOrchestrator {
  private buildTimeout: NodeJS.Timeout | null = null;
  private isBuilding: boolean = false;

  private assetManager = new AssetManager();
  private styleCompiler = new StyleCompiler();
  private postProcessor = new PostProcessor();
  private pageGenerator = new PageGenerator();
  private sitemapGenerator = new SitemapGenerator();

  async build(): Promise<void> {
    if (this.isBuilding) {
      return;
    }

    this.isBuilding = true;
    console.log('🚀 Starting build...');

    try {
      await this.assetManager.ensureDirectories();
      await this.assetManager.copyPublicAssets();
      await this.styleCompiler.compileIfNeeded();
      const posts = await this.postProcessor.loadPosts();
      const writeOps = await this.pageGenerator.generateAllPages(posts);
      await this.batchWrite(writeOps);
      await this.sitemapGenerator.generate(posts);
      await this.generateFeeds(posts);

      console.log('✅ Build completed!');
    } finally {
      this.isBuilding = false;
    }
  }

  async watch(): Promise<void> {
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

  private async batchWrite(operations: WriteOperation[]): Promise<void> {
    console.log(`💾 Writing ${operations.length} files...`);

    await Promise.all(
      operations.map(async (op) => {
        await fs.writeFile(op.path, op.content);
      }),
    );
  }

  private async generateFeeds(
    posts: Parameters<typeof FeedGenerator.generateRSS>[0],
  ): Promise<void> {
    console.log('📡 Generating RSS and Atom feeds...');

    const rssContent = FeedGenerator.generateRSS(posts);
    const atomContent = FeedGenerator.generateAtom(posts);

    await Promise.all([
      fs.writeFile(`${config.distDir}/feed.xml`, rssContent),
      fs.writeFile(`${config.distDir}/atom.xml`, atomContent),
    ]);
  }
}
