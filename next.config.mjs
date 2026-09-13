/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/yeni-arac",
        destination: "/yeni",
        permanent: true,
      },
      {
        source: "/kayit",
        destination: "/yeni",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
