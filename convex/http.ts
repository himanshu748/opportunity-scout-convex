import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { mail } from "./email";
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(
    async (ctx, request) =>
      await mail.handleWebhook(
        ctx as unknown as Parameters<typeof mail.handleWebhook>[0],
        request,
      ),
  ),
});
registerStaticRoutes(http, components.staticHosting);
export default http;
