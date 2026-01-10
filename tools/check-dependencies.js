import fs from "fs/promises";
import path from "path";
import { parseCsProject } from "../utils/file-parser.js";

/**
 * Checks project dependencies
 */
export async function checkDependencies(projectPath) {
    try {
        const { path: csprojPath, content: projectContent } = await parseCsProject(projectPath);

        const dependencies = [];
        const itemGroups = projectContent?.Project?.ItemGroup;

        if (itemGroups) {
            const groups = Array.isArray(itemGroups) ? itemGroups : [itemGroups];
            for (const group of groups) {
                if (group.PackageReference) {
                    const refs = Array.isArray(group.PackageReference) ? group.PackageReference : [group.PackageReference];
                    for (const ref of refs) {
                        dependencies.push({
                            name: ref["@_Include"],
                            version: ref["@_Version"]
                        });
                    }
                }
            }
        }

        const issues = analyzeDependencies(dependencies);

        return {
            content: [
                {
                    type: "text",
                    text: formatDependencyReport(dependencies, issues, path.basename(csprojPath))
                }
            ]
        };

    } catch (error) {
        throw new Error(`Dependency check failed: ${error.message}`);
    }
}

function analyzeDependencies(dependencies) {
    const issues = [];

    for (const dep of dependencies) {
        // 1. Security / Vulnerable Package Checks (Mock/Heuristic based on common vulnerable libs)
        // In a real implementation, this would query the NuGet API or GitHub Advisory Database.
        // Here we check for known legacy libraries.
        if (dep.name === "Newtonsoft.Json" && dep.version && dep.version.startsWith("9.")) {
            issues.push({
                package: dep.name,
                severity: "High",
                message: "Old version detected. Upgrade to 13.x or migrate to System.Text.Json."
            });
        }

        // 2. Compatibility Checks for .NET 8
        if (dep.name.startsWith("Microsoft.AspNetCore") && dep.version && dep.version.startsWith("2.")) {
            issues.push({
                package: dep.name,
                severity: "High",
                message: "ASP.NET Core 2.x packages are incompatible with .NET 8. Upgrade to Microsoft.AspNetCore.App framework reference."
            });
        }

        // 3. Best Practices
        if (dep.name === "System.Data.SqlClient") {
            issues.push({
                package: dep.name,
                severity: "Medium",
                message: "Consider using 'Microsoft.Data.SqlClient' which is the newer, maintained driver for SQL Server."
            });
        }
    }

    return issues;
}

function formatDependencyReport(dependencies, issues, projectName) {
    let report = `# Dependency Analysis for ${projectName}\n\n`;

    if (dependencies.length === 0) {
        report += "No package references found.\n";
    } else {
        report += `Found ${dependencies.length} packages.\n\n`;
    }

    if (issues.length > 0) {
        report += "## ⚠️ Issues Detected\n\n";
        issues.forEach(issue => {
            report += `- **${issue.package}**: ${issue.message}\n`;
        });
        report += "\n";
    } else {
        report += "## ✅ No obvious dependency issues found.\n\n";
    }

    report += "## Package List\n";
    dependencies.forEach(dep => {
        report += `- ${dep.name} (${dep.version})\n`;
    });

    return report;
}
