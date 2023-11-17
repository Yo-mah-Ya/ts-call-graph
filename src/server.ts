import { CallHierarchyItemWithChildren } from "./call-hierarchy";
import { callsToDotString, createBaseUrlPath } from "./gen/graphviz";
import { Option } from "./option";
import express, {
  Express,
  Response,
  NextFunction,
  ErrorRequestHandler,
  Router,
} from "express";
import { deepCopy } from "deep-copy-ts";
import { EOL } from "os";
import { existsSync, readFileSync } from "fs";

const errorHandler: ErrorRequestHandler<unknown, string> = (
  error: unknown,
  req,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) return next(error);
  console.error({
    error,
    reqUrl: req.url,
  });
  res
    .status(500)
    .send(error instanceof Error ? error.message : "unknown error");
  return;
};

const graphTemplateWith = (body: string): Buffer =>
  Buffer.from(
    `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Call Graph</title>
      </head>
      <body>
        <script src="https://cdn.jsdelivr.net/npm/deepcopy@2.1.0/umd/deepcopy.min.js"></script>
        <div id="graph"></div>
      </body>
      <script type="module">
        import { Graphviz } from "https://cdn.jsdelivr.net/npm/@hpcc-js/wasm/dist/graphviz.js";

        const graphviz = await Graphviz.load();
        const dot = ` +
      "`" +
      body +
      "`" +
      `;

        const div = document.getElementById("graph");
        if(div){
          div.innerHTML = graphviz.layout(dot, "svg", "dot");
        };
      </script>
      </html>`,
  );

const searchNodeById = (
  kind: string,
  tree: CallHierarchyItemWithChildren,
  id: number,
): CallHierarchyItemWithChildren => {
  const stack = [tree];

  while (stack.length) {
    const parentNode = stack.pop() as CallHierarchyItemWithChildren;

    if (parentNode.id === id) {
      return parentNode;
    }

    if (parentNode?.children) {
      for (let i = parentNode.children.length - 1; i >= 0; i--) {
        stack.push(parentNode.children[i]);
      }
    }
  }
  throw new Error(
    `specified ID: ${id} was not found, but it is supposed to be in ${kind}.`,
  );
};

const createRouter = (
  originalTrees: CallHierarchyItemWithChildren[],
  option: Option,
): Router => {
  const router = Router();
  const routingPaths: string[] = [];

  for (const originalTree of originalTrees) {
    const filePath = createBaseUrlPath(originalTree, option);
    const routingPath = encodeURI(filePath);
    routingPaths.push(routingPath);

    const currentTree = deepCopy(originalTree);

    router.get<never, Buffer, never, { id?: number; file?: string }>(
      routingPath,
      (req, res) => {
        res.header("Content-Type", "text/html");

        const id = Number(req.query.id);

        // When ID is specified, the corresponding node will add or remove child nodes.
        if (!Number.isNaN(id)) {
          const targetNode = searchNodeById("currentTree", currentTree, id);
          const originalNode = searchNodeById("originalTree", originalTree, id);

          if (targetNode.children.length) {
            // When it has children, just remove children
            targetNode.children.length = 0;
          } else {
            // When it doesn't have children, get original children back
            targetNode.children = [...originalNode.children].map((child) =>
              deepCopy({
                ...child,
                children: [],
              }),
            );
          }
          res.send(graphTemplateWith(callsToDotString(currentTree, option)));
          return;
        }
        // When clicked a subgraph
        if (req.query.file) {
          const file = decodeURI(req.query.file);
          if (!existsSync(file)) {
            throw new Error(`${file} not found`);
          }
          res.send(
            Buffer.from(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="color-scheme" content="light dark">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${file}</title>
            </head>
            <body>
              <pre style="word-wrap: break-word; white-space: pre-wrap;">${readFileSync(
                file,
                { encoding: "utf-8" },
              )}</pre>
            </body>
            </html>`),
          );
          return;
        }

        res.send(graphTemplateWith(callsToDotString(originalTree, option)));
      },
    );
  }

  router.get("/", (_, res) => {
    res.header("Content-Type", "text/html").send(
      `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
          <title>Call Sites</title>
          <style>
          a {
            font-size: 2.5rem;
          }
          </style>
        </head>
        <body>
          <ul>${routingPaths
            .map(
              (routingPath) =>
                `<li><a href="${routingPath}">${routingPath}</a></li>`,
            )
            .join(EOL)}
          </ul>
        </body>
        </html>
        `,
    );
  });
  return router;
};

export const getExpressApp = (
  originalTrees: CallHierarchyItemWithChildren[],
  option: Option,
): Express => {
  const app = express();
  app
    .use(express.urlencoded({ extended: true }))
    .use(createRouter(originalTrees, option))
    .all("*", (_, res) => {
      res.redirect("/");
    })
    .use(errorHandler);
  return app;
};

export const startServer = (
  originalTrees: CallHierarchyItemWithChildren[],
  option: Option,
): void => {
  const app = getExpressApp(originalTrees, option);

  const port = 7878;
  const server = app.listen(port, () => {
    console.info(`Express Server Started. "http://localhost:${port}/"`);
  });
  server.keepAliveTimeout = 0;
};
