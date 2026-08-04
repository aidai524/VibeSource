import { describe, expect, it } from "vitest";

import { eligibilityCriteria, navigationItems } from "./content";

describe("public launch content", () => {
  it("keeps the three required eligibility checks explicit", () => {
    expect(eligibilityCriteria.map(({ title }) => title)).toEqual([
      "公开源码",
      "真实体验",
      "来源可追溯",
    ]);
  });

  it("uses unique site-root links that also work from workflow pages", () => {
    const hrefs = navigationItems.map(({ href }) => href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual(["/", "/#criteria", "/#about"]);
  });
});
