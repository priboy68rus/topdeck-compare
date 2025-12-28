export default function Loading() {
  return (
    <main>
      <div className="card" style={{ textAlign: "center" }}>
        <div className="spinner" />
        <h2 style={{ marginTop: 12 }}>Fetching comparison…</h2>
        <p className="muted">Loading Moxfield and Topdeck data.</p>
      </div>
    </main>
  );
}
