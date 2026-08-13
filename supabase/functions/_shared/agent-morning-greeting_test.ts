import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMorningPlan,
  fetchWeatherBrief,
  nextAgentInRotation,
  shouldStopMorningHop,
} from "./agent-morning-greeting.ts";

Deno.test("rotation: следующий по кругу", () => {
  const order = ["karina", "saule", "amina", "anton", "alina", "muha"];
  assertEquals(nextAgentInRotation(order, null), "karina");
  assertEquals(nextAgentInRotation(order, "karina"), "saule");
  assertEquals(nextAgentInRotation(order, "saule"), "amina");
  assertEquals(nextAgentInRotation(order, "muha"), "karina"); // wrap
});

Deno.test("rotation: неизвестный last → первый", () => {
  assertEquals(nextAgentInRotation(["a", "b"], "zzz"), "a");
});

Deno.test("buildMorningPlan: стартер + лимит hop", () => {
  const plan = buildMorningPlan("amina", ["karina", "saule", "amina", "anton"], 3);
  assertEquals(plan[0], "amina");
  assertEquals(plan.length, 3);
  assert(!plan.slice(1).includes("amina"));
});

Deno.test("weather graceful degradation при недоступном API", async () => {
  const fetchFn = () => {
    throw new Error("network down");
  };
  // deno-lint-ignore no-explicit-any
  const brief = await fetchWeatherBrief(["FailCityXYZ"], fetchFn as any);
  assertEquals(brief.ok, false);
  assertEquals(brief.lines.length, 0);
  assert(brief.error);
});

Deno.test("weather ok при валидном моке", async () => {
  // deno-lint-ignore no-explicit-any
  const fetchFn = (url: string): Promise<any> => {
    if (String(url).includes("geocoding")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ name: "MockCity", latitude: 42.87, longitude: 74.59 }],
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          daily: {
            weather_code: [0],
            temperature_2m_max: [28.2],
            temperature_2m_min: [16.4],
          },
        }),
    });
  };
  // deno-lint-ignore no-explicit-any
  const brief = await fetchWeatherBrief(["MockCity"], fetchFn as any);
  assertEquals(brief.ok, true);
  assert(brief.lines[0].includes("MockCity"));
  assert(brief.lines[0].includes("ясно"));
});

Deno.test("hop стоп на MAX_HOPS — не зацикливается", () => {
  const visited = new Set<string>(["karina", "saule"]);
  assertEquals(
    shouldStopMorningHop({
      hop: 2,
      maxHops: 3,
      visited,
      targetAgent: "amina",
      reply: "Доброе, Сауле 👍",
    }),
    true,
  );
  assertEquals(
    shouldStopMorningHop({
      hop: 1,
      maxHops: 3,
      visited: new Set(["karina"]),
      targetAgent: "saule",
      reply: "готово",
    }),
    true,
  );
  assertEquals(
    shouldStopMorningHop({
      hop: 1,
      maxHops: 3,
      visited: new Set(["karina"]),
      targetAgent: "saule",
      reply: "Доброе утро!",
    }),
    false,
  );
});
