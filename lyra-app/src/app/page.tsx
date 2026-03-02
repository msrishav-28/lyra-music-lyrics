/**
 * src/app/page.tsx
 * Lyra — placeholder root page.
 * This file will be replaced by the full UI in the next milestone.
 * The backend APIs are live at /api/recognize, /api/lyrics, /api/translate.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#07070B', color: 'rgba(255,255,255,0.92)' }}>
      <main className="text-center">
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Lyra</h1>
        <p style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem' }}>
          Backend live · Frontend coming next
        </p>
        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          <div>GET  /api/lyrics</div>
          <div>POST /api/recognize</div>
          <div>POST /api/translate</div>
        </div>
      </main>
    </div>
  );
}
