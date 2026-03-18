import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Menambahkan turbopack kosongan untuk menghilangkan pesan error di Next 15+ / 16
    turbopack: {},
};

export default withPWA(nextConfig);
