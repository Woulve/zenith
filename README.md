# Zenith

A minimalistic static site generator built with TypeScript, SCSS, and HTML.

## What it does

Zenith transforms markdown posts into a complete static blog website. It processes markdown files with frontmatter, compiles SCSS styles, generates HTML pages using templates, and creates RSS/Atom feeds and sitemaps. The build system includes intelligent file change detection to avoid unnecessary rebuilds.

## What's special

Built entirely in TypeScript with a modular architecture featuring separate processors for posts, styles, and page generation. Includes a sophisticated build orchestrator with file watching, content hashing for efficient rebuilds, and batch operations. Supports live development with automatic rebuilding and browser refresh. Features automatic deployment to GitHub Pages via GitHub Actions workflows.

## How to run

Install dependencies:
```
npm install
```

Build the site:
```
npm run build
```

Development with live reload:
```
npm run dev
```

The development server runs on http://localhost:3000/zenith with automatic rebuilding when files change.