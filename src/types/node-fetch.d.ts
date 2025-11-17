declare module "node-fetch" {
  const fetch: (url: string, init?: any) => Promise<any>;
  export default fetch;
}
