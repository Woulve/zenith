import { promises as fs } from 'fs';
import * as path from 'path';
import { config } from '../../config.js';
import { Post } from '../processors/post-processor.js';
import { Utils } from '../utils.js';

export class SitemapGenerator {
  private readonly postsPerPage = 5;

  async generate(posts: Post[]): Promise<void> {
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
        categories.add(Utils.slugify(category));
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
}
