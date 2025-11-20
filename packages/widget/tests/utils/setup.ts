import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { worker } from "../mocks/worker";

vi.setConfig({ testTimeout: 10000 });

beforeAll(() => worker.start({ quiet: true }));
afterEach(() => worker.resetHandlers());
afterAll(() => worker.stop());
