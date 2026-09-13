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
      {
        source: "/patron",
        destination: "/super-admin",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
