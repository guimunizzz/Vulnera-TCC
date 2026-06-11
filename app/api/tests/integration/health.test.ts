import request from "supertest";
import { app } from "../../src/app";

describe("GET /api/health", () => {
  it("retorna 200 com status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
    expect(typeof res.body.uptime).toBe("number");
  });
});
