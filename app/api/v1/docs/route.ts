import fs from "fs";
import yaml from "js-yaml";
import { NextResponse } from "next/server";
import path from "path";

export const GET = async () => {
  const filePath = path.join(process.cwd(), "openapi/openapi.yaml");

  const yamlFile = fs.readFileSync(filePath, "utf8");
  const swaggerObject = yaml.load(yamlFile);

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>FireTrade API Docs</title>
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />
      <style>
        body { margin: 0; padding: 0; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>

      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>

      <script>
        window.onload = () => {
          SwaggerUIBundle({
            spec: ${JSON.stringify(swaggerObject)},
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
          });
        };
      </script>
    </body>
  </html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};
