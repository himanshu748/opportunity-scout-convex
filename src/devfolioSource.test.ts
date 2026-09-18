import { expect, it } from "vitest";
import { devfolioLinks, devfolioOpportunity } from "./devfolioSource";
const html = (data: unknown) =>
  `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: data } })}</script>`;
const h = {
  slug: "example",
  name: "Example",
  type: "HACKATHON",
  is_online: true,
  settings: {
    reg_starts_at: "2026-09-01T00:00:00Z",
    reg_ends_at: "2026-09-30T12:00:00Z",
  },
};
it("imports the registration deadline rather than the event end", () => {
  expect(
    devfolioOpportunity(
      "https://example.devfolio.co/",
      html({ hackathon: h }),
      Date.UTC(2026, 8, 18),
    )?.deadline,
  ).toBe(Date.UTC(2026, 8, 30, 12));
  expect(
    devfolioOpportunity(
      "https://other.devfolio.co/",
      html({ hackathon: h }),
      Date.UTC(2026, 8, 18),
    ),
  ).toBeNull();
  expect(
    devfolioOpportunity(
      "https://example.devfolio.co/",
      html({ hackathon: h }),
      Date.UTC(2026, 9, 1),
    ),
  ).toBeNull();
});
it("only discovers open event slugs from structured directory data", () => {
  expect(
    devfolioLinks(
      html({
        dehydratedState: {
          queries: [
            {
              state: {
                data: {
                  open_hackathons: [{ slug: "example" }, { slug: "bad/path" }],
                  past_hackathons: [{ slug: "old" }],
                },
              },
            },
          ],
        },
      }),
    ),
  ).toEqual(["https://example.devfolio.co/"]);
});
