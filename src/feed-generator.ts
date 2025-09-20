import { config } from './config.js';
import { PostMetadata } from './frontmatter-validator.js';

interface FeedPost extends PostMetadata {
  htmlContent: string;
}

export class FeedGenerator {
  static generateRSS(posts: FeedPost[]): string {
    const latestPosts = posts.slice(0, 10);
    const lastBuildDate = new Date().toUTCString();
    const pubDate =
      latestPosts.length > 0
        ? new Date(latestPosts[0].date).toUTCString()
        : lastBuildDate;

    const items = latestPosts
      .map((post) => {
        const postUrl = `${config.siteUrl}/posts/${post.slug}/`;
        const postDate = new Date(post.date).toUTCString();

        return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${post.description}]]></description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${postDate}</pubDate>
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${config.siteTitle}]]></title>
    <description><![CDATA[${config.siteDescription}]]></description>
    <link>${config.siteUrl}</link>
    <atom:link href="${config.siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${pubDate}</pubDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>`;
  }

  static generateAtom(posts: FeedPost[]): string {
    const latestPosts = posts.slice(0, 10);
    const updated =
      latestPosts.length > 0
        ? new Date(latestPosts[0].date).toISOString()
        : new Date().toISOString();

    const entries = latestPosts
      .map((post) => {
        const postUrl = `${config.siteUrl}/posts/${post.slug}/`;
        const postDate = new Date(post.date).toISOString();

        return `  <entry>
    <title type="html"><![CDATA[${post.title}]]></title>
    <link href="${postUrl}"/>
    <updated>${postDate}</updated>
    <id>${postUrl}</id>
    <content type="html"><![CDATA[${post.htmlContent}]]></content>
    <summary type="html"><![CDATA[${post.description}]]></summary>
  </entry>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">${config.siteTitle}</title>
  <link href="${config.siteUrl}/atom.xml" rel="self"/>
  <link href="${config.siteUrl}"/>
  <updated>${updated}</updated>
  <id>${config.siteUrl}/</id>
  <subtitle type="html"><![CDATA[${config.siteDescription}]]></subtitle>
  <generator uri="https://github.com/woulve/zenith" version="1.0.0">Zenith</generator>
${entries}
</feed>`;
  }
}
