import { promises as fs } from 'fs';
import * as path from 'path';
import * as sass from 'sass';
import { minify } from 'csso';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import { config } from '../../config.js';

export class StyleCompiler {
  private scssModTime: number = 0;
  private cssModTime: number = 0;
  private isProduction: boolean;

  constructor() {
    this.isProduction =
      process.env.NODE_ENV === 'production' ||
      process.argv.includes('--production');
  }

  async compileIfNeeded(): Promise<void> {
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

        const result = sass.compile(scssFile, {
          style: this.isProduction ? 'compressed' : 'expanded',
          sourceMap: !this.isProduction,
        });

        let css = result.css;

        const postcssResult = await postcss([autoprefixer]).process(css, {
          from: undefined,
          map: !this.isProduction ? { inline: false } : false,
        });
        css = postcssResult.css;

        if (this.isProduction) {
          const minified = minify(css, {
            restructure: true,
            forceMediaMerge: true,
            comments: false,
          });
          css = minified.css;
          console.log(
            `🗜️ CSS minified: ${result.css.length} → ${
              css.length
            } bytes (${Math.round(
              (1 - css.length / result.css.length) * 100,
            )}% reduction)`,
          );
        }

        await fs.writeFile(cssFile, css);

        if (!this.isProduction && postcssResult.map) {
          await fs.writeFile(`${cssFile}.map`, postcssResult.map.toString());
        }
      } else {
        console.log('⏭️ SCSS compilation skipped (no changes)');
      }
    } catch {
      console.warn('⚠️ SCSS file not found, skipping compilation');
    }
  }
}
