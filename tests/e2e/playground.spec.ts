import { expect, test, type Page } from "@playwright/test";
import {
  bundledExamples,
  type PlaygroundExample,
} from "../../playground/samples.js";

const loadExample = async (page: Page, id: string): Promise<void> => {
  await page.getByLabel("Examples", { exact: true }).selectOption(id);
  await page.getByRole("button", { name: "Load example" }).click();
};

const runPreview = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Run local preview" }).click();
};

const findings = (page: Page) =>
  page.getByTestId("finding-list").getByRole("listitem");

const expectedSummary = (example: PlaygroundExample): string =>
  `${example.expected.ruleIds.length} findings: ${example.expected.blockingCount} blocking, ${example.expected.advisoryCount} advisory.`;

const expectFindingIds = async (
  page: Page,
  ruleIds: readonly string[],
): Promise<void> => {
  for (const ruleId of ruleIds) {
    await expect(findings(page).filter({ hasText: ruleId })).toHaveCount(1);
  }
};

test("initial load uses local static assets only", async ({
  page,
  baseURL,
}) => {
  const requests: { readonly url: string; readonly type: string }[] = [];
  page.on("request", (request) => {
    requests.push({ url: request.url(), type: request.resourceType() });
  });

  await page.goto("/");
  await expect(page.getByTestId("preview-notice")).toBeVisible();
  await expect(page.getByTestId("preview-notice")).toHaveText(
    "Preview only — non-authoritative",
  );

  const localOrigin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
  const remoteRequests = requests.filter(
    (request) => new URL(request.url).origin !== localOrigin,
  );
  const activeNetworkRequests = requests.filter((request) =>
    ["beacon", "eventsource", "fetch", "websocket", "xhr"].includes(
      request.type,
    ),
  );
  expect(remoteRequests).toEqual([]);
  expect(activeNetworkRequests).toEqual([]);
});

for (const example of bundledExamples) {
  test(`bundled example: ${example.title}`, async ({ page }) => {
    await page.goto("/");
    await loadExample(page, example.id);
    await runPreview(page);

    await expect(page.getByTestId("preview-notice")).toBeVisible();
    await expect(page.locator("#example-title")).toHaveText(example.title);
    await expect(page.locator("#example-source-note")).toHaveText(
      "Bundled demonstration specimen. Not an external compliance claim.",
    );
    await expect(page.getByTestId("expected-result")).toContainText(
      `${example.expected.blockingCount} blocking, ${example.expected.advisoryCount} advisory.`,
    );
    await expect(page.getByTestId("observed-result")).toHaveText(
      `Observed: ${expectedSummary(example)}`,
    );
    await expect(page.getByTestId("result-summary")).toHaveText(
      expectedSummary(example),
    );
    await expect(findings(page)).toHaveCount(example.expected.ruleIds.length);
    await expectFindingIds(page, example.expected.ruleIds);
    await expect(page.getByTestId("playground-regression")).toHaveText(
      "Observed result matches this bundled specimen.",
    );
  });
}

test("compliant installation guide has no findings or safe correction action", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "installation-guide");
  await runPreview(page);

  await expect(page.getByTestId("result-summary")).toHaveText(
    "0 findings: 0 blocking, 0 advisory.",
  );
  await expect(findings(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply all safe corrections" }),
  ).toBeDisabled();
});

test("release procedure offender reports all expected preview findings", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "release-procedure-offender");
  await runPreview(page);

  await expect(page.getByTestId("result-summary")).toHaveText(
    "8 findings: 4 blocking, 4 advisory.",
  );
  await expectFindingIds(page, [
    "STE-S01",
    "STE-S02",
    "STE-S04",
    "STE-S05",
    "STE-S06",
    "STE-S08",
    "STE-S09",
    "STE-S10",
  ]);
});

test("loading an example changes text and policy, then reset restores both", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "release-procedure-offender");
  const markdown = page.getByLabel("Markdown (local preview input)");
  await expect(markdown).toHaveValue(/robust whitelist daemon/u);
  await expect(page.getByLabel("Sentence word limit")).toHaveValue("12");
  await expect(page.getByLabel("Banned terms, comma-separated")).toHaveValue(
    "robust",
  );

  await loadExample(page, "api-reference-note");
  await expect(markdown).toHaveValue(/SDK response/u);
  await expect(page.getByLabel("Banned terms, comma-separated")).toHaveValue(
    "",
  );

  await markdown.fill("User edits stay local.");
  await page.getByLabel("Sentence word limit").fill("4");
  await runPreview(page);
  await expect(page.getByTestId("playground-regression")).toContainText(
    "user-edited local input",
  );
  await page.getByRole("button", { name: "Reset to example policy" }).click();
  await expect(markdown).toHaveValue(/The API returns an SDK response/u);
  await expect(page.getByLabel("Sentence word limit")).toHaveValue("12");
});

test("custom text stays local and does not change a bundled source specimen", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "custom");
  const markdown = page.getByLabel("Markdown (local preview input)");
  await markdown.fill("User-written custom text.");
  await runPreview(page);
  await loadExample(page, "installation-guide");
  await expect(markdown).toHaveValue(/# Install the tool/u);
  await expect(markdown).not.toHaveValue(/User-written custom text/u);
});

test("safe corrections change only configured replacement terms", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "release-procedure-offender");
  await page
    .getByRole("button", { name: "Apply all safe corrections" })
    .click();

  const markdown = page.getByLabel("Markdown (local preview input)");
  await expect(markdown).toHaveValue(/allow list/u);
  await expect(markdown).toHaveValue(/service/u);
  await expect(markdown).toHaveValue(/robust/u);
  await expect(markdown).toHaveValue(/Open and run/u);
  await expect(markdown).not.toHaveValue(/whitelist/u);
  await expect(markdown).not.toHaveValue(/daemon/u);

  await runPreview(page);
  await expectFindingIds(page, [
    "STE-S01",
    "STE-S02",
    "STE-S04",
    "STE-S05",
    "STE-S06",
    "STE-S09",
  ]);
  await expect(findings(page).filter({ hasText: "STE-S08" })).toHaveCount(0);
  await expect(findings(page).filter({ hasText: "STE-S10" })).toHaveCount(0);
});

test("custom policy updates locally and reports invalid data without a crash", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "custom");
  await page
    .getByLabel("Markdown (local preview input)")
    .fill("The squirrel needs review.");
  const banned = page.getByLabel("Banned terms, comma-separated");
  await banned.fill("squirrel");
  await runPreview(page);
  await expect(findings(page).filter({ hasText: "STE-S04" })).toHaveCount(1);
  await expect(findings(page)).toContainText(
    "Configured banned term occurs: squirrel.",
  );

  await banned.fill("otter");
  await runPreview(page);
  await expect(page.getByTestId("result-summary")).toHaveText(
    "0 findings: 0 blocking, 0 advisory.",
  );

  await page.getByLabel("Glossary abbreviations as JSON").fill("{ invalid");
  await runPreview(page);
  await expect(page.getByRole("alert")).toContainText("Local policy error:");
  await expect(page.getByTestId("preview-notice")).toBeVisible();
});

test("Unicode whole-term boundaries report only standalone cat", async ({
  page,
}) => {
  await page.goto("/");
  await loadExample(page, "unicode-boundary");
  await runPreview(page);

  await expect(findings(page).filter({ hasText: "STE-S04" })).toHaveCount(1);
  await expect(findings(page)).toContainText(
    "Configured banned term occurs: cat.",
  );
});
