// Next.js App Router: provide favicon via generateIcon
export const size = 32;
export const contentType = 'image/png';

// Serve the PNG in /public as favicon
export default async function Icon() {
  const res = await fetch(
    new URL('/yardura-logo.png', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
  );
  const arrayBuffer = await res.arrayBuffer();
  return new Response(arrayBuffer, { headers: { 'Content-Type': contentType } }) as unknown as any;
}
