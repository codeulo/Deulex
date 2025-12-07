import fs from "fs";
import yaml from "js-yaml";
import { NextResponse } from "next/server";
import path from "path";

export const GET = async () => {
  const filePath = path.join(process.cwd(), "openapi/openapi.yaml");
  const yamlFile = fs.readFileSync(filePath, "utf8");
  const spec = yaml.load(yamlFile);

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>FireTrade API Docs (Redoc)</title>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1">

      <!-- Redoc via CDN -->
      <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>

      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: sans-serif;
        }
      </style>
    </head>

    <body>
      <redoc spec="${encodeURIComponent(JSON.stringify(spec))}"></redoc>
    </body>
  </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
};
