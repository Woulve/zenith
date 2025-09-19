# Minimalistic Personal Blog Static Site Generator

A simple, fast, and elegant static site generator for personal blogs using TypeScript, Markdown, and SCSS.

## Features

- ✅ **Static Site Generation** - Fast, SEO-friendly HTML files
- ✅ **Markdown Support** - Write posts in Markdown with YAML frontmatter
- ✅ **Clean URLs** - `/posts/post-slug/` structure
- ✅ **TypeScript Build System** - Type-safe build process
- ✅ **Development Server** - Live preview during development
- ✅ **Minimalistic Design** - Clean, readable, and fast-loading

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Your First Post

Create a new Markdown file in `src/posts/`:

```markdown
---
title: "My First Post"
date: "2025-09-01"
description: "A brief description of your post"
slug: "my-first-post"
---

# My First Post

Your content goes here...
```

### 3. Build and Serve

```bash
# Build the site
npm run build

# Start development server
npm run dev
```

Your blog will be available at http://localhost:3000

## Project Structure

```
blog/
├── src/
│   ├── posts/           # Markdown blog posts
│   ├── templates/       # HTML templates
│   ├── styles/          # SCSS stylesheets
│   └── build.ts         # Build system
├── dist/                # Generated static files
├── package.json
└── tsconfig.json
```

## Writing Posts

Posts are written in Markdown with YAML frontmatter:

```markdown
---
title: "Post Title"
date: "YYYY-MM-DD"
description: "Brief description"
slug: "url-slug"
---

# Your Content

Write your post content in Markdown...
```

### Required Frontmatter Fields

- `title` - Post title
- `date` - Publication date (YYYY-MM-DD format)
- `description` - Brief description for SEO
- `slug` - URL slug (optional, defaults to filename)

## Customization

### Styling

Edit `src/styles/main.scss` to customize the design. The stylesheet uses:

- CSS variables for easy theming
- Responsive design principles
- Clean typography
- Minimalistic color scheme

### Templates

Modify HTML templates in `src/templates/`:

- `index.html` - Homepage template
- `post.html` - Individual post template
- `base.html` - Base template (currently unused)

### Build System

The build process (`src/build.ts`):

1. Parses Markdown files with frontmatter
2. Converts Markdown to HTML
3. Applies templates with variable substitution
4. Compiles SCSS to CSS
5. Generates clean URL structure

## Scripts

- `npm run build` - Build the static site
- `npm run dev` - Build and start development server
- `npm run clean` - Clean the dist directory

## Deployment

The generated `dist/` folder contains your complete static site. Deploy it to any static hosting service:

- **Netlify** - Drag and drop the `dist` folder
- **Vercel** - Connect your repository
- **GitHub Pages** - Upload the `dist` contents
- **Any web server** - Copy `dist` contents to web root

## License

MIT License - feel free to use this for your personal blog!