import { promises as fs } from 'fs';
import * as path from 'path';
import { marked } from 'marked';
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
  async loadPosts(): Promise<Post[]> {
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

  async loadTemplate(templateName: string): Promise<string> {
    const templatePath = path.join(config.templatesDir, templateName);
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }
}
