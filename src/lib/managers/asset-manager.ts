import { promises as fs } from 'fs';
import * as path from 'path';
import { config } from '../../config.js';

export class AssetManager {
  async ensureDirectories(): Promise<void> {
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

  async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async copyPublicAssets(): Promise<void> {
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
}
