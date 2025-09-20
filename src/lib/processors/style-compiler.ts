import { promises as fs } from 'fs';
import * as path from 'path';
import { minify } from 'csso';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import * as sass from 'sass';
import fg from 'fast-glob';
import { config } from '../../config.js';

export class StyleCompiler {
  private isProduction =
    process.env.NODE_ENV === 'production' ||
    process.argv.includes('--production');

  async compileIfNeeded(): Promise<void> {
    const scssFile = path.join(config.stylesDir, 'main.scss');
    const outputFile = path.join(config.distDir, 'styles', 'main.css');

    try {
      const needsCompile = await this.needsRecompile(scssFile, outputFile);
      if (!needsCompile) {
        console.log('⏭️ SCSS compilation skipped (no changes)');
        return;
      }

      console.log('🎨 Compiling SCSS...');
      await fs.mkdir(path.dirname(outputFile), { recursive: true });

      const sassResult = sass.compile(scssFile, {
        style: this.isProduction ? 'compressed' : 'expanded',
        sourceMap: !this.isProduction,
        loadPaths: [config.stylesDir],
      });

      const result = await postcss([autoprefixer]).process(sassResult.css, {
        from: scssFile,
        to: outputFile,
        map:
          !this.isProduction && sassResult.sourceMap
            ? {
                prev: sassResult.sourceMap,
                inline: false,
              }
            : false,
      });

      let css = result.css;
      if (this.isProduction) {
        const minified = minify(css, {
          restructure: true,
          forceMediaMerge: true,
          comments: false,
        });
        console.log(
          `🗜️ Minified: ${css.length} → ${minified.css.length} bytes`,
        );
        css = minified.css;
      }

      await fs.writeFile(outputFile, css);
      if (!this.isProduction && result.map) {
        await fs.writeFile(`${outputFile}.map`, result.map.toString());
      }
    } catch (err) {
      console.warn(
        '⚠️ SCSS compilation failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async needsRecompile(
    scssFile: string,
    outputFile: string,
  ): Promise<boolean> {
    const [scssTime, outputTime, templateTime, scssFilesTime] =
      await Promise.all([
        this.getModTime(scssFile),
        this.getModTime(outputFile),
        this.getLatestTemplateTime(),
        this.getLatestScssTime(),
      ]);
    return (
      scssTime > outputTime ||
      templateTime > outputTime ||
      scssFilesTime > outputTime
    );
  }

  private async getLatestTemplateTime(): Promise<number> {
    const [templateFiles, srcFiles] = await Promise.all([
      fg(['**/*.{html,ts}'], {
        cwd: config.templatesDir,
        absolute: true,
      }),
      fg(['**/*.{html,ts}'], {
        cwd: config.srcDir,
        absolute: true,
      }),
    ]);
    const files = [...templateFiles, ...srcFiles];
    const times = await Promise.all(files.map(this.getModTime));
    return Math.max(0, ...times);
  }

  private async getLatestScssTime(): Promise<number> {
    const scssFiles = await fg(['**/*.scss'], {
      cwd: config.stylesDir,
      absolute: true,
    });
    const times = await Promise.all(scssFiles.map(this.getModTime));
    return Math.max(0, ...times);
  }

  private async getModTime(file: string): Promise<number> {
    try {
      return (await fs.stat(file)).mtimeMs;
    } catch {
      return 0;
    }
  }

  getCSSPath(): string {
    return `${config.baseUrl}/styles/main.css`;
  }
}
