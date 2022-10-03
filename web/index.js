// @ts-check


// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import cookieParser from "cookie-parser";
import { Shopify, LATEST_API_VERSION, DeliveryMethod } from "@shopify/shopify-api";
import applyAuthMiddleware from "./middleware/auth.js";
import verifyRequest from "./middleware/verify-request.js";
import { setupGDPRWebHooks } from "./gdpr.js";
import productCreator from "./helpers/product-creator.js";
import redirectToAuth from "./helpers/redirect-to-auth.js";
import { BillingInterval } from "./helpers/ensure-billing.js";
import { AppInstallations } from "./app_installations.js";
import bodyparser from 'body-parser'
import crypto from 'crypto'

const router = express.Router();

const USE_ONLINE_TOKENS = false;

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

// TODO: There should be provided by env vars
const DEV_INDEX_PATH = `${process.cwd()
    }/frontend/`;
const PROD_INDEX_PATH = `${process.cwd()
    }/frontend/dist/`;

const DB_PATH = `${process.cwd()
    }/database.sqlite`;


Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/https?:\/\//, ""),
    HOST_SCHEME: process.env.HOST.split("://")[0],
    API_VERSION: LATEST_API_VERSION,
    IS_EMBEDDED_APP: true,

    // This should be replaced with your preferred storage strategy
    SESSION_STORAGE: new Shopify.Session.SQLiteSessionStorage(DB_PATH)
});

Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
    path: "/api/webhooks",
    webhookHandler: async (_topic, shop, _body) => {
        await AppInstallations.delete(shop);
    }
});


// The transactions with Shopify will always be marked as test transactions, unless NODE_ENV is production.
// See the ensureBilling helper to learn more about billing in this template.
const BILLING_SETTINGS = {
    required: false,
    // This is an example configuration that would do a one-time charge for $5 (only USD is currently supported)
    // chargeName: "My Shopify One-Time Charge",
    // amount: 5.0,
    // currencyCode: "USD",
    // interval: BillingInterval.OneTime,
};

// This sets up the mandatory GDPR webhooks. You’ll need to fill in the endpoint
// in the “GDPR mandatory webhooks” section in the “App setup” tab, and customize
// the code when you store customer data.
//
// More details can be found on shopify.dev:
// https://shopify.dev/apps/webhooks/configuration/mandatory-webhooks
setupGDPRWebHooks("/api/webhooks");

