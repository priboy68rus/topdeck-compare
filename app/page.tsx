const DEFAULT_MOXFIELD =
  "https://moxfield.com/decks/f0SowVSXpke3iMZunOGF4Q";
const DEFAULT_TOPDECK =
  "https://topdeck.ru/forums/topic/335343-%D0%BE%D0%B1%D0%BC%D0%B5%D0%BD%D0%BD%D0%B8%D0%BA-sol%D0%B0-%D0%BC%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%D0%BF%D0%BE%D1%87%D1%82%D0%B0-%D0%BE%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-1612/?tab=comments#comment-1557231";

export default function Home() {
  return (
    <main>
      <div className="card">
        <h1>Topdeck Compare</h1>
        <p>
          Paste a Moxfield wishlist URL and a Topdeck forum listing URL. We will
          fetch both pages and show which cards appear in the listing along with
          their prices.
        </p>
        <form action="/compare" method="get">
          <label htmlFor="moxfieldUrl">
            <span>Moxfield wishlist URL</span>
            <input
              id="moxfieldUrl"
              name="moxfieldUrl"
              type="url"
              required
              defaultValue={DEFAULT_MOXFIELD}
              placeholder="https://moxfield.com/decks/..."
            />
          </label>
          <label htmlFor="topdeckUrl">
            <span>Topdeck forum page URL</span>
            <input
              id="topdeckUrl"
              name="topdeckUrl"
              type="url"
              required
              defaultValue={DEFAULT_TOPDECK}
              placeholder="https://topdeck.ru/forums/topic/..."
            />
          </label>
          <button type="submit">Compare cards</button>
        </form>
      </div>
    </main>
  );
}
