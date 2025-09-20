import { promises as fs } from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import matter from 'gray-matter';
import { config } from '../../config.js';
import {
  FrontmatterValidator,
  PostMetadata,
} from '../../frontmatter-validator.js';

export interface Post extends PostMetadata {
  content: string;
  htmlContent: string;
}

export class PostProcessor {
  private abbreviations: { [key: string]: string } = {};

  constructor() {
    marked.use(markedFootnote());
  }

  private processAbbreviations(content: string): string {
    this.abbreviations = {};

    content = content.replace(
      /\*\[([^\]]+)\]:\s*(.+)/gm,
      (match, abbr, definition) => {
        this.abbreviations[abbr] = definition.trim();
        return '';
      },
    );

    for (const abbr in this.abbreviations) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'g');
      content = content.replace(
        regex,
        `<abbr title="${this.abbreviations[abbr]}">${abbr}</abbr>`,
      );
    }

    return content;
  }

  async loadPosts(): Promise<Post[]> {
    try {
      await fs.access(config.postsDir);
    } catch {
      console.warn('⚠️ Posts directory not found');
      return [];
    }

    const files = await fs.readdir(config.postsDir);
    const postFiles = files.filter((f) => f.endsWith('.md'));

    const posts = await Promise.all(
      postFiles.map(async (file) => {
        const filePath = path.join(config.postsDir, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const { data, content } = matter(fileContent);

        const validation = FrontmatterValidator.validate(data, file);
        validation.warnings.forEach((w) => console.warn(`⚠️ ${w}`));

        if (!validation.isValid) {
          console.error(`❌ Skipping ${file} due to validation errors`);
          return null;
        }

        const processedContent = this.processAbbreviations(content);
        const htmlContent = await marked(processedContent);

        return {
          ...validation.metadata,
          content,
          htmlContent,
        } as Post;
      }),
    );

    return posts
      .filter((p): p is Post => p !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async loadTemplate(templateName: string): Promise<string> {
    const templatePath = path.join(config.templatesDir, templateName);
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }
}
