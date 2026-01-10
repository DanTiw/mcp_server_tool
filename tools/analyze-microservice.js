import fs from "fs/promises";
import path from "path";
import { parseCsProject, findCSharpFiles, csharpPatterns } from "../utils/file-parser.js";
import { microservicePatterns } from "../utils/microservice-patterns.js";

/**
 * Analyzes a .NET Microservice project
 */
export async function analyzeMicroservice(projectPath) {
    try {
        const { path: csprojPath, content: projectContent } = await parseCsProject(projectPath);
        const projectDir = path.dirname(csprojPath);
        const sourceFiles = await findCSharpFiles(projectDir);

        const analysis = {
            projectType: "Unknown",
            targetFramework: "Unknown",
            layers: {
                controllers: [],
                services: [],
                repositories: [],
                dtos: []
            },
            patterns: {
                healthChecks: false,
                logging: false,
                containerization: false,
                resilience: false
            },
            summary: "Analysis Complete"
        };

        // 1. Analyze Project File (.csproj)
        const projectGroup = projectContent?.Project?.PropertyGroup;
        if (projectGroup) {
            const groups = Array.isArray(projectGroup) ? projectGroup : [projectGroup];
            for (const group of groups) {
                if (group.TargetFramework) {
                    analysis.targetFramework = group.TargetFramework;
                }
                if (group.Sdk) {
                    if (group.Sdk.includes("Microsoft.NET.Sdk.Web")) {
                        analysis.projectType = "Web API";
                    }
                }
            }
        }

        // 2. Scan Source Files for Structure
        for (const file of sourceFiles) {
            const content = await fs.readFile(file, "utf-8");

            // Identify Layers
            if (microservicePatterns.controller.test(file) || (content.match(/:.*Controller/) && !content.match(/abstract.*class/))) {
                analysis.layers.controllers.push(path.basename(file));
            }
            if (microservicePatterns.service.test(file) && !file.includes("Program.cs")) {
                analysis.layers.services.push(path.basename(file));
            }
            if (microservicePatterns.repository.test(file)) {
                analysis.layers.repositories.push(path.basename(file));
            }
            if (microservicePatterns.dto.test(file)) {
                analysis.layers.dtos.push(path.basename(file));
            }

            // Identify Patterns
            if (microservicePatterns.healthCheck.test(content)) analysis.patterns.healthChecks = true;
            if (microservicePatterns.logging.test(content)) analysis.patterns.logging = true;
            if (microservicePatterns.polly.test(content)) analysis.patterns.resilience = true;
        }

        // Check for Dockerfile
        try {
            await fs.access(path.join(projectDir, "Dockerfile"));
            analysis.patterns.containerization = true;
        } catch { }

        // Generate Summary
        return {
            content: [
                {
                    type: "text",
                    text: formatOutput(analysis)
                }
            ]
        };

    } catch (error) {
        throw new Error(`Microservice analysis failed: ${error.message}`);
    }
}

function formatOutput(analysis) {
    return `
# Microservice Analysis Report

**Project Type:** ${analysis.projectType}
**Framework:** ${analysis.targetFramework}

## Architecture Layers
- **Controllers:** ${analysis.layers.controllers.length} found
- **Services:** ${analysis.layers.services.length} found
- **Repositories:** ${analysis.layers.repositories.length} found
- **DTOs:** ${analysis.layers.dtos.length} found

## Microservice Patterns
- [${analysis.patterns.healthChecks ? "x" : " "}] Health Checks
- [${analysis.patterns.logging ? "x" : " "}] Structured Logging
- [${analysis.patterns.containerization ? "x" : " "}] Docker Containerization
- [${analysis.patterns.resilience ? "x" : " "}] Resilience (Polly)

## Observations
${analysis.layers.controllers.length > 0 && analysis.layers.services.length === 0 ? "- ⚠️ **Potential Issue:** Controllers found but no Services detected. Ensure business logic is not in controllers." : ""}
${analysis.projectType === "Web API" && !analysis.patterns.healthChecks ? "- ⚠️ **Recommendation:** Add Health Checks for microservice monitoring." : ""}
${analysis.targetFramework !== "net8.0" ? `- ℹ️ **Notice:** Framework is '${analysis.targetFramework}'. Consider upgrading to .NET 8 for performance and memory improvements.` : "- ✅ Using .NET 8 (assuming 'net8.0')."}
  `;
}
