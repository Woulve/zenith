import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BlogConfig {
  projectRoot: string;
  srcDir: string;
  distDir: string;
  postsDir: string;
  templatesDir: string;
  stylesDir: string;
  publicDir: string;
  siteTitle: string;
  siteDescription: string;
  baseUrl: string;
}

export const config: BlogConfig = {
  projectRoot: path.join(__dirname, '..'),
  srcDir: path.join(__dirname, '..', 'src'),
  distDir: path.join(__dirname, '..', 'dist'),
  postsDir: path.join(__dirname, '..', 'src', 'posts'),
  templatesDir: path.join(__dirname, '..', 'src', 'templates'),
  stylesDir: path.join(__dirname, '..', 'src', 'styles'),
  publicDir: path.join(__dirname, '..', 'public'),
  siteTitle: 'Zenith',
  siteDescription: 'A minimalistic personal blog',
  baseUrl: 'https://domain.com',
};