// export for test use only
export async function createServer(root = process.cwd(), isProd = process.env.NODE_ENV === "production", billingSettings = BILLING_SETTINGS) {
    const app = express();

    app.set("use-online-tokens", USE_ONLINE_TOKENS);
    app.use(cookieParser(Shopify.Context.API_SECRET_KEY));
    app.use(express.json())
    applyAuthMiddleware(app, { billing: billingSettings });

    // Do not call app.use(express.json()) before processing webhooks with
    // Shopify.Webhooks.Registry.process().
    // See https://github.com/Shopify/shopify-api-node/blob/main/docs/usage/webhooks.md#note-regarding-use-of-body-parsers
    // for more details.
    app.post("/api/webhooks", async (req, res) => {
        try {
            await Shopify.Webhooks.Registry.process(req, res);
            console.log(`Webhook processed, returned status code 200`);
        } catch (e) {
            console.log(`Failed to process webhook: ${e.message
                }`);
            if (!res.headersSent) {
                res.status(500).send(e.message);
            }
        }
    });
    app.use(bodyparser.raw({ type: "application/json" }));


    // All endpoints after this point will require an active session
    app.use("/api/*", verifyRequest(app, { billing: billingSettings }));


   
   
   

    // All endpoints after this point will have access to a request.body
    // attribute, as a result of the express.json() middleware
    app.use(express.json());

    app.get("/api/products/count", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, app.get("use-online-tokens"));
    const { Product } = await import(`@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION
      }/index.js`);

    const countData = await Product.count({ session });
    res.status(200).send(countData);
  });
  app.post("/api/discount-code/create", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    const { DiscountCode } = await import(`@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`);

    try {
      const discount_code = new DiscountCode({ session: session });
      discount_code.price_rule_id = 921049432193;
      discount_code.code = "OP50RE";
      const discount = await discount_code.save({
        update: true,
      });
      console.log("disount", discount);
      res.status(200).json({ success: true, message: "Discount Code created successfully", discount })
    } catch (error) {
      res.status(200).json({ success: false, error })
      console.log("Errroor", error);
    }
  })

  app.post("/api/price-rule", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );

    const { PriceRule } = await import(`@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`);

    try {
      const price_rule = new PriceRule({ session });
      price_rule.title = "60%OFF";
      price_rule.target_type = "line_item";
      price_rule.target_selection = "all";
      price_rule.allocation_method = "across";
      price_rule.value_type = "fixed_amount";
      price_rule.value = "-60.0";
      price_rule.customer_selection = "all";
      price_rule.starts_at = "2022-07-06T09:04:38-04:00";
      const priceRule_20 = await price_rule.save({
        update: true,
      });
      res.status(200).json({ success: true, priceRule_20 })
      console.log(priceRule_20);
    } catch (e) {
      console.log(`Error`, e);
      res.status(500).json({ error: e });
    }
  });



  app.post('/api/orders', async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, app.get("use-online-tokens"));
    try {
      const {Order} = await import(`@shopify/shopify-api/dist/rest-resources/${LATEST_API_VERSION}/index.js`)
        const client = new Shopify.Clients.Graphql(session.shop, session.accessToken);
        const { reverseValue, searchCategory, forwardCursor, backwardCursor, firstNumProd, lastNumProd } = req.body
        console.log("forwardcursor", forwardCursor);
        const OrdersCount = await Order.count({
          session: session,
          status: "any",
        });
        const OrdersCount2 = {count:0}
        const variables = {
            "numProds": 7,
            "ForwardCursor": forwardCursor,
            "BackwardCursor": backwardCursor
        }
        const data = await client.query({
            data: {
                query: `query ($numProds: Int!, $ForwardCursor: String, $BackwardCursor: String) {
                    orders(reverse:${reverseValue}, first: ${firstNumProd}, after: $ForwardCursor, last: ${lastNumProd}, before: $BackwardCursor) {
                      edges {
                        cursor
                        node {
                          id
                          totalPrice
                          name
                          email
                          discountCode
                          lineItems(first: 10) {
                            nodes {
                              name
                              title
                              variantTitle
                              id
                            }
                          }
                        }
                      }
                      pageInfo {
                        startCursor
                        hasNextPage
                        hasPreviousPage
                        endCursor
                      }
                    }
                  }
                  `,

                variables: variables
            }

        });
        res.status(200).json({data, OrdersCount,success:true});
        // console.log("Data", data);
    } catch (error) {
        console.log("Error" + error);
        res.status(200).json({error, success:false});
    }
})
    app.use((req, res, next) => {
        const shop = Shopify.Utils.sanitizeShop(req.query.shop);
        if (Shopify.Context.IS_EMBEDDED_APP && shop) {
            res.setHeader("Content-Security-Policy", `frame-ancestors https://${encodeURIComponent(shop)
                } https://admin.shopify.com;`);
        } else {
            res.setHeader("Content-Security-Policy", `frame-ancestors 'none';`);
        }
        next();
    });

    if (isProd) {
        const compression = await import("compression").then(({ default: fn }) => fn);
        const serveStatic = await import("serve-static").then(({ default: fn }) => fn);
        app.use(compression());
        app.use(serveStatic(PROD_INDEX_PATH, { index: false }));
    }

    app.use("/*", async (req, res, next) => {
        if (typeof req.query.shop !== "string") {
            res.status(500);
            return res.send("No shop provided");
        }

        const shop = Shopify.Utils.sanitizeShop(req.query.shop);
        const appInstalled = await AppInstallations.includes(shop);

        if (!appInstalled && !req.originalUrl.match(/^\/exitiframe/i)) {
            return redirectToAuth(req, res, app);
        }

        if (Shopify.Context.IS_EMBEDDED_APP && req.query.embedded !== "1") {
            const embeddedUrl = Shopify.Utils.getEmbeddedAppUrl(req);

            return res.redirect(embeddedUrl + req.path);
        }

        const htmlFile = join(isProd ? PROD_INDEX_PATH : DEV_INDEX_PATH, "index.html");

        return res.status(200).set("Content-Type", "text/html").send(readFileSync(htmlFile));
    });

    return { app };
}

createServer().then(({ app }) => app.listen(PORT));
