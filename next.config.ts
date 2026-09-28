import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // standalone: готовая сборка с минимальным набором модулей — её можно запустить на сервере
  // без npm install и без сборки (см. scripts/build-server.sh и ветку server-build)
  output: 'standalone',
};

export default nextConfig;
