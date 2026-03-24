import { describe, expect, test } from "bun:test";

describe("createMobileRequest", () => {
  test("bootstraps correctly when the method is called without its request object context", async () => {
    const { createMemoryMobileRequest } = await import("./request");

    const request = createMemoryMobileRequest();
    const { bootstrap } = request;
    const bootstrapped = await bootstrap({});

    expect(bootstrapped.sheets).toHaveLength(1);
    expect(bootstrapped.activeSheet.title).toBe("Untitled");
  });

  test("bootstraps with a starter sheet and persists updates", async () => {
    const { createMemoryMobileRequest } = await import("./request");

    const request = createMemoryMobileRequest();
    const bootstrapped = await request.bootstrap({});

    expect(bootstrapped.sheets).toHaveLength(1);
    expect(bootstrapped.activeSheet.title).toBe("Untitled");

    const firstSheet = bootstrapped.activeSheet;
    const updated = await request.updateSheet({
      id: firstSheet.id,
      body: "2 + 2",
      title: firstSheet.title,
    });

    expect(updated.body).toBe("2 + 2");

    const reloaded = await request.bootstrap({});

    expect(reloaded.activeSheet.id).toBe(firstSheet.id);
    expect(reloaded.activeSheet.body).toBe("2 + 2");
  });

  test("derives sheet tags from hashtag lines in the body", async () => {
    const { createMemoryMobileRequest } = await import("./request");

    const request = createMemoryMobileRequest();
    const bootstrapped = await request.bootstrap({});

    const updated = await request.updateSheet({
      id: bootstrapped.activeSheet.id,
      body: "#travel #berlin\n\nTrip budget\nFlights: 200",
      title: bootstrapped.activeSheet.title,
    });

    expect(updated.tags).toEqual(["berlin", "travel"]);
    expect(updated.title).toBe("Untitled");

    const results = await request.searchSheets({
      query: "",
      tags: ["travel"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(bootstrapped.activeSheet.id);
  });
});
