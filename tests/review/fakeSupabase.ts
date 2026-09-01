import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Row = Record<string, unknown>;

export interface Filter {
  op: "eq" | "gte" | "lt" | "is" | "in" | "not";
  column: string;
  value: unknown;
}

export interface QueryCall {
  table: string;
  operation: "select" | "insert" | "update" | "upsert";
  columns?: string;
  payload?: Row | Row[];
  options?: Row;
  filters: readonly Filter[];
  order?: { column: string; ascending: boolean };
  limit?: number;
}

export type TableHandler = (call: QueryCall) => Row[] | { error: { message: string } };

export interface FakeSupabaseOptions {
  tables: Record<string, TableHandler>;
  rpc?: (name: string, args: Row) => { data: unknown; error: { message: string } | null };
}

const resolveCall = (handler: TableHandler | undefined, call: QueryCall) => {
  if (!handler) return { data: null, error: { message: `no handler for ${call.table}` } };
  const result = handler(call);
  return Array.isArray(result) ? { data: result, error: null } : { data: null, error: result.error };
};

const builder = (handler: TableHandler | undefined, call: QueryCall, log: QueryCall[]): Row => {
  const next = (patch: Partial<QueryCall>) => builder(handler, { ...call, ...patch }, log);
  const filter = (op: Filter["op"]) => (column: string, value: unknown) =>
    next({ filters: [...call.filters, { op, column, value }] });
  const finish = () => {
    log.push(call);
    return resolveCall(handler, call);
  };
  return {
    select: (columns = "*") => next({ columns, operation: call.payload ? call.operation : "select" }),
    insert: (payload: Row | Row[]) => next({ operation: "insert", payload }),
    update: (payload: Row) => next({ operation: "update", payload }),
    upsert: (payload: Row | Row[], options?: Row) => next({ operation: "upsert", payload, options }),
    eq: filter("eq"),
    gte: filter("gte"),
    lt: filter("lt"),
    is: filter("is"),
    in: filter("in"),
    not: (column: string, _operator: string, value: unknown) =>
      next({ filters: [...call.filters, { op: "not", column, value }] }),
    order: (column: string, options?: { ascending?: boolean }) =>
      next({ order: { column, ascending: options?.ascending ?? true } }),
    limit: (limit: number) => next({ limit }),
    maybeSingle: async () => {
      const result = finish();
      return { data: result.data?.[0] ?? null, error: result.error };
    },
    single: async () => {
      const result = finish();
      return result.error
        ? { data: null, error: result.error }
        : { data: result.data?.[0] ?? null, error: result.data?.[0] ? null : { message: "no rows" } };
    },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(finish()).then(resolve, reject),
  };
};

/**
 * PostgREST 風のチェーン(from → select/insert/upsert/update → eq/order/limit → maybeSingle/single/await)
 * とテーブル別ハンドラ、rpc スパイを持つ最小の Supabase モック。
 */
export const fakeSupabase = (options: FakeSupabaseOptions) => {
  const calls: QueryCall[] = [];
  const rpcCalls: { name: string; args: Row }[] = [];
  const client = {
    from: (table: string) =>
      builder(options.tables[table], { table, operation: "select", filters: [] }, calls),
    rpc: async (name: string, args: Row) => {
      rpcCalls.push({ name, args });
      return options.rpc ? options.rpc(name, args) : { data: null, error: { message: "no rpc" } };
    },
  };
  return { client: client as unknown as Supabase, calls, rpcCalls };
};

export const callsFor = (calls: readonly QueryCall[], table: string, operation?: QueryCall["operation"]) =>
  calls.filter((call) => call.table === table && (!operation || call.operation === operation));

export const filterValue = (call: QueryCall, column: string) =>
  call.filters.find((filter) => filter.column === column)?.value;
