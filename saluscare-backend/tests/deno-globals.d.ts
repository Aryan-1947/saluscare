// Typecheck shims: the unit tests import modules written for Deno edge
// functions, whose "npm:" import specifiers Node's tsc cannot resolve.
// These ambient declarations type the imported names loosely - real type
// checking for the edge-function sources happens under Deno (deploy time).
declare module "npm:@supabase/supabase-js@2" {
  export type SupabaseClient = any;
}

declare module "npm:groq-sdk@1" {
  class Groq {
    chat: any;
    constructor(options?: any);
  }
  export default Groq;
}
