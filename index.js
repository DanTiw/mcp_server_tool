#!/usr/bin/env node

/**
 * MCP Server for .NET Core 8 Code Review
 * Focused on microservices, memory leak detection, and API optimization.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";

// Import tools
import { detectMemoryLeaks } from "./tools/detect-memory-leaks.js";
import { analyzeMicroservice } from "./tools/analyze-microservice.js";
import { reviewCodeQuality } from "./tools/review-code-quality.js";
import { checkDependencies } from "./tools/check-dependencies.js";

const server = new Server(
  {
    name: "dotnet-review-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "detect_memory_leaks",
        description: "Scans C# code for potential memory leaks, unclosed resources, and improper IDisposable usage.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path to the C# file or directory to scan",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "analyze_microservice",
        description: "Analyzes the structure and configuration of a .NET Core 8 microservice project.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "Absolute path to the .csproj file or project directory",
            },
          },
          required: ["projectPath"],
        },
      },
      {
        name: "review_code_quality",
        description: "Reviews C# code for quality issues, naming conventions, error handling, and performance (API usage).",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Absolute path to the file or directory to review",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "check_dependencies",
        description: "Checks NuGet dependencies for updates, security vulnerabilities, and compatibility.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "Absolute path to the .csproj file",
            },
          },
          required: ["projectPath"],
        },
      },
    ],
  };
});

/**
 * Handler for calling tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "detect_memory_leaks":
        return await detectMemoryLeaks(args.path);
      case "analyze_microservice":
        return await analyzeMicroservice(args.projectPath);
      case "review_code_quality":
        return await reviewCodeQuality(args.path);
      case "check_dependencies":
        return await checkDependencies(args.projectPath);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dotnet Review MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
