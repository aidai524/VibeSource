import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("production auth route", () => {
  it("fails closed when external identity configuration is absent", async () => {
    const getResponse = await GET(new Request("http://localhost/api/auth/get-session"));
    const postResponse = await POST(new Request("http://localhost/api/auth/sign-in/social", {
      method: "POST",
    }));

    expect(getResponse.status).toBe(503);
    expect(postResponse.status).toBe(503);
    await expect(getResponse.json()).resolves.toMatchObject({
      message: "生产 GitHub 身份登录尚未配置。",
    });
  });
});
