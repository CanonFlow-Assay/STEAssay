import { expect, test, type Page } from "@playwright/test";

const loadSample = async (
  page: Page,
  sample: "compliant" | "offender" | "custom",
): Promise<void> => {
  await page.getByLabel("Sample", { exact: true }).selectOption(sample);
  await page.getByRole("button", { name: "Load selected sample" }).click();
};

const runPreview = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Run local preview" }).click();
};

const findings = (page: Page) =>
  page.getByTestId("finding-list").getByRole("listitem");

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

test("compliant sample has no findings or safe correction action", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page, "compliant");
  await runPreview(page);

  await expect(page.getByTestId("result-summary")).toHaveText(
    "0 findings: 0 blocking, 0 advisory.",
  );
  await expect(findings(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply all safe corrections" }),
  ).toBeDisabled();
});

test("offender sample reports the expected preview findings", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page, "offender");
  await runPreview(page);

  await expect(page.getByTestId("preview-notice")).toBeVisible();
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

test("safe corrections change only configured replacement terms", async ({
  page,
}) => {
  await page.goto("/");
  await loadSample(page, "offender");
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
  await loadSample(page, "custom");
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
  await loadSample(page, "custom");
  await page.getByLabel("Banned terms, comma-separated").fill("cat");
  await page
    .getByLabel("Markdown (local preview input)")
    .fill("scat catapult cat écat caté котcat catёж cat2 2cat cat_value _cat");
  await runPreview(page);

  await expect(findings(page).filter({ hasText: "STE-S04" })).toHaveCount(1);
  await expect(findings(page)).toContainText(
    "Configured banned term occurs: cat.",
  );
});
