import { describe, expect, it } from "vitest";
import { scanBoundary, type BoundaryOptions } from "./boundaryScan";

/** scanBoundary 自体の検査。小さな仮想ファイルの集まりで、見つけるべき壊れ方を見つけるか確かめる。 */

const OPTIONS: BoundaryOptions = {
  answerModules: [/^lib\/bank\/bank[A-Za-z0-9]*$/],
  serverEntry: /^app\/(?:.*\/)?(?:page|layout|route)\.tsx?$|^proxy\.ts$/,
};

const CLIENT = '"use client";\n';
const SERVER_ONLY = 'import "server-only";\n';

const scan = (files: Record<string, string>) => scanBoundary(new Map(Object.entries(files)), OPTIONS);

const BASE: Record<string, string> = {
  "lib/bank/bank.ts": `${SERVER_ONLY}export const BANK = [];`,
  "components/Gauge.tsx": `${CLIENT}export function Gauge() { return null; }\nexport function useGauge() { return 1; }`,
  "components/Panel.tsx": `${CLIENT}export default function Panel() { return null; }`,
};

describe("scanBoundary: クライアント → 答え", () => {
  it('"use client" が答えのモジュールを値として import すると見つける(型だけの import は見逃す)', () => {
    const report = scan({
      ...BASE,
      "components/A.tsx": `${CLIENT}import { BANK } from "@/lib/bank/bank";`,
      "components/B.tsx": `${CLIENT}import type { Item } from "@/lib/bank/bank";\nimport { type X } from "@/lib/bank/bank";`,
    });
    expect(report.answerLeaks).toEqual(["components/A.tsx -> lib/bank/bank"]);
  });

  it("途中の共通モジュールを経由しても見つける", () => {
    const report = scan({
      ...BASE,
      "components/A.tsx": `${CLIENT}import { helper } from "./shared";`,
      "components/shared.ts": `import { BANK } from "../lib/bank/bank";\nexport const helper = BANK;`,
    });
    expect(report.answerLeaks).toEqual(["components/A.tsx -> components/shared -> lib/bank/bank"]);
  });

  it("名前に数字が入っても、再エクスポートや動的 import でも見つける", () => {
    const report = scan({
      ...BASE,
      "lib/bank/bank3.ts": `${SERVER_ONLY}export const BANK3 = [];`,
      "components/A.tsx": `${CLIENT}export { BANK3 } from "@/lib/bank/bank3";`,
      "components/B.tsx": `${CLIENT}const load = () => import("@/lib/bank/bank");`,
    });
    expect(report.answerLeaks).toEqual([
      "components/A.tsx -> lib/bank/bank3",
      "components/B.tsx -> lib/bank/bank",
    ]);
  });
});

describe("scanBoundary: サーバー → クライアントの関数", () => {
  it("入口(page)が、クライアントのファイルから関数や定数を import すると見つける", () => {
    const report = scan({
      ...BASE,
      "app/x/page.tsx": `import { useGauge } from "@/components/Gauge";\nexport default function Page() { return useGauge(); }`,
    });
    expect(report.clientCalls).toEqual(["app/x/page.tsx: useGauge from @/components/Gauge"]);
  });

  it("入口から辿った先のサーバーコンポーネントも見る(入口だけでは見逃していた)", () => {
    const report = scan({
      ...BASE,
      "app/x/page.tsx": `import { Section } from "@/components/Section";\nexport default function Page() { return Section(); }`,
      "components/Section.tsx": `import { useGauge } from "./Gauge";\nexport function Section() { return useGauge(); }`,
    });
    expect(report.clientCalls).toEqual(["components/Section.tsx: useGauge from ./Gauge"]);
  });

  it("default import は、コンポーネントらしい名前のときだけ許す", () => {
    const ok = scan({
      ...BASE,
      "app/x/page.tsx": `import Panel from "@/components/Panel";\nexport default function Page() { return Panel; }`,
    });
    expect(ok.clientCalls).toEqual([]);
    const ng = scan({
      ...BASE,
      "app/x/page.tsx": `import gauge from "@/components/Panel";\nexport default function Page() { return gauge; }`,
    });
    expect(ng.clientCalls).toEqual(["app/x/page.tsx: default gauge from @/components/Panel"]);
  });

  it("再エクスポートや * import も見つける", () => {
    const report = scan({
      ...BASE,
      "app/x/page.tsx": `export { useGauge } from "@/components/Gauge";\nimport * as G from "@/components/Gauge";`,
    });
    expect(report.clientCalls).toEqual([
      "app/x/page.tsx: useGauge from @/components/Gauge",
      "app/x/page.tsx: * from @/components/Gauge",
    ]);
  });

  it("コンポーネントの import・型だけの import・クライアント側の入口は見逃す(誤検知しない)", () => {
    const report = scan({
      ...BASE,
      "app/x/page.tsx": `import { Gauge } from "@/components/Gauge";\nimport type { useGauge } from "@/components/Gauge";\nexport default Gauge;`,
      "app/y/page.tsx": `${CLIENT}import { useGauge } from "@/components/Gauge";\nexport default function P() { return useGauge(); }`,
    });
    expect(report.clientCalls).toEqual([]);
  });
});

describe("scanBoundary: server-only の付け忘れ", () => {
  it("答えのモジュールに import 'server-only' が無いと見つける", () => {
    const report = scan({ "lib/bank/bank2.ts": "export const BANK2 = [];", "lib/bank/bank.ts": `${SERVER_ONLY}export {};` });
    expect(report.missingServerOnly).toEqual(["lib/bank/bank2.ts"]);
  });
});

describe("scanBoundary: 数える", () => {
  it("見つけたファイルの数を返す(空振りに気づけるように)", () => {
    const report = scan({ ...BASE, "app/x/page.tsx": "export default function Page() { return null; }" });
    expect(report.counts).toEqual({ files: 4, client: 2, serverEntries: 1 });
  });
});
